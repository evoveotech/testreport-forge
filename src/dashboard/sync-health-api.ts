/**
 * Sync Health API — the trust layer for the CI pipeline-sources feature (ADR-009).
 *
 * Serves per-connector sync status (last sync time, runs pulled, failures, auth
 * errors, staleness alerts) so leaders can verify the dashboard data is
 * complete and current. The #1 failure mode of an aggregated leadership
 * dashboard is silent staleness — a team's pipeline stops reporting and nobody
 * notices. This surface makes staleness visible.
 *
 * Routes:
 *   GET /api/sync/health       Overall sync health summary
 *   GET /api/sync/connectors   Per-connector sync status
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { SyncStateMap, ConnectorSyncState } from '../pipeline-sources';

export interface ConnectorHealth {
  connectorId: string;
  lastSyncAt: string | null;
  lastRunCount: number;
  lastError: string | null;
  /** Minutes since last sync (null if never synced). */
  minutesSinceSync: number | null;
  /** Staleness alert: true if last sync is older than the threshold. */
  stale: boolean;
}

export interface SyncHealthSummary {
  connectorCount: number;
  healthyCount: number;
  staleCount: number;
  errorCount: number;
  neverSyncedCount: number;
  connectors: ConnectorHealth[];
}

/** Default staleness threshold: 25 hours (daily sync + 1h grace). */
const DEFAULT_STALENESS_THRESHOLD_MIN = 25 * 60;

export class SyncHealthApi {
  private readonly stateFile: string;
  private readonly stalenessThresholdMin: number;

  constructor(dataDir: string, stalenessThresholdMin = DEFAULT_STALENESS_THRESHOLD_MIN) {
    this.stateFile = path.join(dataDir, 'sync-state.json');
    this.stalenessThresholdMin = stalenessThresholdMin;
  }

  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (url === '/api/sync/health' && method === 'GET') {
      const summary = this.getHealthSummary();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summary));
      return true;
    }

    if (url === '/api/sync/connectors' && method === 'GET') {
      const state = this.loadState();
      const connectors = Object.entries(state).map(([id, s]) => this.toHealth(id, s));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(connectors));
      return true;
    }

    return false;
  }

  private getHealthSummary(): SyncHealthSummary {
    const state = this.loadState();
    const connectors = Object.entries(state).map(([id, s]) => this.toHealth(id, s));
    return {
      connectorCount: connectors.length,
      healthyCount: connectors.filter(c => !c.stale && !c.lastError).length,
      staleCount: connectors.filter(c => c.stale).length,
      errorCount: connectors.filter(c => c.lastError).length,
      neverSyncedCount: connectors.filter(c => c.lastSyncAt === null).length,
      connectors,
    };
  }

  private toHealth(connectorId: string, state: ConnectorSyncState): ConnectorHealth {
    const lastSyncAt = state.lastSyncAt;
    let minutesSinceSync: number | null = null;
    if (lastSyncAt) {
      minutesSinceSync = Math.floor((Date.now() - new Date(lastSyncAt).getTime()) / 60000);
    }
    return {
      connectorId,
      lastSyncAt,
      lastRunCount: state.lastRunCount,
      lastError: state.lastError ?? null,
      minutesSinceSync,
      stale: minutesSinceSync !== null && minutesSinceSync > this.stalenessThresholdMin,
    };
  }

  private loadState(): SyncStateMap {
    try {
      const raw = fs.readFileSync(this.stateFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}
