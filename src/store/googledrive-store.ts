import * as https from 'https';
import type { IngestedRun, Tenant, User, UserRole } from '../types';
import { Store, RunQuery } from './store';
import type { CloudStorageConfig } from './cloud-oauth';
import { ensureValidToken } from './cloud-oauth';

/**
 * Google Drive Store implementation via Google Drive API.
 *
 * Data is stored as JSONL files in a folder in the admin's Google Drive.
 * The folder is shared with the team via Google Workspace's native sharing.
 * Team members never open the raw files — they view results through the
 * dashboard UI (user-confirmed design).
 *
 * Layout in Google Drive:
 *   <folderPath>/runs.jsonl       -- append-only run log
 *   <folderPath>/tenants.json     -- tenant index
 *   <folderPath>/users.json       -- user index
 *
 * Google Drive API endpoints used:
 *   GET  /drive/v3/files?q=...     -- find files by name
 *   GET  /drive/v3/files/{id}?alt=media  -- download file content
 *   PATCH /upload/drive/v3/files/{id}?uploadType=media  -- update file content
 *   POST /drive/v3/files           -- create new file
 *
 * Zero new runtime deps — uses Node's built-in https.
 */
export class GoogleDriveStore implements Store {
  private readonly runsByTenant: Map<string, Map<string, IngestedRun>> = new Map();
  private readonly tenants: Map<string, Tenant> = new Map();
  private readonly users: Map<string, User> = new Map();
  private config: CloudStorageConfig;
  private readonly configUpdater: (config: CloudStorageConfig) => void;
  // Cache file IDs so we don't search on every read/write.
  private fileIds: Map<string, string> = new Map();

  constructor(config: CloudStorageConfig, configUpdater?: (config: CloudStorageConfig) => void) {
    this.config = config;
    this.configUpdater = configUpdater ?? (() => {});
  }

  async open(): Promise<void> {
    await this.loadTenants();
    await this.loadUsers();
    await this.loadRuns();
  }

