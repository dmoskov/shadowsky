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
 * iOS Keychain access levels (for future implementation reference)
 */
export const IOSKeychainAccessibility = {
  /** Item data can only be accessed while device is unlocked */
  WHEN_UNLOCKED: "kSecAttrAccessibleWhenUnlocked",
  /** Item data can only be accessed after first unlock */
  AFTER_FIRST_UNLOCK: "kSecAttrAccessibleAfterFirstUnlock",
  /** Item data can be accessed when device is unlocked (non-migratable) */
  WHEN_UNLOCKED_THIS_DEVICE_ONLY:
    "kSecAttrAccessibleWhenUnlockedThisDeviceOnly",
  /** Item data can be accessed after first unlock (non-migratable) */
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
    "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly",
  /** Item data can only be accessed when passcode is set on device */
  WHEN_PASSCODE_SET_THIS_DEVICE_ONLY:
    "kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly",
} as const;

/**
 * iOS Keychain biometric protection options (for future implementation reference)
 */
export const IOSBiometricProtection = {
  /** Require any biometric authentication */
  BIOMETRY_ANY: "kSecAccessControlBiometryAny",
  /** Require biometric authentication enrolled at time of creation */
  BIOMETRY_CURRENT_SET: "kSecAccessControlBiometryCurrentSet",
  /** Require device passcode */
  DEVICE_PASSCODE: "kSecAccessControlDevicePasscode",
  /** Require user presence (any authentication method) */
  USER_PRESENCE: "kSecAccessControlUserPresence",
} as const;
