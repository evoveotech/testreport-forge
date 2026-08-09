# ADR-001: Reuse the existing normalization layer for ingestion

**Status:** Accepted
**Date:** 2026-08-09

## Context

The leadership dashboard must aggregate test runs from many frameworks
(Playwright, JUnit XML, TRX, Newman, Selenium, SoapUI, Jest, Vitest, Pytest,
RestSharp) across thousands of clients. The hardest problem is normalizing
all those formats into one schema. The repo already solves this: `src/adapters/`
contains JUnit, TRX, Newman, and generic JSON adapters that produce the
reporter's internal `TestResultData[]` model, and `src/report-generator.ts`
turns that into the single-run HTML report.

## Decision

All ingestion flows through the existing `src/adapters/*` registry. The new
`IngestService` calls `getAdapter(format)` / `detectAdapter(content)` and
`adapter.ingest(ctx)` to parse raw artifacts, then computes a `RunSummary`
from the resulting `TestResultData[]`. No new framework parsers are written.

## Consequences

- **Positive:** Framework fidelity is preserved for free. The drilldown report
  is the same artifact teams already trust. Zero duplicated parsing logic.
- **Positive:** New frameworks supported by the adapter registry are
  automatically available to the leadership platform.
- **Negative:** The leadership platform is bounded by what the adapters can
  parse. A framework with no adapter must emit generic JSON (ADR-007).

## Verification

`src/ingest/ingest-service.test.ts` posts a real JUnit XML payload through
the adapter and asserts the persisted `RunSummary` has the correct
total/passed/failed/skipped counts.
