/**
 * Platform Detection Utilities
 *
 * Detects the current platform and capabilities for secure storage.
 */

import type { Platform } from "./types";

// Type definitions for native bridge objects
interface CapacitorGlobal {
  getPlatform?: () => string;
}

interface WindowWithNativeBridges extends Window {
  Capacitor?: CapacitorGlobal;
  ReactNativeWebView?: object;
  cordova?: object;
}

/**
 * Detect the current platform
 */
export function detectPlatform(): Platform {
  // Check for React Native/Capacitor/Cordova native bridges
  if (typeof window !== "undefined") {
    const win = window as WindowWithNativeBridges;

    // Check for Capacitor
    if (win.Capacitor) {
      const platform = win.Capacitor.getPlatform?.();
      if (platform === "ios") return "ios";
      if (platform === "android") return "android";
    }

    // Check for React Native WebView
    if (win.ReactNativeWebView) {
      // React Native injects this, but we can't easily determine iOS vs Android
      // without additional checks
      const userAgent = navigator.userAgent || "";
      if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
      if (/Android/i.test(userAgent)) return "android";
    }

    // Check for Cordova
    if (win.cordova) {
      const platform = navigator.platform?.toLowerCase() || "";
      if (platform.includes("iphone") || platform.includes("ipad"))
        return "ios";
      if (/android/i.test(navigator.userAgent)) return "android";
    }
  }

  // Default to web
  return "web";
}

/**
 * Check if Web Crypto API is available
 */
export function isWebCryptoAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.crypto !== "undefined" &&
    typeof window.crypto.subtle !== "undefined"
  );
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    // Some browsers disable IndexedDB in private mode
    const test = window.indexedDB;
    return test !== null && test !== undefined;
  } catch {
    return false;
  }
}

/**
 * Check if Web Credential Management API is available
 */
export function isCredentialManagementAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    "credentials" in navigator
  );
}

/**
 * Check if WebAuthn/Biometrics is available
 */
export async function isWebAuthnAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    // Check if PublicKeyCredential is available
    if (typeof window.PublicKeyCredential === "undefined") return false;

    // Check if platform authenticator (biometrics) is available
    if (
      typeof window.PublicKeyCredential
        .isUserVerifyingPlatformAuthenticatorAvailable === "function"
    ) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Platform capabilities
 */
export interface PlatformCapabilities {
  platform: Platform;
  webCrypto: boolean;
  indexedDB: boolean;
  credentialManagement: boolean;
  webAuthn: boolean;
}

/**
 * Get all platform capabilities
 */
export async function getPlatformCapabilities(): Promise<PlatformCapabilities> {
  return {
    platform: detectPlatform(),
    webCrypto: isWebCryptoAvailable(),
    indexedDB: isIndexedDBAvailable(),
    credentialManagement: isCredentialManagementAvailable(),
    webAuthn: await isWebAuthnAvailable(),
  };
}
