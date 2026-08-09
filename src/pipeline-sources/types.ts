/**
 * Pipeline Sources — pull-side CI ingestion types (ADR-009).
 *
 * A PipelineSource is a connector that goes OUT to a CI system (Azure DevOps,
 * GitHub Actions, GitLab, AWS CodePipeline), discovers test runs, downloads
 * their artifacts, and fetches run metadata. Downloaded artifacts flow through
 * the EXISTING adapter registry (ADR-001) → IngestService → Store, so the
 * normalization path is shared with the push side (POST /runs).
 *
 * This family is DISTINCT from src/connectors/ (which pulls team-contribution
 * metrics from git/issue trackers). No naming collision.
 */

import type { OrgContext, IngestPayload } from '../types';

// ---------------------------------------------------------------------------
// Connector kinds
// ---------------------------------------------------------------------------

export type ConnectorKind =
  | 'azure-devops'
  | 'github-actions'
  | 'gitlab'
  | 'aws-codepipeline'
  | 'local';

// ---------------------------------------------------------------------------
// Run discovery + artifact download
// ---------------------------------------------------------------------------

/**
 * A reference to a single CI run discovered by a PipelineSource. Contains
 * enough information to download the test artifact and fetch metadata.
 * The `ciRunId` is the CI system's own run/build id; the sync orchestrator
 * composes the store key as `${connectorId}:${ciRunId}` for idempotency.
 */
export interface PipelineRunRef {
  /** CI system's own run/build id (e.g. Azure DevOps build id, GitHub run id). */
  ciRunId: string;
  /** ISO timestamp of when the run occurred (used for incremental cursor). */
  occurredAt: string;
  /** Repository / project name on the CI system (for classification matching). */
  repoName: string;
  /** Optional project / org path (e.g. Azure DevOps project name). */
  project?: string;
  /** Optional branch the run executed on. */
  branch?: string;
  /** Optional commit sha. */
  commit?: string;
  /** Optional artifact label/name hint for download selection. */
  artifactLabel?: string;
  /** Optional CI-run URL for provenance drilldown in the dashboard. */
  ciRunUrl?: string;
}

/**
 * A downloaded test artifact ready to be routed through the adapter registry.
 */
export interface DownloadedArtifact {
  /** Raw artifact content (JUnit XML, TRX, Playwright JSON, etc.). */
  content: string;
  /** Detected or explicit format for adapter routing. */
  format: IngestPayload['format'];
  /** File extension hint (e.g. 'xml', 'trx', 'json') for auto-detection. */
  ext?: string;
}

/**
 * Sidecar metadata for a CI run, enriching the IngestedRun with provenance
 * (commit, branch, trigger, CI-run-URL) for the dashboard's drilldown.
 */
export interface PipelineRunMetadata {
  ciRunId: string;
  ciRunUrl?: string;
  commit?: string;
  branch?: string;
  trigger?: string;       // 'push' | 'pull_request' | 'schedule' | 'manual'
  duration?: number;      // ms
  /** When the CI run actually occurred (ISO 8601). Used as the run's timestamp
   *  instead of the ingestion time, so trend charts and period filtering reflect
   *  when tests ran, not when we downloaded them. */
  occurredAt?: string;
  /** CI provider label for the dashboard badge. */
  provider: string;
}

// ---------------------------------------------------------------------------
// PipelineSource interface
// ---------------------------------------------------------------------------

/**
 * The contract every CI connector implements. The sync orchestrator calls
 * these three methods in sequence: list → download → fetchMetadata.
 *
 * Implementations use Node's built-in `https` module — no new runtime
 * dependencies (ADR-002 minimal-dependency philosophy).
 */
export interface PipelineSource {
  /** Unique connector id from config (e.g. "azure-acme"). */
  readonly id: string;
  /** CI system kind. */
  readonly kind: ConnectorKind;
  /**
   * Discover runs since the given ISO timestamp. If `since` is omitted, pulls
   * full available history (backfill) up to the CI system's retention limit.
   */
  listRuns(since?: string): Promise<PipelineRunRef[]>;
  /** Download the test artifact for a discovered run. */
  downloadArtifact(ref: PipelineRunRef): Promise<DownloadedArtifact>;
  /** Fetch sidecar metadata (commit, branch, trigger, CI-run-URL). */
  fetchRunMetadata(ref: PipelineRunRef): Promise<PipelineRunMetadata>;
}

