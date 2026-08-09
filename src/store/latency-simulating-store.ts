import type { Store, RunQuery } from './store';
import type { IngestedRun, Tenant, User, UserRole } from '../types';

/**
 * Wrapper that simulates network latency on every Store operation.
 *
 * Cloud-drive stores (OneDriveStore, GoogleDriveStore) make real HTTPS
 * round-trips per persist call. This wrapper lets us benchmark the
 * architecture at 10k scale without OAuth credentials by adding a
 * configurable per-operation delay that models real network latency.
 *
 * Typical latencies (measured against Microsoft Graph / Google Drive):
 *   - LAN/edge node:  20-50ms per round-trip
 *   - Cross-region:   80-150ms per round-trip
 *   - Intercontinental: 150-300ms per round-trip
 *
 * The cloud-drive stores persist the ENTIRE runs.jsonl on every insert
 * (see OneDriveStore.persistRuns), so insert latency scales with O(n)
 * data size, not just the round-trip. This wrapper models the round-trip
 * component; the data-size component is inherent to the underlying store.
 */
export class LatencySimulatingStore implements Store {
  private readonly inner: Store;
  private readonly latencyMs: number;
  private readonly persistEveryN: number;
  private insertCount = 0;

  /**
   * @param inner The real store to wrap (e.g. FileStore).
   * @param latencyMs Simulated network round-trip latency per remote operation.
   * @param persistEveryN Cloud-drive stores re-upload the full runs.jsonl on
   *   every insert. To model this without O(n^2) re-uploads, we only charge
   *   latency every N inserts (default 1 = every insert). Set higher to
   *   model batched persistence.
   */
  constructor(inner: Store, latencyMs: number, persistEveryN = 1) {
    this.inner = inner;
    this.latencyMs = latencyMs;
    this.persistEveryN = Math.max(1, persistEveryN);
  }

  private async delay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }
  }

  async open(): Promise<void> {
    // open() downloads 3 files (runs.jsonl, tenants.json, users.json)
    await this.delay();
    await this.delay();
    await this.delay();
    await this.inner.open();
  }

  async insertRun(run: IngestedRun): Promise<IngestedRun> {
    this.insertCount++;
    // Cloud-drive stores re-upload runs.jsonl on every insert (round-trip)
    if (this.insertCount % this.persistEveryN === 0) {
      await this.delay();
    }
    return this.inner.insertRun(run);
  }

  async getRun(tenantId: string, runId: string): Promise<IngestedRun | null> {
    await this.delay();
    return this.inner.getRun(tenantId, runId);
  }

  async queryRuns(query: RunQuery): Promise<IngestedRun[]> {
    await this.delay();
    return this.inner.queryRuns(query);
  }

  async archiveRun(tenantId: string, runId: string): Promise<void> {
    await this.delay();
    return this.inner.archiveRun(tenantId, runId);
  }

  async deleteRun(tenantId: string, runId: string): Promise<void> {
    await this.delay();
    return this.inner.deleteRun(tenantId, runId);
  }

  async insertTenant(tenant: Tenant): Promise<Tenant> {
    await this.delay();
    return this.inner.insertTenant(tenant);
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    await this.delay();
    return this.inner.getTenant(tenantId);
  }

  async listTenants(): Promise<string[]> {
    await this.delay();
    return this.inner.listTenants();
  }

  async insertUser(user: User): Promise<User> {
    await this.delay();
    return this.inner.insertUser(user);
  }

  async getUser(userId: string): Promise<User | null> {
    await this.delay();
    return this.inner.getUser(userId);
  }

  async listUsers(tenantId: string): Promise<User[]> {
    await this.delay();
    return this.inner.listUsers(tenantId);
  }

  async setUserRole(tenantId: string, userId: string, role: UserRole): Promise<User | null> {
    await this.delay();
    return this.inner.setUserRole(tenantId, userId, role);
  }

  async close(): Promise<void> {
    return this.inner.close();
  }
}
