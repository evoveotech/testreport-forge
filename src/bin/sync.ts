#!/usr/bin/env node

/**
 * evoveo-smart-reporter-sync — batch sync CLI for CI pipeline sources (ADR-009).
 *
 * Pulls test artifacts from configured CI connectors (Azure DevOps, GitHub
 * Actions, etc.), classifies them via the rules engine, and ingests them
 * through the existing IngestService → Store. Designed to be run on a
 * schedule (cron / k8s CronJob / Windows Task Scheduler / Azure DevOps
 * pipeline).
 *
 * Usage:
 *   evoveo-smart-reporter-sync run [--config <path>] [--connector <id>] [--since <iso>]
 *   evoveo-smart-reporter-sync validate [--config <path>]
 *   evoveo-smart-reporter-sync list [--config <path>]
 *
 * Options:
 *   --config <path>       Path to pipeline-sources.yaml (default: ./pipeline-sources.yaml)
 *   --data-dir <path>     Directory for the run store (default: ./data)
 *   --connector <id>      Sync only the named connector
 *   --since <iso>         Override the incremental cursor (ISO timestamp)
 *   --artifact-dir <path> Where to persist raw artifacts (default: <dataDir>/artifacts)
 *   --quarantine-dir <path> Where to quarantine unmatched runs (default: <dataDir>/quarantine)
 *   -h, --help            Show this help
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileStore } from '../store';
import { IngestService } from '../ingest';
import {
  ClassificationEngine,
  SyncState,
  SyncOrchestrator,
  createSource,
} from '../pipeline-sources';
import type {
  PipelineSourcesConfig,
  AnySourceConfig,
  ClassificationRule,
} from '../pipeline-sources';

interface CliOptions {
  config: string;
  dataDir: string;
  connectorId: string | null;
  since: string | undefined;
  artifactDir: string;
  quarantineDir: string;
}

function printUsage(): void {
  console.log(`
Usage: evoveo-smart-reporter-sync <command> [options]

Commands:
  run        Sync test runs from configured CI connectors
  validate   Validate the pipeline-sources config (rules + connectors)
  list       List configured connectors and classification rules

Options:
  --config <path>         Config file (default: ./pipeline-sources.yaml)
  --data-dir <path>       Run store directory (default: ./data)
  --connector <id>        Sync only the named connector
  --since <iso>           Override incremental cursor (ISO timestamp)
  --artifact-dir <path>   Raw artifact persistence (default: <dataDir>/artifacts)
  --quarantine-dir <path> Quarantine dir (default: <dataDir>/quarantine)
  -h, --help              Show this help
`);
}

function parseArgs(argv: string[]): { command: string; opts: CliOptions } {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  const command = args[0];
  const opts: CliOptions = {
    config: path.resolve(process.cwd(), 'pipeline-sources.yaml'),
    dataDir: path.resolve(process.cwd(), 'data'),
    connectorId: null,
    since: undefined,
    artifactDir: '',
    quarantineDir: '',
  };
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--config') opts.config = path.resolve(args[++i] ?? 'pipeline-sources.yaml');
    else if (arg === '--data-dir') opts.dataDir = path.resolve(args[++i] ?? 'data');
    else if (arg === '--connector') opts.connectorId = args[++i] ?? null;
    else if (arg === '--since') opts.since = args[++i];
    else if (arg === '--artifact-dir') opts.artifactDir = path.resolve(args[++i] ?? '');
    else if (arg === '--quarantine-dir') opts.quarantineDir = path.resolve(args[++i] ?? '');
  }
  opts.artifactDir = opts.artifactDir || path.join(opts.dataDir, 'artifacts');
  opts.quarantineDir = opts.quarantineDir || path.join(opts.dataDir, 'quarantine');
  return { command, opts };
}

/**
 * Load and parse the pipeline-sources config. Supports YAML (simple parser)
 * or JSON (if the file ends in .json).
 */
function loadConfig(configPath: string): PipelineSourcesConfig {
  if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.error('Create one with: evoveo-smart-reporter-sync init');
    process.exit(1);
  }
  const raw = fs.readFileSync(configPath, 'utf-8');
  try {
    if (configPath.endsWith('.json')) {
      return JSON.parse(raw);
    }
    // YAML: use a minimal parser. We support the subset we need.
    // For production, users can use .json to avoid YAML parsing limitations.
    return parseSimpleYaml(raw);
  } catch (e) {
    console.error(`Failed to parse config: ${(e as Error).message}`);
    process.exit(1);
  }
}

/**
 * Minimal YAML parser for the pipeline-sources config subset.
 * Supports nested maps, arrays, and scalar values. Not a full YAML parser.
 * For complex configs, use .json format.
 */
