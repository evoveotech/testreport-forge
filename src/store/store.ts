import type {
  IngestedRun,
  Tenant,
  User,
  UserRole,
} from '../types';

/**
 * Query filter for runs. `tenantId` is REQUIRED — this is the tenant-isolation
 * boundary (ADR-003). No method on this interface returns runs from a tenant
 * other than the one named in the filter. A Postgres implementation enforces
 * the same with row-level security; the file implementation enforces it in
 * queryRuns by filtering every row.
 */
export interface RunQuery {
  tenantId: string;
  client?: string;
  product?: string;
  team?: string;
  stack?: string;
  runType?: IngestedRun['orgContext']['runType'];
  environment?: string;
  /** Inclusive lower bound (ISO timestamp). */
  from?: string;
  /** Inclusive upper bound (ISO timestamp). */
  to?: string;
  /** Limit number of results (default 1000). */
  limit?: number;
}

/**
 * Persistence interface for the leadership platform. The file-based
 * implementation (FileStore) ships today; a Postgres implementation with
 * monthly range partitions + row-level security satisfies the same interface
 * for production (ADR-002, ADR-003).
 */
export interface Store {
  // Runs ----------------------------------------------------------------
  insertRun(run: IngestedRun): Promise<IngestedRun>;
  getRun(tenantId: string, runId: string): Promise<IngestedRun | null>;
  queryRuns(query: RunQuery): Promise<IngestedRun[]>;

  // Tenants --------------------------------------------------------------
  insertTenant(tenant: Tenant): Promise<Tenant>;
  getTenant(tenantId: string): Promise<Tenant | null>;

  // Users ----------------------------------------------------------------
  insertUser(user: User): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  listUsers(tenantId: string): Promise<User[]>;
  setUserRole(tenantId: string, userId: string, role: UserRole): Promise<User | null>;

  // Lifecycle ------------------------------------------------------------
  close(): Promise<void>;
}
