import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  timeout: 30000,
  retries: 2,

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },

  reporter: [
    ['list'],
    ['../dist/smart-reporter.js', {
      outputFile: 'smart-report.html',
      historyFile: 'test-history.json',
      maxHistoryRuns: 10,
      enableRetryAnalysis: true,
      enableFailureClustering: true,
      enableStabilityScore: true,
      enableComparison: true,
      enableTrendsView: true,
      enableTraceViewer: true,
      enableNetworkLogs: true,
      live: {
        enabled: true,
        dashboard: true,
      },
    }],
  ],
});
