import * as fs from 'fs';
import * as path from 'path';
import type { IngestedRun, Tenant, User, UserRole } from '../types';
import { Store, RunQuery } from './store';

/**
 * Pure-JS file-based Store implementation. Zero native dependencies —
 * critical for an open-source product that enterprises embed on Windows,
 * Linux, and air-gapped systems (ADR-002 local-dev path).
 *
 * Layout under the data directory:
 *   <dataDir>/
 *     runs.jsonl          -- append-only log, one IngestedRun per line
 *     tenants.json        -- tenant index
 *     users.json          -- user index
 *
 * The runs log is append-only for durability; an in-memory index by
 * (tenantId -> runId -> run) is built on open for fast queries. A Postgres
 * implementation with monthly partitions + RLS satisfies the same Store
 * interface for production scale (ADR-002, ADR-003).
 */
export class FileStore implements Store {
  private readonly dataDir: string;
  private readonly runsFile: string;
  private readonly tenantsFile: string;
  private readonly usersFile: string;
  private readonly runsByTenant: Map<string, Map<string, IngestedRun>> = new Map();
  private readonly tenants: Map<string, Tenant> = new Map();
  private readonly users: Map<string, User> = new Map();

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.runsFile = path.join(dataDir, 'runs.jsonl');
    this.tenantsFile = path.join(dataDir, 'tenants.json');
    this.usersFile = path.join(dataDir, 'users.json');
  }

  async open(): Promise<void> {
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.loadTenants();
    this.loadUsers();
    this.loadRuns();
  }

  private loadTenants(): void {
    try {
      const raw = fs.readFileSync(this.tenantsFile, 'utf-8');
      const arr: Tenant[] = JSON.parse(raw);
      for (const t of arr) this.tenants.set(t.tenantId, t);
    } catch {
      // first run -- no tenants yet
    }
  }

  private loadUsers(): void {
    try {
      const raw = fs.readFileSync(this.usersFile, 'utf-8');
      const arr: User[] = JSON.parse(raw);
      for (const u of arr) this.users.set(u.userId, u);
    } catch {
      // first run -- no users yet
    }
  }

  private loadRuns(): void {
    try {
      const raw = fs.readFileSync(this.runsFile, 'utf-8');
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const run: IngestedRun = JSON.parse(trimmed);
          this.indexRun(run);
        } catch {
          // skip corrupt line rather than crashing the whole store
        }
      }
    } catch {
      // first run -- no runs yet
    }
  }

  private indexRun(run: IngestedRun): void {
    const tenant = run.orgContext.tenantId;
    let bucket = this.runsByTenant.get(tenant);
    if (!bucket) {
      bucket = new Map();
      this.runsByTenant.set(tenant, bucket);
    }
    bucket.set(run.runId, run);
  }

  private persistRun(run: IngestedRun): void {
    fs.appendFileSync(this.runsFile, JSON.stringify(run) + '\n', 'utf-8');
  }

  private persistTenants(): void {
    fs.writeFileSync(this.tenantsFile, JSON.stringify([...this.tenants.values()], null, 2), 'utf-8');
  }

  private persistUsers(): void {
    fs.writeFileSync(this.usersFile, JSON.stringify([...this.users.values()], null, 2), 'utf-8');
  }

  // -- Runs --------------------------------------------------------------

  async insertRun(run: IngestedRun): Promise<IngestedRun> {
    this.indexRun(run);
    this.persistRun(run);
    return run;
  }

  async getRun(tenantId: string, runId: string): Promise<IngestedRun | null> {
    // Tenant isolation: only ever read from the caller's tenant bucket.
    const bucket = this.runsByTenant.get(tenantId);
    if (!bucket) return null;
    return bucket.get(runId) ?? null;
  }

  async queryRuns(query: RunQuery): Promise<IngestedRun[]> {
    // Tenant isolation boundary: the bucket is selected by the REQUIRED
    // tenantId. No cross-tenant row can ever be returned.
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
    const limit = query.limit ?? 1000;
    return results.slice(0, limit);
  }

  async archiveRun(tenantId: string, runId: string): Promise<void> {
    const bucket = this.runsByTenant.get(tenantId);
    if (!bucket) return;
    const run = bucket.get(runId);
    if (!run) return;
    run.archived = true;
    this.rewriteRunsLog();
  }

  async deleteRun(tenantId: string, runId: string): Promise<void> {
    const bucket = this.runsByTenant.get(tenantId);
    if (!bucket) return;
    bucket.delete(runId);
    this.rewriteRunsLog();
  }

  private rewriteRunsLog(): void {
    const all: IngestedRun[] = [];
    for (const bucket of this.runsByTenant.values()) {
      for (const run of bucket.values()) all.push(run);
    }
    fs.writeFileSync(this.runsFile, all.map(r => JSON.stringify(r)).join('\n') + '\n', 'utf-8');
  }

  // -- Tenants -----------------------------------------------------------

  async insertTenant(tenant: Tenant): Promise<Tenant> {
    this.tenants.set(tenant.tenantId, tenant);
    this.persistTenants();
    return tenant;
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.tenants.get(tenantId) ?? null;
  }

  async listTenants(): Promise<string[]> {
    // Include tenants from the tenant index AND any tenant that has runs
    // (runs may arrive before a tenant record is created).
    const ids = new Set<string>(this.tenants.keys());
    for (const id of this.runsByTenant.keys()) ids.add(id);
    return [...ids];
  }

  // -- Users -------------------------------------------------------------

  async insertUser(user: User): Promise<User> {
    this.users.set(user.userId, user);
    this.persistUsers();
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) ?? null;
  }

  async listUsers(tenantId: string): Promise<User[]> {
    // Tenant isolation: only return users belonging to the named tenant.
    return [...this.users.values()].filter(u => u.tenantId === tenantId);
  }

  async setUserRole(tenantId: string, userId: string, role: UserRole): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user || user.tenantId !== tenantId) return null;
    user.role = role;
    this.persistUsers();
    return user;
  }

  async close(): Promise<void> {
    // Nothing to release for the file implementation; persistence is synchronous.
  }
}
