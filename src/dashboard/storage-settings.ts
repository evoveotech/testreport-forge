import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { CloudStorageConfig } from '../store';
import { buildAuthorizeUrl, exchangeCodeForTokens } from '../store';
import type { Session } from './auth';

/**
 * Manages per-user cloud storage configuration. Each user (director OR team
 * member) connects their own M365 or Google Workspace account via OAuth.
 * Configs are persisted as `<dataDir>/cloud-storage/<userId>.json`.
 *
 * Flow:
 *   1. Director (admin) connects → data stored in their cloud drive folder
 *   2. Director shares the folder with team via M365/Google native sharing
 *   3. Team member (viewer) connects → same shared folder path, their own tokens
 *   4. Both view results through the dashboard UI — no one opens raw files
 *
 * Endpoints:
 *   GET  /api/storage/config           -- current user's config (tokens redacted)
 *   POST /api/storage/connect          -- start OAuth flow (returns authorize URL)
 *   GET  /api/storage/oauth/callback   -- OAuth redirect (exchanges code, uses state)
 *   POST /api/storage/disconnect       -- clear current user's cloud config
 */
export class StorageSettingsApi {
  private readonly configDir: string;

  constructor(dataDir: string) {
    this.configDir = path.join(dataDir, 'cloud-storage');
  }

  private configPath(userId: string): string {
    // Sanitize userId to prevent path traversal.
    const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.configDir, `${safe}.json`);
  }

  /**
   * Load cloud storage config for a specific user.
   */
  loadConfigForUser(userId: string): CloudStorageConfig | null {
    try {
      const raw = fs.readFileSync(this.configPath(userId), 'utf-8');
      return JSON.parse(raw) as CloudStorageConfig;
    } catch {
      return null;
    }
  }

  /**
   * Save cloud storage config for a specific user.
   */
  saveConfigForUser(userId: string, config: CloudStorageConfig): void {
    fs.mkdirSync(this.configDir, { recursive: true });
    fs.writeFileSync(this.configPath(userId), JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Clear cloud storage config for a specific user.
   */
  clearConfigForUser(userId: string): void {
    try { fs.unlinkSync(this.configPath(userId)); } catch { /* not configured */ }
  }

  /**
   * Handle storage settings API requests. Requires a session (the user
   * connecting/disconnecting their OWN storage). Both admin and viewer
   * roles can manage their own cloud storage connection.
   */
  async handle(req: IncomingMessage, res: ServerResponse, session: Session): Promise<boolean> {
    const url = req.url ?? '';
    const method = req.method ?? 'GET';

    // The OAuth callback is public (the browser redirects here after consent).
    // The userId is passed via the state parameter.
    if (url.startsWith('/api/storage/oauth/callback') && method === 'GET') {
      await this.handleOAuthCallback(url, res);
      return true;
    }

    if (url === '/api/storage/config' && method === 'GET') {
      const config = this.loadConfigForUser(session.userId);
      if (!config) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ configured: false }));
        return true;
      }
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
      // Pass userId as the OAuth state so the callback knows which user to save for.
      const state = encodeURIComponent(session.userId);
      const authorizeUrl = buildAuthorizeUrl({
        provider: params.provider,
        clientId: params.clientId,
        redirectUri: params.redirectUri,
      }) + `&state=${state}`;
      // Save partial config (without tokens yet) so the callback can complete it.
      this.saveConfigForUser(session.userId, {
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
      this.clearConfigForUser(session.userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ disconnected: true }));
      return true;
    }

    return false;
  }

  private async handleOAuthCallback(url: string, res: ServerResponse): Promise<void> {
    const qs = new URLSearchParams(url.split('?')[1] ?? '');
    const code = qs.get('code');
    const state = qs.get('state');
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
    if (!state) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Missing state parameter</h2></body></html>');
      return;
    }
    const userId = decodeURIComponent(state);
    const config = this.loadConfigForUser(userId);
    if (!config) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>No pending connection for this user. Start from the dashboard Settings.</h2></body></html>');
      return;
    }
    try {
      const tokens = await exchangeCodeForTokens(config, code);
      this.saveConfigForUser(userId, {
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