  /**
   * Validate that the user's Google Drive is accessible with the given tokens.
   * Google Drive doesn't have path-based folders, so we verify token validity
   * by listing files. Returns null if OK, or an error message.
   */
  static async validateFolderAccess(config: CloudStorageConfig): Promise<string | null> {
    const { token } = await ensureValidToken(config);
    return new Promise(resolve => {
      https.get('https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)', {
        headers: { Authorization: `Bearer ${token}` },
      }, res => {
        if (res.statusCode === 200) {
          res.resume();
          resolve(null);
          return;
        }
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode === 401 || res.statusCode === 403) {
            resolve(`Access denied to Google Drive. Your director must share the folder with you via Google Workspace.`);
          } else {
            resolve(`Cloud validation failed: ${res.statusCode} ${body}`);
          }
        });
      }).on('error', e => resolve(`Network error: ${e.message}`));
    });
  }

  private async driveGet(path: string): Promise<Buffer | null> {
    const { token, config } = await ensureValidToken(this.config);
    this.config = config;
    this.configUpdater(config);
    return new Promise((resolve, reject) => {
      https.get(`https://www.googleapis.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, res => {
        if (res.statusCode === 404) { res.resume(); resolve(null); return; }
        if (res.statusCode !== 200) {
          let buf = '';
          res.on('data', c => (buf += c));
          res.on('end', () => reject(new Error(`Drive GET ${path} failed: ${res.statusCode} ${buf}`)));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
  }

  private async driveGetJson(path: string): Promise<any | null> {
    const { token, config } = await ensureValidToken(this.config);
    this.config = config;
    this.configUpdater(config);
    return new Promise((resolve, reject) => {
      https.get(`https://www.googleapis.com${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      }, res => {
        if (res.statusCode === 404) { res.resume(); resolve(null); return; }
        if (res.statusCode !== 200) {
          let buf = '';
          res.on('data', c => (buf += c));
          res.on('end', () => reject(new Error(`Drive GET ${path} failed: ${res.statusCode} ${buf}`)));
          return;
        }
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => { try { resolve(JSON.parse(buf)); } catch (e) { reject(e as Error); } });
      }).on('error', reject);
    });
  }

  /**
   * Find a file by name in the configured folder. Returns the file ID or null.
   */
  private async findFileId(fileName: string): Promise<string | null> {
    const cached = this.fileIds.get(fileName);
    if (cached) return cached;
    const q = `name='${fileName}' and trashed=false`;
    const data = await this.driveGetJson(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`);
    const files = data?.files ?? [];
    if (files.length === 0) return null;
    this.fileIds.set(fileName, files[0].id);
    return files[0].id;
  }

  /**
   * Download a file's content by name. Returns null if the file doesn't exist.
   */
  private async downloadFile(fileName: string): Promise<Buffer | null> {
    const id = await this.findFileId(fileName);
    if (!id) return null;
    return this.driveGet(`/drive/v3/files/${id}?alt=media`);
  }

  /**
   * Upload (create or replace) a file by name. Uses media upload.
   */
  private async uploadFile(fileName: string, data: Buffer | string): Promise<void> {
    const { token, config } = await ensureValidToken(this.config);
    this.config = config;
    this.configUpdater(config);
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const existingId = await this.findFileId(fileName);

    if (existingId) {
      // Update existing file content via media upload.
      await this.mediaUpload(`https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=media`, buf, token);
    } else {
      // Create new file with metadata + content (multipart).
      await this.multipartUpload(fileName, buf, token);
      this.fileIds.delete(fileName); // invalidate cache so next find sees it
    }
  }

  private mediaUpload(url: string, buf: Buffer, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const u = new URL(url);
      const r = https.request(u, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': buf.length.toString(),
        },
      }, res => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200 && res.statusCode !== 204) {
            reject(new Error(`Drive media upload failed: ${res.statusCode} ${body}`));
            return;
          }
          resolve();
        });
      });
      r.on('error', reject);
      r.write(buf);
      r.end();
    });
  }

  private multipartUpload(fileName: string, buf: Buffer, token: string): Promise<void> {
    const boundary = 'testreport-' + Date.now();
    const metadata = JSON.stringify({ name: fileName });
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      Buffer.from(`--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`),
      buf,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return new Promise((resolve, reject) => {
      const r = https.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': body.length.toString(),
        },
      }, res => {
        let rb = '';
        res.on('data', c => (rb += c));
        res.on('end', () => {
          if (res.statusCode !== 200 && res.statusCode !== 201) {
            reject(new Error(`Drive multipart upload failed: ${res.statusCode} ${rb}`));
            return;
          }
          resolve();
        });
      });
      r.on('error', reject);
      r.write(body);
      r.end();
    });
  }

  private indexRun(run: IngestedRun): void {
    const tenant = run.orgContext.tenantId;
    let bucket = this.runsByTenant.get(tenant);
    if (!bucket) { bucket = new Map(); this.runsByTenant.set(tenant, bucket); }
    bucket.set(run.runId, run);
  }

  private async loadTenants(): Promise<void> {
    const data = await this.downloadFile('tenants.json');
    if (!data) return;
    try {
      const arr: Tenant[] = JSON.parse(data.toString('utf-8'));
      for (const t of arr) this.tenants.set(t.tenantId, t);
    } catch { /* corrupt */ }
  }

  private async loadUsers(): Promise<void> {
    const data = await this.downloadFile('users.json');
    if (!data) return;
    try {
      const arr: User[] = JSON.parse(data.toString('utf-8'));
      for (const u of arr) this.users.set(u.userId, u);
    } catch { /* corrupt */ }
  }

  private async loadRuns(): Promise<void> {
    const data = await this.downloadFile('runs.jsonl');
    if (!data) return;
    for (const line of data.toString('utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const run: IngestedRun = JSON.parse(trimmed);
        this.indexRun(run);
      } catch { /* skip */ }
    }
  }

  private async persistRuns(): Promise<void> {
    const all: IngestedRun[] = [];
    for (const bucket of this.runsByTenant.values()) {
      for (const run of bucket.values()) all.push(run);
    }
    const jsonl = all.map(r => JSON.stringify(r)).join('\n') + '\n';
    await this.uploadFile('runs.jsonl', jsonl);
  }

  private async persistTenants(): Promise<void> {
    await this.uploadFile('tenants.json', JSON.stringify([...this.tenants.values()], null, 2));
  }

  private async persistUsers(): Promise<void> {
    await this.uploadFile('users.json', JSON.stringify([...this.users.values()], null, 2));
  }

  // -- Store interface (identical logic to OneDriveStore) ---------------

  async insertRun(run: IngestedRun): Promise<IngestedRun> {
    this.indexRun(run);
    await this.persistRuns();
    return run;
  }

  async getRun(tenantId: string, runId: string): Promise<IngestedRun | null> {
    const bucket = this.runsByTenant.get(tenantId);
    if (!bucket) return null;
    return bucket.get(runId) ?? null;
  }

  async queryRuns(query: RunQuery): Promise<IngestedRun[]> {
    const bucket = this.runsByTenant.get(query.tenantId);
    if (!bucket) return [];
    let results = [...bucket.values()];
    if (query.client) results = results.filter(r => r.orgContext.client === query.client);
    if (query.product) results = results.filter(r => r.orgContext.product === query.product);
    if (query.team) results = results.filter(r => r.orgContext.team === query.team);
    if (query.stack) results = results.filter(r => r.orgContext.stack === query.stack);
    if (query.runType) results = results.filter(r => r.orgContext.runType === query.runType);
    if (query.environment) results = results.filter(r => r.orgContext.environment === query.environment);
    if (query.from) results = results.filter(r => r.timestamp >= query.from!);
    if (query.to) results = results.filter(r => r.timestamp <= query.to!);
    results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return results.slice(0, query.limit ?? 1000);
  }

  async archiveRun(tenantId: string, runId: string): Promise<void> {
    const bucket = this.runsByTenant.get(tenantId);
    if (!bucket) return;
    const run = bucket.get(runId);
    if (!run) return;
    run.archived = true;
    await this.persistRuns();
  }

  async deleteRun(tenantId: string, runId: string): Promise<void> {
    const bucket = this.runsByTenant.get(tenantId);
    if (!bucket) return;
    bucket.delete(runId);
    await this.persistRuns();
  }

  async insertTenant(tenant: Tenant): Promise<Tenant> {
    this.tenants.set(tenant.tenantId, tenant);
    await this.persistTenants();
    return tenant;
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.tenants.get(tenantId) ?? null;
  }

  async listTenants(): Promise<string[]> {
    const ids = new Set<string>(this.tenants.keys());
    for (const id of this.runsByTenant.keys()) ids.add(id);
    return [...ids];
  }

  async insertUser(user: User): Promise<User> {
    this.users.set(user.userId, user);
    await this.persistUsers();
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async listUsers(tenantId: string): Promise<User[]> {
    return [...this.users.values()].filter(u => u.tenantId === tenantId);
  }

  async setUserRole(tenantId: string, userId: string, role: UserRole): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user || user.tenantId !== tenantId) return null;
    user.role = role;
    await this.persistUsers();
    return user;
  }

  async close(): Promise<void> {}
}
