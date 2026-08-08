#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log(`
Usage: evoveo-smart-reporter <command> [options]

Commands:
  generate  Generate a smart report from any test result file
            (JUnit XML, TRX, Newman/Postman JSON, generic JSON)
  gate      Evaluate quality gates against a JSON export
  digest    Generate a test health digest from history

Run evoveo-smart-reporter <command> --help for command-specific help.
`);
}

function parseFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

async function runGate(): Promise<void> {
  if (hasFlag('--help')) {
    console.log(`
Usage: evoveo-smart-reporter gate [options]

Evaluate quality gates against a JSON export file.

Options:
  --config <path>    Path to gates config JSON file (required)
  --data <path>      Path to smart-report-data.json (default: smart-report-data.json)
  --help             Show this help
`);
    return;
  }

  const configPath = parseFlag('--config');
  const dataPath = parseFlag('--data') ?? 'smart-report-data.json';

  if (!configPath) {
    console.error('Error: --config is required. Provide a JSON file with quality gate rules.');
    console.error('Example: evoveo-smart-reporter gate --config gates.json');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found: ${configPath}`);
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(dataPath)) {
    console.error(`Error: Data file not found: ${dataPath}`);
    console.error('Run your tests with exportJson: true to generate this file.');
    process.exitCode = 1;
    return;
  }

  const { QualityGateEvaluator, formatGateReport } = await import('../gates');

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Reconstruct minimal TestResultData from JSON export
  const results = (data.tests || []).map((t: any) => ({
    testId: t.testId,
    title: t.title,
    file: t.file,
    status: t.status,
    duration: t.duration,
    outcome: t.outcome,
    flakinessScore: t.flakinessScore,
    stabilityScore: t.stabilityScore ? {
      overall: t.stabilityScore.overall,
      grade: t.stabilityScore.grade,
      flakiness: 0,
      performance: 0,
      reliability: 0,
      needsAttention: false,
    } : undefined,
    error: t.error,
    retry: t.retry,
    steps: [],
    history: [],
  }));

  const evaluator = new QualityGateEvaluator();
  const result = evaluator.evaluate(config, results, data.comparison);

  console.log(formatGateReport(result));

  if (!result.passed) {
    process.exitCode = 1;
  }
}

async function runDigest(): Promise<void> {
  if (hasFlag('--help')) {
    console.log(`
Usage: evoveo-smart-reporter digest [options]

Generate a test health digest from history.

Options:
  --period <period>    Analysis period: daily, weekly, monthly (default: weekly)
  --history <path>     Path to test-history.json (default: test-history.json)
  --output <path>      Write output to file instead of stdout
  --format <format>    Output format: markdown, text (default: markdown)
  --help               Show this help
`);
    return;
  }

  const period = (parseFlag('--period') ?? 'weekly') as 'daily' | 'weekly' | 'monthly';
  const historyPath = parseFlag('--history') ?? 'test-history.json';
  const output = parseFlag('--output');
  const format = (parseFlag('--format') ?? 'markdown') as 'markdown' | 'text';

  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    console.error(`Error: Invalid period "${period}". Use daily, weekly, or monthly.`);
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(historyPath)) {
    console.error(`Error: History file not found: ${historyPath}`);
    console.error('Run your tests with historyFile configured to generate this file.');
    process.exitCode = 1;
    return;
  }

  const { HealthDigest } = await import('../digest');

  const history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  const digest = new HealthDigest();
  const data = digest.analyze(history, {
    period,
    historyFile: historyPath,
    format,
  });

  const content = format === 'text'
    ? digest.generateText(data)
    : digest.generateMarkdown(data);

  if (output) {
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, content);
    console.log(`Digest written to ${output}`);
  } else {
    console.log(content);
  }
}

