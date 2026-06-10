// GENERATED FILE - do not edit.
// Edit packages/tokens/tokens.mjs and run `npm run tokens:build`.
//
// Mirrors the React Native theme (mobile/src/constants/theme.ts) so SwiftUI
// views match the rest of the app. Mode-invariant colors are at the top
// level; mode-specific colors live under Dark/Light.

import SwiftUI

enum DesignTokens {
  static let primary = Color(red: 0xC9 / 255.0, green: 0xA8 / 255.0, blue: 0x4C / 255.0)
  static let primaryDark = Color(red: 0x8A / 255.0, green: 0x72 / 255.0, blue: 0x30 / 255.0)
  static let danger = Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
  static let success = Color(red: 0x10 / 255.0, green: 0xB9 / 255.0, blue: 0x81 / 255.0)
  static let info = Color(red: 0x3B / 255.0, green: 0x82 / 255.0, blue: 0xF6 / 255.0)
  static let warning = Color(red: 0xF5 / 255.0, green: 0x9E / 255.0, blue: 0x0B / 255.0)
  static let like = Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
  static let repost = Color(red: 0x10 / 255.0, green: 0xB9 / 255.0, blue: 0x81 / 255.0)
  static let mention = Color(red: 0x8B / 255.0, green: 0x5C / 255.0, blue: 0xF6 / 255.0)
  static let reply = Color(red: 0x63 / 255.0, green: 0x66 / 255.0, blue: 0xF1 / 255.0)
  static let quote = Color(red: 0x06 / 255.0, green: 0xB6 / 255.0, blue: 0xD4 / 255.0)
  static let accent = Color(red: 0xF9 / 255.0, green: 0x18 / 255.0, blue: 0x80 / 255.0)
  static let accentGreen = Color(red: 0x4A / 255.0, green: 0xDE / 255.0, blue: 0x80 / 255.0)
  static let accentBlue = Color(red: 0x3B / 255.0, green: 0x82 / 255.0, blue: 0xF6 / 255.0)
  static let accentPurple = Color(red: 0x8B / 255.0, green: 0x5C / 255.0, blue: 0xF6 / 255.0)
  static let primaryLight = Color(red: 0xE0 / 255.0, green: 0xC8 / 255.0, blue: 0x6B / 255.0)
  static let textOnPrimary = Color(red: 0xFF / 255.0, green: 0xFF / 255.0, blue: 0xFF / 255.0)

