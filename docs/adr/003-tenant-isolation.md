# ADR-003: Tenant isolation enforced at the store boundary

**Status:** Accepted
**Date:** 2026-08-09

## Context

The product ships as both self-hosted enterprise AND managed multi-tenant
SaaS (user-confirmed). Tenant isolation is a hard security requirement: a
tenant must never read another tenant's runs, users, or rollups. In SaaS
mode this is a legal/compliance boundary; in self-hosted mode it isolates
business units.

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
implementation enforces the same with row-level security policies.

## Consequences

- **Positive:** Isolation cannot be bypassed by a forgetful API handler —
  the store makes cross-tenant reads impossible by construction.
- **Positive:** The same codebase serves self-hosted and SaaS; only the
  deployment differs.
- **Negative:** Cross-tenant admin views (e.g. SaaS operator dashboards)
  require a separate privileged path, not the tenant-scoped store methods.

## Verification

`src/store/file-store.test.ts > tenant isolation (security-critical)` has
four tests proving: cross-tenant `getRun` returns null; `queryRuns` only
returns the named tenant's runs; `listUsers` is tenant-scoped; and
`setUserRole` cannot modify another tenant's user.
