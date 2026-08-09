import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { RunQuery } from '../store';
import { Aggregator } from '../aggregator';
import type { IngestedRun, EstateRollup } from '../types';
import type { AuthProvider, Session } from './auth';
import type { StoreResolver } from './store-resolver';
import type { ConnectorService } from '../connectors';
import { detectAdapter, getAdapter } from '../adapters';
import type { AdapterContext } from '../adapters/types';
import type { TestResultData } from '../types';

/**
 * The dashboard REST API. Every route is tenant-scoped from the authenticated
 * session -- there is no code path that reads another tenant's data (the
 * store enforces isolation, ADR-003; the API never passes a different
 * tenantId than the session's).
 *
 * The store is resolved per-request via StoreResolver, so each user can
 * have their own cloud storage backend (OneDrive/Google Drive) pointing
 * to a shared folder.
 *
 * Routes:
 *   GET  /api/estate?period=weekly              estate rollup (with byStackCategory)
 *   GET  /api/trend?period=weekly               standalone trend series
 *   GET  /api/estate/drilldown?team=X&period=   team drill-down (worst/flaky runs)
 *   GET  /api/compare?period=weekly             period-over-period comparison
 *   GET  /api/contributors?period=weekly        individual contributor metrics
 *   GET  /api/runs?client=&product=...          filtered run list (tenant-scoped)
 *   GET  /api/runs/:runId                        single run detail
 *   GET  /api/runs/:runId/report                 single-run HTML report (ADR-004)
 *   GET  /api/me                                 current session
 */
