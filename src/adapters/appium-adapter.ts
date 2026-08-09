/**
 * Appium Adapter
 *
 * Parses Appium test results. Appium can emit JUnit XML (via the
 * `--reporter` junit option or third-party reporters), so this adapter
 * reuses the JUnit XML parser and only overrides the framework metadata
 * and detection logic.
 *
 * Detection heuristics:
 *  - File path contains "appium"
 *  - Content contains "Appium" markers
 *
 * Format id: 'appium'
 */

import type { TestRunAdapter, AdapterContext, IngestedRun, FrameworkInfo } from './types';
import { JUnitAdapter } from './junit-adapter';

export class AppiumAdapter implements TestRunAdapter {
  readonly format = 'appium' as const;
  readonly name = 'Appium';

  private readonly junit = new JUnitAdapter();

  matches(content: string, inputPath?: string): boolean {
    const pathLower = inputPath?.toLowerCase() ?? '';
    if (pathLower.includes('appium')) {
      return /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
    }
    // Content-based detection: JUnit XML + Appium markers
    const hasTestSuite = /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
    const hasAppiumMarker = /appium/i.test(content);
    return hasTestSuite && hasAppiumMarker;
  }

  ingest(ctx: AdapterContext): IngestedRun {
    const run = this.junit.ingest(ctx);
    const framework: FrameworkInfo = {
      id: 'appium',
      label: 'Appium',
      version: run.framework.version,
    };
    return { ...run, framework };
  }
}
