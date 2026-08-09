import * as https from 'https';
import * as http from 'http';

/**
 * A connector pulls data from an external system (GitHub, GitLab, Jira,
 * Linear) and maps it to team-contribution metrics (ADR-006). Each connector
 * is configured per tenant with credentials and team mappings.
 */

/** A raw commit from a VCS connector. */
export interface VcsCommit {
  sha: string;
  author: string;
  message: string;
  files: string[];
  timestamp: string;
}

/** A raw issue from an ITS connector. */
export interface ItsIssue {
  id: string;
  key: string;
  assignee: string | null;
  status: string;
  resolvedAt: string | null;
}

/**
 * VCS connector interface -- pulls commits and maps them to tests-authored
 * per team. A commit counts if it touches files matching the configured
 * test-file glob (e.g. double-star-slash-star.test.ts).
 */
export interface VcsConnector {
  /** Fetch commits in a date range. */
  fetchCommits(from: string, to: string): Promise<VcsCommit[]>;
}

/**
 * ITS connector interface -- pulls resolved issues and maps them to
 * "fixes landed" per team. An issue counts as a "fix" if its type/labels
 * match the configured fix-issue filter.
 */
export interface ItsConnector {
  /** Fetch resolved issues in a date range. */
  fetchResolvedIssues(from: string, to: string): Promise<ItsIssue[]>;
}

/**
 * Per-tenant connector configuration: maps VCS usernames and ITS assignees
 * to internal team names. Without this mapping, contribution cannot be
 * attributed to teams.
 */
export interface TeamMapping {
  /** Map VCS author (email or login) -> team name. */
  vcsAuthorToTeam: Record<string, string>;
  /** Map ITS assignee (email or login) -> team name. */
  itsAssigneeToTeam: Record<string, string>;
  /** Glob patterns for test files (e.g. double-star-slash-star.test.ts). */
  testFilePatterns: string[];
  /** Issue types or labels that count as fixes (e.g. bug, defect). */
  fixIssueLabels: string[];
}

/**
 * Compute "tests authored" per team from VCS commits. A commit counts if it
 * touches at least one file matching a test-file pattern.
 */
export function computeTestsAuthored(commits: VcsCommit[], mapping: TeamMapping): Record<string, number> {
  const result: Record<string, number> = {};
  for (const commit of commits) {
    const team = mapping.vcsAuthorToTeam[commit.author];
    if (!team) continue;
    const touchesTests = commit.files.some(f => matchesAnyPattern(f, mapping.testFilePatterns));
    if (!touchesTests) continue;
    result[team] = (result[team] ?? 0) + 1;
  }
  return result;
}

/**
 * Compute "fixes landed" per team from resolved ITS issues. An issue counts
 * if it has been resolved and its labels match the fix-issue filter.
 */
export function computeFixesLanded(issues: ItsIssue[], mapping: TeamMapping): Record<string, number> {
  const result: Record<string, number> = {};
  for (const issue of issues) {
    if (!issue.resolvedAt || !issue.assignee) continue;
    const team = mapping.itsAssigneeToTeam[issue.assignee];
    if (!team) continue;
    result[team] = (result[team] ?? 0) + 1;
  }
  return result;
}

/**
 * Simple glob matcher: supports `*` (single segment) and `**` (multi segment).
 * Good enough for test-file patterns without pulling in a glob library.
 */
export function matchesAnyPattern(path: string, patterns: string[]): boolean {
  return patterns.some(p => globMatch(p, path));
}

function globMatch(pattern: string, path: string): boolean {
  // Convert glob to regex. Escape dots FIRST, then handle ** and *.
  // **/ matches zero or more path segments (so **/foo matches both foo and a/foo).
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '(__DBLSTAR_SLASH__)')
    .replace(/\*\*/g, '__DBLSTAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DBLSTAR_SLASH__/g, '(.*/)?')
    .replace(/__DBLSTAR__/g, '.*');
  return new RegExp('^' + regexStr + '$').test(path);
}

/**
 * GitHub connector. Uses the GitHub REST API via Node's built-in https.
 * Requires a personal access token or GitHub App token.
 */
export class GitHubConnector implements VcsConnector {
  constructor(
    private readonly owner: string,
    private readonly repo: string,
    private readonly token: string,
    private readonly branch = 'main',
  ) {}

  async fetchCommits(from: string, to: string): Promise<VcsCommit[]> {
    const since = new Date(from).toISOString();
    const until = new Date(to).toISOString();
    const path = `/repos/${this.owner}/${this.repo}/commits?sha=${this.branch}&since=${since}&until=${until}&per_page=100`;
    const data = await githubApi(this.token, path);
    const commits: VcsCommit[] = [];
    for (const c of data as any[]) {
      // Fetch the full commit to get files
      const detail = await githubApi(this.token, `/repos/${this.owner}/${this.repo}/commits/${c.sha}`) as any;
      commits.push({
        sha: c.sha,
        author: c.commit?.author?.email ?? c.author?.login ?? '',
        message: c.commit?.message ?? '',
        files: (detail.files ?? []).map((f: any) => f.filename),
        timestamp: c.commit?.author?.date ?? '',
      });
    }
    return commits;
  }
}

