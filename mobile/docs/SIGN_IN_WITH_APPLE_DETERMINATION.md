# Sign in with Apple: Requirement Determination

## Determination: NOT REQUIRED

Sign in with Apple (SIWA) is **not required** for ShadowSky (Asphodel) to be
published on the Apple App Store. This analysis was conducted on 2026-02-20.

---

## Background

Apple App Store Review Guideline 4.8 requires apps that use third-party or social
login services (Facebook Login, Google Sign-In, Sign in with Twitter, etc.) to also
offer an equivalent privacy-focused login option. Sign in with Apple satisfies this
requirement, but it is not the only option.

### Guideline 4.8 (Login Services) — Exact Text

> Apps that use a third-party or social login service (such as Facebook Login,
> Google Sign-In, Sign in with Twitter, Sign In with LinkedIn, Login with Amazon,
> or WeChat Login) to set up or authenticate the user's primary account with the
> app must also offer as an equivalent option another login service with the
> following features [privacy protections].

### Exemptions Where an Alternative Login is NOT Required

1. Your app exclusively uses your company's own account setup and sign-in systems.
2. Your app is an alternative app marketplace.
3. Your app is an education, enterprise, or business app using existing accounts.
4. Your app uses a government or industry-backed identification system.
5. **Your app is a client for a specific third-party service and users are required
   to sign in to their mail, social media, or other third-party account directly to
   access their content.**

---

## Why ShadowSky Qualifies for Exemption

ShadowSky qualifies under **two** exemptions:

### Exemption 5: Client for a Specific Third-Party Service

ShadowSky is a client for Bluesky / the AT Protocol. Users sign in directly to
their Bluesky account (via AT Protocol OAuth or app password) to access their
social media content. The app does not create its own independent user accounts —
it authenticates against Bluesky's AT Protocol infrastructure.

This exemption was specifically designed for apps like email clients, social media
clients, and other apps where users sign in to an existing third-party service.

### Exemption 1: Own Account Setup and Sign-In Systems

AT Protocol OAuth and app password authentication are protocol-level
authentication mechanisms, not third-party social login services like Google or
Facebook. The AT Protocol auth flow is the app's own authentication system.

---

## Precedent

### Official Bluesky App

The official Bluesky Social app (https://apps.apple.com/us/app/bluesky-social/id6444370199)
uses only AT Protocol authentication (handle + password, OAuth) and does **not**
offer Sign in with Apple. It has been on the App Store since 2023.

Source code verification: The official Bluesky Social app repository
(github.com/bluesky-social/social-app) contains zero references to Apple
authentication, `expo-apple-authentication`, `ASAuthorization`, or any SIWA-related
code.

### Third-Party Bluesky Clients

Multiple third-party Bluesky clients are live on the App Store without SIWA:

- **Graysky** (https://apps.apple.com/us/app/graysky-a-bluesky-client/id6448234181)
- **Skeets** (https://www.skeetsapp.com/)
- **Flashes for Bluesky** (https://apps.apple.com/us/app/flashes-for-bluesky/id6741443033)

All use AT Protocol authentication exclusively.

---

## ShadowSky Auth Implementation

ShadowSky offers two authentication methods, both AT Protocol-based:

1. **AT Protocol OAuth** (recommended) — Redirects user to Bluesky to authorize
   access using PKCE, PAR, and authorization server discovery. Implemented in
   `mobile/src/services/auth/oauth.ts`.

2. **App Password** — User provides their Bluesky handle/email and an app-specific
   password. Required for DM access. Implemented in
   `mobile/src/services/auth/auth-service.ts`.

Neither method is a "third-party social login service" as defined by Guideline 4.8.
No Google, Facebook, Twitter, or other social login SDKs are integrated.

---

## Conclusion

| Question | Answer |
|----------|--------|
| Does ShadowSky use third-party social login? | No |
| Does ShadowSky use Google/Facebook/Twitter login? | No |
| Is ShadowSky a client for a specific third-party service? | Yes (Bluesky / AT Protocol) |
| Does the official Bluesky app use SIWA? | No |
| Do other Bluesky clients on the App Store use SIWA? | No |
| **Is SIWA required for ShadowSky?** | **No** |

If Apple's App Store Review team ever questions this, cite:
- Guideline 4.8, Exemption 5 (client for a specific third-party service)
- Precedent: Official Bluesky app + multiple third-party clients

---

## Future Considerations

If ShadowSky ever adds a proprietary account system or integrates third-party
social login services (Google Sign-In, Facebook Login, etc.) alongside AT Protocol
auth, this determination would need to be re-evaluated. As long as auth remains
exclusively AT Protocol-based, SIWA is not required.
