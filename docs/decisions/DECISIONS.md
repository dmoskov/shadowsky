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

## Decision: Use Expo Bare Workflow with EAS Build for React Native Mobile App

Date: 2025-12-03
Status: Accepted
Context: The planned React Native mobile app requires access to native platform APIs for hardware-accelerated video transcoding. Specifically:

- iOS: VideoToolbox framework for H.264/HEVC encoding
- Android: MediaCodec API for hardware video encoding

This requires deciding between three workflow options with different trade-offs between development simplicity and native code access.

### Options Evaluated

**Option 1: Expo Managed Workflow**

- Simpler development with Expo Go for rapid iteration
- Built-in OTA (Over-The-Air) updates
- Limited native module access - cannot use custom native code
- Best for apps that don't need extensive native customization
- Would NOT support VideoToolbox/MediaCodec access

**Option 2: Expo Bare Workflow with EAS Build (RECOMMENDED)**

- Full native code access via Expo Dev Clients
- Can use any native module while still leveraging Expo's ecosystem
- EAS Build handles iOS/Android build complexity in the cloud
- Expo SDK packages (camera, file system, etc.) still work
- Supports custom native modules for VideoToolbox/MediaCodec bridges
- OTA updates still possible for JS bundle changes

**Option 3: Pure React Native CLI**

- No Expo at all - maximum flexibility
- More complex initial setup and ongoing maintenance
- Must manage native dependencies manually
- No Expo ecosystem benefits (EAS, Expo SDK packages)
- Full native access but with significant additional complexity

### Decision

**Option 2: Expo Bare Workflow with EAS Build**

### Rationale

1. **Native Access Required**: The video transcoding feature explicitly requires VideoToolbox (iOS) and MediaCodec (Android) - native APIs that cannot be accessed from Expo's managed workflow.

2. **Best of Both Worlds**: Expo Bare with Dev Clients provides:
   - Full native code access for custom bridges
   - Expo SDK packages for common needs (camera, file system, etc.)
   - EAS Build for cloud-based iOS/Android builds
   - Simplified native dependency management vs pure RN CLI

3. **Development Experience**:
   - Expo Dev Clients enable faster development iteration
   - No need to run Xcode/Android Studio for every change
   - Hot reload still works for JavaScript changes

4. **Build Infrastructure**:
   - EAS Build handles iOS provisioning, certificates, and App Store submission
   - Android builds automated without local Android SDK management
   - CI/CD integration via EAS workflows

### Implementation Architecture

```
packages/
├── mobile/                      # React Native app (Expo bare)
│   ├── app.json                 # Expo configuration
│   ├── eas.json                 # EAS Build configuration
│   ├── ios/                     # Native iOS project
│   │   └── ShadowSky/
│   │       └── VideoProcessor/  # Native VideoToolbox bridge
│   ├── android/                 # Native Android project
│   │   └── app/src/main/java/
│   │       └── VideoProcessor/  # Native MediaCodec bridge
│   └── src/
│       └── native/
│           └── VideoProcessor.ts  # JS interface to native modules
```

### Key Configuration Requirements

**app.json / app.config.js:**

```json
{
  "expo": {
    "plugins": [
      // Native module plugins
    ],
    "ios": {
      "bundleIdentifier": "io.shadowsky.app"
    },
    "android": {
      "package": "io.shadowsky.app"
    }
  }
}
```

**eas.json:**

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "production": {
      "distribution": "store"
    }
  }
}
```

### Native Module Integration

The native video processor bridges will be implemented as:

1. **iOS Native Module** (`ios/ShadowSky/VideoProcessor/`)
   - Swift/Objective-C bridge to VideoToolbox
   - Exposed via React Native's Native Modules API
   - Hardware-accelerated H.264/HEVC encoding

2. **Android Native Module** (`android/app/src/main/java/`)
   - Kotlin/Java bridge to MediaCodec
   - Exposed via React Native's Native Modules API
   - Hardware-accelerated video encoding

3. **TypeScript Interface** (`src/native/VideoProcessor.ts`)
   - Unified API for both platforms
   - Type-safe interface for video processing operations
   - Platform-specific fallback handling

### Dependencies

```json
{
  "dependencies": {
    "expo": "~51.x",
    "expo-dev-client": "~4.x",
    "expo-camera": "~15.x",
    "expo-file-system": "~17.x",
    "react-native": "0.74.x"
  }
}
```

Consequences:

- Native video transcoding with VideoToolbox/MediaCodec is now possible
- Development setup requires `expo-dev-client` custom builds
- Cannot use Expo Go for development (must use Dev Client)
- EAS Build required for production builds
- iOS development requires macOS (for native module development)
- Android development works on any platform

### Blocked Tasks Now Unblocked

1. **Initialize Expo/React Native monorepo project structure**
   - Use `npx create-expo-app` with bare template
   - Configure as monorepo package under `packages/mobile`

2. **Implement iOS native media processor bridge**
   - Create VideoToolbox bridge in Swift
   - Expose via React Native Native Modules

3. **Implement Android native media processor bridge**
   - Create MediaCodec bridge in Kotlin
   - Expose via React Native Native Modules

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212299550398987
- Expo Dev Clients: https://docs.expo.dev/develop/development-builds/introduction/
- EAS Build: https://docs.expo.dev/build/introduction/
- React Native Native Modules: https://reactnative.dev/docs/native-modules-intro
- Decision made by: Dustin Moskovitz (2025-12-03) - accepted recommended "Expo Bare (with EAS Build)"

## Decision: Use Sentry for Mobile App Crash Reporting

Date: 2025-12-03
Status: Accepted
Context: The planned EAS Build CI/CD pipeline for mobile app releases requires crash reporting integration for production error visibility. A decision was needed on which crash reporting tool to integrate.

### Options Evaluated

**Option A: Sentry**

- Industry standard with excellent React Native SDK (`@sentry/react-native`)
- Best-in-class source map support for readable stack traces
- Release tracking and performance monitoring built-in
- Free tier available (5K errors/month)
- Open source option (self-hosted) available
- More features but more complex initial setup

**Option B: Bugsnag**

- Simpler initial setup
- Good mobile SDK support
- Less overwhelming dashboard
- Paid only (no free tier)
- Good but not industry-leading React Native support

**Option C: Firebase Crashlytics**

- Free (part of Firebase suite)
- Excellent Android integration
- Adequate iOS support
- Limited compared to dedicated crash reporting tools
- Requires Firebase project setup

### Decision

**Option A: Sentry** - Use Sentry for crash reporting in the mobile app.

### Rationale

1. **React Native Excellence**: Sentry's `@sentry/react-native` SDK is the industry standard for React Native crash reporting with:
   - Native crash handling for iOS and Android
   - JavaScript error capture
   - Source map integration for readable stack traces
   - Automatic breadcrumb capture
   - Release health tracking

2. **EAS Build Integration**: Sentry integrates seamlessly with EAS Build for:
   - Automatic source map upload during builds
   - Release association with build versions
   - Distribution tracking across channels

3. **Production Debugging**: Sentry provides essential debugging capabilities:
   - Stack traces with original source code
   - User context and device information
   - Error grouping and deduplication
   - Real-time alerting on new issues

4. **Cost Effective**: Free tier (5K errors/month) is sufficient for initial launch and early growth. Scales with paid tiers as needed.

5. **Future Extensibility**: Can expand to include:
   - Performance monitoring
   - Session replay
   - User feedback integration

### Implementation Requirements

**1. Package Installation**

```bash
npx expo install @sentry/react-native
```

**2. Configuration Files**

Create `sentry.properties` in project root:

```properties
defaults.project=shadowsky-mobile
defaults.org=shadowsky
```

**3. App Entry Point Setup**

In the main app entry (e.g., `App.tsx` or `index.js`):

```typescript
import * as Sentry from "@sentry/react-native";

