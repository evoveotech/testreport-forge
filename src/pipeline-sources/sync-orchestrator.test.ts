import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from '../store';
import { IngestService } from '../ingest';
import { ClassificationEngine } from './classification-engine';
import { SyncState, composeRunKey } from './sync-state';
import { SyncOrchestrator } from './sync-orchestrator';
import type {
  PipelineSource,
  PipelineRunRef,
  DownloadedArtifact,
  PipelineRunMetadata,
  ClassificationRule,
} from './types';

// A JUnit XML artifact with 3 tests (2 passed, 1 failed)
const JUNIT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="payments-suite" tests="3" failures="1" time="5000">
    <testcase classname="payments" name="test_pay" time="1000"/>
    <testcase classname="payments" name="test_refund" time="2000"/>
    <testcase classname="payments" name="test_fail" time="2000">
      <failure message="assertion error">expected 200 got 500</failure>
    </testcase>
  </testsuite>
</testsuites>`;

/** Stub source that returns a fixed set of runs with JUnit XML artifacts. */
class StubSource implements PipelineSource {
  readonly id: string;
  readonly kind = 'azure-devops' as const;
  constructor(id: string, private readonly refs: PipelineRunRef[]) {
    this.id = id;
  }
  async listRuns(): Promise<PipelineRunRef[]> { return [...this.refs]; }
  async downloadArtifact(ref: PipelineRunRef): Promise<DownloadedArtifact> {
    return { content: JUNIT_XML, format: 'junit', ext: 'xml' };
  }
  async fetchRunMetadata(ref: PipelineRunRef): Promise<PipelineRunMetadata> {
    return {
      ciRunId: ref.ciRunId,
      provider: 'azure-devops',
      commit: ref.commit,
      branch: ref.branch,
      trigger: 'push',
      ciRunUrl: ref.ciRunUrl,
    };
  }
}

/** Source that produces a run with no matching classification rule. */
class UnmatchedStubSource implements PipelineSource {
  readonly id = 'unmatched-connector';
  readonly kind = 'gitlab' as const;
  constructor(private readonly refs: PipelineRunRef[]) {}
  async listRuns(): Promise<PipelineRunRef[]> { return [...this.refs]; }
  async downloadArtifact(): Promise<DownloadedArtifact> {
    return { content: JUNIT_XML, format: 'junit', ext: 'xml' };
  }
  async fetchRunMetadata(ref: PipelineRunRef): Promise<PipelineRunMetadata> {
    return { ciRunId: ref.ciRunId, provider: 'gitlab' };
  }
}

const rules: ClassificationRule[] = [
  {
    match: { connector: 'azure-acme', repoName: '^payments-(.+)$' },
    orgContext: {
      tenantId: 'acme',
      client: 'internal',
      product: 'payments-${1}',
      team: 'payments-qa',
      stack: 'dotnet',
      runType: 'nightly',
      environment: 'ci',
    },
  },
];

describe('SyncOrchestrator', () => {
  let tmpDir: string;
  let store: FileStore;
  let ingestService: IngestService;
  let classifier: ClassificationEngine;
  let syncState: SyncState;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
    store = new FileStore(tmpDir);
    await store.open();
    ingestService = new IngestService(store);
    classifier = new ClassificationEngine(rules);
    syncState = new SyncState(tmpDir);
    await syncState.load();
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ingests a matching run with correct OrgContext + composite-key idempotency', async () => {
    const source = new StubSource('azure-acme', [
      {
        ciRunId: '42',
        occurredAt: '2026-08-09T10:00:00Z',
        repoName: 'payments-gateway',
        branch: 'main',
        commit: 'abc123',
        ciRunUrl: 'https://dev.azure.com/acme/Payments/_build/results?buildId=42',
      },
    ]);
    const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
      artifactDir: path.join(tmpDir, 'artifacts'),
      quarantineDir: path.join(tmpDir, 'quarantine'),
      skipArtifactPersistence: true,
    });

    const result = await orchestrator.syncConnector(source);
    expect(result.discovered).toBe(1);
    expect(result.ingested).toBe(1);
    expect(result.quarantined).toBe(0);

    // Verify the run landed in the store with the composite key + correct OrgContext
    const runs = await store.queryRuns({ tenantId: 'acme' });
    expect(runs.length).toBe(1);
    expect(runs[0].runId).toBe(composeRunKey('azure-acme', 'payments-gateway', '42'));
    expect(runs[0].orgContext.product).toBe('payments-gateway');
    expect(runs[0].orgContext.team).toBe('payments-qa');
    expect(runs[0].total).toBe(3);
    expect(runs[0].passed).toBe(2);
    expect(runs[0].failed).toBe(1);
    expect(runs[0].ciInfo?.provider).toBe('azure-devops');
    expect(runs[0].ciInfo?.commit).toBe('abc123');
  });

  it('re-syncing the same CI run is idempotent (no duplicate)', async () => {
    const source = new StubSource('azure-acme', [
      { ciRunId: '42', occurredAt: '2026-08-09T10:00:00Z', repoName: 'payments-gateway' },
    ]);
    const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
      artifactDir: path.join(tmpDir, 'artifacts'),
      quarantineDir: path.join(tmpDir, 'quarantine'),
      skipArtifactPersistence: true,
    });

    await orchestrator.syncConnector(source);
    await orchestrator.syncConnector(source); // re-sync

    const runs = await store.queryRuns({ tenantId: 'acme' });
    expect(runs.length).toBe(1); // still 1, not 2
  });

  it('quarantines a run that matches no classification rule (never silently ingests)', async () => {
    const source = new UnmatchedStubSource([
      { ciRunId: '99', occurredAt: '2026-08-09T10:00:00Z', repoName: 'unknown-repo' },
    ]);
    const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
      artifactDir: path.join(tmpDir, 'artifacts'),
      quarantineDir: path.join(tmpDir, 'quarantine'),
      skipArtifactPersistence: true,
    });

    const result = await orchestrator.syncConnector(source);
    expect(result.discovered).toBe(1);
    expect(result.ingested).toBe(0);
    expect(result.quarantined).toBe(1);

    // Verify nothing was ingested
    const runs = await store.queryRuns({ tenantId: 'acme' });
    expect(runs.length).toBe(0);

    // Verify the quarantine file was written
    const quarantineFile = path.join(tmpDir, 'quarantine', 'unmatched-connector', 'unknown-repo', '99.json');
    expect(fs.existsSync(quarantineFile)).toBe(true);
    const meta = JSON.parse(fs.readFileSync(quarantineFile, 'utf-8'));
    expect(meta.repoName).toBe('unknown-repo');
    expect(meta.reason).toContain('no classification rule matched');
  });

  it('persists raw artifacts to artifact-dir when not skipped', async () => {
    const source = new StubSource('azure-acme', [
      { ciRunId: '42', occurredAt: '2026-08-09T10:00:00Z', repoName: 'payments-gateway' },
    ]);
    const artifactDir = path.join(tmpDir, 'artifacts');
    const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
      artifactDir,
      quarantineDir: path.join(tmpDir, 'quarantine'),
    });

    await orchestrator.syncConnector(source);

    const artifactFile = path.join(artifactDir, 'azure-acme', 'payments-gateway', '42.xml');
    expect(fs.existsSync(artifactFile)).toBe(true);
    const content = fs.readFileSync(artifactFile, 'utf-8');
    expect(content).toContain('<testsuite');
  });

  it('records sync state (last-sync cursor) after a successful sync', async () => {
    const source = new StubSource('azure-acme', [
      { ciRunId: '42', occurredAt: '2026-08-09T10:00:00Z', repoName: 'payments-gateway' },
    ]);
    const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
      artifactDir: path.join(tmpDir, 'artifacts'),
      quarantineDir: path.join(tmpDir, 'quarantine'),
      skipArtifactPersistence: true,
    });

    await orchestrator.syncConnector(source);
    await syncState.save();

    // Reload sync state and verify the cursor was recorded
    const reloaded = new SyncState(tmpDir);
    await reloaded.load();
    const lastSync = reloaded.getLastSyncAt('azure-acme');
    expect(lastSync).toBeDefined();
    expect(reloaded.getAll()['azure-acme'].lastRunCount).toBe(1);
  });

  it('handles listRuns failure gracefully (records error, returns empty result)', async () => {
    const failingSource: PipelineSource = {
      id: 'broken',
      kind: 'azure-devops',
      async listRuns() { throw new Error('API rate limited'); },
      async downloadArtifact() { throw new Error('not reached'); },
      async fetchRunMetadata() { throw new Error('not reached'); },
    };
    const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
      artifactDir: path.join(tmpDir, 'artifacts'),
      quarantineDir: path.join(tmpDir, 'quarantine'),
      skipArtifactPersistence: true,
    });

    const result = await orchestrator.syncConnector(failingSource);
    expect(result.discovered).toBe(0);
    expect(result.ingested).toBe(0);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0]).toContain('API rate limited');
  });

  it('handles multiple runs with mixed match/unmatch outcomes', async () => {
    const source = new StubSource('azure-acme', [
      { ciRunId: '1', occurredAt: '2026-08-09T10:00:00Z', repoName: 'payments-gateway' },
      { ciRunId: '2', occurredAt: '2026-08-09T11:00:00Z', repoName: 'unknown-repo' },
      { ciRunId: '3', occurredAt: '2026-08-09T12:00:00Z', repoName: 'payments-api' },
    ]);
    const orchestrator = new SyncOrchestrator(store, ingestService, classifier, syncState, {
      artifactDir: path.join(tmpDir, 'artifacts'),
      quarantineDir: path.join(tmpDir, 'quarantine'),
      skipArtifactPersistence: true,
    });

    const result = await orchestrator.syncConnector(source);
    expect(result.discovered).toBe(3);
    expect(result.ingested).toBe(2);   // payments-gateway + payments-api
    expect(result.quarantined).toBe(1); // unknown-repo

    const runs = await store.queryRuns({ tenantId: 'acme' });
    expect(runs.length).toBe(2);
    const products = runs.map(r => r.orgContext.product).sort();
    expect(products).toEqual(['payments-api', 'payments-gateway']);
  });
});
