import type {
  IngestedRun,
  EstateRollup,
  RollupSlice,
  TeamContribution,
  TrendPoint,
  ConnectorData,
  TeamDrillDown,
  PeriodComparison,
  ComparisonSlice,
  IndividualContribution,
} from '../types';
import { resolveStackCategory } from '../types';
import type { Store, RunQuery } from '../store';

/**
 * Builds leadership rollup views from the run store. All methods are
 * tenant-scoped: the caller supplies a tenantId and the aggregator only ever
 * sees that tenant's runs (the store enforces isolation -- ADR-003).
 */
export class Aggregator {
  constructor(private readonly store: Store) {}

  /**
   * Build the full estate rollup for a tenant over a period.
   * `period` determines the comparison window for deltaPct.
   */
  async estateRollup(
    tenantId: string,
    period: EstateRollup['period'] = 'weekly',
    connectorData?: ConnectorData,
  ): Promise<EstateRollup> {
    const now = Date.now();
    const periodMs = PERIOD_MS[period];
    const from = new Date(now - periodMs).toISOString();
    const prevFrom = new Date(now - 2 * periodMs).toISOString();
    const to = new Date(now).toISOString();

    const current = await this.store.queryRuns({ tenantId, from, to, limit: 100000 });
    const previous = await this.store.queryRuns({ tenantId, from: prevFrom, to: from, limit: 100000 });

    const totalRuns = current.length;
    const passRate = avgPassRate(current);
    const flaky = flakyRate(current);

    return {
      asOf: new Date().toISOString(),
      tenantId,
      period,
      totalRuns,
      passRate,
      flakyRate: flaky,
      byClient: this.sliceBy(current, previous, r => r.orgContext.client),
      byProduct: this.sliceBy(current, previous, r => r.orgContext.product),
      byStack: this.sliceBy(current, previous, r => r.orgContext.stack),
      byStackCategory: this.sliceBy(current, previous, r => resolveStackCategory(r.orgContext.stack)),
      byRunType: this.sliceBy(current, previous, r => r.orgContext.runType),
      byEnvironment: this.sliceBy(current, previous, r => r.orgContext.environment),
      byTeam: this.teamContribution(current, previous, connectorData),
      trend: this.trend(current, periodMs),
    };
  }

  /**
   * Slice runs by a dimension key, computing pass rate, flaky rate, and
   * delta vs the previous period.
   */
  private sliceBy(
    current: IngestedRun[],
    previous: IngestedRun[],
    keyFn: (r: IngestedRun) => string,
  ): RollupSlice[] {
    const groups = groupBy(current, keyFn);
    const prevGroups = groupBy(previous, keyFn);
    return [...groups.entries()]
      .map(([key, runs]) => {
        const prevRuns = prevGroups.get(key) ?? [];
        return {
          key,
          totalRuns: runs.length,
          passRate: avgPassRate(runs),
          flakyRate: flakyRate(runs),
          deltaPct: Math.round((avgPassRate(runs) - avgPassRate(prevRuns)) * 10) / 10,
        };
      })
      .sort((a, b) => b.totalRuns - a.totalRuns);
  }

  /**
   * Team contribution across all four metrics (ADR-006). testsAuthored and
   * fixesLanded come from the connectors layer (Task 7b); until connectors
   * are configured they are 0.
   */
  private teamContribution(current: IngestedRun[], _previous: IngestedRun[], connectorData?: ConnectorData): TeamContribution[] {
    const groups = groupBy(current, r => r.orgContext.team);
    return [...groups.entries()]
      .map(([team, runs]) => ({
        team,
        runsExecuted: runs.length,
        passRate: avgPassRate(runs),
        flakinessOwned: runs.reduce((sum, r) => sum + r.flaky, 0),
        testsAuthored: connectorData?.[team]?.testsAuthored ?? 0,
        fixesLanded: connectorData?.[team]?.fixesLanded ?? 0,
        products: [...new Set(runs.map(r => r.orgContext.product))],
        stacks: [...new Set(runs.map(r => r.orgContext.stack))],
      }))
      .sort((a, b) => b.runsExecuted - a.runsExecuted);
  }