Sentry.init({
  dsn: "https://YOUR_DSN@sentry.io/PROJECT_ID",
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
  debug: __DEV__,
  environment: __DEV__ ? "development" : "production",
  release: "shadowsky-mobile@" + version,
});
```

**4. Error Boundary Integration**

Wrap the app with Sentry's error boundary:

```typescript
export default Sentry.wrap(App);
```

**5. EAS Build Configuration**

In `eas.json`, add source map upload:

```json
{
  "build": {
    "production": {
      "env": {
        "SENTRY_AUTH_TOKEN": "@sentry-auth-token"
      }
    }
  }
}
```

In `app.json` or `app.config.js`:

```json
{
  "plugins": [
    [
      "@sentry/react-native/expo",
      {
        "organization": "shadowsky",
        "project": "shadowsky-mobile",
        "url": "https://sentry.io/"
      }
    ]
  ]
}
```

**6. CI/CD Integration**

In GitHub Actions workflow:

```yaml
- name: Upload Source Maps to Sentry
  run: npx @sentry/cli releases files ${{ env.VERSION }} upload-sourcemaps ./dist
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
```

### Environment Variables Required

| Variable            | Description                      | Storage                      |
| ------------------- | -------------------------------- | ---------------------------- |
| `SENTRY_DSN`        | Sentry project DSN               | EAS Secrets / GitHub Secrets |
| `SENTRY_AUTH_TOKEN` | Auth token for source map upload | EAS Secrets / GitHub Secrets |
| `SENTRY_ORG`        | Sentry organization slug         | eas.json / app.config.js     |
| `SENTRY_PROJECT`    | Sentry project slug              | eas.json / app.config.js     |

### Cost Projection

| Tier      | Errors/Month | Price  | Notes                 |
| --------- | ------------ | ------ | --------------------- |
| Developer | 5,000        | Free   | Sufficient for launch |
| Team      | 50,000       | $26/mo | Early growth phase    |
| Business  | 100,000+     | Custom | Scale phase           |

Consequences:

- Mobile app will have production-grade crash reporting from day one
- Source maps will be uploaded automatically with each EAS build
- Stack traces will show original TypeScript/JavaScript source
- Errors will be grouped and deduplicated automatically
- Alerts can be configured for new issue types
- EAS Build CI/CD task is unblocked

### Blocked Tasks Now Unblocked

1. **Set up EAS Build CI/CD pipeline for mobile app releases**
   - Crash reporting tool decision: Sentry
   - Can proceed with EAS Build + Sentry source map upload integration

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212299550407567
- Sentry React Native Docs: https://docs.sentry.io/platforms/react-native/
- EAS Build + Sentry: https://docs.expo.dev/guides/using-sentry/
- Decision made by: Dustin Moskovitz (2025-12-03) - "accept"

## Decision: Use Expo Notifications for Push Notification Infrastructure

Date: 2025-12-03
Status: Accepted
Context: Push notifications for the mobile app can be implemented via direct FCM/APNs integration or through Expo's notification service abstraction. This decision affects notification delivery reliability, setup complexity, and ongoing maintenance.

### Options Evaluated

**Option 1: Expo Notifications**

- Unified API across iOS and Android
- Simpler setup with managed push tokens
- Expo servers handle token management and delivery routing
- Works seamlessly with Expo's build infrastructure
- Adds dependency on Expo notification servers

**Option 2: Direct FCM/APNs**

- Full control over notification infrastructure
- No dependency on Expo servers
- More complex setup with platform-specific code
- Requires separate APNs certificate management for iOS
- Requires Firebase project setup for Android

**Option 3: Hybrid (react-native-firebase + direct APNs)**

- Uses Firebase for cross-platform push delivery
- Direct APNs integration for iOS-specific features
- Most flexibility but highest complexity
- Two systems to maintain

### Decision

**Expo Notifications** - Use `expo-notifications` package for push notification infrastructure.

### Rationale

1. **Expo Ecosystem Alignment**: The mobile app is being built with Expo Bare Workflow (as established in the "Use Expo Bare Workflow with EAS Build" decision). Using expo-notifications provides seamless integration with the existing toolchain.

2. **Unified API**: Single codebase handles both iOS and Android notifications without platform-specific branching for basic functionality.

3. **Managed Complexity**: Expo handles push token registration, renewal, and delivery routing. This reduces implementation effort and maintenance burden.

4. **Built-in Features**:
   - Push token management
   - Notification categories and actions
   - Badge management
   - Notification scheduling (local notifications)
   - Background notification handling

5. **Development Experience**: Works with Expo Dev Client for testing, EAS Build for production builds.

### Implementation Architecture

```typescript
// Push notification setup with expo-notifications
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";

// 1. Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// 2. Request permissions
async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // 3. Get Expo push token
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });

  return token.data;
}

// 4. Handle incoming notifications
Notifications.addNotificationReceivedListener((notification) => {
  // Handle foreground notification
});

Notifications.addNotificationResponseReceivedListener((response) => {
  // Handle notification tap/interaction
});
```

### APNs/FCM Configuration via Expo

Even with Expo Notifications, APNs and FCM credentials are still required but managed through Expo:

**iOS (APNs):**

- Generate APNs authentication key in Apple Developer Portal
- Upload to Expo via `eas credentials` or Expo dashboard
- Expo handles certificate rotation and token delivery

**Android (FCM):**

- Create Firebase project
- Download `google-services.json`
- Configure in `app.json` under `android.googleServicesFile`
- Expo handles FCM token registration

### Server-Side Integration

Push notifications will be sent from the backend using Expo's push API:

```javascript
// Server-side: Send push notification
const { Expo } = require("expo-server-sdk");
const expo = new Expo();

async function sendPushNotification(expoPushToken, title, body, data) {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error("Invalid Expo push token");
    return;
  }

  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
  };

  const chunks = expo.chunkPushNotifications([message]);
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk);
  }
}
```

### Notification Categories

Define notification categories for different interaction types:

```typescript
Notifications.setNotificationCategoryAsync("reply", [
  {
    identifier: "view",
    buttonTitle: "View",
    options: { opensAppToForeground: true },
  },
  {
    identifier: "reply",
    buttonTitle: "Reply",
    textInput: { submitButtonTitle: "Send", placeholder: "Write a reply..." },
  },
]);

Notifications.setNotificationCategoryAsync("follow", [
  {
    identifier: "view_profile",
    buttonTitle: "View Profile",
    options: { opensAppToForeground: true },
  },
]);
```

### Trade-offs Accepted

| Aspect            | Consequence                                                         |
| ----------------- | ------------------------------------------------------------------- |
| Expo Dependency   | Adds dependency on Expo notification servers for push delivery      |
| Delivery Routing  | Push tokens are Expo tokens, routed through Expo to APNs/FCM        |
| Advanced Features | Some advanced platform-specific features may require native modules |
| Offline Delivery  | Subject to Expo's delivery queue and retry policies                 |
| Debugging         | Push debugging goes through Expo's tooling                          |

### Migration Path

If deeper native control is needed in the future:

1. `expo-notifications` is a native module, not a managed-only service
2. Works with Expo Bare Workflow (our chosen approach)
3. Can add `react-native-firebase` alongside for specific features
4. Push tokens can be migrated (FCM tokens are accessible)

Consequences:

- Push notification implementation simplified with unified API
- APNs and FCM credentials managed through Expo infrastructure
- Backend sends notifications via Expo push API
- Notification handlers implemented in React Native
- Development testing available via Expo Dev Client
- Aligns with Expo Bare Workflow decision

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212288375109741
- Expo Notifications Docs: https://docs.expo.dev/push-notifications/overview/
- Expo Push API: https://docs.expo.dev/push-notifications/sending-notifications/
- Related Decision: "Use Expo Bare Workflow with EAS Build for React Native Mobile App"
- Decision made by: Dustin Moskovitz (2025-12-03) - Accepted recommended option (Expo Notifications)

## Decision: Use expo-auth-session for Mobile OAuth2 PKCE Authentication

Date: 2025-12-03
Status: Accepted
Context: The ShadowSky mobile app needs native OAuth2 PKCE authentication to provide secure AT Protocol authentication. Two library options were evaluated for implementing this flow.

### Options Evaluated

**Option 1: expo-auth-session (Recommended)**

- Expo's official OAuth library using the AuthSession API
- Simpler integration within the Expo ecosystem
- Works with Expo Go for development testing
- Sufficient for standard OAuth2 PKCE flow
- No native code modifications required
- Consistent with other Expo dependencies

**Option 2: react-native-app-auth**

- Wrapper around the AppAuth SDK (Google's reference OAuth implementation)
- More features and customization options
- Requires native code modifications (ejecting from Expo or using dev client)
- More complex setup and maintenance
- Better support for edge cases and advanced OAuth scenarios

### Decision

Use **expo-auth-session** for mobile OAuth2 PKCE authentication.

### Rationale

1. **Ecosystem Consistency**: ShadowSky's mobile app uses Expo (bare workflow with EAS Build), and expo-auth-session integrates seamlessly within this ecosystem.

2. **Development Experience**: Even in bare workflow, expo-auth-session provides a clean API that works well with Expo Dev Clients.

3. **Sufficient Functionality**: The AT Protocol OAuth2 PKCE flow is a standard implementation that doesn't require the advanced features react-native-app-auth provides.

4. **Maintenance Simplicity**: Fewer dependencies and consistent upgrade path with other Expo packages.

5. **Security**: expo-auth-session fully supports PKCE (Proof Key for Code Exchange) which prevents authorization code interception attacks on mobile.

### Implementation Architecture

#### 1. OAuth2 PKCE Flow with expo-auth-session

```typescript
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";

// AT Protocol OAuth configuration
const discovery = {
  authorizationEndpoint: "https://bsky.social/oauth/authorize",
  tokenEndpoint: "https://bsky.social/oauth/token",
};

