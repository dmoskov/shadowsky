/**
 * iOS Keychain Storage Backend (Stub)
 *
 * This is a stub implementation for future iOS native app development.
 * When the app is converted to React Native or Capacitor, this module
 * should be implemented using the iOS Keychain Services API.
 *
 * Implementation Requirements:
 * - Use SecItemAdd, SecItemUpdate, SecItemDelete, SecItemCopyMatching
 * - Set kSecAttrAccessibleWhenUnlocked for access control
 * - Support Face ID/Touch ID with kSecAccessControlBiometryCurrentSet
 * - Handle Keychain sharing using kSecAttrAccessGroup
 *
 * For React Native: Use react-native-keychain package
 * For Capacitor: Use @capacitor-community/secure-storage
 */

import type { ISecureStorage, SecureStorageOptions } from "./types";
import { SecureStorageError } from "./types";

/**
 * iOS Keychain storage stub - throws not available error
 *
 * This implementation exists to provide type safety and a clear
 * integration point for future iOS native implementation.
 */
export class IOSKeychainStorage implements ISecureStorage {
  private throwNotAvailable(): never {
    throw new SecureStorageError(
      "iOS Keychain storage requires a native iOS app. " +
        "This is a stub implementation for future development.",
      "NOT_AVAILABLE",
    );
  }

  async setItem(
    _key: string,
    _value: string,
    _options?: SecureStorageOptions,
  ): Promise<void> {
    this.throwNotAvailable();
  }

  async getItem(_key: string): Promise<string | null> {
    this.throwNotAvailable();
  }

  async removeItem(_key: string): Promise<void> {
    this.throwNotAvailable();
  }

  async hasItem(_key: string): Promise<boolean> {
    this.throwNotAvailable();
  }

  async clear(): Promise<void> {
    this.throwNotAvailable();
  }

  async getAllKeys(): Promise<string[]> {
    this.throwNotAvailable();
  }

  async setBiometricProtection(_key: string, _enabled: boolean): Promise<void> {
    this.throwNotAvailable();
  }

  async isBiometricAvailable(): Promise<boolean> {
    return false;
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }
}

/**
 * Future iOS Implementation Reference
 *
 * When implementing native iOS support, refer to:
 *
 * Keychain Accessibility Levels:
 * - WHEN_UNLOCKED: kSecAttrAccessibleWhenUnlocked
 * - AFTER_FIRST_UNLOCK: kSecAttrAccessibleAfterFirstUnlock
 * - WHEN_UNLOCKED_THIS_DEVICE_ONLY: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
 * - AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
 * - WHEN_PASSCODE_SET_THIS_DEVICE_ONLY: kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
 *
 * Biometric Protection Options:
 * - BIOMETRY_ANY: kSecAccessControlBiometryAny
 * - BIOMETRY_CURRENT_SET: kSecAccessControlBiometryCurrentSet
 * - DEVICE_PASSCODE: kSecAccessControlDevicePasscode
 * - USER_PRESENCE: kSecAccessControlUserPresence
 */
