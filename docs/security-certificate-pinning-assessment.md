# Certificate Pinning Security Assessment

**Date**: 2026-02-20
**Scope**: AT Protocol API connections from ShadowSky iOS and web clients
**Decision**: Do not implement certificate pinning (see ADR in `docs/decisions/DECISIONS.md`)

## 1. Threat Model

### Attack Scenario

A compromised Certificate Authority (CA) or corporate MITM proxy issues a fraudulent certificate for Bluesky API domains, intercepting AT Protocol traffic including session tokens (`accessJwt`, `refreshJwt`).

### Threat Likelihood: Low

- Requires CA compromise or targeted proxy deployment
- iOS CA trust store is curated by Apple with regular audits
- Certificate Transparency (CT) logs provide public monitoring of issued certificates
- Major CA compromises are rare (DigiNotar 2011, Symantec 2015-2017 are notable exceptions)

### Impact if Exploited: Medium

- **Intercepted tokens are short-lived**: `accessJwt` expires quickly and `refreshJwt` enables token rotation
- **AT Protocol data is self-authenticating**: Signed repositories and DIDs provide integrity guarantees independent of transport security
- **No financial data exposed**: Unlike banking apps, the data in transit is social media content
- **DMs are the highest-value target**: `api.bsky.chat` traffic contains private messages

### Overall Risk: Low-Medium

The combination of low likelihood and medium impact with strong mitigating controls makes this an acceptable residual risk.

## 2. Domain Inventory

All domains the app connects to, discovered via codebase analysis:

### Authentication & Data (High Sensitivity)

| Domain                | Protocol | CA                  | Cert Lifetime | Data                         |
| --------------------- | -------- | ------------------- | ------------- | ---------------------------- |
| `bsky.social`         | HTTPS    | Amazon RSA 2048 M04 | ~13 months    | PDS: auth, repo data, XRPC   |
| Custom PDS (`pdsUrl`) | HTTPS    | Varies              | Varies        | User-configurable PDS server |

### API Services (Medium Sensitivity)

| Domain                | Protocol | CA                  | Cert Lifetime | Data                         |
| --------------------- | -------- | ------------------- | ------------- | ---------------------------- |
| `public.api.bsky.app` | HTTPS    | Let's Encrypt R12   | 90 days       | Public API (unauthenticated) |
| `api.bsky.chat`       | HTTPS    | Amazon RSA 2048 M03 | ~13 months    | Direct messages              |

### Media & Content (Low Sensitivity)

| Domain               | Protocol | CA                | Cert Lifetime | Data            |
| -------------------- | -------- | ----------------- | ------------- | --------------- |
| `cdn.bsky.app`       | HTTPS    | Let's Encrypt R13 | 90 days       | Images, avatars |
| `video.bsky.app`     | HTTPS    | Let's Encrypt R12 | 90 days       | Video content   |
| `video.cdn.bsky.app` | HTTPS    | Let's Encrypt     | 90 days       | Video CDN       |

### Real-time (Medium Sensitivity)

| Domain                            | Protocol | CA                | Cert Lifetime | Data            |
| --------------------------------- | -------- | ----------------- | ------------- | --------------- |
| `jetstream1.us-east.bsky.network` | WSS      | Let's Encrypt R13 | 90 days       | Firehose events |

### SPKI Hashes (Observed 2026-02-20)

**bsky.social chain (Amazon CA)**:

```
Leaf:         Va6hs2tSCkc4CWC91P6Bga2S05J/R2R+Tp4WPAv7Hlc=
Intermediate: G9LNNAql897egYsabashkzUCTEJkWBzgoEtk8X/678c=  (Amazon RSA 2048 M04)
Root:         ++MBgDH5WGvL9Bcn5Be30cRcL0f5O+NyoXuWtQdX1aI=  (Amazon Root CA 1)
```