// Generate PKCE code verifier and challenge
const useAuthConfig = () => {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "io.shadowsky.app",
    path: "oauth/callback",
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: "https://shadowsky.io/client-metadata.json",
      scopes: ["atproto", "transition:generic"],
      redirectUri,
      usePKCE: true, // Enable PKCE automatically
      responseType: AuthSession.ResponseType.Code,
    },
    discovery,
  );

  return { request, response, promptAsync, redirectUri };
};
```

#### 2. Token Storage with expo-secure-store

Tokens must be stored securely to prevent unauthorized access:

```typescript
import * as SecureStore from "expo-secure-store";

const TOKEN_KEYS = {
  ACCESS_TOKEN: "shadowsky_access_token",
  REFRESH_TOKEN: "shadowsky_refresh_token",
  DID: "shadowsky_did",
  HANDLE: "shadowsky_handle",
  EXPIRY: "shadowsky_token_expiry",
};

// Store tokens securely
export async function storeTokens(tokens: {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  did: string;
  handle: string;
}): Promise<void> {
  const expiryTime = Date.now() + tokens.expiresIn * 1000;

  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEYS.ACCESS_TOKEN, tokens.accessToken),
    SecureStore.setItemAsync(TOKEN_KEYS.REFRESH_TOKEN, tokens.refreshToken),
    SecureStore.setItemAsync(TOKEN_KEYS.DID, tokens.did),
    SecureStore.setItemAsync(TOKEN_KEYS.HANDLE, tokens.handle),
    SecureStore.setItemAsync(TOKEN_KEYS.EXPIRY, expiryTime.toString()),
  ]);
}

// Retrieve tokens
export async function getTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  did: string | null;
  handle: string | null;
  expiry: number | null;
}> {
  const [accessToken, refreshToken, did, handle, expiryStr] = await Promise.all(
    [
      SecureStore.getItemAsync(TOKEN_KEYS.ACCESS_TOKEN),
      SecureStore.getItemAsync(TOKEN_KEYS.REFRESH_TOKEN),
      SecureStore.getItemAsync(TOKEN_KEYS.DID),
      SecureStore.getItemAsync(TOKEN_KEYS.HANDLE),
      SecureStore.getItemAsync(TOKEN_KEYS.EXPIRY),
    ],
  );

  return {
    accessToken,
    refreshToken,
    did,
    handle,
    expiry: expiryStr ? parseInt(expiryStr, 10) : null,
  };
}

// Clear all tokens on logout
export async function clearTokens(): Promise<void> {
  await Promise.all(
    Object.values(TOKEN_KEYS).map((key) => SecureStore.deleteItemAsync(key)),
  );
}
```

#### 3. Token Refresh Flow

Implement proactive token refresh to maintain seamless authentication:

```typescript
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

