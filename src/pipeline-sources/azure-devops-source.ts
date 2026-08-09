/**
 * Azure DevOps PipelineSource (ADR-009 reference connector).
 *
 * Uses the Azure DevOps REST API for discovery + metadata, and downloads build
 * artifacts (zipped) for the test result files. Downloaded artifacts flow
 * through the existing adapter registry. Node built-in `https` only.
 *
 * API reference:
 *   Builds:        GET /{org}/{project}/_apis/build/builds?statusFilter=completed&minFinishTime={iso}
 *   Build details: GET /{org}/{project}/_apis/build/builds/{id}?api-version=7.1
 *   Artifacts:     GET /{org}/{project}/_apis/build/builds/{id}/artifacts?api-version=7.1
 *   Artifact dl:   GET {artifact.resource.downloadUrl}  (returns a zip)
 */

import type {
  PipelineSource,
  PipelineRunRef,
  DownloadedArtifact,
  PipelineRunMetadata,
  AzureDevOpsSourceConfig,
} from './types';
import {
  apiJson,
  downloadBinary,
  findTestFileInZip,
  resolveToken,
  mapTrigger,
} from './http-helpers';

export class AzureDevOpsSource implements PipelineSource {
  readonly id: string;
  readonly kind = 'azure-devops' as const;
  private readonly organization: string;
  private readonly serverUrl: string;
  private readonly token: string;
  private readonly projects: string[];

  constructor(config: AzureDevOpsSourceConfig) {
    this.id = config.id;
    this.organization = config.organization;
    this.serverUrl = config.serverUrl ?? `dev.azure.com`;
    this.token = resolveToken(config);
    this.projects = config.projects ?? [];
  }

  async listRuns(since?: string): Promise<PipelineRunRef[]> {
    const projects = this.projects.length > 0 ? this.projects : await this.listProjects();
    const refs: PipelineRunRef[] = [];
    for (const project of projects) {
      const builds = await this.listBuilds(project, since);
      for (const b of builds) {
        refs.push({
          ciRunId: String(b.id),
          occurredAt: b.finishTime ?? b.startTime ?? new Date().toISOString(),
          repoName: b.repository?.name ?? project,
          project,
          branch: b.sourceBranch?.replace('refs/heads/', ''),
          commit: b.sourceVersion,
          ciRunUrl: b._links?.web?.href
            ?? `https://${this.serverUrl}/${this.organization}/${project}/_build/results?buildId=${b.id}`,
        });
      }
    }
    return refs.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async downloadArtifact(ref: PipelineRunRef): Promise<DownloadedArtifact> {
    const artifacts = await this.listBuildArtifacts(ref.project!, ref.ciRunId);
    for (const art of artifacts) {
      const downloadUrl = art.resource?.downloadUrl;
      if (!downloadUrl) continue;
      const zipBuffer = await downloadBinary(downloadUrl, this.authHeader());
      const testFile = findTestFileInZip(zipBuffer);
      if (testFile) return testFile;
    }
    throw new Error(`no test artifact found for build ${ref.ciRunId} in project ${ref.project}`);
  }

  async fetchRunMetadata(ref: PipelineRunRef): Promise<PipelineRunMetadata> {
    const build = await this.getBuild(ref.project!, ref.ciRunId);
    return {
      ciRunId: ref.ciRunId,
      ciRunUrl: ref.ciRunUrl,
      commit: build.sourceVersion,
      branch: build.sourceBranch?.replace('refs/heads/', ''),
      trigger: mapTrigger(build.reason),
      duration: build.startTime && build.finishTime
        ? new Date(build.finishTime).getTime() - new Date(build.startTime).getTime()
        : undefined,
      provider: 'azure-devops',
    };
  }

  // --- API calls ---

  private authHeader(): Record<string, string> {
    return { Authorization: `Basic ${Buffer.from(':' + this.token).toString('base64')}` };
  }

  private async listProjects(): Promise<string[]> {
    const data = await apiJson(
      this.serverUrl,
      `/${this.organization}/_apis/projects?api-version=7.1`,
      this.authHeader(),
    );
    return (data.value as any[] ?? []).map(p => p.name);
  }

  private async listBuilds(project: string, since?: string): Promise<any[]> {
    let path = `/${this.organization}/${encodeURIComponent(project)}/_apis/build/builds?statusFilter=completed&api-version=7.1&$top=100`;
    if (since) path += `&minFinishTime=${encodeURIComponent(since)}`;
    const data = await apiJson(this.serverUrl, path, this.authHeader());
    return data.value as any[] ?? [];
  }

  private async getBuild(project: string, buildId: string): Promise<any> {
    return apiJson(
      this.serverUrl,
      `/${this.organization}/${encodeURIComponent(project)}/_apis/build/builds/${buildId}?api-version=7.1`,
      this.authHeader(),
    );
  }

  private async listBuildArtifacts(project: string, buildId: string): Promise<any[]> {
    const data = await apiJson(
      this.serverUrl,
      `/${this.organization}/${encodeURIComponent(project)}/_apis/build/builds/${buildId}/artifacts?api-version=7.1`,
      this.authHeader(),
    );
    return data.value as any[] ?? [];
  }
}
