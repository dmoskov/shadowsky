/**
 * Multi-account management service
 * Handles storing and switching between multiple Bluesky accounts
 */

import type { Session } from "@bsky/shared";
import { debug } from "../shared/debug";
import { deleteCookie, getCookie, setCookie } from "../utils/cookies";

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

export class AccountManager {
  private static readonly STORAGE_KEY = ACCOUNTS_STORAGE_KEY;
  private static readonly ACTIVE_KEY = ACTIVE_ACCOUNT_KEY;

  static getAllAccounts(): StoredAccount[] {
    try {
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

  static getActiveAccountDid(): string | null {
    try {
      return (
        getCookie(this.ACTIVE_KEY) || localStorage.getItem(this.ACTIVE_KEY)
      );
    } catch {
      return null;
    }
  }

  static getActiveAccount(): StoredAccount | null {
    const did = this.getActiveAccountDid();
    if (!did) return null;

    const accounts = this.getAllAccounts();
    return accounts.find((acc) => acc.did === did) || null;
  }

  static addOrUpdateAccount(
    session: Session,
    profileData?: { displayName?: string; avatar?: string },
  ): void {
    const accounts = this.getAllAccounts();
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

    this.saveAccounts(accounts);
    this.setActiveAccount(session.did);
  }

  static removeAccount(did: string): boolean {
    const accounts = this.getAllAccounts();
    const filteredAccounts = accounts.filter((acc) => acc.did !== did);

    if (filteredAccounts.length === accounts.length) {
      return false;
    }

    this.saveAccounts(filteredAccounts);

    const activeDid = this.getActiveAccountDid();
    if (activeDid === did) {
      if (filteredAccounts.length > 0) {
        this.setActiveAccount(filteredAccounts[0].did);
      } else {
        this.clearActiveAccount();
      }
    }

    const sessionKey = `notifications_bsky_session`;
    if (activeDid === did) {
      deleteCookie(sessionKey);
      localStorage.removeItem(sessionKey);
    }

    return true;
  }

  static switchAccount(did: string): StoredAccount | null {
    const accounts = this.getAllAccounts();
    const account = accounts.find((acc) => acc.did === did);

    if (!account) {
      debug.error("Account not found:", did);
      return null;
    }

    account.lastUsed = Date.now();
    this.saveAccounts(accounts);
    this.setActiveAccount(did);

    const sessionKey = `notifications_bsky_session`;
    const sessionData = JSON.stringify(account.session);

    // Security: SameSite=Strict prevents CSRF attacks
    setCookie(sessionKey, sessionData, {
      secure: window.location.protocol === "https:",
      sameSite: "Strict",
    });
    localStorage.setItem(sessionKey, sessionData);

    return account;
  }

  static updateAccountProfile(
    did: string,
    profileData: { displayName?: string; avatar?: string },
  ): void {
    const accounts = this.getAllAccounts();
    const account = accounts.find((acc) => acc.did === did);

    if (account) {
      account.displayName = profileData.displayName;
      account.avatar = profileData.avatar;
      this.saveAccounts(accounts);
    }
  }

  static getAccountCount(): number {
    return this.getAllAccounts().length;
  }

  static hasMultipleAccounts(): boolean {
    return this.getAccountCount() > 1;
  }

  private static setActiveAccount(did: string): void {
    // Security: SameSite=Strict prevents CSRF attacks
    setCookie(this.ACTIVE_KEY, did, {
      secure: window.location.protocol === "https:",
      sameSite: "Strict",
    });
    localStorage.setItem(this.ACTIVE_KEY, did);
  }

  private static clearActiveAccount(): void {
    deleteCookie(this.ACTIVE_KEY);
    localStorage.removeItem(this.ACTIVE_KEY);
  }

  private static saveAccounts(accounts: StoredAccount[]): void {
    const data = JSON.stringify(accounts);

    // Security: SameSite=Strict prevents CSRF attacks
    setCookie(this.STORAGE_KEY, data, {
      secure: window.location.protocol === "https:",
      sameSite: "Strict",
    });
    localStorage.setItem(this.STORAGE_KEY, data);
  }

  static clearAllAccounts(): void {
    deleteCookie(this.STORAGE_KEY);
    deleteCookie(this.ACTIVE_KEY);
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.ACTIVE_KEY);

    const sessionKey = `notifications_bsky_session`;
    deleteCookie(sessionKey);
    localStorage.removeItem(sessionKey);
  }
}
