# Implementation Plan: Leadership Test Intelligence Dashboard

> Branch: `feat/leadership-dashboard`. Source skills: `planning-and-task-breakdown`,
> `technical-design-document`, `idea-refine`, `loop-engineering`, `autoresearch`.
> Idea one-pager: `docs/ideas/leadership-dashboard.md`.

## Recursive Goal (Loop Engineering)

```
GOAL: A self-hostable leadership dashboard that aggregates test runs across
      many clients/products/teams/stacks/run-types and lets a VP/SVP/Director
      see estate-wide status, trends, and team contribution in one view, with
      drilldown to the existing single-run HTML report.
STOPPING CRITERIA:
  - `npm run build` is clean (tsc passes)
  - `npm test` passes (existing + new tests green)
  - `evoveo-smart-reporter dashboard` boots ingest + store + UI from one command
  - A 10k-client synthetic benchmark loads the estate rollup in <2s
  - Drilldown from a rollup cell opens the existing single-run report
  - OIDC SSO login + RBAC enforced on every dashboard route
  - **SAML login works for a legacy enterprise IdP; tenant isolation proven
    by a row-level-security test (tenant A cannot read tenant B)**
  - **All four team-contribution metrics populated** (runs/passRate/flakiness
    from store; testsAuthored from git connector; fixesLanded from issue
    connector) for at least one seeded tenant
  - **3yr retention job runs and archives a partition older than 90d**
  - README + AGENTS.md updated; ADRs recorded for the 7 key decisions
MAX ITERATIONS: 25 (autoresearch default). Escalate to human after that.
```

## Overview

Add a multi-tenant aggregation layer on top of the existing per-run reporter.
The reporter already normalizes Playwright/JUnit/TRX/Newman/JSON into one
schema. We add: (1) an org-context-stamped ingestion service, (2) a time-series
store, (3) a leadership dashboard with rollups + drilldown to the existing
report. We do **not** rebuild the single-run report.

## Architecture Decisions (record as ADRs)

- **ADR-001 -- Reuse the existing normalization layer.** All ingestion flows
  through the existing `adapters/*` + `report-generator` so framework fidelity
  is preserved and the drilldown report is the same artifact teams already
  trust. *Rationale:* the hardest problem (one schema for every framework) is
  already solved; rebuilding it would lose adoption.
- **ADR-002 -- Postgres for the store, SQLite for local dev, partitioned by
  tenant+month with hot/cold tiers.** 10k clients x daily x **3yr** ~= tens
  of millions of rows -- still fine for Postgres with monthly range partitions
  on `runs`, a hot tier (last 90d) and a cold tier (archives >90d) with a
  retention-policy job. *Rationale:* user chose 3yr retention; partitioning +
  tiering keeps rollup queries fast without a warehouse on day one.
- **ADR-003 -- Ship BOTH self-hosted enterprise AND managed multi-tenant SaaS
  from day one.** Tenant isolation is enforced at the store layer (tenantId on
  every row + row-level security in Postgres) so the same codebase serves both
  deployments. Auth supports OIDC (SaaS + modern enterprise) AND SAML (legacy
  enterprise) via an adapter layer. Data residency is a per-tenant config
  (region pinning). Usage metering (runs ingested, seats) is emitted for
  billing in SaaS mode. *Rationale:* user chose self-hosted + SaaS; isolation
  must be designed in now, not bolted on.
- **ADR-004 -- The single-run HTML report is the drilldown target, not
  replaced.** The dashboard is the *index*; the report is the *detail*.
- **ADR-005 -- Org-context is stamped at ingest, not inferred.** Each run
  payload carries an explicit `OrgContext` (client/product/team/stack/run-type/
  env). Inference is brittle across 10k clients; explicit tagging is cheap.
- **ADR-006 -- All four team-contribution metrics ship in v1.** Runs executed
  + pass rate and flakiness-owned come from the run store directly. Tests
  authored and fixes landed require a new **connectors layer** (GitHub/GitLab
  + Jira/Linear) that maps commits/issues to teams. *Rationale:* user chose
  all four; the connector layer is the main scope add vs the original MVP.
- **ADR-007 -- Legacy stacks use file-drop only, no custom parsers.** Mainframe/
  COBOL/air-gapped systems drop any JSON/XML via the file-drop watcher and are
  treated as generic JSON. *Rationale:* user chose file-drop for legacy; covers
  the long tail without per-stack parser maintenance.

## Target Architecture

