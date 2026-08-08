# Memory Usage Analysis: evoveo-smart-reporter in GitHub Actions

**Date:** 2026-03-01
**Context:** User feedback — comparing smart-reporter to Allure (which caused memory issues), asking about GitHub Actions pipeline compatibility and memory footprint at 50+ spec files and growing.

---

## TL;DR

Evoveo Smart Reporter's architecture is **fundamentally different from Allure** and uses significantly less memory. Allure runs a full Java/JVM server to generate reports, while Evoveo Smart Reporter is a lightweight Node.js Playwright reporter that runs in-process. For a **50-spec suite**, expect:

| Metric | Estimated Value |
|--------|----------------|
| Peak Node.js heap (report generation) | **150–400 MB** |
| Output HTML file size | **15–50 MB** |
| GitHub Actions compatibility | Works on `ubuntu-latest` (7 GB RAM) with headroom |

For comparison, Allure Report generation commonly requires **1–2 GB+ JVM heap** for similar-sized suites and can OOM on constrained CI runners.

---

## How It Works in GitHub Actions

Evoveo Smart Reporter implements Playwright's `Reporter` interface. It runs inside the same Node.js process as `npx playwright test` — no separate server, no JVM, no background processes.

**Lifecycle:**
1. `onBegin()` — loads history JSON file (~280 KB for 10 runs of ~30 tests)
2. `onTestEnd()` — called per test completion; collects steps, screenshots, network logs, traces
3. `onEnd()` — assembles and writes the single HTML file, updates history

**No separate generation step is needed.** The report is ready the instant tests finish. This is a key advantage over Allure, which requires `allure generate` as a post-step (often the step that OOMs).

---

## Memory Hotspots (Priority Order)

### 1. Screenshot Base64 Encoding — Biggest Contributor

Every screenshot is read into memory and base64-encoded with **no size cap**. Base64 adds ~33% overhead.

**Current example report (12 MB):** 48 screenshots = **8.9 MB** of base64 data embedded in HTML (74% of file size).

**50-spec projection (screenshot: 'only-on-failure', ~20% failure rate):**
- ~10 failing tests × 2 retries × ~100 KB screenshot = ~2 MB raw → ~2.7 MB base64
- With `screenshot: 'on'` (all tests): 50 tests × ~100 KB = 5 MB raw → ~6.7 MB base64

**100-spec projection with 3 browser projects (screenshot: 'on'):**
- 300 test results × ~100 KB = 30 MB raw → ~40 MB base64

### 2. Trace Data Embedding — Potentially Huge

Traces for failed tests are base64-encoded if under `maxEmbeddedSize` (default: **5 MB per trace**).

