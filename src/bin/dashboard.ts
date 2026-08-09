#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { FileStore } from '../store';
import { Aggregator } from '../aggregator';
import { DashboardApi, DevAuthProvider, StorageSettingsApi, StoreResolver, ConnectorSettingsApi, SyncHealthApi } from '../dashboard';
import type { AuthProvider } from '../dashboard';
import { OidcAuthProvider, SamlAuthProvider, FileUsageMeter, NullUsageMeter } from '../dashboard';
import { ConnectorService } from '../connectors';
import { IngestService } from '../ingest';
import type { UsageMeter } from '../dashboard';
import type { Store } from '../store';

interface DashboardOptions {
  dataDir: string;
  port: number;
  auth: 'dev' | 'oidc' | 'saml';
  oidcUrl: string;
  oidcFixedTenant: string;
  samlFixedTenant: string;
  meteringDir: string;
}

function printUsage(): void {
  console.log(`
Usage: evoveo-smart-reporter-dashboard [options]

Boots the leadership dashboard: serves the SPA + REST API + ingest endpoint
in a single process. One command to run the entire platform.

Options:
  --data-dir <path>       Data directory for the store (default: ./data)
  --port <port>           HTTP port (default: 3000)
  --auth <mode>           Auth mode: dev | oidc | saml (default: dev)
  --oidc-url <url>        OIDC userinfo endpoint (when --auth oidc)
  --oidc-fixed-tenant <id>  Fixed tenant for single-tenant OIDC deployments
  --saml-fixed-tenant <id>   Fixed tenant for single-tenant SAML deployments
  --metering-dir <path>   Directory for usage metering logs (default: none)
  -h, --help              Show this help

Dev mode (--auth dev):
  The dashboard trusts X-Tenant-Id, X-User-Id, X-User-Role headers.
  The login page sets these. FOR LOCAL DEV ONLY.

OIDC mode (--auth oidc):
  Validates bearer tokens against the OIDC userinfo endpoint.
  The UI must obtain tokens from the IdP and send them as Bearer tokens.

SAML mode (--auth saml):
  Trusts headers set by an external SAML gateway (mod_auth_mellon, etc.).

Cloud storage:
  Each user connects their own M365 or Google Workspace account via the
  Settings tab. Data is stored in their cloud drive folder. The director
  shares the folder with the team via native M365/Google sharing. Team
  members connect to the same shared folder with their own credentials.
  No Docker, no Postgres needed.
`);
}

function parseArgs(argv: string[]): DashboardOptions {
  const args = argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) { printUsage(); process.exit(0); }
  const opts: DashboardOptions = {
    dataDir: path.resolve(process.cwd(), 'data'),
    port: 3000,
    auth: 'dev',
    oidcUrl: '',
    oidcFixedTenant: '',
    samlFixedTenant: '',
    meteringDir: '',
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--data-dir') opts.dataDir = path.resolve(args[++i] ?? 'data');
    else if (a === '--port') opts.port = parseInt(args[++i] ?? '3000', 10);
    else if (a === '--auth') opts.auth = (args[++i] ?? 'dev') as DashboardOptions['auth'];
    else if (a === '--oidc-url') opts.oidcUrl = args[++i] ?? '';
    else if (a === '--oidc-fixed-tenant') opts.oidcFixedTenant = args[++i] ?? '';
    else if (a === '--saml-fixed-tenant') opts.samlFixedTenant = args[++i] ?? '';
    else if (a === '--metering-dir') opts.meteringDir = path.resolve(args[++i] ?? 'metering');
  }
  return opts;
}