```
   CI pipelines (Playwright/JUnit/TRX/Newman/...) across the estate
        |  (emit normalized JSON via reporter hook OR raw file)
        v
   +-----------------------------+   file-drop / S3 / SFTP (legacy)
   |  ingest service            | <--- air-gapped fallback
   |  POST /runs  (JSON)        |
   |  - validates schema        |
   |  - stamps OrgContext       |
   |  - runs adapters/* if raw  |
   |  - writes run + summary    |
   +-------------+--------------+
                 |
                 v
   +-----------------------------+
   |  store (Postgres / SQLite)  |
   |  runs, run_summaries,       |
   |  health_digests,            |
   |  org_context, tenants,      |
   |  users, roles               |
   +-------------+--------------+
                 |
                 v
   +-----------------------------+        +---------------------------+
   |  dashboard API (REST)       | <----> |  dashboard UI (web)       |
   |  /estate, /client, /product |        |  rollups, trends, heat,   |
   |  /team, /stack, /runtype    |        |  team contribution,       |
   |  /runs/:id (drilldown)      |        |  drilldown -> HTML report |
   |  OIDC + SAML + RBAC + RLS   |        |  OIDC/SAML login          |
   +-----------------------------+        +---------------------------+
                 ^
                 |  (team attribution: tests authored, fixes landed)
   +-----------------------------+
   |  connectors layer           |
   |  - github / gitlab          |  commits touching test files -> team
   |  - jira / linear            |  issues closed -> team
   |  - usage metering (SaaS)    |  runs ingested + seats -> billing
   +-----------------------------+
```

**Tenancy & residency:** every row carries `tenantId`; Postgres row-level
security enforces isolation in SaaS mode. Per-tenant `region` config pins
storage region for data residency. A nightly retention job archives partitions
older than the hot tier (90d) to cold storage and enforces the 3yr policy.

## New Types (extension of `src/types.ts`)

```ts
export interface OrgContext {
  tenantId: string;       // the enterprise customer (multi-tenant key)
  client: string;         // external client/product line (e.g. "client-1042")
  product: string;        // product name (e.g. "payments-gateway")
  team: string;           // owning team (e.g. "payments-qa")
  stack: string;          // technology (e.g. "dotnet" | "playwright" | "newman")
  runType: 'pr' | 'nightly' | 'daily' | 'scheduled' | 'manual';
  environment: string;    // e.g. "prod" | "staging" | "dev"
}

export interface IngestedRun extends RunSummary {
  orgContext: OrgContext;
  reportPath?: string;    // relative path to the single-run HTML drilldown
  rawArtifactPath?: string;
}

export interface EstateRollup {
  asOf: string;
  totalRuns: number;
  passRate: number;
  flakyRate: number;
  byClient: RollupSlice[];
  byProduct: RollupSlice[];
  byTeam: TeamContribution[];
  byStack: RollupSlice[];
  byRunType: RollupSlice[];
  trend: TrendPoint[];    // last N days
}

export interface RollupSlice {
  key: string;
  totalRuns: number;
  passRate: number;
  flakyRate: number;
  deltaPct: number;       // vs previous period
}

export interface TeamContribution {
  team: string;
  runsExecuted: number;
  passRate: number;
  flakinessOwned: number;       // from run store
  testsAuthored: number;        // from git connector (commits touching test files)
  fixesLanded: number;          // from issue-tracker connector (issues closed by team)
}
```

## Task List

### Phase 1: Foundation (types, store, ingest core)

- [ ] **Task 1:** Add `OrgContext`, `IngestedRun`, `EstateRollup`, `RollupSlice`,
      `TeamContribution` types to `src/types.ts` + unit tests.
- [ ] **Task 2:** Create `src/store/` with a `Store` interface and a SQLite
      implementation (Postgres impl via same interface). Migrations for
      `runs`, `run_summaries`, `health_digests`, `org_context`, `tenants`,
      `users`, `roles`. **Postgres: monthly range partitions on `runs` by
      tenant+month, row-level security policies for tenant isolation,
      per-tenant `region` config for data residency.**
- [ ] **Task 3:** Create `src/ingest/` service: schema validation, OrgContext
      stamping, route raw files through existing `adapters/*`, persist run +
      summary + link to single-run HTML report. Unit tests with sample
      JUnit/TRX/Newman payloads.
- [ ] **Task 4:** `evoveo-smart-reporter-ingest` bin: HTTP server (`POST /runs`,
      `GET /health`) + file-drop watcher mode. CLI flags for port, store DSN,
      watch dir.

### Checkpoint: Foundation
- [ ] `npm run build` clean, `npm test` green
- [ ] Can POST a JUnit payload with OrgContext and read it back from the store
- [ ] ADR-001..005 written to `docs/adr/`

### Phase 2: Aggregation + Dashboard API

