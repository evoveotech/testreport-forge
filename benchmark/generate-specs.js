#!/usr/bin/env node

/**
 * Generates 50 spec files for the memory benchmark.
 *
 * Mix: ~35 passing, ~8 deterministic failures (bad selectors → screenshots/traces),
 * ~4 flaky (retry-based), ~3 skipped.
 *
 * All tests hit https://playwright.dev with varied paths.
 */

const fs = require('fs');
const path = require('path');

const specsDir = path.join(__dirname, 'specs');

// Clean existing specs
if (fs.existsSync(specsDir)) {
  for (const f of fs.readdirSync(specsDir)) {
    if (f.endsWith('.spec.ts')) fs.unlinkSync(path.join(specsDir, f));
  }
}
fs.mkdirSync(specsDir, { recursive: true });

const pages = [
  { path: '/', title: 'Playwright' },
  { path: '/docs/intro', title: 'Installation' },
  { path: '/docs/writing-tests', title: 'Writing tests' },
  { path: '/docs/api/class-page', title: 'Page' },
  { path: '/docs/api/class-locator', title: 'Locator' },
  { path: '/docs/test-assertions', title: 'Assertions' },
  { path: '/docs/api/class-browser', title: 'Browser' },
  { path: '/docs/api/class-browsercontext', title: 'BrowserContext' },
  { path: '/docs/selectors', title: 'Selectors' },
  { path: '/docs/navigations', title: 'Navigations' },
  { path: '/docs/api/class-elementhandle', title: 'ElementHandle' },
  { path: '/docs/api/class-frame', title: 'Frame' },
  { path: '/docs/api/class-jshandle', title: 'JSHandle' },
  { path: '/docs/api/class-request', title: 'Request' },
  { path: '/docs/api/class-response', title: 'Response' },
  { path: '/docs/api/class-route', title: 'Route' },
  { path: '/docs/api/class-dialog', title: 'Dialog' },
  { path: '/docs/api/class-download', title: 'Download' },
  { path: '/docs/api/class-consolemessage', title: 'ConsoleMessage' },
  { path: '/docs/api/class-filechooser', title: 'FileChooser' },
  { path: '/docs/test-configuration', title: 'Test configuration' },
  { path: '/docs/test-fixtures', title: 'Fixtures' },
  { path: '/docs/test-parameterize', title: 'Parametrize' },
  { path: '/docs/test-parallel', title: 'Parallelism' },
  { path: '/docs/test-reporters', title: 'Reporters' },
  { path: '/docs/test-retries', title: 'Retries' },
  { path: '/docs/test-timeouts', title: 'Timeouts' },
  { path: '/docs/test-annotations', title: 'Annotations' },
  { path: '/docs/trace-viewer', title: 'Trace viewer' },
  { path: '/docs/debug', title: 'Debugging' },
  { path: '/docs/ci', title: 'CI' },
  { path: '/docs/docker', title: 'Docker' },
  { path: '/docs/browsers', title: 'Browsers' },
  { path: '/docs/handles', title: 'Handles' },
  { path: '/docs/emulation', title: 'Emulation' },
  { path: '/docs/network', title: 'Network' },
  { path: '/docs/downloads', title: 'Downloads' },
  { path: '/docs/pom', title: 'Page object models' },
  { path: '/docs/mock', title: 'Mock APIs' },
  { path: '/docs/auth', title: 'Authentication' },
  { path: '/docs/input', title: 'Input' },
  { path: '/docs/dialogs', title: 'Dialogs' },
  { path: '/docs/frames', title: 'Frames' },
  { path: '/docs/evaluating', title: 'Evaluation' },
  { path: '/docs/events', title: 'Events' },
  { path: '/docs/codegen', title: 'Test generator' },
  { path: '/docs/locators', title: 'Locators' },
  { path: '/docs/actionability', title: 'Auto-waiting' },
  { path: '/docs/api-testing', title: 'API testing' },
  { path: '/community/welcome', title: 'Community' },
];

// Spec indices (0-based): 35 passing, 8 failing, 4 flaky, 3 skipped
const failingIndices = new Set([5, 12, 19, 24, 31, 37, 42, 47]);
const flakyIndices = new Set([8, 16, 28, 39]);
const skippedIndices = new Set([3, 22, 45]);

function generatePassing(page, index) {
  return `import { test, expect } from '@playwright/test';

test('${page.title} page loads correctly', async ({ page: p }) => {
  await p.goto('https://playwright.dev${page.path}');
  await expect(p).toHaveTitle(/${page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i);
});
`;
}

function generateFailing(page, index) {
  return `import { test, expect } from '@playwright/test';

test('${page.title} page has expected content', async ({ page: p }) => {
  await p.goto('https://playwright.dev${page.path}');
  // Deliberately wrong selector to trigger failure + screenshot/trace capture
  await expect(p.locator('[data-testid="nonexistent-element-${index}"]')).toBeVisible({ timeout: 3000 });
});
`;
}

function generateFlaky(page, index) {
  return `import { test, expect } from '@playwright/test';

// Flaky: fails on first attempt, passes on retry
test('${page.title} page eventually loads content', async ({ page: p }, testInfo) => {
  await p.goto('https://playwright.dev${page.path}');
  if (testInfo.retry === 0) {
    // Force failure on first attempt
    expect(true, 'Simulated transient failure').toBe(false);
  }
  await expect(p).toHaveTitle(/${page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i);
});
`;
}

function generateSkipped(page, index) {
  return `import { test, expect } from '@playwright/test';

test.skip('${page.title} page — skipped for benchmark', async ({ page: p }) => {
  await p.goto('https://playwright.dev${page.path}');
  await expect(p).toHaveTitle(/${page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i);
});
`;
}

let created = 0;
for (let i = 0; i < 50; i++) {
  const page = pages[i];
  const filename = `spec-${String(i + 1).padStart(2, '0')}-${page.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')}.spec.ts`;
  let content;

  if (skippedIndices.has(i)) {
    content = generateSkipped(page, i);
  } else if (failingIndices.has(i)) {
    content = generateFailing(page, i);
  } else if (flakyIndices.has(i)) {
    content = generateFlaky(page, i);
  } else {
    content = generatePassing(page, i);
  }

  fs.writeFileSync(path.join(specsDir, filename), content);
  created++;
}

const passing = 50 - failingIndices.size - flakyIndices.size - skippedIndices.size;
console.log(`Generated ${created} spec files in ${specsDir}`);
console.log(`  Passing: ${passing}, Failing: ${failingIndices.size}, Flaky: ${flakyIndices.size}, Skipped: ${skippedIndices.size}`);
