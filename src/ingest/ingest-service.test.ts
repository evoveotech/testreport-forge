import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { IngestService } from './ingest-service';
import { FileStore } from '../store';
import type { IngestPayload, OrgContext, RunSummary } from '../types';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-ingest-'));
}

function validCtx(overrides: Partial<OrgContext> = {}): OrgContext {
  return {
    tenantId: 'acme', client: 'c1', product: 'p1', team: 't1',
    stack: 'junit', runType: 'nightly', environment: 'ci',
    ...overrides,
  };
}

// Minimal valid JUnit XML that the JUnitAdapter can parse.
const JUNIT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="suite-1" tests="3" failures="1" errors="0" skipped="1" time="2.5">
    <testcase classname="suite-1" name="passes" time="1.0"/>
    <testcase classname="suite-1" name="fails" time="1.0">
      <failure message="boom">stack trace here</failure>
    </testcase>
    <testcase classname="suite-1" name="skipped" time="0.5">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

describe('IngestService', () => {
  let dir: string;
  let store: FileStore;
  let service: IngestService;

  beforeEach(async () => {
    dir = tmpDir();
    store = new FileStore(dir);
    await store.open();
    service = new IngestService(store);
  });

  afterEach(async () => {
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('validation', () => {
    it('rejects a payload missing orgContext', async () => {
      const result = await service.ingest({} as IngestPayload);
      expect(result.accepted).toBe(false);
      expect(result.errors).toContain('orgContext is required');
    });

    it('rejects a payload with an empty required org field', async () => {
      const result = await service.ingest({
        orgContext: { ...validCtx(), client: '' },
        run: { runId: 'r1', timestamp: '2026-08-09T10:00:00Z', total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, slow: 0, duration: 100, passRate: 100 },
      });
      expect(result.accepted).toBe(false);
      expect(result.errors?.some(e => e.includes('client'))).toBe(true);
    });

    it('rejects an invalid runType', async () => {
      const result = await service.ingest({
        orgContext: { ...validCtx(), runType: 'bogus' as any },
        run: { runId: 'r1', timestamp: '2026-08-09T10:00:00Z', total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, slow: 0, duration: 100, passRate: 100 },
      });
      expect(result.accepted).toBe(false);
      expect(result.errors?.some(e => e.includes('runType'))).toBe(true);
    });

    it('rejects a payload with neither run nor rawArtifact', async () => {
      const result = await service.ingest({ orgContext: validCtx() });
      expect(result.accepted).toBe(false);
      expect(result.errors?.some(e => e.includes('either run or rawArtifact'))).toBe(true);
    });

    it('rejects rawArtifact without format', async () => {
      const result = await service.ingest({ orgContext: validCtx(), rawArtifact: JUNIT_XML });
      expect(result.accepted).toBe(false);
      expect(result.errors?.some(e => e.includes('format is required'))).toBe(true);
    });

    it('rejects providing both run and rawArtifact', async () => {
      const result = await service.ingest({
        orgContext: validCtx(),
        format: 'junit',
        rawArtifact: JUNIT_XML,
        run: { runId: 'r1', timestamp: '2026-08-09T10:00:00Z', total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, slow: 0, duration: 100, passRate: 100 },
      });
      expect(result.accepted).toBe(false);
      expect(result.errors?.some(e => e.includes('not both'))).toBe(true);
    });
  });

  describe('pre-normalized run', () => {
    it('accepts and persists a pre-normalized run summary', async () => {
      const summary: RunSummary = {
        runId: 'r1', timestamp: '2026-08-09T10:00:00Z',
        total: 10, passed: 9, failed: 1, skipped: 0, flaky: 0, slow: 0,
        duration: 5000, passRate: 90,
      };
      const result = await service.ingest({ orgContext: validCtx(), run: summary });
      expect(result.accepted).toBe(true);
      expect(result.runId).toBe('r1');
      const got = await store.getRun('acme', 'r1');
      expect(got).not.toBeNull();
      expect(got?.orgContext.tenantId).toBe('acme');
      expect(got?.passRate).toBe(90);
      expect(got?.ingestedAt).toBeDefined();
    });

    it('generates a runId when none is supplied', async () => {
      const result = await service.ingest({
        orgContext: validCtx(),
        run: { runId: '', timestamp: '2026-08-09T10:00:00Z', total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, slow: 0, duration: 100, passRate: 100 },
      });
      expect(result.accepted).toBe(true);
      expect(result.runId).toMatch(/^run-/);
    });
  });

  describe('raw artifact routing (ADR-001)', () => {
    it('parses a JUnit XML payload via the adapter and persists a summary', async () => {
      const result = await service.ingest({
        orgContext: validCtx({ stack: 'junit' }),
        format: 'junit',
        rawArtifact: JUNIT_XML,
      });
      expect(result.accepted).toBe(true);
      expect(result.runId).toMatch(/^run-/);
      const got = await store.getRun('acme', result.runId);
      expect(got).not.toBeNull();
      expect(got?.total).toBe(3);
      expect(got?.passed).toBe(1);
      expect(got?.failed).toBe(1);
      expect(got?.skipped).toBe(1);
      expect(got?.orgContext.stack).toBe('junit');
      expect(got?.ciInfo?.provider).toBe('junit');
    });

    it('rejects an unparseable raw artifact (0 results)', async () => {
      const result = await service.ingest({
        orgContext: validCtx(),
        format: 'junit',
        rawArtifact: 'not xml at all',
      });
      expect(result.accepted).toBe(false);
      expect(result.errors?.some(e => e.includes('0 test results'))).toBe(true);
    });

    it('rejects an unknown format', async () => {
      const result = await service.ingest({
        orgContext: validCtx(),
        format: 'bogus' as any,
        rawArtifact: JUNIT_XML,
      });
      expect(result.accepted).toBe(false);
      expect(result.errors?.some(e => e.includes('no adapter'))).toBe(true);
    });
  });

  describe('tenant isolation on ingest', () => {
    it('persists runs under the payload\'s tenant and no other', async () => {
      await service.ingest({
        orgContext: validCtx({ tenantId: 'acme' }),
        run: { runId: 'r1', timestamp: '2026-08-09T10:00:00Z', total: 1, passed: 1, failed: 0, skipped: 0, flaky: 0, slow: 0, duration: 100, passRate: 100 },
      });
      expect(await store.getRun('acme', 'r1')).not.toBeNull();
      expect(await store.getRun('globex', 'r1')).toBeNull();
    });
  });
});