export async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, expiry } = await getTokens();

  if (!refreshToken) {
    return null;
  }

  // Check if refresh is needed
  if (expiry && Date.now() < expiry - REFRESH_THRESHOLD_MS) {
    const { accessToken } = await getTokens();
    return accessToken;
  }

  try {
    const response = await fetch("https://bsky.social/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: "https://shadowsky.io/client-metadata.json",
      }),
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();

    await storeTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
      did: data.sub,
      handle: (await getTokens()).handle || "",
    });

    return data.access_token;
  } catch (error) {
    console.error("Token refresh failed:", error);
    // Clear tokens and require re-authentication
    await clearTokens();
    return null;
  }
}
```

#### 4. Complete Authentication Hook

```typescript
import { useEffect, useState, useCallback } from "react";
import * as AuthSession from "expo-auth-session";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ did: string; handle: string } | null>(
    null,
  );

  const { request, response, promptAsync } = useAuthConfig();

  // Check for existing session on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === "success") {
      handleAuthResponse(response.params.code);
    }
  }, [response]);

  const checkAuthState = async () => {
    const tokens = await getTokens();
    if (tokens.accessToken && tokens.expiry && Date.now() < tokens.expiry) {
      setIsAuthenticated(true);
      setUser({ did: tokens.did!, handle: tokens.handle! });
    }
    setIsLoading(false);
  };

  const handleAuthResponse = async (code: string) => {
    try {
      setIsLoading(true);

      // Exchange code for tokens
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          code,
          clientId: "https://shadowsky.io/client-metadata.json",
          redirectUri: request?.redirectUri!,
          extraParams: {
            code_verifier: request?.codeVerifier!,
          },
        },
        discovery,
      );

      await storeTokens({
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken!,
        expiresIn: tokenResponse.expiresIn!,
        did: tokenResponse.idToken!, // DID from token
        handle: "", // Fetch handle separately via profile API
      });

      setIsAuthenticated(true);
    } catch (error) {
      console.error("Authentication failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async () => {
    await promptAsync();
  }, [promptAsync]);

  const logout = useCallback(async () => {
    await clearTokens();
    setIsAuthenticated(false);
    setUser(null);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    canLogin: !!request,
  };
}
```

### Security Considerations

1. **PKCE Protection**: expo-auth-session handles PKCE automatically, generating secure code verifier and challenge pairs to prevent authorization code interception.

2. **Secure Token Storage**: expo-secure-store uses the device's secure enclave (iOS Keychain / Android Keystore) to protect tokens at rest.

3. **Token Refresh**: Proactive refresh prevents token expiration during active use.

4. **Deep Link Security**: Configure `scheme` in app.json to prevent other apps from intercepting the OAuth callback.

### App Configuration

Add to `app.json`:

```json
{
  "expo": {
    "scheme": "io.shadowsky.app",
    "ios": {
      "bundleIdentifier": "io.shadowsky.app"
    },
    "android": {
      "package": "io.shadowsky.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "io.shadowsky.app",
              "host": "oauth",
              "pathPrefix": "/callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

### Dependencies Required

```json
{
  "dependencies": {
    "expo-auth-session": "~5.x.x",
    "expo-secure-store": "~13.x.x",
    "expo-crypto": "~13.x.x"
  }
}
```

### Blocked Tasks Now Unblocked

1. **Implement native OAuth2 PKCE authentication flow** - Can now proceed with expo-auth-session implementation

Consequences:

- Mobile OAuth authentication will use expo-auth-session
- Simpler development workflow within Expo ecosystem
- Tokens secured with expo-secure-store (device Keychain/Keystore)
- No additional native code modifications required for auth
- Consistent experience across iOS and Android
- Proactive token refresh maintains seamless user experience

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212288375110818
- expo-auth-session Documentation: https://docs.expo.dev/versions/latest/sdk/auth-session/
- expo-secure-store Documentation: https://docs.expo.dev/versions/latest/sdk/securestore/
- AT Protocol OAuth: https://docs.bsky.app/docs/advanced-guides/oauth-client
- Decision made by: Dustin Moskovitz (2025-12-03) - "accept"

## Decision: Use Express.js on AWS Lambda for API Gateway

Date: 2025-12-03
Status: Accepted
Context: The task "Build REST API gateway with OAuth PKCE mobile support" required clarification on the technology stack and deployment target. Three options were evaluated for the API gateway implementation.

### Options Evaluated

**Option 1: Express.js on AWS Lambda (SELECTED)**

- Serverless deployment with automatic scaling
- Matches existing Lambda functions in the project (analyze-posts, adjust-tone, generate-alt-text, etc.)
- Automatic scaling and no server management
- Pay-per-use pricing model
- Easy integration with other AWS services (Cognito, DynamoDB)
- Cold start latency (mitigated with provisioned concurrency)
- 15-minute execution limit (not an issue for gateway requests)

**Option 2: Hono on Cloudflare Workers**

- Edge-first serverless with global distribution
- Fastest cold starts (~0ms)
- Global edge distribution by default
- Excellent for OAuth callback handling
- Different deployment pipeline from existing Lambdas
- Limited CPU time per request
- Smaller ecosystem than Express

**Option 3: Express.js on ECS/Fargate**

- Containerized always-on service
- No cold starts
- Full control over runtime
- Easier local development
- Higher base cost (always running)
- Requires container management
- Manual scaling configuration

### Decision

**Express.js on AWS Lambda** - Use serverless Express.js deployed on AWS Lambda for the API gateway.

### Rationale

1. **Infrastructure Alignment**: The project already uses AWS Lambda extensively for AI-powered functions (analyze-posts, adjust-tone, generate-alt-text, optimize-thread, suggest-hashtags, style-analysis, writing-feedback). Using Lambda for the API gateway maintains consistency.

2. **Simplified Deployment**: Single deployment pipeline using AWS Amplify's existing infrastructure. No need to introduce Cloudflare Workers or manage ECS clusters.

3. **Cost Efficiency**: Pay-per-use model is ideal for a growing application. No fixed costs for idle capacity.

4. **AWS Service Integration**: Natural integration with:
   - AWS Cognito for authentication
   - API Gateway for routing and rate limiting
   - DynamoDB for session/token storage if needed
   - CloudWatch for monitoring

5. **OAuth PKCE Support**: Express.js has mature OAuth libraries and the Lambda environment supports the full OAuth PKCE flow for mobile authentication.

### Implementation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (AWS)                         │
│                     /api/v1/*                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Express.js Lambda Function                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Routes:                                             │    │
│  │  - /api/v1/auth/oauth/authorize (PKCE initiation)   │    │
│  │  - /api/v1/auth/oauth/callback (token exchange)     │    │
│  │  - /api/v1/auth/refresh (token refresh)             │    │
│  │  - /api/v1/ai/* (proxy to AI Lambda functions)      │    │
│  │  - /api/v1/health (health check)                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Middleware:                                                 │
│  - Authentication (JWT validation)                           │
│  - Rate limiting (per-user via Cognito)                     │
│  - CORS handling                                             │
│  - Request logging                                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "@vendia/serverless-express": "^4.x",
    "jsonwebtoken": "^9.x",
    "express-rate-limit": "^7.x"
  }
}
```

### Cold Start Mitigation

For production, configure provisioned concurrency to minimize cold starts:

- Set minimum 1-2 warm instances for the gateway Lambda
- Use Lambda SnapStart if available for faster initialization
- Keep Lambda bundle size minimal

### Blocked Tasks Now Unblocked

1. **Build REST API gateway with OAuth PKCE mobile support**
   - Technology: Express.js
   - Deployment: AWS Lambda
   - Can proceed with implementation

2. **Add API versioning with /api/v1/ prefix**
   - Express.js router supports versioned routes natively
   - Can implement versioning middleware

3. **Add authentication and rate limiting to all Lambda functions**
   - Gateway will handle authentication centrally
   - Rate limiting middleware in Express.js
   - Existing Lambda functions called via internal AWS invocation

Consequences:

- API gateway uses same deployment infrastructure as existing Lambda functions
- Express.js ecosystem available for middleware and routing
- Serverless scaling handles traffic spikes automatically
- Cold starts are a consideration but manageable with provisioned concurrency
- OAuth PKCE flow can be fully implemented within Lambda execution limits

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212298287391372
- AWS Lambda + Express: https://docs.aws.amazon.com/lambda/latest/dg/services-apigateway.html
- Serverless Express: https://github.com/vendia/serverless-express
- Related Decision: "Backend Infrastructure Architecture for Push Notifications and Analytics"
- Decision made by: Dustin Moskovitz (2025-12-03) - "accept recommended"

## Decision: Use Optimistic UI with Local Cache for Destructive Action Undo

Date: 2025-12-03
Status: Accepted
Context: The task 'Implement confirmation dialogs for destructive actions with undo pattern' mentions a '5-second undo window' but doesn't specify how undo should be implemented technically. A clarification was needed to choose between three approaches.

### Options Evaluated

**Option 1: Soft delete with timer**

- Mark item as deleted in backend, actually delete after 5 seconds if not undone
- Requires backend API support for soft delete flags
- Most robust data safety guarantees
- Higher implementation complexity

**Option 2: Optimistic UI with local cache (SELECTED)**

- Remove from UI immediately, keep in local memory/state for 5 seconds
- Simpler frontend-only implementation
- Data loss risk if page is reloaded during undo window
- No backend changes required

**Option 3: Queue-based delay**

- Add deletion to a mutation queue, execute after 5 seconds
- Can be cancelled from queue before execution
- Works with MutationQueue pattern
- More complex state management

### Decision

**Option 2: Optimistic UI with local cache** - Remove item from UI immediately, keep in local memory for 5 seconds. User can undo within window to restore item.

### Rationale

1. **Simplicity**: Frontend-only implementation requires no backend API changes
2. **User Experience**: Immediate visual feedback with option to undo
3. **Acceptable Risk**: The 5-second window is short enough that page reloads during undo are rare edge cases
4. **Alignment**: Already implemented in the confirmation dialogs task using component state

### Implementation Details

The implementation stores pending deletions in React component state:

```typescript
// Pending deletion state
const [pendingDeletion, setPendingDeletion] = useState<{
  item: T;
  timeoutId: NodeJS.Timeout;
} | null>(null);

// On delete action
const handleDelete = (item: T) => {
  // Remove from UI immediately (optimistic)
  setItems(items.filter((i) => i.id !== item.id));

  // Store for potential undo
  const timeoutId = setTimeout(() => {
    // Actually execute deletion after 5 seconds
    executeActualDeletion(item);
    setPendingDeletion(null);
  }, 5000);

  setPendingDeletion({ item, timeoutId });

  // Show toast with undo button
  showToast({
    message: "Item deleted",
    action: {
      label: "Undo",
      onClick: () => handleUndo(),
    },
    duration: 5000,
  });
};

// On undo
const handleUndo = () => {
  if (pendingDeletion) {
    clearTimeout(pendingDeletion.timeoutId);
    // Restore item to UI
    setItems([...items, pendingDeletion.item]);
    setPendingDeletion(null);
  }
};
```

### Trade-offs Accepted

| Aspect                  | Consequence                                        |
| ----------------------- | -------------------------------------------------- |
| Page reload during undo | Item will be permanently deleted (data loss)       |
| Browser crash           | Same as page reload                                |
| Multiple tabs           | Undo only works in the tab that initiated deletion |
| Offline support         | Works offline since it's client-side only          |

Consequences:

- Undo mechanism implemented as frontend-only pattern
- No backend API changes required
- 5-second undo window with toast notification
- Accepted risk of data loss on page reload during undo window
- Implementation already completed in ConfirmDestructiveDialog component

### Blocked Tasks Now Unblocked

1. **Implement confirmation dialogs for destructive actions with undo pattern** - Already completed with this approach

References:

- Asana Clarification Task: https://app.asana.com/0/1211710875848660/1212289416571900
- Implementation Task: https://app.asana.com/0/1211710875848660/1212289416504746
- Decision made by: Dustin Moskovitz (2025-12-03) - "option 2 is great"

## Decision: Use CSS-Only Animations with Tailwind (No framer-motion)

Date: 2025-12-03
Status: Accepted
Context: Multiple tasks reference animations including modal entrance/exit, disclosure panel expand/collapse, loading states, and per-action sync feedback. A decision was needed on whether to use a JavaScript animation library (framer-motion) or pure CSS transitions/animations.

### Options Evaluated

**Option 1: framer-motion**

- Rich animation primitives and gesture support
- AnimatePresence for exit animations
- Declarative animation API
- Adds ~32KB to bundle size
- Additional dependency to maintain

**Option 2: CSS-only with Tailwind (Recommended)**

- Zero additional bundle impact
- Simpler implementation using existing patterns
- Consistent with current codebase
- Exit animations handled via data-state attributes
- Leverages existing Tailwind animation keyframes

**Option 3: Hybrid**

- CSS for simple transitions
- framer-motion for complex sequences (modals, staggered lists)
- Most flexible but inconsistent patterns
- Two different animation approaches to maintain

### Decision

**CSS-only with Tailwind** - Use pure CSS transitions and animations without adding framer-motion.

### Rationale

1. **Existing Infrastructure**: The BSKY codebase already has animation keyframes defined in `tailwind.config.js` including `fadeIn`, `fadeInUp`, and others. Building on this foundation maintains consistency.

2. **Bundle Size**: Adding framer-motion would increase bundle size by ~32KB. CSS animations have zero additional bundle impact.

3. **Simplicity**: CSS transitions are simpler to implement and debug. No need to learn a new animation library API.

4. **Exit Animations**: While CSS doesn't natively support exit animations like AnimatePresence, they can be handled via:
   - `data-state` attributes with CSS selectors
   - Delayed unmounting with state management
   - CSS animation classes toggled before removal

5. **Performance**: CSS animations are hardware-accelerated and run off the main thread, providing smooth 60fps animations.

### Implementation Approach

**Animation Tokens in Tailwind:**

```javascript
// tailwind.config.js - extend existing animation keyframes
animation: {
  'fade-in': 'fadeIn 200ms ease-out',
  'fade-in-up': 'fadeInUp 200ms ease-out',
  'fade-out': 'fadeOut 150ms ease-in',
  'slide-in-right': 'slideInRight 200ms ease-out',
  'slide-out-right': 'slideOutRight 150ms ease-in',
  'scale-in': 'scaleIn 200ms ease-out',
  'scale-out': 'scaleOut 150ms ease-in',
}
```

**Exit Animation Pattern with data-state:**

```tsx
// Modal.tsx example
<div
  data-state={isOpen ? "open" : "closed"}
  className="data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
>
  {/* Modal content */}
</div>
```

**Transition Utilities:**

```css
/* Standard transition classes */
.transition-opacity {
  transition: opacity 200ms ease-out;
}
.transition-transform {
  transition: transform 200ms ease-out;
}
.transition-all {
  transition: all 200ms ease-out;
}
```

### Affected Components

Components that will use CSS-only animations:

1. **Modal** - Entrance/exit with fade and scale
2. **DisclosurePanel** - Expand/collapse with height transition
3. **LoadingState** - Skeleton pulse, spinner rotation
4. **Toast/Notifications** - Slide in/out
5. **Dropdown menus** - Fade and slide

### Trade-offs Accepted

| Aspect             | Consequence                                             |
| ------------------ | ------------------------------------------------------- |
| Complex sequences  | May require more verbose CSS for staggered animations   |
| Gesture animations | No built-in gesture support (not currently needed)      |
| Exit animations    | Require explicit state management for delayed unmount   |
| Spring physics     | CSS uses easing curves, not spring physics (acceptable) |

Consequences:

- No framer-motion dependency added to the project
- Bundle size remains lean
- Animation patterns stay consistent with existing codebase
- All animation-related tasks should use CSS transitions/animations
- Exit animations implemented via data-state pattern
- Tailwind animation utilities extended as needed

### Blocked Tasks Now Unblocked

1. **Define coordinated animation tokens and transition utilities** - Use Tailwind animation config
2. **Add entrance and exit animations to Modal component** - CSS with data-state pattern
3. **Create unified DisclosurePanel component for expand/collapse patterns** - CSS height transitions
4. **Implement LoadingState component with consistent patterns** - CSS keyframe animations

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212289834340372
- Tailwind Animation Docs: https://tailwindcss.com/docs/animation
- Decision made by: Dustin Moskovitz (2025-12-03) - "accept recommended"

## Decision: Use WatermelonDB for React Native Offline Storage

Date: 2025-12-03
Status: Accepted
Context: The React Native mobile app needs a storage solution to replace IndexedDB for offline persistence. The existing web app uses multiple IndexedDB databases (offline-storage-db, mutation-queue-db, dm-search-db) with complex queries and batch operations. A decision was needed on the appropriate React Native storage backend.

### Options Evaluated

**Option 1: expo-sqlite**

- Expo-maintained SQLite wrapper
- Good ecosystem integration with Expo
- Simpler than alternatives
- Direct SQL queries (less abstraction)
- Manual query management and caching

**Option 2: WatermelonDB (SELECTED)**

- High-performance reactive database built on SQLite
- Lazy loading and observable queries for React integration
- Better for complex queries and reactive UI patterns
- Designed for sync scenarios (conflict resolution built-in)
- More complex initial setup but scales better
- Used by large apps like Nozbe and Expense

**Option 3: MMKV**

- Tencent's ultra-fast key-value storage
- 10x faster than AsyncStorage for simple operations
- Limited query capability (key-value only)
- Best for simple preferences, not complex data models
- No relational data support

**Option 4: Realm**

- MongoDB's mobile database
- Powerful object database with live objects
- Adds significant SDK size (~5MB+)
- Complex setup and MongoDB ecosystem lock-in
- Overkill for this use case

### Decision

Use **WatermelonDB** for React Native offline storage.

### Rationale

1. **Complex Data Requirements**: The existing app has multiple IndexedDB databases with complex query patterns:
   - `offline-storage-db`: Post cache, user profiles, timeline data
   - `mutation-queue-db`: Offline mutation queue with ordering and retry logic
   - `dm-search-db`: Direct message search indexing

   WatermelonDB's query capabilities and model relationships handle this complexity better than key-value stores.

2. **Reactive Design**: WatermelonDB's observable queries integrate naturally with React patterns:
   - Components subscribe to database changes automatically
   - UI updates when underlying data changes
   - Matches existing React Query patterns in the web app

3. **Sync-Ready Architecture**: WatermelonDB was designed with sync in mind:
   - Built-in support for sync conflict resolution
   - Dirty tracking for changed records
   - Push/pull sync primitives
   - Aligns with AT Protocol's eventual consistency model

4. **Performance at Scale**: WatermelonDB uses lazy loading and partial hydration:
   - Only loads data that's actually rendered
   - Handles tens of thousands of records efficiently
   - Critical for timeline/feed performance

5. **SQLite Foundation**: Built on SQLite provides:
   - Proven reliability and ACID compliance
   - Full SQL query capability when needed
   - Cross-platform consistency (iOS/Android)

### Implementation Architecture

```
src/services/storage/
├── abstract/
│   ├── storage-provider.ts      # Abstract interface (existing)
│   └── mobile-storage-adapter.ts # WatermelonDB implementation
├── models/
│   ├── schema.ts                 # WatermelonDB schema definition
│   ├── Post.ts                   # Post model
│   ├── Profile.ts                # Profile model
│   ├── MutationQueue.ts          # Offline mutation model
│   └── SearchIndex.ts            # DM search model
└── sync/
    └── watermelon-sync.ts        # Sync adapter for AT Protocol
```

### Schema Example

```typescript
import { appSchema, tableSchema } from "@nozbe/watermelondb";

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: "posts",
      columns: [
        { name: "uri", type: "string", isIndexed: true },
        { name: "cid", type: "string" },
        { name: "author_did", type: "string", isIndexed: true },
        { name: "text", type: "string" },
        { name: "created_at", type: "number", isIndexed: true },
        { name: "indexed_at", type: "number" },
        { name: "reply_count", type: "number" },
        { name: "repost_count", type: "number" },
        { name: "like_count", type: "number" },
        { name: "raw_json", type: "string" }, // Full post data as JSON
      ],
    }),
    tableSchema({
      name: "profiles",
      columns: [
        { name: "did", type: "string", isIndexed: true },
        { name: "handle", type: "string", isIndexed: true },
        { name: "display_name", type: "string" },
        { name: "avatar_url", type: "string" },
        { name: "followers_count", type: "number" },
        { name: "follows_count", type: "number" },
        { name: "cached_at", type: "number" },
      ],
    }),
    tableSchema({
      name: "mutation_queue",
      columns: [
        { name: "mutation_id", type: "string", isIndexed: true },
        { name: "type", type: "string" },
        { name: "payload", type: "string" },
        { name: "status", type: "string", isIndexed: true },
        { name: "retry_count", type: "number" },
        { name: "created_at", type: "number" },
        { name: "last_attempted_at", type: "number" },
      ],
    }),
  ],
});
```

### Dependencies Required

```json
{
  "dependencies": {
    "@nozbe/watermelondb": "^0.27.x",
    "@nozbe/with-observables": "^1.6.x"
  },
  "devDependencies": {
    "@babel/plugin-proposal-decorators": "^7.x"
  }
}
```

### Babel Configuration

WatermelonDB uses decorators, requiring babel configuration:

```javascript
// babel.config.js
module.exports = {
  presets: ["babel-preset-expo"],
  plugins: [["@babel/plugin-proposal-decorators", { legacy: true }]],
};
```

### Trade-offs Accepted

| Aspect           | Consequence                                       |
| ---------------- | ------------------------------------------------- |
| Setup Complexity | More initial configuration than MMKV/AsyncStorage |
| Bundle Size      | Adds ~200KB to bundle (acceptable for features)   |
| Learning Curve   | Team needs to learn WatermelonDB patterns         |
| Decorator Syntax | Requires Babel plugin for decorator support       |

### Migration Path

For data migration from web (if needed):

1. Export IndexedDB data to JSON format
2. Import via WatermelonDB batch operations
3. Handle schema differences in migration layer

Consequences:

- Mobile app offline storage will use WatermelonDB
- Storage abstraction interface must support WatermelonDB's async patterns
- Observable queries enable reactive UI updates
- Sync infrastructure can leverage WatermelonDB's sync primitives
- Complex offline scenarios (mutation queue, search) well supported

### Blocked Tasks Now Unblocked

1. **Create abstract storage interface for cross-platform persistence** - Can now define interface knowing WatermelonDB capabilities

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212299550402133
- WatermelonDB Documentation: https://watermelondb.dev/
- WatermelonDB GitHub: https://github.com/Nozbe/WatermelonDB
- Decision made by: Dustin Moskovitz (2025-12-03) - Accepted recommended option "WatermelonDB"

## Decision: Use Simple Keywords Only for Custom Content Filters (No Regex)

Date: 2025-12-03
Status: Accepted
Context: The task "Build custom content filter list management UI" mentions "optional regex pattern support" for content filters. A clarification was needed to determine the scope of pattern matching support, as regex adds complexity and potential security concerns.

### Options Evaluated

**Option 1: Simple Keywords Only (SELECTED)**

- Support case-insensitive keyword matching without regex
- Simpler UX for most users
- No ReDoS (Regular Expression Denial of Service) security concerns
- Easier to implement and test
- Covers 90%+ of use cases
- Less flexible for power users
- Cannot match patterns

**Option 2: Full Regex Support**

- Allow full regular expression patterns in filters
- Maximum flexibility for power users
- ReDoS vulnerability risk
- Complex UX for non-technical users
- Harder to validate and debug
- Performance concerns with malformed patterns

**Option 3: Simple Wildcards**

- Support basic wildcards (\* and ?) without full regex
- Familiar to most users (like file globs)
- No security concerns
- More flexible than keywords alone
- Still limited for complex patterns
- Custom parsing implementation needed

### Decision

**Simple Keywords Only** - Implement case-insensitive keyword matching for custom content filters without regex or wildcard support.

### Rationale

1. **Security First**: Regex patterns can be exploited with ReDoS attacks where carefully crafted patterns cause exponential backtracking, freezing the UI or exhausting resources. Simple keyword matching eliminates this entire class of vulnerability.

2. **UX Simplicity**: Most users wanting to filter content will use simple keywords like specific words, phrases, or usernames. Regex syntax is confusing for non-technical users and creates support burden.

3. **Implementation Simplicity**: Keyword matching is straightforward to implement:

   ```typescript
   const matchesFilter = (text: string, filters: string[]): boolean => {
     const lowerText = text.toLowerCase();
     return filters.some((filter) => lowerText.includes(filter.toLowerCase()));
   };
   ```

4. **Coverage**: Simple keyword matching handles the vast majority of content filtering needs:
   - Filter specific words or phrases
   - Filter mentions of users/handles
   - Filter hashtags
   - Block specific topics by keyword

5. **Iteration Path**: Starting simple allows gathering user feedback. If users demonstrate strong need for pattern matching, wildcards could be added in a future iteration without breaking existing filters.

### Implementation Requirements

1. **Filter Storage**: Store filters as simple string arrays
2. **Matching**: Case-insensitive `includes()` check against post text
3. **UI**: Simple text input for adding keywords, no pattern syntax documentation needed
4. **Validation**: Basic validation (non-empty, reasonable length limits)

### Trade-offs Accepted

| Aspect           | Consequence                                                    |
| ---------------- | -------------------------------------------------------------- |
| Pattern matching | Cannot filter by patterns like "any URL" or "numbers"          |
| Power users      | Less flexibility than regex would provide                      |
| Edge cases       | Some filters may need multiple keywords instead of one pattern |

### Future Considerations

If user feedback indicates strong demand for more flexible matching:

- Consider adding wildcards (\* and ?) as Option 3 in future iteration
- Evaluate user-submitted filter patterns to understand actual needs
- Never add full regex due to security concerns

Consequences:

- Content filter implementation simplified with no regex parsing
- No ReDoS vulnerability risk in filter matching
- Clear, simple UX for filter management
- Blocked task "Build custom content filter list management UI" can proceed with keyword-only implementation

### Blocked Tasks Now Unblocked

1. **Build custom content filter list management UI** - Can proceed with simple keyword matching

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212302272823502
- ReDoS Vulnerability: https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS
- Decision made by: Dustin Moskovitz (2025-12-03) - "Skip regex support, use simple keywords only"

## Decision: AT Protocol Read Receipts - Verify Protocol Support First

Date: 2025-12-04
Status: Accepted
Context: The task "Add read receipts to direct messages" assumes AT Protocol supports read receipt events, but this may not be available in the protocol.

### Decision

Only implement read receipts if supported by AT Protocol. Do not implement custom solutions outside the protocol.

### User Decision

"correct, only do what is supported"

### Implementation Guidance

1. Research AT Protocol specification for read receipt support
2. If supported: proceed with implementation using protocol-native features
3. If not supported: mark the blocked task as "won't fix" or deprioritize

The principle is to stay within protocol boundaries rather than building custom infrastructure that may not federate with other AT Protocol clients.

Consequences:

- Feature is protocol-dependent
- No custom read receipt infrastructure to maintain
- Consistent with AT Protocol ecosystem
- Blocked task "Add read receipts to direct messages" depends on protocol research

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212302272926139
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: AT Protocol Post Editing - Not Supported, Skip Feature

Date: 2025-12-04
Status: Accepted
Context: The task "Implement post editing with edit history" requires AT Protocol support for post versioning/edits.

### Decision

Skip post editing feature entirely. AT Protocol does not support post editing or version history.

### User Decision

"correct (it's not supported!)"

### Technical Analysis

AT Protocol's record system has immutability constraints. Posts are immutable records that cannot be modified after creation. The only available action is deletion (delete + optionally repost).

### Outcome

- Feature "Implement post editing with edit history" is not feasible
- No workarounds (delete+repost) will be pursued as they lose engagement
- Blocked task should be marked as not feasible/won't fix

Consequences:

- Post editing will not be implemented in ShadowSky
- Users must delete and repost to correct errors
- Aligns with official Bluesky client behavior
- No protocol compatibility issues

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212289422600824
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: DM Message Threading - Protocol-Dependent

Date: 2025-12-04
Status: Accepted
Context: The task "Implement message threading in DMs" proposes adding threaded conversations similar to Slack, but this requires AT Protocol support.

### Decision

Only implement message threading if supported by AT Protocol. The protocol's capabilities will constrain the implementation approach.

### User Decision

"only if supported! (if something is, that likely constrains the answer)"

### Implementation Guidance

1. Research AT Protocol DM/chat.bsky.\* lexicons for threading support
2. If protocol supports threading: implement according to protocol design (not Slack-style unless protocol allows)
3. If protocol doesn't support threading: skip this feature

The key insight is that if the protocol supports some form of threading, that support constrains how we implement it. We don't get to choose between Slack-style, quote-reply, or flat - we implement what the protocol provides.

### Next Steps

- Investigate `chat.bsky.*` lexicons for reply/thread capabilities
- Check if messages can reference parent messages
- Document findings before proceeding

Consequences:

- Threading approach determined by protocol, not UX preference
- May result in simpler or different threading than originally envisioned
- Guaranteed protocol compatibility
- Blocked task depends on protocol research

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212289422602075
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: Custom Filter Regex Support - Skip for Now

Date: 2025-12-04
Status: Accepted
Context: The task "Build custom content filter list management UI" mentions "optional regex pattern support" for content filters.

### Decision

Skip regex support entirely for now. Use simple case-insensitive keyword matching only.

### User Decision

"skip for now"

This aligns with the earlier decision documented above ("Use Simple Keywords Only for Custom Content Filters") but makes the user's intent even clearer - regex is explicitly skipped, not just deferred.

### Implementation

Content filters will use simple string matching:

```typescript
const matchesFilter = (text: string, filters: string[]): boolean => {
  const lowerText = text.toLowerCase();
  return filters.some((filter) => lowerText.includes(filter.toLowerCase()));
};
```

No regex, no wildcards, no pattern syntax.

Consequences:

- Simpler implementation and UX
- No ReDoS security vulnerabilities
- May revisit if user feedback demands more flexibility
- Blocked task can proceed with keyword-only approach

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212302272823502
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: Express Server Consolidation - Remove Duplicate Routes

Date: 2025-12-04
Status: Accepted
Context: The task "Refactor: Consolidate Express server AI endpoints into Lambda functions" needs to decide whether to remove Express AI routes entirely or proxy them to Lambda.

### Decision

Accept recommendation: Remove Express AI routes after Lambda authentication is implemented.

### User Decision

"ok accept rec"

### Implementation Plan

1. Ensure Lambda authentication is fully working (dependency)
2. Remove duplicate AI endpoints from `server/api-server.js`:
   - `/api/writing-feedback`
   - `/api/generate-alt-text`
   - `/api/adjust-tone`
   - `/api/optimize-thread`
   - `/api/suggest-hashtags`
   - `/api/style-analysis`
   - `/api/analyze-posts`
3. Update any client code hitting Express endpoints directly
4. All AI requests will go through Lambda only

### Benefits

- Single source of truth for AI endpoints
- Consistent auth/rate-limiting through Lambda
- Reduced maintenance burden
- Cleaner architecture

### Migration Notes

- This is a P2 task with time to plan
- Coordinate with any clients using Express endpoints
- Verify Lambda auth is production-ready before removal

Consequences:

- Express server becomes simpler (image proxy, WebSocket only)
- All AI features route through Lambda
- Blocked refactoring task is unblocked

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212266582901217
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: No Message Threading in DMs (Protocol Limitation)

Date: 2025-12-04
Status: Accepted
Context: The task "Implement message threading in DMs" proposed adding Slack-style threaded conversations. User decision was to only implement if supported by AT Protocol.

### Decision

Do NOT implement message threading in DMs. The AT Protocol does not support this feature.

### Research Findings

After thorough analysis of the AT Protocol chat.bsky.convo lexicons:

1. **No Threading Fields**: The `messageInput` and `messageView` schemas contain no threading fields:
   - No `replyTo` field
   - No `parentMessageId` field
   - No `threadId` field
   - No reference fields for linking messages together

2. **Message Schema** (`chat.bsky.convo.defs#messageInput`):
   - `text` (required): Message content (max 10,000 chars)
   - `facets` (optional): Annotations for mentions, URLs, hashtags
   - `embed` (optional): Embedded content

