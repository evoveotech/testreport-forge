/**
 * Pipeline Sources barrel export + connector registry (ADR-009).
 *
 * The registry maps a connector kind to its source class, so the sync CLI
 * can instantiate the right PipelineSource from config without a switch.
 */

export type {
  PipelineSource,
  PipelineRunRef,
  DownloadedArtifact,
  PipelineRunMetadata,
  ConnectorKind,
  AuthMethod,
  AuthConfig,
  SourceConfig,
  AzureDevOpsSourceConfig,
  GitHubActionsSourceConfig,
  LocalSourceConfig,
  AnySourceConfig,
  RuleMatch,
  OrgContextTemplate,
  ClassificationRule,
  PipelineSourcesConfig,
  SyncRunOutcome,
  SyncResult,
} from './types';

export { ClassificationEngine } from './classification-engine';
export type { ClassificationInput, ClassificationResult } from './classification-engine';

export { AzureDevOpsSource } from './azure-devops-source';
export { GitHubActionsSource } from './github-actions-source';
export { LocalFileSource } from './local-file-source';
export { SyncOrchestrator } from './sync-orchestrator';
export type { SyncOrchestratorOptions } from './sync-orchestrator';
export { SyncState, composeRunKey } from './sync-state';
export type { ConnectorSyncState, SyncStateMap } from './sync-state';

import type { AnySourceConfig, PipelineSource } from './types';
import { AzureDevOpsSource } from './azure-devops-source';
import { GitHubActionsSource } from './github-actions-source';
import { LocalFileSource } from './local-file-source';

/**
 * Registry: kind → source class. The sync CLI uses this to instantiate
 * connectors from config.
 */
export const SOURCE_REGISTRY: Record<string, new (config: any) => PipelineSource> = {
  'azure-devops': AzureDevOpsSource,
  'github-actions': GitHubActionsSource,
  'local': LocalFileSource,
  // gitlab, aws-codepipeline: deferred to later phase
};

/**
 * Instantiate a PipelineSource from a config entry. Throws if the kind is
 * not in the registry.
 */
export function createSource(config: AnySourceConfig): PipelineSource {
  const Ctor = SOURCE_REGISTRY[config.kind];
  if (!Ctor) {
    throw new Error(`no source registered for kind "${config.kind}"`);
  }
  return new Ctor(config);
}
