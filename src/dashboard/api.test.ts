import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AddressInfo } from 'net';
import { FileStore } from '../store';
import { DashboardApi } from './api';
import { DevAuthProvider } from './auth';
import { StorageSettingsApi } from './storage-settings';
import { StoreResolver } from './store-resolver';
import type { IngestedRun, OrgContext } from '../types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-api-'));
}

function ctx(overrides: Partial<OrgContext> = {}): OrgContext {
  return { tenantId: 'acme', client: 'c1', product: 'p1', team: 't1', stack: 'playwright', runType: 'pr', environment: 'dev', ...overrides };
}

function run(tenantId: string, runId: string, passRate: number, daysAgo: number, orgCtx: Partial<OrgContext> = {}, reportPath?: string): IngestedRun {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return {
    runId, timestamp: d.toISOString(),
    total: 100, passed: Math.round(passRate), failed: 100 - Math.round(passRate),
    skipped: 0, flaky: 0, slow: 0, duration: 5000, passRate,
    orgContext: ctx({ tenantId, ...orgCtx }),
    ingestedAt: d.toISOString(),
    reportPath,
  };
}

function startServer(store: FileStore, dataDir: string, auth = new DevAuthProvider()): { server: http.Server; api: DashboardApi } {
  const storageSettings = new StorageSettingsApi(dataDir);
  const resolver = new StoreResolver(store, storageSettings);
  const api = new DashboardApi(resolver, auth);
  const server = http.createServer((req, res) => api.handle(req, res).catch(e => { res.writeHead(500); res.end(JSON.stringify({ error: String(e) })); }));
  server.listen(0);
  return { server, api };
}

function req(server: http.Server, method: string, urlPath: string, headers: Record<string, string> = {}): Promise<{ status: number; body: string }> {
  const addr = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: addr.port, path: urlPath, method, headers }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf }));
    });
    r.on('error', reject);
    r.end();
  });
}

const ACME = { 'x-tenant-id': 'acme', 'x-user-id': 'u1', 'x-user-role': 'viewer' };
const GLOBEX = { 'x-tenant-id': 'globex', 'x-user-id': 'u2', 'x-user-role': 'viewer' };

describe('DashboardApi', () => {
  let dir: string;
  let store: FileStore;
  let server: http.Server;

  beforeEach(async () => {
    dir = tmpDir();
    store = new FileStore(dir);
    await store.open();
    ({ server } = startServer(store, dir));
  });

  afterEach(async () => {
    server.close();
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('auth', () => {
    it('GET /api/health is public', async () => {
      const res = await req(server, 'GET', '/api/health');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).status).toBe('ok');
    });

    it('rejects requests without auth headers (401)', async () => {
      const res = await req(server, 'GET', '/api/estate');
      expect(res.status).toBe(401);
    });

    it('returns the session at /api/me', async () => {
      const res = await req(server, 'GET', '/api/me', ACME);
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.tenantId).toBe('acme');
      expect(json.userId).toBe('u1');
    });
  });

  describe('estate rollup', () => {
    it('returns a tenant-scoped estate rollup', async () => {
      await store.insertRun(run('acme', 'r1', 90, 1, { client: 'c1' }));
      await store.insertRun(run('acme', 'r2', 80, 1, { client: 'c2' }));
      const res = await req(server, 'GET', '/api/estate?period=weekly', ACME);
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.tenantId).toBe('acme');
      expect(json.totalRuns).toBe(2);
      expect(json.byClient.map((s: any) => s.key).sort()).toEqual(['c1', 'c2']);
    });

    it('never returns another tenant\'s runs in the rollup', async () => {
      await store.insertRun(run('acme', 'r1', 90, 1));
      await store.insertRun(run('globex', 'r2', 50, 1));
      const acme = await req(server, 'GET', '/api/estate', ACME);
      const globex = await req(server, 'GET', '/api/estate', GLOBEX);
      expect(JSON.parse(acme.body).totalRuns).toBe(1);
      expect(JSON.parse(acme.body).passRate).toBe(90);
      expect(JSON.parse(globex.body).totalRuns).toBe(1);
      expect(JSON.parse(globex.body).passRate).toBe(50);
    });
  });

  describe('runs', () => {
    it('lists runs filtered by client', async () => {
      await store.insertRun(run('acme', 'r1', 90, 1, { client: 'c1' }));
      await store.insertRun(run('acme', 'r2', 80, 1, { client: 'c2' }));
      const res = await req(server, 'GET', '/api/runs?client=c1', ACME);
      expect(res.status).toBe(200);
      const json = JSON.parse(res.body);
      expect(json).toHaveLength(1);
      expect(json[0].orgContext.client).toBe('c1');
    });

    it('getRun returns 404 for another tenant\'s run', async () => {
      await store.insertRun(run('acme', 'r1', 90, 1));
      const res = await req(server, 'GET', '/api/runs/r1', GLOBEX);
      expect(res.status).toBe(404);
    });

    it('getRun returns the run for the same tenant', async () => {
      await store.insertRun(run('acme', 'r1', 90, 1));
      const res = await req(server, 'GET', '/api/runs/r1', ACME);
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body).runId).toBe('r1');
    });
  });

  describe('report drilldown (ADR-004)', () => {
    it('serves the attached single-run HTML report', async () => {
      const reportFile = path.join(dir, 'report.html');
      fs.writeFileSync(reportFile, '<html><body>report</body></html>');
      await store.insertRun(run('acme', 'r1', 90, 1, {}, reportFile));
      const res = await req(server, 'GET', '/api/runs/r1/report', ACME);
      expect(res.status).toBe(200);
      expect(res.body).toContain('<html>');
    });

    it('returns 404 when no report is attached', async () => {
      await store.insertRun(run('acme', 'r1', 90, 1));
      const res = await req(server, 'GET', '/api/runs/r1/report', ACME);
      expect(res.status).toBe(404);
    });

    it('does not serve reports to other tenants', async () => {
      const reportFile = path.join(dir, 'report.html');
      fs.writeFileSync(reportFile, '<html>secret</html>');
      await store.insertRun(run('acme', 'r1', 90, 1, {}, reportFile));
      const res = await req(server, 'GET', '/api/runs/r1/report', GLOBEX);
      expect(res.status).toBe(404);
    });
  });

  it('unknown route returns 404', async () => {
    const res = await req(server, 'GET', '/api/nope', ACME);
    expect(res.status).toBe(404);
  });
});
