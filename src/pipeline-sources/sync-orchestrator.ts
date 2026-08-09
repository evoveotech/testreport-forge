/**
 * Sync orchestrator (ADR-009) — the core pull loop.
 *
 * For each configured connector:
 *   1. listRuns(since) — discover CI runs since the last sync cursor
 *   2. For each run:
 *      a. downloadArtifact(ref) — fetch the test artifact file
 *      b. classify(ref) — resolve OrgContext via the classification-rules engine
 *         (no match → quarantine, never silently ingest; ADR-005 amended)
 *      c. fetchRunMetadata(ref) — enrich with commit/branch/trigger/CI-run-URL
 *      d. IngestService.ingest(payload) — route through adapters → Store
 *      e. Persist raw artifact to --artifact-dir for audit/compliance
 *   3. Record sync state (last-sync cursor) for incremental sync
 *
 * Idempotency: composite key `${connectorId}:${ciRunId}` → re-sync = upsert.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Store } from '../store';
import { IngestService } from '../ingest';
import type { IngestPayload, CIInfo } from '../types';
import type {
  PipelineSource,
  PipelineRunRef,
  PipelineRunMetadata,
  SyncResult,
  SyncRunOutcome,
} from './types';
import { ClassificationEngine } from './classification-engine';
import type { ClassificationInput } from './classification-engine';
import { SyncState, composeRunKey } from './sync-state';

export interface SyncOrchestratorOptions {
  /** Directory for raw artifact persistence (audit/compliance). */
  artifactDir: string;
  /** Directory for quarantined runs (no classification rule matched). */
  quarantineDir: string;
  /** Override the `since` cursor (ISO timestamp). If omitted, uses sync-state. */
  since?: string;
  /** Skip artifact persistence (useful for tests). */
  skipArtifactPersistence?: boolean;
}

export class SyncOrchestrator {
  constructor(
    private readonly store: Store,
    private readonly ingestService: IngestService,
    private readonly classifier: ClassificationEngine,
    private readonly syncState: SyncState,
    private readonly options: SyncOrchestratorOptions,
  ) {}

  /**
   * Sync a single connector. Returns the outcome summary.
   */
  async syncConnector(source: PipelineSource): Promise<SyncResult> {
    const startedAt = new Date().toISOString();
    const outcomes: SyncRunOutcome[] = [];
    const errors: string[] = [];

    // Determine the `since` cursor: explicit override > sync-state > undefined (backfill).
    const since = this.options.since ?? this.syncState.getLastSyncAt(source.id);

    let refs: PipelineRunRef[] = [];
    try {
      refs = await source.listRuns(since);
    } catch (e) {
      errors.push(`listRuns failed: ${(e as Error).message}`);
      this.syncState.recordSync(source.id, 0, (e as Error).message);
      return {
        connectorId: source.id,
        startedAt,
        finishedAt: new Date().toISOString(),
        discovered: 0,
        ingested: 0,
        rejected: 0,
        quarantined: 0,
        errors,
        outcomes,
      };
    }

    let ingested = 0;
    let rejected = 0;
    let quarantined = 0;

    for (const ref of refs) {
      const outcome = await this.syncOneRun(source, ref);
      outcomes.push(outcome);
      if (outcome.accepted) ingested++;
      else if (outcome.quarantined) quarantined++;
      else rejected++;
    }

    this.syncState.recordSync(source.id, refs.length, errors.length > 0 ? errors.join('; ') : undefined);

    return {
      connectorId: source.id,
      startedAt,
      finishedAt: new Date().toISOString(),
      discovered: refs.length,
      ingested,
      rejected,
      quarantined,
      errors,
      outcomes,
    };
  }

