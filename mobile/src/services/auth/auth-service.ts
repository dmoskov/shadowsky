/**
 * Authentication Service for Mobile
 * Handles AT Protocol authentication using app passwords
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {AtpSessionData} from '@atproto/api';
import {getAtProtoClient, resetAtProtoClient} from '../atproto/client';

const AUTH_STORAGE_KEY = '@shadowsky/auth_session';
const ACCOUNTS_STORAGE_KEY = '@shadowsky/accounts';
const SESSIONS_STORAGE_KEY = '@shadowsky/sessions';
const ACTIVE_ACCOUNT_KEY = '@shadowsky/active_account';

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
): Promise<StoredSession> {
  resetAtProtoClient();

  const client = getAtProtoClient();
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

  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  await addSession(session);
  await addAccount(account);
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, session.did);

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

  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  await addSession(session);
  await addAccount(account);
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, session.did);

  return session;
}

/**
 * Resume existing session from storage
 */
export async function resumeSession(): Promise<StoredSession | null> {
  try {
    const storedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedSession) {
      return null;
    }

    const session: StoredSession = JSON.parse(storedSession);

    const client = getAtProtoClient();
    await client.resumeSession(session);

    try {
      const agent = client.getAgent();
      const profile = await agent.getProfile({actor: session.did});

      session.account = {
        ...session.account,
        handle: profile.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar,
      };

      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      await addSession(session);
    } catch {
      // Session might be expired, try to refresh
      try {
        const refreshedSession = await client.refreshSession();
        session.accessJwt = refreshedSession.accessJwt;
        session.refreshJwt = refreshedSession.refreshJwt;
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } catch {
        await signOut();
        return null;
      }
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Sign out and clear current session
 */
export async function signOut(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
  await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  resetAtProtoClient();
}

/**
 * Get current session from storage
 */
export async function getCurrentSession(): Promise<StoredSession | null> {
  try {
    const storedSession = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedSession) {
      return null;
    }
    return JSON.parse(storedSession);
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

    await removeSession(did);

    const activeAccount = await AsyncStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (activeAccount === did) {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      await AsyncStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      resetAtProtoClient();
    }
  } catch {
    // Storage write failed — non-critical
  }
}

/**
 * Multi-account support: Store session for an account
 */
async function addSession(session: StoredSession): Promise<void> {
  try {
    const storedSessions = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
    const sessions: StoredSession[] = storedSessions
      ? JSON.parse(storedSessions)
      : [];

    const existingIndex = sessions.findIndex(s => s.did === session.did);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage write failed — non-critical
  }
}

/**
 * Multi-account support: Get all stored sessions
 */
export async function getSessions(): Promise<StoredSession[]> {
  try {
    const storedSessions = await AsyncStorage.getItem(SESSIONS_STORAGE_KEY);
    return storedSessions ? JSON.parse(storedSessions) : [];
  } catch {
    return [];
  }
}

/**
 * Multi-account support: Remove session for an account
 */
async function removeSession(did: string): Promise<void> {
  try {
    const sessions = await getSessions();
    const filtered = sessions.filter(s => s.did !== did);
    await AsyncStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // Storage write failed — non-critical
  }
}

/**
 * Multi-account support: Switch to a different account
 */
export async function switchToAccount(did: string): Promise<StoredSession> {
  const sessions = await getSessions();
  const targetSession = sessions.find(s => s.did === did);

  if (!targetSession) {
    throw new Error('Session not found for account');
  }

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

    await addSession(targetSession);
  } catch {
    // Session might be expired, try to refresh
    try {
      const refreshedSession = await client.refreshSession();
      targetSession.accessJwt = refreshedSession.accessJwt;
      targetSession.refreshJwt = refreshedSession.refreshJwt;
      await addSession(targetSession);
    } catch {
      await removeSession(did);
      throw new Error('Session expired. Please sign in again.');
    }
  }

  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(targetSession));
  await AsyncStorage.setItem(ACTIVE_ACCOUNT_KEY, targetSession.did);

  return targetSession;
}
