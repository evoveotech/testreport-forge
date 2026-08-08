# Leadership Test Intelligence Dashboard

> Idea-refine one-pager. Source skill: `idea-refine`. Status: ready for plan -> `tasks/plan.md`.

## Problem Statement

How might we give VP/SVP/Director-of-Testing at very large enterprises a single,
live, trustworthy view of testing status across **every** product, client,
team, stack, and run-type (PR / nightly / daily / scheduled) -- when each of
those stacks today runs its own tools, languages, CI, and reports, and the
estate spans 10,000+ clients and dozens of technologies (mobile, backend, web,
legacy services, BFFs, microservices)?

## Recommended Direction

Build a **Test Intelligence Platform** as a new layer on top of the existing
`evoveo-smart-reporter` engine. The reporter already normalizes results from
Playwright, JUnit XML, TRX, Newman, Selenium, SoapUI, Jest, Vitest, Pytest,
RestSharp into one rich schema (`RunSummary`, `CIInfo`, `TestHistory`,
`HealthDigest`). That normalization is the hardest part and it is already done.

The new layer adds three things the per-run reporter does not have:

1. **An ingestion service** (`evoveo-smart-reporter-ingest`) that receives
   normalized run payloads from any CI pipeline in the estate via a single
   `POST /runs` endpoint (or file drop / S3 / SFTP for air-gapped legacy).
   Each payload is stamped with an **organization context** (client, product,
   team, stack, run-type, environment) that the per-run reporter does not
   require today.

2. **A time-series store** that keeps run summaries + health digests per
   (client x product x team x stack x run-type) for trend analysis at scale.
   Start with SQLite/Postgres; the schema is a thin extension of the existing
   `RunSummary` + `HealthDigest` types.

3. **A leadership dashboard** (`evoveo-smart-reporter-dashboard`) -- a
   multi-tenant web app with rollup views: estate-wide health, per-client,
   per-product, per-team contribution, PR-vs-nightly health, flakiness heat,
   and drilldown into the existing single-run HTML report.

The key insight: **do not rebuild the report**. The single-run HTML report is
already excellent and is the drilldown target. The leadership product is the
*index* over thousands of those reports plus the *aggregated trend* across them.

## Key Assumptions to Validate

- [ ] **A1 -- One schema can describe the whole estate.** The existing
      `RunSummary` + `CIInfo` + an added `OrgContext` (client/product/team/
      stack/run-type/env) covers >=95% of what leadership asks for.
      *Test:* interview 3 directors; map their current slide decks to the schema.
- [ ] **A2 -- CI teams will adopt a single ingest endpoint.** Each team already
      emits JUnit/TRX/JSON; wiring a `curl POST` or a reporter hook is a
      <1-day change per pipeline. *Test:* pilot with 2 real pipelines.
- [ ] **A3 -- Leadership wants rollups, not raw test lists.** Directors ask
      "is the estate green and trending better", not "show me test #482".
      *Test:* prototype the rollup view and review with one VP.
- [ ] **A4 -- SQLite/Postgres is enough at first.** 10k clients x daily runs
      x 1 year ~= millions of rows -- trivial for Postgres. No need for a
      data warehouse on day one. *Test:* load test with 6 months of synthetic.
- [ ] **A5 -- SSO is mandatory for enterprise.** SAML/OIDC against the
      customer's IdP is a hard requirement, not a nice-to-have. *Test:* confirm
      with one enterprise security team.

## MVP Scope

**In:**
- `OrgContext` type + stamping on every ingested run
- `evoveo-smart-reporter-ingest` service: `POST /runs` (JSON), file-drop watcher
- Postgres store (SQLite for local dev) of run summaries + health digests
- Leadership dashboard: Estate rollup, Client/Product/Team/Stack/RunType
  breakdowns, trend charts, flakiness heat, PR-vs-nightly comparison
- Drilldown: click any cell -> open the existing single-run HTML report
- SSO (OIDC) + role-based access (viewer / admin per tenant)
- One CLI: `evoveo-smart-reporter dashboard` to boot the whole stack locally
- Seed data generator + a benchmark of 10k clients for perf validation

**Out (explicitly deferred):**
- Real-time streaming (<5s latency) -- batch/minute granularity is enough
- AI natural-language Q&A over the estate -- later phase
- Mobile native app -- responsive web first
- Custom report builder UI -- fixed leadership views first
- Data warehouse / Spark / BigQuery integration -- Postgres first
- Per-test cross-product correlation -- per-run + per-team first

## Not Doing (and Why)

- **Not replacing the single-run HTML report.** It is the drilldown target and
  the reason adoption is cheap. Replacing it would lose the framework fidelity
  teams trust.
- **Not building a new test runner.** We ingest what teams already produce.
  Building runners fights every team's existing investment.
- **Not a generic BI tool.** BI tools (Tableau/PowerBI) can chart anything but
  need a test-domain model to be useful. We ship the domain model; BI export
  comes later for power users.
- **Not multi-tenant SaaS hosting on day one.** Ship as self-hosted enterprise
  first (the buyer is enterprise security); managed SaaS is a later business
  decision.
- **Not real-time push for v1.** Leadership consumes daily/nightly; live push
  adds operational cost without changing the decision.

## Open Questions

- Q1: Is the buyer the testing org (self-hosted) or do we also offer a managed
  tenant? (Affects auth + data residency design from day one.)
- Q2: What is the minimum retention leadership needs? 1 year? 3 years?
  (Affects storage sizing and partitioning.)
- Q3: Do legacy mainframe/COBOL stacks emit anything ingestible, or do they
  need a custom adapter? (Affects adapter roadmap.)
- Q4: Should "team contribution" be measured by tests authored, runs executed,
  flakiness owned, or fixes landed? (Affects which metrics we surface.)