  /**
   * Sync a single run: download → classify → ingest (or quarantine).
   */
  private async syncOneRun(source: PipelineSource, ref: PipelineRunRef): Promise<SyncRunOutcome> {
    const compositeKey = composeRunKey(source.id, ref.repoName, ref.ciRunId);

    // 1. Classify — resolve OrgContext from CI structure via rules engine.
    const classInput: ClassificationInput = {
      connectorId: source.id,
      kind: source.kind,
      repoName: ref.repoName,
      project: ref.project,
      branch: ref.branch,
    };
    const classification = this.classifier.classify(classInput);
    if (!classification.matched) {
      // No rule matched → quarantine (never silently ingest; ADR-005 amended).
      await this.quarantineRun(source, ref, classification.reason);
      return {
        connectorId: source.id,
        ciRunId: ref.ciRunId,
        accepted: false,
        reason: classification.reason,
        quarantined: true,
      };
    }

    // 2. Download the test artifact.
    let artifact;
    try {
      artifact = await source.downloadArtifact(ref);
    } catch (e) {
      const reason = `downloadArtifact failed: ${(e as Error).message}`;
      return { connectorId: source.id, ciRunId: ref.ciRunId, accepted: false, reason };
    }

    // 3. Fetch run metadata (commit, branch, trigger, CI-run-URL).
    let metadata: PipelineRunMetadata | undefined;
    try {
      metadata = await source.fetchRunMetadata(ref);
    } catch (e) {
      // Metadata is enrichment — don't fail the whole run if it errors.
      // Proceed without it; the run still has its summary from the adapter.
    }

    // 4. Persist raw artifact for audit/compliance.
    let rawArtifactPath: string | undefined;
    if (!this.options.skipArtifactPersistence) {
      rawArtifactPath = await this.persistArtifact(source, ref, artifact.content, artifact.ext);
    }

    // 5. Build IngestPayload and ingest through the existing IngestService.
    const ciInfo: CIInfo = {
      provider: source.kind,
      branch: metadata?.branch ?? ref.branch,
      commit: metadata?.commit ?? ref.commit,
      buildId: ref.ciRunId,
      ciRunUrl: metadata?.ciRunUrl,
    };
    const payload: IngestPayload = {
      orgContext: classification.orgContext,
      format: artifact.format,
      rawArtifact: artifact.content,
      rawArtifactPath,
      runIdOverride: compositeKey,  // composite key for idempotency (ADR-009)
      ciInfo,                       // CI provenance for dashboard drilldown
      occurredAt: metadata?.occurredAt ?? ref.occurredAt,  // real test execution time
    };

    const result = await this.ingestService.ingest(payload);
    if (!result.accepted) {
      return {
        connectorId: source.id,
        ciRunId: ref.ciRunId,
        accepted: false,
        reason: result.errors?.join('; '),
      };
    }

    return {
      connectorId: source.id,
      ciRunId: ref.ciRunId,
      accepted: true,
      runId: result.runId,
    };
  }

  /**
   * Persist a raw artifact to the artifact-dir for audit/compliance.
   * Path: <artifactDir>/<connectorId>/<repoName>/<ciRunId>.<ext>
   */
  private async persistArtifact(
    source: PipelineSource,
    ref: PipelineRunRef,
    content: string,
    ext?: string,
  ): Promise<string> {
    const dir = path.join(this.options.artifactDir, source.id, ref.repoName);
    fs.mkdirSync(dir, { recursive: true });
    const fileExt = ext ?? 'xml';
    const filePath = path.join(dir, `${ref.ciRunId}.${fileExt}`);
    fs.writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  /**
   * Quarantine a run that matched no classification rule. Writes the run ref
   * + raw artifact (if downloadable) to the quarantine-dir for human review.
   */
  private async quarantineRun(source: PipelineSource, ref: PipelineRunRef, reason: string): Promise<void> {
    const dir = path.join(this.options.quarantineDir, source.id, ref.repoName);
    fs.mkdirSync(dir, { recursive: true });
    const meta = {
      connectorId: source.id,
      ciRunId: ref.ciRunId,
      repoName: ref.repoName,
      project: ref.project,
      branch: ref.branch,
      occurredAt: ref.occurredAt,
      ciRunUrl: ref.ciRunUrl,
      reason,
      quarantinedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(dir, `${ref.ciRunId}.json`),
      JSON.stringify(meta, null, 2),
      'utf-8',
    );
  }
}
