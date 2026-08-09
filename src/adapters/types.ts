/**
 * Adapter abstraction for ingesting test results from any automation technology.
 *
 * The reporter's internal data model (TestResultData) is framework-agnostic.
 * Adapters convert from a specific framework's output format into that model.
 */

import type { TestResultData, TestHistory, CIInfo, SmartReporterOptions } from '../types';

/**
 * Supported input formats for the `generate` CLI command and programmatic API.
 * - `auto`: detect from file content/extension
 * - `junit`: JUnit XML (covers Cypress, Selenium, Jest, Vitest, Pytest, SoapUI, Newman-JUnit, etc.)
 * - `trx`: Microsoft MSTest/VSTest .trx (covers .NET/RestSharp test runs)
 * - `newman`: Postman/Newman JSON report
 * - `json`: generic JSON in smart-report-data.json schema
 * - `playwright`: live Playwright reporter (default, backwards compatible)
 * - `xctest`: Apple XCTest JUnit XML (xcodebuild test)
 * - `espresso`: Android Espresso JUnit XML (Android test orchestrator)
 * - `appium`: Appium JUnit XML
 */
export type InputFormat = 'auto' | 'junit' | 'trx' | 'newman' | 'json' | 'playwright' | 'xctest' | 'espresso' | 'appium';

/**
 * Metadata about the source automation framework, surfaced in the report.
 */
export interface FrameworkInfo {
  /** Canonical framework id, e.g. 'playwright', 'junit', 'trx', 'newman' */
  id: string;
  /** Human-readable label shown in the report header, e.g. 'Playwright', 'MSTest (TRX)' */
  label: string;
  /** Optional version of the source framework, when detectable */
  version?: string;
}

/**
 * The output of an adapter: a normalized run ready to feed into the report pipeline.
 */
export interface IngestedRun {
  /** Normalized test results in the reporter's internal data model */
  results: TestResultData[];
  /** Detected/provided framework metadata */
  framework: FrameworkInfo;
  /** Optional CI info detected or provided alongside the run */
  ciInfo?: CIInfo;
  /** Optional pre-existing history to merge with (e.g. from a prior run) */
  history?: TestHistory;
  /** Wall-clock start time of the run (ms epoch), when known */
  startTime?: number;
  /** Total run duration in ms, when known */
  duration?: number;
}

/**
 * Context passed to an adapter, carrying user options that may influence parsing.
 */
export interface AdapterContext {
  /** Resolved output directory for the report (for relative path computation) */
  outputDir: string;
  /** Reporter options (may contain framework override, projectName, etc.) */
  options: SmartReporterOptions;
  /** Raw input content for string/buffer based adapters */
  content?: string;
  /** Resolved input file path (when reading from disk) */
  inputPath?: string;
}

/**
 * A TestRunAdapter converts a specific framework's result format into IngestedRun.
 */
export interface TestRunAdapter {
  /** Canonical format id this adapter handles */
  format: InputFormat;
  /** Human-readable name */
  name: string;
  /** Whether this adapter can parse the given content/path (for auto-detection) */
  matches(content: string, inputPath?: string): boolean;
  /** Parse the input into an IngestedRun */
  ingest(ctx: AdapterContext): IngestedRun;
}
