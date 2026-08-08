#!/usr/bin/env node
/**
 * Seeds the local FileStore with realistic multi-team, multi-stack sample data
 * so the leadership dashboard looks populated for demos and testing.
 *
 * Run: node dist/bin/seed-data.js --data-dir ./data
 */
import * as path from 'path';
import * as fs from 'fs';
import { FileStore } from '../store';
import type { IngestedRun, OrgContext } from '../types';

interface SeedOpts { dataDir: string; tenantId: string; }

function parseArgs(argv: string[]): SeedOpts {
  const args = argv.slice(2);
  const opts: SeedOpts = { dataDir: path.resolve(process.cwd(), 'data'), tenantId: 'acme' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data-dir') opts.dataDir = path.resolve(args[++i] ?? 'data');
    if (args[i] === '--tenant') opts.tenantId = args[++i] ?? 'acme';
  }
  return opts;
}

const CLIENTS = [
  { client: 'fiserv-payments', products: ['payments-gateway', 'card-linker', 'settlement-engine'] },
  { client: 'globalbank-core', products: ['core-banking', 'loan-origination', 'kyc-verify'] },
  { client: 'retailcorp-mobile', products: ['mobile-checkout', 'loyalty-app', 'instore-pos'] },
  { client: 'healthcare-platform', products: ['patient-portal', 'fhir-api', 'claims-engine'] },
  { client: 'insuretech-bff', products: ['quote-bff', 'policy-service', 'claim-tracker'] },
];

const STACKS = ['playwright', 'junit', 'dotnet-trx', 'newman', 'cypress', 'xctest', 'espresso', 'selenium'];
const TEAMS = ['qa-payments', 'qa-banking', 'qa-mobile', 'qa-healthcare', 'qa-insurance', 'qa-platform'];
const ENVIRONMENTS = ['dev', 'staging', 'prod', 'ci'];
const RUN_TYPES: OrgContext['runType'][] = ['pr', 'nightly', 'daily', 'scheduled'];

function randomFrom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateRun(tenantId: string, daysAgo: number, index: number): IngestedRun {
  const clientDef = randomFrom(CLIENTS);
  const product = randomFrom(clientDef.products);
  const stack = randomFrom(STACKS);
  const team = randomFrom(TEAMS);
  const env = randomFrom(ENVIRONMENTS);
  const runType = randomFrom(RUN_TYPES);
  const total = randomInt(50, 800);
  const basePassRate = randomInt(75, 99);
  const passed = Math.round((total * basePassRate) / 100);
  const failed = total - passed - randomInt(0, 10);
  const skipped = total - passed - Math.max(failed, 0);
  const flaky = randomInt(0, Math.round(total * 0.05));
  const slow = randomInt(0, Math.round(total * 0.03));
  const d = new Date(Date.now() - daysAgo * 86400000 - randomInt(0, 80000000));

  return {
    runId: `run-${d.toISOString().split('T')[0]}-${index.toString().padStart(4, '0')}`,
    timestamp: d.toISOString(),
    total,
    passed: Math.max(passed, 0),
    failed: Math.max(failed, 0),
    skipped: Math.max(skipped, 0),
    flaky,
    slow,
    duration: randomInt(30000, 900000),
    passRate: Math.round((Math.max(passed, 0) / total) * 1000) / 10,
    orgContext: {
      tenantId,
      client: clientDef.client,
      product,
      team,
      stack,
      runType,
      environment: env,
    },
    ingestedAt: d.toISOString(),
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  fs.mkdirSync(opts.dataDir, { recursive: true });
  const store = new FileStore(opts.dataDir);
  await store.open();

  // Generate 500 runs across the last 30 days.
  const runs: IngestedRun[] = [];
  for (let i = 0; i < 500; i++) {
    const daysAgo = Math.floor(i / 17); // ~17 runs per day
    runs.push(generateRun(opts.tenantId, daysAgo, i));
  }

  for (const run of runs) {
    await store.insertRun(run);
  }

  console.log(`Seeded ${runs.length} runs for tenant "${opts.tenantId}" in ${opts.dataDir}`);
  console.log(`  Clients: ${CLIENTS.length}, Teams: ${TEAMS.length}, Stacks: ${STACKS.length}`);
  console.log(`  Date range: last 30 days`);
  await store.close();
}

main().catch(err => { console.error(err); process.exit(1); });
