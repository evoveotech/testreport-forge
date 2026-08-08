/**
 * ReportGenerator — framework-agnostic report generation pipeline.
 *
 * This is the shared engine behind both:
 *  - The Playwright reporter (SmartReporter), which streams results via onTestEnd
 *    and finalizes via onEnd.
 *  - The `evoveo-smart-reporter generate` CLI, which ingests results from any
 *    automation technology (JUnit XML, TRX, Newman JSON, generic JSON) via
 *    adapters and produces the same HTML/JSON/JUnit/PDF report.
 *
 * It owns the analyzers, history collector, failure clusterer, and AI analyzer,
 * and orchestrates: analyze -> cluster -> AI -> compare -> gates -> quarantine
 * -> generate HTML/exports -> update history -> notify.
 */

import * as fs from 'fs';
import * as path from 'path';

import type {
  SmartReporterOptions,
  TestResultData,
  TestHistory,
  RunComparison,
  RunSnapshotFile,
  QualityGateResult,
  QuarantineFile,
  CIInfo,
} from './types';
import type { FrameworkInfo, IngestedRun } from './adapters/types';

import { HistoryCollector } from './collectors';
import {
  FlakinessAnalyzer,
  PerformanceAnalyzer,
  RetryAnalyzer,
  FailureClusterer,
  StabilityScorer,
  AIAnalyzer,
} from './analyzers';
import { generateHtml, type HtmlGeneratorData } from './generators/html-generator';
import { buildComparison } from './generators/comparison-generator';
import { exportJsonData } from './generators/json-exporter';
import { exportJunitXml } from './generators/junit-exporter';
import { exportPdfReport } from './generators/pdf-exporter';
import { generateExecutivePdf, type PdfThemeName } from './generators/executive-pdf';
import { SlackNotifier, TeamsNotifier, NotificationManager } from './notifiers';
import { QualityGateEvaluator, formatGateReport } from './gates';
import { QuarantineGenerator } from './quarantine';
import { isFlakyTest, detectCIInfo, sanitizeFilename } from './utils';

export interface ReportGeneratorParams {
  options: SmartReporterOptions;
  outputDir: string;
  /** Framework metadata (from adapter or auto-detected). Falls back to Playwright. */
  framework?: FrameworkInfo;
  /** CI info; auto-detected when omitted. */
  ciInfo?: CIInfo;
  /** Run start time (ms epoch). Defaults to now. */
  startTime?: number;
}

export class ReportGenerator {
  private options: SmartReporterOptions;
  private outputDir: string;
  private framework: FrameworkInfo;
  private ciInfo?: CIInfo;
  private startTime: number;

  private historyCollector: HistoryCollector;
  private flakinessAnalyzer: FlakinessAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private retryAnalyzer: RetryAnalyzer;
  private stabilityScorer: StabilityScorer;
  private failureClusterer: FailureClusterer;
  private aiAnalyzer: AIAnalyzer;

  private slackNotifier: SlackNotifier;
  private teamsNotifier: TeamsNotifier;
  private notificationManager?: NotificationManager;

  private results: TestResultData[] = [];

  constructor(params: ReportGeneratorParams) {
    this.options = params.options;
    this.outputDir = params.outputDir;
    this.framework = params.framework ?? { id: 'playwright', label: 'Playwright' };
    this.ciInfo = params.ciInfo ?? detectCIInfo();
    this.startTime = params.startTime ?? Date.now();

    // Apply framework override from options
    if (this.options.framework) {
      this.framework = { id: this.options.framework.toLowerCase(), label: this.options.framework };
    }

    this.historyCollector = new HistoryCollector(this.options, this.outputDir);
    this.historyCollector.loadHistory();

    const thresholds = this.options.thresholds;
    const performanceThreshold = thresholds?.performanceRegression ?? this.options.performanceThreshold ?? 0.2;
    const retryFailureThreshold = this.options.retryFailureThreshold ?? 3;
    const stabilityThreshold = this.options.stabilityThreshold ?? 70;

    this.flakinessAnalyzer = new FlakinessAnalyzer(thresholds);
    this.performanceAnalyzer = new PerformanceAnalyzer(performanceThreshold);
    this.retryAnalyzer = new RetryAnalyzer(retryFailureThreshold);
    this.stabilityScorer = new StabilityScorer(stabilityThreshold, thresholds);
    this.failureClusterer = new FailureClusterer();
    this.aiAnalyzer = new AIAnalyzer();

    this.slackNotifier = new SlackNotifier(this.options.slackWebhook);
    this.teamsNotifier = new TeamsNotifier(this.options.teamsWebhook);
    if (this.options.notifications) {
      this.notificationManager = new NotificationManager(this.options.notifications);
    }
  }

