/**
 * Sync state — idempotency cursor + composite-key dedup (ADR-009).
 *
 * The sync orchestrator persists a last-sync timestamp per connector to
 * `<dataDir>/sync-state.json`, so subsequent syncs are incremental. Run
 * identity is a composite key `${connectorId}:${ciRunId}`; re-syncing the
 * same CI run is an upsert no-op (the store's insertRun overwrites by runId).
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ConnectorSyncState {
  lastSyncAt: string;       // ISO timestamp of the last successful sync
  lastRunCount: number;     // runs discovered in the last sync
  lastError?: string;       // last error message (if sync failed)
}

export type SyncStateMap = Record<string, ConnectorSyncState>; // keyed by connectorId

export class SyncState {
  private readonly stateFile: string;
  private state: SyncStateMap = {};

  constructor(dataDir: string) {
    this.stateFile = path.join(dataDir, 'sync-state.json');
  }

  async load(): Promise<void> {
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf-8');
      this.state = JSON.parse(raw);
    } catch {
      this.state = {};
    }
  }

  async save(): Promise<void> {
    fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  getLastSyncAt(connectorId: string): string | undefined {
    return this.state[connectorId]?.lastSyncAt;
  }

  recordSync(connectorId: string, runCount: number, error?: string): void {
    this.state[connectorId] = {
      lastSyncAt: new Date().toISOString(),
      lastRunCount: runCount,
      lastError: error,
    };
  }

  getAll(): SyncStateMap {
    return { ...this.state };
  }
}

/**
 * Compose the store run key: `${connectorId}:${repoName}:${ciRunId}`. This is
 * the idempotency key — re-syncing the same CI run produces the same runId, so
 * the store upserts (overwrites) rather than duplicating.
 *
 * repoName is included because ciRunId is NOT unique across repos within a
 * single connector (e.g. GitHub Actions run IDs are unique per-repo, not
 * globally; Azure DevOps build IDs are unique per-project, not per-org).
 */
export function composeRunKey(connectorId: string, repoName: string, ciRunId: string): string {
  return `${connectorId}:${repoName}:${ciRunId}`;
}
