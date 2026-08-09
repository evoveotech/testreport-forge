# ADR-009: Pipeline sources — pull-side CI ingestion with classification rules

**Status:** Accepted
**Date:** 2026-08-09
**Amends:** ADR-005 (explicit org context)

## Context

The leadership platform (ADR-001..008) is push-only: CI pipelines must POST to
`/runs`. At enterprise scale — hundreds of repos across Azure DevOps, GitHub
Actions, GitLab, AWS CodePipeline — rewiring every pipeline is a non-starter.
The missing half is a **pull/sync** agent that goes out to each CI system,
discovers runs, downloads test artifacts, and ingests them.

A pull connector fetches runs itself; nobody hands it `OrgContext` explicitly.
ADR-005 forbade inferring org context because branch-name/commit-message
inference is brittle at 10k+ clients and corrupts leadership views silently.
But requiring per-pipeline wiring for hundreds of repos is the adoption tax
that blocks the enterprise audience the platform serves.

## Decision

### 1. New `pipeline-sources` family

Add `src/pipeline-sources/` — a distinct family from the existing
`src/connectors/` (which pulls team-contribution metrics from git/issue
trackers). Each CI system is a `PipelineSource` implementing:

- `listRuns(since?)` — discover recent runs via the CI system's API.
- `downloadArtifact(ref)` — download the test artifact file (JUnit XML / TRX /
  Playwright JSON / etc.).
- `fetchRunMetadata(ref)` — fetch run sidecar metadata (commit, branch,
  trigger, duration, CI-run-URL).

Downloaded artifacts flow through the **existing adapter registry (ADR-001)**
→ `IngestService` → `Store`. The CI API is used for discovery + metadata only,
**not** as the test-data source. This keeps one normalization path for push and
pull, preserves the auditable artifact, and survives CI retention limits.

### 2. Classification-rules engine (amends ADR-005)

OrgContext for pulled runs is resolved by a **declared rules engine** in
`pipeline-sources.yaml`, not by free-form inference. Rules match on CI
structural signal — connector id, repo name regex, project path, file
signatures (`*.csproj`, `package.json`, `Info.plist`, `build.gradle`), pipeline
metadata — and map to an explicit `OrgContext` with template interpolation
(`${1}` from regex capture groups).

**A run that matches no rule is rejected** (quarantined for review), never
silently ingested. This preserves ADR-005's core guarantee — no silent
mis-attribution — while removing the per-pipeline wiring tax. One rules file
classifies hundreds of repos; exceptions are overridable per-pipeline.

ADR-005 is **amended** (not revoked): "never inferred" → "never inferred
*without an explicit classification rule*; unmatched runs are rejected."

### 3. Batch sync CLI

`evoveo-smart-reporter-sync` — a stateless CLI invoked by an external
scheduler (cron / k8s CronJob / Windows Task Scheduler / Azure DevOps
pipeline). Default daily cadence, configurable. No always-on daemon.

### 4. Idempotency + backfill

Run identity is a composite key `${connectorId}:${ciRunId}`. Re-syncing the
same CI run is an upsert no-op. First sync pulls full available history (up to
each CI system's retention limit); subsequent syncs are incremental via a
last-sync cursor persisted to `<dataDir>/sync-state.json`.

### 5. Auth model

Per-connector choice in `pipeline-sources.yaml`: PAT (fast brownfield),
OAuth/service-principal (Entra ID SP / GitHub App / GitLab OAuth), or
secrets-manager (Azure Key Vault / AWS Secrets Manager / HashiCorp Vault).
Tokens are referenced by env-var name, never stored inline in config.

### 6. Dashboard surface

Sync Health tab (per-connector last-sync time, runs pulled, failures, auth
errors, staleness alerts) + CI metadata on run detail (commit, branch,
trigger, CI-run-url) + filter runs by CI source. Rules-engine admin UI is
deferred.

## Consequences

- **Positive:** Adoption no longer requires rewiring every pipeline — one
  rules file + one scheduled job classifies and ingests the estate.
- **Positive:** One normalization path (adapters) for push and pull — no
  dual codepath drift.
- **Positive:** Auditable raw artifact preserved (compliance for
  fintech/health/insurance); dashboard history outlives CI retention.
- **Positive:** ADR-005's trust guarantee preserved — unmatched runs rejected,
  not silently mis-attributed.
- **Negative:** Classification rules file must be maintained as the estate
  grows — but it is one file, version-controlled, reviewable, far cheaper than
  per-pipeline wiring.
- **Negative:** CI API rate limits apply to discovery; mitigated by incremental
  sync cursor + per-connector rate-limit awareness.

## Verification

- `src/pipeline-sources/classification-engine.test.ts` — rule matching,
  interpolation, rejection of unmatched runs.
- `src/pipeline-sources/azure-devops-source.test.ts` — mocked API responses,
  run discovery + artifact download.
- `src/pipeline-sources/github-actions-source.test.ts` — artifact-only path.
- `src/pipeline-sources/sync-orchestrator.test.ts` — end-to-end with stub
  source → FileStore, composite-key idempotency, quarantine on no-rule-match.