3. **sendMessage API**: Only accepts `convoId` and `message` - no threading parameters

4. **2025 Protocol Roadmap**: On-protocol DMs and E2EE group chat are planned but not imminent. Threading is not mentioned in roadmap priorities.

### User Decision

"only if supported! (if something is, that likely constrains the answer)"

### Consequences

- Blocked task "Implement message threading in DMs" is not feasible
- DMs will remain flat message lists (like most platforms)
- Future threading would require AT Protocol updates
- No custom implementation outside protocol boundaries

### Sources

- https://github.com/bluesky-social/atproto/blob/main/lexicons/chat/bsky/convo/defs.json
- https://docs.bsky.app/blog/2025-protocol-roadmap-spring
- https://github.com/bluesky-social/atproto/discussions/2321

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212289422602075
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: Hybrid Code Splitting for Composer (AI Features Lazy-Loaded)

Date: 2025-12-04
Status: Accepted
Context: The Composer component is a 3,770-line monolith that needs to be split into modules. The question was whether to use React.lazy() code splitting (separate JS bundles) or just component extraction (same bundle, conditional rendering).

### Options Evaluated

1. **Full code splitting with React.lazy()**: Separate JS bundles loaded on demand. Best for bundle size reduction but adds complexity with Suspense boundaries and loading states for all features.

