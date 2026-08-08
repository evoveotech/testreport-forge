/**
 * TRX Adapter
 *
 * Parses Microsoft Visual Studio Test Results (.trx) files — the XML format
 * emitted by `dotnet test`, `vstest`, MSTest, xUnit (via TRX reporter), and
 * NUnit (via TRX adapter). Covers .NET test runs including RestSharp-based
 * integration suites.
 *
 * TRX namespace: http://microsoft.com/schemas/VisualStudio/TeamTest/2010
 * Structure: TestRun > Results > UnitTestResult (with Outcome) +
 *            TestDefinitions > UnitTest (with TestMethod name/class) +
 *            ResultSummary > Counters
 */

import * as path from 'path';
import type { TestResultData, StepData } from '../types';
import type { TestRunAdapter, AdapterContext, IngestedRun, FrameworkInfo } from './types';

// Reuse the tolerant parser from the JUnit adapter (tag-name lowercased).
import { parseXml, findChildren, findChild, findAllDescendants, escapeXmlText } from './junit-adapter';

/** TRX outcome -> internal status mapping. */
function mapOutcome(outcome: string | undefined): TestResultData['status'] {
  switch ((outcome || '').toLowerCase()) {
    case 'passed': return 'passed';
    case 'failed': return 'failed';
    case 'notrun':
    case 'not runnable':
    case 'skipped':
    case 'inconclusive':
      return 'skipped';
    case 'timeout': return 'timedOut';
    case 'aborted':
    case 'error':
      return 'interrupted';
    default: return 'failed';
  }
}

interface TestDefinition {
  id: string;
  name: string;
  className: string;
  testName: string;
  file?: string;
}

export class TrxAdapter implements TestRunAdapter {
  readonly format = 'trx' as const;
  readonly name = 'TRX (MSTest/VSTest)';

  matches(content: string, inputPath?: string): boolean {
    if (inputPath) {
      const ext = path.extname(inputPath).toLowerCase();
      if (ext === '.trx') {
        return /<TestRun[\s>]/i.test(content) || /VisualStudio\/TeamTest/i.test(content);
      }
    }
    return /<TestRun[\s>]/i.test(content) && /VisualStudio\/TeamTest/i.test(content);
  }

  ingest(ctx: AdapterContext): IngestedRun {
    const xml = ctx.content ?? '';
    const root = parseXml(xml);

    const framework: FrameworkInfo = { id: 'trx', label: 'MSTest (TRX)' };
    if (ctx.options.framework) {
      framework.label = ctx.options.framework;
      framework.id = ctx.options.framework.toLowerCase();
    }

    // Build a map of test definitions (id -> metadata)
    const defs = new Map<string, TestDefinition>();
    const testDefs = findAllDescendants(root, 'unittest');
    for (const def of testDefs) {
      const id = def.attrs.id;
      const method = findChild(def, 'testmethod');
      const name = method?.attrs.name || def.attrs.name || 'Unknown test';
      const className = method?.attrs.className || def.attrs.className || '';
      const testName = method?.attrs.name || name;
      const storage = def.attrs.storage || method?.attrs.codeBase;
      defs.set(id, {
        id,
        name: escapeXmlText(name),
        className: escapeXmlText(className),
        testName: escapeXmlText(testName),
        file: storage ? escapeXmlText(storage) : undefined,
      });
    }

    // Collect results
    const results: TestResultData[] = [];
    let totalDuration = 0;
    const unitResults = findAllDescendants(root, 'unittestresult');
    for (const res of unitResults) {
      const defId = res.attrs.testId || res.attrs.testName;
      const def = defs.get(defId);
      const title = def?.testName || def?.name || escapeXmlText(res.attrs.testName || 'Unknown test');
      const className = def?.className || '';
      const status = mapOutcome(res.attrs.outcome);
      const duration = parseDurationMsTrx(res.attrs.duration);
      totalDuration += duration;

      // Error message from Output/ErrorInfo
      const output = findChild(res, 'output');
      const errorInfo = output ? findChild(output, 'errorinfo') : findChild(res, 'errorinfo');
      let error: string | undefined;
      if (errorInfo) {
        const msg = findChild(errorInfo, 'message');
        const trace = findChild(errorInfo, 'stacktrace');
        const parts = [msg?.text.trim(), trace?.text.trim()].filter(Boolean);
        if (parts.length) error = parts.join('\n');
      }
      if (!error && output) {
        const stdErr = findChild(output, 'stderr');
        if (stdErr?.text.trim()) error = stdErr.text.trim();
      }

      const file = def?.file || (className ? `${className}.dll` : 'tests.trx');
      const steps: StepData[] = duration > 0
        ? [{ title, duration, category: 'test.step' }]
        : [];
      const suites = className ? className.split(/[.]/).filter(Boolean) : [];

      results.push({
        testId: `${className || '(unknown)'}::${title}`,
        title,
        file,
        status,
        duration,
        retry: 0,
        steps,
        history: [],
        suite: suites.length > 0 ? suites[suites.length - 1] : undefined,
        suites: suites.length > 0 ? suites : undefined,
        error,
        outcome: status === 'passed' ? 'expected' : status === 'skipped' ? 'skipped' : 'unexpected',
        expectedStatus: 'passed',
      });
    }

    return { results, framework, duration: totalDuration };
  }
}

/** TRX durations look like "00:00:01.234" (HH:MM:SS.fraction) or seconds. */
function parseDurationMsTrx(raw: string | undefined): number {
  if (!raw) return 0;
  const s = raw.trim();
  // TimeSpan format: dd:hh:mm:ss.fffffff or hh:mm:ss.fff
  const tsMatch = s.match(/^(?:(\d+)\.)?(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (tsMatch) {
    const days = tsMatch[1] ? parseInt(tsMatch[1], 10) : 0;
    const hours = parseInt(tsMatch[2], 10);
    const mins = parseInt(tsMatch[3], 10);
    const secs = parseInt(tsMatch[4], 10);
    const frac = tsMatch[5] ? parseFloat(`0.${tsMatch[5]}`) : 0;
    return Math.round(((days * 86400 + hours * 3600 + mins * 60 + secs + frac) * 1000));
  }
  const v = parseFloat(s);
  if (isNaN(v)) return 0;
  return Math.round(v * 1000);
}
