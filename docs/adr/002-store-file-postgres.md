# ADR-002: File-based store now, Postgres with partitions for production

**Status:** Accepted
**Date:** 2026-08-09

## Context

The leadership platform needs a time-series store for run summaries keyed by
(tenant x client x product x team x stack x run-type x env). User-confirmed
retention is **3 years**. At 10k clients x daily runs x 3yr that is tens of
millions of rows. The repo is an open-source library with a deliberate
minimal-dependency philosophy (only `adm-zip` and `pdfkit` at runtime).

## Decision

Ship a **pure-JS file-based `FileStore`** (JSONL append log + in-memory index,
zero native deps) for local dev and small deployments, behind a `Store`
interface. A **Postgres implementation** with monthly range partitions on
`runs` by tenant+month, a hot tier (last 90d) and cold tier (archives >90d),
and a nightly retention job satisfies the same interface for production.

## Consequences

- **Positive:** Zero native dependencies — critical for OSS adoption on
  Windows, Linux, and air-gapped systems. No `better-sqlite3`/`pg` native
  build step for the default path.
- **Positive:** The `Store` interface makes the Postgres swap a drop-in.
- **Negative:** The file store does not scale to production estate size; it
  is the local-dev/small-team path only. Production deployments must use
  Postgres (or a future store impl).
- **Negative:** Partitioning + archival adds operational complexity in the
  Postgres path (Task 7c).

## Verification

`src/store/file-store.test.ts` covers insert/get/query, persistence across
reopen, time-range filtering, limits, and tenant isolation. The `Store`
interface is Postgres-compatible by design.
