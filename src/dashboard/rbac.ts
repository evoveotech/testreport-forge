import type { ServerResponse } from 'http';
import type { Session } from './auth';
import type { UserRole } from '../types';

/**
 * Enforce that the session has one of the allowed roles. Returns true if
 * allowed, false (and writes a 403 response) if denied. Callers should
 * `return` immediately when this returns false.
 */
export function requireRole(session: Session, allowed: UserRole[], res: ServerResponse): boolean {
  if (allowed.includes(session.role)) return true;
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'forbidden', required: allowed }));
  return false;
}
