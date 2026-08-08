/**
 * Generic JSON Adapter
 *
 * Accepts results in the reporter's own JSON export schema (smart-report-data.json),
 * so any framework can convert its results into a simple JSON file and feed it in.
 * Also tolerates a bare array of partial TestResultData objects.
 *
 * Minimal accepted shape per test:
 *   { testId, title, file, status, duration, error?, retry?, suite?, tags? }
 */

import * as path from 'path';
import type { TestResultData, StepData } from '../types';
import type { TestRunAdapter, AdapterContext, IngestedRun, FrameworkInfo } from './types';

interface JsonExportShape {
  metadata?: { projectName?: string; reporterVersion?: string; framework?: string };
  summary?: { duration?: number };
  tests?: Array<Partial<TestResultData> & { status?: string }>;
  history?: { runs?: unknown[]; summaries?: unknown[] };
}

function coerceStatus(s: string | undefined): TestResultData['status'] {
  switch ((s || '').toLowerCase()) {
    case 'passed': return 'passed';
    case 'failed': return 'failed';
    case 'skipped': return 'skipped';
    case 'timedout':
    case 'timed out': return 'timedOut';
    case 'interrupted':
    case 'aborted': return 'interrupted';
    default: return 'failed';
  }
}

export class JsonAdapter implements TestRunAdapter {
  readonly format = 'json' as const;
  readonly name = 'Generic JSON';

  matches(content: string, inputPath?: string): boolean {
    if (inputPath) {
      const ext = path.extname(inputPath).toLowerCase();
      if (ext !== '.json') return false;
    }
    try {
      const j = JSON.parse(content);
      // smart-report-data.json shape, or a bare array of test objects
      const hasTests = Array.isArray(j?.tests) || (Array.isArray(j) && j[0]?.testId);
      return !!hasTests;
    } catch {
      return false;
    }
  }

  ingest(ctx: AdapterContext): IngestedRun {
    const raw = JSON.parse(ctx.content ?? '{}');
    const data: JsonExportShape = Array.isArray(raw) ? { tests: raw } : raw;
    const tests = data.tests || [];

    const framework: FrameworkInfo = {
      id: data.metadata?.framework?.toLowerCase() || 'json',
      label: data.metadata?.framework || ctx.options.framework || 'Generic JSON',
    };
    if (ctx.options.framework) {
      framework.label = ctx.options.framework;
      framework.id = ctx.options.framework.toLowerCase();
    }

    const results: TestResultData[] = tests.map((t, idx) => {
      const status = coerceStatus(t.status as string | undefined);
      const steps: StepData[] = Array.isArray(t.steps) ? t.steps : [];
      return {
        testId: t.testId || `${t.file || 'test'}::${t.title || `test-${idx}`}`,
        title: t.title || `Test ${idx + 1}`,
        file: t.file || 'unknown',
        status,
        duration: typeof t.duration === 'number' ? t.duration : 0,
        retry: typeof t.retry === 'number' ? t.retry : 0,
        steps,
        history: Array.isArray(t.history) ? t.history : [],
        error: t.error,
        suite: t.suite,
        suites: t.suites,
        tags: t.tags,
        browser: t.browser,
        project: t.project,
        annotations: t.annotations,
        outcome: t.outcome as TestResultData['outcome'] | undefined
          ?? (status === 'passed' ? 'expected' : status === 'skipped' ? 'skipped' : 'unexpected'),
        expectedStatus: (t.expectedStatus as TestResultData['expectedStatus']) || 'passed',
      };
    });

    return {
      results,
      framework,
      duration: data.summary?.duration,
    };
  }
}
