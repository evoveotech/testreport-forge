import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Store, RunQuery } from '../store';
import { Aggregator } from '../aggregator';
import type { IngestedRun, EstateRollup } from '../types';
import type { AuthProvider, Session } from './auth';

/**
 * The dashboard REST API. Every route is tenant-scoped from the authenticated
 * session -- there is no code path that reads another tenant's data (the
 * store enforces isolation, ADR-003; the API never passes a different
 * tenantId than the session's).
 *
 * Routes:
 *   GET  /api/estate?period=weekly        estate rollup
 *   GET  /api/runs?client=&product=...    filtered run list (tenant-scoped)
 *   GET  /api/runs/:runId                 single run detail
 *   GET  /api/runs/:runId/report          single-run HTML report (ADR-004)
 *   GET  /api/me                          current session
 *   POST /api/ingest                      mount the ingest endpoint under auth
 *
 * The ingest POST is optionally mounted under /api/ingest so that runs
 * submitted through the dashboard are authenticated. The standalone ingest
 * bin (Task 4) is for behind-the-mesh use.
 */
export class DashboardApi {
  constructor(
    private readonly store: Store,
    private readonly aggregator: Aggregator,
    private readonly auth: AuthProvider,
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

    if (url.startsWith('/api/estate') && method === 'GET') {
      const period = parsePeriod(url);
      const rollup: EstateRollup = await this.aggregator.estateRollup(session.tenantId, period);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rollup));
      return;
    }

    if (url.startsWith('/api/runs/') && method === 'GET') {
      const runId = decodeURIComponent(url.split('/api/runs/')[1].split('?')[0]);
      if (runId.endsWith('/report')) {
        await this.serveReport(session, runId.replace('/report', ''), res);
        return;
      }
      const run = await this.store.getRun(session.tenantId, runId);
      if (!run) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'not found' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(run));
      return;
    }

    if (url.startsWith('/api/runs') && method === 'GET') {
      const query = this.parseRunQuery(session, url);
      const runs: IngestedRun[] = await this.store.queryRuns(query);
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

  private async serveReport(session: Session, runId: string, res: ServerResponse): Promise<void> {
    const run = await this.store.getRun(session.tenantId, runId);
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
}

function parsePeriod(url: string): EstateRollup['period'] {
  const qs = url.split('?')[1] ?? '';
  for (const pair of qs.split('&')) {
    const [k, v] = pair.split('=');
    if (k === 'period') {
      const val = decodeURIComponent(v);
      if (val === 'daily' || val === 'weekly' || val === 'monthly') return val;
    }
  }
  return 'weekly';
}
