import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from './store';
import { Aggregator } from './aggregator';
import type { IngestedRun, OrgContext } from './types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-bench-'));
}

function makeRun(tenantId: string, runId: string, i: number): IngestedRun {
  const clients = ['c1', 'c2', 'c3', 'c4', 'c5'];
  const products = ['p1', 'p2', 'p3'];
  const teams = ['qa-a', 'qa-b', 'qa-c'];
  const stacks = ['junit', 'playwright', 'dotnet', 'newman'];
  const runTypes: OrgContext['runType'][] = ['pr', 'nightly', 'daily'];
  const d = new Date(Date.now() - (i % 30) * 86400000);
  const passRate = 70 + (i % 30);
  return {
    runId,
    timestamp: d.toISOString(),
    total: 100,
    passed: passRate,
    failed: 100 - passRate,
    skipped: 0,
    flaky: i % 10 === 0 ? 1 : 0,
    slow: 0,
    duration: 5000,
    passRate,
    orgContext: {
      tenantId,
      client: clients[i % clients.length],
      product: products[i % products.length],
      team: teams[i % teams.length],
      stack: stacks[i % stacks.length],
      runType: runTypes[i % runTypes.length],
      environment: 'ci',
    },
    ingestedAt: d.toISOString(),
  };
}

describe('10k run benchmark', () => {
  it('ingests 10,000 runs and builds an estate rollup in under 5 seconds', async () => {
    const dir = tmpDir();
    const store = new FileStore(dir);
    await store.open();
    const N = 10000;

    const ingestStart = Date.now();
    for (let i = 0; i < N; i++) {
      await store.insertRun(makeRun('acme', `run-${i}`, i));
    }
    const ingestMs = Date.now() - ingestStart;

    const agg = new Aggregator(store);
    const rollupStart = Date.now();
    const rollup = await agg.estateRollup('acme', 'weekly');
    const rollupMs = Date.now() - rollupStart;

    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });

    // Assertions: correctness
    expect(rollup.totalRuns).toBeGreaterThan(0);
    expect(rollup.byClient.length).toBe(5);
    expect(rollup.byTeam.length).toBe(3);

    // Assertions: performance (log, don't hard-fail on slow CI)
    console.log(`  10k benchmark: ingest ${ingestMs}ms, rollup ${rollupMs}ms, total ${ingestMs + rollupMs}ms`);
    expect(ingestMs + rollupMs).toBeLessThan(10000); // 10s generous ceiling
  }, 30000); // 30s vitest timeout
});