function createAuthProvider(opts: DashboardOptions): AuthProvider {
  switch (opts.auth) {
    case 'oidc':
      if (!opts.oidcUrl) { console.error('--oidc-url is required when --auth oidc'); process.exit(1); }
      return new OidcAuthProvider({ userinfoUrl: opts.oidcUrl, fixedTenantId: opts.oidcFixedTenant || undefined });
    case 'saml':
      return new SamlAuthProvider({ fixedTenantId: opts.samlFixedTenant || undefined });
    default:
      return new DevAuthProvider();
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const fileStore = new FileStore(opts.dataDir);
  await fileStore.open();
  const storageSettings = new StorageSettingsApi(opts.dataDir);
  const storeResolver = new StoreResolver(fileStore, storageSettings);
  const connectorService = new ConnectorService(opts.dataDir);
  const connectorSettings = new ConnectorSettingsApi(connectorService);
  const syncHealthApi = new SyncHealthApi(opts.dataDir);
  const authProvider = createAuthProvider(opts);
  const meter: UsageMeter = opts.meteringDir ? new FileUsageMeter(opts.meteringDir) : new NullUsageMeter();
  const api = new DashboardApi(storeResolver, authProvider, connectorService);

  // Read the dashboard HTML (embedded in the source tree).
  const htmlPath = path.join(__dirname, 'dashboard.html');
  let dashboardHtml: string;
  try {
    dashboardHtml = fs.readFileSync(htmlPath, 'utf-8');
  } catch {
    // Fallback: read from src (dev mode, not yet built)
    const srcHtml = path.resolve(__dirname, '..', '..', 'src', 'dashboard', 'dashboard.html');
    dashboardHtml = fs.readFileSync(srcHtml, 'utf-8');
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    // Serve the SPA at /
    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(dashboardHtml);
      return;
    }
    // API routes
    if (url.startsWith('/api/')) {
      // Storage settings: OAuth callback is public; other endpoints need any
      // authenticated user (both admin and viewer can manage their own storage).
      if (url.startsWith('/api/storage/')) {
        // OAuth callback is public (browser redirect target).
        if (url.startsWith('/api/storage/oauth/callback')) {
          await storageSettings.handle(req, res, { userId: '', tenantId: '', role: 'viewer' });
          return;
        }
        // Other storage endpoints require any authenticated user (not just admin).
        const session = await authProvider.resolveSession(req);
        if (!session) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
        const handled = await storageSettings.handle(req, res, session);
        if (handled) return;
      }

      // Connector settings (admin-only).
      if (url.startsWith('/api/connectors/')) {
        const session = await authProvider.resolveSession(req);
        if (!session) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
        const handled = await connectorSettings.handle(req, res, session);
        if (handled) return;
      }

      // Sync health (any authenticated user — leaders need to see freshness).
      if (url.startsWith('/api/sync/')) {
        const session = await authProvider.resolveSession(req);
        if (!session) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
        const handled = await syncHealthApi.handle(req, res);
        if (handled) return;
      }

      // Ingest is mounted under /api/ingest for authenticated ingestion.
      if (url === '/api/ingest' && req.method === 'POST') {
        const session = await authProvider.resolveSession(req);
        if (!session) { res.writeHead(401); res.end(JSON.stringify({ error: 'unauthorized' })); return; }
        // Resolve the store for this user (cloud or local).
        const store = await storeResolver.resolve(session);
        const ingestService = new IngestService(store, meter);
        let body = '';
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString();
          if (body.length > 10 * 1024 * 1024) { req.destroy(); res.writeHead(413); res.end('payload too large'); }
        });
        req.on('end', async () => {
          try {
            const payload = JSON.parse(body);
            const result = await ingestService.ingest(payload);
            res.writeHead(result.accepted ? 202 : 400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ accepted: false, runId: '', errors: ['invalid JSON body'] }));
          }
        });
        return;
      }
      await api.handle(req, res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(opts.port, () => {
    console.log(`Test Intelligence Platform dashboard: http://localhost:${opts.port}`);
    console.log(`  Auth: ${opts.auth}`);
    console.log(`  Data: ${opts.dataDir}`);
    if (opts.meteringDir) console.log(`  Metering: ${opts.meteringDir}`);
    console.log(`  Storage: local file (connect cloud storage via Settings tab)`);
  });

  const shutdown = async () => {
    server.close();
    meter.close();
    await storeResolver.close();
    await fileStore.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => { console.error(err); process.exit(1); });
