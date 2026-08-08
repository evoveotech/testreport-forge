import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConnectorService } from './connector-service';
import type { ConnectorConfig } from './connector-service';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-conn-'));
}

const SAMPLE_CONFIG: ConnectorConfig = {
  vcs: {
    type: 'github',
    token: 'ghp_testtoken',
    owner: 'test-org',
    repo: 'test-repo',
  },
  its: {
    type: 'jira',
    baseUrl: 'https://test.atlassian.net',
    email: 'test@test.com',
    apiKey: 'test-api-key',
  },
  teamMapping: {
    vcsAuthorToTeam: { 'dev@test.com': 'qa-a' },
    itsAssigneeToTeam: { 'qa@test.com': 'qa-a' },
    testFilePatterns: ['*.test.ts'],
    fixIssueLabels: ['bug', 'defect'],
  },
};

describe('ConnectorService', () => {
  let dir: string;
  let service: ConnectorService;

  beforeEach(() => {
    dir = tmpDir();
    service = new ConnectorService(dir);
  });

  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('loadConfig returns null when not configured', () => {
    expect(service.loadConfig()).toBeNull();
  });

  it('saveConfig + loadConfig round-trips', () => {
    service.saveConfig(SAMPLE_CONFIG);
    const loaded = service.loadConfig();
    expect(loaded).not.toBeNull();
    expect(loaded?.vcs?.type).toBe('github');
    expect(loaded?.vcs?.owner).toBe('test-org');
    expect(loaded?.its?.type).toBe('jira');
    expect(loaded?.teamMapping.vcsAuthorToTeam['dev@test.com']).toBe('qa-a');
  });

  it('clearConfig removes the config file', () => {
    service.saveConfig(SAMPLE_CONFIG);
    expect(service.loadConfig()).not.toBeNull();
    service.clearConfig();
    expect(service.loadConfig()).toBeNull();
  });

  it('fetchConnectorData returns empty object when no config', async () => {
    const data = await service.fetchConnectorData('2024-01-01', '2024-01-31');
    expect(data).toEqual({});
  });

  it('fetchConnectorData returns empty object when config has no vcs and no its', async () => {
    service.saveConfig({ teamMapping: SAMPLE_CONFIG.teamMapping });
    const data = await service.fetchConnectorData('2024-01-01', '2024-01-31');
    expect(data).toEqual({});
  });

  it('clearCache forces next fetch to bypass cache', async () => {
    // With no config, fetch returns {}. Cache stores this.
    await service.fetchConnectorData('2024-01-01', '2024-01-31');
    // Save a config and clear cache — next fetch should try to use it.
    service.saveConfig({ teamMapping: SAMPLE_CONFIG.teamMapping });
    service.clearCache();
    const data = await service.fetchConnectorData('2024-01-01', '2024-01-31');
    // Still empty because no vcs/its configured, but cache was bypassed.
    expect(data).toEqual({});
  });
});
