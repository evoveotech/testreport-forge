import type { IncomingMessage } from 'http';
import type { UserRole } from '../types';

/**
 * An authenticated session, resolved from the request by an AuthProvider.
 * `tenantId` is the isolation scope -- every downstream query is scoped to it.
 */
export interface Session {
  userId: string;
  tenantId: string;
  role: UserRole;
}

/**
 * Pluggable authentication provider. Resolves a Session from an incoming
 * request, or returns null if unauthenticated. Implementations:
 *   - DevAuthProvider   -- trusts headers, local dev only (this file)
 *   - OidcAuthProvider  -- OIDC code flow (Task 7)
 *   - SamlAuthProvider  -- SAML SP-initiated (Task 7)
 *
 * The API layer never inspects credentials directly; it calls the provider
 * and enforces RBAC on the resulting Session. This keeps auth concerns
 * isolated and lets enterprises plug in their IdP.
 */
export interface AuthProvider {
  resolveSession(req: IncomingMessage): Promise<Session | null>;
}

/**
 * Dev-mode auth provider. Trusts X-Tenant-Id and X-User-Id headers and
 * grants the role in X-User-Role (default 'viewer'). FOR LOCAL DEV ONLY --
 * never use in production. Production deployments use OidcAuthProvider or
 * SamlAuthProvider (Task 7).
 */
export class DevAuthProvider implements AuthProvider {
  async resolveSession(req: IncomingMessage): Promise<Session | null> {
    const tenantId = header(req, 'x-tenant-id');
    const userId = header(req, 'x-user-id');
    if (!tenantId || !userId) return null;
    const role = (header(req, 'x-user-role') as UserRole) || 'viewer';
    if (role !== 'viewer' && role !== 'admin') return null;
    return { userId, tenantId, role };
  }
}

function header(req: IncomingMessage, name: string): string | undefined {
  const h = req.headers[name];
  return Array.isArray(h) ? h[0] : h;
}
