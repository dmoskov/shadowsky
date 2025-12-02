# Architecture Decision Records

This document tracks key technical decisions made during the development of the Bluesky client.

## Decision Log Format

```
# Decision: [Title]
Date: YYYY-MM-DD
Status: [Proposed|Accepted|Deprecated|Superseded]
Context: Why this decision was needed
Decision: What we decided to do
Consequences: What happens as a result
```

---

## Decision: Use React Query for State Management

Date: 2025-01-06
Status: Accepted
Context: Need efficient caching and synchronization for AT Protocol data
Decision: React Query (TanStack Query) over Redux/Zustand
Consequences:

- Simpler code with automatic cache management
- Built-in background refetching
- Optimistic updates are easier
- Less boilerplate than Redux

## Decision: CSS Modules Over CSS-in-JS

Date: 2025-01-06
Status: Accepted
Context: Need styling solution that's simple and performant
Decision: Use CSS files with design system variables
Consequences:

- Better performance (no runtime overhead)
- Easier to debug in DevTools
- Can migrate to CSS-in-JS later if needed
- PostCSS warnings about @import (minor issue)

## Decision: Singleton Pattern for AT Protocol Client

Date: 2025-01-06
Status: Accepted
Context: Need consistent API client instance across the app
Decision: Export singleton instance from services/atproto/client.ts
Consequences:

- Shared session state
- Consistent rate limiting
- Simpler dependency injection
- Potential testing challenges (need mocks)

## Decision: Dark Theme First

Date: 2025-01-06
Status: Accepted
Context: Building a modern client with good DX
Decision: Start with dark theme, add light theme later
Consequences:

- Better for long coding sessions
- Modern aesthetic
- Need to ensure sufficient contrast
- Light theme becomes additional work

## Decision: Git Hooks for Dev Server Management

Date: 2025-01-06
Status: Accepted
Context: Dev server needs to stay running during development
Decision: Use git hooks to restart server after commits
Consequences:

- More stable development experience
- Automatic recovery from crashes
- Additional setup complexity
- Platform-specific scripts needed

## Decision: Ephemeral + Persistent Documentation

Date: 2025-01-06
Status: Accepted
Context: Need both working notes and historical record
Decision: Three-tier system: SESSION_NOTES (working) → progress/ (history) → CLAUDE.md (truth)
Consequences:

- Clear separation of concerns
- Information flows from rough to refined
- Some duplication across tiers
- Better knowledge preservation

## Decision: Use Bluesky's Official Trending API for Trending Topics

Date: 2025-11-29
Status: Accepted
Context: The trending topics feature required a decision on data source. Options were:

1. Global ATProto firehose processing (build our own trending aggregation)
2. User's network only (trends from followed accounts)
3. Hybrid approach with both
4. Use existing Bluesky API endpoints

The firehose approach would require significant bandwidth, processing resources, and infrastructure to aggregate trending data across all of Bluesky.

Decision: Use Bluesky's existing public trending API endpoints instead of building custom firehose processing.

Available endpoints:

- `app.bsky.unspecced.getTrendingTopics` - Returns trending topics and suggested feeds
  - Public endpoint: `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrendingTopics`
  - Parameters: `limit` (1-25, default 10), `viewer` (DID for personalized ranking)
  - Returns: `topics` array and `suggested` array of trending topics

- `app.bsky.unspecced.getTrends` - Returns trending topics with post counts and key actors
  - Public endpoint: `https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends`
  - Includes: Post count, "hot" status, representative accounts for each trend

- `app.bsky.feed.searchPosts` - Search posts with various filters
  - Can be used to fetch posts for specific trending topics/hashtags

Note: These endpoints are in the `unspecced` namespace, indicating they may change without formal API stability guarantees. However, they are actively used by the official Bluesky client.

Consequences:

- Significantly reduced implementation complexity (no firehose processing needed)
- No additional infrastructure or storage requirements
- Real-time trending data maintained by Bluesky
- Consistent with official Bluesky client experience
- Dependent on Bluesky's API availability and rate limits
- May be subject to API changes (unspecced namespace)
- Can still add personalized trending from user's network as enhancement later

References:

- User decision: "Try to find an available api resource for this rather than creating our own source"
- GitHub Discussion: https://github.com/bluesky-social/atproto/discussions/3822
- Lexicon: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/unspecced/getTrendingTopics.json

## Decision: ML/AI Infrastructure External to This Repository

Date: 2025-12-01
Status: Accepted
Context: Multiple features require ML/AI capabilities including content recommendations, trending detection, and AI-powered content safety detection. This foundational architectural decision affects cost, performance, privacy, and technical complexity.

