import * as fs from 'fs';
import * as path from 'path';
import type { ConnectorData } from '../types';
import {
  GitHubConnector, GitLabConnector, JiraConnector, LinearConnector,
  computeTestsAuthored, computeFixesLanded,
} from '../connectors';
import type { TeamMapping } from '../connectors';

/**
 * Connector configuration stored in <dataDir>/connectors.json. Admin-only.
 * Defines which VCS and issue-tracker systems to pull team-contribution
 * data from, and how to map external identities to internal team names.
 */
export interface ConnectorConfig {
  vcs?: {
    type: 'github' | 'gitlab';
    token: string;
    /** GitHub: repo owner. */
    owner?: string;
    /** GitHub: repo name. GitLab: project ID. */
    repo?: string;
    /** GitLab only (default: gitlab.com). */
    baseUrl?: string;
    /** Branch to fetch commits from (default: main). */
    branch?: string;
  };
  its?: {
    type: 'jira' | 'linear';
    /** Jira: base URL. Linear: unused. */
    baseUrl?: string;
    /** Jira: email. Linear: unused. */
    email?: string;
    /** Jira: API token. Linear: API key. */
    apiKey: string;
  };
  /** Maps external identities to internal team names + test/fix patterns. */
  teamMapping: TeamMapping;
  /** Mock data for demos — when present, fetchConnectorData returns this
   * instead of calling external APIs. */
  mockData?: ConnectorData;
}

/**
 * Fetches team-contribution data from configured connectors (GitHub/GitLab
 * for testsAuthored, Jira/Linear for fixesLanded). Results are cached with
 * a 5-minute TTL to avoid hammering external APIs on every rollup request.
 */
export class ConnectorService {
  private readonly configFile: string;
  private cache: { data: ConnectorData; expiresAt: number } | null = null;
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(dataDir: string) {
    this.configFile = path.join(dataDir, 'connectors.json');
  }

  loadConfig(): ConnectorConfig | null {
    try {
      const raw = fs.readFileSync(this.configFile, 'utf-8');
      return JSON.parse(raw) as ConnectorConfig;
    } catch {
      return null;
    }
  }

  saveConfig(config: ConnectorConfig): void {
    fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf-8');
  }

  clearConfig(): void {
    try { fs.unlinkSync(this.configFile); } catch { /* not configured */ }
  }

  /**
   * Fetch connector data for the given time range. Returns a map of
   * team to { testsAuthored, fixesLanded }. Uses cache if fresh.
   * Returns empty object if no connectors are configured.
   */
  async fetchConnectorData(from: string, to: string): Promise<ConnectorData> {
    if (this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.data;
    }

    const config = this.loadConfig();
    if (!config) return {};

    // Mock mode: return seeded data without calling external APIs.
    if (config.mockData) {
      this.cache = { data: config.mockData, expiresAt: Date.now() + this.cacheTtlMs };
      return config.mockData;
    }

    const data: ConnectorData = {};

    if (config.vcs) {
      try {
        const testsAuthored = await this.fetchTestsAuthored(config, from, to);
        for (const [team, count] of Object.entries(testsAuthored)) {
          if (!data[team]) data[team] = { testsAuthored: 0, fixesLanded: 0 };
          data[team].testsAuthored = count;
        }
      } catch (e) {
        console.error('VCS connector error:', (e as Error).message);
      }
    }

    if (config.its) {
      try {
        const fixesLanded = await this.fetchFixesLanded(config, from, to);
        for (const [team, count] of Object.entries(fixesLanded)) {
          if (!data[team]) data[team] = { testsAuthored: 0, fixesLanded: 0 };
          data[team].fixesLanded = count;
        }
      } catch (e) {
        console.error('ITS connector error:', (e as Error).message);
      }
    }

    this.cache = { data, expiresAt: Date.now() + this.cacheTtlMs };
    return data;
  }

  private async fetchTestsAuthored(config: ConnectorConfig, from: string, to: string): Promise<Record<string, number>> {
    if (!config.vcs) return {};
    const { type, token, owner, repo, baseUrl, branch } = config.vcs;
    const { teamMapping } = config;

    let commits;
    if (type === 'github') {
      const connector = new GitHubConnector(owner!, repo!, token, branch ?? 'main');
      commits = await connector.fetchCommits(from, to);
    } else {
      const connector = new GitLabConnector(repo!, token, baseUrl ?? 'gitlab.com');
      commits = await connector.fetchCommits(from, to);
    }

    return computeTestsAuthored(commits, teamMapping);
  }

  private async fetchFixesLanded(config: ConnectorConfig, from: string, to: string): Promise<Record<string, number>> {
    if (!config.its) return {};
    const { type, baseUrl, email, apiKey } = config.its;
    const { teamMapping } = config;

    let issues;
    if (type === 'jira') {
      const connector = new JiraConnector(baseUrl!, email!, apiKey);
      issues = await connector.fetchResolvedIssues(from, to);
    } else {
      const connector = new LinearConnector(apiKey);
      issues = await connector.fetchResolvedIssues(from, to);
    }

    return computeFixesLanded(issues, teamMapping);
  }

  clearCache(): void {
    this.cache = null;
  }
}
