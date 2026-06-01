# Shared Logic Package — Migration Plan

**Goal:** Eliminate the ~30–40% business-logic duplication between the web app
(`src/`) and the mobile app (`mobile/`) by promoting a single platform-agnostic
package, consumed by both. Bug fixes and protocol changes land **once**.

**Status:** Phase 0 executed 2026-06-01 (web verified; mobile staged — needs a
Metro bundle to confirm). Package is named **`@bsky/core`** (the existing
web-internal `@bsky/shared` alias for `src/shared/` is folded into it in Phase 1).

> **Phase 0 — DONE (web verified, mobile staged)**
> - Created `packages/core` (`@bsky/core`): pure `formatCount`/`formatDate` +
>   `CORE_PACKAGE_VERSION`. Consumed as TypeScript source.
> - Root `package.json`: `"workspaces": ["packages/*"]`. Web consumes
>   `@bsky/core` via **plain workspace resolution — no Vite/TS alias needed.**
>   `src/pages/ProfilePage.types.ts` now re-exports `formatCount`/`formatDate`
>   from `@bsky/core`. Verified: `tsc` 0 errors, `vp build` ok, 1102 tests pass,
>   `test:format` ok (now also covers `packages/`).
> - **Mobile** consumes `@bsky/core` via a `file:../packages/core` dependency
>   (NOT npm-workspace hoisting) so its isolated `node_modules` and the delicate
>   `@atproto` Metro exports-shim stay intact. Added one **additive**
>   `watchFolders` entry in `mobile/metro.config.js` so Metro can follow the
>   symlink. Verified mobile **TypeScript** resolution of `@bsky/core`
>   (error count unchanged at the 5 pre-existing router/reanimated errors).
> - **REMAINING for you (not CLI-verifiable):** run `npm install --prefix mobile`
>   (done) then a Metro bundle / EAS dev build to confirm `@bsky/core` bundles on
>   device. Quick check: temporarily import `formatCount` from `@bsky/core` in a
>   screen, `npx expo start`, confirm no resolution error.

---

## 1. Current state (grounded)

- **Web** already has a seed shared module at `src/shared/` exposed via the
  `@bsky/shared` TS path alias (`tsconfig.json`) and Vite alias
  (`vite.config.ts:42`). It is ~971 LOC and already platform-agnostic:
  - `client.ts` (182) — `ATProtoClient`
  - `services.ts` (319) — `FeedService`, `ProfileService`, `ThreadService`,
    `InteractionsService`, `AnalyticsService` (+ `get*Service(agent)` factories)
  - `types.ts` (76), `errors.ts` (157), `utils.ts` (125), `debug.ts` (79),
    `query-client.ts` (21)
- **Mobile** imports `@bsky/shared` **0 times**. It re-implements the same
  surface in `mobile/src/services/atproto/` (12 files: `analytics`, `bookmarks`,
  `client`, `feeds`, `labelers`, `lists`, `notifications`, `post-editor`,
  `posts`, `profiles`, `starter-packs`) plus duplicated contexts
  (`AuthContext`, `ModerationContext`, `ThemeContext`, `ToastContext`) and
  utilities (`rich-text`, `error-reporting`, `logger`).
- **Root** `package.json` is `private: true` with **no `workspaces`** field.
- **Metro** (`mobile/metro.config.js`) has **no monorepo settings**
  (`watchFolders`/`nodeModulesPaths`/`disableHierarchicalLookup`) and a custom
  `@atproto` exports-resolution workaround that must be preserved.

### Prerequisites
- [x] **`@atproto/api` aligned** across apps to `^0.20.x` (done 2026-06-01).
      A shared package cannot compile against two different `@atproto/api`
      majors/minors. **Keep them in lockstep going forward.**
- [ ] Decide on `@tanstack/react-query` alignment (web 5.100 vs mobile 5.66) —
      required only if shared exports query hooks/`query-client`.

---

## 2. Target architecture

```
BSKY/
├── package.json            # root: "workspaces": ["packages/*", "mobile"]
├── packages/
│   └── shared/             # @bsky/shared — pure TS, NO DOM, NO RN, NO platform APIs
│       ├── package.json    # name "@bsky/shared", peerDeps: @atproto/api, (react?)
│       ├── tsconfig.json
│       └── src/
│           ├── atproto/    # FeedService, ProfileService, ThreadService, ...
│           ├── moderation/ # label/mute/block evaluation (pure)
│           ├── richtext/   # facet parsing
│           ├── types/      # AT Proto view-model types
│           ├── errors/     # error mapping/classes
│           └── utils/      # pure helpers (formatCount, dates, etc.)
├── src/                    # web app (unchanged location) → depends on @bsky/shared
└── mobile/                 # mobile app → depends on @bsky/shared
```

We keep the web app at the repo root (no risky relocation) and add only
`packages/shared` + `mobile` as workspace members.

### The hard boundary — what is shared vs platform-specific

**Shared (pure, no platform APIs):**
- AT Protocol services that take an injected `agent` (`BskyAgent`) — already the
  pattern in `src/shared/services.ts`.
