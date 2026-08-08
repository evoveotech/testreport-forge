import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from '../store';
import { Aggregator } from './aggregator';
import type { IngestedRun, OrgContext } from '../types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-agg-'));
}

function ctx(overrides: Partial<OrgContext> = {}): OrgContext {
  return {
    tenantId: 'acme', client: 'c1', product: 'p1', team: 't1',
    stack: 'playwright', runType: 'pr', environment: 'dev',
    ...overrides,
  };
}

function run(
  tenantId: string,
  runId: string,
  passRate: number,
  flaky: number,
  daysAgo: number,
  orgCtx: Partial<OrgContext> = {},
): IngestedRun {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    runId,
    timestamp: d.toISOString(),
    total: 100, passed: Math.round(passRate), failed: 100 - Math.round(passRate),
    skipped: 0, flaky, slow: 0, duration: 5000, passRate,
    orgContext: ctx({ tenantId, ...orgCtx }),
    ingestedAt: d.toISOString(),
  };
}

describe('Aggregator', () => {
  let dir: string;
  let store: FileStore;
  let agg: Aggregator;

  beforeEach(async () => {
    dir = tmpDir();
    store = new FileStore(dir);
    await store.open();
    agg = new Aggregator(store);
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty rollup for a tenant with no runs', async () => {
    const r = await agg.estateRollup('acme', 'weekly');
    expect(r.totalRuns).toBe(0);
    expect(r.passRate).toBe(0);
    expect(r.byClient).toEqual([]);
    expect(r.byTeam).toEqual([]);
  });

  it('aggregates total runs and pass rate over the period', async () => {
    await store.insertRun(run('acme', 'r1', 90, 0, 1));
    await store.insertRun(run('acme', 'r2', 80, 0, 2));
    const r = await agg.estateRollup('acme', 'weekly');
    expect(r.totalRuns).toBe(2);
    expect(r.passRate).toBe(85); // (90+80)/2
  });

  it('slices by client, product, stack, and runType', async () => {
    await store.insertRun(run('acme', 'r1', 90, 0, 1, { client: 'c1', product: 'p1', stack: 'playwright', runType: 'pr' }));
    await store.insertRun(run('acme', 'r2', 70, 0, 1, { client: 'c2', product: 'p2', stack: 'dotnet', runType: 'nightly' }));
    const r = await agg.estateRollup('acme', 'weekly');
    expect(r.byClient.map(s => s.key).sort()).toEqual(['c1', 'c2']);
    expect(r.byProduct.map(s => s.key).sort()).toEqual(['p1', 'p2']);
    expect(r.byStack.map(s => s.key).sort()).toEqual(['dotnet', 'playwright']);
    expect(r.byRunType.map(s => s.key).sort()).toEqual(['nightly', 'pr']);
  });

  it('computes deltaPct vs the previous period', async () => {
    // Previous period (8-14 days ago): 70%
    await store.insertRun(run('acme', 'r1', 70, 0, 10));
    // Current period (1-7 days ago): 90%
    await store.insertRun(run('acme', 'r2', 90, 0, 1));
    const r = await agg.estateRollup('acme', 'weekly');
    expect(r.totalRuns).toBe(1); // only current period
    // delta = current(90) - previous(70) = 20
    expect(r.byClient[0].deltaPct).toBe(20);
  });

  it('computes team contribution with runs, pass rate, and flakiness owned', async () => {
    await store.insertRun(run('acme', 'r1', 90, 2, 1, { team: 'qa-a' }));
    await store.insertRun(run('acme', 'r2', 80, 0, 1, { team: 'qa-a' }));
    await store.insertRun(run('acme', 'r3', 100, 0, 1, { team: 'qa-b' }));
    const r = await agg.estateRollup('acme', 'weekly');
    const a = r.byTeam.find(t => t.team === 'qa-a')!;
    const b = r.byTeam.find(t => t.team === 'qa-b')!;
    expect(a.runsExecuted).toBe(2);
    expect(a.passRate).toBe(85);
    expect(a.flakinessOwned).toBe(2);
    expect(a.testsAuthored).toBe(0); // connectors not configured yet
    expect(a.fixesLanded).toBe(0);
    expect(b.runsExecuted).toBe(1);
    expect(b.passRate).toBe(100);
  });

  it('builds a daily trend series', async () => {
    await store.insertRun(run('acme', 'r1', 80, 0, 0));
    await store.insertRun(run('acme', 'r2', 90, 0, 1));
    await store.insertRun(run('acme', 'r3', 100, 0, 2));
    const r = await agg.estateRollup('acme', 'weekly');
    expect(r.trend.length).toBeGreaterThan(0);
    expect(r.trend.length).toBeLessThanOrEqual(7);
    const today = r.trend[r.trend.length - 1];
    expect(today.totalRuns).toBe(1);
    expect(today.passRate).toBe(80);
  });

  it('computes flakyRate as the percentage of runs with flaky > 0', async () => {
    await store.insertRun(run('acme', 'r1', 90, 1, 1));
    await store.insertRun(run('acme', 'r2', 90, 0, 1));
    await store.insertRun(run('acme', 'r3', 90, 0, 1));
    await store.insertRun(run('acme', 'r4', 90, 0, 1));
    const r = await agg.estateRollup('acme', 'weekly');
    // 1 of 4 runs has flaky > 0 -> 25%
    expect(r.flakyRate).toBe(25);
  });

  it('is tenant-scoped: never sees another tenant\'s runs', async () => {
    await store.insertRun(run('acme', 'r1', 90, 0, 1));
    await store.insertRun(run('globex', 'r2', 50, 0, 1));
    const acme = await agg.estateRollup('acme', 'weekly');
    const globex = await agg.estateRollup('globex', 'weekly');
    expect(acme.totalRuns).toBe(1);
    expect(acme.passRate).toBe(90);
    expect(globex.totalRuns).toBe(1);
    expect(globex.passRate).toBe(50);
  });
});
