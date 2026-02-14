# Internationalization (i18n) Setup

This app uses i18next with expo-localization for internationalization support.

## Structure

```
src/i18n/
├── index.ts           # i18n initialization and configuration
├── locales/
│   └── en.json        # English translations (default)
└── README.md          # This file
```

## Usage

### In Components

```tsx
import { useTranslation } from "../../hooks/useTranslation";

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t("common.hello")}</Text>
      <Text>{t("auth.sign_in_button")}</Text>
    </View>
  );
}
```

### With Interpolation

```tsx
// In locale file:
{
  "greeting": "Hello, {{name}}!"
}

// In component:
<Text>{t("greeting", { name: "User" })}</Text>
```

## Adding New Languages

1. Create a new locale file (e.g., `locales/es.json`)
2. Copy the structure from `locales/en.json`
3. Translate all strings
4. Import and register in `src/i18n/index.ts`:

```ts
import es from "./locales/es.json";

const resources = {
  en: { translation: en },
  es: { translation: es },
};
```

## Translation Keys

Translation keys are organized by feature/screen:

- `auth.*` - Authentication screens
- `compose.*` - Compose/post creation screens
- `settings.*` - Settings screens
- `home.*` - Home/timeline screens
- `notifications.*` - Notification screens
- `profile.*` - Profile screens
- `search.*` - Search screens
- `drafts.*` - Drafts screens
- `common.*` - Common UI elements and actions
- `errors.*` - Error messages

## Best Practices

1. **Always use translation keys** - Never hardcode user-facing strings
2. **Use descriptive keys** - `auth.sign_in_button` instead of `auth.btn1`
3. **Group by feature** - Keep related strings together under the same namespace
4. **Keep values short** - Long strings should be split into multiple keys if possible
5. **Test with missing keys** - i18next will show the key path if translation is missing

## Current Status

The following screens have been updated with i18n:
- ✅ Authentication screens (LandingScreen)
- ✅ Compose screen (partial - Alert messages)
- ✅ Settings screen (partial - headers)

### TODO: Complete extraction for remaining screens

The framework is in place, but many screens still have hardcoded strings. To complete the migration:

1. **High Priority** (user-visible strings):
   - Complete ComposeScreen - all UI text and placeholders
   - Complete SettingsScreen - all settings labels and descriptions
   - HomeScreen/TimelineScreen - feed UI text
   - NotificationsScreen - notification text
   - ProfileScreen - profile UI text
   - SearchScreen - search UI text

2. **Medium Priority**:
   - DraftsScreen
   - BookmarksScreen
   - MessagesScreen
   - Feed creation/discovery screens
   - Lists screens
   - Analytics screens

3. **Components** - many reusable components also need extraction:
   - PostCard
   - NotificationItem
   - ThreadComposer
   - EmptyState
   - ErrorState
   - Toast messages
   - Modals (AddToListModal, SaveToCollectionModal, etc.)

### How to Extract Strings

1. Search for hardcoded strings in a file:
   ```bash
   grep -n '"[^"]*"' src/screens/YourScreen.tsx
   ```

2. For each user-facing string:
   - Add it to the appropriate section in `locales/en.json`
   - Replace in code with `t("namespace.key")`

3. Import and use the translation hook:
   ```tsx
   import { useTranslation } from "../../hooks/useTranslation";
   const { t } = useTranslation();
   ```

## Testing

The app will automatically use the device's language if available, falling back to English.

To test different languages:
1. Add the language translations
2. Change device language in settings
3. Restart the app
