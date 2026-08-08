import * as fs from 'fs';
import * as path from 'path';

/**
 * A usage metering event, emitted for SaaS billing (ADR-003). One event per
 * ingested run, plus periodic seat-count events. The sink is configurable;
 * the default FileUsageMeter appends JSONL to a metering log.
 */
export interface MeterEvent {
  type: 'run_ingested' | 'seat_count';
  tenantId: string;
  timestamp: string;
  /** For run_ingested: the runId. For seat_count: the number of users. */
  runId?: string;
  seats?: number;
}

export interface UsageMeter {
  record(event: MeterEvent): void;
  close(): void;
}

/**
 * Appends metering events as JSONL to a file. Durable and simple; a
 * production SaaS deployment would replace this with a metering pipeline
 * (e.g. emit to a billing system), but the interface is the same.
 */
export class FileUsageMeter implements UsageMeter {
  private readonly file: string;
  constructor(meteringDir: string) {
    fs.mkdirSync(meteringDir, { recursive: true });
    this.file = path.join(meteringDir, 'usage.jsonl');
  }
  record(event: MeterEvent): void {
    fs.appendFileSync(this.file, JSON.stringify(event) + '\n', 'utf-8');
  }
  close(): void {
    // synchronous writes -- nothing to close
  }
}

/**
 * No-op meter for self-hosted deployments that do not bill.
 */
export class NullUsageMeter implements UsageMeter {
  record(_event: MeterEvent): void {}
  close(): void {}
}
