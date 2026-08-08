#!/usr/bin/env node
/**
 * Generate example reports from all supported input formats.
 *
 * Usage:
 *   node scripts/generate-examples.js
 *
 * This script:
 *   1. Runs `evoveo-smart-reporter generate` for each example file
 *   2. Outputs HTML reports to examples/multi-framework/reports/
 *   3. Captures screenshots of each report using Playwright
 *   4. Saves screenshots to images/multi-framework/
 *
 * Prerequisites:
 *   - Build the project first: npm run build
 *   - Playwright browsers installed: npx playwright install chromium
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLES_DIR = path.join(ROOT, 'examples', 'multi-framework');
const REPORTS_DIR = path.join(EXAMPLES_DIR, 'reports');
const SCREENSHOTS_DIR = path.join(ROOT, 'images', 'multi-framework');

const examples = [
  { input: 'cypress-junit.xml',       output: 'cypress-report.html',       framework: 'Cypress',         title: 'Cypress E2E Tests' },
  { input: 'dotnet-trx.trx',          output: 'dotnet-trx-report.html',     framework: 'MSTest (TRX)',    title: '.NET Test Results' },
  { input: 'postman-newman.json',     output: 'newman-report.html',         format: 'newman',             title: 'Postman API Tests' },
  { input: 'selenium-generic.json',   output: 'selenium-report.html',       format: 'json',               title: 'Selenium Web Tests' },
  { input: 'soapui-junit.xml',        output: 'soapui-report.html',         framework: 'SoapUI',          title: 'SoapUI Service Tests' },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function generateReports() {
  ensureDir(REPORTS_DIR);
  const cli = path.join(ROOT, 'dist', 'bin', 'cli.js');

  for (const ex of examples) {
    const inputPath = path.join(EXAMPLES_DIR, ex.input);
    const outputPath = path.join(REPORTS_DIR, ex.output);

    const flags = [
      'generate',
      '--input', `"${inputPath}"`,
      '--output', `"${outputPath}"`,
      '--title', `"${ex.title}"`,
    ];
    if (ex.format) flags.push('--format', ex.format);
    if (ex.framework) flags.push('--framework', `"${ex.framework}"`);

    console.log(`\n  Generating: ${ex.output}`);
    execSync(`node "${cli}" ${flags.join(' ')}`, { stdio: 'inherit', cwd: ROOT });

    // Clean up history file created during generation
    const historyFile = path.join(REPORTS_DIR, 'test-history.json');
    if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
  }
}

async function captureScreenshots() {
  ensureDir(SCREENSHOTS_DIR);
  const { chromium } = require('@playwright/test');

  console.log('\n  Launching browser for screenshots...');
  // Try the bundled Playwright chromium first; fall back to system Chrome channel
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.log('  Bundled chromium not available, trying system Chrome...');
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  }

  for (const ex of examples) {
    const reportPath = path.join(REPORTS_DIR, ex.output);
    if (!fs.existsSync(reportPath)) {
      console.warn(`  Skipping screenshot — report not found: ${ex.output}`);
      continue;
    }

    const screenshotName = ex.output.replace('.html', '.png');
    const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);

    console.log(`  Capturing: ${screenshotName}`);
    // Force dark color scheme so screenshots match the existing Playwright dark screenshots
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
      colorScheme: 'dark',
    });
    await page.goto(`file://${reportPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
    // Explicitly set data-theme="dark" on <html> to ensure the dark theme is active
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      // Persist the preference so the report's own JS doesn't override it
      try { localStorage.setItem('smart-reporter-theme', 'dark'); } catch {}
    });
    // Wait for the report to render and theme to apply
    await page.waitForTimeout(2000);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    await page.close();
  }

  await browser.close();
}

async function main() {
  console.log('\n  ═══════════════════════════════════════════');
  console.log('  Evoveo Smart Reporter — Example Generator');
  console.log('  ═══════════════════════════════════════════\n');

  console.log('  Step 1: Generating reports from example files...');
  generateReports();

  console.log('\n  Step 2: Capturing screenshots...');
  try {
    await captureScreenshots();
  } catch (err) {
    console.warn('\n  ⚠  Could not capture screenshots:', err.message);
    console.warn('     Make sure Playwright browsers are installed:');
    console.warn('     npx playwright install chromium\n');
  }

  console.log('\n  ✅ Done!');
  console.log(`     Reports:   ${REPORTS_DIR}`);
  console.log(`     Screenshots: ${SCREENSHOTS_DIR}`);
  console.log('');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
