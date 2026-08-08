/**
 * Adapters barrel export + registry + auto-detection.
 *
 * Usage:
 *   import { detectAdapter, getAdapter } from './adapters';
 *   const adapter = detectAdapter(content, inputPath); // auto-detect
 *   const adapter = getAdapter('junit');               // explicit
 */

export * from './types';
export * from './junit-adapter';
export * from './trx-adapter';
export * from './newman-adapter';
export * from './json-adapter';

import type { InputFormat, TestRunAdapter } from './types';
import { JUnitAdapter } from './junit-adapter';
import { TrxAdapter } from './trx-adapter';
import { NewmanAdapter } from './newman-adapter';
import { JsonAdapter } from './json-adapter';

/** Ordered registry — first match wins for auto-detection. */
const ADAPTERS: TestRunAdapter[] = [
  new TrxAdapter(),    // .trx is unambiguous, check first
  new JUnitAdapter(),  // <testsuites> / <testsuite>
  new NewmanAdapter(), // Postman JSON with run.executions
  new JsonAdapter(),   // generic JSON (smart-report-data.json or bare array)
];

/** Lookup by explicit format id. */
export function getAdapter(format: InputFormat): TestRunAdapter | undefined {
  if (format === 'playwright') return undefined; // live reporter, not file-based
  return ADAPTERS.find(a => a.format === format);
}

/**
 * Auto-detect the adapter for a given file content + path.
 * Tries each adapter's matches() in registry order; first match wins.
 */
export function detectAdapter(content: string, inputPath?: string): TestRunAdapter | undefined {
  for (const adapter of ADAPTERS) {
    try {
      if (adapter.matches(content, inputPath)) return adapter;
    } catch {
      // matches() should not throw, but be defensive
    }
  }
  return undefined;
}

/** Human-readable list of supported formats, for CLI help. */
export function supportedFormats(): string {
  return ADAPTERS.map(a => `${a.format} (${a.name})`).join(', ');
}
