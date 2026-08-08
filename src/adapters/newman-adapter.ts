/**
 * Newman/Postman JSON Adapter
 *
 * Parses JSON reports emitted by Newman (the Postman CLI):
 *   newman run collection.json -r json --reporter-json-export results.json
 *
 * Covers Postman automation runs / API test collections.
 *
 * Report shape (Newman v5+): { collection, environment, results: { failures, stats },
 *   runs: [{ executions: [{ item: { name, request }, assertions, response, ... }] }] }
 * Older Newman emits a top-level `results` array of executions. We handle both.
 */

import * as path from 'path';
import type { TestResultData, StepData } from '../types';
import type { TestRunAdapter, AdapterContext, IngestedRun, FrameworkInfo } from './types';

interface NewmanAssertion {
  assertion: string;
  skipped?: boolean;
  error?: { message: string; name?: string; stack?: string };
}

interface NewmanExecution {
  item: { name: string; request?: { method?: string; url?: { raw?: string } | string } };
  assertions?: NewmanAssertion[];
  response?: { status?: string; code?: number; responseTime?: number };
  request?: { url?: string; method?: string };
  id?: string;
  cursor?: { ref?: string };
}

interface NewmanReport {
  collection?: { info?: { name?: string; schema?: string } };
  environment?: { name?: string };
  run?: {
    stats?: { assertions?: { total?: number; failed?: number; skipped?: number } };
    timings?: { completed?: number };
    executions?: NewmanExecution[];
    failures?: Array<{ error: { message: string }; at: string; source: { name: string } }>;
  };
  // Older format
  results?: NewmanExecution[];
}

function requestUrl(exec: NewmanExecution): string {
  const req = exec.item.request || exec.request;
  if (!req) return '';
  if (typeof req.url === 'string') return req.url;
  return req.url?.raw || '';
}

function buildSteps(exec: NewmanExecution): StepData[] {
  const steps: StepData[] = [];
  const rt = exec.response?.responseTime;
  if (rt && rt > 0) {
    steps.push({ title: `Request: ${exec.item.name}`, duration: rt, category: 'hook' });
  }
  for (const a of exec.assertions || []) {
    steps.push({ title: a.assertion, duration: 0, category: 'test.step' });
  }
  return steps;
}

export class NewmanAdapter implements TestRunAdapter {
  readonly format = 'newman' as const;
  readonly name = 'Newman/Postman';

  matches(content: string, inputPath?: string): boolean {
    if (inputPath) {
      const ext = path.extname(inputPath).toLowerCase();
      if (ext === '.json') {
        try {
          const j = JSON.parse(content);
          // Newman v5+ has run.executions; older has results[] with item.assertions
          return !!(j && (j.run?.executions || (Array.isArray(j.results) && j.results[0]?.assertions)));
        } catch {
          return false;
        }
      }
    }
    try {
      const j = JSON.parse(content);
      return !!(j && (j.run?.executions || (Array.isArray(j.results) && j.results[0]?.assertions)));
    } catch {
      return false;
    }
  }

  ingest(ctx: AdapterContext): IngestedRun {
    const report: NewmanReport = JSON.parse(ctx.content ?? '{}');
    const framework: FrameworkInfo = { id: 'newman', label: 'Postman (Newman)' };
    if (ctx.options.framework) {
      framework.label = ctx.options.framework;
      framework.id = ctx.options.framework.toLowerCase();
    }

    const collectionName = report.collection?.info?.name || 'Postman Collection';
    const executions: NewmanExecution[] = report.run?.executions || report.results || [];
    const results: TestResultData[] = [];
    let totalDuration = 0;

    for (const exec of executions) {
      const name = exec.item.name || 'Unnamed request';
      const url = requestUrl(exec);
      const assertions = exec.assertions || [];
      const failedAssertions = assertions.filter(a => a.error);
      const skippedAssertions = assertions.filter(a => a.skipped);
      const responseTime = exec.response?.responseTime || 0;
      totalDuration += responseTime;

      let status: TestResultData['status'];
      let outcome: TestResultData['outcome'];
      if (assertions.length > 0 && failedAssertions.length === 0 && skippedAssertions.length === assertions.length) {
        status = 'skipped';
        outcome = 'skipped';
      } else if (failedAssertions.length > 0) {
        status = 'failed';
        outcome = 'unexpected';
      } else {
        status = 'passed';
        outcome = 'expected';
      }

      const errorParts = failedAssertions.map(a => {
        const e = a.error!;
        return e.message ? `${a.assertion}: ${e.message}` : a.assertion;
      });
      const error = errorParts.length > 0 ? errorParts.join('\n') : undefined;

      const file = url ? `${url}` : `${collectionName}.postman.json`;
      const testId = `${collectionName}::${name}${url ? ` [${url}]` : ''}`;

      results.push({
        testId,
        title: name,
        file,
        status,
        duration: responseTime,
        retry: 0,
        steps: buildSteps(exec),
        history: [],
        suite: collectionName,
        suites: [collectionName],
        error,
        outcome,
        expectedStatus: 'passed',
      });
    }

    return {
      results,
      framework,
      duration: report.run?.timings?.completed || totalDuration,
    };
  }
}