2. **Component extraction only**: Keep in same bundle, use conditional rendering. Simpler but no bundle size benefit.

3. **Hybrid approach**: Code-split AI features (heaviest, rarely used), keep media/toolbar in main bundle. Balances bundle size savings with complexity.

### Decision

Accept recommendation: **Hybrid approach** - Code-split the AI features while keeping essential toolbar/media features in the main bundle.

### User Decision

"Q5: accept recommendation - hybrid"

### Implementation Guidelines

**Features to Code-Split (React.lazy)**:

- AI Writing Feedback panel
- AI Tone Adjustment controls
- AI Thread Optimization
- AI Hashtag Suggestions
- AI Style Analysis
- Post Analysis features

These AI features:

- Include Lambda integrations
- Are rarely used relative to basic composing
- Have significant bundle size impact
- Can tolerate slight loading delay

**Features to Keep in Main Bundle**:

- Core text area and character count
- Basic toolbar (bold, italic, links)
- Media upload controls
- Thread preview
- Draft save/load
- Post button and submission logic

These features:

- Are used on every post composition
- Need instant availability
- Are relatively lightweight
- Are critical path for UX

### Technical Implementation

```tsx
// AI features loaded lazily
const ComposerAIFeatures = React.lazy(() => import("./ComposerAIFeatures"));

// In Composer component
<Suspense fallback={<AIFeaturesLoading />}>
  {showAIFeatures && <ComposerAIFeatures {...props} />}
</Suspense>;
```

