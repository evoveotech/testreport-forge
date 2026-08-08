#!/usr/bin/env node

import * as http from 'http';
import * as path from 'path';
import { FileStore } from '../store';
import { IngestService, startIngestServer, FileDropWatcher } from '../ingest';

interface IngestOptions {
  dataDir: string;
  port: number;
  watchDir: string | null;
}

function printUsage(): void {
  console.log(`
Usage: evoveo-smart-reporter-ingest [options]

Runs the leadership platform ingestion service: an HTTP endpoint that
accepts normalized test runs from any CI pipeline in the estate, plus an
optional file-drop watcher for legacy / air-gapped systems.

Endpoints:
  POST /runs    Ingest a run payload (IngestPayload JSON)
  GET  /health  Health check

Options:
  --data-dir <path>   Directory for the run store (default: ./data)
  --port <port>       HTTP port (default: 0 = auto-assign)
  --watch <path>      Directory to watch for dropped JSON payloads
                      (legacy / air-gapped ingestion; ADR-007)
  --no-http           Disable the HTTP server (file-drop only)
  -h, --help          Show this help

Payload shape (POST /runs body):
  {
    "orgContext": {
      "tenantId": "acme", "client": "c1", "product": "p1",
      "team": "t1", "stack": "junit", "runType": "nightly",
      "environment": "ci"
    },
    "format": "junit",
    "rawArtifact": "<testsuite>...</testsuite>"
  }
  -- or, for a pre-normalized run --
  {
    "orgContext": { ... },
    "run": { "runId": "r1", "timestamp": "...", "total": 10, ... }
  }
`);
}

function parseArgs(argv: string[]): IngestOptions & { http: boolean } {
  const args = argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }
  const opts: IngestOptions & { http: boolean } = {
    dataDir: path.resolve(process.cwd(), 'data'),
    port: 0,
    watchDir: null,
    http: true,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--data-dir') opts.dataDir = path.resolve(args[++i] ?? 'data');
    else if (arg === '--port') opts.port = parseInt(args[++i] ?? '0', 10);
    else if (arg === '--watch') opts.watchDir = path.resolve(args[++i] ?? 'drop');
    else if (arg === '--no-http') opts.http = false;
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);
  const store = new FileStore(opts.dataDir);
  await store.open();
  const service = new IngestService(store);

  let server: http.Server | null = null;
  if (opts.http) {
    server = startIngestServer(service, opts.port);
    const addr = server.address();
    const actualPort = typeof addr === 'object' && addr ? addr.port : opts.port;
    console.log(`evoveo-smart-reporter-ingest listening on http://localhost:${actualPort}`);
    console.log(`  POST /runs   - ingest a run`);
    console.log(`  GET  /health - health check`);
  }

  let watcher: FileDropWatcher | null = null;
  if (opts.watchDir) {
    watcher = new FileDropWatcher(opts.watchDir, service);
    watcher.start();
    console.log(`  watching ${opts.watchDir} for dropped JSON payloads (legacy / air-gapped)`);
  }

  if (!server && !watcher) {
    console.error('Nothing to do: no HTTP server and no watch dir. Use --port or --watch.');
    process.exit(1);
  }

  const shutdown = async () => {
    if (watcher) watcher.stop();
    if (server) server.close();
    await store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