Options evaluated:

1. **Managed ML Services (OpenAI, Anthropic, Cohere)**: Quick implementation, high quality, no infrastructure management, but ongoing API costs ($0.50-2.00 per 1000 users/day), data sent to third parties, vendor lock-in

2. **Self-hosted Open Models (Llama, Mistral, local embeddings)**: Full data privacy, no per-request costs, no rate limits, but requires GPU infrastructure ($500-2000/month), ML expertise needed, maintenance burden

3. **Hybrid Approach**: Use managed services for complex tasks (moderation), self-host for high-volume (embeddings), but most complex to implement with two systems to maintain

Decision: ML/AI infrastructure is being developed in a separate repository. This client repository should not implement its own ML/AI infrastructure.

Rationale: Keeping ML/AI infrastructure separate from the client codebase provides:

- Clear separation of concerns between UI/client code and ML backend services
- Ability to scale and deploy ML services independently
- Shared ML services across multiple client applications
- Specialized team/tooling for ML development
- Easier cost management and monitoring

Consequences:

- Features requiring ML/AI capabilities are blocked on external ML infrastructure development
- Client will consume ML services via API once available
- No ML/AI dependencies, models, or inference code should be added to this repository
- Features blocked on ML infrastructure should be deprioritized or marked as external dependency

Blocked Features:

- Design and implement personalized content recommendation algorithm
- Build topic-based content discovery with semantic search
- Implement trending content detection and discovery feed
- Implement AI-powered content safety detection

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212226673284433
- Decision made by: Dustin Moskovitz (2025-12-01)

## Decision: Follow AT Protocol Community Best Practices for Content Moderation

Date: 2025-12-01
Status: Accepted
Context: AT Protocol enables federation, but content moderation across federated instances requires clear policies. The moderation model affects user safety, instance autonomy, and legal liability. Options evaluated:

1. **Instance-Level Moderation**: Maximum instance autonomy, aligns with federation philosophy, but inconsistent safety standards and difficult cross-instance harassment handling

2. **Shared Moderation Layer**: Consistent baseline safety, shared blocklists reduce duplicate work, but reduces instance autonomy and governance control questions

3. **User-Controlled Moderation**: Maximum user agency, moderation as a service marketplace, but complex UX and vulnerable users may choose poorly

4. **Hybrid (Baseline + Instance + User layers)**: Balances safety and autonomy with three-tier approach, but most complex to implement

Decision: Follow the AT Protocol community's established "stackable moderation" approach, as implemented by Bluesky with the Ozone moderation service.

### Stackable Moderation Architecture

The AT Protocol community has established a layered moderation architecture with three core components:

1. **Labelers (Moderation Services)**
   - Dedicated services that produce labels for user-generated content
   - Labels are metadata attached to posts, accounts, lists, or feeds
   - Services publish an `app.bsky.labeler.service` record declaring their policies
   - Users subscribe to labelers via the `atproto-accept-labelers` header (max 20)
   - Can be automated (AI/ML-based) or human-reviewed

2. **Label System**
   - Global labels defined by protocol: `!hide`, `!warn`, `!no-unauthenticated`, `porn`, `sexual`, `graphic-media`, `nudity`
   - Custom labels defined per labeler namespace with severity levels, blur effects, and default settings
   - Labels synced to AppViews and interpreted by clients based on user preferences

3. **User Controls**
   - Users configure per-label preferences: hide, warn, or ignore
   - Users subscribe to additional community labelers beyond built-in moderation
   - Mutes and blocks as personal controls

### Implementation Approach

For ShadowSky, we will implement:

1. **Built-in Moderation Layer**: Subscribe to Bluesky's official moderation labeler as the baseline
2. **Community Labeler Support**: Allow users to discover and subscribe to community labelers
3. **User Preference Controls**: Per-label settings (hide/warn/ignore) for each subscribed labeler
4. **Ozone Integration**: Support the `tools.ozone.*` API namespace for moderation actions

### Key Principles

- **Separation of roles**: Moderation services operate independently from hosting and identity
- **Distributed operation**: Multiple organizations can provide moderation services
- **Interoperation**: Users select preferred clients and moderation services without losing community access
- **Sensible defaults with customization**: Provide baseline safety while empowering user choice

Consequences:

- Aligns with AT Protocol ecosystem and community best practices
- Leverages existing Ozone infrastructure and labeler ecosystem
- Enables community-driven moderation without building custom infrastructure
- Users can customize their moderation experience with layered labelers
- Dependent on labeler service availability and label definitions
- Requires implementing label interpretation and user preference UI

