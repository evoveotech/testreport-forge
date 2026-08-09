import * as fs from 'fs';
import * as path from 'path';
import type { FSWatcher } from 'fs';
import type { IngestService } from './ingest-service';
import type { IngestPayload, OrgContext } from '../types';

/**
 * Watches a directory for dropped JSON files, each containing an IngestPayload
 * (or a raw artifact + org context). This is the legacy / air-gapped ingestion
 * path (ADR-007): mainframe/COBOL and disconnected systems drop files into a
 * watched folder instead of calling POST /runs.
 *
 * Expected file shape (IngestPayload):
 *   {
 *     "orgContext": { "tenantId": "...", "client": "...", ... },
 *     "format": "junit",
 *     "rawArtifact": "<testsuite>...</testsuite>"
 *   }
 *
 * Processed files are renamed to *.processed to avoid re-ingestion.
 * Failed files are renamed to *.failed for operator inspection.
 */
export class FileDropWatcher {
  private watcher: FSWatcher | null = null;
  private readonly processed = new Set<string>();

  constructor(
    private readonly dir: string,
    private readonly service: IngestService,
  ) {}

  start(): void {
    fs.mkdirSync(this.dir, { recursive: true });
    // Process any files already present at startup.
    for (const name of fs.readdirSync(this.dir)) {
      if (name.endsWith('.json')) this.processFile(path.join(this.dir, name));
    }
    this.watcher = fs.watch(this.dir, (event, filename) => {
      if (!filename || !filename.endsWith('.json')) return;
      const full = path.join(this.dir, filename);
      if (this.processed.has(full)) return;
      this.processFile(full);
    });
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
  }

  private async processFile(full: string): Promise<void> {
    this.processed.add(full);
    // Small delay so the writer finishes flushing.
    setTimeout(() => this.doProcess(full), 50);
  }

  private async doProcess(full: string): Promise<void> {
    let raw: string;
    try {
      raw = fs.readFileSync(full, 'utf-8');
    } catch {
      return; // file may have been removed
    }
    let payload: IngestPayload;
    try {
      payload = JSON.parse(raw);
    } catch (e) {
      this.markFailed(full, `invalid JSON: ${(e as Error).message}`);
      return;
    }
    const result = await this.service.ingest(payload);
    if (result.accepted) {
      this.markProcessed(full);
    } else {
      this.markFailed(full, result.errors?.join('; ') ?? 'unknown error');
    }
  }

  private markProcessed(full: string): void {
    const dest = full + '.processed';
    try { fs.renameSync(full, dest); } catch { /* best effort */ }
  }

  private markFailed(full: string, reason: string): void {
    const dest = full + '.failed';
    try {
      fs.renameSync(full, dest);
      fs.writeFileSync(dest + '.reason', reason, 'utf-8');
    } catch { /* best effort */ }
  }
}