- 10 failing tests × 5 MB trace × 1.33 base64 overhead = **~67 MB** held in `resultsMap`
- This data is stripped before HTML embedding (so it doesn't inflate the file), but it **stays in Node.js heap** during the entire `onEnd()` execution

**Finding:** The `traceData` field is stored on test results but never rendered by the HTML card generator. The trace viewer uses file paths, not base64 data. This appears to be dead code that wastes memory.

### 3. Network Log Extraction via adm-zip

For each test with a trace, the entire ZIP file is decompressed into memory by `adm-zip`:
- Trace files range from 500 KB to 20+ MB
- Only one is loaded at a time (sequential in `onTestEnd`)
- Peak: one decompressed trace in memory (~5–20 MB) plus parsed network entries

### 4. HTML Assembly — All In Memory

The final HTML string is assembled entirely in memory before `fs.writeFileSync`:
- Card HTML for all tests (with embedded base64 screenshots)
- `testsJson` blob (JSON.stringify of all results minus screenshots)
- Inline CSS (~164 KB), JS (~1.1 MB including JSZip library)
- History run snapshots (when `enableHistoryDrilldown: true`)

**No streaming write.** Peak memory holds: original results array + lightened copy + JSON string + final HTML string.

### 5. History & Drilldown Snapshots

- History JSON loaded at startup: ~28 KB per 100 tests per run × 10 runs = **~280 KB** (minimal)
- History drilldown (`enableHistoryDrilldown: true`): reads ALL per-run snapshot files into memory simultaneously, then serializes into HTML

---

## Estimated Memory Budget: 50 Specs on GitHub Actions

**GitHub Actions `ubuntu-latest` provides 7 GB RAM.** Playwright itself uses ~200–500 MB (browser + Node process).

| Component | 50 specs (conservative) | 50 specs (worst case) |
|-----------|------------------------|-----------------------|
| Playwright (browser + runtime) | 300 MB | 500 MB |
| Evoveo Smart Reporter results in heap | 20 MB | 80 MB |
| Screenshot base64 (only-on-failure) | 3 MB | 15 MB |
| Trace base64 in heap (dead code) | 0 MB | 67 MB |
| Network log peak (one trace at a time) | 10 MB | 20 MB |
| HTML assembly peak | 30 MB | 100 MB |
| History + drilldown snapshots | 1 MB | 10 MB |
| **Total estimated peak** | **~365 MB** | **~790 MB** |

**Verdict: Fits comfortably in GitHub Actions** even at worst case. You'd need **500+ spec files** with full screenshots + trace embedding + all features enabled to approach memory pressure.

---

## Comparison: Evoveo Smart Reporter vs Allure

| Aspect | Evoveo Smart Reporter | Allure Report |
|--------|---------------|---------------|
| Runtime | Node.js (in-process) | Java/JVM (separate process) |
| JVM heap requirement | N/A | 512 MB–2 GB+ |
| Report generation | Inline during `onEnd()` | Separate `allure generate` step |
| Output format | Single HTML file (self-contained) | Directory of HTML + JS + JSON files |
| Screenshot handling | Base64 inline | Files on disk, referenced by path |
| Memory scaling factor | Linear with test count | Superlinear (JVM GC pressure) |
| CI runner OOM risk | Low | High (known issue with 50+ tests) |

---

## Recommendations for Users with 50+ Specs

### Minimal Config (Lowest Memory)

```typescript
reporter: [
  ['list'],
  ['evoveo-smart-reporter', {
    outputFile: 'smart-report.html',
    maxHistoryRuns: 5,
    enableNetworkLogs: false,     // Skip trace ZIP decompression
    enableHistoryDrilldown: false, // Don't load run snapshots
    enableTraceViewer: false,      // Saves 98 KB JSZip from HTML
    cspSafe: true,                 // Screenshots saved to files, not base64
  }],
],
```

### Balanced Config (Recommended for CI)

```typescript
reporter: [
  ['list'],
  ['evoveo-smart-reporter', {
    outputFile: 'smart-report.html',
    maxHistoryRuns: 10,
    enableNetworkLogs: true,
    networkLogMaxEntries: 20,      // Reduce per-test entries
    enableHistoryDrilldown: false,  // Enable only if needed
    maxEmbeddedSize: 2 * 1024 * 1024, // Cap trace embedding at 2 MB
  }],
],
```

### GitHub Actions Workflow Tips

```yaml
- run: npx playwright test
  env:
    NODE_OPTIONS: '--max-old-space-size=2048'  # 2 GB heap limit (rarely needed)
```

---

## Opportunities for Improvement

### High Impact

1. **Remove dead `traceData` base64 storage** — The `testData.traceData` field (smart-reporter.js:355) is stored in `resultsMap` but never used by the HTML generator. The trace viewer reads from `tracePath` and `attachments.traces`. Removing this would eliminate the largest per-failure memory cost (up to 6.7 MB per test).

2. **Add `maxScreenshotSize` option** — Screenshots currently have no size cap for base64 encoding. Adding a cap (e.g., 500 KB) would prevent outlier screenshots from bloating memory.

3. **Stream HTML output** — Replace `fs.writeFileSync(outputPath, report.html)` with a streaming write. The HTML generator could yield sections instead of building a single enormous string.

### Medium Impact

4. **Use streaming ZIP reader for network logs** — Replace `adm-zip` (loads entire ZIP into memory) with a streaming alternative like `yauzl` that reads entries on demand.

5. **Null out `traceData` after lightening** — If `traceData` must be kept for some edge case, explicitly null it on each result object after `lightenedResults` is computed, allowing GC to reclaim that memory before HTML assembly.

6. **Lazy-load JSZip** — Instead of inlining the 98 KB JSZip source in every report, load it from a CDN with a local fallback.

### Low Impact

7. **Cap base64 screenshots in `attachment-collector`** — Add a size check before `buffer.toString('base64')` similar to the trace `maxEmbeddedSize` pattern.

8. **Progressive history loading** — Only load the last 2 runs into memory for comparison; load older runs on demand if drilldown is enabled.
