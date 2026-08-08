import { describe, it, expect } from 'vitest';
import type {
  OrgContext,
  IngestedRun,
  RollupSlice,
  TeamContribution,
  TrendPoint,
  EstateRollup,
  IngestPayload,
  IngestResult,
  Tenant,
  User,
  UserRole,
  RunSummary,
} from './types';

describe('Leadership platform types', () => {
  describe('OrgContext', () => {
    it('captures the full tenancy + attribution key', () => {
      const ctx: OrgContext = {
        tenantId: 'acme',
        client: 'client-1042',
        product: 'payments-gateway',
        team: 'payments-qa',
        stack: 'dotnet',
        runType: 'nightly',
        environment: 'prod',
      };
      expect(ctx.tenantId).toBe('acme');
      expect(ctx.runType).toBe('nightly');
    });

    it('allows every runType variant', () => {
      const variants: OrgContext['runType'][] = ['pr', 'nightly', 'daily', 'scheduled', 'manual'];
      variants.forEach(v => {
        const ctx: OrgContext = {
          tenantId: 't', client: 'c', product: 'p', team: 'tm',
          stack: 's', runType: v, environment: 'e',
        };
        expect(ctx.runType).toBe(v);
      });
    });
  });

  describe('IngestedRun', () => {
    it('extends RunSummary with org context + ingestion metadata', () => {
      const summary: RunSummary = {
        runId: 'run-1', timestamp: '2026-08-09T10:00:00Z',
        total: 10, passed: 9, failed: 1, skipped: 0,
        flaky: 0, slow: 0, duration: 5000, passRate: 90,
      };
      const run: IngestedRun = {
        ...summary,
        orgContext: {
          tenantId: 'acme', client: 'c1', product: 'p1', team: 't1',
          stack: 'playwright', runType: 'pr', environment: 'dev',
        },
        ingestedAt: '2026-08-09T10:01:00Z',
      };
      expect(run.runId).toBe('run-1');
      expect(run.orgContext.tenantId).toBe('acme');
      expect(run.passRate).toBe(90);
      expect(run.ingestedAt).toBeDefined();
    });
  });

  describe('RollupSlice', () => {
    it('describes one dimension of the estate', () => {
      const slice: RollupSlice = {
        key: 'payments-gateway', totalRuns: 42, passRate: 95,
        flakyRate: 3, deltaPct: 2,
      };
      expect(slice.key).toBe('payments-gateway');
      expect(slice.totalRuns).toBe(42);
    });
  });

  describe('TeamContribution', () => {
    it('carries all four metrics (ADR-006)', () => {
      const tc: TeamContribution = {
        team: 'payments-qa', runsExecuted: 120, passRate: 94,
        flakinessOwned: 3, testsAuthored: 18, fixesLanded: 7,
      };
      expect(tc.testsAuthored).toBe(18);
      expect(tc.fixesLanded).toBe(7);
    });
  });

  describe('EstateRollup', () => {
    it('composes the full leadership view', () => {
      const rollup: EstateRollup = {
        asOf: '2026-08-09T10:00:00Z', tenantId: 'acme', period: 'weekly',
        totalRuns: 500, passRate: 92, flakyRate: 4,
        byClient: [], byProduct: [], byTeam: [], byStack: [], byRunType: [],
        trend: [{ date: '2026-08-08', passRate: 91, totalRuns: 70 }],
      };
      expect(rollup.totalRuns).toBe(500);
      expect(rollup.trend[0].passRate).toBe(91);
    });
  });

  describe('IngestPayload', () => {
    it('accepts a raw artifact with format for adapter routing', () => {
      const payload: IngestPayload = {
        orgContext: {
          tenantId: 'acme', client: 'c1', product: 'p1', team: 't1',
          stack: 'junit', runType: 'nightly', environment: 'ci',
        },
        format: 'junit',
        rawArtifact: '<testsuite>...</testsuite>',
      };
      expect(payload.format).toBe('junit');
      expect(payload.rawArtifact).toBeDefined();
    });

    it('accepts a pre-normalized run summary', () => {
      const payload: IngestPayload = {
        orgContext: {
          tenantId: 'acme', client: 'c1', product: 'p1', team: 't1',
          stack: 'playwright', runType: 'pr', environment: 'dev',
        },
        run: {
          runId: 'r1', timestamp: '2026-08-09T10:00:00Z',
          total: 5, passed: 5, failed: 0, skipped: 0,
          flaky: 0, slow: 0, duration: 1000, passRate: 100,
        },
      };
      expect(payload.run?.runId).toBe('r1');
      expect(payload.format).toBeUndefined();
    });
  });

  describe('IngestResult', () => {
    it('reports acceptance with a runId', () => {
      const result: IngestResult = { accepted: true, runId: 'r1' };
      expect(result.accepted).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('reports rejection with errors', () => {
      const result: IngestResult = { accepted: false, runId: '', errors: ['bad payload'] };
      expect(result.accepted).toBe(false);
      expect(result.errors).toEqual(['bad payload']);
    });
  });

  describe('Tenant + User RBAC model', () => {
    it('models a tenant with region pinning', () => {
      const tenant: Tenant = {
        tenantId: 'acme', name: 'Acme Corp', region: 'eu-west-1',
        createdAt: '2026-01-01T00:00:00Z',
      };
      expect(tenant.region).toBe('eu-west-1');
    });

    it('models viewer and admin roles', () => {
      const roles: UserRole[] = ['viewer', 'admin'];
      const user: User = {
        userId: 'u1', tenantId: 'acme', role: 'admin',
        email: 'qa@acme.com', createdAt: '2026-01-01T00:00:00Z',
      };
      expect(roles).toContain('admin');
      expect(user.role).toBe('admin');
    });
  });
});
