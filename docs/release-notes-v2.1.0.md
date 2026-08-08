# Evoveo Smart Reporter v2.1.0 — First public release

An intelligent test reporter with AI-powered failure analysis, flakiness detection, performance regression alerts, and a modern interactive dashboard. **Free and open source (Apache-2.0) — every feature included.**

Works with **any automation technology** — Playwright (native), plus JUnit XML, TRX, and Postman/Newman results via the `generate` CLI. One report format for your entire test estate.

---

## Why this exists

Most test reports answer one question: *did the run pass?* That's the wrong question. A green pipeline and a trustworthy test suite are not the same thing.

Evoveo Smart Reporter closes that gap — flakiness tracked across runs (not just retries), quality gates that block bad merges, AI-powered root cause analysis, and one dashboard across every framework in your estate.

## Install

```bash
npm install -D evoveo-smart-reporter
```

## Quick start (Playwright)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['evoveo-smart-reporter', {
    outputFile: 'smart-report.html',
    historyFile: 'test-history.json',
    maxHistoryRuns: 10,
  }]],
});
```

Run your tests. Open `smart-report.html`. That's it.

## Multi-framework (CLI)

```bash
# Cypress, Selenium, Jest, Vitest, Pytest, SoapUI, WebdriverIO — JUnit XML
npx evoveo-smart-reporter generate --input cypress-results.xml --framework "Cypress"

# .NET — MSTest, xUnit, NUnit, RestSharp
npx evoveo-smart-reporter generate --input TestResults.trx --format trx

# Postman / Newman
npx evoveo-smart-reporter generate --input newman-report.json --format newman

# Any framework — convert to the generic JSON schema
npx evoveo-smart-reporter generate --input my-results.json --format json --framework "Custom Runner"
```

Input format is auto-detected. The output is the same rich dashboard every time, with a framework badge so you always know what produced the numbers.

## Highlights

- **AI Failure Analysis** — fix suggestions using your own Anthropic, OpenAI, or Gemini API key (bring your own key, no middleman, off by default)
- **Flakiness Detection across runs** — Stable / Unstable / Flaky / New grades based on historical failure rate, not single-run retries
- **Quality Gates** — block merges when pass rate, flaky rate, or stability grade drop below your thresholds (`npx evoveo-smart-reporter gate`)
- **Auto-Quarantine** — pull chronically flaky tests out of gate calculations so CI stays green while someone fixes them for real
- **Performance Regression Alerts** — warns when tests get significantly slower than their historical average
- **Trend Analytics** — pass rate, duration, flaky count, and slow tests over time, with 2-sigma anomaly detection and clickable history
- **Run Comparison** — diff two runs to catch new failures, performance changes, and baseline drift before they ship
- **Artifact Gallery** — every screenshot, video, and trace file from the run in one visual grid
- **Stability Scoring** — composite health metrics (0–100, grades A to F)
- **Failure Clustering** — group similar failures by error type with AI analysis per cluster
- **Executive PDF Export** — Corporate, Minimal, and Dark themed variants
- **10 themes** + fully custom theme colours
- **Custom branding** — title, footer, logo
- **CI auto-detection** + Slack/Teams notifications
- **Live progress dashboard** — run, cancel, and filter tests as they execute
- **JSON & JUnit XML exports** for external tools

## QA Spec Kit (bonus)

This repo also ships **72 AI agent skills** plus the **Loop Engineering** methodology (Goal → Action → Observation → Adjustment → Stop). Drop it into Claude Code, Cursor, Windsurf, Copilot, or Devin, and your AI IDE gets opinionated guidance for writing tests, debugging, reviewing code, and shipping.

```bash
# Links 72 skills into all IDE folders
bash scripts/setup-agents.sh --project   # macOS / Linux
pwsh scripts/setup-agents.ps1 -Project   # Windows
```

## License & data

- **Apache-2.0** — no copyleft, safe for enterprise internal use, safe to fork
- **Data stays in your repo** — history is a JSON file, report is a self-contained HTML, exports are open formats. Zero vendor lock-in.
- **AI is bring-your-own-key** — Anthropic, OpenAI, or Gemini. No middleman, no per-run SaaS fee, no test data flowing through a vendor you didn't choose.
- **No telemetry, no phone-home** — the tool doesn't call home.

## What's new in 2.1.0

- **Copy AI Prompt** button on failed tests — copies a ready-to-paste, Playwright-style prompt for any AI assistant. No API key needed.
- `Failing` badge for consistently failing tests, distinct from `Flaky`.
- **Flaky classification fix**: tests that fail on every historical run are now `Failing` instead of `Flaky` (flakiness requires mixed pass/fail).
- Failure cluster names now group by Playwright matcher (e.g. `Assertion: toBeVisible`) instead of meaningless `Error`.
- Network logs summary shows the true request total with "(showing N)" when capped; status groups render as `2xx`/`4xx`.
- Breadcrumbs now reflect the active view; pass-rate trend bars are colour-coded by rate.

## What changed in 2.0.0

- **Fully open source again.** All licensing, tiers, trials, and paid gating removed — every feature is available to everyone under Apache-2.0.
- AI failure analysis is bring-your-own-key (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`).
- Removed `licenseKey` option, cloud upload, trial banners, and tier badges.

**Full changelog (all versions):** [CHANGELOG.md](https://github.com/evoveotech/testreport-forge/blob/main/CHANGELOG.md)

---

**Repo:** https://github.com/evoveotech/testreport-forge
**npm:** https://www.npmjs.com/package/evoveo-smart-reporter

If your test report has been telling you "passed" while your test suite has been quietly rotting, this is the upgrade. Star it, try it on one suite this week, and tell us what's missing.