### Technical Implementation Notes

- Use `@atproto/api` moderation utilities (see node_modules/@atproto/api/docs/moderation.md)
- Subscribe to labelers via HTTP header: `atproto-accept-labelers`
- Labels follow pattern `^[a-z-]+$` with attributes: `blurs`, `severity`, `defaultSetting`
- AppView returns labels attached to content; client interprets based on user prefs

References:

- Bluesky Moderation Architecture: https://docs.bsky.app/blog/blueskys-moderation-architecture
- Stackable Moderation Blog: https://bsky.social/about/blog/03-12-2024-stackable-moderation
- Moderation Documentation: https://docs.bsky.app/docs/advanced-guides/moderation
- Ozone GitHub: https://github.com/bluesky-social/ozone
- Asana Task: https://app.asana.com/0/1211710875848660/1212226681541081
- Decision made by: Dustin Moskovitz (2025-12-01) - "Please do what the best practice is from the community"

## Decision: JWT Token Storage Security Architecture

Date: 2025-12-01
Status: Accepted
Context: A security task requested migrating JWT tokens from localStorage to httpOnly cookies to prevent XSS attacks. After thorough analysis, we determined this is architecturally infeasible for this application.

### Why httpOnly Cookies Cannot Be Implemented

**Core Constraint**: httpOnly cookies can ONLY be set by a server via `Set-Cookie` HTTP response headers - they cannot be set by JavaScript.

**AT Protocol Authentication Flow**:

1. User authenticates directly with Bluesky servers (`bsky.social`)
2. Bluesky returns JWT tokens (`accessJwt`, `refreshJwt`) in API response body
3. Client stores tokens and includes them in subsequent requests
4. There is no middleware server that receives these tokens and could set httpOnly cookies

**This Application's Architecture**:

- **OAuth**: Uses `@atproto/oauth-client-browser` which handles token storage internally
- **App Password**: Client receives tokens directly from Bluesky's API
- **Express Server** (`server/api-server.js`): Handles AI features, image processing, WebSocket notifications - but NOT authentication proxying

**What Would Be Required**:
To implement httpOnly cookies, we would need to:

1. Build a server-side authentication proxy
2. Route ALL AT Protocol API requests through our server
3. Server receives Bluesky tokens, stores them server-side, sets httpOnly cookies
4. Client never sees raw JWT tokens
5. This fundamentally changes the application architecture and adds significant latency

This would require substantial infrastructure changes and goes against AT Protocol's design philosophy of direct client-to-service communication.

### Implemented Security Measures (Alternative Approach)

Since httpOnly cookies are not feasible, we implemented defense-in-depth measures:

1. **Cookie Security Attributes**
   - `Secure`: Cookies only sent over HTTPS (already implemented in production)
   - `SameSite=Strict`: Prevents CSRF attacks by not sending cookies with cross-origin requests
   - Proper domain scoping for cross-subdomain access

2. **XSS Prevention**
   - Content Security Policy (CSP) headers via Vite config
   - Input sanitization with DOMPurify for user-generated content
   - React's built-in XSS protection for JSX rendering

3. **Token Lifecycle Management**
   - Session expiration handling
   - Automatic token refresh via AT Protocol SDK
   - Proper logout cleanup clearing both cookies and localStorage

4. **OAuth Preference**
   - OAuth is the recommended authentication method
   - OAuth tokens are managed by `@atproto/oauth-client-browser` with its own security model
   - App passwords are legacy but still supported

### Security Trade-offs

| Attack Vector        | httpOnly Cookies          | Current Implementation          |
| -------------------- | ------------------------- | ------------------------------- |
| XSS Token Theft      | Fully Protected           | Mitigated via CSP, sanitization |
| CSRF                 | Requires separate token   | Protected via SameSite=Strict   |
| Network Interception | Protected via Secure flag | Protected via Secure flag       |
| Direct JS Access     | Fully Protected           | Accessible but defended         |

### Recommendations for Future

If stronger token protection is required:

1. Consider building an authentication proxy service
2. Implement a BFF (Backend-for-Frontend) pattern
3. This would be a major architectural change

Consequences:

- Cannot fully prevent XSS-based token theft without server-side auth proxy
- Defense-in-depth approach provides reasonable security for a client-side app
- Aligned with how other AT Protocol clients handle authentication
- No additional infrastructure complexity

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212226671473005
- OWASP Token Storage: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html
- AT Protocol OAuth: https://docs.bsky.app/docs/advanced-guides/oauth-client

