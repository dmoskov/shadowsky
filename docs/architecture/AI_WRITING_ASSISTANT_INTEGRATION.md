# AI Writing Assistant Integration Architecture

## Document Information
- **Created**: 2025-12-27
- **Asana Task**: https://app.asana.com/0/1211710875848660/1212598914422287
- **Status**: Active Implementation
- **Version**: 1.0

## Executive Summary

This document defines the technical architecture for the AI Writing Assistant integration in ShadowSky (BSKY), which provides AI-powered writing features in the composer interface. The system currently uses a **cloud API approach (Anthropic Claude)** through a secure backend service, offering high-quality AI capabilities without exposing API keys to the client.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Implementation Approach](#implementation-approach)
3. [System Components](#system-components)
4. [Data Flow](#data-flow)
5. [Authentication & Security](#authentication--security)
6. [Error Handling](#error-handling)
7. [User Interface Touchpoints](#user-interface-touchpoints)
8. [API Endpoints](#api-endpoints)
9. [Performance Considerations](#performance-considerations)
10. [Future Enhancements](#future-enhancements)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌────────────────────────────────────────────────────────┐    │
│  │          Composer Component (React)                     │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │ ComposerUI   │  │ AIFeatures   │  │ Toolbar      │ │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │    │
│  └─────────┼──────────────────┼──────────────────┼─────────┘    │
│            │                  │                  │               │
│            └──────────────────┴──────────────────┘               │
│                               │                                  │
│                    ┌──────────▼──────────┐                      │
│                    │  Anthropic Service  │                      │
│                    │   (Client Module)   │                      │
│                    └──────────┬──────────┘                      │
└───────────────────────────────┼──────────────────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │   Network Layer      │
                    │  (Fetch + Retry)     │
                    └───────────┬──────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│                      Backend Service Layer                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │        API Gateway (AWS / Express Dev Server)           │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │                API Endpoints                             │    │
│  │  • /api/adjust-tone                                      │    │
│  │  • /api/optimize-thread                                  │    │
│  │  • /api/suggest-hashtags                                 │    │
│  │  • /api/writing-feedback                                 │    │
│  │  • /api/style-analysis                                   │    │
│  │  • /api/generate-alt-text                                │    │
│  │  • /api/analyze-posts                                    │    │
│  │  • /api/thread-summary                                   │    │
│  │  • /api/fetch-link-metadata                              │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │           Authentication Middleware                      │    │
│  │        (Validates API keys & headers)                    │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │         Anthropic Claude API Integration                 │    │
│  │          (Server-side API key storage)                   │    │
│  └──────────────────────────┬──────────────────────────────┘    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                  ┌───────────▼───────────┐
                  │   Anthropic Cloud     │
                  │   Claude API          │
                  └───────────────────────┘
```

---

## Implementation Approach

### Chosen Architecture: **Cloud API (Anthropic Claude)**

After evaluating the three options from the parent task, the system implements **Option A: Cloud API with backend proxy**:

#### Rationale

1. **High Quality**: Claude provides superior writing assistance compared to local models
2. **No Client Overhead**: No browser resource usage or long initial loads
3. **Security**: API keys stored securely on server, never exposed to client
4. **Scalability**: Leverages Anthropic's infrastructure for reliability
5. **Privacy Balance**: Backend acts as privacy layer - user data processed by trusted provider

#### Trade-offs Accepted

- **Cost**: Per-request API costs (mitigated by caching and rate limiting)
- **Privacy**: Content sent to Anthropic (acceptable for public social media posts)
- **Dependency**: Reliance on external service (mitigated by error handling)

---

## System Components

### 1. Client Layer Components

#### A. Anthropic Service (`src/services/anthropic.ts`)
- **Purpose**: Client-side interface to backend AI services
- **Responsibilities**:
  - Call backend AI endpoints
  - Handle request/response serialization
  - Implement retry logic
  - Parse and return typed results
- **Key Functions**:
  - `adjustTone()`: Adjust post tone (professional, casual, humorous, etc.)
  - `optimizeThread()`: Split long text into threaded posts
  - `suggestHashtags()`: Generate relevant hashtag suggestions
  - `getWritingFeedback()`: Get AI feedback on writing quality
  - `getStyleMatchedWritingFeedback()`: Analyze if post matches user's style
  - `generateAltText()`: Generate image descriptions for accessibility
  - `analyzePosts()`: Analyze user's posting patterns and engagement
  - `generateThreadSummary()`: Summarize long threads

#### B. Composer Components
- **ComposerToolbar** (`src/components/composer/ComposerToolbar.tsx`)
  - Renders AI feature buttons (tone adjustment, feedback)
  - Implements progressive disclosure (primary/standard/advanced levels)
  - Handles button states (loading, disabled, active)

- **ComposerAIFeatures** (`src/components/composer/ComposerAIFeatures.tsx`)
  - Manages AI feature UI panels
  - Displays tone options, feedback results, hashtag suggestions
  - Handles user interactions with AI results

- **ComposerState** (`src/components/composer/useComposerState.ts`)
  - Manages AI feature state (loading, results, preferences)
  - Coordinates between UI and service layer
  - Persists AI settings to user preferences

#### C. Configuration Module (`src/config/amplify.ts`)
- **Purpose**: Environment-aware API configuration
- **Responsibilities**:
  - Determine API base URL based on environment
  - In development: Use Vite proxy (avoids CORS)
  - In production: Use AWS API Gateway endpoint
  - Parse Amplify configuration

### 2. Network Layer

#### Retry Logic (`src/utils/retry.ts`)
- **Features**:
  - Exponential backoff for transient failures
  - Configurable retry attempts and timeouts
  - Special handling for different API types (alt text has longer timeout)
  - Blob URL to Data URL conversion for image processing

#### API Authentication (`src/utils/api-auth.ts`)
- **Purpose**: Add authentication headers to backend requests
- **Headers**: Custom auth tokens for backend validation

### 3. Backend Service Layer

#### API Gateway
- **Development**: Express server on localhost:3002, proxied by Vite
- **Production**: AWS API Gateway + Lambda Functions
- **Features**:
  - HTTPS/TLS encryption
  - Request validation
  - Rate limiting
  - Error handling

#### Authentication Middleware
- **Purpose**: Validate client requests before forwarding to Anthropic
- **Checks**:
  - Verify API authentication headers
  - Validate request payload structure
  - Check rate limits per user/IP
  - Log requests for monitoring

#### Anthropic Integration Layer
- **Purpose**: Secure interface to Anthropic's API
- **Responsibilities**:
  - Store API keys securely (environment variables, AWS Secrets Manager)
  - Format requests for Anthropic's API
  - Handle Anthropic-specific errors
  - Cache responses when appropriate
  - Track usage and costs

---

## Data Flow

### Example Flow: Tone Adjustment

```
1. User Action
   └─> User clicks "Adjust Tone" button, selects "Professional"

2. Client Processing
   └─> ComposerToolbar triggers onToggleToneOptions()
       └─> ComposerState updates selectedTone = "professional"
           └─> Calls anthropic.adjustTone(text, "professional")

3. API Request
   └─> AnthropicService constructs request:
       {
         method: "POST",
         url: "/api/adjust-tone",
         headers: {
           "Content-Type": "application/json",
           ...authHeaders
         },
         body: { text: "...", tone: "professional" }
       }
   └─> fetchWithRetry() sends request with retry logic

4. Backend Processing
   └─> API Gateway receives request
       └─> Auth middleware validates headers
           └─> Route to tone adjustment handler
               └─> Handler calls Anthropic API with server API key
                   └─> Anthropic processes request with Claude model

5. Response Path
   └─> Anthropic returns adjusted text
       └─> Backend validates and formats response
           └─> API Gateway returns JSON:
               {
                 adjustedText: "...",
                 originalText: "...",
                 tone: "professional"
               }

6. Client Receives Response
   └─> AnthropicService parses response
       └─> ComposerState updates tonePreview
           └─> ComposerAIFeatures displays preview UI
               └─> User can accept or reject changes
```

### Data Flow Characteristics

- **Synchronous**: Most operations are request/response
- **Timeouts**:
  - Default: 60 seconds
  - Alt text generation: 90 seconds (image processing takes longer)
- **Retries**: 3 attempts with exponential backoff
- **Caching**: Thread summaries cached to avoid redundant API calls

---

## Authentication & Security

### Security Architecture

#### 1. API Key Management
```
┌────────────────────────────────────────────────────────┐
│                   Security Layers                       │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Client (Browser)                                       │
│  ┌─────────────────────────────────────┐              │
│  │ ❌ NO API keys stored                │              │
│  │ ✅ Only calls backend endpoints      │              │
│  │ ✅ Auth headers for backend          │              │
│  └─────────────────────────────────────┘              │
│                     │                                   │
│                     ▼                                   │
│  Backend Server                                         │
│  ┌─────────────────────────────────────┐              │
│  │ ✅ Anthropic API key in env vars     │              │
│  │ ✅ Validates client auth headers     │              │
│  │ ✅ Rate limiting per client          │              │
│  │ ✅ Request sanitization              │              │
│  └─────────────────────────────────────┘              │
│                     │                                   │
│                     ▼                                   │
│  Anthropic Cloud                                        │
│  ┌─────────────────────────────────────┐              │
│  │ ✅ TLS/HTTPS encryption              │              │
│  │ ✅ API key validation                │              │
│  │ ✅ Rate limiting                     │              │
│  └─────────────────────────────────────┘              │
│                                                         │
└────────────────────────────────────────────────────────┘
```

#### 2. Authentication Flow
1. **Client → Backend**:
   - Custom authentication headers (`getApiAuthHeaders()`)
   - Could be JWT tokens, session cookies, or API keys for authenticated users
   - Prevents unauthorized access to backend AI endpoints

2. **Backend → Anthropic**:
   - Server stores Anthropic API key securely (environment variable)
   - Server includes key in `Authorization: Bearer {key}` header
   - Key never exposed to client

#### 3. Data Privacy
- **In Transit**: All communication over HTTPS/TLS
- **At Rest**: API keys in secure storage (AWS Secrets Manager in production)
- **Processing**: User content sent to Anthropic for processing
  - Acceptable for public social media posts
  - Users posting sensitive content should be aware
  - Future: Add user consent/warning for private accounts

#### 4. Rate Limiting
- **Client-side**: Debouncing and request throttling
- **Backend**: Rate limits per IP/user to prevent abuse
- **Anthropic**: Respects API rate limits, handles 429 errors gracefully

---

## Error Handling

### Error Strategy

#### 1. Error Types and Handling

| Error Type | Status Code | Client Handling | User Message |
|------------|-------------|-----------------|--------------|
| Invalid API Key | 401 | Retry not helpful | "AI service authentication failed" |
| Rate Limited | 429 | Exponential backoff | "Too many requests, please wait" |
| Timeout | 408/Timeout | Retry with backoff | "Request timed out, please try again" |
| Server Error | 500 | Retry with backoff | "AI service temporarily unavailable" |
| Network Error | N/A | Retry with backoff | "Network error, check connection" |
| Invalid Input | 400 | Don't retry | "Invalid input, please check your text" |

#### 2. Retry Logic Implementation

```typescript
// From src/utils/retry.ts
const API_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelay: 1000,    // 1 second
  maxDelay: 5000,        // 5 seconds
  backoffFactor: 2,      // Exponential backoff
  timeout: 60000         // 60 seconds
};

const ALT_TEXT_RETRY_OPTIONS = {
  maxRetries: 3,
  initialDelay: 2000,    // 2 seconds
  maxDelay: 10000,       // 10 seconds
  backoffFactor: 2,
  timeout: 90000         // 90 seconds (image processing)
};
```

#### 3. User-Facing Error Messages

Errors are caught and transformed into user-friendly messages:

```typescript
try {
  const result = await adjustTone(text, tone);
  return result;
} catch (error) {
  if (error.message.includes("401")) {
    showError("AI service authentication failed. Please try again later.");
  } else if (error.message.includes("429")) {
    showError("Too many requests. Please wait a moment and try again.");
  } else {
    showError("AI feature temporarily unavailable. Please try again.");
  }
}
```

#### 4. Graceful Degradation

- **Feature Unavailable**: Composer remains functional without AI features
- **Partial Results**: If some AI features fail, others still work
- **Loading States**: Clear indicators when AI processing is happening
- **Cancellation**: Users can continue without waiting for AI results

---

## User Interface Touchpoints

### 1. Composer Toolbar

**Location**: `src/components/composer/ComposerToolbar.tsx`

**AI Feature Buttons**:
- **Tone Adjustment** (Wand icon): Opens tone selection panel
  - Displayed at "standard" disclosure level or higher
  - Shows active state when tone is selected
  - Disabled while processing

- **Writing Feedback** (MessageSquare icon): Requests AI feedback
  - Displayed at "advanced" disclosure level
  - Disabled when text is empty or processing
  - Shows loading state during analysis

**Progressive Disclosure**:
- **Primary Level**: Core features (media, emoji, thread split)
- **Standard Level**: + Tone adjustment
- **Advanced Level**: + Writing feedback
- Toggle button shows current level and switches between them

### 2. AI Features Panel

**Location**: `src/components/composer/ComposerAIFeatures.tsx`

**Panels**:

#### A. Tone Adjustment Panel
- **Trigger**: Click tone adjustment button
- **UI Elements**:
  - 5 tone options (Professional, Casual, Humorous, Informative, Inspirational)
  - Each option shows icon, label, and description
  - Preview of adjusted text before applying
  - "Apply" and "Cancel" buttons
- **State Management**:
  - `selectedTone`: Currently selected tone
  - `tonePreview`: Adjusted text preview
  - `isAdjustingTone`: Loading state

#### B. Writing Feedback Panel
- **Trigger**: Click feedback button
- **UI Elements**:
  - Assessment summary (overall quality)
  - Corrected version (grammar/spelling fixes)
  - Enhanced version (style improvements)
  - Style analysis (matches user's typical style)
  - List of specific changes/improvements
  - "Apply Corrected" / "Apply Enhanced" buttons
- **State Management**:
  - `writingFeedback`: Complete feedback object
  - `isLoadingFeedback`: Loading state
  - `showWritingFeedback`: Panel visibility

#### C. Hashtag Suggestions Panel
- **Trigger**: Automatic or manual request
- **UI Elements**:
  - List of suggested hashtags
  - Relevance scores
  - Trending indicators
  - Click to insert into text
- **State Management**:
  - `hashtagSuggestions`: Array of suggestions
  - `isLoadingHashtags`: Loading state
  - `enableHashtagSuggestions`: User preference

#### D. Thread Optimization Panel
- **Trigger**: Manual request or automatic detection of long text
- **UI Elements**:
  - Preview of split posts
  - Suggested format (simple/brackets/thread/dots)
  - Ability to edit individual posts
  - "Apply" and "Cancel" buttons
- **State Management**:
  - `threadOptimizationResult`: Split posts and metadata
  - `showThreadPreview`: Panel visibility

### 3. Media Upload Integration

**Location**: `src/components/composer/ComposerMediaUpload.tsx`

**AI Feature**: Alt Text Generation
- **Trigger**:
  - Automatic: When `autoGenerateAltText` preference is enabled
  - Manual: "Generate Alt Text" button on each image
- **UI Elements**:
  - Loading spinner on image during generation
  - Success indicator when alt text is ready
  - Editable alt text field
  - Character count (Bluesky limit: 1000 chars)
- **State Management**:
  - `generatingAltTextFor`: Image ID currently being processed
  - `media[i].alt`: Generated/edited alt text for each image

### 4. Settings Integration

**Location**: `src/components/composer/ComposerSettings.tsx`

**AI Preferences**:
- **Auto-generate Alt Text**: Toggle for automatic alt text generation
- **Hashtag Suggestions**: Enable/disable hashtag suggestions
- These preferences are saved to user preferences service

### 5. Status Indicators

**Loading States**:
- Button shows spinner/loading indicator
- Disabled state prevents multiple concurrent requests
- Status messages: "Adjusting tone...", "Analyzing writing...", "Generating alt text..."

**Error States**:
- Toast notifications for errors
- Error messages below buttons
- Retry options where appropriate

---

## API Endpoints

### Base URL Configuration

- **Development**: Empty string `""` → Vite proxy forwards to `localhost:3002`
- **Production**: AWS API Gateway URL from `amplify_outputs.json`

### Endpoint Specifications

#### 1. POST /api/adjust-tone

**Purpose**: Adjust text tone using AI

**Request**:
```typescript
{
  text: string;      // Original text
  tone: "professional" | "casual" | "humorous" | "informative" | "inspirational";
}
```

**Response**:
```typescript
{
  adjustedText: string;   // Text with adjusted tone
  originalText: string;   // Original for comparison
  tone: string;          // Applied tone
}
```

**Errors**: 401 (auth), 429 (rate limit), 500 (server error)

---

#### 2. POST /api/optimize-thread

**Purpose**: Split long text into optimal thread posts

**Request**:
```typescript
{
  text: string;              // Long text to split
  maxCharsPerPost: number;   // Default: 300
}
```

**Response**:
```typescript
{
  segments: Array<{
    text: string;
    number: number;
    isStandalone: boolean;
  }>;
  summary: string;
  suggestedFormat: "simple" | "brackets" | "thread" | "dots";
  totalPosts: number;
}
```

---

#### 3. POST /api/suggest-hashtags

**Purpose**: Generate relevant hashtag suggestions

**Request**:
```typescript
{
  text: string;              // Post text
  existingTags?: string[];   // Already included tags
}
```

**Response**:
```typescript
{
  hashtags: Array<{
    tag: string;
    relevance: number;
    isTrending: boolean;
  }>;
  category: string;
}
```

---

#### 4. POST /api/writing-feedback

**Purpose**: Get AI feedback on writing quality

**Request**:
```typescript
{
  text: string;  // Post text to analyze
}
```

**Response**:
```typescript
{
  assessment: {
    summary: string;
    hasIssues: boolean;
  };
  correctedVersion: {
    text: string;
    changes: string[];  // List of corrections
  };
  enhancedVersion: {
    text: string;
    improvements: string[];  // List of enhancements
  };
}
```

---

#### 5. POST /api/style-analysis

**Purpose**: Analyze if text matches user's writing style

**Request**:
```typescript
{
  currentText: string;        // Text to analyze
  historicalPosts: string[];  // User's past posts (5-30 posts)
}
```

**Response**:
```typescript
{
  userStyleSummary: string;
  matchesStyle: boolean;
  styleNotes: string[];
}
```

---

#### 6. POST /api/generate-alt-text

**Purpose**: Generate image alt text for accessibility

**Request**:
```typescript
{
  imageUrl: string;  // Data URL (base64) or blob URL
}
```

**Response**:
```typescript
{
  altText: string;  // Generated description (up to 500 chars)
}
```

**Notes**:
- Longer timeout (90s) due to image processing
- Blob URLs converted to data URLs client-side before sending

---

#### 7. POST /api/analyze-posts

**Purpose**: Analyze user's posting patterns and engagement

**Request**:
```typescript
{
  posts: Array<{
    text: string;
    createdAt: string;
    likes: number;
    reposts: number;
    replies: number;
  }>;
  analysisType: "haiku" | "sonnet";  // Model size
}
```

**Response**:
```typescript
{
  contentThemes: Array<{
    theme: string;
    description: string;
    frequency: "primary" | "regular" | "occasional";
    examples: string[];
  }>;
  writingStyle: {
    tone: string;
    characteristics: string[];
    voiceDescription: string;
  };
  engagementPatterns: {
    topPerformers: string[];
    contentStrengths: string[];
    observations: string[];
  };
  summary: string;
  optimalPostingTimes?: {
    recommendations: Array<{
      hour: number;
      dayOfWeek: number;
      avgEngagement: number;
      confidence: "high" | "medium" | "low";
    }>;
  };
}
```

---

#### 8. POST /api/thread-summary

**Purpose**: Generate summary of long threads

**Request**:
```typescript
{
  posts: Array<{
    text: string;
    author: string;
    authorHandle: string;
    likes: number;
    replies: number;
    reposts: number;
    uri: string;
    parentUri?: string;
    depth?: number;
  }>;
  format: "haiku" | "tldr" | "keypoints" | "extended" | "brief" | "moderate" | "detailed" | "comprehensive";
}
```

**Response**:
```typescript
{
  summary: string;
  format: string;
  metadata: {
    postCount: number;
    authors: string[];
    generatedAt: string;
    cached?: boolean;
    totalEngagement?: number;
    highlightedSubThreads?: Array<{
      uri: string;
      authorHandle: string;
      snippet: string;
      engagement: number;
    }>;
  };
}
```

**Query Parameters**:
- `?forceRefresh=true`: Bypass cache, regenerate summary

---

#### 9. POST /api/fetch-link-metadata

**Purpose**: Fetch Open Graph metadata for links

**Request**:
```typescript
{
  url: string;  // URL to fetch metadata for
}
```

**Response**:
```typescript
{
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
}
```

**Notes**: Used for link previews in composer

---

## Performance Considerations

### 1. Optimization Strategies

#### Client-Side Optimizations
- **Debouncing**: Hashtag suggestions debounced to avoid excessive API calls
- **Caching**: Thread summaries cached locally to avoid regeneration
- **Lazy Loading**: AI features loaded progressively based on disclosure level
- **Request Cancellation**: Ability to cancel in-flight requests when user changes input

#### Backend Optimizations
- **Response Caching**: Identical requests cached for short duration (e.g., thread summaries)
- **Connection Pooling**: Reuse HTTP connections to Anthropic
- **Payload Compression**: Gzip compression for large payloads
- **CDN**: Static assets served via CDN

#### Network Optimizations
- **Retry Logic**: Smart retry with exponential backoff
- **Timeout Configuration**: Different timeouts for different operations
- **Compression**: Request/response compression

### 2. Performance Metrics

**Target Latencies**:
- Tone Adjustment: < 5 seconds
- Writing Feedback: < 8 seconds
- Alt Text Generation: < 10 seconds
- Thread Optimization: < 5 seconds
- Hashtag Suggestions: < 3 seconds
- Thread Summary (cached): < 500ms
- Thread Summary (uncached): < 10 seconds

**Monitoring**:
- Track API response times
- Monitor error rates per endpoint
- Track cache hit/miss rates
- Alert on high latency or error rates

### 3. Cost Management

- **Model Selection**: Use appropriate Claude model for task complexity
  - Haiku (fast, cheap) for simple tasks
  - Sonnet (balanced) for complex tasks
- **Caching**: Reduce redundant API calls
- **Rate Limiting**: Prevent abuse and unexpected costs
- **Budget Alerts**: Monitor monthly API spend

---

## Future Enhancements

### 1. Hybrid Approach (Option C from Parent Task)

**User Choice Between Local and Cloud**:
- Add setting: "AI Processing Location"
  - **Cloud (Recommended)**: Current implementation
  - **Local (Private)**: WebLLM or ONNX models in browser
- Benefits:
  - Privacy-conscious users can use local models
  - Cost savings for high-volume users
  - Fallback when backend unavailable
- Challenges:
  - Maintain two code paths
  - Local model quality significantly lower
  - Large initial download for local models
  - Browser resource usage

### 2. Enhanced Privacy Options

- **Private Mode**: Warning for users with private accounts
- **Content Filtering**: Option to strip sensitive info before sending to AI
- **Audit Log**: Show users what data was sent to AI services
- **Opt-Out**: Easy way to disable all AI features

### 3. Advanced AI Features

- **Style Learning**: Learn from user's posts over time to improve suggestions
- **Engagement Prediction**: Predict how well a post will perform
- **Reply Suggestions**: Suggest replies to mentions/messages
- **Content Calendar**: AI-powered posting schedule optimization
- **Sentiment Analysis**: Analyze sentiment before posting
- **Multi-Language Support**: Translate posts, adjust tone across languages

### 4. Performance Improvements

- **Streaming Responses**: Stream AI responses for faster perceived performance
- **Parallel Processing**: Process multiple AI features simultaneously
- **Edge Computing**: Deploy backend closer to users (CloudFlare Workers, etc.)
- **WebSocket Connection**: Persistent connection for real-time AI features

### 5. Integration Enhancements

- **Bluesky Integration**: Use user's Bluesky profile data for better personalization
- **Cross-Post Analysis**: Analyze performance across multiple accounts
- **Team Collaboration**: Share AI-generated drafts with team members
- **A/B Testing**: Test different AI-generated variations

---

## Appendices

### A. Technology Stack

**Client**:
- React 18 + TypeScript
- Vite (build tool)
- Fetch API with retry logic

**Backend**:
- Development: Express.js
- Production: AWS Lambda + API Gateway
- Anthropic Claude API (Sonnet 3.5/4)

**Infrastructure**:
- AWS Amplify (deployment)
- AWS Secrets Manager (API key storage)
- AWS CloudWatch (monitoring)

### B. Code References

**Key Files**:
- Service Layer: `src/services/anthropic.ts:1-664`
- Composer UI: `src/components/composer/ComposerToolbar.tsx:1-350`
- AI Features: `src/components/composer/ComposerAIFeatures.tsx:1-xxx`
- Types: `src/components/composer/types.ts:1-239`
- Configuration: `src/config/amplify.ts:1-57`
- Retry Logic: `src/utils/retry.ts`
- Auth: `src/utils/api-auth.ts`

### C. Related Documentation

- **Bluesky API Capabilities**: `docs/bluesky-api-capabilities.md`
- **AT Protocol Integration**: `docs/atproto-validation-and-rate-limiting.md`
- **Retry Logic**: `docs/RETRY_LOGIC.md`
- **Architecture Analysis**: `docs/architecture/ARCHITECTURE_ANALYSIS.md`

### D. Glossary

- **Alt Text**: Alternative text description for images (accessibility)
- **AT Protocol**: Authenticated Transfer Protocol (Bluesky's protocol)
- **Progressive Disclosure**: UI pattern showing features based on complexity level
- **Thread**: Series of connected posts on Bluesky
- **Tone Adjustment**: AI-powered rewriting to change writing style
- **WebLLM**: Browser-based large language model execution

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-12-27 | Claude Code | Initial architecture document |

---

## Contact & Feedback

For questions or feedback about this architecture:
- Review this document in code reviews
- Update as implementation evolves
- Link from Asana tasks requiring AI integration context
