import { describe, it, expect } from 'vitest';
import {
  computeTestsAuthored,
  computeFixesLanded,
  matchesAnyPattern,
  type VcsCommit,
  type ItsIssue,
  type TeamMapping,
} from './connectors';

const MAPPING: TeamMapping = {
  vcsAuthorToTeam: {
    'alice@acme.com': 'qa-a',
    'bob@acme.com': 'qa-b',
    'carol@acme.com': 'qa-a',
  },
  itsAssigneeToTeam: {
    'alice@acme.com': 'qa-a',
    'bob@acme.com': 'qa-b',
  },
  testFilePatterns: ['**/*.test.ts', '**/*Test.java', '**/test_*.py'],
  fixIssueLabels: ['bug', 'defect'],
};

describe('matchesAnyPattern (glob)', () => {
  it('matches **/*.test.ts', () => {
    expect(matchesAnyPattern('src/foo/bar.test.ts', MAPPING.testFilePatterns)).toBe(true);
    expect(matchesAnyPattern('src/foo.test.ts', MAPPING.testFilePatterns)).toBe(true);
  });

  it('matches **/*Test.java', () => {
    expect(matchesAnyPattern('src/FooTest.java', MAPPING.testFilePatterns)).toBe(true);
    expect(matchesAnyPattern('src/sub/BarTest.java', MAPPING.testFilePatterns)).toBe(true);
  });

  it('matches **/test_*.py', () => {
    expect(matchesAnyPattern('tests/test_foo.py', MAPPING.testFilePatterns)).toBe(true);
    expect(matchesAnyPattern('test_bar.py', MAPPING.testFilePatterns)).toBe(true);
  });

  it('does not match non-test files', () => {
    expect(matchesAnyPattern('src/foo.ts', MAPPING.testFilePatterns)).toBe(false);
    expect(matchesAnyPattern('src/Foo.java', MAPPING.testFilePatterns)).toBe(false);
    expect(matchesAnyPattern('README.md', MAPPING.testFilePatterns)).toBe(false);
  });
});

describe('computeTestsAuthored', () => {
  it('counts commits touching test files, attributed to the author\'s team', () => {
    const commits: VcsCommit[] = [
      { sha: 'c1', author: 'alice@acme.com', message: 'add test', files: ['src/foo.test.ts', 'src/foo.ts'], timestamp: '2026-08-09T10:00:00Z' },
      { sha: 'c2', author: 'bob@acme.com', message: 'add test', files: ['src/bar.test.ts'], timestamp: '2026-08-09T10:00:00Z' },
      { sha: 'c3', author: 'alice@acme.com', message: 'refactor', files: ['src/foo.ts'], timestamp: '2026-08-09T10:00:00Z' },
    ];
    const result = computeTestsAuthored(commits, MAPPING);
    expect(result['qa-a']).toBe(1); // alice's c1 touches a test file; c3 does not
    expect(result['qa-b']).toBe(1); // bob's c2 touches a test file
  });

  it('skips commits from unmapped authors', () => {
    const commits: VcsCommit[] = [
      { sha: 'c1', author: 'unknown@example.com', message: 'add test', files: ['src/foo.test.ts'], timestamp: 't' },
    ];
    expect(computeTestsAuthored(commits, MAPPING)).toEqual({});
  });

  it('skips commits that do not touch test files', () => {
    const commits: VcsCommit[] = [
      { sha: 'c1', author: 'alice@acme.com', message: 'docs', files: ['README.md'], timestamp: 't' },
    ];
    expect(computeTestsAuthored(commits, MAPPING)).toEqual({});
  });

  it('returns empty for no commits', () => {
    expect(computeTestsAuthored([], MAPPING)).toEqual({});
  });
});

describe('computeFixesLanded', () => {
  it('counts resolved issues attributed to the assignee\'s team', () => {
    const issues: ItsIssue[] = [
      { id: 'i1', key: 'PROJ-1', assignee: 'alice@acme.com', status: 'Done', resolvedAt: '2026-08-09T10:00:00Z' },
      { id: 'i2', key: 'PROJ-2', assignee: 'bob@acme.com', status: 'Done', resolvedAt: '2026-08-09T10:00:00Z' },
      { id: 'i3', key: 'PROJ-3', assignee: 'alice@acme.com', status: 'Open', resolvedAt: null },
    ];
    const result = computeFixesLanded(issues, MAPPING);
    expect(result['qa-a']).toBe(1); // alice's resolved issue
    expect(result['qa-b']).toBe(1); // bob's resolved issue
  });

  it('skips unresolved issues', () => {
    const issues: ItsIssue[] = [
      { id: 'i1', key: 'PROJ-1', assignee: 'alice@acme.com', status: 'Open', resolvedAt: null },
    ];
    expect(computeFixesLanded(issues, MAPPING)).toEqual({});
  });

  it('skips unassigned issues', () => {
    const issues: ItsIssue[] = [
      { id: 'i1', key: 'PROJ-1', assignee: null, status: 'Done', resolvedAt: '2026-08-09T10:00:00Z' },
    ];
    expect(computeFixesLanded(issues, MAPPING)).toEqual({});
  });

  it('skips issues from unmapped assignees', () => {
    const issues: ItsIssue[] = [
      { id: 'i1', key: 'PROJ-1', assignee: 'unknown@example.com', status: 'Done', resolvedAt: '2026-08-09T10:00:00Z' },
    ];
    expect(computeFixesLanded(issues, MAPPING)).toEqual({});
  });
});
