import * as https from 'https';
import * as http from 'http';
import type { IncomingMessage } from 'http';
import type { UserRole } from '../types';
import type { AuthProvider, Session } from './auth';

/**
 * Claim mapping config: which OIDC userinfo claim maps to each Session field.
 * Enterprises configure this to match their IdP's custom claims.
 */
export interface OidcClaimMapping {
  userId: string;     // claim name for the user id (default: 'sub')
  email?: string;     // claim name for email (default: 'email')
  tenantId: string;   // claim name for tenant id (default: 'tenant_id')
  role?: string;      // claim name for role (default: 'role')
}

export interface OidcProviderConfig {
  /** IdP userinfo endpoint, e.g. https://idp.example.com/userinfo */
  userinfoUrl: string;
  /** Map IdP claims to Session fields. */
  claims?: Partial<OidcClaimMapping>;
  /**
   * Optional static tenantId override. When set, all authenticated users are
   * scoped to this tenant (used in single-tenant self-hosted deployments).
   */
  fixedTenantId?: string;
  /** Default role when the IdP does not return a role claim. */
  defaultRole?: UserRole;
}

/**
 * OIDC resource-server auth provider. Validates a bearer token by calling
 * the IdP userinfo endpoint and maps the returned claims to a Session.
 *
 * This is the protected-resource side of OIDC: the dashboard API accepts
 * bearer tokens issued by the IdP. The login (authorization-code flow) is
 * handled by the IdP and the UI (Task 11); this provider only validates
 * the resulting token on each API call.
 *
 * Uses Node's built-in https/http -- zero new runtime deps.
 */
interface ResolvedOidcConfig {
  userinfoUrl: string;
  claims: Required<OidcClaimMapping>;
  fixedTenantId: string;
  defaultRole: UserRole;
}

export class OidcAuthProvider implements AuthProvider {
  private readonly cfg: ResolvedOidcConfig;

  constructor(config: OidcProviderConfig) {
    this.cfg = {
      userinfoUrl: config.userinfoUrl,
      claims: {
        userId: 'sub',
        email: 'email',
        tenantId: 'tenant_id',
        role: 'role',
        ...config.claims,
      },
      fixedTenantId: config.fixedTenantId ?? '',
      defaultRole: config.defaultRole ?? 'viewer',
    };
  }

  async resolveSession(req: IncomingMessage): Promise<Session | null> {
    const token = bearerToken(req);
    if (!token) return null;
    let userinfo: Record<string, unknown>;
    try {
      userinfo = await this.fetchUserinfo(token);
    } catch {
      return null;
    }
    const userId = str(userinfo[this.cfg.claims.userId]);
    const tenantId = this.cfg.fixedTenantId || str(userinfo[this.cfg.claims.tenantId]);
    if (!userId || !tenantId) return null;
    const roleClaim = str(userinfo[this.cfg.claims.role]);
    const role: UserRole = roleClaim === 'admin' ? 'admin' : this.cfg.defaultRole;
    return { userId, tenantId, role };
  }

  private fetchUserinfo(token: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      if (process.env.DEBUG_OIDC) console.error('oidc url:', this.cfg.userinfoUrl);
      const url = new URL(this.cfg.userinfoUrl);
      const lib = url.protocol === 'https:' ? https : http;
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      };
      const r = lib.request(options, res => {
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => {
          if (res.statusCode !== 200) { reject(new Error(`userinfo ${res.statusCode}`)); return; }
          try { resolve(JSON.parse(buf)); } catch (e) { reject(e as Error); }
        });
      });
      r.on('error', reject);
      r.end();
    });
  }
}

/**
 * SAML auth provider. Trusts headers set by an external SAML gateway
 * (mod_auth_mellon, Shibboleth SP, Keycloak gate, nginx-http-auth-request,
 * etc.) that has already validated the SAML assertion and set headers with
 * the user's attributes.
 *
 * Full SAML SP functionality (XML signing, metadata, assertion parsing)
 * requires XML-signature libraries that would break the zero-runtime-dep
 * philosophy. The gateway pattern is the standard enterprise deployment:
 * the SAML SP terminates the federation and sets headers; the app trusts
 * them. The gateway MUST be configured to strip/overwrite these headers
 * from client requests so they cannot be spoofed.
 */
export interface SamlProviderConfig {
  /** Header name carrying the user id (default: 'x-saml-userid'). */
  userIdHeader?: string;
  /** Header name carrying the tenant id (default: 'x-saml-tenantid'). */
  tenantIdHeader?: string;
  /** Header name carrying the role (default: 'x-saml-role'). */
  roleHeader?: string;
  /** Optional static tenant for single-tenant deployments. */
  fixedTenantId?: string;
  /** Default role (default: 'viewer'). */
  defaultRole?: UserRole;
}

interface ResolvedSamlConfig {
  userIdHeader: string;
  tenantIdHeader: string;
  roleHeader: string;
  fixedTenantId: string;
  defaultRole: UserRole;
}

export class SamlAuthProvider implements AuthProvider {
  private readonly cfg: ResolvedSamlConfig;

  constructor(config: SamlProviderConfig = {}) {
    this.cfg = {
      userIdHeader: config.userIdHeader ?? 'x-saml-userid',
      tenantIdHeader: config.tenantIdHeader ?? 'x-saml-tenantid',
      roleHeader: config.roleHeader ?? 'x-saml-role',
      fixedTenantId: config.fixedTenantId ?? '',
      defaultRole: config.defaultRole ?? 'viewer',
    };
  }

  async resolveSession(req: IncomingMessage): Promise<Session | null> {
    const userId = header(req, this.cfg.userIdHeader);
    const tenantId = this.cfg.fixedTenantId || header(req, this.cfg.tenantIdHeader);
    if (!userId || !tenantId) return null;
    const roleClaim = header(req, this.cfg.roleHeader);
    const role: UserRole = roleClaim === 'admin' ? 'admin' : this.cfg.defaultRole;
    return { userId, tenantId, role };
  }
}

function bearerToken(req: IncomingMessage): string | null {
  const auth = header(req, 'authorization');
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

function header(req: IncomingMessage, name: string): string | undefined {
  const h = req.headers[name.toLowerCase()];
  return Array.isArray(h) ? h[0] : h;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