## Decision: Skip Advanced Trending Detection and Discovery Feed

Date: 2025-12-01
Status: Accepted
Context: Task requested implementing a real-time trending detection system with:

- Velocity-based trending algorithm (engagement rate over time)
- Breakout detection for emerging content (sudden spikes)
- Discovery feed UI with trending, viral, and breaking sections
- Trending hashtags and topics widgets
- Spam and manipulation detection for trending system

This would require significant ML/AI infrastructure for real-time engagement analysis, velocity calculations, spam detection, and breakout pattern recognition.

Decision: Skip implementation of advanced trending detection and discovery feed.

Rationale:

1. **ML Infrastructure Dependency**: As documented in "ML/AI Infrastructure External to This Repository" decision, features requiring ML/AI capabilities are blocked on external infrastructure development. Advanced trending detection with velocity algorithms and spam detection falls squarely into this category.

2. **Basic Trending Already Available**: The project already has `src/services/trending-service.ts` which wraps Bluesky's public trending API endpoints:
   - `app.bsky.unspecced.getTrendingTopics` - Returns trending topics
   - `app.bsky.unspecced.getTrends` - Returns trends with post counts and key actors

   This provides basic trending functionality without requiring custom infrastructure.

3. **Scope vs. Value**: Building custom trending detection would duplicate functionality Bluesky already provides while adding significant complexity. The ROI doesn't justify the effort.

Consequences:

- Basic trending display can still be implemented using existing `trending-service.ts`
- Advanced features (velocity indicators, breakout detection, manipulation prevention) are deferred
- Discovery feed with custom viral/breaking sections is not implemented
- Users can still see Bluesky's curated trending content

Future Considerations:

- If ML infrastructure becomes available, trending detection could be revisited
- Could enhance existing trending display with additional UI polish
- May integrate with Bluesky's official trending features as they evolve

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212226673257978
- Related Decision: "ML/AI Infrastructure External to This Repository"
- Existing Service: `src/services/trending-service.ts`
- Decision made by: Dustin Moskovitz (2025-12-01) - "Let's skip this for now"

## Decision: Skip Long-Form Content Editor

Date: 2025-12-01
Status: Accepted
Context: Task requested building a dedicated long-form content editor with:

- Rich text editor (headings, lists, quotes)
- Image embedding with captions
- Code blocks with syntax highlighting
- Auto-generated table of contents
- Draft autosave and version history
- Reading view optimized for long-form content

This feature is not technically feasible within AT Protocol constraints.

Decision: Skip implementation of long-form content editor due to fundamental AT Protocol limitations.

### Technical Analysis

**AT Protocol Post Constraints:**

- Posts are limited to **300 graphemes** (characters) maximum
- This is a hard protocol limit defined in the `app.bsky.feed.post` lexicon
- Not a client-side restriction that can be worked around

**Rich Text Limitations:**

