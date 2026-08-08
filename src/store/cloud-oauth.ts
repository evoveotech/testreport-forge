import * as https from 'https';
import * as http from 'http';

/**
 * Cloud storage configuration. Stored in a local config file on the server
 * (<dataDir>/cloud-storage.json). The admin connects their M365 or Google
 * Workspace account via OAuth; the resulting tokens are stored here and used
 * for all subsequent store operations.
 *
 * This is SEPARATE from user auth (OIDC/SAML). User auth resolves identity;
 * cloud storage auth resolves where data lives. (User-confirmed design.)
 */
export interface CloudStorageConfig {
  /** 'onedrive' (Microsoft Graph) or 'googledrive' (Google Drive API). */
  provider: 'onedrive' | 'googledrive';
  /** OAuth2 access token (short-lived). */
  accessToken: string;
  /** OAuth2 refresh token (long-lived, used to renew accessToken). */
  refreshToken: string;
  /** Token expiry timestamp (ms since epoch). */
  tokenExpiresAt: number;
  /** Folder path in the cloud drive, e.g. 'TestIntelligencePlatform/acme'. */
  folderPath: string;
  /** OAuth client ID (registered app). */
  clientId: string;
  /** OAuth client secret (registered app). For PKCE-only flows this is empty. */
  clientSecret: string;
  /** OAuth redirect URI, e.g. 'http://localhost:3000/api/storage/oauth/callback'. */
  redirectUri: string;
  /** Microsoft tenant ID (M365 only, for single-tenant apps). */
  msTenantId?: string;
}

/**
 * OAuth endpoints for each provider.
 */
export const OAUTH_ENDPOINTS = {
  onedrive: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: 'Files.ReadWrite offline_access',
  },
  googledrive: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/drive.file',
  },
} as const;

/**
 * Build the OAuth authorization URL for the "Connect Cloud Storage" flow.
 * The admin visits this URL, consents, and is redirected back with an auth
 * code that is exchanged for tokens via exchangeCodeForTokens.
 */
export function buildAuthorizeUrl(config: Pick<CloudStorageConfig, 'provider' | 'clientId' | 'redirectUri'>): string {
  const ep = OAUTH_ENDPOINTS[config.provider];
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: ep.scope,
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${ep.authorize}?${params.toString()}`;
}

/**
 * Exchange an OAuth authorization code for access + refresh tokens.
 * Uses Node's built-in https — zero new runtime deps.
 */
export async function exchangeCodeForTokens(
  config: Pick<CloudStorageConfig, 'provider' | 'clientId' | 'clientSecret' | 'redirectUri'>,
  code: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const ep = OAUTH_ENDPOINTS[config.provider];
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  }).toString();

  const url = new URL(ep.token);
  const data = await httpsPost(url, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body).toString(),
  }, body);
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh an expired access token using the stored refresh token.
 */
export async function refreshAccessToken(
  config: Pick<CloudStorageConfig, 'provider' | 'clientId' | 'clientSecret' | 'refreshToken'>,
): Promise<{ accessToken: string; expiresIn: number }> {
  const ep = OAUTH_ENDPOINTS[config.provider];
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  }).toString();

  const url = new URL(ep.token);
  const data = await httpsPost(url, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(body).toString(),
  }, body);
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Ensure the access token is valid; refresh if expired. Returns a valid
 * access token. Callers should use this before every cloud API call.
 */
export async function ensureValidToken(config: CloudStorageConfig): Promise<{ token: string; config: CloudStorageConfig }> {
  const now = Date.now();
  // Refresh if token expires in the next 5 minutes.
  if (config.tokenExpiresAt - now < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(config);
    const updated: CloudStorageConfig = {
      ...config,
      accessToken: refreshed.accessToken,
      tokenExpiresAt: now + refreshed.expiresIn * 1000,
    };
    return { token: refreshed.accessToken, config: updated };
  }
  return { token: config.accessToken, config };
}

// --- HTTP helper ---

function httpsPost(url: URL, headers: Record<string, string>, body: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers,
    };
    const r = https.request(options, res => {
      let buf = '';
      res.on('data', c => (buf += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`OAuth token exchange failed: ${res.statusCode} ${buf}`));
          return;
        }
        try { resolve(JSON.parse(buf)); } catch (e) { reject(e as Error); }
      });
    });
    r.on('error', reject);
    r.write(body);
    r.end();
  });
}
