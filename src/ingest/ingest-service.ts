import * as crypto from 'crypto';
import type {
  IngestPayload,
  IngestResult,
  IngestedRun,
  RunSummary,
  TestResultData,
  OrgContext,
} from '../types';
import type { Store } from '../store';
import { getAdapter, detectAdapter } from '../adapters';
import type { AdapterContext } from '../adapters';
import type { UsageMeter } from '../dashboard/usage-meter';

/**
 * Required OrgContext fields. Every one must be a non-empty string (and
 * runType must be a valid variant). This is the ingestion validation gate:
 * a run without explicit org context is rejected (ADR-005 -- never infer).
 */
const REQUIRED_CTX_FIELDS: Array<keyof OrgContext> = [
  'tenantId', 'client', 'product', 'team', 'stack', 'environment',
];
const VALID_RUN_TYPES: OrgContext['runType'][] = ['pr', 'nightly', 'daily', 'scheduled', 'manual'];

/**
 * The ingestion service. Receives normalized run payloads from any CI
 * pipeline in the estate, validates the org context, routes raw artifacts
 * through the existing adapters (ADR-001), computes a RunSummary, stamps the
 * OrgContext, and persists the run to the store.
 */
export class IngestService {
  constructor(
    private readonly store: Store,
    private readonly meter?: UsageMeter,
  ) {}

  /**
   * Ingest a single run payload. Returns an IngestResult indicating
   * acceptance (with runId) or rejection (with errors).
   */
  async ingest(payload: IngestPayload): Promise<IngestResult> {
    const errors = this.validate(payload);
    if (errors.length > 0) {
      return { accepted: false, runId: '', errors };
    }

    let summary: RunSummary;
    let rawArtifactPath = payload.rawArtifactPath;

    if (payload.run) {
      // Pre-normalized summary supplied directly.
      summary = { ...payload.run };
    } else if (payload.rawArtifact && payload.format) {
      // Raw artifact -- route through the existing adapter registry.
      const result = this.parseRaw(payload.rawArtifact, payload.format);
      if (!result.ok) {
        return { accepted: false, runId: '', errors: [result.error] };
      }
      if (result.results.length === 0) {
        // Adapters are lenient and return [] on garbage rather than throwing.
        // A zero-result raw parse is almost certainly a malformed artifact;
        // reject it so silent failures don't pollute the dashboard.
        return { accepted: false, runId: '', errors: ['adapter parsed 0 test results -- artifact may be malformed or empty'] };
      }
      summary = this.summaryFromResults(result.results, payload.format);
    } else {
      return { accepted: false, runId: '', errors: ['payload must include either run or rawArtifact+format'] };
    }

    const runId = summary.runId || this.generateRunId();
    const ingestedAt = new Date().toISOString();
    const run: IngestedRun = {
      ...summary,
      runId,
      orgContext: payload.orgContext,
      reportPath: payload.reportPath,
      rawArtifactPath,
      ingestedAt,
    };

    await this.store.insertRun(run);
    this.meter?.record({
      type: 'run_ingested',
      tenantId: run.orgContext.tenantId,
      timestamp: ingestedAt,
      runId,
    });
    return { accepted: true, runId };
  }

  /**
   * Validate an IngestPayload. Returns a list of human-readable errors;
   * empty list means valid.
   */
  validate(payload: IngestPayload): string[] {
    const errors: string[] = [];
    if (!payload.orgContext) {
      errors.push('orgContext is required');
      return errors;
    }
    const ctx = payload.orgContext;
    for (const field of REQUIRED_CTX_FIELDS) {
      if (!ctx[field] || typeof ctx[field] !== 'string' || ctx[field].trim() === '') {
        errors.push(`orgContext.${field} is required and must be a non-empty string`);
      }
    }
    if (!VALID_RUN_TYPES.includes(ctx.runType)) {
      errors.push(`orgContext.runType must be one of: ${VALID_RUN_TYPES.join(', ')}`);
    }
    if (!payload.run && !payload.rawArtifact) {
      errors.push('either run or rawArtifact must be provided');
    }
    if (payload.rawArtifact && !payload.format) {
      errors.push('format is required when rawArtifact is provided');
    }
    if (payload.run && payload.rawArtifact) {
      errors.push('provide either run or rawArtifact, not both');
    }
    return errors;
  }

  /**
   * Route a raw artifact through the adapter registry and return the
   * normalized TestResultData[] (ADR-001 -- reuse existing adapters).
   */
  private parseRaw(
    content: string,
    format: IngestPayload['format'] & string,
  ): { ok: true; results: TestResultData[] } | { ok: false; error: string } {
    const adapter = format === 'auto'
      ? detectAdapter(content)
      : getAdapter(format as any);
    if (!adapter) {
      return { ok: false, error: `no adapter for format "${format}"` };
    }
    const ctx: AdapterContext = { outputDir: '.', options: {}, content };
    try {
      const ingested = adapter.ingest(ctx);
      return { ok: true, results: ingested.results };
    } catch (e) {
      return { ok: false, error: `adapter parse failed: ${(e as Error).message}` };
    }
  }

  /**
   * Compute a RunSummary from normalized test results. This mirrors the
   * counting the report generator does, kept deliberately simple.
   */
  summaryFromResults(results: TestResultData[], format: NonNullable<IngestPayload['format']>): RunSummary {
    const total = results.length;
    let passed = 0, failed = 0, skipped = 0, flaky = 0, slow = 0;
    let duration = 0;
    for (const r of results) {
      duration += r.duration;
      if (r.outcome === 'flaky') flaky++;
      switch (r.status) {
        case 'passed': passed++; break;
        case 'failed':
        case 'timedOut':
        case 'interrupted': failed++; break;
        case 'skipped': skipped++; break;
      }
    }
    const passRate = total > 0 ? Math.round((passed / total) * 1000) / 10 : 0;
    return {
      runId: this.generateRunId(),
      timestamp: new Date().toISOString(),
      total, passed, failed, skipped, flaky, slow,
      duration, passRate,
      ciInfo: { provider: format },
    };
  }

  private generateRunId(): string {
    return 'run-' + crypto.randomBytes(12).toString('hex');
  }
}
