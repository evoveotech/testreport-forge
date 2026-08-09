/**
 * XCTest Adapter
 *
 * Parses Apple XCTest test results. `xcodebuild test` can emit JUnit XML
 * (via the `-resultBundlePath` + junit reporters or third-party exporters),
 * so this adapter reuses the JUnit XML parser and only overrides the
 * framework metadata and detection logic.
 *
 * Detection heuristics:
 *  - File path contains "xctest"
 *  - Content contains "TestSuite" with "xcodebuild" markers
 *
 * Format id: 'xctest'
 */

import type { TestRunAdapter, AdapterContext, IngestedRun, FrameworkInfo } from './types';
import { JUnitAdapter } from './junit-adapter';

export class XCTestAdapter implements TestRunAdapter {
  readonly format = 'xctest' as const;
  readonly name = 'XCTest (Apple)';

  private readonly junit = new JUnitAdapter();

  matches(content: string, inputPath?: string): boolean {
    const pathLower = inputPath?.toLowerCase() ?? '';
    if (pathLower.includes('xctest')) {
      return /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
    }
    // Content-based detection: TestSuite + xcodebuild markers
    const hasTestSuite = /<testsuites?[\s>]/i.test(content) || /<testsuite[\s>]/i.test(content);
    const hasXcodeMarker = /xcodebuild/i.test(content);
    return hasTestSuite && hasXcodeMarker;
  }

  ingest(ctx: AdapterContext): IngestedRun {
    const run = this.junit.ingest(ctx);
    const framework: FrameworkInfo = {
      id: 'xctest',
      label: 'XCTest',
      version: run.framework.version,
    };
    return { ...run, framework };
  }
}