  /**
   * Add a single normalized test result and run per-test analyzers.
   * Used for streaming; for batch ingestion call addResults().
   */
  addResult(testData: TestResultData): void {
    const history = this.historyCollector.getTestHistory(testData.testId);
    testData.history = history;
    this.flakinessAnalyzer.analyze(testData, history);
    this.performanceAnalyzer.analyze(testData, history);
    this.retryAnalyzer.analyze(testData, history);
    this.stabilityScorer.scoreTest(testData);
    this.results.push(testData);
  }

  /** Add a batch of results (e.g. from an adapter) and run per-test analyzers. */
  addResults(results: TestResultData[]): void {
    for (const r of results) this.addResult(r);
  }

  /** Ingest an entire adapter run in one call. */
  ingest(run: IngestedRun): void {
    if (run.framework) this.framework = run.framework;
    if (this.options.framework) {
      this.framework = { id: this.options.framework.toLowerCase(), label: this.options.framework };
    }
    if (run.ciInfo) this.ciInfo = run.ciInfo;
    if (run.startTime) this.startTime = run.startTime;
    this.addResults(run.results);
  }

  /** Current framework metadata (post-override). */
  getFramework(): FrameworkInfo {
    return this.framework;
  }

  /**
   * Run the full finalization pipeline and write the report + exports.
   * Mirrors SmartReporter.onEnd but framework-agnostic.
   */
  async generate(): Promise<string> {
    const results = this.results;
    const options = this.historyCollector.getOptions();

    // Failure clustering
    const failureClusters = this.failureClusterer.clusterFailures(results);

    // AI analysis
    let aiSuiteHealthSummary: string | undefined;
    if (options.enableAIRecommendations !== false) {
      await this.aiAnalyzer.analyzeFailed(results);
      if (failureClusters.length > 0) {
        await this.aiAnalyzer.analyzeClusters(failureClusters);
      }
      if (options.enableAISuiteHealth !== false && this.aiAnalyzer.isAvailable()) {
        aiSuiteHealthSummary = await this.buildAiSuiteHealth(results, failureClusters);
      }
    }

    // Comparison against baseline
    let comparison: RunComparison | undefined;
    if (options.enableComparison !== false) {
      comparison = this.buildComparison(results);
    }

    const outputPath = path.resolve(this.outputDir, this.options.outputFile ?? 'smart-report.html');
    const exportDir = path.dirname(outputPath);

    // Copy trace files (Playwright traces, when present)
    this.copyTraceFiles(results, outputPath);

    // History drilldown snapshots
    const historyRunSnapshots = this.loadHistorySnapshots();

    // Quality gates
    let qualityGateResult: QualityGateResult | undefined;
    if (this.options.qualityGates) {
      try {
        const evaluator = new QualityGateEvaluator();
        qualityGateResult = evaluator.evaluate(this.options.qualityGates, results, comparison);
      } catch (err) {
        console.warn('⚠️  Quality gate evaluation failed:', err);
      }
    }

    // Quarantine
    let quarantineResult: QuarantineFile | null = null;
    let quarantinedTestIds: Set<string> | undefined;
    if (this.options.quarantine?.enabled) {
      try {
        const generator = new QuarantineGenerator(this.options.quarantine);
        quarantineResult = generator.generate(results, exportDir);
        if (quarantineResult) {
          quarantinedTestIds = new Set(quarantineResult.entries.map(e => e.testId));
        }
      } catch (err) {
        console.warn('⚠️  Quarantine generation failed:', err);
      }
    }

    const htmlData: HtmlGeneratorData = {
      results,
      history: this.historyCollector.getHistory(),
      startTime: this.startTime,
      options: this.options,
      comparison,
      historyRunSnapshots,
      failureClusters,
      ciInfo: this.ciInfo,
      outputBasename: path.basename(outputPath, '.html'),
      qualityGateResult,
      quarantinedTestIds,
      quarantineEntries: quarantineResult?.entries,
      quarantineThreshold: this.options.quarantine?.threshold,
      aiSuiteHealthSummary,
      framework: this.framework.label,
    };

    // Generate HTML
    const report = generateHtml(htmlData);
    fs.writeFileSync(outputPath, report.html);
    if (report.css || report.js) {
      if (report.css) fs.writeFileSync(path.join(exportDir, `${htmlData.outputBasename}.css`), report.css);
      if (report.js) fs.writeFileSync(path.join(exportDir, `${htmlData.outputBasename}.js`), report.js);
    }

    console.log(`\n📊 Smart Report: ${outputPath}`);
    console.log(`   Framework: ${this.framework.label}`);
    console.log(`   Serve with trace viewer: npx evoveo-smart-reporter-serve "${outputPath}"`);
    console.log(`   Or open directly: open "${outputPath}"`);

    // Exports
    if (this.options.exportJson) {
      try {
        const jsonPath = exportJsonData(results, this.historyCollector.getHistory(), this.startTime, this.options, comparison, failureClusters, exportDir, htmlData.outputBasename);
        console.log(`   JSON data: ${jsonPath}`);
      } catch (err) {
        console.warn('⚠️  JSON export failed:', err);
      }
    }

    if (this.options.exportJunit) {
      try {
        const junitPath = exportJunitXml(results, this.options, exportDir, htmlData.outputBasename);
        console.log(`   JUnit XML: ${junitPath}`);
      } catch (err) {
        console.warn('⚠️  JUnit export failed:', err);
      }
    }

    if (this.options.exportPdf) {
      try {
        if (this.options.exportPdfFull) {
          const pdfPath = await exportPdfReport(outputPath, this.options, exportDir);
          if (pdfPath) console.log(`   PDF report (full): ${pdfPath}`);
        } else {
          const pdfData = {
            results,
            history: this.historyCollector.getHistory(),
            startTime: this.startTime,
            ciInfo: this.ciInfo,
            failureClusters,
            projectName: this.options.projectName,
            qualityGateResult,
            quarantineEntries: quarantineResult?.entries,
            quarantineThreshold: this.options.quarantine?.threshold,
            branding: this.options.branding,
          };
          const pdfThemes: PdfThemeName[] = ['corporate', 'dark', 'minimal'];
          for (const pdfTheme of pdfThemes) {
            const pdfPath = generateExecutivePdf(pdfData, exportDir, htmlData.outputBasename, pdfTheme);
            if (pdfTheme === 'corporate') console.log(`   PDF executive summary: ${pdfPath}`);
          }
        }
      } catch (err) {
        console.warn('⚠️  PDF export failed:', err);
      }
    }

    // Update history
    this.historyCollector.updateHistory(results);

    // Notifications
    const failed = results.filter(r =>
      r.outcome === 'unexpected' && (r.status === 'failed' || r.status === 'timedOut')
    ).length;
    if (this.notificationManager) {
      await this.notificationManager.notify(results, this.startTime, comparison);
    } else if (failed > 0) {
      await this.slackNotifier.notify(results);
      await this.teamsNotifier.notify(results);
    }

    // Quality gate exit code
    if (qualityGateResult) {
      console.log(formatGateReport(qualityGateResult));
      if (!qualityGateResult.passed) process.exitCode = 1;
    }

    // Quarantine log
    if (quarantineResult) {
      const qPath = new QuarantineGenerator(this.options.quarantine!).getOutputPath(exportDir);
      console.log(`   Quarantine: ${quarantineResult.entries.length} test(s) quarantined -> ${qPath}`);
    } else if (this.options.quarantine?.enabled) {
      console.log('   Quarantine: no tests exceed flakiness threshold');
    }

    return outputPath;
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private async buildAiSuiteHealth(results: TestResultData[], failureClusters: ReturnType<FailureClusterer['clusterFailures']>): Promise<string | undefined> {
    const passed = results.filter(r => r.status === 'passed' || r.outcome === 'expected' || r.outcome === 'flaky').length;
    const failed = results.filter(r => r.outcome === 'unexpected' && (r.status === 'failed' || r.status === 'timedOut')).length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const flakyCount = results.filter(r => isFlakyTest(r)).length;
    const slowCount = results.filter(r => r.performanceTrend?.startsWith('↑')).length;
    const needsRetry = results.filter(r => r.retryInfo?.needsAttention).length;
    const total = results.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgStability = results.reduce((sum, r) => sum + (r.stabilityScore?.overall ?? 100), 0) / Math.max(total, 1);
    const suiteStats = {
      total, passed, failed, skipped,
      flaky: flakyCount, slow: slowCount, needsRetry,
      passRate, averageStability: Math.round(avgStability),
    };
    const historySummaries = this.historyCollector.getHistory().summaries ?? [];
    return this.aiAnalyzer.analyzeSuiteHealth(results, suiteStats, failureClusters, historySummaries);
  }

  private buildComparison(results: TestResultData[]): RunComparison | undefined {
    const baselineRun = this.historyCollector.getBaselineRun();
    if (!baselineRun) return undefined;

    const passed = results.filter(r =>
      r.status === 'passed' || r.outcome === 'expected' || r.outcome === 'flaky'
    ).length;
    const failed = results.filter(r =>
      r.outcome === 'unexpected' && (r.status === 'failed' || r.status === 'timedOut')
    ).length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const flaky = results.filter(r => r.outcome === 'flaky').length;
    const slow = results.filter(r => r.performanceTrend?.startsWith('↑')).length;
    const duration = Date.now() - this.startTime;

    const currentSummary = {
      runId: this.historyCollector.getCurrentRun().runId,
      timestamp: this.historyCollector.getCurrentRun().timestamp,
      total: results.length,
      passed, failed, skipped, flaky, slow, duration,
      passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    };

    const baselineTests = new Map<string, TestResultData>();
    const history = this.historyCollector.getHistory();
    for (const [testId, entries] of Object.entries(history.tests)) {
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1];
        const matchingTest = results.find(r => r.testId === testId);
        if (matchingTest) {
          baselineTests.set(testId, {
            ...matchingTest,
            status: lastEntry.passed ? 'passed' : 'failed',
            duration: lastEntry.duration,
          });
        }
      }
    }

