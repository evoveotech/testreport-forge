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

  it('slices by client, product, stack, runType, and environment', async () => {
    await store.insertRun(run('acme', 'r1', 90, 0, 1, { client: 'c1', product: 'p1', stack: 'playwright', runType: 'pr', environment: 'dev' }));
    await store.insertRun(run('acme', 'r2', 70, 0, 1, { client: 'c2', product: 'p2', stack: 'dotnet', runType: 'nightly', environment: 'prod' }));
    const r = await agg.estateRollup('acme', 'weekly');
    expect(r.byClient.map(s => s.key).sort()).toEqual(['c1', 'c2']);
    expect(r.byProduct.map(s => s.key).sort()).toEqual(['p1', 'p2']);
    expect(r.byStack.map(s => s.key).sort()).toEqual(['dotnet', 'playwright']);
    expect(r.byRunType.map(s => s.key).sort()).toEqual(['nightly', 'pr']);
    expect(r.byEnvironment.map(s => s.key).sort()).toEqual(['dev', 'prod']);
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

  it('uses connector data for testsAuthored and fixesLanded when provided', async () => {
    await store.insertRun(run('acme', 'r1', 90, 0, 1, { team: 'qa-a' }));
    await store.insertRun(run('acme', 'r2', 80, 0, 1, { team: 'qa-b' }));
    const connectorData = {
      'qa-a': { testsAuthored: 12, fixesLanded: 5 },
      'qa-b': { testsAuthored: 3, fixesLanded: 8 },
    };
    const r = await agg.estateRollup('acme', 'weekly', connectorData);
    const a = r.byTeam.find(t => t.team === 'qa-a')!;
    const b = r.byTeam.find(t => t.team === 'qa-b')!;
    expect(a.testsAuthored).toBe(12);
    expect(a.fixesLanded).toBe(5);
    expect(b.testsAuthored).toBe(3);
    expect(b.fixesLanded).toBe(8);
  });

  it('defaults testsAuthored/fixesLanded to 0 when connector data is not provided', async () => {
    await store.insertRun(run('acme', 'r1', 90, 0, 1, { team: 'qa-a' }));
    const r = await agg.estateRollup('acme', 'weekly');
    const a = r.byTeam.find(t => t.team === 'qa-a')!;
    expect(a.testsAuthored).toBe(0);
    expect(a.fixesLanded).toBe(0);
  });

  it('defaults to 0 for teams not in connector data', async () => {
    await store.insertRun(run('acme', 'r1', 90, 0, 1, { team: 'qa-a' }));
    await store.insertRun(run('acme', 'r2', 80, 0, 1, { team: 'qa-b' }));
    // Only qa-a has connector data; qa-b should default to 0.
    const connectorData = { 'qa-a': { testsAuthored: 5, fixesLanded: 2 } };
    const r = await agg.estateRollup('acme', 'weekly', connectorData);
    const a = r.byTeam.find(t => t.team === 'qa-a')!;
    const b = r.byTeam.find(t => t.team === 'qa-b')!;
    expect(a.testsAuthored).toBe(5);
    expect(a.fixesLanded).toBe(2);
    expect(b.testsAuthored).toBe(0);
    expect(b.fixesLanded).toBe(0);
  });

  describe('byStackCategory', () => {
    it('groups stacks into mobile/backend/web categories', async () => {
      const dir = tmpDir();
      const store = new FileStore(dir);
      await store.open();
      const agg = new Aggregator(store);
      await store.insertRun(run('acme', 'r1', 90, 0, 0, { stack: 'xctest' }));
      await store.insertRun(run('acme', 'r2', 80, 0, 0, { stack: 'espresso' }));
      await store.insertRun(run('acme', 'r3', 95, 0, 0, { stack: 'junit' }));
      await store.insertRun(run('acme', 'r4', 85, 0, 0, { stack: 'playwright' }));
      const rollup = await agg.estateRollup('acme', 'weekly');
      const mobile = rollup.byStackCategory.find(s => s.key === 'mobile');
      const backend = rollup.byStackCategory.find(s => s.key === 'backend');
      const web = rollup.byStackCategory.find(s => s.key === 'web');
      expect(mobile).toBeDefined();
      expect(mobile!.totalRuns).toBe(2);
      expect(backend).toBeDefined();
      expect(backend!.totalRuns).toBe(1);
      expect(web).toBeDefined();
      expect(web!.totalRuns).toBe(1);
      await store.close();
    });
  });

  describe('trendSeries', () => {
    it('returns trend points without the full rollup', async () => {
      const dir = tmpDir();
      const store = new FileStore(dir);
      await store.open();
      const agg = new Aggregator(store);
      await store.insertRun(run('acme', 'r1', 90, 0, 0));
      await store.insertRun(run('acme', 'r2', 80, 0, 1));
      const trend = await agg.trendSeries('acme', 'weekly');
      expect(trend.length).toBeGreaterThan(0);
      expect(trend[0]).toHaveProperty('date');
      expect(trend[0]).toHaveProperty('passRate');
      expect(trend[0]).toHaveProperty('totalRuns');
      await store.close();
    });
  });

  describe('teamDrillDown', () => {
    it('returns worst runs and flaky runs for a team', async () => {
      const dir = tmpDir();
      const store = new FileStore(dir);
      await store.open();
      const agg = new Aggregator(store);
      for (let i = 0; i < 25; i++) {
        await store.insertRun(run('acme', 'r' + i, 100 - i * 3, i % 3, 0, { team: 'qa-payments' }));
      }
      await store.insertRun(run('acme', 'other', 90, 0, 0, { team: 'qa-banking' }));
      const dd = await agg.teamDrillDown('acme', 'qa-payments', 'weekly');
      expect(dd.team).toBe('qa-payments');
      expect(dd.totalRuns).toBe(25);
      expect(dd.worstRuns.length).toBe(20);
      expect(dd.worstRuns[0].passRate).toBeLessThanOrEqual(dd.worstRuns[1].passRate);
      expect(dd.flakyRuns.length).toBeGreaterThan(0);
      expect(dd.flakyRuns[0].flaky).toBeGreaterThanOrEqual(dd.flakyRuns[1].flaky);
      await store.close();
    });
  });

  describe('compare', () => {
    it('compares current period vs previous period', async () => {
      const dir = tmpDir();
      const store = new FileStore(dir);
      await store.open();
      const agg = new Aggregator(store);
      // Previous period runs
      await store.insertRun(run('acme', 'p1', 80, 0, 10, { client: 'c1' }));
      await store.insertRun(run('acme', 'p2', 90, 0, 10, { client: 'c2' }));
      // Current period runs
      await store.insertRun(run('acme', 'c1', 85, 0, 0, { client: 'c1' }));
      await store.insertRun(run('acme', 'c2', 95, 0, 0, { client: 'c2' }));
      const cmp = await agg.compare('acme', 'weekly');
      expect(cmp.totalRunsDelta).toBe(0);
      expect(cmp.passRateDelta).toBeGreaterThan(0);
      expect(cmp.byClient.length).toBe(2);
      const c1 = cmp.byClient.find(s => s.key === 'c1');
      expect(c1!.period1PassRate).toBe(80);
      expect(c1!.period2PassRate).toBe(85);
      await store.close();
    });
  });

  describe('individualContributions', () => {
    it('returns per-user metrics when runs have userId', async () => {
      const dir = tmpDir();
      const store = new FileStore(dir);
      await store.open();
      const agg = new Aggregator(store);
      // Insert runs with userId in orgContext
      await store.insertRun({ ...run('acme', 'u1r1', 90, 0, 0, { team: 'qa-payments' }), orgContext: { ...ctx({ team: 'qa-payments' }), userId: 'alice' } as never });
      await store.insertRun({ ...run('acme', 'u1r2', 80, 0, 0, { team: 'qa-payments' }), orgContext: { ...ctx({ team: 'qa-payments' }), userId: 'alice' } as never });
      await store.insertRun({ ...run('acme', 'u2r1', 95, 0, 0, { team: 'qa-banking' }), orgContext: { ...ctx({ team: 'qa-banking' }), userId: 'bob' } as never });
      const contribs = await agg.individualContributions('acme', 'weekly', {
        'qa-payments': { testsAuthored: 10, fixesLanded: 5 },
        'qa-banking': { testsAuthored: 8, fixesLanded: 3 },
      });
      expect(contribs.length).toBe(2);
      const alice = contribs.find(c => c.userId === 'alice');
      expect(alice!.team).toBe('qa-payments');
      expect(alice!.runsExecuted).toBe(2);
      expect(alice!.testsAuthored).toBe(10);
      await store.close();
    });

    it('falls back to team-aggregate from connector data when no userId', async () => {
      const dir = tmpDir();
      const store = new FileStore(dir);
      await store.open();
      const agg = new Aggregator(store);
      await store.insertRun(run('acme', 'r1', 90, 0, 0, { team: 'qa-payments' }));
      const contribs = await agg.individualContributions('acme', 'weekly', {
        'qa-payments': { testsAuthored: 15, fixesLanded: 7 },
      });
      expect(contribs.length).toBe(1);
      expect(contribs[0].userId).toBe('team-aggregate');
      expect(contribs[0].testsAuthored).toBe(15);
      await store.close();
    });
  });
});
