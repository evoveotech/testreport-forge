import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { FileStore } from '../store';
import { IngestService } from './ingest-service';
import { startIngestServer } from './http-handler';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-http-'));
}

function post(server: http.Server, urlPath: string, body: unknown): Promise<{ status: number; body: string }> {
  const addr = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(
      { host: '127.0.0.1', port: addr.port, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
      res => {
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(server: http.Server, urlPath: string): Promise<{ status: number; body: string }> {
  const addr = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${addr.port}${urlPath}`, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: buf }));
    }).on('error', reject);
  });
}

const JUNIT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites><testsuite name="s1" tests="2" failures="1" errors="0" skipped="0" time="1.5">
<testcase classname="s1" name="ok" time="0.5"/>
<testcase classname="s1" name="bad" time="1.0"><failure>boom</failure></testcase>
</testsuite></testsuites>`;

describe('ingest HTTP handler', () => {
  let dir: string;
  let store: FileStore;
  let service: IngestService;
  let server: http.Server;

  beforeEach(async () => {
    dir = tmpDir();
    store = new FileStore(dir);
    await store.open();
    service = new IngestService(store);
    server = startIngestServer(service, 0);
  });

  afterEach(async () => {
    server.close();
    await store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('GET /health returns 200 ok', async () => {
    const res = await get(server, '/health');
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).status).toBe('ok');
  });

  it('POST /runs with a valid JUnit payload returns 202 and a runId', async () => {
    const res = await post(server, '/runs', {
      orgContext: { tenantId: 'acme', client: 'c1', product: 'p1', team: 't1', stack: 'junit', runType: 'nightly', environment: 'ci' },
      format: 'junit',
      rawArtifact: JUNIT_XML,
    });
    expect(res.status).toBe(202);
    const json = JSON.parse(res.body);
    expect(json.accepted).toBe(true);
    expect(json.runId).toMatch(/^run-/);
    // The run is actually in the store.
    const got = await store.getRun('acme', json.runId);
    expect(got?.total).toBe(2);
    expect(got?.failed).toBe(1);
  });

  it('POST /runs with a missing orgContext returns 400', async () => {
    const res = await post(server, '/runs', { format: 'junit', rawArtifact: JUNIT_XML });
    expect(res.status).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.accepted).toBe(false);
    expect(json.errors).toContain('orgContext is required');
  });

  it('POST /runs with invalid JSON returns 400', async () => {
    const res = await post(server, '/runs', 'not json{');
    expect(res.status).toBe(400);
    expect(JSON.parse(res.body).errors[0]).toContain('invalid JSON');
  });

  it('unknown route returns 404', async () => {
    const res = await get(server, '/nope');
    expect(res.status).toBe(404);
  });

  it('OPTIONS preflight returns 204', async () => {
    const addr = server.address() as AddressInfo;
    const res = await new Promise<{ status: number }>(resolve => {
      const req = http.request(
        { host: '127.0.0.1', port: addr.port, path: '/runs', method: 'OPTIONS' },
        r => resolve({ status: r.statusCode ?? 0 }),
      );
      req.end();
    });
    expect(res.status).toBe(204);
  });
});
