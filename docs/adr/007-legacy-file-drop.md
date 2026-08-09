# ADR-007: Legacy stacks use file-drop only, no custom parsers

**Status:** Accepted
**Date:** 2026-08-09

## Context

Large enterprises have legacy/mainframe/COBOL stacks that emit results in
proprietary formats. Writing a custom parser per legacy stack is
unbounded scope and a maintenance burden. User confirmed: file-drop only
for legacy, no custom parsers.

## Decision

Legacy and air-gapped systems drop a JSON file containing an
`IngestPayload` (org context + either a raw artifact in a supported format
or a pre-normalized run) into a watched directory. The `FileDropWatcher`
ingests each file, routes it through `IngestService`, and renames it
`.processed` or `.failed`. No mainframe-specific parser is written.

## Consequences

- **Positive:** Bounded scope — no long tail of legacy parsers.
- **Positive:** Air-gapped systems have a non-network ingestion path.
- **Negative:** Legacy teams must produce a JSON payload with org context;
  a thin shim on their side is required.

## Verification

`src/ingest/file-drop-watcher.ts` implements the watcher. The bin
`evoveo-smart-reporter-ingest --watch <dir>` enables it.
