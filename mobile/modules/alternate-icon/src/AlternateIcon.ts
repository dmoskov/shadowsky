import { requireOptionalNativeModule } from "expo-modules-core";

const AlternateIconModule = requireOptionalNativeModule("AlternateIconModule");

/**
 * Returns the name of the currently active alternate icon,
 * or null if using the primary (default) icon.
 */
export function getAlternateIconName(): string | null {
  if (!AlternateIconModule) return null;
  return AlternateIconModule.getAlternateIconName();
}

/**
 * Set the app icon. Pass null to reset to the primary icon.
 * Pass an icon name that matches a CFBundleAlternateIcons key.
 *
 * iOS will show a system alert: "You have changed the icon for Asphodel"
 */
export async function setAlternateIcon(iconName: string | null): Promise<void> {
  if (!AlternateIconModule) throw new Error("Alternate icons not available");
  return AlternateIconModule.setAlternateIcon(iconName);
}

/**
 * Returns true if the device supports alternate icons (iOS 10.3+).
 */
export function supportsAlternateIcons(): boolean {
  if (!AlternateIconModule) return false;
  return AlternateIconModule.supportsAlternateIcons();
}