### Consequences

- Reduced initial bundle size (AI features ~30-50KB estimated)
- Users who don't use AI features never load that code
- Slight delay when first opening AI features (acceptable tradeoff)
- Simpler Suspense boundary management (only one lazy boundary for AI)
- Essential composing features remain instant
- Clear architectural separation of AI vs core functionality

### Blocked Task Unblocked

- "Split Composer into lazy-loaded feature modules by viewport tier"

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212310047098775
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: Network Tier Fallback - Assume 4G+ (Optimistic) When Navigator.connection Unavailable

Date: 2025-12-04
Status: Accepted
Context: The Network Information API (Navigator.connection) has limited browser support (~75% coverage). Safari and Firefox don't support it. A fallback behavior was needed when the API is unavailable.

### Question

How should network quality be determined when the Navigator.connection API is unavailable?

### Options Considered

1. **Assume 4G+ (optimistic)**: Treat unsupported browsers as fast connections, full features enabled
2. **Assume 3G (conservative)**: Default to medium tier, some feature reduction
3. **Latency-based heuristic**: Measure API request latency on first few requests to estimate connection quality
4. **User preference**: Let users manually set connection preference in settings

### Decision

Accept recommendation: **Assume 4G+ (optimistic)**

### Rationale

- Safari users are typically on desktop/WiFi, and penalizing them with reduced features when we can't detect their connection would hurt UX
- This is the approach used by most major apps
- The codebase already follows this pattern in `src/services/background-sync-service.ts`:
  - `isOnWifi()` returns `true` when API unavailable (line 622)
  - `isOnSlowConnection()` returns `false` when API unavailable (line 635)

### Impact

Affects how Safari/Firefox users experience:

- Media preloading behavior
- Pagination batch sizes
- Feature availability on initial load

### Consequences

- Users on slow connections in unsupported browsers may experience heavier resource loading
- Consistent with existing codebase patterns
- Better UX for majority of Safari/Firefox users (typically on fast connections)
- Simple implementation with no complexity from latency measurement or user settings

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212308503575572
- Decision made by: Auto-approved (matches recommended approach and existing codebase pattern)

## Decision: Use react-spring-bottom-sheet for Mobile Bottom Sheets

Date: 2025-12-04
Status: Accepted
Context: The mobile composer refactoring requires a BottomSheet component with spring physics, gesture handling, and snap points. This is complex functionality that can either be built from scratch or use an established library.

### Question

Should we build a custom BottomSheet component from scratch or use an existing library?

### Options Considered

1. **Custom implementation**: Full control, matches exact requirements, no dependencies
2. **react-spring-bottom-sheet**: Popular, well-tested, spring physics built-in (~15KB)
3. **Radix Dialog with custom styling**: Accessible foundation, add gesture handling
4. **Framer Motion AnimatePresence**: Flexible animations, requires custom gesture code

### Decision

Accept recommended: **react-spring-bottom-sheet**

### Rationale

- Battle-tested library with built-in spring physics
- Handles complex gesture recognition automatically
- Accessibility concerns addressed out of the box
- ~15KB bundle size is reasonable trade-off
- Building custom would take significantly longer and introduce bugs
- Development time: days vs potentially weeks for robust custom solution

### User Decision

Approved via "✅ Approved" Validation Status on Asana task

### Implementation Notes

- Install: `npm install react-spring-bottom-sheet`
- Use for composer AI features bottom sheet on mobile
- Configure snap points for partial/full expansion states
- Integrate with existing mobile gesture system

### Consequences

- Adds ~15KB to bundle size
- Standardized behavior matching platform conventions
- Reduced development time for mobile features
- Blocked tasks can proceed:
  - Create mobile bottom sheet component for composer actions
  - Refactor Composer AI features to use bottom sheet on mobile

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212306769448458
- Decision made by: Dustin Moskovitz (2025-12-04)

---

## Decision: Performance Metrics Dashboard Location

Date: 2025-12-04
Status: Accepted
Asana Task: https://app.asana.com/0/1211710875848660/1212310945748165

### Context

The performance dashboard task required clarification on where the Performance Metrics dashboard should be accessible and whether it should be visible to all users or only developers. Options considered:

1. **Settings menu (all users)** - Add to existing settings as "Performance" section
   - Pros: Discoverable by all users, useful for power users debugging slow experiences
   - Cons: May confuse non-technical users

2. **Dev tools menu (developers only)** - Hidden behind developer mode flag
   - Pros: Keeps UI clean for regular users, no confusion
   - Cons: Less visibility, requires enabling dev mode

3. **Both locations** - Settings for basic view, dev tools for advanced
   - Pros: Flexible for different user types
   - Cons: More UI work, potentially redundant

### Decision

Accept recommended: **Settings menu (all users)** - Add performance metrics as a section in the existing Settings page.

### Rationale

- Power users and developers benefit from seeing their device's performance
- Social apps like Bluesky have technically-savvy users who appreciate transparency
- Makes performance data discoverable without requiring hidden developer modes
- Simplest implementation - single location to maintain

### User Decision

Approved via "✅ Approved" Validation Status on Asana task

### Implementation Notes

- Add "Performance" section to the existing Settings page (`src/pages/Settings.tsx`)
- Create `PerformanceSettings.tsx` component in `src/components/settings/`
- Display Web Vitals metrics (LCP, FID, CLS, etc.)
- Include device/browser performance indicators
- Consider adding basic explanations for non-technical users

### Consequences

- Performance data visible to all users via Settings > Performance
- No need for separate developer mode infrastructure
- Blocked tasks can proceed:
  - Create performance metrics dashboard page for Web Vitals visualization

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212310945748165
- Decision made by: Dustin Moskovitz (2025-12-04)

## Decision: Use Recharts for Performance Dashboard Visualizations

Date: 2025-12-04
Status: Accepted
Context: The performance metrics dashboard needs charts to visualize Web Vitals and other performance data. A charting library decision was required.

### Question

Which charting library should be used for the performance metrics dashboard?

### Options Considered

1. **Recharts**: React-native charting library built on D3
   - Pros: Declarative React components, good documentation, wide adoption
   - Cons: Larger bundle (~100KB), depends on D3

2. **Chart.js**: Popular lightweight option
   - Pros: Smaller bundle (~60KB), widely used
   - Cons: Less React-native, requires wrapper components

3. **Custom SVG**: Build simple charts with raw SVG
   - Pros: Minimal bundle impact, full control
   - Cons: More development time, less feature-rich, maintenance burden

### Decision

Accept recommended: **Recharts**

### Rationale

- Most React-idiomatic option with declarative component API
- Well-documented with strong community support
- Good fit for the responsive, interactive charts needed in a performance dashboard
- Development time savings outweigh bundle size concerns
- Consistent with React patterns used throughout the codebase

### Implementation Notes

- **Note**: Recharts is NOT currently in dependencies - must be installed: `npm install recharts`
- Use for Web Vitals visualization: LCP, FID, CLS metrics
- Consider code-splitting the dashboard page to minimize initial bundle impact
- Leverage ResponsiveContainer for mobile compatibility

