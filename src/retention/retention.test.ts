import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from '../store';
import { runRetention, DEFAULT_POLICY } from './retention';
import type { IngestedRun, OrgContext } from '../types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-ret-'));
}

function ctx(tenantId: string): OrgContext {
  return { tenantId, client: 'c1', product: 'p1', team: 't1', stack: 'junit', runType: 'nightly', environment: 'ci' };
}

function run(tenantId: string, runId: string, daysAgo: number): IngestedRun {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return {
    runId, timestamp: d.toISOString(),
    total: 10, passed: 9, failed: 1, skipped: 0, flaky: 0, slow: 0, duration: 1000, passRate: 90,
    orgContext: ctx(tenantId),
    ingestedAt: d.toISOString(),
  };
}

describe('runRetention', () => {
  let dir: string;
  let store: FileStore;

  beforeEach(async () => {
    dir = tmpDir();
    store = new FileStore(dir);
    await store.open();
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('deletes runs older than the retention limit', async () => {
    await store.insertRun(run('acme', 'r-old', 1000)); // ~3 years ago
    await store.insertRun(run('acme', 'r-new', 1));    // yesterday
    const result = await runRetention(store, { ...DEFAULT_POLICY, retentionDays: 900 });
    expect(result.deleted).toBe(1);
    expect(await store.getRun('acme', 'r-old')).toBeNull();
    expect(await store.getRun('acme', 'r-new')).not.toBeNull();
  });

  it('archives runs older than the hot-tier threshold but within retention', async () => {
    await store.insertRun(run('acme', 'r-cold', 100)); // 100 days ago
    await store.insertRun(run('acme', 'r-hot', 1));    // yesterday
    const result = await runRetention(store, { ...DEFAULT_POLICY, hotTierDays: 90, retentionDays: 1095 });
    expect(result.archived).toBe(1);
    const cold = await store.getRun('acme', 'r-cold');
    expect(cold?.archived).toBe(true);
    const hot = await store.getRun('acme', 'r-hot');
    expect(hot?.archived).toBeUndefined();
  });

  it('does not re-archive already-archived runs', async () => {
    await store.insertRun(run('acme', 'r-cold', 100));
    await runRetention(store, { ...DEFAULT_POLICY, hotTierDays: 90, retentionDays: 1095 });
    const result = await runRetention(store, { ...DEFAULT_POLICY, hotTierDays: 90, retentionDays: 1095 });
    expect(result.archived).toBe(0);
  });

  it('processes multiple tenants', async () => {
    await store.insertRun(run('acme', 'r1', 1000));
    await store.insertRun(run('globex', 'r2', 1000));
    const result = await runRetention(store, { ...DEFAULT_POLICY, retentionDays: 900 });
    expect(result.deleted).toBe(2);
    expect(result.tenantsProcessed).toBe(2);
  });

  it('returns zero counts when there are no runs', async () => {
    const result = await runRetention(store);
    expect(result.archived).toBe(0);
    expect(result.deleted).toBe(0);
  });
});
