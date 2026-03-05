/**
 * Authentication Service for Mobile
 * Handles AT Protocol authentication using app passwords
 *
 * Sensitive tokens (accessJwt, refreshJwt) are stored in expo-secure-store.
 * Non-sensitive account metadata is stored in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {AtpSessionData} from '@atproto/api';
import {getAtProtoClient, resetAtProtoClient} from '../atproto/client';
import {withTimeout} from '../../utils/with-timeout';
import {
  saveSessionTokens,
  getSessionTokens,
  deleteSessionTokens,
  setActiveSessionDid,
  getActiveSessionDid,
  clearActiveSessionDid,
  migrateTokensToSecureStore,
} from './secure-token-storage';
// Lazy-load oauth-expo to avoid crashing when the native module
// ExpoAtprotoOAuthClient isn't available (e.g. Expo Go or missing native build).
function getOAuthModule(): typeof import('./oauth-expo') {
  return require('./oauth-expo');
}

const ACCOUNTS_STORAGE_KEY = '@shadowsky/accounts';
const AUTH_METHOD_PREFIX = '@shadowsky/auth_method:';

export interface AuthAccount {
  did: string;
  handle: string;
  email?: string;
  displayName?: string;
  avatar?: string;
}

export interface StoredSession extends AtpSessionData {
  account: AuthAccount;
}

/**
 * Sign in with identifier (handle or email) and app password
 */
export async function signInWithPassword(
  identifier: string,
  password: string,
  pdsUrl?: string,
): Promise<StoredSession> {
  resetAtProtoClient();

  const client = getAtProtoClient(pdsUrl);
  const sessionData = await client.login(identifier, password);

  if (!sessionData) {
    throw new Error('Login failed: no session data returned');
  }

  const agent = client.getAgent();
  const profile = await withTimeout(() => agent.getProfile({actor: sessionData.did}), 15000);

  const account: AuthAccount = {
    did: sessionData.did,
    handle: sessionData.handle || profile.data.handle,
    email: sessionData.email,
    displayName: profile.data.displayName,
    avatar: profile.data.avatar,
  };

  const session: StoredSession = {
    ...sessionData,
    account,
  } as StoredSession;

  // Store tokens securely
  await saveSessionTokens(session.did, {
    did: session.did,
    handle: session.handle,
    accessJwt: session.accessJwt,
    refreshJwt: session.refreshJwt,
    email: session.email,
    emailConfirmed: session.emailConfirmed,
    active: session.active,
  });
  await setActiveSessionDid(session.did);

  // Store non-sensitive account metadata in AsyncStorage
  await addAccount(account);

  return session;
}

/**
 * Sign in with OAuth using @atproto/oauth-client-expo.
 * Opens browser, handles DPoP/PKCE/PAR, returns a StoredSession.
 */
export async function signInWithOAuth(
  handle: string,
): Promise<StoredSession> {
  resetAtProtoClient();
  const oauth = await getOAuthModule();
  oauth.resetOAuthClient();

  const {agent, did} = await oauth.signInWithOAuth(handle);

  // Set the OAuth agent on the global client
  const client = getAtProtoClient();
  client.setOAuthAgent(agent, did);

  // Fetch profile to populate account metadata
  const profile = await withTimeout(() => agent.getProfile({actor: did}), 15000);

  const account: AuthAccount = {
    did,
    handle: profile.data.handle,
    displayName: profile.data.displayName,
    avatar: profile.data.avatar,
  };

  const session: StoredSession = {
    did,
    handle: profile.data.handle,
    accessJwt: '',
    refreshJwt: '',
    active: true,
    account,
  } as StoredSession;

  // Store auth method flag so resumeSession knows this is OAuth
  await AsyncStorage.setItem(`${AUTH_METHOD_PREFIX}${did}`, 'oauth');
  await setActiveSessionDid(did);

  // Store non-sensitive account metadata
  await addAccount(account);

  return session;
}

/**
 * Resume existing session from storage.
 *
 * Checks the auth method flag to determine if this is an OAuth or
 * app-password session and restores accordingly.
 *
 * For app-password sessions: runs one-time migration, loads tokens from
 * SecureStore, and resumes with BskyAgent.
 *
 * For OAuth sessions: uses @atproto/oauth-client-expo to restore the
 * session (the library handles token storage and refresh internally).
 */
export async function resumeSession(): Promise<StoredSession | null> {
  try {
    // Migrate tokens from AsyncStorage to SecureStore (idempotent)
    await migrateTokensToSecureStore();

    const activeDid = await getActiveSessionDid();
    if (!activeDid) {
      return null;
    }

    // Check if this is an OAuth session
    const authMethod = await AsyncStorage.getItem(`${AUTH_METHOD_PREFIX}${activeDid}`);

    if (authMethod === 'oauth') {
      return await resumeOAuthSession(activeDid);
    }

    return await resumeAppPasswordSession(activeDid);
  } catch {
    return null;
  }
}

