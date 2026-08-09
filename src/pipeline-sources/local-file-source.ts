/**
 * LocalFileSource — a PipelineSource that reads test artifacts from a local
 * directory structure, simulating what a real CI connector (Azure DevOps,
 * GitHub Actions) would do. This is for local testing, demos, and air-gapped
 * environments where you can't (or don't want to) connect to a live CI system.
 *
 * Expected directory layout:
 *   <rootDir>/
 *     <repo-name>/
 *       <run-id>/
 *         artifact.xml        (or .trx, .json — the test result file)
 *         meta.json           (optional: { commit, branch, trigger, occurredAt, ciRunUrl })
 *
 * Each <run-id> folder becomes one PipelineRunRef. The artifact file is read
 * and its format auto-detected. If meta.json exists, its fields enrich the
 * run ref + metadata.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  PipelineSource,
  PipelineRunRef,
  DownloadedArtifact,
  PipelineRunMetadata,
} from './types';
import { detectTestContent } from './http-helpers';
import type { LocalSourceConfig } from './types';

interface RunMeta {
  commit?: string;
  branch?: string;
  trigger?: string;
  occurredAt?: string;
  ciRunUrl?: string;
  duration?: number;
}

export class LocalFileSource implements PipelineSource {
  readonly id: string;
  readonly kind = 'local' as const;
  private readonly rootDir: string;

  constructor(config: LocalSourceConfig) {
    this.id = config.id;
    this.rootDir = path.resolve(config.rootDir);
  }

  async listRuns(_since?: string): Promise<PipelineRunRef[]> {
    const refs: PipelineRunRef[] = [];
    if (!fs.existsSync(this.rootDir)) return refs;

    // <rootDir>/<repo-name>/<run-id>/artifact.*
    for (const repoName of fs.readdirSync(this.rootDir)) {
      const repoDir = path.join(this.rootDir, repoName);
      if (!fs.statSync(repoDir).isDirectory()) continue;
      for (const runId of fs.readdirSync(repoDir)) {
        const runDir = path.join(repoDir, runId);
        if (!fs.statSync(runDir).isDirectory()) continue;
        const meta = this.readMeta(runDir);
        refs.push({
          ciRunId: runId,
          occurredAt: meta.occurredAt ?? new Date().toISOString(),
          repoName,
          branch: meta.branch,
          commit: meta.commit,
          ciRunUrl: meta.ciRunUrl,
        });
      }
    }
    return refs.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async downloadArtifact(ref: PipelineRunRef): Promise<DownloadedArtifact> {
    const runDir = path.join(this.rootDir, ref.repoName, ref.ciRunId);
    // Find the first test-result file in the run directory.
    for (const name of fs.readdirSync(runDir)) {
      if (name === 'meta.json') continue;
      const fullPath = path.join(runDir, name);
      if (!fs.statSync(fullPath).isFile()) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      const detected = detectTestContent(content, name);
      if (detected) return detected;
    }
    throw new Error(`no test artifact found in ${runDir}`);
  }

  async fetchRunMetadata(ref: PipelineRunRef): Promise<PipelineRunMetadata> {
    const runDir = path.join(this.rootDir, ref.repoName, ref.ciRunId);
    const meta = this.readMeta(runDir);
    return {
      ciRunId: ref.ciRunId,
      ciRunUrl: ref.ciRunUrl ?? meta.ciRunUrl,
      commit: meta.commit ?? ref.commit,
      branch: meta.branch ?? ref.branch,
      trigger: meta.trigger,
      duration: meta.duration,
      occurredAt: meta.occurredAt ?? ref.occurredAt,
      provider: 'local',
    };
  }

  private readMeta(runDir: string): RunMeta {
    const metaFile = path.join(runDir, 'meta.json');
    try {
      const raw = fs.readFileSync(metaFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
}