    return buildComparison(results, currentSummary, baselineRun, baselineTests);
  }

  private copyTraceFiles(results: TestResultData[], outputPath: string): void {
    const tracesDir = path.join(path.dirname(outputPath), 'traces');
    const traceResults = results.filter(r => r.attachments?.traces && r.attachments.traces.length > 0);
    if (traceResults.length === 0) return;

    if (!fs.existsSync(tracesDir)) fs.mkdirSync(tracesDir, { recursive: true });
    for (const result of traceResults) {
      if (!result.attachments?.traces) continue;
      for (let i = 0; i < result.attachments.traces.length; i++) {
        const tracePath = result.attachments.traces[i];
        if (fs.existsSync(tracePath)) {
          const safeTestId = sanitizeFilename(result.testId);
          const traceFileName = `${safeTestId}-trace-${i}.zip`;
          const destPath = path.join(tracesDir, traceFileName);
          fs.copyFileSync(tracePath, destPath);
          result.attachments.traces[i] = `./traces/${traceFileName}`;
        }
      }
    }
  }

  private loadHistorySnapshots(): Record<string, RunSnapshotFile> | undefined {
    if (!this.options.enableHistoryDrilldown) return undefined;
    try {
      const history = this.historyCollector.getHistory();
      const runFiles = history.runFiles || {};
      const historyPath = path.resolve(this.outputDir, this.options.historyFile ?? 'test-history.json');
      const historyDir = path.dirname(historyPath);
      const snapshots: Record<string, RunSnapshotFile> = {};
      for (const [runId, rel] of Object.entries(runFiles)) {
        const abs = path.resolve(historyDir, rel);
        if (!fs.existsSync(abs)) continue;
        try {
          const content = fs.readFileSync(abs, 'utf-8');
          snapshots[runId] = JSON.parse(content) as RunSnapshotFile;
        } catch {
          // ignore bad snapshot files
        }
      }
      return snapshots;
    } catch {
      return undefined;
    }
  }
}
