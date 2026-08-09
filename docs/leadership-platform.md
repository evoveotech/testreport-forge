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
| OIDC | `--auth oidc --oidc-url <url>` | Enterprise SSO (Keycloak, Okta, Google) — native OIDC flow |
| SAML | `--auth saml` | SAML via **gateway delegation** (mod_auth_mellon, Shibboleth) |

### SAML — Gateway Delegation (not native assertion parsing)

SAML mode does **not** parse SAML assertions natively. Instead, it trusts
headers set by an external SAML gateway (Apache `mod_auth_mellon`,
Shibboleth, or an NGINX auth proxy). The gateway handles the SAML protocol,
assertion validation, and IdP communication; the dashboard receives the
authenticated user identity via headers (e.g. `X-Authenticated-User`,
`X-Tenant-Id`).

This is the standard enterprise pattern for SAML in Node.js applications
that do not want to depend on the `saml2-js` XMLDSig stack. It is
pragmatic and secure **when the gateway is configured correctly** — the
dashboard must be deployed behind the gateway and must never be directly
reachable from the network without it.

## Storage Backends

| Backend | When to use | Setup |
|---------|-------------|-------|
| **FileStore** (local) | Local dev, small teams, single machine | Default — just `--data-dir ./data` |
| **OneDriveStore** (M365) | Enterprise with Microsoft 365, no Docker/Postgres | Director connects via Settings → OAuth → share folder |
| **GoogleDriveStore** (Google Workspace) | Enterprise with Google Workspace, no Docker/Postgres | Director connects via Settings → OAuth → share folder |
| **Postgres** (future) | Large estates (10k+ runs), production scale | ADR-002 — not yet implemented |

### Cloud Storage Flow (No Docker, No Postgres)

```
1. Director opens dashboard → Settings tab → "Connect Cloud Storage"
2. Chooses OneDrive (M365) or Google Drive (Google Workspace)
3. Enters OAuth client ID/secret (from Azure AD / Google Cloud Console)
4. OAuth redirect → consent → tokens saved
5. Data stored as JSONL in the Director's cloud drive folder
6. Director shares the folder with their team via M365/Google sharing
7. Team members: run dashboard → Settings → connect to same shared folder
8. Everyone views results through the dashboard UI — no one opens raw files
```

The cloud drive IS the shared database. No Docker, no Postgres, no
infrastructure to deploy. Every enterprise already has M365 or Google
Workspace.

## ADRs

See `docs/adr/` for architecture decision records:
- ADR-001: Reuse existing normalization layer
- ADR-002: File store now, Postgres with partitions deferred to production scale
- ADR-003: Tenant isolation enforced at the store boundary (self-hosted first)
- ADR-004: Single-run HTML report is the drilldown target
- ADR-005: Org context stamped at ingest, never inferred
- ADR-006: All four team-contribution metrics ship in v1
- ADR-007: Legacy stacks use file-drop only, no custom parsers
- ADR-008: Cloud drive as shared storage for no-Docker enterprises

## Benchmark

10,000 runs: ingest 3.6s, estate rollup 39ms (FileStore, local disk).

## Test Suite

112 tests covering types, store (incl. 4 security-critical tenant isolation
tests), ingest (incl. real JUnit XML end-to-end), HTTP handler, aggregator,
dashboard API (incl. auth denial + cross-tenant 404), auth providers
(OIDC/SAML/RBAC/metering), connectors (glob matching + team attribution),
retention, and cloud storage settings (OAuth URL generation, config
round-trip, token redaction, connect/disconnect flows).