- View-model types, error classes/mapping, rich-text facet parsing,
  moderation evaluation, pure formatting/date utils.

**NOT shared (stays per-app, behind interfaces):**
- **Storage**: web Dexie/IndexedDB/`idb-keyval` vs mobile MMKV/AsyncStorage.
- **Secure storage / crypto**: web WebCrypto vs mobile Keychain/SecureStore.
- **UI, navigation, routing**, anything touching `window`/`document` or RN
  native modules.
- **React contexts/hooks** (initially) — they bind to platform storage and to a
  specific React version (web 18 / mobile 19). Defer; share the *logic* the
  contexts call into, not the contexts themselves.

Platform bits are injected via small interfaces, e.g.:

```ts
// packages/shared/src/storage/types.ts
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}
// web provides a Dexie/idb-keyval impl; mobile provides an MMKV impl.
```

---

## 3. Tooling changes

1. **npm workspaces** (root `package.json`): `"workspaces": ["packages/*"]`.
   The web app (root package) consumes `@bsky/core` via the workspace symlink.
   **Mobile is intentionally NOT a workspace member** — see (3).

2. **Web** — no alias needed. Plain workspace resolution + the package's
   `exports`/`main` (`src/index.ts`) is enough for `tsc`, Vite, and vitest.
   (Verified in Phase 0.)

3. **Mobile / Metro** — use a `file:` dependency, NOT npm-workspace hoisting:
   - `mobile/package.json`: `"@bsky/core": "file:../packages/core"` →
     symlinked into `mobile/node_modules`, so mobile keeps its **isolated**
     `node_modules` and the existing `@atproto` exports-shim keeps working
     (it hardcodes `mobile/node_modules` paths — hoisting would break it).
   - `mobile/metro.config.js`: one **additive** line so Metro follows the
     symlink — do NOT touch `nodeModulesPaths`/`disableHierarchicalLookup`:
     ```js
     config.watchFolders = [
       ...(config.watchFolders ?? []),
       path.resolve(__dirname, "..", "packages"),
     ];
     ```
   - **Preserve** the existing `@atproto` exports-resolution workaround.
   - As `@bsky/core` grows to use `@atproto/api` (Phase 2), declare it a
     **peerDependency** of `@bsky/core` so it resolves from `mobile/node_modules`
     (and the version stays in lockstep with each app).

4. **TypeScript** — `packages/shared/tsconfig.json` with `composite: true`;
   both apps add a project reference. Keep `strict` on (both apps already use it).

5. **React/peer deps** — shared declares `@atproto/api` (and `react` only if it
   ever exports hooks) as **peerDependencies** so each app supplies its own —
   avoids the web-18 / mobile-19 conflict.

---

## 4. Phased rollout (each phase independently shippable & reversible)

**Phase 0 — Spike (½–1 day). Proves the toolchain before moving real code.**
- Add the workspace + `packages/shared` with one trivial pure export.
- Make web import it (verify `tsc` + `vp build`).
- Make mobile import it (verify `tsc` + a **Metro bundle**, and an EAS dev build).
- ✅ Gate: both apps bundle with a shared import. If Metro fights the @atproto
  resolver here, solve it now — not after migrating 1,000 lines.

**Phase 1 — Pure formatting (DONE, web-verified 2026-06-01).**
- `@bsky/core` now owns `formatCount`, `formatJoinDate` ("Month YYYY"), and
  `formatRelativeTime` ("5m"/"3h"/...). `src/shared/utils.ts` re-exports
  `formatCount` + `formatRelativeTime as formatDate` (preserves the @bsky/shared
  API). Web duplicates unified (`ProfileHoverCard`, `ProfilePage`). Resolved a
  real hazard: two different `formatDate` functions (month-year vs relative-time)
  shared one name. Verified: tsc 0, build, 1102 tests, format.
- NOT done: `TrendingColumn.formatCount` left as-is — it returns `null` for
  falsy counts (different contract). Mobile `formatCount` left as-is — it renders
  lowercase `1.5k` (a real inconsistency to unify when mobile adopts core).

**Phase 1b — remaining pure modules (findings before moving).**
- `src/shared/types.ts` domain types (`Notification`, `Post`, `Thread`,
  `FeedViewPost`, `Label`) are imported from `@bsky/shared` in **0 files** — the
  apps use `@atproto/api`'s own types. Likely dead; audit/delete rather than move.
- `src/shared/errors.ts` uses `navigator.onLine` (lines ~96, 117). The error
  *classes* are pure, but the helpers assume a browser; `navigator.onLine` is
  unreliable on RN. Split pure classes from the navigator-dependent helpers
  before sharing.
- `src/shared/utils.ts` still has `getStorageSize`/`clearOldData` (localStorage,
  web-only — keep out of core) and `withRateLimit`/`rateLimiters` (pure — movable).

