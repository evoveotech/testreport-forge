import * as https from 'https';
import type { IngestedRun, Tenant, User, UserRole } from '../types';
import { Store, RunQuery } from './store';
import type { CloudStorageConfig } from './cloud-oauth';
import { ensureValidToken } from './cloud-oauth';

/**
 * OneDrive / SharePoint Store implementation via Microsoft Graph API.
 *
 * Data is stored as JSONL files in a folder in the admin's OneDrive
 * (or a SharePoint document library). The folder is shared with the team
 * via M365's native sharing. Team members never open the raw files —
 * they view results through the dashboard UI (user-confirmed design).
 *
 * Layout in OneDrive:
 *   /<folderPath>/runs.jsonl       -- append-only run log
 *   /<folderPath>/tenants.json     -- tenant index
 *   /<folderPath>/users.json       -- user index
 *
 * Microsoft Graph endpoints used:
 *   GET  /me/drive/root:/<path>:/content   -- download file
 *   PUT  /me/drive/root:/<path>:/content   -- upload (replace) file
 *   PATCH /me/drive/root:/<path>           -- create folder
 *
 * Zero new runtime deps — uses Node's built-in https.
 */
export class OneDriveStore implements Store {
  private readonly runsByTenant: Map<string, Map<string, IngestedRun>> = new Map();
  private readonly tenants: Map<string, Tenant> = new Map();
  private readonly users: Map<string, User> = new Map();
  private config: CloudStorageConfig;
  private readonly configUpdater: (config: CloudStorageConfig) => void;

  /**
   * @param config Cloud storage config with valid OAuth tokens.
   * @param configUpdater Called when tokens are refreshed, so the caller
   *   can persist the updated config.
   */
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
   * Validate that the configured folder is accessible with the given tokens.
   * Called after OAuth to give the user a friendly error early instead of
   * silent failures on first read. Returns null if OK, or an error message.
   */
  static async validateFolderAccess(config: CloudStorageConfig): Promise<string | null> {
    const { token, config: updated } = await ensureValidToken(config);
    const url = `https://graph.microsoft.com/v1.0/me/drive/root:/${config.folderPath}`;
    return new Promise(resolve => {
      https.get(url, { headers: { Authorization: `Bearer ${token}` } }, res => {
        if (res.statusCode === 200) {
          res.resume();
          resolve(null);
          return;
        }
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode === 404) {
            resolve(`Folder "${config.folderPath}" not found in your OneDrive. Ask your director to share the correct folder path.`);
          } else if (res.statusCode === 403 || res.statusCode === 401) {
            resolve(`Access denied to folder "${config.folderPath}". Your director must share this folder with you via M365.`);
          } else {
            resolve(`Cloud validation failed: ${res.statusCode} ${body}`);
          }
        });
      }).on('error', e => resolve(`Network error: ${e.message}`));
      // Suppress unused-variable warning.
      void updated;
    });
  }

  private graphPath(file: string): string {
    return `/me/drive/root:/${this.config.folderPath}/${file}`;
  }

  private async graphGet(path: string): Promise<Buffer | null> {
    const { token, config } = await ensureValidToken(this.config);
    this.config = config;
    this.configUpdater(config);
    return new Promise((resolve, reject) => {
      https.get(`https://graph.microsoft.com/v1.0${path}:/content`, {
        headers: { Authorization: `Bearer ${token}` },
      }, res => {
        if (res.statusCode === 404) { res.resume(); resolve(null); return; }
        if (res.statusCode !== 200) {
          let buf = '';
          res.on('data', c => (buf += c));
          res.on('end', () => reject(new Error(`Graph GET ${path} failed: ${res.statusCode} ${buf}`)));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
  }

  private async graphPut(path: string, data: Buffer | string): Promise<void> {
    const { token, config } = await ensureValidToken(this.config);
    this.config = config;
    this.configUpdater(config);
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    return new Promise((resolve, reject) => {
      const url = new URL(`https://graph.microsoft.com/v1.0${path}:/content`);
      const r = https.request(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': buf.length.toString(),
        },
      }, res => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 201 && res.statusCode !== 200) {
            reject(new Error(`Graph PUT ${path} failed: ${res.statusCode} ${body}`));
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

  private async loadTenants(): Promise<void> {
    const data = await this.graphGet(this.graphPath('tenants.json'));
    if (!data) return;
    try {
      const arr: Tenant[] = JSON.parse(data.toString('utf-8'));
      for (const t of arr) this.tenants.set(t.tenantId, t);
    } catch { /* corrupt -- start fresh */ }
  }

  private async loadUsers(): Promise<void> {
    const data = await this.graphGet(this.graphPath('users.json'));
    if (!data) return;
    try {
      const arr: User[] = JSON.parse(data.toString('utf-8'));
      for (const u of arr) this.users.set(u.userId, u);
    } catch { /* corrupt -- start fresh */ }
  }

  private async loadRuns(): Promise<void> {
    const data = await this.graphGet(this.graphPath('runs.jsonl'));
    if (!data) return;
    for (const line of data.toString('utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const run: IngestedRun = JSON.parse(trimmed);
        this.indexRun(run);
      } catch { /* skip corrupt line */ }
    }
  }

  private indexRun(run: IngestedRun): void {
    const tenant = run.orgContext.tenantId;
    let bucket = this.runsByTenant.get(tenant);
    if (!bucket) { bucket = new Map(); this.runsByTenant.set(tenant, bucket); }
    bucket.set(run.runId, run);
  }

  private async persistRuns(): Promise<void> {
    const all: IngestedRun[] = [];
    for (const bucket of this.runsByTenant.values()) {
      for (const run of bucket.values()) all.push(run);
    }
    const jsonl = all.map(r => JSON.stringify(r)).join('\n') + '\n';
    await this.graphPut(this.graphPath('runs.jsonl'), jsonl);
  }

  private async persistTenants(): Promise<void> {
    await this.graphPut(this.graphPath('tenants.json'), JSON.stringify([...this.tenants.values()], null, 2));
  }

  private async persistUsers(): Promise<void> {
    await this.graphPut(this.graphPath('users.json'), JSON.stringify([...this.users.values()], null, 2));
  }

  // -- Store interface --------------------------------------------------

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

  async close(): Promise<void> {
    // Cloud store: nothing to release locally. Data is already persisted.
  }
}
