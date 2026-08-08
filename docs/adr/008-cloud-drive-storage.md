# ADR-008: Cloud drive as shared storage for no-Docker enterprises

**Status:** Accepted
**Date:** 2026-08-09

## Context

Many large enterprises lock down Docker on developer laptops and have no
Postgres infrastructure available to individual teams. This blocks adoption
of the leadership platform for the exact audience it serves — enterprise
QA directors and VPs who need a shared view across teams.

However, virtually every enterprise has either Microsoft 365 (OneDrive /
SharePoint) or Google Workspace (Google Drive). These platforms provide:
- Authentication (OAuth2 with the user's work account)
- Shared storage (folders with native sharing/permissions)
- No infrastructure to deploy (it's already there)

## Decision

Add two new `Store` implementations that use cloud drives as the shared
storage layer:

- **OneDriveStore** — stores JSONL files in OneDrive/SharePoint via the
  Microsoft Graph API.
- **GoogleDriveStore** — stores JSONL files in Google Drive via the Google
  Drive API.

Both use Node's built-in `https` module — zero new runtime dependencies.

The flow:
1. The Director/VP (admin role) opens the dashboard Settings tab and
   connects their M365 or Google Workspace account via OAuth.
2. Data is stored as JSONL files in a folder in their cloud drive.
3. The Director shares that folder with their team via M365/Google's
   native sharing UI (no app-level user management needed).
4. Team members run the dashboard and connect to the same shared folder.
5. Everyone views results through the dashboard UI — no one opens raw files.

Cloud storage auth is **separate** from user auth (OIDC/SAML). User auth
resolves identity; cloud storage auth resolves where data lives.

## Consequences

- **Positive:** No Docker, no Postgres, no infrastructure required. The
  cloud drive IS the shared database. Every enterprise already has one.
- **Positive:** Sharing is delegated to the platform's native sharing —
  no app-level user management for the storage layer.
- **Positive:** Data lives in the enterprise's own cloud — meets data
  residency and compliance requirements.
- **Negative:** Cloud API rate limits apply. The file-based approach
  (download all, modify, re-upload) is not optimal for very large estates.
  For 10k+ runs, Postgres (ADR-002) remains the recommended path.
- **Negative:** OAuth app registration is required in Azure AD or Google
  Cloud Console — a one-time admin task.

## Verification

`src/dashboard/storage-settings.test.ts` — 14 tests covering config
round-trip, token redaction, OAuth URL generation, connect/disconnect
flows, and OAuth callback error handling.
