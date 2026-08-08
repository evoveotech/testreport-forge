import { describe, it, expect } from 'vitest';
import { JUnitAdapter } from './junit-adapter';
import { TrxAdapter } from './trx-adapter';
import { NewmanAdapter } from './newman-adapter';
import { JsonAdapter } from './json-adapter';
import { detectAdapter, getAdapter } from './index';
import type { AdapterContext } from './types';

function ctx(content: string, inputPath?: string, opts?: Record<string, unknown>): AdapterContext {
  return {
    content,
    inputPath,
    outputDir: '.',
    options: opts ?? {},
  };
}

const JUNIT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Auth Suite" tests="3" failures="1" skipped="1" time="2.5">
    <properties>
      <property name="framework" value="Cypress"/>
    </properties>
    <testcase classname="Auth.Login" name="should log in" time="1.2"/>
    <testcase classname="Auth.Login" name="should reject bad password" time="0.8">
      <failure message="AssertionError">expected 200 to equal 401</failure>
    </testcase>
    <testcase classname="Auth.Login" name="should skip 2FA" time="0">
      <skipped/>
    </testcase>
  </testsuite>
</testsuites>`;

const TRX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010">
  <Results>
    <UnitTestResult testId="t1" testName="CanAdd" outcome="Passed" duration="00:00:01.234"/>
    <UnitTestResult testId="t2" testName="CanDivide" outcome="Failed" duration="00:00:00.500">
      <Output>
        <ErrorInfo>
          <Message>Assert.AreEqual failed</Message>
          <StackTrace> at MathTests.cs:42</StackTrace>
        </ErrorInfo>
      </Output>
    </UnitTestResult>
    <UnitTestResult testId="t3" testName="SlowTest" outcome="Timeout" duration="00:00:30"/>
  </Results>
  <TestDefinitions>
    <UnitTest id="t1" name="CanAdd" storage="MathTests.dll">
      <TestMethod name="CanAdd" className="MathTests.CalculatorTests"/>
    </UnitTest>
    <UnitTest id="t2" name="CanDivide" storage="MathTests.dll">
      <TestMethod name="CanDivide" className="MathTests.CalculatorTests"/>
    </UnitTest>
    <UnitTest id="t3" name="SlowTest" storage="MathTests.dll">
      <TestMethod name="SlowTest" className="MathTests.PerformanceTests"/>
    </UnitTest>
  </TestDefinitions>
</TestRun>`;

const NEWMAN_JSON = JSON.stringify({
  collection: { info: { name: 'API Smoke Tests' } },
  run: {
    timings: { completed: 5432 },
    stats: { assertions: { total: 3, failed: 1, skipped: 0 } },
    executions: [
      {
        item: { name: 'GET /health', request: { method: 'GET', url: { raw: 'https://api.example.com/health' } } },
        response: { code: 200, responseTime: 120 },
        assertions: [{ assertion: 'status is 200' }],
      },
      {
        item: { name: 'POST /login', request: { method: 'POST', url: { raw: 'https://api.example.com/login' } } },
        response: { code: 500, responseTime: 350 },
        assertions: [
          { assertion: 'status is 200', error: { message: 'expected 200 got 500' } },
          { assertion: 'has token' },
        ],
      },
    ],
  },
});

const GENERIC_JSON = JSON.stringify({
  metadata: { framework: 'CustomRunner', reporterVersion: '1.0.0' },
  summary: { total: 2, passed: 1, failed: 1, duration: 2000 },
  tests: [
    { testId: 'a::pass', title: 'passing test', file: 'a.spec', status: 'passed', duration: 500 },
    { testId: 'b::fail', title: 'failing test', file: 'b.spec', status: 'failed', duration: 1500, error: 'boom' },
  ],
});

describe('JUnitAdapter', () => {
  const adapter = new JUnitAdapter();

  it('matches JUnit XML', () => {
    expect(adapter.matches(JUNIT_XML, 'results.xml')).toBe(true);
    expect(adapter.matches(JUNIT_XML)).toBe(true);
  });

  it('does not match non-JUnit content', () => {
    expect(adapter.matches('hello world', 'results.txt')).toBe(false);
    expect(adapter.matches(TRX_XML, 'results.trx')).toBe(false);
  });

  it('parses test cases with correct statuses', () => {
    const run = adapter.ingest(ctx(JUNIT_XML));
    expect(run.results).toHaveLength(3);
    expect(run.results[0].status).toBe('passed');
    expect(run.results[1].status).toBe('failed');
    expect(run.results[2].status).toBe('skipped');
  });

  it('extracts error messages from failures', () => {
    const run = adapter.ingest(ctx(JUNIT_XML));
    expect(run.results[1].error).toContain('AssertionError');
    expect(run.results[1].error).toContain('expected 200 to equal 401');
  });

  it('converts time attribute to milliseconds', () => {
    const run = adapter.ingest(ctx(JUNIT_XML));
    expect(run.results[0].duration).toBe(1200); // 1.2s -> 1200ms
    expect(run.results[1].duration).toBe(800);
  });

  it('detects framework from properties', () => {
    const run = adapter.ingest(ctx(JUNIT_XML));
    expect(run.framework.label).toBe('Cypress');
  });

  it('allows framework override via options', () => {
    const run = adapter.ingest(ctx(JUNIT_XML, undefined, { framework: 'SoapUI' }));
    expect(run.framework.label).toBe('SoapUI');
  });

  it('builds suite hierarchy from classname', () => {
    const run = adapter.ingest(ctx(JUNIT_XML));
    expect(run.results[0].suites).toEqual(['Auth', 'Login']);
    expect(run.results[0].suite).toBe('Login');
  });
});