function parseSimpleYaml(raw: string): PipelineSourcesConfig {
  // For now, delegate to JSON if the content looks like JSON.
  // A full YAML parser would require a dependency; we avoid that (ADR-002).
  // Users can write config as .json or use a YAML→JSON preprocessor.
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      'YAML parsing requires a .json config file (set --config to a .json file), ' +
      'or pre-convert your YAML to JSON. This avoids adding a YAML dependency (ADR-002).',
    );
  }
}

async function runSync(opts: CliOptions): Promise<void> {
  const config = loadConfig(opts.config);
  const store = new FileStore(opts.dataDir);
  await store.open();
  const ingestService = new IngestService(store);
  const classifier = new ClassificationEngine(config.classificationRules ?? []);
  const syncState = new SyncState(opts.dataDir);
  await syncState.load();

  const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
    artifactDir: opts.artifactDir,
    quarantineDir: opts.quarantineDir,
    since: opts.since,
  });

  const connectors = opts.connectorId
    ? config.connectors.filter(c => c.id === opts.connectorId)
    : config.connectors;

  if (connectors.length === 0) {
    console.error(opts.connectorId
      ? `No connector found with id "${opts.connectorId}"`
      : 'No connectors configured');
    process.exit(1);
  }

  for (const connConfig of connectors) {
    console.log(`\nSyncing connector: ${connConfig.id} (${connConfig.kind})...`);
    try {
      const source = createSource(connConfig);
      const result = await orchestrator.syncConnector(source);
      console.log(`  Discovered: ${result.discovered}`);
      console.log(`  Ingested:   ${result.ingested}`);
      console.log(`  Rejected:   ${result.rejected}`);
      console.log(`  Quarantined:${result.quarantined}`);
      if (result.errors.length > 0) {
        console.log(`  Errors:`);
        for (const e of result.errors) console.log(`    - ${e}`);
      }
    } catch (e) {
      console.error(`  FAILED: ${(e as Error).message}`);
    }
  }

  await syncState.save();
  await store.close();
  console.log('\nSync complete.');
}

function runValidate(opts: CliOptions): void {
  const config = loadConfig(opts.config);
  const errors: string[] = [];

  // Validate connectors (config comes from JSON at runtime — types aren't guaranteed)
  for (const c of (config.connectors ?? []) as any[]) {
    if (!c.id) errors.push(`connector: id is required`);
    if (!c.kind) errors.push(`connector ${c.id}: kind is required`);
    // Local source doesn't need auth; all other kinds do.
    if (c.kind !== 'local') {
      if (!c.auth) errors.push(`connector ${c.id}: auth is required`);
      if (c.auth && !c.auth.method) errors.push(`connector ${c.id}: auth.method is required`);
    }
  }

  // Validate classification rules
  const ruleErrors = ClassificationEngine.validateRules(config.classificationRules ?? []);
  errors.push(...ruleErrors);

  // Check that each connector has at least one rule that could match it
  for (const c of config.connectors ?? []) {
    const hasRule = (config.classificationRules ?? []).some(
      r => !r.match.connector || r.match.connector === c.id,
    );
    if (!hasRule) {
      console.warn(`WARNING: connector "${c.id}" has no classification rules that reference it`);
    }
  }

  if (errors.length > 0) {
    console.error('Validation failed:');
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('Config is valid.');
  console.log(`  Connectors: ${config.connectors?.length ?? 0}`);
  console.log(`  Rules:      ${config.classificationRules?.length ?? 0}`);
}

function runList(opts: CliOptions): void {
  const config = loadConfig(opts.config);
  console.log('Connectors:');
  for (const c of config.connectors ?? []) {
    console.log(`  ${c.id} (${c.kind})`);
    if (c.auth) console.log(`    auth: ${c.auth.method}`);
  }
  console.log('\nClassification rules:');
  (config.classificationRules ?? []).forEach((r, i) => {
    const match = Object.entries(r.match).map(([k, v]) => `${k}=${v}`).join(', ');
    console.log(`  [${i}] match: ${match}`);
    console.log(`       -> ${r.orgContext.tenantId}/${r.orgContext.client}/${r.orgContext.product}/${r.orgContext.team} (${r.orgContext.stack}, ${r.orgContext.runType})`);
  });
}

async function main(): Promise<void> {
  const { command, opts } = parseArgs(process.argv);
  switch (command) {
    case 'run': await runSync(opts); break;
    case 'validate': runValidate(opts); break;
    case 'list': runList(opts); break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch(e => {
  console.error(`Fatal: ${(e as Error).message}`);
  process.exit(1);
});
