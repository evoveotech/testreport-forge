# ADR-003: Tenant isolation enforced at the store boundary (self-hosted first)

**Status:** Accepted (revised 2026-08-09 — self-hosted enterprise first, SaaS deferred)
**Date:** 2026-08-09

## Context

The v1 product ships as **self-hosted enterprise** first. The buyer is
enterprise security teams who deploy inside their own network. Managed
multi-tenant SaaS is a future business decision, not a v1 requirement.
Tenant isolation is a hard security requirement: a tenant must never read
another tenant's runs, users, or rollups. In self-hosted mode this isolates
business units; in a future SaaS mode it would be a legal/compliance boundary.

## Decision

Tenant isolation is enforced at the **store layer**, not at the API layer.
Every `Store` method that returns data takes a `tenantId` and only ever
returns rows belonging to that tenant:

- `getRun(tenantId, runId)` reads only from the named tenant's bucket.
- `queryRuns(query)` requires `query.tenantId` (it is a required field on
  `RunQuery`) and filters every row by it.
- `listUsers(tenantId)` returns only that tenant's users.
- `setUserRole(tenantId, userId, role)` rejects cross-tenant modification.

The `RunQuery.tenantId` field is **required at the type level** — there is
no way to call `queryRuns` without naming a tenant. A future Postgres
implementation would additionally enforce this with row-level security
policies (ADR-002, deferred).

Usage metering (runs ingested, seats) is emitted for self-hosted usage
caps and future billing. SaaS billing is not a v1 concern.

## Consequences

- **Positive:** Isolation cannot be bypassed by a forgetful API handler —
  the store makes cross-tenant reads impossible by construction.
- **Positive:** The same codebase can serve self-hosted now and SaaS later;
  only the deployment differs.
- **Positive:** No premature SaaS billing infrastructure for a v1 buyer
  that self-hosts.
- **Negative:** Cross-tenant admin views (e.g. future SaaS operator
  dashboards) require a separate privileged path, not the tenant-scoped
  store methods.
- **Negative:** Postgres RLS is not available in v1; isolation relies on
  application-layer enforcement.

## Verification

`src/store/file-store.test.ts > tenant isolation (security-critical)` has
four tests proving: cross-tenant `getRun` returns null; `queryRuns` only
returns the named tenant's runs; `listUsers` is tenant-scoped; and
`setUserRole` cannot modify another tenant's user.
