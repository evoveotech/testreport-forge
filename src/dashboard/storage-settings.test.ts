import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { StorageSettingsApi } from './storage-settings';
import { buildAuthorizeUrl, OAUTH_ENDPOINTS } from '../store';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-storage-'));
}

describe('buildAuthorizeUrl', () => {
  it('builds a valid Microsoft OAuth URL for OneDrive', () => {
    const url = buildAuthorizeUrl({ provider: 'onedrive', clientId: 'test-client-id', redirectUri: 'http://localhost:3000/callback' });
    expect(url).toContain('login.microsoftonline.com');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('response_type=code');
    expect(url).toContain('Files.ReadWrite');
  });

  it('builds a valid Google OAuth URL for Google Drive', () => {
    const url = buildAuthorizeUrl({ provider: 'googledrive', clientId: 'g-client-id', redirectUri: 'http://localhost:3000/callback' });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('client_id=g-client-id');
    expect(url).toContain('drive.file');
  });
});

describe('OAUTH_ENDPOINTS', () => {
  it('has correct scopes for OneDrive', () => {
    expect(OAUTH_ENDPOINTS.onedrive.scope).toContain('Files.ReadWrite');
    expect(OAUTH_ENDPOINTS.onedrive.scope).toContain('offline_access');
  });

  it('has correct scope for Google Drive', () => {
    expect(OAUTH_ENDPOINTS.googledrive.scope).toContain('drive.file');
  });
});

describe('StorageSettingsApi', () => {
  let dir: string;
  let api: StorageSettingsApi;

  beforeEach(() => {
    dir = tmpDir();
    api = new StorageSettingsApi(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('loadConfig returns null when not configured', () => {
    expect(api.loadConfig()).toBeNull();
  });

  it('saveConfig + loadConfig round-trips', () => {
    api.saveConfig({
      provider: 'onedrive',
      accessToken: 'token-123',
      refreshToken: 'refresh-456',
      tokenExpiresAt: Date.now() + 3600000,
      folderPath: 'TestIntelligencePlatform/acme',
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3000/callback',
    });
    const loaded = api.loadConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.provider).toBe('onedrive');
    expect(loaded?.accessToken).toBe('token-123');
    expect(loaded?.folderPath).toBe('TestIntelligencePlatform/acme');
  });

  it('clearConfig removes the config file', () => {
    api.saveConfig({
      provider: 'googledrive', accessToken: 't', refreshToken: 'r',
      tokenExpiresAt: 0, folderPath: 'path', clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    expect(api.loadConfig()).not.toBeNull();
    api.clearConfig();
    expect(api.loadConfig()).toBeNull();
  });

  it('GET /api/storage/config returns configured:false when not set up', async () => {
    const { server, port } = startServer(api);
    const res = await get(port, '/api/storage/config');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).configured).toBe(false);
    server.close();
  });

  it('GET /api/storage/config redacts tokens when configured', async () => {
    api.saveConfig({
      provider: 'onedrive', accessToken: 'secret-token', refreshToken: 'secret-refresh',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    const { server, port } = startServer(api);
    const res = await get(port, '/api/storage/config');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.configured).toBe(true);
    expect(json.provider).toBe('onedrive');
    expect(json.folderPath).toBe('TIP/acme');
    // Tokens must NOT be in the response.
    expect(JSON.stringify(json)).not.toContain('secret-token');
    expect(JSON.stringify(json)).not.toContain('secret-refresh');
    server.close();
  });

  it('POST /api/storage/connect saves partial config and returns authorize URL', async () => {
    const { server, port } = startServer(api);
    const res = await post(port, '/api/storage/connect', {
      provider: 'onedrive',
      clientId: 'test-id',
      clientSecret: 'test-secret',
      redirectUri: 'http://localhost:3000/callback',
      folderPath: 'TIP/acme',
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.authorizeUrl).toContain('login.microsoftonline.com');
    // Partial config saved (without tokens).
    const cfg = api.loadConfig();
    expect(cfg?.clientId).toBe('test-id');
    expect(cfg?.accessToken).toBe('');
    server.close();
  });

  it('POST /api/storage/connect rejects missing fields', async () => {
    const { server, port } = startServer(api);
    const res = await post(port, '/api/storage/connect', { provider: 'onedrive' });
    expect(res.status).toBe(400);
    server.close();
  });

  it('POST /api/storage/disconnect clears config', async () => {
    api.saveConfig({
      provider: 'onedrive', accessToken: 't', refreshToken: 'r',
      tokenExpiresAt: 0, folderPath: 'p', clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    const { server, port } = startServer(api);
    const res = await post(port, '/api/storage/disconnect', {});
    expect(res.status).toBe(200);
    expect(api.loadConfig()).toBeNull();
    server.close();
  });

  it('GET /api/storage/oauth/callback handles missing code', async () => {
    const { server, port } = startServer(api);
    const res = await get(port, '/api/storage/oauth/callback');
    expect(res.status).toBe(400);
    expect(res.body).toContain('Missing authorization code');
    server.close();
  });

  it('GET /api/storage/oauth/callback handles error param', async () => {
    const { server, port } = startServer(api);
    const res = await get(port, '/api/storage/oauth/callback?error=access_denied');
    expect(res.status).toBe(400);
    expect(res.body).toContain('access_denied');
    server.close();
  });
});

function startServer(api: StorageSettingsApi): { server: http.Server; port: number } {
  const server = http.createServer((req, res) => {
    api.handle(req, res).then(handled => {
      if (!handled) { res.writeHead(404); res.end('not found'); }
    }).catch(e => { res.writeHead(500); res.end(String(e)); });
  });
  server.listen(0);
  const port = (server.address() as AddressInfo).port;
  return { server, port };
}

function get(port: number, urlPath: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${urlPath}`, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf }));
    }).on('error', reject);
  });
}

function post(port: number, urlPath: string, body: unknown): Promise<{ status: number; body: string }> {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => {
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
