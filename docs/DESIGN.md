# Asphodel Design System

One design language across three UI stacks: web (Tailwind + CSS variables),
React Native (theme objects), and native SwiftUI modules. All color values
flow from a single source of truth — **never** hardcode a color.

## Source of truth

`packages/tokens/tokens.mjs` defines every palette. `npm run tokens:build`
(from the repo root) regenerates the checked-in consumer files:

| Consumer | Generated file |
| --- | --- |
| Web CSS variables (`--asph-*`) | `src/styles/generated-tokens.css` |
| React Native theme (`darkColors`/`lightColors`) | `mobile/src/constants/generated/tokens.ts` |
| SwiftUI (`DesignTokens` enum, per native module) | `mobile/modules/<module>/ios/Generated/DesignTokens.swift` |

CI fails if the generated files drift (`npm run tokens:check`, part of
`npm test`). When a new native module needs brand/semantic colors, add it to
`swiftModules` in `tokens.mjs`, rebuild, and run `pod install` in
`mobile/ios` so the new file joins the pod.

## Brand

| Role | Light | Dark |
| --- | --- | --- |
| Primary (Asphodel pink) | `#ff6b9d` | `#ff6b9d` |
| Primary dark / light | `#d63a71` / `#ff8fb5` | same |
| Accent (purple) | `#7c3aed` | `#a78bfa` |

Notification semantics are identical on every platform: like `#ef4444`,
repost `#10b981`, mention `#8b5cf6`, reply `#6366f1`, quote `#06b6d4`,
follow = primary.

The brand mark is the **butterfly-on-asphodel with stem**
(`public/butterfly-icon.svg`). The old round 6-petal flower is retired — do
not reintroduce it. Icon variants (light/mono/pride alternates, notification
silhouette) are generated from the recolor SVGs in
`mobile/assets/alternate-icons/*.svg` via `rsvg-convert`; copy outputs to
both `mobile/assets/alternate-icons/` and `mobile/ios/Asphodel/`.

## Rules

1. **No raw hex, no Tailwind grays** in web components. Use semantic
   utilities: `bg-asph-bg-{primary,secondary,tertiary,hover,active}`,
   `text-asph-text-{primary,secondary,tertiary,link}`,
   `border-asph-border-{primary,secondary,light}`, `bg-asph-{like,repost,…}`,
   `text-asph-{success,warning,error,info}`. Enforced by
   `scripts/check-design-tokens.mjs` (`npm run test:design`); justified
   exceptions go in `scripts/design-tokens-allowlist.txt`.
2. **Theme-stable surfaces stay literal**: media backdrops and on-video
   chrome use `bg-black` / `text-white/80`-style classes on purpose — they
   must not flip with the theme.
3. **React Native**: consume colors via `useTheme()` and
   `createStyles(colors)`; never import hex literals. White-on-brand text is
   `colors.textOnPrimary`; scrim text on photo overlays may also use it.
4. **SwiftUI**: brand/semantic colors come from the generated `DesignTokens`;
   adaptive neutrals stay on `UIColor.system*` (correct and automatic).
5. **Icons**: lucide-react on web, custom SVG set on RN (migrating to
   lucide-react-native), SF Symbols inside SwiftUI views.
6. Inline CSS in web components can reference tokens directly:
   `var(--asph-warning)`. Alpha tints over tokens use
   `color-mix(in srgb, var(--asph-…) 20%, transparent)` — string-concatenated
   `${color}20` does not work with `var()`.

## Where things live

- Web component classes (`.asph-button-*`, `.modal-*`, `.asph-card`, focus
  rings, springs): `src/styles/tailwind-components.css`
- Web non-color variables (focus rings, animation timing, loading states):
  `src/styles/asphodel-theme.css`
- Tailwind mapping of `asph-*` utilities → CSS variables: `tailwind.config.js`
- Mobile elevation/radius scale: `mobile/src/constants/elevation.ts`
- Mobile type scale (iOS Dynamic Type names): `mobile/src/utils/typography.ts`