export class DashboardApi {
  constructor(
    private readonly storeResolver: StoreResolver,
    private readonly auth: AuthProvider,
    private readonly connectorService?: ConnectorService,
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-Id, X-User-Id, X-User-Role');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    // Public health endpoint.
    if (url === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    // Authenticate everything else.
    const session = await this.auth.resolveSession(req);
    if (!session) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    if (url === '/api/me' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(session));
      return;
    }

    // Resolve the store for this user (cloud or local).
    const store = await this.storeResolver.resolve(session);
    const aggregator = new Aggregator(store);

    if (url.startsWith('/api/estate/drilldown') && method === 'GET') {
      const period = parsePeriod(url);
      const team = parseParam(url, 'team');
      if (!team) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'missing team parameter' }));
        return;
      }
      const drillDown = await aggregator.teamDrillDown(session.tenantId, team, period);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(drillDown));
      return;
    }

    if (url.startsWith('/api/estate') && method === 'GET') {
      const period = parsePeriod(url);
      // Fetch connector data (testsAuthored/fixesLanded) if connectors are configured.
      // Uses a 5-minute cache so external APIs aren't hit on every request.
      const now = Date.now();
      const periodMs = period === 'daily' ? 86400000 : period === 'weekly' ? 7 * 86400000 : period === 'monthly' ? 30 * 86400000 : period === 'quarterly' ? 90 * 86400000 : 100 * 365 * 86400000;
      const from = new Date(now - periodMs).toISOString();
      const to = new Date(now).toISOString();
      const connectorData = this.connectorService
        ? await this.connectorService.fetchConnectorData(from, to)
        : undefined;
      const rollup: EstateRollup = await aggregator.estateRollup(session.tenantId, period, connectorData);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rollup));
      return;
    }

    if (url.startsWith('/api/trend') && method === 'GET') {
      const period = parsePeriod(url);
      const trend = await aggregator.trendSeries(session.tenantId, period);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(trend));
      return;
    }

    if (url.startsWith('/api/compare') && method === 'GET') {
      const period = parsePeriod(url);
      const comparison = await aggregator.compare(session.tenantId, period);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(comparison));
      return;
    }

    if (url.startsWith('/api/contributors') && method === 'GET') {
      const period = parsePeriod(url);
      const now = Date.now();
      const periodMs = period === 'daily' ? 86400000 : period === 'weekly' ? 7 * 86400000 : period === 'monthly' ? 30 * 86400000 : period === 'quarterly' ? 90 * 86400000 : 100 * 365 * 86400000;
      const from = new Date(now - periodMs).toISOString();
      const to = new Date(now).toISOString();
      const connectorData = this.connectorService
        ? await this.connectorService.fetchConnectorData(from, to)
        : undefined;
      const contributors = await aggregator.individualContributions(session.tenantId, period, connectorData);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(contributors));
      return;
    }

    if (url.startsWith('/api/runs/') && method === 'GET') {
      const runId = decodeURIComponent(url.split('/api/runs/')[1].split('?')[0]);
      if (runId.endsWith('/report')) {
        await this.serveReport(store, session, runId.replace('/report', ''), res);
        return;
      }
      if (runId.endsWith('/tests')) {
        await this.serveTestCases(store, session, runId.replace('/tests', ''), res);
        return;
      }
      const run = await store.getRun(session.tenantId, runId);
      if (!run) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'not found' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(run));
      return;
    }

    if (url.startsWith('/api/runs') && method === 'GET') {
      const query = this.parseRunQuery(session, url);
      const runs: IngestedRun[] = await store.queryRuns(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(runs));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  }

  private parseRunQuery(session: Session, url: string): RunQuery {
    const q: RunQuery = { tenantId: session.tenantId, limit: 100 };
    const qs = url.split('?')[1] ?? '';
    for (const pair of qs.split('&')) {
      const [k, v] = pair.split('=');
      if (!k || v === undefined) continue;
      const val = decodeURIComponent(v);
      if (k === 'client') q.client = val;
      else if (k === 'product') q.product = val;
      else if (k === 'team') q.team = val;
      else if (k === 'stack') q.stack = val;
      else if (k === 'runType') q.runType = val as RunQuery['runType'];
      else if (k === 'environment') q.environment = val;
      else if (k === 'from') q.from = val;
      else if (k === 'to') q.to = val;
      else if (k === 'limit') q.limit = parseInt(val, 10) || 100;
    }
    return q;
  }

  private async serveReport(store: { getRun(tenantId: string, runId: string): Promise<IngestedRun | null> }, session: Session, runId: string, res: ServerResponse): Promise<void> {
    const run = await store.getRun(session.tenantId, runId);
    if (!run?.reportPath) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no report attached to this run' }));
      return;
    }
    const resolved = path.resolve(run.reportPath);
    if (!fs.existsSync(resolved)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'report file not found', path: run.reportPath }));
      return;
    }
    const html = fs.readFileSync(resolved, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  /**
   * Re-parse the raw artifact for a run and return individual test cases.
   * This gives the dashboard drill-down access to per-test detail (name,
   * status, duration, error message, suite) without storing every test case
   * in the JSONL run store. Parsing is <10ms for typical JUnit XML files.
   */
  private async serveTestCases(store: { getRun(tenantId: string, runId: string): Promise<IngestedRun | null> }, session: Session, runId: string, res: ServerResponse): Promise<void> {
    const run = await store.getRun(session.tenantId, runId);
    if (!run) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'run not found' }));
      return;
    }
    if (!run.rawArtifactPath) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no raw artifact attached to this run' }));
      return;
    }
    const resolved = path.resolve(run.rawArtifactPath);
    if (!fs.existsSync(resolved)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'raw artifact file not found', path: run.rawArtifactPath }));
      return;
    }
    const content = fs.readFileSync(resolved, 'utf-8');
    // Detect the adapter from the file content + extension
    const ext = path.extname(resolved).toLowerCase();
    const formatHint = ext === '.trx' ? 'trx' : ext === '.json' ? 'newman' : 'junit';
    const adapter = getAdapter(formatHint as any) ?? detectAdapter(content);
    if (!adapter) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `no adapter could parse this artifact (ext: ${ext})` }));
      return;
    }
    const ctx: AdapterContext = { outputDir: '.', options: {}, content };
    try {
      const ingested = adapter.ingest(ctx);
      // Return a slimmed-down view of each test case (omit heavy fields like
      // history, steps, screenshots that aren't needed in the dashboard)
      const tests = ingested.results.map((r: TestResultData) => ({
        testId: r.testId,
        title: r.title,
        suite: r.suite,
        suites: r.suites,
        file: r.file,
        status: r.status,
        duration: r.duration,
        error: r.error,
        outcome: r.outcome,
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        runId: run.runId,
        total: tests.length,
        passed: tests.filter(t => t.status === 'passed').length,
        failed: tests.filter(t => t.status === 'failed' || t.status === 'timedOut' || t.status === 'interrupted').length,
        skipped: tests.filter(t => t.status === 'skipped').length,
        tests,
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `failed to parse artifact: ${(e as Error).message}` }));
    }
  }
}

function parsePeriod(url: string): EstateRollup['period'] {
  const qs = url.split('?')[1] ?? '';
  for (const pair of qs.split('&')) {
    const [k, v] = pair.split('=');
    if (k === 'period') {
      const val = decodeURIComponent(v);
      if (val === 'daily' || val === 'weekly' || val === 'monthly' || val === 'quarterly' || val === 'all') return val;
    }
  }
  return 'weekly';
}

function parseParam(url: string, name: string): string | undefined {
  const qs = url.split('?')[1] ?? '';
  for (const pair of qs.split('&')) {
    const [k, v] = pair.split('=');
    if (k === name) return decodeURIComponent(v);
  }
  return undefined;
}
