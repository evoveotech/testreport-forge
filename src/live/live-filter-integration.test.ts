/// <reference lib="dom" />
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';

const REPORT_URL = 'http://localhost:9222/smart-report.html';

// Helper to extract filter state from the page
async function getFilterState(page: Page) {
  return page.evaluate(() => {
    const summaryEl = document.getElementById('live-filter-summary');
    const summaryText = summaryEl?.textContent?.trim() || '';
    const match = summaryText.match(/(\d+) of (\d+)/);
    const allMatch = summaryText.match(/All (\d+)/);

    return {
      summary: summaryText,
      matchCount: match ? parseInt(match[1]) : (allMatch ? parseInt(allMatch[1]) : -1),
      total: match ? parseInt(match[2]) : (allMatch ? parseInt(allMatch[1]) : -1),
      checkedFiles: Array.from(
        document.querySelectorAll('#live-filter-files-list input[type="checkbox"]:checked')
      ).map(b => b.getAttribute('data-file')!),
      uncheckedFiles: Array.from(
        document.querySelectorAll('#live-filter-files-list input[type="checkbox"]:not(:checked)')
      ).map(b => b.getAttribute('data-file')!),
      checkedSuites: Array.from(
        document.querySelectorAll('#live-filter-suites-list input[type="checkbox"]:checked')
      ).map(b => b.getAttribute('data-suite')!),
      selectedTags: Array.from(
        document.querySelectorAll('.live-filter-chip.selected')
      ).map(c => c.getAttribute('data-tag')!),
      grep: (document.getElementById('live-filter-grep') as HTMLInputElement)?.value || '',
    };
  });
}