/**
 * GitLab connector. Uses the GitLab REST API via Node's built-in https.
 */
export class GitLabConnector implements VcsConnector {
  constructor(
    private readonly projectId: string,
    private readonly token: string,
    private readonly baseUrl = 'gitlab.com',
  ) {}

  async fetchCommits(from: string, to: string): Promise<VcsCommit[]> {
    const since = new Date(from).toISOString();
    const until = new Date(to).toISOString();
    const path = `/api/v4/projects/${encodeURIComponent(this.projectId)}/repository/commits?since=${since}&until=${until}&per_page=100`;
    const data = await gitlabApi(this.token, path, this.baseUrl);
    const commits: VcsCommit[] = [];
    for (const c of data as any[]) {
      // Fetch diff to get files
      const diff = await gitlabApi(this.token, `/api/v4/projects/${encodeURIComponent(this.projectId)}/repository/commits/${c.id}/diff`, this.baseUrl);
      commits.push({
        sha: c.id,
        author: c.author_email ?? '',
        message: c.message ?? '',
        files: (diff as any[]).map((d: any) => d.new_path),
        timestamp: c.created_at ?? '',
      });
    }
    return commits;
  }
}

/**
 * Jira connector. Uses the Jira REST API. Requires an API token.
 */
export class JiraConnector implements ItsConnector {
  constructor(
    private readonly baseUrl: string,
    private readonly email: string,
    private readonly apiToken: string,
  ) {}

  async fetchResolvedIssues(from: string, to: string): Promise<ItsIssue[]> {
    const jql = `resolved >= "${from}" AND resolved <= "${to}"`;
    const body = JSON.stringify({ jql, fields: ['assignee', 'status', 'resolutiondate', 'labels', 'issuetype'] });
    const data = await jiraApi(this.baseUrl, this.email, this.apiToken, '/rest/api/2/search', 'POST', body) as any;
    const issues: ItsIssue[] = [];
    for (const i of (data.issues ?? []) as any[]) {
      issues.push({
        id: i.id,
        key: i.key,
        assignee: i.fields?.assignee?.emailAddress ?? i.fields?.assignee?.name ?? null,
        status: i.fields?.status?.name ?? '',
        resolvedAt: i.fields?.resolutiondate ?? null,
      });
    }
    return issues;
  }
}

/**
 * Linear connector. Uses the Linear GraphQL API. Requires an API key.
 */
export class LinearConnector implements ItsConnector {
  constructor(private readonly apiKey: string) {}

  async fetchResolvedIssues(from: string, to: string): Promise<ItsIssue[]> {
    const query = `query { issues(filter: { state: { type: { eq: "completed" } } }) { nodes { id identifier assignee { email } state { name } completedAt } } }`;
    const data = await linearApi(this.apiKey, query) as any;
    const issues: ItsIssue[] = [];
    for (const i of (data.data?.issues?.nodes ?? []) as any[]) {
      const resolved = i.completedAt;
      if (!resolved) continue;
      if (new Date(resolved) < new Date(from) || new Date(resolved) > new Date(to)) continue;
      issues.push({
        id: i.id,
        key: i.identifier,
        assignee: i.assignee?.email ?? null,
        status: i.state?.name ?? '',
        resolvedAt: resolved,
      });
    }
    return issues;
  }
}

// --- HTTP helpers (zero new deps, use Node built-in) ---

function githubApi(token: string, path: string): Promise<unknown> {
  return apiRequest('https', 'api.github.com', path, { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'evoveo-smart-reporter' });
}
function gitlabApi(token: string, path: string, baseUrl: string): Promise<unknown> {
  return apiRequest('https', baseUrl, path, { 'PRIVATE-TOKEN': token });
}
function jiraApi(baseUrl: string, email: string, token: string, path: string, method: string, body: string): Promise<unknown> {
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  return apiRequest('https', baseUrl, path, { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }, method, body);
}
function linearApi(apiKey: string, query: string): Promise<unknown> {
  return apiRequest('https', 'api.linear.app', '/graphql', { Authorization: apiKey, 'Content-Type': 'application/json' }, 'POST', JSON.stringify({ query }));
}

function apiRequest(
  proto: 'https' | 'http',
  host: string,
  path: string,
  headers: Record<string, string>,
  method = 'GET',
  body?: string,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const lib = proto === 'https' ? https : http;
    const r = lib.request({ hostname: host, path, method, headers }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error(`${host} ${path} ${res.statusCode}`)); return; }
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e as Error); }
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
