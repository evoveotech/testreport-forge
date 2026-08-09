# ADR-006: All four team-contribution metrics ship in v1

**Status:** Accepted
**Date:** 2026-08-09

## Context

User confirmed the dashboard should surface all four team-contribution
metrics: runs executed, pass rate, flakiness owned, tests authored, and
fixes landed. The first three come from the run store. Tests-authored and
fixes-landed require mapping commits and issues to teams, which the run
store does not have.

## Decision

Add a **connectors layer** (`src/connectors/`, Task 7b) that pulls from
GitHub/GitLab (commits touching test files -> testsAuthored) and
Jira/Linear (issues closed -> fixesLanded), mapped to teams via per-tenant
config. `TeamContribution` carries all four fields.

## Consequences

- **Positive:** Leadership sees productivity + quality in one view.
- **Negative:** A new subsystem (connectors) with per-tenant credentials and
  rate limits. This is the largest scope add vs the original MVP.
- **Negative:** Tests-authored and fixes-landed are 0 until a connector is
  configured for a tenant.

## Verification

`TeamContribution` type carries all four fields. Connector implementation
and integration tests are Task 7b.