**public.api.bsky.app chain (Let's Encrypt)**:

```
Leaf:         2y/0MlBacvvLW1cLbGhcosfFdtUMkrc12KtbYBLyr5Q=
Intermediate: kZwN96eHtZftBWrOZUsd6cA4es80n3NzSk/XtYz2EqQ=  (Let's Encrypt R12)
Root:         C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=  (ISRG Root X1)
```

> **Note**: These hashes are point-in-time snapshots. Let's Encrypt leaf certificates rotate every 90 days. Intermediate certificates (R10-R14) rotate periodically. Only the ISRG Root X1 hash is stable long-term.

## 3. Options Evaluated

### Option A: TrustKit with Leaf/Intermediate Pinning

**Rejected** — Would require:

- Tracking certificate rotation schedules for 6+ domains across 2 CAs
- Emergency app updates when Bluesky rotates certificates
- Separate pin sets per domain (no common CA across all services)
- Disabling pinning for custom PDS servers (breaking the security model)
- 90-day update cadence at minimum (Let's Encrypt domains)

### Option B: CA-Only Pinning (Pin ISRG Root X1 + Amazon Root CA 1)

**Rejected** — Less brittle than leaf pinning but still problematic:

- Bluesky could migrate services between CAs without notice
- Breaks custom PDS support (third-party servers use arbitrary CAs)
- Let's Encrypt cross-signs with multiple roots; pinning one may not cover all paths
- Provides marginal benefit: only defends against rogue CAs not named Amazon or ISRG

### Option C: No Pinning (Documented Decision) ✅

**Accepted** — Standard CA validation via iOS ATS provides sufficient protection:

- Works with all PDS servers (protocol compatibility)
- No maintenance burden from certificate rotation
- No risk of app-breaking outages from pin mismatches
- Aligned with industry best practices (Google, Cloudflare recommend against pinning)
- Aligned with official Bluesky app approach (no pinning implemented)

## 4. Existing Security Controls

### Transport Security

- [x] **ATS enforced**: `NSAllowsArbitraryLoads = false` in Info.plist
- [x] **TLS 1.2+ required**: iOS ATS minimum
- [x] **Local networking exception only**: `NSAllowsLocalNetworking = true` for development Metro bundler

### Token Security

- [x] **Secure storage**: Tokens stored via `expo-secure-store` (iOS Keychain)
- [x] **Short-lived access tokens**: `accessJwt` expires quickly
- [x] **Automatic token refresh**: `persistSession` callback in `AtProtoClient` handles rotation
- [x] **Session cleanup on expiry**: Expired sessions are cleared from secure storage

### Data Integrity

- [x] **Self-authenticating data**: AT Protocol signed repositories
- [x] **DID-based identity**: Cryptographic identity verification independent of TLS
- [x] **Trusted media domain allowlist**: `TRUSTED_MEDIA_DOMAINS` in `src/utils/security.ts`

### Application Security

- [x] **URL validation**: `isValidUrl()` blocks dangerous protocols
- [x] **HTML sanitization**: DOMPurify for user content
- [x] **Rate limiting**: AT Protocol endpoint rate limiter
- [x] **Secure link attributes**: `noopener noreferrer` on external links

## 5. Recommendations for Future Hardening

These are lower-priority improvements that could further strengthen transport security without the risks of certificate pinning:

1. **Certificate Transparency monitoring**: Set up alerts for new certificates issued for `*.bsky.social`, `*.bsky.app`, `*.bsky.chat`, `*.bsky.network` domains using CT log monitoring services (e.g., crt.sh, Facebook CT monitoring).

2. **Token binding (if AT Protocol adds support)**: Bind tokens to the TLS channel to prevent token export/replay across different TLS sessions.

3. **Mutual TLS for high-value endpoints**: If `api.bsky.chat` (DMs) ever supports mTLS, consider implementing client certificates for DM traffic specifically.

4. **Network security configuration audit**: Periodically verify ATS settings haven't been weakened by dependency updates or config plugins.

## 6. Review Schedule

This assessment should be re-evaluated:

- Annually (next review: 2027-02-20)
- When AT Protocol authentication model changes
- When Bluesky announces infrastructure certificate changes
- When Apple introduces new iOS transport security features
- If the official Bluesky app implements certificate pinning