- [ ] **Task 5:** `src/aggregator/` -- build `EstateRollup` from the store:
      byClient/Product/Team/Stack/RunType slices, trend series, team
      contribution. Reuse `HealthDigest` logic for period math.
- [ ] **Task 6:** `src/dashboard/api.ts` -- REST endpoints: `/estate`,
      `/client/:c`, `/product/:p`, `/team/:t`, `/stack/:s`, `/runtype/:r`,
      `/runs/:id` (returns drilldown link to single-run HTML). Query params
      for period + tenant scoping.
- [ ] **Task 7:** OIDC SSO middleware + RBAC (viewer/admin per tenant).
      Session handling, route guards, tenant isolation in every query.
      **Add SAML adapter for legacy enterprise IdPs. Add usage metering
      emitter (runs ingested, seats) for SaaS billing mode.**

### Checkpoint: Aggregation + API
- [ ] `npm test` green; API tests cover every endpoint + RBAC denial cases
- [ ] Tenant A cannot see tenant B's data (test proves isolation)

### Phase 2b: Connectors (team attribution + metering)

- [ ] **Task 7b:** `src/connectors/` -- GitHub/GitLab connector: map commits
      touching test files to teams (tests authored). Jira/Linear connector:
      map issues closed to teams (fixes landed). Configurable per tenant.
- [ ] **Task 7c:** Retention job: nightly archival of partitions >90d to cold
      tier, enforce 3yr policy, emit audit log.

### Phase 3: Dashboard UI

- [ ] **Task 8:** `src/dashboard/ui/` -- estate rollup view: KPI cards
      (pass rate, flaky rate, total runs), trend chart, heatmaps by
      client/product/team/stack/run-type. Responsive + WCAG AA.
- [ ] **Task 9:** Team contribution view + PR-vs-nightly comparison view.
- [ ] **Task 10:** Drilldown: click any cell/run -> serve the existing
      single-run HTML report from the store. No report rebuild.
- [ ] **Task 11:** OIDC login page + tenant switcher + role-aware nav.

### Checkpoint: Dashboard UI
- [ ] Browser-tested (DevTools) with no console errors, WCAG AA on core views
- [ ] Drilldown opens the existing report end-to-end

### Phase 4: One command, scale, ship

- [ ] **Task 12:** `evoveo-smart-reporter dashboard` bin -- boots ingest +
      store + API + UI from one command (SQLite default, Postgres via DSN).
- [ ] **Task 13:** Seed generator + 10k-client benchmark in `benchmark/`;
      assert estate rollup loads <2s. **Seed includes 3yr of history to
      validate partitioning + archival.** Record results in `benchmark/`.
- [ ] **Task 14:** Docs: README section, `docs/leadership-dashboard.md`
      guide, update `AGENTS.md` spine, `CHANGELOG.md` entry.
- [ ] **Task 15:** CI workflow `.github/workflows/dashboard.yml` -- build,
      test, run benchmark, upload seed bundle as artifact.

### Checkpoint: Complete
- [ ] All stopping criteria met
- [ ] Maker/checker: a second agent (or human) verifies the stopping criteria
- [ ] Ready for review / PR

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OrgContext inference is brittle at 10k clients | High | ADR-005: explicit stamping at ingest, never inferred |
| Postgres not enough at scale | Med | A4 load test in Task 13; partition by tenant+month; warehouse is a later ADR |
| Enterprise SSO variants (SAML vs OIDC) | Med | OIDC first (most common); SAML via adapter layer later |
| Teams won't adopt the ingest endpoint | High | A2 pilot; ship a 1-line reporter hook + file-drop fallback for legacy |
| Drilldown report drift from stored schema | Med | Reuse exact `report-generator` output; pin version per run |
| Single-run HTML report is large at 10k runs | Med | Store reports in object storage; dashboard stores only path + summary |

## Open Questions (from idea-refine, need human input)

- Q1: Self-hosted only, or also managed SaaS? (affects auth + residency design)
- Q2: Minimum retention? 1yr / 3yr? (affects storage sizing)
- Q3: Legacy mainframe adapter needed now or later?
- Q4: Which "team contribution" metric does leadership want first?

## Verification (per Loop Engineering maker/checker)

- Build: `npm run build`
- Tests: `npm test` (existing suite must stay green)
- New tests: types, store, ingest, aggregator, API + RBAC, UI smoke
- Benchmark: `node benchmark/leadership-dashboard.js` <2s for 10k clients
- Manual: boot `evoveo-smart-reporter dashboard`, POST a sample run, view
  rollup, drilldown to single-run report, log in via OIDC
- Checker: a separate agent or human runs the stopping-criteria checklist
