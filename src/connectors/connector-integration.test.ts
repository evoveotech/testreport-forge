/**
 * Connector integration tests against real APIs.
 *
 * These tests are SKIP-GATED on environment variables. They only run when
 * real credentials are provided, so they don't fail in CI or local dev
 * without API access. To run them:
 *
 *   GITHUB_TOKEN=ghp_xxx GITHUB_OWNER=foo GITHUB_REPO=bar \
 *   JIRA_BASE_URL=https://foo.atlassian.net JIRA_EMAIL=me@foo.com \
 *   JIRA_API_TOKEN=xxx npm test -- connector-integration
 *
 * The existing connectors.test.ts covers the mapping logic with mocked
 * HTTP responses. These tests verify the real API contract (response
 * shapes, pagination, auth) that mocks cannot catch.
 */

import { describe, it, expect } from 'vitest';
import { GitHubConnector, JiraConnector, type VcsCommit, type ItsIssue } from './connectors';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;

const JIRA_BASE_URL = process.env.JIRA_BASE_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const hasGitHub = !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);
const hasJira = !!(JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN);

// Use a recent 30-day window for real API calls
const to = new Date().toISOString();
const from = new Date(Date.now() - 30 * 86400000).toISOString();

describe.skipIf(!hasGitHub)('GitHubConnector integration (real API)', () => {
  it('fetches real commits with the expected shape', async () => {
    const connector = new GitHubConnector(GITHUB_OWNER!, GITHUB_REPO!, GITHUB_TOKEN!);
    const commits = await connector.fetchCommits(from, to);

    // May be empty if the repo has no commits in the window — that's OK.
    // If there are commits, verify the shape matches VcsCommit.
    for (const c of commits) {
      expect(c.sha).toBeTruthy();
      expect(c.author).toBeTruthy();
      expect(Array.isArray(c.files)).toBe(true);
      expect(c.timestamp).toBeTruthy();
    }
  }, 30000);
});

describe.skipIf(!hasJira)('JiraConnector integration (real API)', () => {
  it('fetches resolved issues with the expected shape', async () => {
    const connector = new JiraConnector(JIRA_BASE_URL!, JIRA_EMAIL!, JIRA_API_TOKEN!);
    const issues = await connector.fetchResolvedIssues(from, to);

    // May be empty if no issues were resolved in the window — that's OK.
    // If there are issues, verify the shape matches ItsIssue.
    for (const i of issues) {
      expect(i.id).toBeTruthy();
      expect(i.key).toBeTruthy();
      expect(typeof i.status).toBe('string');
      // resolvedAt should be present (JQL filters on resolved)
      expect(i.resolvedAt).toBeTruthy();
    }
  }, 30000);
});

// Always-run sanity check: verify the skip-gating works
describe('connector integration skip-gating', () => {
  it('documents that integration tests require env vars', () => {
    if (!hasGitHub) {
      console.log('  GitHub integration tests skipped (set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO)');
    }
    if (!hasJira) {
      console.log('  Jira integration tests skipped (set JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN)');
    }
    // This test always passes — it just documents the skip reason
    expect(true).toBe(true);
  });
});
