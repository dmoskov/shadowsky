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
import {
  saveSessionTokens,
  getSessionTokens,
  deleteSessionTokens,
  setActiveSessionDid,
  getActiveSessionDid,
  clearActiveSessionDid,
  migrateTokensToSecureStore,
} from './secure-token-storage';

const ACCOUNTS_STORAGE_KEY = '@shadowsky/accounts';

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
  const profile = await agent.getProfile({actor: sessionData.did});

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
 * Sign in with OAuth session data
 */
export async function signInWithOAuth(
  sessionData: AtpSessionData,
): Promise<StoredSession> {
  resetAtProtoClient();

  const client = getAtProtoClient();
  await client.initialize(sessionData);

  const agent = client.getAgent();
  const profile = await agent.getProfile({actor: sessionData.did});

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
 * Resume existing session from storage.
 *
 * Runs a one-time migration from AsyncStorage to SecureStore on first launch
 * after the update. Then loads tokens from SecureStore and account metadata
 * from AsyncStorage.
 *
 * Returns the cached session immediately after restoring credentials so the
 * app can render the authenticated UI without waiting for a network round-trip.
 * Profile data (avatar, displayName) is refreshed in the background via
 * `refreshProfileInBackground`, keeping the cold start path off the critical
 * rendering chain.
 */
export async function resumeSession(): Promise<StoredSession | null> {
  try {
    // Migrate tokens from AsyncStorage to SecureStore (idempotent)
    await migrateTokensToSecureStore();

    const activeDid = await getActiveSessionDid();
    if (!activeDid) {
      return null;
    }

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

    // Return immediately — profile refresh happens in the background so the
    // provider chain and first feed frame are not blocked by a network call.
    refreshProfileInBackground(session);

    return session;
  } catch {
    return null;
  }
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
    const profile = await agent.getProfile({actor: session.did});

    session.account = {
      ...session.account,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
    };

    // Update account metadata in AsyncStorage
    await addAccount(session.account);
  } catch {
    // Profile fetch failed — session tokens may be stale. Attempt a refresh.
    try {
      const client = getAtProtoClient();
      const refreshedSession = await client.refreshSession();
      session.accessJwt = refreshedSession.accessJwt;
      session.refreshJwt = refreshedSession.refreshJwt;
      // Persist refreshed tokens to SecureStore
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
      // Token refresh also failed — sign the user out so they can re-auth.
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
    await deleteSessionTokens(activeDid);
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

    // Remove session tokens from SecureStore
    await deleteSessionTokens(did);

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
  const tokenData = await getSessionTokens(did);
  if (!tokenData) {
    throw new Error('Session not found for account');
  }

  const accounts = await getAccounts();
  const account = accounts.find(a => a.did === did);

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

  resetAtProtoClient();

  const client = getAtProtoClient();
  await client.resumeSession(targetSession);

  try {
    const agent = client.getAgent();
    const profile = await agent.getProfile({actor: targetSession.did});

    targetSession.account = {
      ...targetSession.account,
      handle: profile.data.handle,
      displayName: profile.data.displayName,
      avatar: profile.data.avatar,
    };

    await addAccount(targetSession.account);
  } catch {
    // Session might be expired, try to refresh
    try {
      const refreshedSession = await client.refreshSession();
      targetSession.accessJwt = refreshedSession.accessJwt;
      targetSession.refreshJwt = refreshedSession.refreshJwt;
      // Persist refreshed tokens
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
