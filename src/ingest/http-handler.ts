import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Store } from '../store';
import { IngestService } from './ingest-service';
import type { IngestPayload, IngestResult } from '../types';

/**
 * HTTP request handler for the ingest endpoint. Factored out of the bin so
 * it is testable without spawning a process. Routes:
 *   GET  /health  -> 200 { status: 'ok' }
 *   POST /runs    -> 202 { accepted, runId } or 400 { accepted: false, errors }
 *   anything else -> 404
 *
 * Security note: this handler performs no authentication. Authentication +
 * RBAC are layered on by the dashboard API (Task 7). The ingest endpoint is
 * intended to sit behind a reverse proxy / service mesh in production, or
 * behind the dashboard's auth layer when mounted under /api/ingest.
 */
export async function handleIngestRequest(
  req: IncomingMessage,
  res: ServerResponse,
  service: IngestService,
): Promise<void> {
  // CORS preflight for browser-based dashboards that POST runs.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/runs') {
    const body = await readBody(req);
    let payload: IngestPayload;
    try {
      payload = JSON.parse(body);
    } catch {
      respondJson(res, 400, { accepted: false, runId: '', errors: ['invalid JSON body'] });
      return;
    }
    const result: IngestResult = await service.ingest(payload);
    respondJson(res, result.accepted ? 202 : 400, result);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      // Guard against unbounded payloads (10 MB cap).
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function respondJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/**
 * Start the ingest HTTP server. Returns the server instance.
 */
export function startIngestServer(service: IngestService, port: number): http.Server {
  const server = http.createServer((req, res) => {
    handleIngestRequest(req, res, service).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal error', message: (err as Error).message }));
    });
  });
  server.listen(port);
  return server;
}
