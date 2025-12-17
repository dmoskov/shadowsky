/**
 * Authentication Service for Mobile
 * Handles AT Protocol authentication using app passwords
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {AtpSessionData} from '@atproto/api';
import {getAtProtoClient, resetAtProtoClient} from '../atproto/client';

const AUTH_STORAGE_KEY = '@shadowsky/auth_session';
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
): Promise<StoredSession> {
  try {
    // Reset any existing client
    resetAtProtoClient();

    // Get fresh client and login
    const client = getAtProtoClient();
    const sessionData = await client.login(identifier, password);

    // Fetch user profile to get handle and other info
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
    };

    // Store session
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

    // Add to accounts list for multi-account support
    await addAccount(account);

    return session;
  } catch (error) {
    console.error('Sign in failed:', error);
    throw error;
  }
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

    // Resume session with AT Protocol client
    const client = getAtProtoClient();
    await client.resumeSession(session);

    // Verify session is still valid by making a test API call
    try {
      const agent = client.getAgent();
      const profile = await agent.getProfile({actor: session.did});

      // Update account info in case it changed
      session.account = {
        ...session.account,
        handle: profile.data.handle,
        displayName: profile.data.displayName,
        avatar: profile.data.avatar,
      };

      // Update stored session
      await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    } catch (profileError) {
      // Session might be expired, try to refresh
      console.warn('Session validation failed, attempting refresh:', profileError);
      try {
        const refreshedSession = await client.refreshSession();
        session.accessJwt = refreshedSession.accessJwt;
        session.refreshJwt = refreshedSession.refreshJwt;
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      } catch (refreshError) {
        // Refresh failed, session is invalid
        console.error('Session refresh failed:', refreshError);
        await signOut();
        return null;
      }
    }

    return session;
  } catch (error) {
    console.error('Failed to resume session:', error);
    return null;
  }
}

/**
 * Sign out and clear current session
 */
export async function signOut(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    resetAtProtoClient();
  } catch (error) {
    console.error('Sign out failed:', error);
    throw error;
  }
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
  } catch (error) {
    console.error('Failed to get current session:', error);
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

    // Check if account already exists
    const existingIndex = accounts.findIndex(a => a.did === account.did);
    if (existingIndex >= 0) {
      // Update existing account
      accounts[existingIndex] = account;
    } else {
      // Add new account
      accounts.push(account);
    }

    await AsyncStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (error) {
    console.error('Failed to add account:', error);
  }
}

/**
 * Multi-account support: Get all accounts
 */
export async function getAccounts(): Promise<AuthAccount[]> {
  try {
    const storedAccounts = await AsyncStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return storedAccounts ? JSON.parse(storedAccounts) : [];
  } catch (error) {
    console.error('Failed to get accounts:', error);
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
  } catch (error) {
    console.error('Failed to remove account:', error);
  }
}
