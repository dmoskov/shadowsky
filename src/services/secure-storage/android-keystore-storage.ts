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
 * Future Android Implementation Reference
 *
 * When implementing native Android support, refer to:
 *
 * Key Purposes:
 * - ENCRYPT (1): Key can be used for encryption
 * - DECRYPT (2): Key can be used for decryption
 * - SIGN (4): Key can be used for signing
 * - VERIFY (8): Key can be used for signature verification
 *
 * Biometric Types:
 * - BIOMETRIC_STRONG (0x000f): Strong biometric (fingerprint, face)
 * - BIOMETRIC_WEAK (0x00ff): Weak biometric methods
 * - DEVICE_CREDENTIAL (0x8000): PIN, pattern, password
 *
 * Encryption Schemes:
 * - KEY_SCHEME: AES256_SIV for key encryption
 * - VALUE_SCHEME: AES256_GCM for value encryption
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
