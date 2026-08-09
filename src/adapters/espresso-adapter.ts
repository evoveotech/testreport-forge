/**
 * Espresso Adapter
 *
 * Parses Android Espresso test results. Espresso (via the Android test
 * orchestrator / `./gradlew connectedAndroidTest`) can emit JUnit XML, so
 * this adapter reuses the JUnit XML parser and only overrides the framework
 * metadata and detection logic.
 *
 * Detection heuristics:
 *  - File path contains "espresso"
 *  - Content contains "com.android" package markers
 *
 * Format id: 'espresso'
 */

import type { TestRunAdapter, AdapterContext, IngestedRun, FrameworkInfo } from './types';
import { JUnitAdapter } from './junit-adapter';

export class EspressoAdapter implements TestRunAdapter {
  readonly format = 'espresso' as const;
  readonly name = 'Espresso (Android)';

  private readonly junit = new JUnitAdapter();

  matches(content: string, inputPath?: string): boolean {
    const pathLower = inputPath?.toLowerCase() ?? '';
    if (pathLower.includes('espresso')) {
      return /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
    }
    // Content-based detection: JUnit XML + com.android package markers
    const hasTestSuite = /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
    const hasAndroidMarker = /com\.android/i.test(content);
    return hasTestSuite && hasAndroidMarker;
  }

  ingest(ctx: AdapterContext): IngestedRun {
    const run = this.junit.ingest(ctx);
    const framework: FrameworkInfo = {
      id: 'espresso',
      label: 'Espresso',
      version: run.framework.version,
    };
    return { ...run, framework };
  }
}
