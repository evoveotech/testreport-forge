import type {
  IngestedRun,
  EstateRollup,
  RollupSlice,
  TeamContribution,
  TrendPoint,
  ConnectorData,
} from '../types';
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
}

const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_MS: Record<EstateRollup['period'], number> = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 30 * DAY_MS,
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
