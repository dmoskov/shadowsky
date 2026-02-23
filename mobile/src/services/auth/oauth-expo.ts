/**
 * OAuth Service for Mobile using @atproto/oauth-client-expo
 *
 * Wraps ExpoOAuthClient which handles PKCE, PAR, DPoP, token exchange,
 * token storage, and automatic token refresh internally.
 */

import {Agent} from '@atproto/api';
import {ExpoOAuthClient, OAuthSession} from '@atproto/oauth-client-expo';
import {createLogger} from '../../utils/logger';

const logger = createLogger('OAuthExpo');

const CLIENT_METADATA = {
  client_id: 'https://shadowsky.io/client-metadata-mobile.json' as const,
  client_name: 'Asphodel Mobile',
  client_uri: 'https://shadowsky.io',
  logo_uri: 'https://shadowsky.io/butterfly-icon.svg',
  tos_uri: 'https://shadowsky.io/terms',
  policy_uri: 'https://shadowsky.io/privacy',
  redirect_uris: ['io.shadowsky:/oauth-callback' as const],
  scope: 'atproto transition:generic',
  grant_types: ['authorization_code' as const, 'refresh_token' as const],
  response_types: ['code' as const],
  token_endpoint_auth_method: 'none' as const,
  application_type: 'native' as const,
  dpop_bound_access_tokens: true,
};

let client: ExpoOAuthClient | null = null;

function getClient(): ExpoOAuthClient {
  if (!client) {
    client = new ExpoOAuthClient({
      handleResolver: 'https://bsky.social',
      clientMetadata: CLIENT_METADATA,
    });
  }
  return client;
}

/**
 * Add AtpAgent-compatible `session`, `did`, and `hasSession` properties
 * to a bare Agent so existing callers that access agent.session?.did
 * continue to work without modification.
 */
function addSessionCompat(agent: Agent, did: string): void {
  const compatSession = {did, handle: '', accessJwt: '', refreshJwt: ''};
  Object.defineProperty(agent, 'session', {
    get() {
      return compatSession;
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(agent, 'did', {
    get() {
      return did;
    },
    enumerable: true,
    configurable: true,
  });
  Object.defineProperty(agent, 'hasSession', {
    get() {
      return true;
    },
    enumerable: true,
    configurable: true,
  });
}

/**
 * Sign in with OAuth. Opens the browser, handles DPoP/PKCE/PAR,
 * and returns an Agent + DID.
 */
export async function signInWithOAuth(
  handle: string,
): Promise<{agent: Agent; did: string}> {
  const oauthClient = getClient();
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  logger.log('Starting OAuth sign-in for:', cleanHandle);
  try {
    const session: OAuthSession = await oauthClient.signIn(cleanHandle);
    logger.log('OAuth sign-in completed, DID:', session.did);

    const agent = new Agent(session);
    addSessionCompat(agent, session.did);
    return {agent, did: session.did};
  } catch (error) {
    logger.error('OAuth sign-in failed:', error);
    throw error;
  }
}

/**
 * Restore an OAuth session from a stored DID.
 * Returns null if no session is stored for this DID.
 */
export async function restoreOAuthSession(
  did: string,
): Promise<{agent: Agent; did: string} | null> {
  try {
    const oauthClient = getClient();
    const session: OAuthSession = await oauthClient.restore(did);
    const agent = new Agent(session);
    addSessionCompat(agent, session.did);
    return {agent, did: session.did};
  } catch (error) {
    logger.error('Failed to restore OAuth session:', error);
    return null;
  }
}

/**
 * Sign out the current OAuth session by revoking tokens for the given DID.
 */
export async function signOutOAuth(did: string): Promise<void> {
  try {
    const oauthClient = getClient();
    await oauthClient.revoke(did);
  } catch (error) {
    logger.error('Failed to revoke OAuth session:', error);
  }
}

/**
 * Reset the OAuth client instance (e.g. on full sign-out).
 */
export function resetOAuthClient(): void {
  client = null;
}
