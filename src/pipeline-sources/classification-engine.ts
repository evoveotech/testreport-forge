/**
 * Classification rules engine (ADR-009 — amends ADR-005).
 *
 * Maps CI structural signal (connector id, repo name, project, branch, file
 * signatures) to an explicit OrgContext via declared rules. Template
 * interpolation: ${1}, ${2}... reference regex capture groups from the first
 * regex match in the rule's `match` block.
 *
 * A run that matches NO rule is rejected (returned as null), never silently
 * ingested. This preserves ADR-005's core guarantee: no silent mis-attribution.
 */

import type {
  ClassificationRule,
  OrgContextTemplate,
  RuleMatch,
} from './types';
import type { OrgContext } from '../types';

/**
 * Input signal from a discovered CI run, used to match against rules.
 */
export interface ClassificationInput {
  connectorId: string;
  kind: string;
  repoName: string;
  project?: string;
  branch?: string;
  /** File signatures present in the repo (when available from CI API). */
  files?: string[];
}

/**
 * Result of classification: either a resolved OrgContext or null (no match =
 * reject/quarantine).
 */
export type ClassificationResult =
  | { matched: true; orgContext: OrgContext; ruleIndex: number }
  | { matched: false; reason: string };

export class ClassificationEngine {
  constructor(private readonly rules: ClassificationRule[]) {}

  /**
   * Classify a run. Returns the resolved OrgContext if a rule matches, or a
   * no-match result. Rules are evaluated in order; first match wins.
   */
  classify(input: ClassificationInput): ClassificationResult {
    for (let i = 0; i < this.rules.length; i++) {
      const captures = this.matchRule(this.rules[i].match, input);
      if (captures) {
        const orgContext = this.interpolate(this.rules[i].orgContext, captures);
        return { matched: true, orgContext, ruleIndex: i };
      }
    }
    return {
      matched: false,
      reason: `no classification rule matched connector=${input.connectorId} repo=${input.repoName}`,
    };
  }

  /**
   * Test a rule's match criteria against the input. Returns the regex capture
   * groups (from the first matching regex field) if all criteria match, or
   * null if any criterion fails. All specified fields use AND logic.
   */
  private matchRule(match: RuleMatch, input: ClassificationInput): string[] | null {
    if (match.connector && input.connectorId !== match.connector) return null;
    if (match.kind && input.kind !== match.kind) return null;

    let captures: string[] | null = null;

    if (match.repoName) {
      const re = safeRegex(match.repoName);
      if (!re) return null;
      const m = re.exec(input.repoName);
      if (!m) return null;
      captures = m.slice(1);
    }

    if (match.project) {
      const re = safeRegex(match.project);
      if (!re || !re.test(input.project ?? '')) return null;
    }

    if (match.branch) {
      const re = safeRegex(match.branch);
      if (!re || !re.test(input.branch ?? '')) return null;
    }

    if (match.fileSignature) {
      if (!input.files || input.files.length === 0) {
        // No file listing available — cannot confirm signature; skip this rule
        // rather than falsely matching. This is the conservative choice: a
        // rule requiring a file signature cannot match without file evidence.
        return null;
      }
      const sigs = match.fileSignature.split('|').map(s => s.trim().toLowerCase());
      const filesLower = input.files.map(f => f.toLowerCase());
      const allPresent = sigs.every(sig =>
        filesLower.some(f => matchesFileSignature(f, sig)),
      );
      if (!allPresent) return null;
    }

    return captures ?? [];
  }

  /**
   * Interpolate ${N} templates in an OrgContextTemplate using regex captures.
   * ${1} → first capture group, ${2} → second, etc. Unknown references are
   * replaced with empty string (and the run will be rejected downstream if a
   * required field becomes empty).
   */
  private interpolate(template: OrgContextTemplate, captures: string[]): OrgContext {
    const interp = (s: string): string =>
      s.replace(/\$\{(\d+)\}/g, (_, n: string) => captures[parseInt(n, 10) - 1] ?? '');
    return {
      tenantId: interp(template.tenantId),
      client: interp(template.client),
      product: interp(template.product),
      team: interp(template.team),
      stack: interp(template.stack),
      runType: template.runType,
      environment: interp(template.environment),
    };
  }

  /**
   * Validate a set of rules for obvious errors (bad regex, empty templates).
   * Returns a list of error strings; empty = valid.
   */
  static validateRules(rules: ClassificationRule[]): string[] {
    const errors: string[] = [];
    rules.forEach((rule, i) => {
      for (const field of ['repoName', 'project', 'branch', 'fileSignature'] as const) {
        const val = rule.match[field];
        if (val && !safeRegex(val)) {
          errors.push(`rule[${i}].match.${field}: invalid regex "${val}"`);
        }
      }
      const required: Array<keyof OrgContextTemplate> = [
        'tenantId', 'client', 'product', 'team', 'stack', 'environment',
      ];
      for (const f of required) {
        if (!rule.orgContext[f] || rule.orgContext[f].trim() === '') {
          errors.push(`rule[${i}].orgContext.${f}: required and must be non-empty`);
        }
      }
      const validRunTypes = ['pr', 'nightly', 'daily', 'scheduled', 'manual'];
      if (!validRunTypes.includes(rule.orgContext.runType)) {
        errors.push(`rule[${i}].orgContext.runType: must be one of ${validRunTypes.join(', ')}`);
      }
    });
    return errors;
  }
}

/**
 * Compile a regex string safely. Returns null on invalid pattern.
 */
function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/**
 * Match a file against a signature pattern. Supports glob `*` wildcards:
 *   *.csproj   → any file ending in .csproj
 *   Info.plist → exact filename match
 */
function matchesFileSignature(file: string, sig: string): boolean {
  if (sig.startsWith('*.')) {
    return file.endsWith(sig.slice(1)); // *.csproj → endsWith .csproj
  }
  return file === sig || file.endsWith('/' + sig);
}
