/**
 * Shared HTTP helpers for pipeline sources. Node built-in https/http only —
 * no new runtime dependencies (ADR-002). Supports JSON API calls, binary
 * downloads (for artifact zips), and redirect following (Azure DevOps
 * artifact downloads redirect to blob storage).
 */

import * as https from 'https';
import * as http from 'http';
import AdmZip from 'adm-zip';
import type { DownloadedArtifact } from './types';

/**
 * GET a JSON response from an HTTPS endpoint.
 */
export function apiJson(host: string, path: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    https.request({ hostname: host, path, method: 'GET', headers }, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`${host} ${path} returned ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e as Error); }
      });
    }).on('error', reject).end();
  });
}

/**
 * Download a binary resource (artifact zip). Follows redirects — Azure DevOps
 * artifact download URLs redirect to Azure Blob Storage.
 */
export function downloadBinary(url: string, headers?: Record<string, string>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, { headers }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadBinary(res.headers.location, headers).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`download ${url} returned ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Search a downloaded artifact zip for a test-result file (JUnit XML, TRX,
 * Playwright JSON, Newman JSON). Returns the first match with its detected
 * format. If the buffer isn't a zip, tries to detect it as a raw test file.
 */
export function findTestFileInZip(zipBuffer: Buffer): DownloadedArtifact | null {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    // Not a zip — maybe a raw XML/JSON file returned directly.
    return detectTestContent(zipBuffer.toString('utf-8'));
  }
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.toLowerCase();
    if (isTestFile(name)) {
      const content = entry.getData().toString('utf-8');
      const result = detectTestContent(content, name);
      if (result) return result;
    }
  }
  return null;
}

function isTestFile(name: string): boolean {
  return name.endsWith('.xml') || name.endsWith('.trx') || name.endsWith('.json')
    || name.includes('junit') || name.includes('test-result') || name.includes('test_result');
}

export function isTestArtifact(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes('test') || n.includes('junit') || n.includes('trx') || n.includes('report') || n.includes('result');
}

/**
 * Detect the format of a test-result file from its content + name.
 */
export function detectTestContent(content: string, name?: string): DownloadedArtifact | null {
  const lower = (name ?? '').toLowerCase();
  if (lower.endsWith('.trx') || content.includes('<TestRun') || content.includes('<UnitTestResult')) {
    return { content, format: 'trx', ext: 'trx' };
  }
  if (lower.endsWith('.json') || (content.trimStart().startsWith('{') && content.includes('"executions"'))) {
    return { content, format: 'newman', ext: 'json' };
  }
  if (content.includes('<testsuite') || content.includes('<testsuites')) {
    return { content, format: 'junit', ext: 'xml' };
  }
  if (content.trimStart().startsWith('{') || content.trimStart().startsWith('[')) {
    return { content, format: 'json', ext: 'json' };
  }
  return null;
}

/**
 * Resolve a token from config. PAT / GitHub-App: read from env var named in
 * tokenEnv. Other methods (service-principal, secrets-manager) are stubbed —
 * they require OAuth/secrets-manager flows deferred to a later phase.
 */
export function resolveToken(config: { auth: { tokenEnv?: string; method: string } }): string {
  if (config.auth.method === 'pat' || config.auth.method === 'github-app') {
    const token = config.auth.tokenEnv ? process.env[config.auth.tokenEnv] : undefined;
    if (!token) {
      throw new Error(`auth token not found in env var "${config.auth.tokenEnv}" for connector`);
    }
    return token;
  }
  throw new Error(`auth method "${config.auth.method}" not yet implemented (deferred to later phase)`);
}

export function mapTrigger(reason: string | undefined): string | undefined {
  if (!reason) return undefined;
  const r = reason.toLowerCase();
  if (r.includes('pull') || r.includes('pr')) return 'pull_request';
  if (r.includes('schedule') || r.includes('cron')) return 'schedule';
  if (r.includes('push') || r.includes('commit')) return 'push';
  if (r.includes('manual') || r.includes('triggered')) return 'manual';
  return r;
}