describe('TrxAdapter', () => {
  const adapter = new TrxAdapter();

  it('matches TRX files', () => {
    expect(adapter.matches(TRX_XML, 'results.trx')).toBe(true);
  });

  it('does not match JUnit XML', () => {
    expect(adapter.matches(JUNIT_XML, 'results.xml')).toBe(false);
  });

  it('maps TRX outcomes to internal statuses', () => {
    const run = adapter.ingest(ctx(TRX_XML));
    expect(run.results).toHaveLength(3);
    expect(run.results[0].status).toBe('passed');
    expect(run.results[1].status).toBe('failed');
    expect(run.results[2].status).toBe('timedOut');
  });

  it('parses TimeSpan durations to ms', () => {
    const run = adapter.ingest(ctx(TRX_XML));
    expect(run.results[0].duration).toBe(1234); // 00:00:01.234
    expect(run.results[1].duration).toBe(500);
    expect(run.results[2].duration).toBe(30000);
  });

  it('extracts error info from ErrorInfo', () => {
    const run = adapter.ingest(ctx(TRX_XML));
    expect(run.results[1].error).toContain('Assert.AreEqual failed');
    expect(run.results[1].error).toContain('MathTests.cs:42');
  });

  it('uses className for suite hierarchy', () => {
    const run = adapter.ingest(ctx(TRX_XML));
    expect(run.results[0].suites).toEqual(['MathTests', 'CalculatorTests']);
    expect(run.results[2].suites).toEqual(['MathTests', 'PerformanceTests']);
  });

  it('labels framework as MSTest (TRX)', () => {
    const run = adapter.ingest(ctx(TRX_XML));
    expect(run.framework.label).toBe('MSTest (TRX)');
  });
});

describe('NewmanAdapter', () => {
  const adapter = new NewmanAdapter();

  it('matches Newman JSON', () => {
    expect(adapter.matches(NEWMAN_JSON, 'newman.json')).toBe(true);
  });

  it('does not match generic JSON without run.executions', () => {
    expect(adapter.matches(GENERIC_JSON, 'results.json')).toBe(false);
  });

  it('parses executions and assertions', () => {
    const run = adapter.ingest(ctx(NEWMAN_JSON));
    expect(run.results).toHaveLength(2);
    expect(run.results[0].status).toBe('passed');
    expect(run.results[1].status).toBe('failed');
  });

  it('extracts failure messages from assertions', () => {
    const run = adapter.ingest(ctx(NEWMAN_JSON));
    expect(run.results[1].error).toContain('expected 200 got 500');
  });

  it('uses collection name as suite', () => {
    const run = adapter.ingest(ctx(NEWMAN_JSON));
    expect(run.results[0].suite).toBe('API Smoke Tests');
    expect(run.results[0].suites).toEqual(['API Smoke Tests']);
  });

  it('uses request URL as file', () => {
    const run = adapter.ingest(ctx(NEWMAN_JSON));
    expect(run.results[0].file).toBe('https://api.example.com/health');
  });

  it('labels framework as Postman (Newman)', () => {
    const run = adapter.ingest(ctx(NEWMAN_JSON));
    expect(run.framework.label).toBe('Postman (Newman)');
  });
});

describe('JsonAdapter', () => {
  const adapter = new JsonAdapter();

  it('matches smart-report-data.json shape', () => {
    expect(adapter.matches(GENERIC_JSON, 'results.json')).toBe(true);
  });

  it('matches a bare array of test objects', () => {
    const bare = JSON.stringify([
      { testId: 'x::1', title: 't', file: 'f', status: 'passed', duration: 10 },
    ]);
    expect(adapter.matches(bare, 'results.json')).toBe(true);
  });

  it('parses tests with statuses', () => {
    const run = adapter.ingest(ctx(GENERIC_JSON));
    expect(run.results).toHaveLength(2);
    expect(run.results[0].status).toBe('passed');
    expect(run.results[1].status).toBe('failed');
    expect(run.results[1].error).toBe('boom');
  });

  it('uses metadata.framework when present', () => {
    const run = adapter.ingest(ctx(GENERIC_JSON));
    expect(run.framework.label).toBe('CustomRunner');
  });

  it('coerces unknown status to failed', () => {
    const run = adapter.ingest(ctx(JSON.stringify({
      tests: [{ testId: 'x', title: 't', file: 'f', status: 'weird', duration: 0 }],
    })));
    expect(run.results[0].status).toBe('failed');
  });
});

describe('auto-detection (detectAdapter)', () => {
  it('detects JUnit XML', () => {
    const a = detectAdapter(JUNIT_XML, 'results.xml');
    expect(a?.format).toBe('junit');
  });

  it('detects TRX', () => {
    const a = detectAdapter(TRX_XML, 'results.trx');
    expect(a?.format).toBe('trx');
  });

  it('detects Newman JSON', () => {
    const a = detectAdapter(NEWMAN_JSON, 'newman.json');
    expect(a?.format).toBe('newman');
  });

  it('detects generic JSON', () => {
    const a = detectAdapter(GENERIC_JSON, 'results.json');
    expect(a?.format).toBe('json');
  });

  it('returns undefined for unknown content', () => {
    expect(detectAdapter('just some text', 'results.txt')).toBeUndefined();
  });
});

describe('getAdapter (explicit lookup)', () => {
  it('returns adapter by format id', () => {
    expect(getAdapter('junit')?.format).toBe('junit');
    expect(getAdapter('trx')?.format).toBe('trx');
    expect(getAdapter('newman')?.format).toBe('newman');
    expect(getAdapter('json')?.format).toBe('json');
  });

  it('returns undefined for playwright (live reporter, not file-based)', () => {
    expect(getAdapter('playwright')).toBeUndefined();
  });
});
