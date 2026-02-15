# Custom ESLint Rules (`eslint-plugin-shadowsky-mobile`)

Local ESLint plugin for the ShadowSky mobile app. These rules catch common mobile-specific issues discovered during iOS build sessions.

## Setup

The plugin is registered as a local dependency in `package.json`:

```json
"eslint-plugin-shadowsky-mobile": "file:./eslint-rules"
```

And enabled in `.eslintrc.js`:

```js
plugins: ['shadowsky-mobile'],
rules: {
  'shadowsky-mobile/no-quoted-color-references': 'error',
  'shadowsky-mobile/no-unsafe-native-call': 'warn',
}
```

---

## Rules

### `no-quoted-color-references`

Prevents the common mistake of using color theme variables as string literals instead of actual variable references. **Auto-fixable.**

#### Problem

During iOS build fixes, 22 instances of quoted color strings were found, where developers accidentally used color theme properties as strings:

```tsx
// BAD - String literal, not using actual color
backgroundColor: 'colors.surface'
color: 'colors.text'

// GOOD - Actual variable reference
backgroundColor: colors.surface
color: colors.text
```

#### Rule Details

This rule detects when a string literal matches the pattern of a color theme reference (e.g., `'colors.*'` or `'theme.colors.*'`) and reports an error. It provides auto-fix to remove the quotes.

---

### `no-unsafe-native-call`

Warns when native module method calls (expo-\*, react-native) are not wrapped in a try/catch block.

#### Problem

Native modules communicate over the JS-native bridge, which can throw at runtime when:
- The native module isn't linked (missing pod install, etc.)
- Running in an environment where the module isn't available (Expo Go, web)
- The native API itself throws (permissions denied, hardware unavailable)

Unguarded calls crash the app instead of failing gracefully.

#### Examples

```tsx
// BAD - Will crash if native module throws
Notifications.setNotificationHandler({ ... });
await ImagePicker.launchImageLibraryAsync({ ... });

// GOOD - Graceful degradation
try {
  Notifications.setNotificationHandler({ ... });
} catch (e) {
  console.error('Failed to configure notifications:', e);
}

try {
  const result = await ImagePicker.launchImageLibraryAsync({ ... });
} catch (e) {
  console.error('Image picker failed:', e);
}
```

#### Configuration

The rule accepts an optional `additionalModules` array to extend the built-in list of known native modules:

```js
'shadowsky-mobile/no-unsafe-native-call': ['warn', {
  additionalModules: ['MyCustomNativeModule']
}]
```

#### Built-in Native Modules

The rule recognizes these module namespaces by default:
`Notifications`, `ImagePicker`, `Camera`, `MediaLibrary`, `FileSystem`, `Haptics`, `Sharing`, `LocalAuthentication`, `Device`, `Crypto`, `SecureStore`, `DocumentPicker`, `ImageManipulator`, `VideoThumbnails`, `BackgroundFetch`, `TaskManager`, `Updates`, `WebBrowser`, `Linking`, `Clipboard`, `BarCodeScanner`, `Audio`, `Video`

Event listener methods (`addEventListener`, `removeEventListener`, `addListener`, `removeListener`) are excluded since they don't typically throw.

---

## Also Configured

In addition to custom rules, the mobile `.eslintrc.js` configures:

- **`no-console`** (`warn`): Catches `console.log` left from debugging. `console.warn`, `console.error`, and `console.info` are allowed. Disabled for debug utility files and test files.
- **`eslint-plugin-react-native`**: Provides `no-unused-styles` and `no-inline-styles` rules to catch common React Native performance and correctness issues.

## History

- **2026-02-15**: Created `no-quoted-color-references` after iOS build found 22 quoted color strings
- **2026-02-15**: Added `no-unsafe-native-call`, `no-console`, and `eslint-plugin-react-native` integration
