# ADR-002: File-based store now, Postgres with partitions deferred to production scale

**Status:** Accepted (revised 2026-08-09 — Postgres deferred from v1)
**Date:** 2026-08-09

## Context

The leadership platform needs a time-series store for run summaries keyed by
(tenant x client x product x team x stack x run-type x env). User-confirmed
retention is **3 years**. At 10k clients x daily runs x 3yr that is tens of
millions of rows. The repo is an open-source library with a deliberate
minimal-dependency philosophy (only `adm-zip` and `pdfkit` at runtime).

The v1 buyer is enterprise security teams who self-host. The differentiator
is "no Docker, no Postgres" — cloud-drive storage (ADR-008) covers the
no-infrastructure enterprise path. Postgres is needed only at the largest
estates and is a future enhancement, not a v1 requirement.

## Decision

Ship a **pure-JS file-based `FileStore`** (JSONL append log + in-memory index,
zero native deps) for local dev, small deployments, and the default
enterprise path, behind a `Store` interface. Cloud-drive stores
(OneDrive, Google Drive — ADR-008) serve the no-Docker enterprise path.

A **Postgres implementation** with monthly range partitions on `runs` by
tenant+month, a hot tier (last 90d) and cold tier (archives >90d), row-level
security policies, and a nightly retention job is **deferred to a future
release** for estates that exceed FileStore/cloud-drive scale. The `Store`
interface makes this a drop-in when implemented.

## Consequences

- **Positive:** Zero native dependencies — critical for OSS adoption on
  Windows, Linux, and air-gapped systems. No `better-sqlite3`/`pg` native
  build step for the default path.
- **Positive:** The `Store` interface makes the Postgres swap a drop-in
  when needed.
- **Positive:** Cloud-drive storage covers enterprises that have M365 or
  Google Workspace but no Docker/Postgres expertise.
- **Negative:** The file store does not scale to the largest production
  estates; it is the local-dev/small-team/cloud-drive path. Very large
  estates must wait for the Postgres implementation.
- **Negative:** Postgres row-level security is not available in v1; tenant
  isolation is enforced at the application/store layer instead (ADR-003).

## Verification

`src/store/file-store.test.ts` covers insert/get/query, persistence across
reopen, time-range filtering, limits, and tenant isolation (4
security-critical tests). The `Store` interface is Postgres-compatible by
design. Cloud-drive stores are unit-tested in `storage-settings.test.ts`.
