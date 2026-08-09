/**
 * GitHub Actions PipelineSource (ADR-009 — artifact-only connector).
 *
 * GitHub Actions has NO native test-results API — tests are only available as
 * downloaded artifacts (JUnit XML, TRX, Playwright JSON) attached to workflow
 * runs. This connector lists workflow runs, downloads artifact zips, and
 * extracts test-result files. Node built-in `https` only.
 *
 * API reference:
 *   Repos:        GET /repos/{owner}/repos?per_page=100
 *   Workflow runs: GET /repos/{owner}/{repo}/actions/runs?status=completed
 *   Run details:  GET /repos/{owner}/{repo}/actions/runs/{id}
 *   Artifacts:    GET /repos/{owner}/{repo}/actions/runs/{id}/artifacts
 *   Artifact dl:  GET /repos/{owner}/{repo}/actions/artifacts/{id}/zip
 */

import type {
  PipelineSource,
  PipelineRunRef,
  DownloadedArtifact,
  PipelineRunMetadata,
  GitHubActionsSourceConfig,
} from './types';
import {
  apiJson,
  downloadBinary,
  findTestFileInZip,
  isTestArtifact,
  resolveToken,
  mapTrigger,
} from './http-helpers';

export class GitHubActionsSource implements PipelineSource {
  readonly id: string;
  readonly kind = 'github-actions' as const;
  private readonly owner: string;
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly repos: string[];

  constructor(config: GitHubActionsSourceConfig) {
    this.id = config.id;
    this.owner = config.owner;
    this.baseUrl = config.baseUrl ?? 'api.github.com';
    this.token = resolveToken(config);
    this.repos = config.repos ?? [];
  }

  async listRuns(since?: string): Promise<PipelineRunRef[]> {
    const repos = this.repos.length > 0 ? this.repos : await this.listRepos();
    const refs: PipelineRunRef[] = [];
    for (const repo of repos) {
      const runs = await this.listWorkflowRuns(repo, since);
      for (const r of runs) {
        refs.push({
          ciRunId: String(r.id),
          occurredAt: r.updated_at ?? r.created_at,
          repoName: repo,
          branch: r.head_branch,
          commit: r.head_sha,
          ciRunUrl: r.html_url,
        });
      }
    }
    return refs.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async downloadArtifact(ref: PipelineRunRef): Promise<DownloadedArtifact> {
    const artifacts = await this.listArtifacts(ref.repoName, ref.ciRunId);
    for (const art of artifacts) {
      if (!isTestArtifact(art.name)) continue;
      const zipBuffer = await this.downloadArtifactZip(ref.repoName, String(art.id));
      const testFile = findTestFileInZip(zipBuffer);
      if (testFile) return testFile;
    }
    throw new Error(`no test artifact found for GitHub run ${ref.ciRunId} in ${ref.repoName}`);
  }

  async fetchRunMetadata(ref: PipelineRunRef): Promise<PipelineRunMetadata> {
    const run = await this.getWorkflowRun(ref.repoName, ref.ciRunId);
    return {
      ciRunId: ref.ciRunId,
      ciRunUrl: ref.ciRunUrl,
      commit: run.head_sha,
      branch: run.head_branch,
      trigger: mapTrigger(run.event),
      duration: run.run_started_at && run.updated_at
        ? new Date(run.updated_at).getTime() - new Date(run.run_started_at).getTime()
        : undefined,
      provider: 'github-actions',
    };
  }

  // --- API calls ---

  private authHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'evoveo-smart-reporter',
    };
  }

  private async listRepos(): Promise<string[]> {
    const data = await apiJson(this.baseUrl, `/repos/${this.owner}?per_page=100`, this.authHeader());
    return (data as any[] ?? []).map(r => r.name);
  }

  private async listWorkflowRuns(repo: string, since?: string): Promise<any[]> {
    let path = `/repos/${this.owner}/${repo}/actions/runs?status=completed&per_page=100`;
    if (since) path += `&created=>=${encodeURIComponent(since)}`;
    const data = await apiJson(this.baseUrl, path, this.authHeader());
    return data.workflow_runs as any[] ?? [];
  }

  private async getWorkflowRun(repo: string, runId: string): Promise<any> {
    return apiJson(this.baseUrl, `/repos/${this.owner}/${repo}/actions/runs/${runId}`, this.authHeader());
  }

  private async listArtifacts(repo: string, runId: string): Promise<any[]> {
    const data = await apiJson(
      this.baseUrl,
      `/repos/${this.owner}/${repo}/actions/runs/${runId}/artifacts`,
      this.authHeader(),
    );
    return data.artifacts as any[] ?? [];
  }

  private async downloadArtifactZip(repo: string, artifactId: string): Promise<Buffer> {
    const path = `/repos/${this.owner}/${repo}/actions/artifacts/${artifactId}/zip`;
    return downloadBinary(`https://${this.baseUrl}${path}`, this.authHeader());
  }
}
