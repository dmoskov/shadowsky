/**
 * Secure Account Manager
 *
 * Enhanced account management using secure storage for credentials.
 * This module provides a drop-in replacement for AccountManager that
 * stores sensitive session data in encrypted storage.
 *
 * Migration Strategy:
 * 1. First call initializes secure storage and migrates existing accounts
 * 2. All reads check secure storage first, fall back to localStorage
 * 3. All writes go to both secure storage and localStorage (for compatibility)
 * 4. After migration is complete, localStorage can be cleared
 */

import type { Session } from "@bsky/shared";
import { debug } from "../shared/debug";
import { deleteCookie, getCookie, setCookie } from "../utils/cookies";
import type { ISecureStorage } from "./secure-storage";
import {
  getSecureOrFallback,
  getSecureStorage,
  isMigrationNeeded,
  migrateToSecureStorage,
  setSecureWithFallback,
} from "./secure-storage";

export interface StoredAccount {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
  session: Session;
  lastUsed: number;
}

export interface AccountsList {
  accounts: StoredAccount[];
  activeAccount: string | null;
}

const ACCOUNTS_STORAGE_KEY = "bsky_accounts";
const ACTIVE_ACCOUNT_KEY = "bsky_active_account";
const SESSION_KEY = "notifications_bsky_session";

/**
 * Secure Account Manager
 *
 * Uses encrypted storage for session credentials while maintaining
 * backward compatibility with localStorage during migration.
 */
export class SecureAccountManager {
  private static readonly STORAGE_KEY = ACCOUNTS_STORAGE_KEY;
  private static readonly ACTIVE_KEY = ACTIVE_ACCOUNT_KEY;
  private static readonly SESSION_KEY = SESSION_KEY;
  private static secureStorage: ISecureStorage | null = null;
  private static initPromise: Promise<void> | null = null;
  private static migrationComplete = false;

