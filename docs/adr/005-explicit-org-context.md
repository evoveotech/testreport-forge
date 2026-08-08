# ADR-005: Org context is stamped at ingest, never inferred

**Status:** Accepted
**Date:** 2026-08-09

## Context

The leadership platform slices the estate by client, product, team, stack,
run-type, and environment. At 10k+ clients, inferring this metadata from
CI environment variables, branch names, or commit messages is brittle and
inconsistent — every team does it differently, and wrong attribution
corrupts leadership views silently.

## Decision

Every ingested run MUST carry an explicit `OrgContext`
(tenantId/client/product/team/stack/runType/environment). The `IngestService`
validates that all required fields are non-empty strings and that `runType`
is a valid variant. A payload missing org context is **rejected**, not
accepted with defaults.

## Consequences

- **Positive:** Attribution is trustworthy and consistent across the estate.
- **Positive:** Rejection of un-attributed runs prevents silent dashboard
  pollution.
- **Negative:** Each CI pipeline must be configured to send org context — a
  one-time wiring cost per pipeline. This is the adoption tax for trustworthy
  leadership views.

## Verification

`src/ingest/ingest-service.test.ts > validation` has tests for: missing
orgContext, empty required field, invalid runType — all rejected with
specific error messages.
