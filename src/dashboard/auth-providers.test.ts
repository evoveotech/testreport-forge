import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { AddressInfo } from 'net';
import { OidcAuthProvider, SamlAuthProvider } from './oidc-saml';
import { requireRole } from './rbac';
import { FileUsageMeter, NullUsageMeter } from './usage-meter';
import type { Session } from './auth';

function makeReq(headers: Record<string, string> = {}): http.IncomingMessage {
  return { headers } as unknown as http.IncomingMessage;
}

describe('OidcAuthProvider', () => {
  let server: http.Server;
  let userinfoUrl: string;

  beforeEach(async () => {
    server = http.createServer((req, res) => {
      const auth = req.headers.authorization;
      if (auth === 'Bearer good') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sub: 'user-1', tenant_id: 'acme', role: 'admin', email: 'u@acme.com' }));
      } else if (auth === 'Bearer viewer') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sub: 'user-2', tenant_id: 'acme' }));
      } else if (auth === 'Bearer notenant') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ sub: 'user-3' }));
      } else {
        res.writeHead(401);
        res.end('unauthorized');
      }
    });
    await new Promise<void>(resolve => server.listen(0, resolve));
    const addr = server.address() as AddressInfo;
    userinfoUrl = `http://127.0.0.1:${addr.port}/userinfo`;
  });

  afterEach(async () => { await new Promise<void>(r => server.close(() => r())); });

  it('resolves a session from a valid bearer token', async () => {
    const provider = new OidcAuthProvider({ userinfoUrl });
    const session = await provider.resolveSession(makeReq({ authorization: 'Bearer good' }));
    expect(session).not.toBeNull();
    expect(session?.userId).toBe('user-1');
    expect(session?.tenantId).toBe('acme');
    expect(session?.role).toBe('admin');
  });

  it('defaults role to viewer when the IdP returns no role claim', async () => {
    const provider = new OidcAuthProvider({ userinfoUrl });
    const session = await provider.resolveSession(makeReq({ authorization: 'Bearer viewer' }));
    expect(session?.role).toBe('viewer');
  });

  it('returns null when the token is missing', async () => {
    const provider = new OidcAuthProvider({ userinfoUrl });
    expect(await provider.resolveSession(makeReq({}))).toBeNull();
  });

  it('returns null when the IdP rejects the token (401)', async () => {
    const provider = new OidcAuthProvider({ userinfoUrl });
    expect(await provider.resolveSession(makeReq({ authorization: 'Bearer bad' }))).toBeNull();
  });

  it('returns null when userinfo lacks a tenant claim and no fixedTenantId', async () => {
    const provider = new OidcAuthProvider({ userinfoUrl });
    expect(await provider.resolveSession(makeReq({ authorization: 'Bearer notenant' }))).toBeNull();
  });

  it('uses fixedTenantId for single-tenant deployments', async () => {
    const provider = new OidcAuthProvider({ userinfoUrl, fixedTenantId: 'self-hosted' });
    const session = await provider.resolveSession(makeReq({ authorization: 'Bearer notenant' }));
    expect(session?.tenantId).toBe('self-hosted');
  });

  it('supports custom claim mapping', async () => {
    const customServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ custom_uid: 'u9', custom_tenant: 'globex', custom_role: 'admin' }));
    });
    await new Promise<void>(done => customServer.listen(0, done));
    const addr = customServer.address() as AddressInfo;
    const customUrl = `http://127.0.0.1:${addr.port}/userinfo`;
    const provider = new OidcAuthProvider({
      userinfoUrl: customUrl,
      claims: { userId: 'custom_uid', tenantId: 'custom_tenant', role: 'custom_role' },
    });
    const session = await provider.resolveSession(makeReq({ authorization: 'Bearer good' }));
    expect(session?.userId).toBe('u9');
    expect(session?.tenantId).toBe('globex');
    expect(session?.role).toBe('admin');
    customServer.close();
  });
});

describe('SamlAuthProvider', () => {
  it('resolves a session from SAML gateway headers', async () => {
    const provider = new SamlAuthProvider();
    const session = await provider.resolveSession(makeReq({
      'x-saml-userid': 'user-1', 'x-saml-tenantid': 'acme', 'x-saml-role': 'admin',
    }));
    expect(session?.userId).toBe('user-1');
    expect(session?.tenantId).toBe('acme');
    expect(session?.role).toBe('admin');
  });

  it('defaults role to viewer', async () => {
    const provider = new SamlAuthProvider();
    const session = await provider.resolveSession(makeReq({ 'x-saml-userid': 'u1', 'x-saml-tenantid': 'acme' }));
    expect(session?.role).toBe('viewer');
  });

  it('returns null when userid is missing', async () => {
    const provider = new SamlAuthProvider();
    expect(await provider.resolveSession(makeReq({ 'x-saml-tenantid': 'acme' }))).toBeNull();
  });

  it('uses fixedTenantId when set', async () => {
    const provider = new SamlAuthProvider({ fixedTenantId: 'self-hosted' });
    const session = await provider.resolveSession(makeReq({ 'x-saml-userid': 'u1' }));
    expect(session?.tenantId).toBe('self-hosted');
  });

  it('supports custom header names', async () => {
    const provider = new SamlAuthProvider({ userIdHeader: 'x-remote-user', tenantIdHeader: 'x-remote-tenant' });
    const session = await provider.resolveSession(makeReq({ 'x-remote-user': 'u1', 'x-remote-tenant': 'acme' }));
    expect(session?.userId).toBe('u1');
    expect(session?.tenantId).toBe('acme');
  });
});

describe('requireRole (RBAC)', () => {
  function fakeRes(): { res: any; state: { status: number; body: string } } {
    const state = { status: 0, body: '' };
    const res = {
      writeHead: (s: number) => { state.status = s; },
      end: (b: string) => { state.body = b; },
    };
    return { res, state };
  }

  it('allows when the role is in the allowed list', () => {
    const session: Session = { userId: 'u1', tenantId: 'acme', role: 'admin' };
    const { res, state } = fakeRes();
    expect(requireRole(session, ['admin'], res)).toBe(true);
    expect(state.status).toBe(0);
  });

  it('denies and writes 403 when the role is not allowed', () => {
    const session: Session = { userId: 'u1', tenantId: 'acme', role: 'viewer' };
    const { res, state } = fakeRes();
    expect(requireRole(session, ['admin'], res)).toBe(false);
    expect(state.status).toBe(403);
    expect(JSON.parse(state.body).error).toBe('forbidden');
  });
});

describe('UsageMeter', () => {
  let dir: string;

  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'testreport-meter-')); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('FileUsageMeter appends events as JSONL', () => {
    const meter = new FileUsageMeter(dir);
    meter.record({ type: 'run_ingested', tenantId: 'acme', timestamp: '2026-08-09T10:00:00Z', runId: 'r1' });
    meter.record({ type: 'seat_count', tenantId: 'acme', timestamp: '2026-08-09T10:00:00Z', seats: 5 });
    meter.close();
    const lines = fs.readFileSync(path.join(dir, 'usage.jsonl'), 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).runId).toBe('r1');
    expect(JSON.parse(lines[1]).seats).toBe(5);
  });

  it('NullUsageMeter is a no-op', () => {
    const meter = new NullUsageMeter();
    meter.record({ type: 'run_ingested', tenantId: 'acme', timestamp: 't', runId: 'r1' });
    meter.close();
    expect(fs.existsSync(path.join(dir, 'usage.jsonl'))).toBe(false);
  });
});
