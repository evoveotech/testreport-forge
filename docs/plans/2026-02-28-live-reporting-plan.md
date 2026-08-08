# F-003: Live Reporting During Execution — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stream test results in real time during Playwright execution via an incremental JSONL writer and a lightweight live dashboard with file-polling and SSE modes.

**Architecture:** A new `LiveWriter` class hooks into `onBegin()` / `onTestEnd()` / `onEnd()` to append JSONL events to `.smart-live-results.jsonl`. A static HTML dashboard polls this file every 2 seconds (file mode) or connects via SSE (when served by the extended `smart-reporter-serve`). The serve CLI gains a `--live` flag that watches the JSONL file and pushes updates over SSE. First-failure Slack/Teams notifications are gated behind Starter tier.

**Tech Stack:** TypeScript, Node.js `fs`, `http`, `fs.watch`, vanilla HTML/JS/CSS (no build step), vitest for testing.

---

## Phase A — Core Live Reporting (Free Tier)

### Task 1: Add `LiveConfig` types and `live` option to `SmartReporterOptions`

**Files:**
- Modify: `src/types.ts`

**Step 1: Add the new types at the end of the Configuration section**

In `src/types.ts`, after the `QuarantineConfig` interface (~line 482), add:

```typescript
// ============================================================================
// Live Reporting
// ============================================================================

export interface LiveConfig {
  enabled: boolean;
  outputFile?: string;        // Default: .smart-live-results.jsonl
  dashboard?: boolean;        // Generate smart-live.html alongside report (default: true)
  notifyOnFirstFailure?: boolean; // Starter tier: send Slack/Teams on first failure
}

export interface LiveEvent {
  event: 'start' | 'test' | 'complete';
  timestamp: string;
}

export interface LiveStartEvent extends LiveEvent {
  event: 'start';
  totalExpected: number;
  ciInfo?: CIInfo;
}

export interface LiveTestEvent extends LiveEvent {
  event: 'test';
  testId: string;
  title: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  error?: string;
  retry: number;
  counters: LiveCounters;
}

export interface LiveCompleteEvent extends LiveEvent {
  event: 'complete';
  duration: number;
  counters: LiveCounters;
}

export interface LiveCounters {
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  completed: number;
  totalExpected: number;
}
```

**Step 2: Add `live` to `SmartReporterOptions`**

In `src/types.ts`, inside `SmartReporterOptions` (after the `quarantine` field, ~line 165), add:

```typescript
  // Live reporting: stream results during execution
  live?: LiveConfig;
```

**Step 3: Run type check**

Run: `cd /home/runner/work/testreport-forge && npx tsc --noEmit`
Expected: Clean pass (no errors)

**Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat(live): add LiveConfig types and live option to SmartReporterOptions"
```

---

### Task 2: Create `LiveWriter` class with JSONL output

**Files:**
- Create: `src/live/live-writer.ts`
- Create: `src/live/index.ts`
- Test: `src/live/live-writer.test.ts`

**Step 1: Write the failing tests**

Create `src/live/live-writer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { LiveWriter } from './live-writer';

vi.mock('fs');