describe('Live filter UI integration', () => {
  let browser: Browser;
  let page: Page;
  let pageErrors: string[];

  beforeAll(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(REPORT_URL, { waitUntil: 'networkidle', timeout: 10000 });

    // Navigate to Live tab and open filter panel
    await page.locator('[data-view="live"]').click();
    await page.waitForTimeout(500);
    await page.evaluate(() => (window as any).toggleFilterPanel());
    await page.waitForTimeout(300);

    // Expand all sections so checkboxes are interactable
    await page.evaluate(() => {
      ['files', 'suites'].forEach(s => {
        const el = document.getElementById('live-filter-body-' + s);
        if (el) el.style.display = '';
      });
    });
  }, 15000);

  beforeEach(async () => {
    await page.evaluate(() => (window as any).clearAllFilters());
    await page.waitForTimeout(250);
  });

  afterAll(async () => {
    await browser?.close();
  });

  // ---- Basics ----

  it('has no JS errors on page load', () => {
    expect(pageErrors).toEqual([]);
  });

  it('shows the Run button, Filter toggle, and cascadeFilters function', async () => {
    expect(await page.locator('#live-run-btn').isVisible()).toBe(true);
    expect(await page.locator('#live-filter-toggle').isVisible()).toBe(true);
    const hasCascade = await page.evaluate(() => typeof (window as any).cascadeFilters);
    expect(hasCascade).toBe('function');
  });

  it('has all window functions defined', async () => {
    const funcs = await page.evaluate(() => ({
      toggleFilterPanel: typeof (window as any).toggleFilterPanel,
      runTests: typeof (window as any).runTests,
      cancelTests: typeof (window as any).cancelTests,
      updateFilterSummary: typeof (window as any).updateFilterSummary,
      cascadeFilters: typeof (window as any).cascadeFilters,
      clearAllFilters: typeof (window as any).clearAllFilters,
      selectAllFiles: typeof (window as any).selectAllFiles,
      toggleFilterChip: typeof (window as any).toggleFilterChip,
      toggleFileFilter: typeof (window as any).toggleFileFilter,
      toggleSuiteFilter: typeof (window as any).toggleSuiteFilter,
      toggleFilterSection: typeof (window as any).toggleFilterSection,
    }));
    for (const [name, type] of Object.entries(funcs)) {
      expect(type, `${name} should be a function`).toBe('function');
    }
  });

  // ---- Baseline state ----

  it('baseline: all tests selected, all files/suites checked', async () => {
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(28);
    expect(s.checkedFiles).toHaveLength(4);
    expect(s.checkedSuites).toHaveLength(6);
    expect(s.selectedTags).toHaveLength(0);
    expect(s.grep).toBe('');
    expect(s.summary).toContain('All');
  });

  // ---- Individual tag selection ----

  it('tag @experimental: 1 test, cascades to demo.spec.ts only', async () => {
    await page.locator('.live-filter-chip[data-tag="@experimental"]').click();
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(1);
    expect(s.checkedFiles).toEqual(['demo.spec.ts']);
    expect(s.checkedSuites).toEqual(['demo.spec.ts']);
  });

  it('tag @regression: 1 test, cascades to feature-demo.spec.ts only', async () => {
    await page.locator('.live-filter-chip[data-tag="@regression"]').click();
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(1);
    expect(s.checkedFiles).toEqual(['feature-demo.spec.ts']);
  });

  it('tag @smoke: 1 test, cascades to feature-demo.spec.ts only', async () => {
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(1);
    expect(s.checkedFiles).toEqual(['feature-demo.spec.ts']);
  });

  // ---- Multiple tags (OR logic) ----

  it('two tags in same file: @smoke + @regression = 2 tests, 1 file', async () => {
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(150);
    await page.locator('.live-filter-chip[data-tag="@regression"]').click();
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(2);
    expect(s.checkedFiles).toEqual(['feature-demo.spec.ts']);
  });

  it('two tags across files: @smoke + @experimental = 2 tests, 2 files', async () => {
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(150);
    await page.locator('.live-filter-chip[data-tag="@experimental"]').click();
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(2);
    expect(s.checkedFiles).toHaveLength(2);
  });

  it('all 3 tags: 3 tests', async () => {
    for (const tag of ['@smoke', '@regression', '@experimental']) {
      await page.locator(`.live-filter-chip[data-tag="${tag}"]`).click();
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(200);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(3);
  });

  // ---- Tag select/deselect restoration ----

  it('deselecting a tag restores all files and suites', async () => {
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(300);
    let s = await getFilterState(page);
    expect(s.checkedFiles).toHaveLength(1);

    // Deselect
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(300);
    s = await getFilterState(page);
    expect(s.checkedFiles).toHaveLength(4);
    expect(s.checkedSuites).toHaveLength(6);
    expect(s.summary).toContain('All');
  });

  it('toggling tags on/off one by one restores correctly at each step', async () => {
    // Add all 3
    for (const tag of ['@smoke', '@regression', '@experimental']) {
      await page.locator(`.live-filter-chip[data-tag="${tag}"]`).click();
      await page.waitForTimeout(150);
    }
    let s = await getFilterState(page);
    expect(s.matchCount).toBe(3);

    // Remove one by one
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(200);
    s = await getFilterState(page);
    expect(s.matchCount).toBe(2);

    await page.locator('.live-filter-chip[data-tag="@regression"]').click();
    await page.waitForTimeout(200);
    s = await getFilterState(page);
    expect(s.matchCount).toBe(1);

    await page.locator('.live-filter-chip[data-tag="@experimental"]').click();
    await page.waitForTimeout(200);
    s = await getFilterState(page);
    expect(s.matchCount).toBe(28);
    expect(s.checkedFiles).toHaveLength(4);
  });

  // ---- Grep cascading ----

  it('grep "homepage": 3 tests, narrows to 2 files', async () => {
    await page.locator('#live-filter-grep').fill('homepage');
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(3);
    expect(s.checkedFiles).toHaveLength(2);
    expect(s.checkedFiles).toContain('demo.spec.ts');
    expect(s.checkedFiles).toContain('feature-demo.spec.ts');
  });

  it('grep "login": 1 test, narrows to 1 file', async () => {
    await page.locator('#live-filter-grep').fill('login');
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(1);
    expect(s.checkedFiles).toHaveLength(1);
    expect(s.checkedFiles).toContain('demo.spec.ts');
  });

  it('grep "search": 2 tests, includes Search functionality suite', async () => {
    await page.locator('#live-filter-grep').fill('search');
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(2);
    expect(s.checkedSuites).toContain('Search functionality');
  });

  it('clearing grep restores all files and suites', async () => {
    await page.locator('#live-filter-grep').fill('login');
    await page.waitForTimeout(300);
    let s = await getFilterState(page);
    expect(s.checkedFiles).toHaveLength(1);

    await page.locator('#live-filter-grep').fill('');
    await page.waitForTimeout(300);
    s = await getFilterState(page);
    expect(s.checkedFiles).toHaveLength(4);
    expect(s.checkedSuites).toHaveLength(6);
  });

  // ---- Tag + grep combined ----

  it('tag + grep intersection: @smoke + "homepage" = 1 test', async () => {
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(200);
    await page.locator('#live-filter-grep').fill('homepage');
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(1);
    expect(s.checkedFiles).toEqual(['feature-demo.spec.ts']);
  });

  it('non-overlapping tag + grep: @experimental + "search" = 0 tests, 0 files', async () => {
    await page.locator('.live-filter-chip[data-tag="@experimental"]').click();
    await page.waitForTimeout(200);
    await page.locator('#live-filter-grep').fill('search');
    await page.waitForTimeout(300);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(0);
    expect(s.checkedFiles).toHaveLength(0);
  });

  it('removing grep while tag stays narrows back to tag-only results', async () => {
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(200);
    await page.locator('#live-filter-grep').fill('homepage');
    await page.waitForTimeout(300);
    let s = await getFilterState(page);
    expect(s.matchCount).toBe(1);

    // Remove grep, keep tag
    await page.locator('#live-filter-grep').fill('');
    await page.waitForTimeout(300);
    s = await getFilterState(page);
    expect(s.matchCount).toBe(1); // @smoke still selected
    expect(s.checkedFiles).toEqual(['feature-demo.spec.ts']);
  });

  it('adding tag while grep is set re-cascades files', async () => {
    await page.locator('#live-filter-grep').fill('homepage');
    await page.waitForTimeout(300);
    let s = await getFilterState(page);
    expect(s.checkedFiles).toHaveLength(2); // demo + feature-demo

    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(300);
    s = await getFilterState(page);
    expect(s.checkedFiles).toHaveLength(1); // only feature-demo
  });

  // ---- File deselection (no primary filters) ----

  it('file deselection: demo.spec.ts = 18 remaining', async () => {
    await page.locator('#live-filter-files-list input[data-file="demo.spec.ts"]').uncheck();
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(18);
  });

  it('file deselection: feature-demo.spec.ts = 12 remaining', async () => {
    await page.locator('#live-filter-files-list input[data-file="feature-demo.spec.ts"]').uncheck();
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(12);
  });

  it('file deselection: both main files = 2 remaining (parallel only)', async () => {
    await page.locator('#live-filter-files-list input[data-file="demo.spec.ts"]').uncheck();
    await page.waitForTimeout(100);
    await page.locator('#live-filter-files-list input[data-file="feature-demo.spec.ts"]').uncheck();
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(2);
  });

  it('select none files = 0 tests', async () => {
    await page.evaluate(() => (window as any).selectAllFiles(false));
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(0);
  });

  it('individual file test counts sum to 28', async () => {
    const files = ['demo.spec.ts', 'feature-demo.spec.ts', 'parallel/test1.spec.ts', 'parallel/test2.spec.ts'];
    let total = 0;
    for (const file of files) {
      await page.evaluate(() => (window as any).clearAllFilters());
      await page.waitForTimeout(100);
      await page.evaluate(() => (window as any).selectAllFiles(false));
      await page.waitForTimeout(100);
      await page.locator(`#live-filter-files-list input[data-file="${file}"]`).check();
      await page.evaluate((f: string) => {
        (window as any).selectedFiles = {};
        (window as any).selectedFiles[f] = true;
        (window as any).updateFilterSummary();
      }, file);
      await page.waitForTimeout(200);
      const s = await getFilterState(page);
      total += s.matchCount;
    }
    expect(total).toBe(28);
  });

  // ---- Suite deselection (AND logic: all suites must be selected) ----

  it('suite deselection: API Documentation filters at least 1 test', async () => {
    await page.locator('#live-filter-suites-list input[data-suite="API Documentation"]').uncheck();
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.matchCount).toBeLessThan(28);
  });

  it('suite deselection: demo.spec.ts = 18 remaining (matches file deselection)', async () => {
    await page.locator('#live-filter-suites-list input[data-suite="demo.spec.ts"]').uncheck();
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(18);
  });

  it('suite deselection: feature-demo.spec.ts = 12 remaining (matches file deselection)', async () => {
    await page.locator('#live-filter-suites-list input[data-suite="feature-demo.spec.ts"]').uncheck();
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.matchCount).toBe(12);
  });

  // ---- Tag then manual file adjustment ----

  it('tag then manual file deselect narrows to 0', async () => {
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(300);
    let s = await getFilterState(page);
    expect(s.matchCount).toBe(1);
    expect(s.checkedFiles).toHaveLength(1);

    // Deselect the only remaining file
    await page.locator(`#live-filter-files-list input[data-file="${s.checkedFiles[0]}"]`).uncheck();
    await page.waitForTimeout(250);
    s = await getFilterState(page);
    expect(s.matchCount).toBe(0);
  });

  it('grep then manual file deselect narrows further', async () => {
    await page.locator('#live-filter-grep').fill('homepage');
    await page.waitForTimeout(300);
    let s = await getFilterState(page);
    expect(s.matchCount).toBe(3);
    expect(s.checkedFiles).toHaveLength(2);

    // Deselect one file
    await page.locator(`#live-filter-files-list input[data-file="${s.checkedFiles[0]}"]`).uncheck();
    await page.waitForTimeout(250);
    s = await getFilterState(page);
    expect(s.matchCount).toBeLessThan(3);
    expect(s.matchCount).toBeGreaterThan(0);
  });

  // ---- clearAllFilters ----

  it('clearAllFilters resets tags, grep, files, suites, and summary', async () => {
    // Set up a complex state
    await page.locator('.live-filter-chip[data-tag="@smoke"]').click();
    await page.waitForTimeout(100);
    await page.locator('#live-filter-grep').fill('homepage');
    await page.waitForTimeout(300);

    await page.evaluate(() => (window as any).clearAllFilters());
    await page.waitForTimeout(250);
    const s = await getFilterState(page);
    expect(s.selectedTags).toHaveLength(0);
    expect(s.grep).toBe('');
    expect(s.checkedFiles).toHaveLength(4);
    expect(s.checkedSuites).toHaveLength(6);
    expect(s.summary).toContain('All');
    expect(s.matchCount).toBe(28);
  });

  // ---- Panel toggle ----

  it('filter sections collapse and expand', async () => {
    await page.evaluate(() => (window as any).toggleFilterSection('tags'));
    await page.waitForTimeout(200);
    expect(await page.locator('#live-filter-body-tags').isVisible()).toBe(false);

    await page.evaluate(() => (window as any).toggleFilterSection('tags'));
    await page.waitForTimeout(200);
    expect(await page.locator('#live-filter-body-tags').isVisible()).toBe(true);
  });
});
