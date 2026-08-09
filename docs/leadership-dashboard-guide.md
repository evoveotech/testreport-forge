# Leadership Dashboard — User Guide

The Test Intelligence Platform is a multi-tenant leadership dashboard that
aggregates test runs across your entire enterprise — multiple clients,
products, teams, and technology stacks — into one view. It answers the
question every VP of Engineering asks: *"How healthy is our test estate?"*

This guide covers everything from booting the dashboard to configuring
cloud storage and connectors, with screenshots of every view.

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Seeding Sample Data](#2-seeding-sample-data)
3. [Login](#3-login)
4. [Estate Overview](#4-estate-overview)
5. [Team Contribution](#5-team-contribution)
6. [Recent Runs](#6-recent-runs)
7. [Period Comparison](#7-period-comparison)
8. [Sync Health](#8-sync-health)
9. [Settings — Cloud Storage](#9-settings--cloud-storage)
10. [Auth Modes (Dev, OIDC, SAML)](#10-auth-modes-dev-oidc-saml)
11. [Ingesting Test Runs](#11-ingesting-test-runs)
12. [Connectors (GitHub, Jira)](#12-connectors-github-jira)
13. [CLI Reference](#13-cli-reference)
14. [Architecture](#14-architecture)

---

## 1. Quick Start

```bash
# Build the project
npm run build

# Boot the dashboard with local file storage
npx evoveo-smart-reporter-dashboard --port 3000 --data-dir ./data

# Open the dashboard
open http://localhost:3000
```

The dashboard boots in one process: SPA + REST API + ingest endpoint.
No Docker, no Postgres, no external services required.

---

## 2. Seeding Sample Data

For demos and evaluation, seed the dashboard with 500 realistic runs
across 5 clients, 6 teams, and 8 technology stacks:

```bash
node dist/bin/seed-data.js --data-dir ./data --tenant acme
```

This populates:
- **5 clients**: fiserv-payments, globalbank-core, retailcorp-mobile,
  healthcare-platform, insuretech-bff
- **6 teams**: qa-payments, qa-banking, qa-mobile, qa-healthcare,
  qa-insurance, qa-platform
- **8 stacks**: playwright, junit, dotnet-trx, newman, cypress, xctest,
  espresso, selenium
- **500 runs** across the last 30 days with realistic pass rates,
  flakiness, and durations
- **Mock connector data**: testsAuthored and fixesLanded per team

---

## 3. Login

When you first open the dashboard, you see the login screen.

![Login (Dev Mode)](images/leadership-dashboard/login-dev.png)
*Dev mode login — enter any tenant ID, user ID, and role. Production uses OIDC or SAML SSO.*

In **dev mode** (`--auth dev`), enter any tenant ID, user ID, and select
a role (Admin or Viewer). This is for local development only.

In **production**, login is handled by your enterprise SSO:
- **OIDC**: Keycloak, Okta, Google Workspace, Azure AD
- **SAML**: via gateway delegation (mod_auth_mellon, Shibboleth)

See [Auth Modes](#10-auth-modes-dev-oidc-saml) for details.

---

## 4. Estate Overview

The default view after login. Shows the health of your entire test estate
at a glance.

![Estate Overview](images/leadership-dashboard/estate-overview.png)
*Estate overview: pass rate ring, KPI cards, and distribution by client/product/team/stack*

### What you see

- **Pass rate ring** (top-left sidebar): overall pass rate for the
  selected period, color-coded green/yellow/red
- **KPI cards**: total runs, pass rate, flaky rate, total tests
- **Period selector**: switch between daily, weekly, monthly, or all-time
- **Distribution cards**: runs and pass rate broken down by client,
  product, team, stack, run type, and environment
- **Trend chart**: pass rate and flaky rate over time

![Estate Trend](images/leadership-dashboard/estate-trend.png)
*Trend chart and distribution heatmaps — scroll down to see the full estate breakdown*

### How to use it

1. **Select a period** (daily/weekly/monthly/all) from the dropdown
2. **Scan the KPI cards** — is pass rate above your threshold? Is flaky
   rate under control?
3. **Check the trend** — is the pass rate improving or degrading?
4. **Drill into a slice** — click any client, product, team, or stack
   to see runs for that slice

---

## 5. Team Contribution

Shows which teams are authoring tests and landing fixes, with drill-down
into worst runs and flaky tests.

![Team Contribution](images/leadership-dashboard/team-contribution.png)
*Team contribution: tests authored and fixes landed per team, with worst-run drill-down*

### What you see

- **Per-team cards**: tests authored (from GitHub/GitLab connectors),
  fixes landed (from Jira/Linear connectors), pass rate, flaky rate
- **Worst runs**: the lowest pass-rate runs for each team
- **Flaky tests**: tests that pass sometimes and fail sometimes

### How to use it

1. **Compare teams** — which teams have the most tests? The most fixes?
2. **Identify struggling teams** — low pass rate or high flaky rate
3. **Click a team** to drill down into their worst runs and flaky tests
4. **Use connectors** to populate testsAuthored and fixesLanded
   (see [Connectors](#12-connectors-github-jira))

---

## 6. Recent Runs

The run list shows every ingested run in the current period.

![Recent Runs](images/leadership-dashboard/runs-list.png)
*Recent runs: client, product, team, stack, pass rate, duration — click to drill down*

### What you see

- **Run table**: run ID, client, product, team, stack, run type,
  pass rate, duration, timestamp
- **Click any run** to drill down to the single-run HTML report
  (the same report the `generate` CLI produces)

### How to use it

1. **Sort by pass rate** to find failing runs
2. **Sort by duration** to find slow runs
3. **Click a run** to open the full single-run report with test cases,
   screenshots, network logs, and AI analysis

---

## 7. Period Comparison

Compare the current period against the previous period to see if things
are getting better or worse.

![Period Comparison](images/leadership-dashboard/period-comparison.png)
*Period comparison: current vs previous period — pass rate delta, flaky rate delta, run count*

### What you see

- **Pass rate delta**: did pass rate improve or degrade?
- **Flaky rate delta**: did flakiness increase or decrease?
- **Run count delta**: are we running more or fewer tests?

---

## 8. Sync Health

Shows the status of CI pipeline connectors — is the dashboard data
complete and current?

![Sync Health](images/leadership-dashboard/sync-health.png)
*Sync health: CI pipeline connector status — last sync, stale warnings, missing pipelines*

### What you see

- **Per-pipeline status**: last sync time, run count, stale warnings
- **Missing pipelines**: pipelines that haven't reported in the expected
  window
- **Freshness indicator**: green (fresh), yellow (stale), red (missing)

---

## 9. Settings — Cloud Storage

The dashboard supports **cloud-drive storage** — use your existing
Microsoft 365 OneDrive or Google Workspace Drive as the shared database.
No Docker, no Postgres, no infrastructure to deploy.

![Settings](images/leadership-dashboard/settings.png)
*Settings: connect OneDrive or Google Drive, configure alert thresholds, view sharing instructions*

### Cloud Storage Setup (No Docker, No Postgres)

**For Directors / VPs (admin role):**

1. Open the dashboard → **Settings** tab
2. Under **Cloud Storage**, select your provider:
   - Microsoft 365 (OneDrive)
   - Google Workspace (Google Drive)
3. Enter your OAuth client ID and secret (from Azure AD or Google Cloud
   Console)
4. Enter the folder path (e.g. `TestIntelligencePlatform/acme`)
5. Click **Connect** — you'll be redirected to the OAuth consent screen
6. After consent, data is stored as JSONL files in your cloud drive folder
7. **Share the folder** with your team via M365/Google native sharing

**For Team Members (viewer role):**

1. Open the dashboard on your machine
2. Go to **Settings** → connect your cloud storage
3. Choose the **same provider** and enter the **same folder path** your
   director shared
4. Authenticate with your own cloud account
5. View results in the dashboard — you never open the raw files

The cloud drive IS the shared database. Every enterprise already has
M365 or Google Workspace. No infrastructure to deploy.

### Alert Thresholds

Configure alerts that fire when test quality drops:

- **Pass Rate Alert**: notify when pass rate drops below this % (default: 85%)
- **Flaky Rate Alert**: notify when flaky rate exceeds this % (default: 15%)
- **Webhook URL**: optional Slack/Teams webhook for alert delivery

---

## 10. Auth Modes (Dev, OIDC, SAML)

| Mode | Flag | Use Case |
|------|------|----------|
| Dev | `--auth dev` | Local development (login form, trusts headers) |
| OIDC | `--auth oidc --oidc-url <url>` | Enterprise SSO (Keycloak, Okta, Google) |
| SAML | `--auth saml` | SAML via gateway delegation |

### Dev Mode

```bash
npx evoveo-smart-reporter-dashboard --auth dev --port 3000
```

The dashboard shows a login form. Enter any tenant ID, user ID, and role.
API calls trust `X-Tenant-Id`, `X-User-Id`, `X-User-Role` headers.
**For local dev only — never expose to the network.**

### OIDC Mode

```bash
npx evoveo-smart-reporter-dashboard \
  --auth oidc \
  --oidc-url https://keycloak.example.com/realms/acme/protocol/openid-connect/userinfo \
  --oidc-fixed-tenant acme \
  --port 3000
```

Validates bearer tokens against the OIDC userinfo endpoint. The UI
obtains tokens from the IdP and sends them as Bearer tokens. Works with
Keycloak, Okta, Google Workspace, Azure AD, and any OIDC-compliant IdP.

Use `--oidc-fixed-tenant` for single-tenant deployments where every
user belongs to the same tenant.

### SAML Mode (Gateway Delegation)

```bash
npx evoveo-smart-reporter-dashboard \
  --auth saml \
  --saml-fixed-tenant acme \
  --port 3000
```

SAML mode does **not** parse SAML assertions natively. Instead, it
trusts headers set by an external SAML gateway (Apache
`mod_auth_mellon`, Shibboleth, or an NGINX auth proxy). The gateway
handles the SAML protocol, assertion validation, and IdP communication;
the dashboard receives the authenticated user identity via headers.

**Deployment requirement**: the dashboard must be deployed behind the
gateway and must never be directly reachable from the network without it.

---

## 11. Ingesting Test Runs

The dashboard ingests test runs via HTTP POST. Every run must include
an `orgContext` that stamps the run with tenant, client, product, team,
stack, run type, and environment.

### HTTP POST

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-Tenant-Id: acme' -H 'X-User-Id: u1' -H 'X-User-Role: admin' \
  -d '{
    "orgContext": {
      "tenantId": "acme",
      "client": "fiserv-payments",
      "product": "payments-gateway",
      "team": "qa-payments",
      "stack": "junit",
      "runType": "nightly",
      "environment": "ci"
    },
    "format": "junit",
    "rawArtifact": "<testsuites><testsuite name=\"s\" tests=\"10\" failures=\"1\"><testcase name=\"ok\"/><testcase name=\"bad\"><failure>boom</failure></testcase></testsuite></testsuites>"
  }'
```

### Supported Formats

| Format | Flag | Covers |
|--------|------|--------|
| JUnit XML | `"format": "junit"` | Cypress, Selenium, Jest, Pytest, Maven, TestNG, SoapUI, Newman |
| TRX | `"format": "trx"` | MSTest, xUnit, NUnit (.NET) |
| Newman JSON | `"format": "newman"` | Postman / Newman API collections |
| Generic JSON | `"format": "json"` | Any framework — convert to the schema |

### OrgContext Fields

| Field | Required | Example | Description |
|-------|----------|---------|-------------|
| `tenantId` | Yes | `acme` | Enterprise customer (multi-tenant isolation key) |
| `client` | Yes | `fiserv-payments` | External client / product line |
| `product` | Yes | `payments-gateway` | Product name |
| `team` | Yes | `qa-payments` | Owning team |
| `stack` | Yes | `junit` | Technology (playwright, junit, dotnet-trx, newman, etc.) |
| `runType` | Yes | `nightly` | One of: pr, nightly, daily, scheduled, manual |
| `environment` | Yes | `ci` | Environment (dev, staging, prod, ci) |

### CI Integration

Add a `curl` call to your CI pipeline after tests run:

```yaml
# GitHub Actions example
- name: Ingest test results
  run: |
    curl -X POST http://dashboard.internal:3000/api/ingest \
      -H 'Content-Type: application/json' \
      -H 'X-Tenant-Id: acme' -H 'X-User-Id: ci-bot' -H 'X-User-Role: admin' \
      -d '{
        "orgContext": {
          "tenantId": "acme", "client": "${{ vars.CLIENT }}",
          "product": "${{ vars.PRODUCT }}", "team": "${{ vars.TEAM }}",
          "stack": "playwright", "runType": "pr", "environment": "ci"
        },
        "format": "junit",
        "rawArtifact": "$(cat test-results.xml)"
      }'
```

---

## 12. Connectors (GitHub, Jira)

Connectors populate the **testsAuthored** and **fixesLanded** metrics in
the Team Contribution view.

| Connector | Metric | Source |
|-----------|--------|--------|
| GitHub | testsAuthored | Commits touching test files |
| GitLab | testsAuthored | Commits touching test files |
| Jira | fixesLanded | Resolved issues assigned to team members |
| Linear | fixesLanded | Completed issues assigned to team members |

### Configuration

Connectors are configured per tenant in the Settings tab (admin role
required). You need:

1. **Team mapping**: map VCS authors and ITS assignees to internal team
   names
2. **Test file patterns**: glob patterns for test files (e.g.
   `**/*.test.ts`, `**/*Test.java`)
3. **Fix issue labels**: issue types/labels that count as fixes (e.g.
   `bug`, `defect`)

### Real API Integration Tests

Connector integration tests against real APIs are skip-gated on
environment variables. To run them:

```bash
GITHUB_TOKEN=ghp_xxx GITHUB_OWNER=foo GITHUB_REPO=bar \
JIRA_BASE_URL=https://foo.atlassian.net JIRA_EMAIL=me@foo.com \
JIRA_API_TOKEN=xxx npm test -- connector-integration
```

---

## 13. CLI Reference

### `evoveo-smart-reporter-dashboard`

Boots the leadership dashboard: SPA + REST API + ingest endpoint in one
process.

```bash
npx evoveo-smart-reporter-dashboard [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--data-dir <path>` | Data directory for the store | `./data` |
| `--port <port>` | HTTP port | `3000` |
| `--auth <mode>` | Auth mode: `dev`, `oidc`, `saml` | `dev` |
| `--oidc-url <url>` | OIDC userinfo endpoint (when `--auth oidc`) | — |
| `--oidc-fixed-tenant <id>` | Fixed tenant for single-tenant OIDC | — |
| `--saml-fixed-tenant <id>` | Fixed tenant for single-tenant SAML | — |
| `--metering-dir <path>` | Directory for usage metering logs | none |
| `-h, --help` | Show help | — |

### `seed-data`

Seeds the local FileStore with realistic sample data for demos.

```bash
node dist/bin/seed-data.js [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--data-dir <path>` | Data directory | `./data` |
| `--tenant <id>` | Tenant ID to seed for | `acme` |

---

## 14. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Dashboard SPA                         │
│  (vanilla JS, zero deps — estate, teams, runs, login)   │
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
  │  Cloud)│ │  trend)│ │  OIDC/ │ │              │
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

### Storage Backends

| Backend | When to use | Setup |
|---------|-------------|-------|
| **FileStore** (local) | Local dev, small teams | Default — `--data-dir ./data` |
| **OneDriveStore** (M365) | Enterprise with Microsoft 365 | Settings → OAuth → share folder |
| **GoogleDriveStore** (Google Workspace) | Enterprise with Google Workspace | Settings → OAuth → share folder |
| **Postgres** (future) | Large estates (10k+ runs) | ADR-002 — not yet implemented |

### Benchmark

- **FileStore 10k runs**: ingest 1.5s, estate rollup 16ms (local disk)
- **Cloud-drive batched (50ms latency, flush every 100)**: 10k ingest 7.8s,
  rollup 132ms — viable with batched persistence

### ADRs

See [`docs/adr/`](./adr/) for architecture decision records:
- ADR-001: Reuse existing normalization layer
- ADR-002: File store now, Postgres deferred to production scale
- ADR-003: Tenant isolation at the store boundary (self-hosted first)
- ADR-004: Single-run HTML report is the drilldown target
- ADR-005: Org context stamped at ingest, never inferred
- ADR-006: All four team-contribution metrics ship in v1
- ADR-007: Legacy stacks use file-drop only
- ADR-008: Cloud drive as shared storage for no-Docker enterprises
- ADR-009: Pipeline sources (sync health)