### Consequences

- Adds ~100KB (gzipped ~30KB) to bundle for pages using charts
- Standardized charting approach across the application
- Faster implementation of performance dashboard
- Blocked tasks can proceed:
  - Create performance metrics dashboard page for Web Vitals visualization

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212310943731038
- Decision made by: Dustin Moskovitz (2025-12-04) - via Validation Status approval

---

## Decision: Use size-limit for Bundle Size Enforcement in CI

Date: 2025-12-04
Status: Accepted
Asana Task: https://app.asana.com/0/1211710875848660/1212310942064215

### Context

The CI enforcement pipeline needs bundle size budgets to prevent bundle bloat. The task mentioned using either `bundlesize` or `size-limit` package but didn't specify which tool to use.

### Question

Which bundle size enforcement tool should be used for CI integration?

### Options Considered

1. **size-limit**: Modern, well-maintained, supports multiple budgets
   - Pros: Active development, good Vite support, built-in CI integration, tracks size over time
   - Cons: Slightly more config than bundlesize

2. **bundlesize**: Simple, widely used
   - Pros: Very simple config, mature
   - Cons: Less actively maintained, fewer features

3. **Vite plugin (rollup-plugin-visualizer enhanced)**: Use existing visualizer with size checks
   - Pros: Already have visualizer, no new dependency
   - Cons: Need custom CI integration, less standard

### Decision

Accept recommended: **size-limit**

### Rationale

- Better maintained with active development
- Built-in support for Vite/Rollup build systems
- Includes historical tracking for monitoring bundle growth over time
- Integrates well with GitHub Actions for PR comments showing size changes
- Provides better developer experience with size delta visualization in PRs

### Implementation Notes

- **Note**: size-limit is NOT currently in dependencies - must be installed:
  ```bash
  npm install --save-dev size-limit @size-limit/preset-app @size-limit/file
  ```
- Add `.size-limit.json` configuration or `size-limit` field in `package.json`
- Add GitHub Action workflow for PR size comments using `size-limit/action`
- Configure budgets for main entry points and critical chunks

### Consequences

- Bundle size will be enforced in CI pipeline
- PRs will show size delta before/after changes
- Developers get early warning about bundle bloat
- Blocked tasks can proceed:
  - Add bundle size budgets to vite.config with CI enforcement

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212310942064215
- Decision made by: Dustin Moskovitz (2025-12-04) - via Validation Status approval

---

## Decision: Incremental Extraction for Composer.tsx Refactoring

Date: 2025-12-04
Status: Accepted
Asana Task: https://app.asana.com/0/1211710875848660/1212308515122763

### Context

Task 'Refactor: Split Composer.tsx into focused lazy-loaded modules' proposes splitting a 3561-line component. The Composer is a critical user-facing feature - any bugs would directly impact the core posting experience. Given the high-risk nature of refactoring a critical component, a testing/validation approach needed to be determined.

### Question

What testing/validation approach should be used for refactoring the critical Composer component?

### Options Considered

1. **Test-first refactoring**: Write comprehensive tests for current behavior BEFORE refactoring
   - Pros: Safety net ensures no regressions
   - Cons: Adds significant time to the task

2. **Refactor with manual QA**: Refactor first, do thorough manual testing after
   - Pros: Faster initial delivery
   - Cons: Higher risk of subtle regressions

3. **Incremental extraction**: Extract one module at a time with testing between each
   - Pros: Lower risk per change, easier to identify issues
   - Cons: Slower overall, more PRs to review

### Decision

Accept recommended: **Incremental extraction**

### Rationale

- For a 3561-line critical component, extracting one module at a time minimizes risk
- Each extraction can be tested independently before moving to the next
- If issues arise, they're isolated to a single change, making debugging straightforward
- Allows for course-correction if architectural assumptions prove incorrect
- Maintains application stability throughout the refactoring process
- Start with the most isolated component (e.g., EmojiPickerIntegration) to establish patterns

### Implementation Notes

- Begin with most isolated modules first (EmojiPickerIntegration is likely most isolated)
- Test each extracted module before proceeding to the next
- Create separate PRs for each major extraction to enable focused code review
- Document extraction patterns established for consistency across modules
- Consider creating a shared types file early to prevent circular dependencies

### Consequences

- Refactoring will take longer but with significantly reduced risk
- Multiple smaller PRs instead of one large PR
- Each extraction becomes a learning opportunity for the next
- Blocked task can proceed with clear guidance:
  - Refactor: Split Composer.tsx into focused lazy-loaded modules

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212308515122763
- Blocked Task: https://app.asana.com/0/1211710875848660/1212309442715293
- Decision made by: Dustin Moskovitz (2025-12-04) - via Validation Status approval

---

## Decision: Optimistic Animation Triggers for PostActionBar

Date: 2025-12-04
Status: Accepted (Feature Rejected)
Asana Task: https://app.asana.com/0/1211710875848660/1212311514416194

### Context

The task to add micro-interaction animations to PostActionBar success states (like, repost, bookmark) required a decision on when animations should trigger. The app uses optimistic updates via `useOptimisticPosts.ts`, meaning UI state updates immediately before server confirmation.

### Question

When should success animations trigger - on optimistic update (immediate) or on server confirmation (delayed)?

### Options Considered

1. **Optimistic (immediate)**: Animate as soon as user clicks
   - Pros: Instant feedback, feels responsive
   - Cons: Animation plays even if request fails (need to handle rollback)

2. **Server confirmation**: Animate only after server confirms success
   - Pros: Animation is always 'truthful'
   - Cons: Delay makes app feel sluggish (defeats purpose of optimistic updates)

3. **Hybrid**: Immediate subtle animation + enhanced animation on confirmation
   - Pros: Best of both worlds
   - Cons: More complex, may feel over-animated

### Decision

**Optimistic (immediate)** - Approved

### Rationale

- Aligns with the existing optimistic update pattern in the codebase
- Users expect immediate feedback from modern social apps
- If the request fails, the rollback will naturally reverse the visual state
- Industry standard: Twitter, Instagram, and other social apps use this pattern
- Keeps the app feeling snappy and responsive

### Implementation Notes

**Note**: While this decision was approved, the actual implementation task ("Add micro-interaction animations to PostActionBar success states") was rejected/skipped. The decision is documented here for future reference if animations are revisited.

- Animation keyframes exist: `animate-bookmark-bounce`, `animate-like-pulse`, etc.
- Would trigger animations in the optimistic update handlers
- Rollback would naturally remove the active animation state

### Consequences

- Decision documented for future reference
- If animations are implemented later, use optimistic trigger pattern
- Maintains consistency with existing UI update patterns

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212311514416194
- Related Task (Rejected): https://app.asana.com/0/1211710875848660/1212311532467596
- Decision made by: Dustin Moskovitz (2025-12-04) - via Validation Status approval

---

## Decision: Uniform Scale-105 for Hover Animation Reduction

Date: 2025-12-04
Status: Accepted
Asana Task: https://app.asana.com/0/1211710875848660/1212311529588064

### Context

The codebase has 27 instances of `hover:scale-110` across action buttons and interactive elements. The task proposes reducing these effects from scale-110 to scale-105 to create a more subtle, professional hover experience. However, the description also mentioned alternatives like `hover:opacity-80` or `hover:bg` changes for secondary actions.

### Question

For the 27 instances of hover:scale-110, should we apply a uniform approach or differentiate by element type?

### Options Considered

1. **Uniform scale-105**: Replace ALL hover:scale-110 with hover:scale-105
   - Pros: Simple, consistent, easy to maintain
   - Cons: May be too subtle for some elements that benefit from emphasis

2. **Tiered approach**: Primary actions get scale-105, secondary actions get opacity/color only
   - Pros: More nuanced, distinguishes action importance
   - Cons: More complex, requires classification of each element

3. **Remove scale entirely**: Use only color/opacity changes for all hover states
   - Pros: Cleanest, most professional look
   - Cons: May reduce perceived interactivity

### Decision

**Uniform scale-105** - Approved

### Rationale

- Maintains the interactive feel users expect while reducing the 'bouncy' effect
- Simple to implement with predictable, consistent results
- Scale-105 is an industry-standard subtle hover effect
- Can always iterate to a tiered approach later if needed
- Easy to maintain - one pattern across all interactive elements

### Implementation Notes

- Replace all `hover:scale-110` with `hover:scale-105` across the codebase
- Affects approximately 27 instances
- No need to classify elements by type or importance
- Maintain existing `transition-transform` classes for smooth animations

### Consequences

- All interactive elements will have a consistent, subtle scale effect
- Users will experience a more refined, less "hyperactive" interface
- Future refinements can build on this baseline if needed

References:

- Asana Task: https://app.asana.com/0/1211710875848660/1212311529588064
- Blocked Task: Reduce hover:scale effects from 110 to 105 across action buttons
- Decision made by: Dustin Moskovitz (2025-12-04) - via Validation Status approval
