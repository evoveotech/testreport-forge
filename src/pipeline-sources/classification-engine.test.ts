import { describe, it, expect } from 'vitest';
import { ClassificationEngine } from './classification-engine';
import type { ClassificationRule } from './types';

const baseRule = (overrides: Partial<ClassificationRule> = {}): ClassificationRule => ({
  match: { connector: 'azure-acme', repoName: /^payments-(.+)$/.toString().slice(1, -1) },
  orgContext: {
    tenantId: 'acme',
    client: 'internal',
    product: 'payments-${1}',
    team: 'payments-qa',
    stack: 'dotnet',
    runType: 'nightly',
    environment: 'ci',
  },
  ...overrides,
});

describe('ClassificationEngine', () => {
  it('matches a rule and interpolates capture groups into OrgContext', () => {
    const engine = new ClassificationEngine([baseRule()]);
    const result = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.orgContext.product).toBe('payments-gateway');
      expect(result.orgContext.tenantId).toBe('acme');
      expect(result.orgContext.runType).toBe('nightly');
      expect(result.ruleIndex).toBe(0);
    }
  });

  it('returns no-match when connector id differs', () => {
    const engine = new ClassificationEngine([baseRule()]);
    const result = engine.classify({
      connectorId: 'github-acme',
      kind: 'github-actions',
      repoName: 'payments-gateway',
    });
    expect(result.matched).toBe(false);
    if (!result.matched) {
      expect(result.reason).toContain('no classification rule matched');
    }
  });

  it('returns no-match when repo name does not match the regex', () => {
    const engine = new ClassificationEngine([baseRule()]);
    const result = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'claims-service',
    });
    expect(result.matched).toBe(false);
  });

  it('first match wins when multiple rules could match', () => {
    const engine = new ClassificationEngine([
      baseRule({ orgContext: { ...baseRule().orgContext, team: 'first-team' } }),
      baseRule({ orgContext: { ...baseRule().orgContext, team: 'second-team' } }),
    ]);
    const result = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.orgContext.team).toBe('first-team');
      expect(result.ruleIndex).toBe(0);
    }
  });

  it('matches on kind when connector id is not specified', () => {
    const engine = new ClassificationEngine([
      baseRule({ match: { kind: 'azure-devops', repoName: '^(.+)$' } }),
    ]);
    const result = engine.classify({
      connectorId: 'any-azure',
      kind: 'azure-devops',
      repoName: 'anything',
    });
    expect(result.matched).toBe(true);
  });

  it('AND logic: all specified match fields must match', () => {
    const engine = new ClassificationEngine([
      baseRule({ match: { connector: 'azure-acme', repoName: '^payments-', branch: '^main$' } }),
    ]);
    // branch doesn't match → no match
    const r1 = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
      branch: 'develop',
    });
    expect(r1.matched).toBe(false);
    // branch matches → match
    const r2 = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
      branch: 'main',
    });
    expect(r2.matched).toBe(true);
  });

  it('fileSignature: requires all signatures present in files list', () => {
    const engine = new ClassificationEngine([
      baseRule({ match: { connector: 'azure-acme', fileSignature: '*.csproj|appsettings.json' } }),
    ]);
    const r1 = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
      files: ['src/Payments.csproj', 'appsettings.json'],
    });
    expect(r1.matched).toBe(true);

    const r2 = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
      files: ['src/Payments.csproj'], // missing appsettings.json
    });
    expect(r2.matched).toBe(false);
  });

  it('fileSignature: skips rule when no file listing is available (conservative)', () => {
    const engine = new ClassificationEngine([
      baseRule({ match: { connector: 'azure-acme', fileSignature: '*.csproj' } }),
    ]);
    const result = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
      // no files field
    });
    expect(result.matched).toBe(false);
  });

  it('interpolates multiple capture groups', () => {
    const engine = new ClassificationEngine([
      baseRule({
        match: { connector: 'github-acme', repoName: '^(claims)-(ios|android)$' },
        orgContext: {
          tenantId: 'acme',
          client: 'internal',
          product: '${1}',
          team: '${1}-${2}',
          stack: '${2}',
          runType: 'pr',
          environment: 'ci',
        },
      }),
    ]);
    const result = engine.classify({
      connectorId: 'github-acme',
      kind: 'github-actions',
      repoName: 'claims-ios',
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.orgContext.product).toBe('claims');
      expect(result.orgContext.team).toBe('claims-ios');
      expect(result.orgContext.stack).toBe('ios');
    }
  });

  it('unknown ${N} references interpolate to empty string', () => {
    const engine = new ClassificationEngine([
      baseRule({
        match: { connector: 'azure-acme', repoName: '^payments-gateway$' },
        orgContext: {
          ...baseRule().orgContext,
          product: 'payments-${99}',
        },
      }),
    ]);
    const result = engine.classify({
      connectorId: 'azure-acme',
      kind: 'azure-devops',
      repoName: 'payments-gateway',
    });
    expect(result.matched).toBe(true);
    if (result.matched) {
      expect(result.orgContext.product).toBe('payments-');
    }
  });

  it('validateRules: detects invalid regex', () => {
    const errors = ClassificationEngine.validateRules([
      baseRule({ match: { connector: 'azure-acme', repoName: '[' } }),
    ]);
    expect(errors.some(e => e.includes('invalid regex'))).toBe(true);
  });

  it('validateRules: detects empty required OrgContext field', () => {
    const errors = ClassificationEngine.validateRules([
      baseRule({ orgContext: { ...baseRule().orgContext, tenantId: '' } }),
    ]);
    expect(errors.some(e => e.includes('tenantId'))).toBe(true);
  });

  it('validateRules: detects invalid runType', () => {
    const errors = ClassificationEngine.validateRules([
      baseRule({ orgContext: { ...baseRule().orgContext, runType: 'hourly' as any } }),
    ]);
    expect(errors.some(e => e.includes('runType'))).toBe(true);
  });

  it('validateRules: returns empty for valid rules', () => {
    const errors = ClassificationEngine.validateRules([baseRule()]);
    expect(errors).toEqual([]);
  });
});