- AT Protocol supports "facets" for text formatting, limited to:
  - Mentions (@user)
  - Links (URLs)
  - Hashtags (#topic)
- No protocol support for: headings, lists, quotes, tables, code blocks, or other rich text elements
- No markdown rendering at the protocol level

**Image Handling:**

- Images embedded as blobs, not inline with text
- Maximum 4 images per post
- No caption system beyond alt text
- Cannot intersperse text and images for article layout

**What Would Be Required:**

To implement true long-form content, we would need:

1. External hosting for articles (outside AT Protocol)
2. Link-only posts pointing to external content
3. This defeats the purpose of decentralized, AT Protocol-native content

### Alternative Approaches Considered

1. **Thread composition**: Chain multiple 300-character posts together
   - Already supported via "threaded conversation view" feature
   - Not true long-form, but provides extended content capability

2. **External blog integration**: Link to external platforms
   - Breaks decentralization philosophy
   - Content not stored on user's PDS

3. **Wait for protocol evolution**: AT Protocol may add long-form support in future
   - No current roadmap for long-form content
   - Could revisit if protocol evolves

### Workaround Available

Users wanting longer content can use the threaded conversation feature to compose multi-post threads, which is already implemented in the codebase (see recent commit: "Implement threaded conversation view and tools").

Consequences:

- Long-form content creation not supported in ShadowSky
- Users directed to use threaded posts for extended content
- Feature may be revisited if AT Protocol adds long-form support
- Keeps client aligned with protocol capabilities

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212226671492959
- AT Protocol Post Lexicon: https://github.com/bluesky-social/atproto/blob/main/lexicons/app/bsky/feed/post.json
- Facets Documentation: https://docs.bsky.app/docs/advanced-guides/post-richtext
- Decision made by: Dustin Moskovitz (2025-12-01) - "Let's skip this for now. Not supported by atproto."

## Decision: Use Session-Derived Key Encryption for Local Storage

Date: 2025-12-01
Status: Accepted
Context: The "Add Encryption Layer for Sensitive localStorage/IndexedDB Data" task requires encrypting auth tokens and sensitive data at rest. A security question arose about the acceptable security model, since if the encryption key is derived from the session and the session is compromised via XSS, an attacker could theoretically use the same key derivation to decrypt stored data.

### Options Evaluated

**Option A: Encrypt with session-derived key (as proposed)**

- Protects against offline attacks (malware reading browser storage directly)
- Protects against malicious browser extensions reading storage
- Protects against physical device access
- Does NOT protect against active XSS (attacker can use same key derivation while session is active)
- Still provides valuable defense-in-depth

**Option B: Migrate to httpOnly cookies for auth**

- Auth tokens completely inaccessible to JavaScript (immune to XSS token theft)
- Requires backend proxy for all AT Protocol API calls
- Significant architectural change (documented in "JWT Token Storage Security Architecture" decision above)
- Does not address encryption of other sensitive data in localStorage/IndexedDB

**Option C: Web Crypto with user PIN**

- Additional factor required for decryption
- Better protection even during active XSS
- Inconvenient UX requiring PIN prompt on session start
- Could be appropriate for highly sensitive data like DMs

### Decision

Proceed with **Option A: Session-derived key encryption**.

### Rationale

1. **Threat Model Coverage**: The primary threats for client-side storage are:
   - Offline attacks (malware, device theft) - PROTECTED by encryption
   - Malicious browser extensions - PROTECTED by encryption
   - Active XSS attacks - NOT protected (but mitigated by CSP, sanitization)

   Two out of three primary threat vectors are addressed.

2. **Defense in Depth**: Even though active XSS could bypass this protection, it:
   - Raises the bar for attackers (requires active code execution, not just storage read)
   - Protects data after session ends (attacker needs session to derive key)
   - Aligns with security best practice of layered defenses

3. **Architectural Simplicity**: Can be implemented without server-side changes or architectural modifications. Works within the existing client-side AT Protocol authentication model.

4. **Practical Reality**: Active XSS is already a severe compromise. If an attacker has XSS, they can likely do more damage than just reading stored tokens (e.g., perform actions as the user, exfiltrate data in real-time).

### Implementation Notes

- Use Web Crypto API for encryption (AES-GCM recommended)
- Derive encryption key from session data using PBKDF2 or similar KDF
- Encrypt auth tokens, drafts, and other sensitive data before storage
- Decrypt on read when session is active
- Clear plaintext data when session ends

### Trade-offs Acknowledged

- Does not provide protection against active XSS with session access
- Adds computational overhead for encryption/decryption operations
- Requires session to be active to access encrypted data
- More complex than plaintext storage

Consequences:

- Sensitive localStorage/IndexedDB data will be encrypted at rest
- Protection against offline attacks and malicious extensions
- No protection against active XSS (accepted limitation)
- Implementation can proceed without architectural changes

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212247681635452
- Related Task: "Add Encryption Layer for Sensitive localStorage/IndexedDB Data"
- Related Decision: "JWT Token Storage Security Architecture" (above)
- Decision made by: Dustin Moskovitz (2025-12-01) - "Option A"

## Decision: Backend Infrastructure Architecture for Push Notifications and Analytics

Date: 2025-12-01
Status: Accepted
Context: Multiple P0/P1 tasks assume backend infrastructure that may not exist. A clarification was needed on whether the BSKY project has a backend server or is purely client-side, and if so, what capabilities it provides.

### Clarification Received

User clarification: "yes there is an existing partial backend for things like image processing and doing ai analytics run with vite"

### Backend Infrastructure Analysis

After investigating the codebase, the project has **two complementary backend systems**:

#### 1. AWS Amplify Backend (Production Cloud Infrastructure)

Location: `amplify/` directory

**Components:**

- **Authentication**: Cognito-based auth (`amplify/auth/resource.ts`)
- **Data Storage**: DynamoDB tables via Amplify Data (`amplify/data/resource.ts`)
- **REST API**: API Gateway with Lambda integrations (`amplify/backend.ts`)
- **Lambda Functions**: 7 AI-powered serverless functions:
  - `writing-feedback` - Writing analysis and suggestions
  - `generate-alt-text` - AI image alt-text generation (with DynamoDB caching)
  - `adjust-tone` - Tone adjustment for posts
  - `optimize-thread` - Thread optimization
  - `suggest-hashtags` - AI hashtag suggestions
  - `style-analysis` - Writing style analysis
  - `analyze-posts` - Post analytics with engagement patterns

**Features:**

- Rate limiting per user (via Cognito authentication)
- CloudWatch monitoring dashboard for Anthropic API usage
- KMS encryption for CloudWatch logs
- Alt-text caching with 90-day TTL in DynamoDB
- CORS configured for production domains

**API Endpoints (Production):**

- `POST /api/writing-feedback`
- `POST /api/generate-alt-text`
- `POST /api/adjust-tone`
- `POST /api/optimize-thread`
- `POST /api/suggest-hashtags`
- `POST /api/style-analysis`
- `POST /api/analyze-posts`

#### 2. Local Development Server (Express + Node.js)

Location: `server/` directory

**Components:**

- `api-server.js` - Express API server (port 3002)
- `websocket-server.js` - WebSocket notification server (port 3001)

**API Server Features:**

- Image proxy for CORS bypass (`/api/proxy-image`)
- GIF to MP4 conversion via FFmpeg (`/api/convert-gif`)
- Local versions of AI endpoints (mirroring Amplify functions)

**WebSocket Server Features:**

- Real-time notification delivery
- JWT authentication via query parameter
- User connection management
- AT Protocol integration for notification polling
- Heartbeat/ping-pong keep-alive mechanism

### Implications for Push Notifications and Analytics

**Push Notifications:**

- WebSocket infrastructure exists for **real-time in-app notifications**
- True Web Push (background notifications when app is closed) would require:
  - VAPID key configuration
  - Push subscription endpoint storage
  - Server-side push delivery via web-push library
- The existing WebSocket server could be extended, OR
- A new Lambda function could handle push delivery

**Analytics:**

- `analyze-posts` Lambda already provides post analytics with:
  - Content themes analysis
  - Writing style characterization
  - Engagement pattern analysis
  - Optimal posting time calculations
- Creator Analytics Dashboard would consume this existing endpoint
- May need additional endpoints for:
  - Historical analytics storage
  - Follower growth tracking
  - Comparison metrics

**Saved Searches with Notifications:**

- Could store search configurations in DynamoDB
- Use polling or event-driven architecture to check for new matches
- Deliver via existing WebSocket or new push mechanism

### Decision

The existing backend infrastructure is **sufficient for implementing** the blocked features with extensions:

1. **Push Notifications**: Extend Amplify backend with VAPID keys and push endpoint
2. **Creator Analytics**: Use existing `analyze-posts` + add historical storage
3. **Saved Searches**: Add DynamoDB table + polling Lambda + notification delivery

No need for:

- New backend framework
- Third-party BaaS (Firebase, Supabase)
- Major architectural changes

Consequences:

- Features can be unblocked and prioritized
- Implementation stays within AWS Amplify ecosystem
- Consistent infrastructure patterns across features
- Additional Lambda functions and DynamoDB tables as needed
- WebSocket server may need push notification extensions

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212247710609366
- Amplify Backend: `amplify/backend.ts`
- Local Server: `server/api-server.js`
- WebSocket Server: `server/websocket-server.js`
- Decision made by: Dustin Moskovitz (2025-12-01)

## Decision: Strictly Local Privacy Model for User Engagement Data

Date: 2025-12-01
Status: Accepted
Context: Several features require user engagement data for personalization, including:

- Personalized "For You" feed with engagement-based ranking
- User engagement signal tracking infrastructure
- Smart notification filtering and priority

Three privacy models were considered for handling this engagement data:

**Option A: Strictly local (IndexedDB only)**

- Engagement data never leaves device
- Personalization limited to single device
- Maximum privacy, no sync between devices

**Option B: Optional cloud sync with encryption**

- Local by default, opt-in cloud backup
- End-to-end encrypted if synced
- Cross-device personalization for users who opt in

**Option C: Server-side with consent**

- Traditional approach with GDPR consent flows
- Better analytics capabilities
- Less privacy-focused

Decision: **Option A - Strictly Local (IndexedDB only)**

User engagement data will be stored exclusively in IndexedDB on the user's device. This data will never be transmitted to any server.

### Implementation Requirements

1. **Storage**: Use IndexedDB for all engagement tracking data
   - Track metrics like: time spent on posts, likes, reposts, clicks, follows
   - Store engagement history for feed ranking algorithm
   - Maintain notification interaction patterns for smart filtering

2. **No Network Transmission**: Engagement data must never be:
   - Synced to AT Protocol PDS
   - Sent to any analytics service
   - Uploaded to cloud storage
   - Shared with third parties

3. **Single Device Limitation**: Users should understand that:
   - Personalization is device-specific
   - Switching devices means starting fresh
   - No cross-device continuity for recommendations

4. **Data Lifecycle**:
   - User can clear engagement data via settings
   - Data remains on device until explicitly cleared
   - Browser storage limits apply (typically 50MB+ for IndexedDB)

### Trade-offs Accepted

| Aspect                | Consequence                                        |
| --------------------- | -------------------------------------------------- |
| Cross-device sync     | Not supported - personalization is per-device only |
| New device experience | Cold start - no historical preferences             |
| Data portability      | Export feature could be added for manual transfer  |
| Analytics             | No aggregated usage insights available             |
| Privacy               | Maximum privacy - data never leaves device         |

### Architectural Implications

- **Storage Architecture**: IndexedDB-only for engagement data, separate from AT Protocol sync
- **Sync Complexity**: None - significantly simpler implementation
- **User Trust**: Strong privacy positioning as a differentiator
- **Future Flexibility**: Could add opt-in sync later without breaking existing users

Consequences:

- Maximum privacy protection for user behavior data
- Simpler implementation without sync infrastructure
- No cross-device personalization (intentional trade-off)
- Aligns with privacy-first product positioning
- Unblocks engagement tracking and personalized feed features

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212217443343328
- Decision made by: Dustin Moskovitz (2025-12-01) - "option a"

### Blocked Tasks Now Unblocked

The following tasks can now proceed with implementation using IndexedDB-only storage:

1. **Implement Personalized 'For You' Feed with Engagement-Based Ranking**
2. **Build User Engagement Signal Tracking Infrastructure**
3. **Implement Smart Notification Filtering and Priority**

## Decision: Self-Hosted Analytics Only (No Google Analytics)

Date: 2025-12-01
Status: Accepted
Context: The project needed to decide on an analytics implementation strategy for GDPR/CCPA compliance. A clarification task was raised questioning whether Google Analytics is the right choice for a privacy-focused Bluesky client.

### Options Evaluated

**Option A: Keep Google Analytics with proper consent**

- Implement GDPR/CCPA consent banner as originally planned
- Familiar tooling, robust dashboards, and established workflows
- Requires consent management for non-essential cookies
- Still sends user data to Google when users consent
- Potential conflict with Bluesky's privacy-focused ethos

**Option B: Replace with privacy-focused analytics (Plausible/Fathom/Umami as SaaS)**

- No cookies by default, GDPR-compliant without explicit consent
- May not require consent banner at all with cookieless tracking
- Less detailed user-level data than GA
- Third-party service dependency (though privacy-respecting)
- Monthly SaaS costs

**Option C: Self-hosted analytics only**

- Complete privacy with no third-party data sharing
- Full control over data collection, retention, and deletion
- Maximum alignment with Bluesky's decentralized philosophy
- Requires hosting infrastructure setup and maintenance
- No ongoing SaaS costs beyond hosting

### Decision

Proceed with **Option C: Self-hosted analytics only**.

### Rationale

1. **Privacy Alignment**: ShadowSky is a Bluesky client built on AT Protocol's decentralized philosophy. Sending user behavior data to Google contradicts this fundamental principle.

2. **User Trust**: Privacy-conscious Bluesky users chose a decentralized platform for a reason. Self-hosted analytics respects their choice and builds trust.

3. **Regulatory Simplicity**: Self-hosted, cookieless analytics may not require a consent banner at all under GDPR/CCPA, simplifying compliance.

4. **Data Ownership**: All analytics data stays within project-controlled infrastructure. No third-party access, no data sharing agreements needed.

5. **Cost Control**: While requiring initial infrastructure setup, eliminates ongoing SaaS subscription costs and per-user pricing tiers.

### Recommended Implementation

**Umami** is recommended as the self-hosted analytics platform:

- Open source (MIT license)
- Privacy-focused by design
- Cookieless tracking (compliant without consent banner)
- Simple self-hosting (Docker, Node.js)
- Dashboard provides essential metrics without excessive tracking
- Lightweight script (~2KB)

Alternative self-hosted options:

- **Plausible CE** (community edition, self-hosted)
- **Matomo** (more feature-rich, heavier)

### Infrastructure Requirements

1. **Hosting**: Docker container or Node.js service
2. **Database**: PostgreSQL or MySQL (can share with existing infrastructure)
3. **Domain**: Analytics subdomain (e.g., `analytics.shadowsky.io`)
4. **Resources**: Minimal - handles thousands of daily users on basic VPS

### Implementation Implications

1. **Consent Banner**: May be simplified or eliminated entirely
   - If using cookieless tracking, no consent required for analytics
   - Only needed if other features require consent (e.g., optional personalization cookies)

2. **Original Task Update**: The "Implement Analytics Consent Banner for GDPR/CCPA Compliance" task should be revised to:
   - Focus on self-hosted analytics infrastructure setup
   - Implement minimal/no consent UI (depending on cookieless implementation)
   - Remove Google Analytics integration requirements

3. **Data Collection**: Limited to essential, anonymous metrics:
   - Page views and navigation patterns
   - Referral sources
   - Device/browser types (anonymized)
   - No personal identifiers, no cross-site tracking

Consequences:

- No Google Analytics integration in the codebase
- Self-hosted analytics infrastructure required before feature launch
- Consent banner complexity significantly reduced or eliminated
- Maximum user privacy preserved
- Full data sovereignty maintained
- Aligned with Bluesky ecosystem values

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212218049373916
- Umami: https://umami.is/
- Plausible CE: https://plausible.io/self-hosted-web-analytics
- Decision made by: Dustin Moskovitz (2025-12-01) - "let's do self hosted"

## Decision: Thread Haiku Summary Complexity Threshold and Trigger

Date: 2025-12-02
Status: Accepted
Context: The thread complexity detection hook uses a configurable threshold for showing AI-generated haiku summaries. This decision defines:

1. What post count threshold triggers summary generation
2. When the summary generation should be triggered (UI interaction context)

### Options Evaluated for Threshold

1. **5 posts (current proposal)** - Low barrier, more summaries generated, higher API costs
2. **10 posts** - More conservative, summaries only for moderately complex threads
3. **Dynamic threshold** - Based on depth + branch count, not just post count (e.g., 5 posts OR depth > 3)
4. **User configurable** - Let users set their own threshold in settings

### Decision

**Option 1: 5-post threshold**, with an important constraint: **summaries are only generated when the ThreadViewer is explicitly opened**, not on hover/preview.

### Rationale

1. **5-post threshold** provides value early without being too noisy
2. **Explicit open trigger** prevents unnecessary API calls from:
   - Hover previews
   - Accidental mouse-overs
   - Rapid thread navigation
3. **Cost control** through user intent - summary only generated when user commits to viewing the thread
4. **UX clarity** - user action triggers visible summary, creating clear cause-effect relationship

### Implementation Requirements

**ThreadHaikuSummary Component:**
- Trigger summary generation only when `ThreadViewer` component is mounted/opened
- Do NOT trigger on:
  - Thread preview hover cards
  - Post hover states
  - Thread list item rendering
- Show summary in collapsible card at thread top with 'AI Summary' badge
- Display loading skeleton during generation

**Thread Complexity Detection Hook:**
- Use `totalPosts >= 5` as the complexity threshold for showing summaries
- Calculate: `totalPosts`, `maxDepth`, `branchCount`, `uniqueAuthors`
- Return complexity level enum: Simple/Medium/Complex/VeryComplex
- Summary eligibility: `totalPosts >= 5` AND user explicitly opened thread

### Technical Architecture

```typescript
// In ThreadViewer.tsx or ThreadModal.tsx
const { isComplex, shouldShowSummary } = useThreadComplexity(thread);

// shouldShowSummary = totalPosts >= 5
// Only render ThreadHaikuSummary when component mounts (explicit open)

if (shouldShowSummary) {
  return <ThreadHaikuSummary threadUri={thread.uri} />;
}
```

### Cost Implications

- 5-post threshold with explicit-open-only trigger balances feature visibility with cost control
- Estimated API calls: Only on intentional thread viewing, not passive browsing
- Caching via React Query with key `['thread-summary', threadUri]` prevents regeneration

Consequences:

- ThreadHaikuSummary only appears when ThreadViewer is explicitly opened
- 5-post threshold maintained for broad feature visibility
- API costs controlled through user intent requirement
- Blocked tasks can now proceed with these specifications
- Clear contract between complexity detection and summary generation

### Blocked Tasks Now Unblocked

1. **Create thread complexity detection hook with configurable thresholds**
   - Threshold confirmed: 5 posts
   - Hook should expose `shouldShowSummary` boolean

2. **Build ThreadHaikuSummary component with React Query caching**
   - Trigger: Only on explicit ThreadViewer open
   - Not triggered by hover/preview interactions

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212272159738730
- Decision made by: Dustin Moskovitz (2025-12-02) - "Option 1, but only do it when you open the thread viewer explicitly"