  /**
   * Daily pass-rate trend series over the period.
   */
  private trend(runs: IngestedRun[], periodMs: number): TrendPoint[] {
    const days = Math.min(Math.ceil(periodMs / DAY_MS), 90);
    const buckets = new Map<string, IngestedRun[]>();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * DAY_MS);
      buckets.set(d.toISOString().split('T')[0], []);
    }
    for (const r of runs) {
      const day = r.timestamp.split('T')[0];
      const bucket = buckets.get(day);
      if (bucket) bucket.push(r);
    }
    return [...buckets.entries()].map(([date, dayRuns]) => ({
      date,
      passRate: avgPassRate(dayRuns),
      totalRuns: dayRuns.length,
    }));
  }

  /**
   * Standalone trend endpoint — returns the trend series for a given
   * period without the full rollup. Useful for chart-only views.
   */
  async trendSeries(
    tenantId: string,
    period: EstateRollup['period'] = 'weekly',
  ): Promise<TrendPoint[]> {
    const periodMs = PERIOD_MS[period];
    const from = new Date(Date.now() - periodMs).toISOString();
    const to = new Date().toISOString();
    const runs = await this.store.queryRuns({ tenantId, from, to, limit: 100000 });
    return this.trend(runs, periodMs);
  }

  /**
   * Drill-down into a specific team: worst runs, flaky runs, and
   * per-stack/per-product breakdowns for that team.
   */
  async teamDrillDown(
    tenantId: string,
    team: string,
    period: EstateRollup['period'] = 'weekly',
  ): Promise<TeamDrillDown> {
    const periodMs = PERIOD_MS[period];
    const from = new Date(Date.now() - periodMs).toISOString();
    const to = new Date().toISOString();
    const allRuns = await this.store.queryRuns({ tenantId, from, to, limit: 100000, team });
    const teamRuns = allRuns.filter(r => r.orgContext.team === team);
    const worstRuns = [...teamRuns].sort((a, b) => a.passRate - b.passRate).slice(0, 20);
    const flakyRuns = [...teamRuns]
      .filter(r => r.flaky > 0)
      .sort((a, b) => b.flaky - a.flaky)
      .slice(0, 20);
    return {
      team,
      period,
      totalRuns: teamRuns.length,
      passRate: avgPassRate(teamRuns),
      flakyRate: flakyRate(teamRuns),
      worstRuns,
      flakyRuns,
      byStack: this.sliceBy(teamRuns, [], r => r.orgContext.stack),
      byProduct: this.sliceBy(teamRuns, [], r => r.orgContext.product),
    };
  }

  /**
   * Period-over-period comparison. Compares the current period against
   * the previous period across client, team, and stack dimensions.
   */
  async compare(
    tenantId: string,
    period: EstateRollup['period'] = 'weekly',
  ): Promise<PeriodComparison> {
    const periodMs = PERIOD_MS[period];
    const now = Date.now();
    const p1From = new Date(now - 2 * periodMs).toISOString();
    const p1To = new Date(now - periodMs).toISOString();
    const p2From = p1To;
    const p2To = new Date(now).toISOString();
    const p1Runs = await this.store.queryRuns({ tenantId, from: p1From, to: p1To, limit: 100000 });
    const p2Runs = await this.store.queryRuns({ tenantId, from: p2From, to: p2To, limit: 100000 });

    return {
      period1: { label: 'previous ' + period, from: p1From, to: p1To },
      period2: { label: 'current ' + period, from: p2From, to: p2To },
      totalRunsDelta: p2Runs.length - p1Runs.length,
      passRateDelta: Math.round((avgPassRate(p2Runs) - avgPassRate(p1Runs)) * 10) / 10,
      flakyRateDelta: Math.round((flakyRate(p2Runs) - flakyRate(p1Runs)) * 10) / 10,
      byClient: this.compareSlice(p1Runs, p2Runs, r => r.orgContext.client),
      byTeam: this.compareSlice(p1Runs, p2Runs, r => r.orgContext.team),
      byStack: this.compareSlice(p1Runs, p2Runs, r => r.orgContext.stack),
    };
  }

  private compareSlice(
    p1: IngestedRun[],
    p2: IngestedRun[],
    keyFn: (r: IngestedRun) => string,
  ): ComparisonSlice[] {
    const g1 = groupBy(p1, keyFn);
    const g2 = groupBy(p2, keyFn);
    const keys = new Set([...g1.keys(), ...g2.keys()]);
    return [...keys].map(key => {
      const r1 = g1.get(key) ?? [];
      const r2 = g2.get(key) ?? [];
      const pr1 = avgPassRate(r1);
      const pr2 = avgPassRate(r2);
      return {
        key,
        period1Runs: r1.length,
        period2Runs: r2.length,
        period1PassRate: pr1,
        period2PassRate: pr2,
        passRateDelta: Math.round((pr2 - pr1) * 10) / 10,
      };
    }).sort((a, b) => b.period2Runs - a.period2Runs);
  }

  /**
   * Individual contributor metrics. Derives per-user attribution from
   * connector data (testsAuthored, fixesLanded) and run attribution
   * (runsExecuted, passRate) when runs carry a userId in orgContext.
   */
  async individualContributions(
    tenantId: string,
    period: EstateRollup['period'] = 'weekly',
    connectorData?: ConnectorData,
  ): Promise<IndividualContribution[]> {
    const periodMs = PERIOD_MS[period];
    const from = new Date(Date.now() - periodMs).toISOString();
    const to = new Date().toISOString();
    const runs = await this.store.queryRuns({ tenantId, from, to, limit: 100000 });

    // Group runs by (userId, team) when userId is present.
    const byUser = new Map<string, { userId: string; team: string; runs: IngestedRun[] }>();
    for (const r of runs) {
      const userId = (r.orgContext as { userId?: string }).userId;
      if (!userId) continue;
      const key = userId + '|' + r.orgContext.team;
      let entry = byUser.get(key);
      if (!entry) { entry = { userId, team: r.orgContext.team, runs: [] }; byUser.set(key, entry); }
      entry.runs.push(r);
    }

    const result: IndividualContribution[] = [];
    for (const { userId, team, runs } of byUser.values()) {
      result.push({
        userId,
        team,
        runsExecuted: runs.length,
        testsAuthored: connectorData?.[team]?.testsAuthored ?? 0,
        fixesLanded: connectorData?.[team]?.fixesLanded ?? 0,
        passRate: avgPassRate(runs),
      });
    }
    // If no per-user attribution in runs, synthesize from connector data.
    if (result.length === 0 && connectorData) {
      for (const [team, data] of Object.entries(connectorData)) {
        if (data.testsAuthored > 0 || data.fixesLanded > 0) {
          result.push({ userId: 'team-aggregate', team, runsExecuted: 0, testsAuthored: data.testsAuthored, fixesLanded: data.fixesLanded, passRate: 0 });
        }
      }
    }
    return result.sort((a, b) => b.testsAuthored + b.fixesLanded - a.testsAuthored - a.fixesLanded);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<EstateRollup['period'], number> = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 30 * DAY_MS,
  quarterly: 90 * DAY_MS,
  all: 100 * 365 * DAY_MS,  // ~100 years — effectively "all time"
};

function groupBy(runs: IngestedRun[], keyFn: (r: IngestedRun) => string): Map<string, IngestedRun[]> {
  const m = new Map<string, IngestedRun[]>();
  for (const r of runs) {
    const k = keyFn(r);
    let arr = m.get(k);
    if (!arr) { arr = []; m.set(k, arr); }
    arr.push(r);
  }
  return m;
}

function avgPassRate(runs: IngestedRun[]): number {
  if (runs.length === 0) return 0;
  const sum = runs.reduce((s, r) => s + r.passRate, 0);
  return Math.round((sum / runs.length) * 10) / 10;
}

function flakyRate(runs: IngestedRun[]): number {
  if (runs.length === 0) return 0;
  const flakyRuns = runs.filter(r => r.flaky > 0).length;
  return Math.round((flakyRuns / runs.length) * 1000) / 10;
}
