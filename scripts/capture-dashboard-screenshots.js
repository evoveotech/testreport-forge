#!/usr/bin/env node
/**
 * Capture screenshots of the leadership dashboard for documentation.
 *
 * Usage:
 *   npm run build
 *   node scripts/capture-dashboard-screenshots.js
 *
 * This script:
 *   1. Seeds a local FileStore with realistic multi-team sample data
 *   2. Boots the dashboard server on port 3001
 *   3. Captures screenshots of every view (estate, teams, runs, settings, login)
 *   4. Saves screenshots to images/leadership-dashboard/
 *   5. Shuts down the server
 *
 * Prerequisites:
 *   - Build the project first: npm run build
 *   - Playwright browsers installed: npx playwright install chromium
 */
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data-screenshots');
const SCREENSHOTS_DIR = path.join(ROOT, 'images', 'leadership-dashboard');
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

function ensureDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  console.log('\n  ═══════════════════════════════════════════');
  console.log('  Leadership Dashboard — Screenshot Capture');
  console.log('  ═══════════════════════════════════════════\n');

  // Step 1: Clean and seed data
  console.log('  Step 1: Seeding sample data...');
  ensureDir(DATA_DIR);
  ensureDir(SCREENSHOTS_DIR);
  const seedBin = path.join(ROOT, 'dist', 'bin', 'seed-data.js');
  execSync(`node "${seedBin}" --data-dir "${DATA_DIR}" --tenant acme`, { stdio: 'inherit', cwd: ROOT });

  // Step 2: Boot the dashboard server
  console.log('\n  Step 2: Booting dashboard server...');
  const dashboardBin = path.join(ROOT, 'dist', 'bin', 'dashboard.js');
  const server = spawn('node', [dashboardBin, '--data-dir', DATA_DIR, '--port', String(PORT), '--auth', 'dev'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: { ...process.env },
  });
  server.stdout.on('data', (d) => process.stdout.write(`  [server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`  [server-err] ${d}`));

  // Wait for the server to be ready
  console.log('  Waiting for server to start...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Check server is up
  const http = require('http');
  const isUp = await new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/`, (res) => { res.destroy(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
  if (!isUp) {
    console.error('  Server did not start. Aborting.');
    server.kill();
    process.exit(1);
  }
  console.log('  Server is up.');

  // Step 3: Capture screenshots
  console.log('\n  Step 3: Capturing screenshots...');
  const { chromium } = require('@playwright/test');

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch {
    console.log('  Bundled chromium not available, trying system Chrome...');
    browser = await chromium.launch({ headless: true, channel: 'chrome' });
  }

  const headers = {
    'X-Tenant-Id': 'acme',
    'X-User-Id': 'demo-director',
    'X-User-Role': 'admin',
  };

  async function shot(name, view, opts = {}) {
    const page = await browser.newPage({
      viewport: { width: opts.width || 1280, height: opts.height || 800 },
      colorScheme: 'dark',
    });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem('smart-reporter-theme', 'dark'); } catch {}
    });
    await page.waitForTimeout(500);

    // The SPA shows a login form first (dev mode). Fill it and sign in.
    const loginBtn = page.locator('#login-btn');
    if (await loginBtn.count() > 0) {
      await page.locator('#tenant').fill('acme');
      await page.locator('#user').fill('demo-director');
      await page.locator('#role').selectOption('admin');
      await loginBtn.click();
      // Wait for the estate data to load and render
      await page.waitForTimeout(2000);
    }

    // Navigate to the requested view by clicking the sidebar item
    if (view && view !== 'estate') {
      const navSelector = `[data-tab="${view}"]`;
      await page.locator(navSelector).first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // If a sub-action is specified (e.g. scroll), run it
    if (opts.action) {
      await opts.action(page);
      await page.waitForTimeout(500);
    }

    const screenshotPath = path.join(SCREENSHOTS_DIR, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  Captured: ${name}.png`);
    await page.close();
  }

  // Estate overview (default view)
  await shot('estate-overview', 'estate');

  // Estate overview — scroll down to see trend chart and heatmaps
  await shot('estate-trend', 'estate', {
    action: async (page) => {
      await page.evaluate(() => {
        const main = document.querySelector('.main');
        if (main) main.scrollTo({ top: 500, behavior: 'smooth' });
      });
    },
  });

  // Team contribution view
  await shot('team-contribution', 'teams');

  // Runs list view
  await shot('runs-list', 'runs');

  // Settings — cloud storage (single page with cards)
  await shot('settings', 'settings');

  // Sync health view
  await shot('sync-health', 'sync');

  // Period comparison view
  await shot('period-comparison', 'compare');

  // Login page (dev mode) — capture the login form before signing in
  const loginPage = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'dark',
  });
  await loginPage.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
  await loginPage.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    try { localStorage.setItem('smart-reporter-theme', 'dark'); } catch {}
  });
  await loginPage.waitForTimeout(500);
  await loginPage.screenshot({ path: path.join(SCREENSHOTS_DIR, 'login-dev.png'), fullPage: false });
  console.log('  Captured: login-dev.png');
  await loginPage.close();

  await browser.close();

  // Step 4: Shut down the server
  console.log('\n  Step 4: Shutting down server...');
  server.kill();

  // Clean up temp data
  fs.rmSync(DATA_DIR, { recursive: true, force: true });

  console.log('\n  ✅ Done!');
  console.log(`     Screenshots: ${SCREENSHOTS_DIR}`);
  console.log(`     (${fs.readdirSync(SCREENSHOTS_DIR).length} files)\n`);
}

main().catch((err) => {
  console.error('\n  ❌ Failed:', err);
  process.exit(1);
});
