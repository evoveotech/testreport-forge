import * as fs from 'fs';
import * as path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import type { ConnectorConfig, ConnectorService } from '../connectors';
import type { Session } from './auth';
import { requireRole } from './rbac';

/**
 * Connector settings API. Admin-only. Configures which VCS (GitHub/GitLab)
 * and issue-tracker (Jira/Linear) systems to pull team-contribution data from.
 *
 * Endpoints (all require admin role):
 *   GET  /api/connectors/config    -- current connector config (tokens redacted)
 *   POST /api/connectors/config    -- save connector config
 *   POST /api/connectors/test      -- test connector config (fetch 1 batch)
 *   POST /api/connectors/clear     -- clear connector config
 */
export class ConnectorSettingsApi {
  constructor(private readonly connectorService: ConnectorService) {}

  async handle(req: IncomingMessage, res: ServerResponse, session: Session): Promise<boolean> {
    const url = req.url ?? '';
    const method = req.method ?? 'GET';

    // All connector endpoints require admin role.
    if (!requireRole(session, ['admin'], res)) return true;

    if (url === '/api/connectors/config' && method === 'GET') {
      const config = this.connectorService.loadConfig();
      if (!config) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ configured: false }));
        return true;
      }
      // Redact tokens.
      const redacted: Record<string, unknown> = { configured: true };
      if (config.vcs) {
        redacted.vcs = {
          type: config.vcs.type,
          owner: config.vcs.owner,
          repo: config.vcs.repo,
          baseUrl: config.vcs.baseUrl,
          branch: config.vcs.branch,
          token: config.vcs.token ? '***' : '',
        };
      }
      if (config.its) {
        redacted.its = {
          type: config.its.type,
          baseUrl: config.its.baseUrl,
          email: config.its.email,
          apiKey: config.its.apiKey ? '***' : '',
        };
      }
      redacted.teamMapping = config.teamMapping;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(redacted));
      return true;
    }

    if (url === '/api/connectors/config' && method === 'POST') {
      const body = await readBody(req);
      let config: ConnectorConfig;
      try { config = JSON.parse(body); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid JSON' }));
        return true;
      }
      this.connectorService.saveConfig(config);
      this.connectorService.clearCache();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ saved: true }));
      return true;
    }

    if (url === '/api/connectors/clear' && method === 'POST') {
      this.connectorService.clearConfig();
      this.connectorService.clearCache();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cleared: true }));
      return true;
    }

    return false;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1024 * 1024) { reject(new Error('payload too large')); req.destroy(); }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}
