# Test Intelligence Platform

A multi-tenant leadership dashboard for enterprise test intelligence, layered
on top of the `evoveo-smart-reporter` normalization layer.

## Quick Start

```bash
# Build
npm run build

# Boot the entire platform in one command
npx evoveo-smart-reporter-dashboard --port 3000 --data-dir ./data

# Ingest a test run (dev mode)
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: acme' -H 'X-User-Id: u1' -H 'X-User-Role: admin' \
  -d '{
    "orgContext": {
      "tenantId": "acme", "client": "c1", "product": "p1",
      "team": "qa-a", "stack": "junit", "runType": "nightly", "environment": "ci"
    },
    "format": "junit",
    "rawArtifact": "<testsuites><testsuite name=\"s\" tests=\"10\" failures=\"1\"><testcase name=\"ok\"/><testcase name=\"bad\"><failure>boom</failure></testcase></testsuite></testsuites>"
  }'

# Open the dashboard
open http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard SPA                         │
│  (vanilla JS, zero deps -- estate, teams, runs, login)   │
└──────────────────────────┬──────────────────────────────┘
                           │ REST API
┌──────────────────────────┴──────────────────────────────┐
│                   Dashboard API                          │
│  (auth middleware → tenant-scoped routes → aggregator)   │
└──────┬──────────┬──────────┬──────────┬─────────────────┘
       │          │          │          │
  ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼──────────┐
  │ Store  │ │ Agg    │ │ Auth   │ │ Usage Meter  │
  │ (File/ │ │ (rollup│ │ (Dev/  │ │ (File/Null)  │
  │  PG)   │ │  trend)│ │  OIDC/ │ │              │
  │        │ │        │ │  SAML) │ │              │
  └────▲───┘ └────────┘ └────────┘ └──────────────┘
       │
  ┌────┴──────────────────────────┐
  │     Ingest Service            │
  │  (validate → adapter → stamp  │
  │   OrgContext → persist)       │
  └────▲───────────────────▲──────┘
       │                   │
  ┌────┴──────┐    ┌───────┴────────┐
  │ HTTP POST │    │ File-Drop      │
  │ /api/ingest│   │ Watcher (legacy│
  │           │    │  / air-gapped) │
  └───────────┘    └────────────────┘
```

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| Types | `src/types.ts` | OrgContext, IngestedRun, EstateRollup, TeamContribution |
| Store | `src/store/` | Store interface + FileStore (JSONL, zero deps) |
| Ingest | `src/ingest/` | Validation, adapter routing, OrgContext stamping, HTTP handler |
| Aggregator | `src/aggregator/` | Estate rollup, slices, trend, team contribution |
| Dashboard API | `src/dashboard/` | REST endpoints, auth providers, RBAC, usage metering |
| Connectors | `src/connectors/` | GitHub/GitLab (testsAuthored), Jira/Linear (fixesLanded) |
| Retention | `src/retention/` | Nightly archival >90d, 3yr hard deletion |
| Bins | `src/bin/` | ingest, dashboard, serve, cli |

## Auth Modes

| Mode | Flag | Use Case |
|------|------|----------|
| Dev | `--auth dev` | Local development (trusts headers) |
| OIDC | `--auth oidc --oidc-url <url>` | Enterprise SSO (Keycloak, Okta, Google) |
| SAML | `--auth saml` | SAML gateway (mod_auth_mellon, Shibboleth) |

## ADRs

See `docs/adr/` for architecture decision records:
- ADR-001: Reuse existing normalization layer
- ADR-002: File store now, Postgres with partitions for production
- ADR-003: Tenant isolation enforced at the store boundary
- ADR-004: Single-run HTML report is the drilldown target
- ADR-005: Org context stamped at ingest, never inferred
- ADR-006: All four team-contribution metrics ship in v1
- ADR-007: Legacy stacks use file-drop only, no custom parsers

## Benchmark

10,000 runs: ingest 3.6s, estate rollup 39ms (FileStore, local disk).

## Test Suite

98 tests covering types, store (incl. 4 security-critical tenant isolation
tests), ingest (incl. real JUnit XML end-to-end), HTTP handler, aggregator,
dashboard API (incl. auth denial + cross-tenant 404), auth providers
(OIDC/SAML/RBAC/metering), connectors (glob matching + team attribution),
and retention.
