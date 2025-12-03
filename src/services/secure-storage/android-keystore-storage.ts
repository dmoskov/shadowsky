/**
 * Android Keystore Storage Backend (Stub)
 *
 * This is a stub implementation for future Android native app development.
 * When the app is converted to React Native or Capacitor, this module
 * should be implemented using Android EncryptedSharedPreferences backed
 * by the Android Keystore.
 *
 * Implementation Requirements:
 * - Use EncryptedSharedPreferences from AndroidX Security library
 * - Keys should be stored in Android Keystore
 * - Support biometric protection via BiometricPrompt
 * - Handle Keystore key attestation for enterprise apps
 *
 * For React Native: Use react-native-keychain package
 * For Capacitor: Use @capacitor-community/secure-storage
 */

import type { ISecureStorage, SecureStorageOptions } from "./types";
import { SecureStorageError } from "./types";

/**
 * Android Keystore storage stub - throws not available error
 *
 * This implementation exists to provide type safety and a clear
 * integration point for future Android native implementation.
 */
export class AndroidKeystoreStorage implements ISecureStorage {
  private throwNotAvailable(): never {
    throw new SecureStorageError(
      "Android Keystore storage requires a native Android app. " +
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
 * Android Keystore key purposes (for future implementation reference)
 */
export const AndroidKeyPurpose = {
  /** Key can be used for encryption */
  ENCRYPT: 1,
  /** Key can be used for decryption */
  DECRYPT: 2,
  /** Key can be used for signing */
  SIGN: 4,
  /** Key can be used for signature verification */
  VERIFY: 8,
} as const;

/**
 * Android biometric authentication types (for future implementation reference)
 */
export const AndroidBiometricType = {
  /** Strong biometric (fingerprint, face on supported devices) */
  BIOMETRIC_STRONG: 0x000f,
  /** Weak biometric (may include less secure methods) */
  BIOMETRIC_WEAK: 0x00ff,
  /** Device credential (PIN, pattern, password) */
  DEVICE_CREDENTIAL: 0x8000,
} as const;

/**
 * EncryptedSharedPreferences configuration (for future implementation reference)
 *
 * Example Kotlin implementation:
 * ```kotlin
 * val masterKey = MasterKey.Builder(context)
 *     .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
 *     .setUserAuthenticationRequired(true)
 *     .setUserAuthenticationParameters(
 *         0, // timeout (0 = every access)
 *         KeyProperties.AUTH_BIOMETRIC_STRONG
 *     )
 *     .build()
 *
 * val sharedPreferences = EncryptedSharedPreferences.create(
 *     context,
 *     "secure_prefs",
 *     masterKey,
 *     EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
 *     EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
 * )
 * ```
 */
export const AndroidEncryptionScheme = {
  /** AES-256-SIV for key encryption */
  KEY_SCHEME: "AES256_SIV",
  /** AES-256-GCM for value encryption */
  VALUE_SCHEME: "AES256_GCM",
} as const;