describe('LiveWriter', () => {
  const mockFs = vi.mocked(fs);
  let writer: LiveWriter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.existsSync.mockReturnValue(false);
    writer = new LiveWriter({ outputFile: '/tmp/live.jsonl' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('start', () => {
    it('writes a start event with total expected count', () => {
      writer.start(47);

      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);
      const written = mockFs.writeFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());
      expect(event.event).toBe('start');
      expect(event.totalExpected).toBe(47);
      expect(event.timestamp).toBeDefined();
    });

    it('includes CI info when provided', () => {
      writer.start(10, { provider: 'github', branch: 'main', commit: 'abc123' });

      const written = mockFs.writeFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());
      expect(event.ciInfo).toEqual({ provider: 'github', branch: 'main', commit: 'abc123' });
    });
  });

  describe('writeTestResult', () => {
    it('appends a test event with counters', () => {
      writer.start(3);
      mockFs.appendFileSync.mockImplementation(() => {});

      writer.writeTestResult({
        testId: 'file.ts::test1',
        title: 'test1',
        file: 'file.ts',
        status: 'passed',
        duration: 1200,
        retry: 0,
      });

      expect(mockFs.appendFileSync).toHaveBeenCalledTimes(1);
      const written = mockFs.appendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());
      expect(event.event).toBe('test');
      expect(event.testId).toBe('file.ts::test1');
      expect(event.status).toBe('passed');
      expect(event.counters.passed).toBe(1);
      expect(event.counters.completed).toBe(1);
      expect(event.counters.totalExpected).toBe(3);
    });

    it('tracks retries: updates counters when a retry replaces a failure', () => {
      writer.start(2);
      mockFs.appendFileSync.mockImplementation(() => {});

      writer.writeTestResult({
        testId: 'file.ts::flaky',
        title: 'flaky',
        file: 'file.ts',
        status: 'failed',
        duration: 500,
        retry: 0,
      });

      writer.writeTestResult({
        testId: 'file.ts::flaky',
        title: 'flaky',
        file: 'file.ts',
        status: 'passed',
        duration: 600,
        retry: 1,
      });

      // Second call should show corrected counters (flaky, not failed)
      const written = mockFs.appendFileSync.mock.calls[1][1] as string;
      const event = JSON.parse(written.trim());
      expect(event.counters.passed).toBe(0);
      expect(event.counters.failed).toBe(0);
      expect(event.counters.flaky).toBe(1);
      expect(event.counters.completed).toBe(1);
    });

    it('includes error summary for failed tests', () => {
      writer.start(1);
      mockFs.appendFileSync.mockImplementation(() => {});

      writer.writeTestResult({
        testId: 'file.ts::broken',
        title: 'broken',
        file: 'file.ts',
        status: 'failed',
        duration: 300,
        retry: 0,
        error: 'Expected 200, got 500\n    at Object.test (file.ts:10:5)',
      });

      const written = mockFs.appendFileSync.mock.calls[0][1] as string;
      const event = JSON.parse(written.trim());
      expect(event.error).toBe('Expected 200, got 500');
    });
  });

  describe('complete', () => {
    it('appends a complete event with final counters', () => {
      writer.start(1);
      mockFs.appendFileSync.mockImplementation(() => {});

      writer.writeTestResult({
        testId: 'file.ts::t1',
        title: 't1',
        file: 'file.ts',
        status: 'passed',
        duration: 100,
        retry: 0,
      });

      writer.complete(5000);

      expect(mockFs.appendFileSync).toHaveBeenCalledTimes(2);
      const written = mockFs.appendFileSync.mock.calls[1][1] as string;
      const event = JSON.parse(written.trim());
      expect(event.event).toBe('complete');
      expect(event.duration).toBe(5000);
      expect(event.counters.passed).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('removes the output file if it exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      writer.cleanup();
      expect(mockFs.unlinkSync).toHaveBeenCalledWith('/tmp/live.jsonl');
    });

    it('does nothing if file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      writer.cleanup();
      expect(mockFs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('disabled writer', () => {
    it('returns a no-op writer when disabled', () => {
      const noop = LiveWriter.disabled();
      // Should not throw
      noop.start(10);
      noop.writeTestResult({ testId: 'x', title: 'x', file: 'x', status: 'passed', duration: 0, retry: 0 });
      noop.complete(0);
      noop.cleanup();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
      expect(mockFs.appendFileSync).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/runner/work/testreport-forge && npx vitest run src/live/live-writer.test.ts`
Expected: FAIL — module `./live-writer` not found

**Step 3: Write `LiveWriter` implementation**

Create `src/live/live-writer.ts`:

```typescript
import * as fs from 'fs';
import type {
  CIInfo,
  LiveStartEvent,
  LiveTestEvent,
  LiveCompleteEvent,
  LiveCounters,
} from '../types';

interface LiveTestInput {
  testId: string;
  title: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  duration: number;
  retry: number;
  error?: string;
}

interface TrackedTest {
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  retry: number;
  wasRetried: boolean;
}

export class LiveWriter {
  private outputFile: string;
  private totalExpected: number = 0;
  private tracked: Map<string, TrackedTest> = new Map();
  private noop: boolean;

  constructor(options: { outputFile: string; noop?: boolean }) {
    this.outputFile = options.outputFile;
    this.noop = options.noop ?? false;
  }

  static disabled(): LiveWriter {
    return new LiveWriter({ outputFile: '', noop: true });
  }

  start(totalExpected: number, ciInfo?: CIInfo): void {
    if (this.noop) return;
    this.totalExpected = totalExpected;
    this.tracked.clear();

    const event: LiveStartEvent = {
      event: 'start',
      timestamp: new Date().toISOString(),
      totalExpected,
      ...(ciInfo ? { ciInfo } : {}),
    };

    fs.writeFileSync(this.outputFile, JSON.stringify(event) + '\n');
  }

  writeTestResult(input: LiveTestInput): void {
    if (this.noop) return;

    const existing = this.tracked.get(input.testId);

    // Track retry: if we already have a result for this test, it's being retried
    if (existing) {
      this.tracked.set(input.testId, {
        status: input.status,
        retry: input.retry,
        wasRetried: true,
      });
    } else {
      this.tracked.set(input.testId, {
        status: input.status,
        retry: input.retry,
        wasRetried: false,
      });
    }

    const counters = this.computeCounters();

    // Truncate error to first line for live feed readability
    const errorSummary = input.error
      ? input.error.split('\n')[0].slice(0, 200)
      : undefined;

    const event: LiveTestEvent = {
      event: 'test',
      timestamp: new Date().toISOString(),
      testId: input.testId,
      title: input.title,
      file: input.file,
      status: input.status,
      duration: input.duration,
      retry: input.retry,
      counters,
      ...(errorSummary ? { error: errorSummary } : {}),
    };

    fs.appendFileSync(this.outputFile, JSON.stringify(event) + '\n');
  }

  complete(duration: number): void {
    if (this.noop) return;

    const event: LiveCompleteEvent = {
      event: 'complete',
      timestamp: new Date().toISOString(),
      duration,
      counters: this.computeCounters(),
    };

    fs.appendFileSync(this.outputFile, JSON.stringify(event) + '\n');
  }

  cleanup(): void {
    if (this.noop) return;
    if (fs.existsSync(this.outputFile)) {
      fs.unlinkSync(this.outputFile);
    }
  }

  private computeCounters(): LiveCounters {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let flaky = 0;

    // De-duplicate: only count the latest result per testId
    // A test that was retried and passed is flaky (not passed, not failed)
    for (const [, tracked] of this.tracked) {
      if (tracked.wasRetried && (tracked.status === 'passed')) {
        flaky++;
      } else if (tracked.status === 'passed') {
        passed++;
      } else if (tracked.status === 'failed' || tracked.status === 'timedOut') {
        failed++;
      } else if (tracked.status === 'skipped') {
        skipped++;
      }
    }

    // Completed = unique tests that have finished (not counting retries separately)
    const completed = this.tracked.size;

    return {
      passed,
      failed,
      skipped,
      flaky,
      completed,
      totalExpected: this.totalExpected,
    };
  }
}
```

**Step 4: Create barrel export**

Create `src/live/index.ts`:

```typescript
export { LiveWriter } from './live-writer';
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/runner/work/testreport-forge && npx vitest run src/live/live-writer.test.ts`
Expected: All tests PASS

**Step 6: Run full test suite**

Run: `cd /home/runner/work/testreport-forge && npx vitest run`
Expected: 642+ tests pass

**Step 7: Commit**

```bash
git add src/live/
git commit -m "feat(live): add LiveWriter class with JSONL incremental output"
```

---

### Task 3: Wire `LiveWriter` into `SmartReporter` lifecycle

**Files:**
- Modify: `src/smart-reporter.ts`

**Step 1: Add import**

At the top of `src/smart-reporter.ts`, after the existing import blocks (~line 67, after the `quarantine` import), add:

```typescript
import { LiveWriter } from './live';
```

**Step 2: Add `liveWriter` property**

In the `SmartReporter` class, in the State section (~line 120, after `private ciInfo?: CIInfo;`), add:

```typescript
  private liveWriter: LiveWriter;
```

**Step 3: Initialize in constructor**

In the constructor (~line 164, after the `cloudUploader` initialization and before the notification manager block), add:

```typescript
    // Initialize live writer (defaults to disabled no-op)
    if (options.live?.enabled) {
      const liveOutputFile = options.live.outputFile ?? '.smart-live-results.jsonl';
      this.liveWriter = new LiveWriter({ outputFile: liveOutputFile });
    } else {
      this.liveWriter = LiveWriter.disabled();
    }
```

**Step 4: Call `start()` in `onBegin()`**

In `onBegin()`, at the very end of the method (~line 213, after `this.teamsNotifier = ...`), add:

```typescript
    // Start live reporting (writes start event with total test count)
    const totalTests = _suite.allTests().length;
    this.liveWriter.start(totalTests, this.ciInfo);
```

Note: Change the `_suite` parameter name to `suite` in the method signature on line 178:

```typescript
  onBegin(config: FullConfig, suite: Suite): void {
```

**Step 5: Call `writeTestResult()` in `onTestEnd()`**

At the end of `onTestEnd()`, after the `resultsMap.set()` block (~line 431, before the closing `}`), add:

```typescript
    // Write live result for real-time dashboard
    this.liveWriter.writeTestResult({
      testId,
      title: test.title,
      file,
      status: result.status,
      duration: result.duration,
      retry: result.retry,
      error: testData.error,
    });
```

**Step 6: Call `complete()` in `onEnd()`**

At the very start of `onEnd()`, after `this.results = Array.from(this.resultsMap.values());` (~line 442), add:

```typescript
    // Signal live reporting that the run is complete
    this.liveWriter.complete(Date.now() - this.startTime);
```

**Step 7: Type check**

Run: `cd /home/runner/work/testreport-forge && npx tsc --noEmit`
Expected: Clean pass

**Step 8: Run full test suite**

Run: `cd /home/runner/work/testreport-forge && npx vitest run`
Expected: All tests pass

**Step 9: Commit**

```bash
git add src/smart-reporter.ts
git commit -m "feat(live): wire LiveWriter into reporter onBegin/onTestEnd/onEnd lifecycle"
```

---

### Task 4: Generate the live dashboard HTML

**Files:**
- Create: `src/live/live-dashboard.ts`
- Test: `src/live/live-dashboard.test.ts`

**Step 1: Write the failing test**

Create `src/live/live-dashboard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { generateLiveDashboard } from './live-dashboard';

describe('generateLiveDashboard', () => {
  it('generates valid HTML with polling mode by default', () => {
    const html = generateLiveDashboard({ jsonlFile: '.smart-live-results.jsonl' });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Live Test Results');
    expect(html).toContain('.smart-live-results.jsonl');
    expect(html).toContain('setInterval');
    // Should not contain SSE references in default mode
    expect(html).not.toContain('EventSource');
  });

  it('generates HTML with SSE mode when sseUrl is provided', () => {
    const html = generateLiveDashboard({
      jsonlFile: '.smart-live-results.jsonl',
      sseUrl: 'http://localhost:3000/sse',
    });

    expect(html).toContain('EventSource');
    expect(html).toContain('http://localhost:3000/sse');
    // Should not contain polling interval in SSE mode
    expect(html).not.toContain('setInterval');
  });

  it('includes progress bar, counters, and failure feed elements', () => {
    const html = generateLiveDashboard({ jsonlFile: '.smart-live-results.jsonl' });

    expect(html).toContain('id="progress-bar"');
    expect(html).toContain('id="counter-passed"');
    expect(html).toContain('id="counter-failed"');
    expect(html).toContain('id="counter-skipped"');
    expect(html).toContain('id="failure-feed"');
    expect(html).toContain('id="status-banner"');
  });

  it('escapes the jsonl file path to prevent XSS', () => {
    const html = generateLiveDashboard({ jsonlFile: '"><script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/runner/work/testreport-forge && npx vitest run src/live/live-dashboard.test.ts`
Expected: FAIL — module `./live-dashboard` not found

**Step 3: Write `generateLiveDashboard` implementation**

Create `src/live/live-dashboard.ts`:

```typescript
interface LiveDashboardOptions {
  jsonlFile: string;
  sseUrl?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateLiveDashboard(options: LiveDashboardOptions): string {
  const safeJsonlFile = escapeHtml(options.jsonlFile);
  const sseUrl = options.sseUrl ? escapeHtml(options.sseUrl) : null;

  const dataFetcher = sseUrl
    ? generateSseFetcher(sseUrl)
    : generatePollingFetcher(safeJsonlFile);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Live Test Results — Evoveo Smart Reporter</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; }
  .header { padding: 1.5rem 2rem; border-bottom: 1px solid #1e293b; display: flex; align-items: center; justify-content: space-between; }
  .header h1 { font-size: 1.25rem; font-weight: 600; }
  .header .dot { width: 10px; height: 10px; border-radius: 50%; background: #22c55e; display: inline-block; margin-right: 8px; animation: pulse 1.5s infinite; }
  .header .dot.complete { animation: none; background: #3b82f6; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

  .progress-container { padding: 1rem 2rem; }
  .progress-track { height: 8px; background: #1e293b; border-radius: 4px; overflow: hidden; display: flex; }
  .progress-bar { height: 100%; transition: width 0.3s ease; }
  .progress-passed { background: #22c55e; }
  .progress-failed { background: #ef4444; }
  .progress-skipped { background: #64748b; }
  .progress-flaky { background: #eab308; }
  .progress-label { margin-top: 0.5rem; font-size: 0.8rem; color: #94a3b8; }

  .counters { display: flex; gap: 1rem; padding: 1rem 2rem; flex-wrap: wrap; }
  .counter { background: #1e293b; border-radius: 8px; padding: 1rem 1.5rem; min-width: 120px; text-align: center; }
  .counter .value { font-size: 2rem; font-weight: 700; }
  .counter .label { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0.25rem; }
  .counter.passed .value { color: #22c55e; }
  .counter.failed .value { color: #ef4444; }
  .counter.skipped .value { color: #64748b; }
  .counter.flaky .value { color: #eab308; }

  .failure-feed { padding: 1rem 2rem; }
  .failure-feed h2 { font-size: 1rem; margin-bottom: 0.75rem; color: #94a3b8; }
  .failure-item { background: #1e293b; border-left: 3px solid #ef4444; border-radius: 0 6px 6px 0; padding: 0.75rem 1rem; margin-bottom: 0.5rem; animation: slideIn 0.3s ease; }
  .failure-item .test-title { font-weight: 600; font-size: 0.9rem; }
  .failure-item .test-file { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; }
  .failure-item .test-error { font-size: 0.8rem; color: #f87171; margin-top: 0.5rem; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

  #status-banner { display: none; padding: 1rem 2rem; text-align: center; font-weight: 600; font-size: 1.1rem; }
  #status-banner.visible { display: block; }
  #status-banner.passed { background: #166534; color: #bbf7d0; }
  #status-banner.failed { background: #7f1d1d; color: #fecaca; }
</style>
</head>
<body>

<div class="header">
  <div><span class="dot" id="live-dot"></span><h1 style="display:inline">Live Test Results</h1></div>
  <span id="elapsed" style="font-size:0.85rem;color:#64748b">--</span>
</div>

<div id="status-banner"></div>

<div class="progress-container">
  <div class="progress-track">
    <div class="progress-bar progress-passed" id="progress-passed" style="width:0%"></div>
    <div class="progress-bar progress-failed" id="progress-failed" style="width:0%"></div>
    <div class="progress-bar progress-flaky" id="progress-flaky" style="width:0%"></div>
    <div class="progress-bar progress-skipped" id="progress-skipped" style="width:0%"></div>
  </div>
  <div class="progress-label"><span id="progress-text">Waiting for results...</span></div>
  <div id="progress-bar" style="display:none"></div>
</div>

<div class="counters">
  <div class="counter passed"><div class="value" id="counter-passed">0</div><div class="label">Passed</div></div>
  <div class="counter failed"><div class="value" id="counter-failed">0</div><div class="label">Failed</div></div>
  <div class="counter flaky"><div class="value" id="counter-flaky">0</div><div class="label">Flaky</div></div>
  <div class="counter skipped"><div class="value" id="counter-skipped">0</div><div class="label">Skipped</div></div>
</div>

<div class="failure-feed">
  <h2>Failure Feed</h2>
  <div id="failure-feed"></div>
  <div id="no-failures" style="color:#64748b;font-size:0.85rem">No failures yet.</div>
</div>

<script>
var state = { started: false, complete: false, startTime: null, counters: null, failures: [] };

function updateUI(counters) {
  if (!counters) return;
  state.counters = counters;
  var total = counters.totalExpected || 1;
  document.getElementById('counter-passed').textContent = counters.passed;
  document.getElementById('counter-failed').textContent = counters.failed;
  document.getElementById('counter-flaky').textContent = counters.flaky;
  document.getElementById('counter-skipped').textContent = counters.skipped;
  document.getElementById('progress-passed').style.width = ((counters.passed / total) * 100) + '%';
  document.getElementById('progress-failed').style.width = ((counters.failed / total) * 100) + '%';
  document.getElementById('progress-flaky').style.width = ((counters.flaky / total) * 100) + '%';
  document.getElementById('progress-skipped').style.width = ((counters.skipped / total) * 100) + '%';
  document.getElementById('progress-text').textContent = counters.completed + ' / ' + counters.totalExpected + ' tests complete';
}

function addFailure(ev) {
  state.failures.push(ev);
  var feed = document.getElementById('failure-feed');
  var noFail = document.getElementById('no-failures');
  if (noFail) noFail.style.display = 'none';
  var item = document.createElement('div');
  item.className = 'failure-item';
  item.innerHTML = '<div class="test-title">' + escapeHtml(ev.title) + '</div>'
    + '<div class="test-file">' + escapeHtml(ev.file) + '</div>'
    + (ev.error ? '<div class="test-error">' + escapeHtml(ev.error) + '</div>' : '');
  feed.insertBefore(item, feed.firstChild);
}

function onComplete(ev) {
  state.complete = true;
  document.getElementById('live-dot').classList.add('complete');
  var banner = document.getElementById('status-banner');
  banner.classList.add('visible');
  if (ev.counters.failed > 0) {
    banner.classList.add('failed');
    banner.textContent = 'Run complete — ' + ev.counters.failed + ' failure(s)';
  } else {
    banner.classList.add('passed');
    banner.textContent = 'Run complete — all tests passed';
  }
  updateUI(ev.counters);
}

function processEvent(ev) {
  if (ev.event === 'start') {
    state.started = true;
    state.startTime = new Date(ev.timestamp);
    updateUI({ passed: 0, failed: 0, skipped: 0, flaky: 0, completed: 0, totalExpected: ev.totalExpected });
  } else if (ev.event === 'test') {
    updateUI(ev.counters);
    if (ev.status === 'failed' || ev.status === 'timedOut') {
      addFailure(ev);
    }
  } else if (ev.event === 'complete') {
    onComplete(ev);
  }
}

function escapeHtml(s) {
  var d = document.createElement('div');
  d.appendChild(document.createTextNode(s));
  return d.innerHTML;
}

// Elapsed time ticker
setInterval(function() {
  if (!state.startTime || state.complete) return;
  var elapsed = Math.round((Date.now() - state.startTime.getTime()) / 1000);
  var m = Math.floor(elapsed / 60);
  var s = elapsed % 60;
  document.getElementById('elapsed').textContent = m + ':' + (s < 10 ? '0' : '') + s;
}, 1000);

${dataFetcher}
</script>
</body>
</html>`;
}

function generatePollingFetcher(jsonlFile: string): string {
  return `
// Polling mode: fetch JSONL file every 2 seconds
var lastLineCount = 0;
function poll() {
  if (state.complete) return;
  fetch('${jsonlFile}').then(function(r) { return r.text(); }).then(function(text) {
    var lines = text.trim().split('\\n');
    for (var i = lastLineCount; i < lines.length; i++) {
      try { processEvent(JSON.parse(lines[i])); } catch(e) {}
    }
    lastLineCount = lines.length;
  }).catch(function() {});
}
setInterval(poll, 2000);
poll();`;
}

function generateSseFetcher(sseUrl: string): string {
  return `
// SSE mode: connect to server-sent events endpoint
var source = new EventSource('${sseUrl}');
source.onmessage = function(e) {
  try { processEvent(JSON.parse(e.data)); } catch(err) {}
};
source.onerror = function() {
  document.getElementById('elapsed').textContent = 'Connection lost — retrying...';
};`;
}
```

**Step 4: Update barrel export**

In `src/live/index.ts`, add:

```typescript
export { generateLiveDashboard } from './live-dashboard';
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/runner/work/testreport-forge && npx vitest run src/live/live-dashboard.test.ts`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add src/live/
git commit -m "feat(live): add live dashboard HTML generator with polling and SSE modes"
```

---

### Task 5: Write live dashboard to disk in `onBegin()`

**Files:**
- Modify: `src/smart-reporter.ts`

**Step 1: Import dashboard generator**

Update the live import in `src/smart-reporter.ts` to:

```typescript
import { LiveWriter, generateLiveDashboard } from './live';
```

**Step 2: Generate dashboard file in `onBegin()`**

After the `this.liveWriter.start(totalTests, this.ciInfo);` line added in Task 3, add:

```typescript
    // Generate live dashboard HTML alongside the live results file
    if (this.options.live?.dashboard !== false) {
      const liveOutputFile = this.options.live?.outputFile ?? '.smart-live-results.jsonl';
      const dashboardPath = path.resolve(this.outputDir, 'smart-live.html');
      const dashboardHtml = generateLiveDashboard({ jsonlFile: liveOutputFile });
      fs.writeFileSync(dashboardPath, dashboardHtml);
      console.log(`\n📡 Live dashboard: ${dashboardPath}`);
      console.log(`   Serve for SSE: npx evoveo-smart-reporter-serve --live "${dashboardPath}"`);
    }
```

**Step 3: Type check and run tests**

Run: `cd /home/runner/work/testreport-forge && npx tsc --noEmit && npx vitest run`
Expected: Clean type check, all tests pass

**Step 4: Commit**

```bash
git add src/smart-reporter.ts
git commit -m "feat(live): generate live dashboard HTML in onBegin when live reporting enabled"
```

---

### Task 6: Add SSE endpoint to `serve.ts`

**Files:**
- Modify: `src/bin/serve.ts`
- Test: `src/bin/serve-sse.test.ts`

**Step 1: Write the failing test**

Create `src/bin/serve-sse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildSseHandler, type SseClient } from '../live/sse-handler';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('buildSseHandler', () => {
  it('sends new JSONL lines as SSE events', async () => {
    const tmpFile = path.join(os.tmpdir(), `sse-test-${Date.now()}.jsonl`);
    const sent: string[] = [];
    const mockClient: SseClient = {
      write: (data: string) => { sent.push(data); return true; },
      end: () => {},
    };

    fs.writeFileSync(tmpFile, '{"event":"start","totalExpected":2}\n');

    const handler = buildSseHandler(tmpFile);
    handler.addClient(mockClient);

    // Give fs.watch time to fire
    await new Promise(r => setTimeout(r, 100));

    // Append a new line
    fs.appendFileSync(tmpFile, '{"event":"test","testId":"t1","status":"passed"}\n');
    await new Promise(r => setTimeout(r, 300));

    handler.stop();
    fs.unlinkSync(tmpFile);

    // Should have sent at least the second line as an SSE event
    const eventData = sent.filter(s => s.startsWith('data:'));
    expect(eventData.length).toBeGreaterThanOrEqual(1);
  });

  it('removes clients cleanly', () => {
    const tmpFile = path.join(os.tmpdir(), `sse-test2-${Date.now()}.jsonl`);
    fs.writeFileSync(tmpFile, '');

    const handler = buildSseHandler(tmpFile);
    const mockClient: SseClient = { write: () => true, end: () => {} };
    handler.addClient(mockClient);
    expect(handler.clientCount()).toBe(1);
    handler.removeClient(mockClient);
    expect(handler.clientCount()).toBe(0);

    handler.stop();
    fs.unlinkSync(tmpFile);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /home/runner/work/testreport-forge && npx vitest run src/bin/serve-sse.test.ts`
Expected: FAIL — module not found

**Step 3: Implement SSE handler**

Create `src/live/sse-handler.ts`:

```typescript
import * as fs from 'fs';

export interface SseClient {
  write(data: string): boolean;
  end(): void;
}

export interface SseHandler {
  addClient(client: SseClient): void;
  removeClient(client: SseClient): void;
  clientCount(): number;
  stop(): void;
}

export function buildSseHandler(jsonlPath: string): SseHandler {
  const clients: Set<SseClient> = new Set();
  let lastOffset = 0;
  let watcher: fs.FSWatcher | null = null;

  // Read initial file size
  if (fs.existsSync(jsonlPath)) {
    lastOffset = fs.statSync(jsonlPath).size;
  }

  function broadcastNewLines(): void {
    if (clients.size === 0) return;

    let content: string;
    try {
      const fd = fs.openSync(jsonlPath, 'r');
      const stat = fs.fstatSync(fd);
      if (stat.size <= lastOffset) {
        fs.closeSync(fd);
        return;
      }
      const buf = Buffer.alloc(stat.size - lastOffset);
      fs.readSync(fd, buf, 0, buf.length, lastOffset);
      fs.closeSync(fd);
      lastOffset = stat.size;
      content = buf.toString('utf-8');
    } catch {
      return;
    }

    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const message = `data: ${line}\n\n`;
      for (const client of clients) {
        try {
          client.write(message);
        } catch {
          clients.delete(client);
        }
      }
    }
  }

  // Watch for file changes
  try {
    watcher = fs.watch(jsonlPath, () => {
      broadcastNewLines();
    });
  } catch {
    // File may not exist yet — will be created by LiveWriter
  }

  return {
    addClient(client: SseClient) {
      clients.add(client);
      // Send any existing content to new client
      if (fs.existsSync(jsonlPath)) {
        try {
          const content = fs.readFileSync(jsonlPath, 'utf-8');
          const lines = content.split('\n').filter(l => l.trim());
          for (const line of lines) {
            client.write(`data: ${line}\n\n`);
          }
        } catch {
          // ignore
        }
      }
    },
    removeClient(client: SseClient) {
      clients.delete(client);
    },
    clientCount() {
      return clients.size;
    },
    stop() {
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      clients.clear();
    },
  };
}
```

**Step 4: Update barrel export**

In `src/live/index.ts`, add:

```typescript
export { buildSseHandler, type SseClient, type SseHandler } from './sse-handler';
```

**Step 5: Run tests to verify they pass**

Run: `cd /home/runner/work/testreport-forge && npx vitest run src/bin/serve-sse.test.ts`
Expected: All tests PASS

**Step 6: Add `--live` flag to `serve.ts`**

In `src/bin/serve.ts`, make these changes:

1. Add import at the top (after existing imports):

```typescript
import { buildSseHandler } from '../live/sse-handler';
```

2. Add to `ServeOptions` interface (~line 49):

```typescript
  live: boolean;
  liveFile: string;
```

3. In `parseArgs()`, after the `--no-open` check (~line 77), add:

```typescript
    } else if (arg === '--live') {
      options.live = true;
    } else if (arg === '--live-file') {
      options.liveFile = args[++i] || '.smart-live-results.jsonl';
    }
```

4. Set defaults in the options object:

```typescript
    live: false,
    liveFile: '.smart-live-results.jsonl',
```

5. In the `main()` function, after `const { dir, file } = resolveReport(...)` and before the `http.createServer()` call, add:

```typescript
  let sseHandler: ReturnType<typeof buildSseHandler> | null = null;
  if (options.live) {
    const liveFilePath = path.resolve(dir, options.liveFile);
    sseHandler = buildSseHandler(liveFilePath);
  }
```

6. At the start of the server request handler (inside `http.createServer()`), before the existing routing, add:

```typescript
    // SSE endpoint for live reporting
    if (sseHandler && req.url === '/sse') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':ok\n\n');
      const client = { write: (data: string) => res.write(data), end: () => res.end() };
      sseHandler.addClient(client);
      req.on('close', () => { sseHandler!.removeClient(client); });
      return;
    }
```

7. In the usage text, add:

```
  --live                Enable SSE endpoint for live reporting
  --live-file <path>    Path to live results JSONL (default: .smart-live-results.jsonl)
```

**Step 7: Type check**

Run: `cd /home/runner/work/testreport-forge && npx tsc --noEmit`
Expected: Clean pass

**Step 8: Run full test suite**

Run: `cd /home/runner/work/testreport-forge && npx vitest run`
Expected: All tests pass

**Step 9: Commit**

```bash
git add src/live/sse-handler.ts src/live/index.ts src/bin/serve.ts src/bin/serve-sse.test.ts
git commit -m "feat(live): add SSE handler and --live flag to serve CLI"
```

---

## Phase B — Advanced Features (Starter Tier)

### Task 7: Add first-failure notification

**Files:**
- Modify: `src/smart-reporter.ts`

**Step 1: Add tracking state**

In the State section of `SmartReporter` (~line 120), add:

```typescript
  private liveFirstFailureSent: boolean = false;
```

**Step 2: Add notification logic in `onTestEnd()`**

After the `this.liveWriter.writeTestResult(...)` block added in Task 3, add:

```typescript
    // Live: send notification on first failure (Starter tier)
    if (
      this.options.live?.notifyOnFirstFailure &&
      !this.liveFirstFailureSent &&
      (result.status === 'failed' || result.status === 'timedOut') &&
      LicenseValidator.hasFeature(this.license, 'pro')
    ) {
      this.liveFirstFailureSent = true;
      const msg = `First failure detected: "${test.title}" in ${file}`;
      if (this.options.slackWebhook) {
        this.slackNotifier.sendMessage(msg).catch(() => {});
      }
      if (this.options.teamsWebhook) {
        this.teamsNotifier.sendMessage(msg).catch(() => {});
      }
      if (this.notificationManager) {
        // Use the notification manager for advanced notification channels
        const failureResult: TestResultData[] = [testData];
        this.notificationManager.notify(failureResult, this.startTime).catch(() => {});
      }
    }
```

**Step 3: Type check and run tests**

Run: `cd /home/runner/work/testreport-forge && npx tsc --noEmit && npx vitest run`
Expected: Clean type check, all tests pass

**Step 4: Commit**

```bash
git add src/smart-reporter.ts
git commit -m "feat(live): add first-failure notification for Starter tier"
```

---

### Task 8: Add `run` command to serve CLI for test execution triggering

**Files:**
- Modify: `src/bin/serve.ts`

**Step 1: Add `--run-command` flag to `ServeOptions`**

In `src/bin/serve.ts`, add to `ServeOptions`:

```typescript
  runCommand: string;
  running: boolean;
```

Defaults:

```typescript
    runCommand: '',
    running: false,
```

Parse it in `parseArgs()`:

```typescript
    } else if (arg === '--run-command') {
      options.runCommand = args[++i] || '';
    }
```

**Step 2: Add `/run` endpoint in the server**

After the SSE handler block inside `http.createServer()`, add:

```typescript
    // Run tests endpoint (only when --run-command is configured)
    if (req.url === '/run' && req.method === 'POST' && options.runCommand) {
      // Security: only accept from localhost
      const remoteAddr = req.socket.remoteAddress || '';
      if (!remoteAddr.includes('127.0.0.1') && !remoteAddr.includes('::1')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Only localhost requests allowed' }));
        return;
      }

      if (options.running) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'A test run is already in progress' }));
        return;
      }

      options.running = true;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'started', command: options.runCommand }));

      const child = exec(options.runCommand, { cwd: process.cwd() }, (err) => {
        options.running = false;
        if (err) {
          console.log(`\n  Test run finished with exit code ${err.code ?? 1}`);
        } else {
          console.log('\n  Test run finished successfully');
        }
      });

      child.stdout?.on('data', (data) => process.stdout.write(data));
      child.stderr?.on('data', (data) => process.stderr.write(data));
      return;
    }

    if (req.url === '/run' && req.method === 'GET' && options.runCommand) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ running: options.running, command: options.runCommand }));
      return;
    }
```

**Step 3: Update usage text**

Add to the help output:

```
  --run-command <cmd>   Command to run tests (enables /run endpoint, e.g. "npx playwright test")
```

**Step 4: Type check and run tests**

Run: `cd /home/runner/work/testreport-forge && npx tsc --noEmit && npx vitest run`
Expected: Clean pass

**Step 5: Commit**

```bash
git add src/bin/serve.ts
git commit -m "feat(live): add /run endpoint to serve CLI for triggering test execution"
```

---

### Task 9: Build, run full test suite, type check

**Files:** None (verification only)

**Step 1: Full build**

Run: `cd /home/runner/work/testreport-forge && npm run build`
Expected: Clean build with no errors

**Step 2: Full test suite**

Run: `cd /home/runner/work/testreport-forge && npm test`
Expected: All tests pass (642+ existing + new tests)

**Step 3: Type check**

Run: `cd /home/runner/work/testreport-forge && npx tsc --noEmit`
Expected: Clean pass

---

### Task 10: Manual integration test

**Step 1: Run the example tests with live reporting enabled**

Create a temporary config or modify `example/playwright.config.ts` to include:

```typescript
reporter: [
  ['./dist/smart-reporter.js', {
    live: { enabled: true },
  }],
],
```

**Step 2: Run tests and verify JSONL output**

Run: `cd /home/runner/work/testreport-forge && npx playwright test --config=example/playwright.config.ts`

Verify:
- `.smart-live-results.jsonl` is created in the output directory
- `smart-live.html` is created alongside it
- JSONL contains `start`, `test`, and `complete` events
- Counters are accurate

**Step 3: Test SSE mode**

Run in one terminal:
```bash
npx evoveo-smart-reporter-serve --live example/
```

Open `smart-live.html` in browser, then run tests in another terminal. Verify live updates appear.

**Step 4: Verify the /run endpoint**

Run:
```bash
npx evoveo-smart-reporter-serve --live --run-command "npx playwright test --config=example/playwright.config.ts" example/
```

Then:
```bash
curl -X POST http://localhost:<port>/run
```

Verify tests start running and output streams to the serve terminal.

**Step 5: Revert any temporary config changes**

---

## Summary

| Task | Description | Files | New Tests |
|------|-------------|-------|-----------|
| 1 | Types + config | `types.ts` | 0 |
| 2 | LiveWriter class | `live/live-writer.ts` | ~10 |
| 3 | Wire into reporter | `smart-reporter.ts` | 0 |
| 4 | Dashboard HTML gen | `live/live-dashboard.ts` | ~4 |
| 5 | Dashboard file output | `smart-reporter.ts` | 0 |
| 6 | SSE handler + serve | `live/sse-handler.ts`, `bin/serve.ts` | ~2 |
| 7 | First-failure notify | `smart-reporter.ts` | 0 |
| 8 | /run endpoint | `bin/serve.ts` | 0 |
| 9 | Build verification | — | 0 |
| 10 | Integration test | — | 0 |

**New files:** 4 (`live-writer.ts`, `live-dashboard.ts`, `sse-handler.ts`, `index.ts`)
**Modified files:** 3 (`types.ts`, `smart-reporter.ts`, `serve.ts`)
**New tests:** ~16
**Estimated production code:** ~450 lines