async function resumeOAuthSession(activeDid: string): Promise<StoredSession | null> {
  const oauth = await getOAuthModule();
  const result = await oauth.restoreOAuthSession(activeDid);
  if (!result) {
    return null;
  }

  const client = getAtProtoClient();
  client.setOAuthAgent(result.agent, result.did);

  // Load account metadata
  const accounts = await getAccounts();
  const account = accounts.find(a => a.did === activeDid);

  const session: StoredSession = {
    did: result.did,
    handle: account?.handle || '',
    accessJwt: '',
    refreshJwt: '',
    active: true,
    account: account || {did: result.did, handle: ''},
  } as StoredSession;

  // Refresh profile in background
  refreshProfileInBackground(session);

  return session;
}

async function resumeAppPasswordSession(activeDid: string): Promise<StoredSession | null> {
  const tokenData = await getSessionTokens(activeDid);
  if (!tokenData) {
    return null;
  }

  // Load account metadata from the accounts list
  const accounts = await getAccounts();
  const account = accounts.find(a => a.did === activeDid);

  const session: StoredSession = {
    did: tokenData.did,
    handle: tokenData.handle,
    accessJwt: tokenData.accessJwt,
    refreshJwt: tokenData.refreshJwt,
    email: tokenData.email,
    emailConfirmed: tokenData.emailConfirmed,
    active: tokenData.active,
    account: account || {
      did: tokenData.did,
      handle: tokenData.handle,
      email: tokenData.email,
    },
  } as StoredSession;

  const client = getAtProtoClient();
  await client.resumeSession(session);

  // Return immediately — profile refresh happens in the background
  refreshProfileInBackground(session);

  return session;
}

/**
 * Refresh the user's profile data in the background after session resume.
 * Updates stored session with latest handle/displayName/avatar without
 * blocking the cold start path.
 */
async function refreshProfileInBackground(session: StoredSession): Promise<void> {
  try {
    const client = getAtProtoClient();
    const agent = client.getAgent();
    const profile = await withTimeout(() => agent.getProfile({actor: session.did}), 15000);

    session.account = {
      ...session.account,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
    };

    // Update account metadata in AsyncStorage
    await addAccount(session.account);
  } catch {
    const client = getAtProtoClient();

    // For OAuth sessions, the library handles token refresh automatically.
    // If the profile fetch still failed, the session is truly invalid.
    if (client.isOAuthSession()) {
      await signOut();
      return;
    }

    // For app-password sessions, attempt a manual token refresh.
    try {
      const refreshedSession = await client.refreshSession();
      session.accessJwt = refreshedSession.accessJwt;
      session.refreshJwt = refreshedSession.refreshJwt;
      await saveSessionTokens(session.did, {
        did: session.did,
        handle: session.handle,
        accessJwt: session.accessJwt,
        refreshJwt: session.refreshJwt,
        email: session.email,
        emailConfirmed: session.emailConfirmed,
        active: session.active,
      });
    } catch {
      await signOut();
    }
  }
}

/**
 * Sign out and clear current session
 */
export async function signOut(): Promise<void> {
  const activeDid = await getActiveSessionDid();
  if (activeDid) {
    const authMethod = await AsyncStorage.getItem(`${AUTH_METHOD_PREFIX}${activeDid}`);
    if (authMethod === 'oauth') {
      const oauth = await getOAuthModule();
      await oauth.signOutOAuth(activeDid);
      await AsyncStorage.removeItem(`${AUTH_METHOD_PREFIX}${activeDid}`);
      oauth.resetOAuthClient();
    } else {
      await deleteSessionTokens(activeDid);
    }
  }
  await clearActiveSessionDid();
  resetAtProtoClient();
}

/**
 * Get current session from storage
 */
export async function getCurrentSession(): Promise<StoredSession | null> {
  try {
    const activeDid = await getActiveSessionDid();
    if (!activeDid) {
      return null;
    }

    const tokenData = await getSessionTokens(activeDid);
    if (!tokenData) {
      return null;
    }

    const accounts = await getAccounts();
    const account = accounts.find(a => a.did === activeDid);

    return {
      did: tokenData.did,
      handle: tokenData.handle,
      accessJwt: tokenData.accessJwt,
      refreshJwt: tokenData.refreshJwt,
      email: tokenData.email,
      emailConfirmed: tokenData.emailConfirmed,
      active: tokenData.active,
      account: account || {
        did: tokenData.did,
        handle: tokenData.handle,
        email: tokenData.email,
      },
    } as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Multi-account support: Add account to list
 */
async function addAccount(account: AuthAccount): Promise<void> {
  try {
    const storedAccounts = await AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY);
    const accounts: AuthAccount[] = storedAccounts
      ? JSON.parse(storedAccounts)
      : [];

    const existingIndex = accounts.findIndex(a => a.did === account.did);
    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }

    await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Storage write failed — non-critical
  }
}

/**
 * Multi-account support: Get all accounts
 */
export async function getAccounts(): Promise<AuthAccount[]> {
  try {
    const storedAccounts = await AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return storedAccounts ? JSON.parse(storedAccounts) : [];
  } catch {
    return [];
  }
}

