import * as fs from 'fs';
import * as path from 'path';
import type { Store } from '../store';

/**
 * Retention policy enforcement (ADR-002). Runs nightly to:
 * 1. Archive runs older than the hot-tier threshold (default 90 days) to a
 *    cold-tier directory, marking them as archived in the store.
 * 2. Delete runs older than the hard retention limit (default 3 years / 1095
 *    days) to enforce the data retention policy.
 *
 * In the file-store implementation, archiving moves run records to a
 * per-tenant archive directory. In the future Postgres implementation,
 * archiving moves rows to a cold partition table.
 */
export interface RetentionPolicy {
  /** Age in days after which runs are moved to cold storage. Default: 90. */
  hotTierDays: number;
  /** Age in days after which runs are permanently deleted. Default: 1095 (3yr). */
  retentionDays: number;
}

export const DEFAULT_POLICY: RetentionPolicy = {
  hotTierDays: 90,
  retentionDays: 1095, // 3 years
};

/**
 * Result of a single retention run.
 */
export interface RetentionResult {
  archived: number;
  deleted: number;
  tenantsProcessed: number;
  ranAt: string;
}

/**
 * Execute the retention policy against the store. This is the function a
 * nightly cron / scheduled job calls.
 */
export async function runRetention(
  store: Store,
  policy: RetentionPolicy = DEFAULT_POLICY,
): Promise<RetentionResult> {
  const now = Date.now();
  const hotThreshold = new Date(now - policy.hotTierDays * 86400000).toISOString();
  const deleteThreshold = new Date(now - policy.retentionDays * 86400000).toISOString();

  let archived = 0;
  let deleted = 0;
  const tenants = await store.listTenants();

  for (const tenantId of tenants) {
    // Delete runs older than the retention limit.
    const toDelete = await store.queryRuns({ tenantId, to: deleteThreshold, limit: 100000 });
    for (const run of toDelete) {
      await store.deleteRun(tenantId, run.runId);
      deleted++;
    }

    // Archive runs older than the hot-tier threshold (but not yet deleted).
    const toArchive = await store.queryRuns({ tenantId, from: deleteThreshold, to: hotThreshold, limit: 100000 });
    for (const run of toArchive) {
      if (!run.archived) {
        await store.archiveRun(tenantId, run.runId);
        archived++;
      }
    }
  }

  return { archived, deleted, tenantsProcessed: tenants.length, ranAt: new Date().toISOString() };
}
