# ADR-004: The single-run HTML report is the drilldown target, not replaced

**Status:** Accepted
**Date:** 2026-08-09

## Context

The repo already produces an excellent interactive single-run HTML report
with quality gates, quarantine, suite health grades, failure clustering,
trace viewer, and AI failure analysis. Teams trust it. Rebuilding it for the
leadership platform would be a massive scope increase and would lose that
trust.

## Decision

The leadership dashboard is the **index** over thousands of runs; the
existing single-run HTML report is the **detail**. `IngestedRun.reportPath`
stores a relative path to the generated HTML report. The dashboard's
drilldown action serves that existing report unchanged.

## Consequences

- **Positive:** No report rebuild — massive scope saving. Teams keep the
  report they trust.
- **Positive:** The dashboard stays focused on aggregation, not rendering.
- **Negative:** The dashboard depends on the report artifact being
  persisted/accessible at `reportPath`. Object storage is the production
  path; the store holds only the path + summary.

## Verification

`IngestedRun.reportPath` is an optional field on the persisted run type,
populated from `IngestPayload.reportPath`. Drilldown wiring is implemented
in Task 10.