/**
 * Multi-account support: Remove account from list
 */
export async function removeAccount(did: string): Promise<void> {
  try {
    const accounts = await getAccounts();
    const filtered = accounts.filter(a => a.did !== did);
    await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(filtered));

    const authMethod = await AsyncStorage.getItem(`${AUTH_METHOD_PREFIX}${did}`);
    if (authMethod === 'oauth') {
      const oauth = await getOAuthModule();
      await oauth.signOutOAuth(did);
      await AsyncStorage.removeItem(`${AUTH_METHOD_PREFIX}${did}`);
      oauth.resetOAuthClient();
    } else {
      await deleteSessionTokens(did);
    }

    const activeDid = await getActiveSessionDid();
    if (activeDid === did) {
      await clearActiveSessionDid();
      resetAtProtoClient();
    }
  } catch {
    // Storage write failed — non-critical
  }
}

/**
 * Multi-account support: Get all stored sessions.
 * Reconstructs StoredSession objects from SecureStore tokens + AsyncStorage metadata.
 */
export async function getSessions(): Promise<StoredSession[]> {
  try {
    const accounts = await getAccounts();
    const sessions: StoredSession[] = [];

    for (const account of accounts) {
      const tokenData = await getSessionTokens(account.did);
      if (tokenData) {
        sessions.push({
          did: tokenData.did,
          handle: tokenData.handle,
          accessJwt: tokenData.accessJwt,
          refreshJwt: tokenData.refreshJwt,
          email: tokenData.email,
          emailConfirmed: tokenData.emailConfirmed,
          active: tokenData.active,
          account,
        } as StoredSession);
      }
    }

    return sessions;
  } catch {
    return [];
  }
}

/**
 * Multi-account support: Switch to a different account
 */
export async function switchToAccount(did: string): Promise<StoredSession> {
  const authMethod = await AsyncStorage.getItem(`${AUTH_METHOD_PREFIX}${did}`);
  const accounts = await getAccounts();
  const account = accounts.find(a => a.did === did);

  resetAtProtoClient();

  if (authMethod === 'oauth') {
    // Restore OAuth session via the library
    const oauth = await getOAuthModule();
    const result = await oauth.restoreOAuthSession(did);
    if (!result) {
      throw new Error('OAuth session expired. Please sign in again.');
    }

    const client = getAtProtoClient();
    client.setOAuthAgent(result.agent, result.did);

    const targetSession: StoredSession = {
      did: result.did,
      handle: account?.handle || '',
      accessJwt: '',
      refreshJwt: '',
      active: true,
      account: account || {did: result.did, handle: ''},
    } as StoredSession;

    try {
      const profile = await withTimeout(() => result.agent.getProfile({actor: result.did}), 15000);
      targetSession.account = {
        ...targetSession.account,
        handle: profile.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar,
      };
      await addAccount(targetSession.account);
    } catch {
      // Profile fetch failed — session may be invalid
    }

    await setActiveSessionDid(result.did);
    return targetSession;
  }

  // App-password path (unchanged)
  const tokenData = await getSessionTokens(did);
  if (!tokenData) {
    throw new Error('Session not found for account');
  }

  const targetSession: StoredSession = {
    did: tokenData.did,
    handle: tokenData.handle,
    accessJwt: tokenData.accessJwt,
    refreshJwt: tokenData.refreshJwt,
    email: tokenData.email,
    emailConfirmed: tokenData.emailConfirmed,
    active: tokenData.active,
    account: account || {did: tokenData.did, handle: tokenData.handle, email: tokenData.email},
  } as StoredSession;

  const client = getAtProtoClient();
  await client.resumeSession(targetSession);

  try {
    const agent = client.getAgent();
    const profile = await withTimeout(() => agent.getProfile({actor: targetSession.did}), 15000);

    targetSession.account = {
      ...targetSession.account,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
    };

    await addAccount(targetSession.account);
  } catch {
    try {
      const refreshedSession = await client.refreshSession();
      targetSession.accessJwt = refreshedSession.accessJwt;
      targetSession.refreshJwt = refreshedSession.refreshJwt;
      await saveSessionTokens(targetSession.did, {
        did: targetSession.did,
        handle: targetSession.handle,
        accessJwt: targetSession.accessJwt,
        refreshJwt: targetSession.refreshJwt,
        email: targetSession.email,
        emailConfirmed: targetSession.emailConfirmed,
        active: targetSession.active,
      });
    } catch {
      await deleteSessionTokens(did);
      throw new Error('Session expired. Please sign in again.');
    }
  }

  await saveSessionTokens(targetSession.did, {
    did: targetSession.did,
    handle: targetSession.handle,
    accessJwt: targetSession.accessJwt,
    refreshJwt: targetSession.refreshJwt,
    email: targetSession.email,
    emailConfirmed: targetSession.emailConfirmed,
    active: targetSession.active,
  });
  await setActiveSessionDid(targetSession.did);

  return targetSession;
}
