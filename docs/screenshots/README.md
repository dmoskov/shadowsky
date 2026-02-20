# App Store Screenshots

Screenshots for Apple App Store submission, generated at exact required dimensions.

## Device Sizes

| Directory    | Device            | Resolution |
| ------------ | ----------------- | ---------- |
| `6.7-inch/`  | iPhone 15 Pro Max | 1290x2796  |
| `6.5-inch/`  | iPhone 14 Plus    | 1284x2778  |
| `12.9-inch/` | iPad Pro 12.9"    | 2048x2732  |

## Screenshots (6 per device)

| File              | Screen                     |
| ----------------- | -------------------------- |
| `01-feed.png`     | Home feed with posts       |
| `02-thread.png`   | Thread / conversation view |
| `03-profile.png`  | User profile               |
| `04-search.png`   | Search / Discover          |
| `05-compose.png`  | Post composition           |
| `06-messages.png` | Direct messages            |

## Regenerating Screenshots

To regenerate screenshots (requires Playwright with Chromium):

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers node scripts/generate-appstore-screenshots.mjs
```

The generator script renders HTML mockups of each app screen using the actual Asphodel
design system (dark theme, pink/purple accents) and captures them at the exact pixel
dimensions required by the App Store.

## Updating with Live Content

For screenshots with real app content, run the app with test credentials and use:

```bash
node tests/playwright/capture-screenshots-playwright.mjs
```

See `docs/guides/manual-screenshot-guide.md` for manual capture instructions.
