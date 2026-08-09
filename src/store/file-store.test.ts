import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from './file-store';
import type { IngestedRun, Tenant, User } from '../types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-store-'));
}

function makeRun(tenantId: string, runId: string, overrides: Partial<IngestedRun> = {}): IngestedRun {
  return {
    runId,
    timestamp: '2026-08-09T10:00:00Z',
    total: 10, passed: 9, failed: 1, skipped: 0,
    flaky: 0, slow: 0, duration: 5000, passRate: 90,
    orgContext: {
      tenantId, client: 'c1', product: 'p1', team: 't1',
      stack: 'playwright', runType: 'pr', environment: 'dev',
    },
    ingestedAt: '2026-08-09T10:01:00Z',
    ...overrides,
  };
}

describe('FileStore', () => {
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

  describe('runs', () => {
    it('inserts and retrieves a run by tenant + runId', async () => {
      const run = makeRun('acme', 'r1');
      await store.insertRun(run);
      const got = await store.getRun('acme', 'r1');
      expect(got).not.toBeNull();
      expect(got?.runId).toBe('r1');
      expect(got?.orgContext.tenantId).toBe('acme');
    });

    it('returns null for an unknown run', async () => {
      expect(await store.getRun('acme', 'nope')).toBeNull();
    });

    it('persists runs across reopen (append-only log)', async () => {
      await store.insertRun(makeRun('acme', 'r1'));
      await store.close();
      const reopened = new FileStore(dir);
      await reopened.open();
      const got = await reopened.getRun('acme', 'r1');
      expect(got?.runId).toBe('r1');
      await reopened.close();
    });

    it('filters runs by org-context dimensions', async () => {
      await store.insertRun(makeRun('acme', 'r1', { orgContext: { tenantId: 'acme', client: 'c1', product: 'p1', team: 't1', stack: 'playwright', runType: 'pr', environment: 'dev' } }));
      await store.insertRun(makeRun('acme', 'r2', { orgContext: { tenantId: 'acme', client: 'c2', product: 'p1', team: 't2', stack: 'dotnet', runType: 'nightly', environment: 'ci' } }));
      const nightly = await store.queryRuns({ tenantId: 'acme', runType: 'nightly' });
      expect(nightly).toHaveLength(1);
      expect(nightly[0].runId).toBe('r2');
      const dotnet = await store.queryRuns({ tenantId: 'acme', stack: 'dotnet' });
      expect(dotnet).toHaveLength(1);
      const c1 = await store.queryRuns({ tenantId: 'acme', client: 'c1' });
      expect(c1).toHaveLength(1);
      expect(c1[0].runId).toBe('r1');
    });

    it('filters by time range', async () => {
      await store.insertRun(makeRun('acme', 'r1', { timestamp: '2026-08-01T00:00:00Z' }));
      await store.insertRun(makeRun('acme', 'r2', { timestamp: '2026-08-09T00:00:00Z' }));
      const august = await store.queryRuns({ tenantId: 'acme', from: '2026-08-05T00:00:00Z' });
      expect(august).toHaveLength(1);
      expect(august[0].runId).toBe('r2');
    });

    it('respects the limit', async () => {
      for (let i = 0; i < 50; i++) {
        await store.insertRun(makeRun('acme', `r${i}`, { timestamp: `2026-08-0${(i % 9) + 1}T10:00:00Z` }));
      }
      const limited = await store.queryRuns({ tenantId: 'acme', limit: 10 });
      expect(limited).toHaveLength(10);
    });
  });

  describe('tenant isolation (security-critical)', () => {
    it('getRun cannot read another tenant\'s run', async () => {
      await store.insertRun(makeRun('acme', 'r1'));
      // Tenant "globex" must NOT see acme's run
      expect(await store.getRun('globex', 'r1')).toBeNull();
    });

    it('queryRuns only returns the named tenant\'s runs', async () => {
      await store.insertRun(makeRun('acme', 'r1'));
      await store.insertRun(makeRun('acme', 'r2'));
      await store.insertRun(makeRun('globex', 'r3'));
      const acmeRuns = await store.queryRuns({ tenantId: 'acme' });
      expect(acmeRuns).toHaveLength(2);
      expect(acmeRuns.every(r => r.orgContext.tenantId === 'acme')).toBe(true);
      const globexRuns = await store.queryRuns({ tenantId: 'globex' });
      expect(globexRuns).toHaveLength(1);
      expect(globexRuns[0].orgContext.tenantId).toBe('globex');
    });

    it('listUsers only returns the named tenant\'s users', async () => {
      await store.insertUser({ userId: 'u1', tenantId: 'acme', role: 'admin', email: 'a@acme.com', createdAt: '2026-01-01T00:00:00Z' });
      await store.insertUser({ userId: 'u2', tenantId: 'globex', role: 'viewer', email: 'g@globex.com', createdAt: '2026-01-01T00:00:00Z' });
      const acmeUsers = await store.listUsers('acme');
      expect(acmeUsers).toHaveLength(1);
      expect(acmeUsers[0].tenantId).toBe('acme');
    });

    it('setUserRole cannot modify another tenant\'s user', async () => {
      await store.insertUser({ userId: 'u1', tenantId: 'acme', role: 'viewer', email: 'a@acme.com', createdAt: '2026-01-01T00:00:00Z' });
      // globex admin tries to escalate acme's user
      const result = await store.setUserRole('globex', 'u1', 'admin');
      expect(result).toBeNull();
      const user = await store.getUser('u1');
      expect(user?.role).toBe('viewer');
    });
  });

  describe('tenants', () => {
    it('inserts and retrieves a tenant', async () => {
      const tenant: Tenant = { tenantId: 'acme', name: 'Acme Corp', region: 'eu-west-1', createdAt: '2026-01-01T00:00:00Z' };
      await store.insertTenant(tenant);
      const got = await store.getTenant('acme');
      expect(got?.name).toBe('Acme Corp');
      expect(got?.region).toBe('eu-west-1');
    });

    it('persists tenants across reopen', async () => {
      await store.insertTenant({ tenantId: 'acme', name: 'Acme', createdAt: '2026-01-01T00:00:00Z' });
      await store.close();
      const reopened = new FileStore(dir);
      await reopened.open();
      expect((await reopened.getTenant('acme'))?.name).toBe('Acme');
      await reopened.close();
    });
  });

  describe('users', () => {
    it('inserts and retrieves a user', async () => {
      const user: User = { userId: 'u1', tenantId: 'acme', role: 'viewer', email: 'a@acme.com', createdAt: '2026-01-01T00:00:00Z' };
      await store.insertUser(user);
      expect((await store.getUser('u1'))?.email).toBe('a@acme.com');
    });

    it('updates a user role within the same tenant', async () => {
      await store.insertUser({ userId: 'u1', tenantId: 'acme', role: 'viewer', email: 'a@acme.com', createdAt: '2026-01-01T00:00:00Z' });
      const updated = await store.setUserRole('acme', 'u1', 'admin');
      expect(updated?.role).toBe('admin');
      expect((await store.getUser('u1'))?.role).toBe('admin');
    });
  });
});