// ---------------------------------------------------------------------------
// Configuration (pipeline-sources.yaml → parsed)
// ---------------------------------------------------------------------------

export type AuthMethod = 'pat' | 'service-principal' | 'github-app' | 'secrets-manager';

/**
 * Auth configuration. Tokens are referenced by ENV-VAR NAME, never stored
 * inline in the config file (security: config is version-controlled, tokens
 * are not).
 */
export interface AuthConfig {
  method: AuthMethod;
  /** Env var name holding the PAT / API key. */
  tokenEnv?: string;
  /** GitHub App: env var name for app id. */
  appIdEnv?: string;
  /** GitHub App: env var name for private key. */
  privateKeyEnv?: string;
  /** Service principal: env var name for tenant/client id. */
  tenantIdEnv?: string;
  clientIdEnv?: string;
  clientSecretEnv?: string;
  /** Secrets manager: provider + secret reference. */
  secretsProvider?: 'azure-keyvault' | 'aws-secrets-manager' | 'hashicorp-vault';
  secretRef?: string;
}

/**
 * Base connector config. CI-specific configs extend this with their own fields.
 */
export interface SourceConfig {
  id: string;
  kind: ConnectorKind;
  auth: AuthConfig;
  /** Optional: restrict to specific projects/repos (filter at discovery). */
  projects?: string[];
  repos?: string[];
}

export interface AzureDevOpsSourceConfig extends SourceConfig {
  kind: 'azure-devops';
  /** Azure DevOps organization name (https://dev.azure.com/{org}). */
  organization: string;
  /** Optional on-prem server URL (for Azure DevOps Server / TFS). */
  serverUrl?: string;
}

export interface GitHubActionsSourceConfig extends SourceConfig {
  kind: 'github-actions';
  /** GitHub owner (org or user). */
  owner: string;
  /** Optional GitHub Enterprise base URL (for on-prem). */
  baseUrl?: string;
}

export interface LocalSourceConfig {
  id: string;
  kind: 'local';
  /** Root directory containing the repo/run folder structure. */
  rootDir: string;
  /** Local source doesn't need auth — optional. */
  auth?: AuthConfig;
  projects?: string[];
  repos?: string[];
}

export type AnySourceConfig = AzureDevOpsSourceConfig | GitHubActionsSourceConfig | LocalSourceConfig;

// ---------------------------------------------------------------------------
// Classification rules engine (ADR-009 — amends ADR-005)
// ---------------------------------------------------------------------------

/**
 * Match criteria for a classification rule. All specified fields must match
 * (AND logic). Regex strings are tested against the corresponding CI field.
 */
export interface RuleMatch {
  connector?: string;                          // connector id
  kind?: ConnectorKind;                        // connector kind
  repoName?: string;                           // regex tested against repoName
  project?: string;                            // regex tested against project
  branch?: string;                             // regex tested against branch
  /** Comma-separated file signatures that must be present in the repo
   *  (e.g. "*.csproj|package.json"). Checked against repo file listing when
   *  available; otherwise ignored. */
  fileSignature?: string;
}

/**
 * A classification rule maps CI structural signal to an explicit OrgContext.
 * Template interpolation: ${1}, ${2}... reference regex capture groups from
 * the first regex match in `match` (typically repoName).
 */
export interface ClassificationRule {
  match: RuleMatch;
  orgContext: OrgContextTemplate;
}

/**
 * OrgContext with template-string fields (interpolated from regex captures).
 */
export interface OrgContextTemplate {
  tenantId: string;
  client: string;
  product: string;
  team: string;
  stack: string;
  runType: OrgContext['runType'];
  environment: string;
}

/**
 * Top-level config file shape (pipeline-sources.yaml parsed to JSON).
 */
export interface PipelineSourcesConfig {
  connectors: AnySourceConfig[];
  classificationRules: ClassificationRule[];
}

// ---------------------------------------------------------------------------
// Sync results
// ---------------------------------------------------------------------------

export interface SyncRunOutcome {
  connectorId: string;
  ciRunId: string;
  accepted: boolean;
  runId?: string;
  reason?: string;          // rejection reason (no rule match, parse error, etc.)
  quarantined?: boolean;
}

export interface SyncResult {
  connectorId: string;
  startedAt: string;
  finishedAt: string;
  discovered: number;
  ingested: number;
  rejected: number;
  quarantined: number;
  errors: string[];
  outcomes: SyncRunOutcome[];
}
