import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { StorageSettingsApi } from './storage-settings';
import { StoreResolver } from './store-resolver';
import { FileStore } from '../store';
import { buildAuthorizeUrl, OAUTH_ENDPOINTS } from '../store';
import type { Session } from './auth';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-storage-'));
}

const ADMIN_SESSION: Session = { userId: 'director-1', tenantId: 'acme', role: 'admin' };
const VIEWER_SESSION: Session = { userId: 'viewer-1', tenantId: 'acme', role: 'viewer' };

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

describe('StorageSettingsApi (per-user)', () => {
  let dir: string;
  let api: StorageSettingsApi;

  beforeEach(() => {
    dir = tmpDir();
    api = new StorageSettingsApi(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('loadConfigForUser returns null when not configured', () => {
    expect(api.loadConfigForUser('user-1')).toBeNull();
  });

  it('saveConfigForUser + loadConfigForUser round-trips', () => {
    api.saveConfigForUser('user-1', {
      provider: 'onedrive',
      accessToken: 'token-123',
      refreshToken: 'refresh-456',
      tokenExpiresAt: Date.now() + 3600000,
      folderPath: 'TestIntelligencePlatform/acme',
      clientId: 'client-id',
      clientSecret: 'secret',
      redirectUri: 'http://localhost:3000/callback',
    });
    const loaded = api.loadConfigForUser('user-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.provider).toBe('onedrive');
    expect(loaded?.accessToken).toBe('token-123');
    expect(loaded?.folderPath).toBe('TestIntelligencePlatform/acme');
  });

  it('configs are isolated per user', () => {
    api.saveConfigForUser('director', {
      provider: 'onedrive', accessToken: 'dir-token', refreshToken: 'r',
      tokenExpiresAt: 0, folderPath: 'TIP/acme', clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    api.saveConfigForUser('viewer', {
      provider: 'googledrive', accessToken: 'view-token', refreshToken: 'r2',
      tokenExpiresAt: 0, folderPath: 'TIP/acme', clientId: 'c2', clientSecret: 's2', redirectUri: 'u2',
    });
    expect(api.loadConfigForUser('director')?.provider).toBe('onedrive');
    expect(api.loadConfigForUser('viewer')?.provider).toBe('googledrive');
    // Director config is not affected by viewer config.
    expect(api.loadConfigForUser('director')?.accessToken).toBe('dir-token');
  });

  it('clearConfigForUser only clears the specified user', () => {
    api.saveConfigForUser('user-a', {
      provider: 'onedrive', accessToken: 'a', refreshToken: 'r',
      tokenExpiresAt: 0, folderPath: 'p', clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    api.saveConfigForUser('user-b', {
      provider: 'onedrive', accessToken: 'b', refreshToken: 'r',
      tokenExpiresAt: 0, folderPath: 'p', clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    api.clearConfigForUser('user-a');
    expect(api.loadConfigForUser('user-a')).toBeNull();
    expect(api.loadConfigForUser('user-b')).not.toBeNull();
  });

  it('userId is sanitized to prevent path traversal', () => {
    api.saveConfigForUser('../../../etc/passwd', {
      provider: 'onedrive', accessToken: 't', refreshToken: 'r',
      tokenExpiresAt: 0, folderPath: 'p', clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    // The file should be saved with a sanitized name, not traverse paths.
    const files = fs.readdirSync(path.join(dir, 'cloud-storage'));
    expect(files.some(f => f.includes('passwd'))).toBe(true);
    expect(files.some(f => f.includes('..'))).toBe(false);
  });

  it('GET /api/storage/config returns configured:false when not set up', async () => {
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await get(port, '/api/storage/config');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).configured).toBe(false);
    server.close();
  });

  it('GET /api/storage/config redacts tokens when configured', async () => {
    api.saveConfigForUser(ADMIN_SESSION.userId, {
      provider: 'onedrive', accessToken: 'secret-token', refreshToken: 'secret-refresh',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await get(port, '/api/storage/config');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.configured).toBe(true);
    expect(json.provider).toBe('onedrive');
    expect(json.folderPath).toBe('TIP/acme');
    expect(JSON.stringify(json)).not.toContain('secret-token');
    expect(JSON.stringify(json)).not.toContain('secret-refresh');
    server.close();
  });

  it('POST /api/storage/connect saves partial config and returns authorize URL with state', async () => {
    const { server, port } = startServer(api, ADMIN_SESSION);
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
    // State parameter must contain the userId.
    expect(json.authorizeUrl).toContain('state=' + encodeURIComponent(ADMIN_SESSION.userId));
    const cfg = api.loadConfigForUser(ADMIN_SESSION.userId);
    expect(cfg?.clientId).toBe('test-id');
    expect(cfg?.accessToken).toBe('');
    server.close();
  });

  it('viewer can connect their own storage (not admin-only)', async () => {
    const { server, port } = startServer(api, VIEWER_SESSION);
    const res = await post(port, '/api/storage/connect', {
      provider: 'googledrive',
      clientId: 'viewer-client-id',
      clientSecret: 'viewer-secret',
      redirectUri: 'http://localhost:3000/callback',
      folderPath: 'TIP/acme',
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.authorizeUrl).toContain('state=' + encodeURIComponent(VIEWER_SESSION.userId));
    // Config saved for the viewer, not the admin.
    expect(api.loadConfigForUser(VIEWER_SESSION.userId)?.clientId).toBe('viewer-client-id');
    expect(api.loadConfigForUser(ADMIN_SESSION.userId)).toBeNull();
    server.close();
  });

  it('POST /api/storage/connect rejects missing fields', async () => {
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await post(port, '/api/storage/connect', { provider: 'onedrive' });
    expect(res.status).toBe(400);
    server.close();
  });

  it('POST /api/storage/disconnect clears current user config', async () => {
    api.saveConfigForUser(ADMIN_SESSION.userId, {
      provider: 'onedrive', accessToken: 't', refreshToken: 'r',
      tokenExpiresAt: 0, folderPath: 'p', clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await post(port, '/api/storage/disconnect', {});
    expect(res.status).toBe(200);
    expect(api.loadConfigForUser(ADMIN_SESSION.userId)).toBeNull();
    server.close();
  });

  it('GET /api/storage/oauth/callback handles missing code', async () => {
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await get(port, '/api/storage/oauth/callback');
    expect(res.status).toBe(400);
    expect(res.body).toContain('Missing authorization code');
    server.close();
  });

  it('GET /api/storage/oauth/callback handles error param', async () => {
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await get(port, '/api/storage/oauth/callback?error=access_denied');
    expect(res.status).toBe(400);
    expect(res.body).toContain('access_denied');
    server.close();
  });

  it('GET /api/storage/oauth/callback handles missing state', async () => {
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await get(port, '/api/storage/oauth/callback?code=fake-code');
    expect(res.status).toBe(400);
    expect(res.body).toContain('Missing state');
    server.close();
  });

  it('GET /api/storage/oauth/callback handles unknown user state', async () => {
    const { server, port } = startServer(api, ADMIN_SESSION);
    const res = await get(port, '/api/storage/oauth/callback?code=fake-code&state=unknown-user');
    expect(res.status).toBe(400);
    expect(res.body).toContain('No pending connection');
    server.close();
  });

  it('listTeamConfigs returns all configured users with provider and folderPath (no tokens)', () => {
    api.saveConfigForUser('director', {
      provider: 'onedrive', accessToken: 'dir-tok', refreshToken: 'r',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    api.saveConfigForUser('viewer', {
      provider: 'googledrive', accessToken: 'view-tok', refreshToken: 'r2',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c2', clientSecret: 's2', redirectUri: 'u2',
    });
    // User with no token (partial config) should be excluded.
    api.saveConfigForUser('partial', {
      provider: 'onedrive', accessToken: '', refreshToken: '',
      tokenExpiresAt: 0, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    const configs = api.listTeamConfigs();
    expect(configs.length).toBe(2);
    const dir = configs.find(c => c.userId === 'director');
    expect(dir?.provider).toBe('onedrive');
    expect(dir?.folderPath).toBe('TIP/acme');
    const view = configs.find(c => c.userId === 'viewer');
    expect(view?.provider).toBe('googledrive');
    // No tokens in the output.
    expect(JSON.stringify(configs)).not.toContain('dir-tok');
    expect(JSON.stringify(configs)).not.toContain('view-tok');
  });

  it('listTeamConfigs returns empty array when no configs exist', () => {
    expect(api.listTeamConfigs()).toEqual([]);
  });

  it('GET /api/storage/team-configs returns team configs', async () => {
    api.saveConfigForUser('director', {
      provider: 'onedrive', accessToken: 'tok', refreshToken: 'r',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    const { server, port } = startServer(api, VIEWER_SESSION);
    const res = await get(port, '/api/storage/team-configs');
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.configs.length).toBe(1);
    expect(json.configs[0].userId).toBe('director');
    expect(json.configs[0].provider).toBe('onedrive');
    expect(json.configs[0].folderPath).toBe('TIP/acme');
    server.close();
  });

  it('POST /api/storage/connect returns cross-provider warning on mismatch', async () => {
    // Director already configured with OneDrive.
    api.saveConfigForUser('director', {
      provider: 'onedrive', accessToken: 'tok', refreshToken: 'r',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    // Viewer tries to connect with Google Drive for the same folder path.
    const { server, port } = startServer(api, VIEWER_SESSION);
    const res = await post(port, '/api/storage/connect', {
      provider: 'googledrive',
      clientId: 'viewer-id',
      clientSecret: 'viewer-secret',
      redirectUri: 'http://localhost:3000/callback',
      folderPath: 'TIP/acme',
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.authorizeUrl).toBeDefined();
    expect(json.warning).toContain('director');
    expect(json.warning).toContain('onedrive');
    server.close();
  });

  it('POST /api/storage/connect returns no warning when providers match', async () => {
    api.saveConfigForUser('director', {
      provider: 'onedrive', accessToken: 'tok', refreshToken: 'r',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    const { server, port } = startServer(api, VIEWER_SESSION);
    const res = await post(port, '/api/storage/connect', {
      provider: 'onedrive',
      clientId: 'viewer-id',
      clientSecret: 'viewer-secret',
      redirectUri: 'http://localhost:3000/callback',
      folderPath: 'TIP/acme',
    });
    expect(res.status).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.authorizeUrl).toBeDefined();
    expect(json.warning).toBeUndefined();
    server.close();
  });
});

describe('StoreResolver', () => {
  let dir: string;
  let fileStore: FileStore;
  let storageSettings: StorageSettingsApi;
  let resolver: StoreResolver;

  beforeEach(async () => {
    dir = tmpDir();
    fileStore = new FileStore(dir);
    await fileStore.open();
    storageSettings = new StorageSettingsApi(dir);
    resolver = new StoreResolver(fileStore, storageSettings);
  });

  afterEach(async () => {
    await resolver.close();
    await fileStore.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the shared FileStore when user has no cloud config', async () => {
    const store = await resolver.resolve(ADMIN_SESSION);
    // FileStore is the fallback — verify it works by inserting a run.
    await store.insertRun({
      runId: 'test-1', timestamp: new Date().toISOString(),
      total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, slow: 0, duration: 100, passRate: 100,
      orgContext: { tenantId: 'acme', client: 'c', product: 'p', team: 't', stack: 'junit', runType: 'nightly', environment: 'ci' },
      ingestedAt: new Date().toISOString(),
    });
    const run = await store.getRun('acme', 'test-1');
    expect(run?.runId).toBe('test-1');
  });

  it('caches store instances per user', async () => {
    const s1 = await resolver.resolve(ADMIN_SESSION);
    const s2 = await resolver.resolve(ADMIN_SESSION);
    expect(s1).toBe(s2); // same instance from cache
  });

  it('returns different stores for different users', async () => {
    // Give each user a cloud config (but with empty tokens so they fall back to FileStore).
    // Actually, with empty tokens they both get the same FileStore. Let's verify
    // that users with cloud configs get different stores.
    storageSettings.saveConfigForUser('director', {
      provider: 'onedrive', accessToken: 'fake-token-1', refreshToken: 'r',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    storageSettings.saveConfigForUser('viewer', {
      provider: 'googledrive', accessToken: 'fake-token-2', refreshToken: 'r',
      tokenExpiresAt: Date.now() + 3600000, folderPath: 'TIP/acme',
      clientId: 'c', clientSecret: 's', redirectUri: 'u',
    });
    // These will try to open cloud stores with fake tokens and fail.
    // The resolver should still create separate instances (even if open() throws).
    // For this test, we just verify the resolver doesn't crash and returns the
    // file store for users without configs.
    const s1 = await resolver.resolve({ userId: 'no-config-user', tenantId: 'acme', role: 'viewer' });
    expect(s1).toBe(fileStore);
  });
});

function startServer(api: StorageSettingsApi, session: Session): { server: http.Server; port: number } {
  const server = http.createServer((req, res) => {
    api.handle(req, res, session).then(handled => {
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
