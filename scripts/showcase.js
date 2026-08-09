#!/usr/bin/env node

/**
 * showcase.js — one command to fetch real test data from open-source
 * GitHub repos, generate the pipeline config, sync into the store, and
 * start the dashboard.
 *
 * Flow:
 *   1. Fetch real test result files from 40+ GitHub repos (18+ tech stacks)
 *   2. Generate pipeline-sources.json with classification rules
 *   3. Sync: classify + ingest all runs into the store
 *   4. Start the dashboard on port 3211
 *
 * Usage: node scripts/showcase.js [--port 3211] [--skip-fetch]
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.argv.includes('--port')
  ? process.argv[process.argv.indexOf('--port') + 1]
  : '3211';
const SKIP_FETCH = process.argv.includes('--skip-fetch');

function run(step, cmd) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${step}`);
  console.log(`${'='.repeat(60)}\n`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

async function main() {
  // Step 1: Fetch real test data from GitHub (cleans test-ci-data first)
  if (!SKIP_FETCH) {
    run('STEP 1/4: Fetching real test data from GitHub', 'node scripts/fetch-real-test-data.js');
  } else {
    console.log('\nSkipping fetch (--skip-fetch)\n');
  }

  // Step 2: Generate pipeline-sources.json
  run('STEP 2/4: Generating pipeline config', 'node scripts/gen-pipeline-config.js');

  // Clean the store before sync (runs.jsonl is append-only, so we must
  // remove old data to avoid duplicates from previous runs)
  const storeDir = path.join(ROOT, 'test-data');
  if (fs.existsSync(storeDir)) {
    fs.rmSync(storeDir, { recursive: true });
    console.log('Cleaned old store data (test-data/)\n');
  }

  // Step 3: Build + sync
  run('STEP 3/4: Building + syncing runs into store', 'npm run build && node dist/bin/sync.js run --config pipeline-sources.json --data-dir test-data');

  // Step 4: Start dashboard (foreground — blocks until killed)
  run('STEP 4/4: Starting dashboard', `node dist/bin/dashboard.js --data-dir test-data --port ${PORT}`);
}

main().catch(e => {
  console.error(`\nShowcase failed: ${e.message}`);
  process.exit(1);
});