  /**
   * Initialize secure storage and run migration if needed
   */
  private static async initialize(): Promise<void> {
    if (this.secureStorage) return;

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private static async doInitialize(): Promise<void> {
    try {
      this.secureStorage = await getSecureStorage();

      // Check if migration is needed
      if (isMigrationNeeded()) {
        debug.log("Starting credential migration to secure storage");

        const status = await migrateToSecureStorage(this.secureStorage, {
          clearInsecure: false, // Keep insecure storage during transition
          onProgress: (key, success) => {
            debug.log(`Migration ${key}: ${success ? "success" : "failed"}`);
          },
        });

        this.migrationComplete = !status.hadErrors;

        if (status.hadErrors) {
          debug.warn("Migration completed with errors:", status.errors);
        } else {
          debug.log("Migration completed successfully");
        }
      } else {
        this.migrationComplete = true;
      }
    } catch (err) {
      debug.error("Failed to initialize secure storage:", err);
      // Continue without secure storage - will fall back to localStorage
      this.secureStorage = null;
      this.migrationComplete = false;
    }
  }

  /**
   * Get all stored accounts
   */
  static async getAllAccounts(): Promise<StoredAccount[]> {
    await this.initialize();

    try {
      const stored = await this.getValue(this.STORAGE_KEY);
      if (!stored) return [];

      const accounts = JSON.parse(stored) as StoredAccount[];
      return accounts.sort((a, b) => b.lastUsed - a.lastUsed);
    } catch (error) {
      debug.error("Failed to load accounts:", error);
      return [];
    }
  }

  /**
   * Get all accounts (sync version for backward compatibility)
   * Note: This returns cached data and may not reflect latest state
   */
  static getAllAccountsSync(): StoredAccount[] {
    try {
      // Only use sync storage - secure storage requires async
      const stored =
        getCookie(this.STORAGE_KEY) || localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const accounts = JSON.parse(stored) as StoredAccount[];
      return accounts.sort((a, b) => b.lastUsed - a.lastUsed);
    } catch (error) {
      debug.error("Failed to load accounts:", error);
      return [];
    }
  }

  /**
   * Get the active account DID
   */
  static async getActiveAccountDid(): Promise<string | null> {
    await this.initialize();

    try {
      return await this.getValue(this.ACTIVE_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Get active account DID (sync version)
   */
  static getActiveAccountDidSync(): string | null {
    try {
      return (
        getCookie(this.ACTIVE_KEY) || localStorage.getItem(this.ACTIVE_KEY)
      );
    } catch {
      return null;
    }
  }

  /**
   * Get the active account
   */
  static async getActiveAccount(): Promise<StoredAccount | null> {
    const did = await this.getActiveAccountDid();
    if (!did) return null;

    const accounts = await this.getAllAccounts();
    return accounts.find((acc) => acc.did === did) || null;
  }

  /**
   * Add or update an account
   */
  static async addOrUpdateAccount(
    session: Session,
    profileData?: { displayName?: string; avatar?: string },
  ): Promise<void> {
    await this.initialize();

    const accounts = await this.getAllAccounts();
    const existingIndex = accounts.findIndex((acc) => acc.did === session.did);

    const account: StoredAccount = {
      did: session.did,
      handle: session.handle,
      displayName: profileData?.displayName,
      avatar: profileData?.avatar,
      session,
      lastUsed: Date.now(),
    };

    if (existingIndex >= 0) {
      accounts[existingIndex] = account;
    } else {
      accounts.push(account);
    }

    await this.saveAccounts(accounts);
    await this.setActiveAccount(session.did);
  }

  /**
   * Remove an account
   */
  static async removeAccount(did: string): Promise<boolean> {
    await this.initialize();

    const accounts = await this.getAllAccounts();
    const filteredAccounts = accounts.filter((acc) => acc.did !== did);

    if (filteredAccounts.length === accounts.length) {
      return false;
    }

    await this.saveAccounts(filteredAccounts);

    const activeDid = await this.getActiveAccountDid();
    if (activeDid === did) {
      if (filteredAccounts.length > 0) {
        await this.setActiveAccount(filteredAccounts[0].did);
      } else {
        await this.clearActiveAccount();
      }
    }

    // Clear session if this was the active account
    if (activeDid === did) {
      await this.clearSession();
    }

    return true;
  }

  /**
   * Switch to a different account
   */
  static async switchAccount(did: string): Promise<StoredAccount | null> {
    await this.initialize();

    const accounts = await this.getAllAccounts();
    const account = accounts.find((acc) => acc.did === did);

    if (!account) {
      debug.error("Account not found:", did);
      return null;
    }

    // Update last used
    account.lastUsed = Date.now();
    await this.saveAccounts(accounts);
    await this.setActiveAccount(did);

    // Save session
    await this.saveSession(account.session);

    return account;
  }

  /**
   * Update account profile data
   */
  static async updateAccountProfile(
    did: string,
    profileData: { displayName?: string; avatar?: string },
  ): Promise<void> {
    await this.initialize();

    const accounts = await this.getAllAccounts();
    const account = accounts.find((acc) => acc.did === did);

    if (account) {
      account.displayName = profileData.displayName;
      account.avatar = profileData.avatar;
      await this.saveAccounts(accounts);
    }
  }

  /**
   * Get the number of stored accounts
   */
  static async getAccountCount(): Promise<number> {
    const accounts = await this.getAllAccounts();
    return accounts.length;
  }

  /**
   * Check if there are multiple accounts
   */
  static async hasMultipleAccounts(): Promise<boolean> {
    const count = await this.getAccountCount();
    return count > 1;
  }

  /**
   * Clear all accounts and sessions
   */
  static async clearAllAccounts(): Promise<void> {
    await this.initialize();

    // Clear from secure storage
    if (this.secureStorage) {
      try {
        await this.secureStorage.removeItem(this.STORAGE_KEY);
        await this.secureStorage.removeItem(this.ACTIVE_KEY);
        await this.secureStorage.removeItem(this.SESSION_KEY);
      } catch (err) {
        debug.error("Failed to clear secure storage:", err);
      }
    }

    // Clear from insecure storage
    deleteCookie(this.STORAGE_KEY);
    deleteCookie(this.ACTIVE_KEY);
    deleteCookie(this.SESSION_KEY);
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ACTIVE_KEY);
    localStorage.removeItem(this.SESSION_KEY);
  }

  /**
   * Check if secure storage is being used
   */
  static async isSecureStorageActive(): Promise<boolean> {
    await this.initialize();
    return this.secureStorage !== null && this.migrationComplete;
  }

  // Private helper methods

  private static async getValue(key: string): Promise<string | null> {
    if (this.secureStorage) {
      return getSecureOrFallback(this.secureStorage, key);
    }

    // Fall back to insecure storage
    return getCookie(key) || localStorage.getItem(key);
  }

  private static async setValue(key: string, value: string): Promise<void> {
    // Write to both secure and insecure storage during transition
    if (this.secureStorage) {
      await setSecureWithFallback(this.secureStorage, key, value);
    } else {
      localStorage.setItem(key, value);
    }

    // Also write to cookie for cross-domain access
    setCookie(key, value, {
      secure: window.location.protocol === "https:",
      sameSite: "Strict",
    });
  }

  private static async setActiveAccount(did: string): Promise<void> {
    await this.setValue(this.ACTIVE_KEY, did);
  }

  private static async clearActiveAccount(): Promise<void> {
    if (this.secureStorage) {
      try {
        await this.secureStorage.removeItem(this.ACTIVE_KEY);
      } catch (err) {
        debug.error("Failed to clear active account from secure storage:", err);
      }
    }

    deleteCookie(this.ACTIVE_KEY);
    localStorage.removeItem(this.ACTIVE_KEY);
  }

  private static async saveAccounts(accounts: StoredAccount[]): Promise<void> {
    const data = JSON.stringify(accounts);
    await this.setValue(this.STORAGE_KEY, data);
  }

  private static async saveSession(session: Session): Promise<void> {
    const data = JSON.stringify(session);
    await this.setValue(this.SESSION_KEY, data);
  }

  private static async clearSession(): Promise<void> {
    if (this.secureStorage) {
      try {
        await this.secureStorage.removeItem(this.SESSION_KEY);
      } catch (err) {
        debug.error("Failed to clear session from secure storage:", err);
      }
    }

    deleteCookie(this.SESSION_KEY);
    localStorage.removeItem(this.SESSION_KEY);
  }
}