**Phase 2 — AT Protocol services (highest dedup payoff). Needs interface design.**
Findings from inspecting `src/shared/`:
- `services.ts` (FeedService/ProfileService/ThreadService/Interactions/Analytics)
  is shareable — the factories take `ATProtoClient | BskyAgent`. BUT:
  - It's typed against `ATProtoClient` from `client.ts`, and **`client.ts` is
    web-coupled**: it imports `../utils/cookies` and persists the session via
    browser cookies. Mobile persists via `expo-secure-store`. So the *client*
    (session persistence) is platform-specific and must NOT move to core.
  - `services.ts` also imports `./debug` (a logger).
- **Design decision needed first:** give core a platform-neutral contract so the
  services don't depend on the web client. Options: (a) type the factories on a
  minimal `{ agent: BskyAgent }`/`BskyAgent` interface and keep each platform's
  client/session-persistence in its own app; (b) inject a `Logger` into core
  instead of importing web `debug`.
- Then move `services.ts` to core with `@atproto/api` as a peerDependency; each
  app keeps its own client and passes its agent in.
- Mobile: rewrite `mobile/src/services/atproto/*` to call shared services; delete
  the 12 duplicates one per PR. Gate per service: mobile `tsc` + Metro bundle +
  smoke test on a dev build.

**Phase 2 — web side DONE (2026-06-01), mobile side BLOCKED on a decision.**
- DONE (web-verified): `@bsky/core/atproto/services.ts` now hosts
  `FeedService`/`ProfileService`/`ThreadService`/`InteractionsService`/
  `AnalyticsService` + factories, decoupled from the web client via
  `AgentLike = BskyAgent | { agent: BskyAgent }`, with an injectable `logger`
  (`setLogger`, no-op default; web wires `debug`). `@atproto/api` is a
  peerDependency. `src/shared/services.ts` is now a re-export shim. Verified:
  core tsc 0, web tsc 0, build, 1102 tests, format.
- **BLOCKER — which implementation is canonical?** Mobile's
  `mobile/src/services/atproto/*` are **richer than web's**: standalone
  functions, ~13 methods each (searchActors, getFollowers/Follows/Mutes, …), and
  **every call wrapped in `rateLimited(fn, ATProtoEndpointType)`** (per-endpoint
  token-bucket + circuit breaker, `mobile/src/services/rate-limiter.ts`). Web's
  (now core's) are class-based, fewer methods, no rate limiting. Making mobile
  adopt core's current services would REGRESS it.
- **Decision needed before mobile adoption:** core's services must become the
  **superset** = mobile's method coverage + an **injectable call-wrapper** so
  rate-limiting is provided by each app (web: identity; mobile: its rateLimited).
  Recommended shape: keep the class + factory, add an optional
  `{ wrap?: <T>(fn: () => Promise<T>, kind: string) => Promise<T>, logger?: Logger }`
  config; default `wrap` = identity (no web behavior change). Then port mobile's
  extra methods, and have mobile pass its `rateLimited` as `wrap` and delete its
  duplicates. API-shape note: mobile uses standalone functions — either expose
  function wrappers from core too, or update mobile call sites to the class API.

**Phase 3 — Moderation + rich-text (pure logic).**
- Extract the label/mute/block evaluation and facet parsing into shared; both
  apps keep their own UI but call shared evaluators. Removes a notorious
  double-maintenance area (moderation rules must never diverge).

**Phase 4 — Platform-injected storage seam (optional, larger).**
- Define `KeyValueStore`/`SecureStore` interfaces in shared; web + mobile
  provide impls. Enables sharing higher-level services that persist data
  (bookmarks, drafts, preferences) without sharing the storage engine.

Stop after any phase — partial adoption is still net-positive.

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| **Metro can't resolve workspace pkg** alongside the @atproto hack | Phase 0 spike gates this before real migration. Keep the existing resolver shim. |
| **React 18 (web) vs 19 (mobile)** | Shared stays React-free initially; if hooks are shared later, `react` is a peerDep and only version-agnostic hook APIs are used. |
| **@atproto/api drift recurs** | Add a CI check asserting `@atproto/api` versions match across root + mobile + packages/shared. |
| **react-query version skew** | Align versions before sharing `query-client`/hooks (Phase 2+), or keep query wiring per-app. |
| **Big-bang regression** | Strictly incremental: one module/service per PR, both apps gated each step. Never delete a duplicate until its replacement is bundling on both platforms. |
| **iOS not CLI-verifiable** | Each mobile phase requires a local Metro bundle + EAS dev build + smoke test by a human; bake into the phase gate. |

---

## 6. Effort estimate

- Phase 0: ~½–1 day (toolchain spike).
- Phase 1: ~1 day.
- Phase 2: ~3–5 days (the bulk; one service at a time).
- Phase 3: ~2–3 days.
- Phase 4: ~3–5 days (optional).

~2–3 weeks part-time to reach Phase 3 (the high-value stopping point), after
which most AT Protocol + moderation logic is single-sourced.

---

## 7. Definition of done (Phase 3 target)

- `packages/shared` is the single source for AT Protocol services, types,
  errors, moderation evaluation, rich-text parsing, and pure utils.
- `mobile/src/services/atproto/*` duplicates are deleted.
- Both apps build, typecheck, and pass tests/bundles in CI.
- A CI guard prevents `@atproto/api` (and react-query, if shared) version drift.
