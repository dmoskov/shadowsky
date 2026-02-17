/**
 * Secure Token Storage
 *
 * Stores sensitive JWT tokens (accessJwt, refreshJwt) in expo-secure-store
 * instead of plain AsyncStorage. Non-sensitive metadata (account info, DID
 * lists) remains in AsyncStorage.
 *
 * SecureStore uses the iOS Keychain and Android Keystore, providing
 * hardware-backed encryption at rest.
 *
 * Key constraints:
 * - Keys: alphanumeric, '.', '-', '_' only (no '@' or '/')
 * - Values: 2048 byte limit per entry
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {createLogger} from '../../utils/logger';

const logger = createLogger('SecureTokenStorage');

// SecureStore key prefixes (must be alphanumeric, '.', '-', '_' only)
const SESSION_KEY_PREFIX = 'shadowsky.session.';
const ACTIVE_SESSION_KEY = 'shadowsky.active_session';

// Legacy AsyncStorage keys (for migration)
const LEGACY_AUTH_KEY = '@shadowsky/auth_session';
const LEGACY_SESSIONS_KEY = '@shadowsky/sessions';

/** Minimal token data stored in SecureStore */
interface SecureSessionData {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  email?: string;
  emailConfirmed?: boolean;
  active?: boolean;
}

/**
 * Build a SecureStore key for a given DID.
 * DIDs contain colons which aren't allowed, so we replace them.
 */
function sessionKeyForDid(did: string): string {
  return SESSION_KEY_PREFIX + did.replace(/:/g, '.');
}

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  keychainService: 'com.shadowsky.auth',
};

/**
 * Store session tokens securely for a given account.
 */
export async function saveSessionTokens(
  did: string,
  data: SecureSessionData,
): Promise<void> {
  const key = sessionKeyForDid(did);
  const value = JSON.stringify(data);

  try {
    await SecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
  } catch (error) {
    logger.error('Failed to save session tokens to SecureStore:', error);
    throw error;
  }
}

/**
 * Load session tokens from SecureStore for a given account.
 */
export async function getSessionTokens(
  did: string,
): Promise<SecureSessionData | null> {
  const key = sessionKeyForDid(did);

  try {
    const value = await SecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    if (!value) {
      return null;
    }
    return JSON.parse(value);
  } catch (error) {
    logger.error('Failed to read session tokens from SecureStore:', error);
    return null;
  }
}

/**
 * Delete session tokens for a given account.
 */
export async function deleteSessionTokens(did: string): Promise<void> {
  const key = sessionKeyForDid(did);

  try {
    await SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  } catch (error) {
    logger.error('Failed to delete session tokens from SecureStore:', error);
  }
}

/**
 * Store the active session's DID so we know which account to restore on launch.
 */
export async function setActiveSessionDid(did: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACTIVE_SESSION_KEY, did, SECURE_STORE_OPTIONS);
  } catch (error) {
    logger.error('Failed to save active session DID:', error);
    throw error;
  }
}

/**
 * Get the active session's DID.
 */
export async function getActiveSessionDid(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ACTIVE_SESSION_KEY, SECURE_STORE_OPTIONS);
  } catch (error) {
    logger.error('Failed to read active session DID:', error);
    return null;
  }
}

/**
 * Clear the active session marker.
 */
export async function clearActiveSessionDid(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ACTIVE_SESSION_KEY, SECURE_STORE_OPTIONS);
  } catch (error) {
    logger.error('Failed to clear active session DID:', error);
  }
}

/**
 * Get all stored session DIDs by reading the accounts list from AsyncStorage,
 * then looking up each DID in SecureStore.
 */
export async function getAllSessionTokens(
  dids: string[],
): Promise<SecureSessionData[]> {
  const sessions: SecureSessionData[] = [];

  for (const did of dids) {
    const data = await getSessionTokens(did);
    if (data) {
      sessions.push(data);
    }
  }

  return sessions;
}

/**
 * Migrate tokens from legacy AsyncStorage to SecureStore.
 *
 * Reads the old `@shadowsky/auth_session` and `@shadowsky/sessions` keys,
 * moves token data into SecureStore per-account, then removes the sensitive
 * fields from AsyncStorage. Non-sensitive account metadata stays in
 * AsyncStorage.
 *
 * This is idempotent — if SecureStore already has data for an account the
 * migration is a no-op for that account.
 */
export async function migrateTokensToSecureStore(): Promise<void> {
  try {
    // Migrate multi-account sessions
    const legacySessions = await AsyncStorage.getItem(LEGACY_SESSIONS_KEY);
    if (legacySessions) {
      const sessions = JSON.parse(legacySessions);
      for (const session of sessions) {
        if (session.did && session.accessJwt) {
          // Only migrate if SecureStore doesn't already have this session
          const existing = await getSessionTokens(session.did);
          if (!existing) {
            await saveSessionTokens(session.did, {
              did: session.did,
              handle: session.handle,
              accessJwt: session.accessJwt,
              refreshJwt: session.refreshJwt,
              email: session.email,
              emailConfirmed: session.emailConfirmed,
              active: session.active,
            });
          }

          // Strip tokens from the AsyncStorage copy, keeping account metadata
          session.accessJwt = undefined;
          session.refreshJwt = undefined;
        }
      }

      // Re-save sessions without tokens to AsyncStorage (account metadata only)
      await AsyncStorage.setItem(LEGACY_SESSIONS_KEY, JSON.stringify(sessions));
    }

    // Migrate the active session
    const legacyAuth = await AsyncStorage.getItem(LEGACY_AUTH_KEY);
    if (legacyAuth) {
      const session = JSON.parse(legacyAuth);
      if (session.did && session.accessJwt) {
        const existing = await getSessionTokens(session.did);
        if (!existing) {
          await saveSessionTokens(session.did, {
            did: session.did,
            handle: session.handle,
            accessJwt: session.accessJwt,
            refreshJwt: session.refreshJwt,
            email: session.email,
            emailConfirmed: session.emailConfirmed,
            active: session.active,
          });
        }

        // Set as active
        await setActiveSessionDid(session.did);

        // Strip tokens from AsyncStorage copy
        session.accessJwt = undefined;
        session.refreshJwt = undefined;
        await AsyncStorage.setItem(LEGACY_AUTH_KEY, JSON.stringify(session));
      }
    }

    logger.log('Token migration to SecureStore complete');
  } catch (error) {
    logger.error('Token migration to SecureStore failed:', error);
    // Don't throw — the app can still function with tokens in AsyncStorage
    // until the next successful migration attempt.
  }
}
