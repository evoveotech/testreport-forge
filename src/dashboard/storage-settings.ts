import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudStorageConfig } from '../store';
import { buildAuthorizeUrl, exchangeCodeForTokens } from '../store';

/**
 * Manages cloud storage configuration. The admin connects their M365 or
 * Google Workspace account via OAuth; the config (with tokens) is persisted
 * to a local file so the server can use the cloud store on restart.
 *
 * Endpoints (all require admin role -- enforced by the caller):
 *   GET  /api/storage/config           -- current storage config (tokens redacted)
 *   POST /api/storage/connect          -- start OAuth flow (returns authorize URL)
 *   GET  /api/storage/oauth/callback   -- OAuth redirect target (exchanges code)
 *   POST /api/storage/disconnect       -- clear cloud storage config
 */
export class StorageSettingsApi {
  private readonly configFile: string;

  constructor(dataDir: string) {
    this.configFile = path.join(dataDir, 'cloud-storage.json');
  }

  /**
   * Load the current cloud storage config, or null if not configured.
   */
  loadConfig(): CloudStorageConfig | null {
    try {
      const raw = fs.readFileSync(this.configFile, 'utf-8');
      return JSON.parse(raw) as CloudStorageConfig;
    } catch {
      return null;
    }
  }

  /**
   * Save cloud storage config to disk.
   */
  saveConfig(config: CloudStorageConfig): void {
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Clear cloud storage config (disconnect).
   */
  clearConfig(): void {
    try { fs.unlinkSync(this.configFile); } catch { /* not configured */ }
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? '';
    const method = req.method ?? 'GET';

    // The OAuth callback is public (the browser redirects here after consent).
    if (url.startsWith('/api/storage/oauth/callback') && method === 'GET') {
      await this.handleOAuthCallback(url, res);
      return true;
    }

    // All other storage endpoints require admin role (enforced by caller).
    if (url === '/api/storage/config' && method === 'GET') {
      const config = this.loadConfig();
      if (!config) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ configured: false }));
        return true;
      }
      // Redact tokens in the response.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        configured: true,
        provider: config.provider,
        folderPath: config.folderPath,
        tokenExpiresAt: config.tokenExpiresAt,
      }));
      return true;
    }

    if (url === '/api/storage/connect' && method === 'POST') {
      const body = await readBody(req);
      let params: { provider: 'onedrive' | 'googledrive'; clientId: string; clientSecret: string; redirectUri: string; folderPath: string; msTenantId?: string };
      try { params = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid JSON' }));
        return true;
      }
      if (!params.provider || !params.clientId || !params.redirectUri || !params.folderPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'missing required fields' }));
        return true;
      }
      const authorizeUrl = buildAuthorizeUrl({
        provider: params.provider,
        clientId: params.clientId,
        redirectUri: params.redirectUri,
      });
      // Save partial config (without tokens yet) so the callback knows the params.
      this.saveConfig({
        provider: params.provider,
        accessToken: '',
        refreshToken: '',
        tokenExpiresAt: 0,
        folderPath: params.folderPath,
        clientId: params.clientId,
        clientSecret: params.clientSecret,
        redirectUri: params.redirectUri,
        msTenantId: params.msTenantId,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ authorizeUrl }));
      return true;
    }

    if (url === '/api/storage/disconnect' && method === 'POST') {
      this.clearConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ disconnected: true }));
      return true;
    }

    return false;
  }

  private async handleOAuthCallback(url: string, res: ServerResponse): Promise<void> {
    const qs = new URLSearchParams(url.split('?')[1] ?? '');
    const code = qs.get('code');
    const error = qs.get('error');
    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h2>Connection failed</h2><p>${error}</p></body></html>`);
      return;
    }
    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Missing authorization code</h2></body></html>');
      return;
    }
    const config = this.loadConfig();
    if (!config) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>No pending connection. Start from the dashboard Settings.</h2></body></html>');
      return;
    }
    try {
      const tokens = await exchangeCodeForTokens(config, code);
      this.saveConfig({
        ...config,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: Date.now() + tokens.expiresIn * 1000,
      });
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Cloud storage connected!</h2><p>You can close this tab and return to the dashboard.</p><script>setTimeout(()=>window.close(),3000)</script></body></html>');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h2>Token exchange failed</h2><p>${(e as Error).message}</p></body></html>`);
    }
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