async function runGenerate(): Promise<void> {
  if (hasFlag('--help') || hasFlag('-h')) {
    const { supportedFormats } = await import('../adapters');
    console.log(`
Usage: evoveo-smart-reporter generate [options]

Generate a smart report from any test result file. Supports multiple
automation technologies via adapters:

  ${supportedFormats()}

Options:
  --input <path>       Path to the test result file (required)
  --format <format>    Input format: auto, junit, trx, newman, json (default: auto)
  --output <path>      Output HTML report path (default: smart-report.html)
  --history <path>     History file path (default: test-history.json)
  --framework <name>   Override the framework label shown in the report
  --project <name>     Project name (separates history per project)
  --export-json        Also write smart-report-data.json
  --export-junit       Also write JUnit XML
  --export-pdf         Also generate PDF executive summaries
  --theme <preset>     Theme preset (default, dark, light, high-contrast, ...)
  --title <title>      Report title (branding)
  --help, -h           Show this help

Examples:
  evoveo-smart-reporter generate --input results.xml
  evoveo-smart-reporter generate --input results.trx --format trx --framework "MSTest"
  evoveo-smart-reporter generate --input newman.json --format newman --export-pdf
  evoveo-smart-reporter generate --input cypress-junit.xml --framework "Cypress" --title "Cypress Run"
`);
    return;
  }

  const inputPath = parseFlag('--input');
  if (!inputPath) {
    console.error('Error: --input is required. Provide a path to a test result file.');
    console.error('Example: evoveo-smart-reporter generate --input results.xml');
    process.exitCode = 1;
    return;
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: Input file not found: ${resolvedInput}`);
    process.exitCode = 1;
    return;
  }

  const format = (parseFlag('--format') ?? 'auto') as 'auto' | 'junit' | 'trx' | 'newman' | 'json';
  const outputPath = parseFlag('--output') ?? 'smart-report.html';
  const historyFile = parseFlag('--history') ?? 'test-history.json';
  const frameworkOverride = parseFlag('--framework');
  const projectName = parseFlag('--project');
  const title = parseFlag('--title');
  const themePreset = parseFlag('--theme');

  const content = fs.readFileSync(resolvedInput, 'utf-8');
  const outputDir = path.dirname(path.resolve(outputPath));

  const { detectAdapter, getAdapter } = await import('../adapters');
  const { ReportGenerator } = await import('../report-generator');

  // Resolve adapter: explicit format or auto-detect
  let adapter;
  if (format !== 'auto') {
    adapter = getAdapter(format);
    if (!adapter) {
      console.error(`Error: Unknown format "${format}". Use auto, junit, trx, newman, or json.`);
      process.exitCode = 1;
      return;
    }
  } else {
    adapter = detectAdapter(content, resolvedInput);
    if (!adapter) {
      console.error(`Error: Could not auto-detect input format for ${resolvedInput}.`);
      console.error('Specify it explicitly with --format <junit|trx|newman|json>.');
      process.exitCode = 1;
      return;
    }
    console.log(`   Detected format: ${adapter.name} (${adapter.format})`);
  }

  // Parse the input
  const ingested = adapter.ingest({
    content,
    inputPath: resolvedInput,
    outputDir,
    options: {
      outputFile: path.basename(outputPath),
      historyFile,
      framework: frameworkOverride,
      projectName,
      exportJson: hasFlag('--export-json'),
      exportJunit: hasFlag('--export-junit'),
      exportPdf: hasFlag('--export-pdf'),
      theme: themePreset ? { preset: themePreset as any } : undefined,
      branding: title ? { title } : undefined,
    },
  });

  console.log(`   Ingested ${ingested.results.length} test result(s) from ${ingested.framework.label}`);

  // Generate the report
  const generator = new ReportGenerator({
    options: {
      outputFile: path.basename(outputPath),
      historyFile,
      framework: frameworkOverride,
      projectName,
      exportJson: hasFlag('--export-json'),
      exportJunit: hasFlag('--export-junit'),
      exportPdf: hasFlag('--export-pdf'),
      theme: themePreset ? { preset: themePreset as any } : undefined,
      branding: title ? { title } : undefined,
    },
    outputDir,
    framework: ingested.framework,
    ciInfo: ingested.ciInfo,
    startTime: ingested.startTime,
  });
  generator.ingest(ingested);
  await generator.generate();
}

async function main(): Promise<void> {
  switch (command) {
    case 'generate':
      await runGenerate();
      break;
    case 'gate':
      await runGate();
      break;
    case 'digest':
      await runDigest();
      break;
    case '--help':
    case '-h':
    case undefined:
      printUsage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exitCode = 1;
  }
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