  enum Dark {
    static let background = Color(red: 0x0A / 255.0, green: 0x0A / 255.0, blue: 0x0F / 255.0)
    static let surface = Color(red: 0x1A / 255.0, green: 0x1A / 255.0, blue: 0x24 / 255.0)
    static let surfaceAlt = Color(red: 0x1F / 255.0, green: 0x1F / 255.0, blue: 0x23 / 255.0)
    static let surfaceElevated = Color(red: 0x1F / 255.0, green: 0x29 / 255.0, blue: 0x37 / 255.0)
    static let border = Color(red: 0x1F / 255.0, green: 0x29 / 255.0, blue: 0x37 / 255.0)
    static let borderLight = Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0)
    static let borderDark = Color(red: 0x00 / 255.0, green: 0x00 / 255.0, blue: 0x00 / 255.0)
    static let text = Color(red: 0xFF / 255.0, green: 0xFF / 255.0, blue: 0xFF / 255.0)
    static let textSecondary = Color(red: 0x9C / 255.0, green: 0xA3 / 255.0, blue: 0xAF / 255.0)
    static let textTertiary = Color(red: 0x6B / 255.0, green: 0x72 / 255.0, blue: 0x80 / 255.0)
    static let textMuted = Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)
    static let errorBackground = Color(red: 0x1A / 255.0, green: 0x0A / 255.0, blue: 0x0A / 255.0)
    static let errorBorder = Color(red: 0xFF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
    static let unreadBackground = Color(red: 0x0F / 255.0, green: 0x17 / 255.0, blue: 0x2A / 255.0)
    static let overlayBackground = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.7)
    static let editorBackground = Color(red: 0x1A / 255.0, green: 0x1A / 255.0, blue: 0x1A / 255.0)
    static let editorBorder = Color(red: 0x44 / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
    static let editorControl = Color(red: 0x2A / 255.0, green: 0x2A / 255.0, blue: 0x2A / 255.0)
    static let editorText = Color(red: 0x99 / 255.0, green: 0x99 / 255.0, blue: 0x99 / 255.0)
    static let modalOverlay = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.6)
    static let shadowLight = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.1)
    static let shadowMedium = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.2)
    static let shadowHeavy = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.4)
    static let glowPrimary = Color(red: 201 / 255.0, green: 168 / 255.0, blue: 76 / 255.0, opacity: 0.15)
    static let glowAccent = Color(red: 249 / 255.0, green: 24 / 255.0, blue: 128 / 255.0, opacity: 0.15)
    static let cardBackground = Color(red: 0x16 / 255.0, green: 0x16 / 255.0, blue: 0x1F / 255.0)
    static let cardBorder = Color(red: 0x2A / 255.0, green: 0x2A / 255.0, blue: 0x35 / 255.0)
  }

  enum Light {
    static let background = Color(red: 0xFF / 255.0, green: 0xFF / 255.0, blue: 0xFF / 255.0)
    static let surface = Color(red: 0xF9 / 255.0, green: 0xFA / 255.0, blue: 0xFB / 255.0)
    static let surfaceAlt = Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0)
    static let surfaceElevated = Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0)
    static let border = Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)
    static let borderLight = Color(red: 0xD1 / 255.0, green: 0xD5 / 255.0, blue: 0xDB / 255.0)
    static let borderDark = Color(red: 0x11 / 255.0, green: 0x18 / 255.0, blue: 0x27 / 255.0)
    static let text = Color(red: 0x11 / 255.0, green: 0x18 / 255.0, blue: 0x27 / 255.0)
    static let textSecondary = Color(red: 0x6B / 255.0, green: 0x72 / 255.0, blue: 0x80 / 255.0)
    static let textTertiary = Color(red: 0x9C / 255.0, green: 0xA3 / 255.0, blue: 0xAF / 255.0)
    static let textMuted = Color(red: 0x37 / 255.0, green: 0x41 / 255.0, blue: 0x51 / 255.0)
    static let errorBackground = Color(red: 0xFE / 255.0, green: 0xF2 / 255.0, blue: 0xF2 / 255.0)
    static let errorBorder = Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
    static let unreadBackground = Color(red: 0xF0 / 255.0, green: 0xF9 / 255.0, blue: 0xFF / 255.0)
    static let overlayBackground = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.5)
    static let editorBackground = Color(red: 0xF3 / 255.0, green: 0xF4 / 255.0, blue: 0xF6 / 255.0)
    static let editorBorder = Color(red: 0xD1 / 255.0, green: 0xD5 / 255.0, blue: 0xDB / 255.0)
    static let editorControl = Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)
    static let editorText = Color(red: 0x6B / 255.0, green: 0x72 / 255.0, blue: 0x80 / 255.0)
    static let modalOverlay = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.4)
    static let shadowLight = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.05)
    static let shadowMedium = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.1)
    static let shadowHeavy = Color(red: 0 / 255.0, green: 0 / 255.0, blue: 0 / 255.0, opacity: 0.2)
    static let glowPrimary = Color(red: 201 / 255.0, green: 168 / 255.0, blue: 76 / 255.0, opacity: 0.1)
    static let glowAccent = Color(red: 249 / 255.0, green: 24 / 255.0, blue: 128 / 255.0, opacity: 0.1)
    static let cardBackground = Color(red: 0xFF / 255.0, green: 0xFF / 255.0, blue: 0xFF / 255.0)
    static let cardBorder = Color(red: 0xE5 / 255.0, green: 0xE7 / 255.0, blue: 0xEB / 255.0)
  }
}
