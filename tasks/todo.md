# TODO -- Leadership Test Intelligence Dashboard

> Branch: `feat/leadership-dashboard`. Plan: `tasks/plan.md`. Idea: `docs/ideas/leadership-dashboard.md`.
> Update this file as tasks complete (Loop Engineering spine).
>
> USER DECISIONS (confirmed): self-hosted + SaaS, 3yr retention, all four team
> metrics, file-drop-only for legacy.

## Phase 1: Foundation

- [ ] Task 1: Add OrgContext/IngestedRun/EstateRollup/RollupSlice/TeamContribution types + tests
- [ ] Task 2: src/store/ (Store iface + SQLite + Postgres w/ monthly partitions + RLS + region config)
- [ ] Task 3: src/ingest/ (validation, OrgContext stamping, adapter routing, persist) + tests
- [ ] Task 4: evoveo-smart-reporter-ingest bin (HTTP + file-drop watcher; legacy = generic JSON)

### Checkpoint: Foundation
- [ ] npm run build clean
- [ ] npm test green
- [ ] POST a JUnit payload w/ OrgContext -> read back from store
- [ ] RLS test: tenant A cannot read tenant B
- [ ] ADR-001..007 written to docs/adr/

## Phase 2: Aggregation + Dashboard API

- [ ] Task 5: src/aggregator/ (EstateRollup, slices, trend, team contribution; reuse HealthDigest)
- [ ] Task 6: src/dashboard/api.ts (REST endpoints + tenant scoping)
- [ ] Task 7: OIDC + SAML SSO + RBAC + usage metering emitter (SaaS billing)

## Phase 2b: Connectors (team attribution + retention)

- [ ] Task 7b: src/connectors/ (GitHub/GitLab -> testsAuthored; Jira/Linear -> fixesLanded)
- [ ] Task 7c: Retention job (nightly archival >90d, enforce 3yr policy, audit log)

### Checkpoint: Aggregation + API + Connectors
- [ ] npm test green; API + RBAC denial tests pass
- [ ] Tenant isolation test proves A cannot see B (RLS)
- [ ] All four team metrics populated for one seeded tenant

## Phase 3: Dashboard UI

- [ ] Task 8: Estate rollup view (KPIs, trend, heatmaps) -- responsive, WCAG AA
- [ ] Task 9: Team contribution (all 4 metrics) + PR-vs-nightly comparison views
- [ ] Task 10: Drilldown -> existing single-run HTML report (no rebuild)
- [ ] Task 11: OIDC/SAML login + tenant switcher + role-aware nav

### Checkpoint: Dashboard UI
- [ ] Browser-tested, no console errors, WCAG AA
- [ ] Drilldown end-to-end

## Phase 4: One command, scale, ship

- [ ] Task 12: evoveo-smart-reporter dashboard bin (boots ingest+store+API+UI)
- [ ] Task 13: Seed generator + 10k-client benchmark w/ 3yr history (<2s rollup) in benchmark/
- [ ] Task 14: Docs (README, docs/leadership-dashboard.md, AGENTS.md spine, CHANGELOG)
- [ ] Task 15: CI workflow .github/workflows/dashboard.yml (build, test, benchmark, artifact)

### Checkpoint: Complete
- [ ] All stopping criteria met (see tasks/plan.md)
- [ ] Maker/checker: separate agent/human verifies
- [ ] Ready for PR

## Resolved Questions (from user)

- Q1: Self-hosted + SaaS (both) -> ADR-003, RLS, region pinning, metering
- Q2: 3yr retention -> ADR-002, monthly partitions, hot/cold tiers, retention job (Task 7c)
- Q3: File-drop only for legacy -> ADR-007, no custom mainframe parser
- Q4: All four team metrics -> ADR-006, connectors layer (Task 7b)
