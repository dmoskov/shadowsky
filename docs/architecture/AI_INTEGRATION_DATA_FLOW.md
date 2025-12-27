# AI Writing Assistant - Data Flow Diagrams

## Document Information
- **Created**: 2025-12-27
- **Asana Task**: https://app.asana.com/0/1211710875848660/1212598914422287
- **Related**: AI_WRITING_ASSISTANT_INTEGRATION.md

## Overview

This document provides detailed data flow diagrams for the AI Writing Assistant integration, showing how data moves through the system from user interaction to AI response.

---

## 1. High-Level System Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Composer UI
    participant S as Anthropic Service
    participant R as Retry Layer
    participant B as Backend API
    participant A as Anthropic Claude

    U->>C: Interact with AI feature
    C->>S: Call AI service function
    S->>R: Make HTTP request with retry
    R->>B: POST /api/{endpoint}
    B->>B: Validate auth & payload
    B->>A: Forward to Anthropic API
    A->>A: Process with Claude model
    A-->>B: Return AI response
    B-->>R: Format and return JSON
    R-->>S: Parse response
    S-->>C: Return typed result
    C-->>U: Display AI result
```

---

## 2. Tone Adjustment Flow

```mermaid
sequenceDiagram
    participant U as User
    participant TB as Toolbar
    participant CS as ComposerState
    participant AS as AnthropicService
    participant BE as Backend
    participant AC as Anthropic Claude

    U->>TB: Click "Adjust Tone" button
    TB->>CS: onToggleToneOptions()
    CS->>CS: Set showToneOptions = true
    U->>CS: Select tone (e.g., "professional")
    CS->>CS: Set selectedTone = "professional"
    CS->>AS: adjustTone(text, "professional")

    Note over AS: Service Layer
    AS->>AS: Construct request body
    AS->>AS: Add auth headers
    AS->>BE: POST /api/adjust-tone

    Note over BE: Backend Processing
    BE->>BE: Validate auth token
    BE->>BE: Validate request payload
    BE->>AC: Send to Claude API
    AC->>AC: Process with LLM
    AC-->>BE: Return adjusted text

    BE-->>AS: { adjustedText, originalText, tone }
    AS-->>CS: Return ToneAdjustmentResult

    CS->>CS: Set tonePreview = adjustedText
    CS->>CS: Set showTonePreview = true
    CS-->>U: Display preview with Apply/Cancel

    alt User accepts
        U->>CS: Click "Apply"
        CS->>CS: text = adjustedText
        CS->>CS: Clear preview
    else User rejects
        U->>CS: Click "Cancel"
        CS->>CS: Clear preview
    end
```

---

## 3. Alt Text Generation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant MU as MediaUpload
    participant CS as ComposerState
    participant AS as AnthropicService
    participant BE as Backend
    participant AC as Anthropic Vision

    U->>MU: Upload image / Paste image
    MU->>CS: Add image to media[]

    alt Auto-generate enabled
        CS->>CS: Check autoGenerateAltText = true
        CS->>CS: Set generatingAltTextFor = imageId
        CS->>AS: generateAltText(imageUrl)
    else Manual trigger
        U->>MU: Click "Generate Alt Text"
        MU->>CS: Request alt text for image
        CS->>CS: Set generatingAltTextFor = imageId
        CS->>AS: generateAltText(imageUrl)
    end

    Note over AS: Convert blob to data URL if needed
    AS->>AS: blobUrlToDataUrl(imageUrl)

    AS->>BE: POST /api/generate-alt-text<br/>{ imageUrl: "data:image/..." }

    Note over BE: Backend Processing
    BE->>AC: Send base64 image to Claude Vision
    AC->>AC: Analyze image with vision model
    AC-->>BE: Return alt text description

    BE-->>AS: { altText: "..." }
    AS-->>CS: Return altText string

    CS->>CS: media[index].alt = altText
    CS->>CS: Clear generatingAltTextFor
    CS-->>MU: Update UI with alt text
    MU-->>U: Show generated alt text (editable)
```

---

## 4. Writing Feedback Flow

```mermaid
sequenceDiagram
    participant U as User
    participant TB as Toolbar
    participant CS as ComposerState
    participant AS as AnthropicService
    participant BE as Backend
    participant BP as Bluesky API
    participant AC as Anthropic Claude

    U->>TB: Click "Get Feedback" button
    TB->>CS: onRequestFeedback()
    CS->>CS: Set isLoadingFeedback = true
    CS->>AS: getStyleMatchedWritingFeedback(text, agent)

    par Basic Feedback
        AS->>BE: POST /api/writing-feedback<br/>{ text }
        BE->>AC: Request feedback from Claude
        AC-->>BE: Return feedback analysis
        BE-->>AS: WritingFeedback object
    and Style Analysis
        AS->>BP: agent.getAuthorFeed()<br/>Fetch user's recent posts
        BP-->>AS: Return 30 recent posts
        AS->>AS: Filter to get post text only

        alt Has >= 5 posts
            AS->>BE: POST /api/style-analysis<br/>{ currentText, historicalPosts }
            BE->>AC: Analyze style match with Claude
            AC-->>BE: Return style analysis
            BE-->>AS: StyleAnalysis object
        else Not enough posts
            AS->>AS: Return default "not enough posts"
        end
    end

    AS-->>CS: StyleMatchedWritingFeedback
    CS->>CS: Set writingFeedback = result
    CS->>CS: Set showWritingFeedback = true
    CS->>CS: Set isLoadingFeedback = false

    CS-->>U: Display feedback panel with:<br/>- Assessment<br/>- Corrected version<br/>- Enhanced version<br/>- Style analysis

    alt User applies corrected
        U->>CS: Click "Apply Corrected"
        CS->>CS: text = correctedVersion.text
    else User applies enhanced
        U->>CS: Click "Apply Enhanced"
        CS->>CS: text = enhancedVersion.text
    else User dismisses
        U->>CS: Close panel
        CS->>CS: Keep original text
    end
```

---

## 5. Thread Optimization Flow

```mermaid
sequenceDiagram
    participant U as User
    participant C as Composer
    participant CS as ComposerState
    participant AS as AnthropicService
    participant BE as Backend
    participant AC as Anthropic Claude

    U->>C: Enter long text (>300 chars)
    C->>CS: Text input change

    alt Manual optimization
        U->>C: Click "Optimize Thread" button
    else Auto-suggestion
        CS->>CS: Detect text length > threshold
        CS->>CS: Show suggestion banner
        U->>CS: Accept suggestion
    end

    CS->>AS: optimizeThread(text, maxCharsPerPost=300)
    AS->>BE: POST /api/optimize-thread<br/>{ text, maxCharsPerPost: 300 }

    Note over BE,AC: Backend processing
    BE->>AC: Request thread split from Claude
    Note over AC: Claude analyzes text<br/>Finds natural break points<br/>Maintains context flow
    AC-->>BE: Return segments with metadata

    BE-->>AS: ThreadOptimizationResult {<br/>  segments: [...],<br/>  suggestedFormat,<br/>  totalPosts<br/>}

    AS-->>CS: Return result
    CS->>CS: Set threadOptimizationResult = result
    CS->>CS: Set showThreadPreview = true

    CS-->>U: Display preview with:<br/>- Split posts<br/>- Suggested numbering format<br/>- Total post count

    alt User accepts
        U->>CS: Click "Apply"
        CS->>CS: posts = segments.map(s => s.text)
        CS->>CS: Apply suggested numbering format
        CS->>CS: Clear preview
    else User rejects
        U->>CS: Click "Cancel"
        CS->>CS: Keep original text
    end
```

---

## 6. Error Handling Flow

```mermaid
flowchart TD
    A[API Request] --> B{Request Sent}
    B -->|Success| C[Receive Response]
    B -->|Network Error| D[Retry Logic]

    C --> E{Status Code?}
    E -->|200 OK| F[Parse Response]
    E -->|400 Bad Request| G[Show Error: Invalid Input]
    E -->|401 Unauthorized| H[Show Error: Auth Failed]
    E -->|429 Rate Limited| I[Exponential Backoff]
    E -->|500 Server Error| J[Retry Logic]
    E -->|Timeout| K[Retry Logic]

    D --> L{Retry Count?}
    L -->|< Max Retries| M[Wait with Backoff]
    L -->|>= Max Retries| N[Show Error: Service Unavailable]

    M --> B

    I --> O{Retry Count?}
    O -->|< Max Retries| P[Wait Longer]
    O -->|>= Max Retries| Q[Show Error: Rate Limited]

    P --> B

    J --> L
    K --> L

    F --> R[Return Data to Component]
    G --> S[Log Error]
    H --> S
    N --> S
    Q --> S

    S --> T[Display User-Friendly Message]
    T --> U[Keep UI Functional]

    R --> V[Update UI with Result]
```

---

## 7. Authentication & Security Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AM as API Auth Module
    participant BE as Backend API
    participant MW as Auth Middleware
    participant AC as Anthropic API

    Note over C: User makes AI request
    C->>AM: Get auth headers
    AM->>AM: getApiAuthHeaders()
    AM-->>C: Return headers<br/>(custom auth token)

    C->>BE: POST /api/{endpoint}<br/>Headers: { Authorization, ... }<br/>Body: { request data }

    Note over BE: Backend validates request
    BE->>MW: Pass to auth middleware
    MW->>MW: Validate auth token

    alt Valid token
        MW->>MW: Verify user/session
        MW-->>BE: Authorized ✓
        BE->>BE: Validate request payload

        BE->>BE: Get Anthropic API key from env
        BE->>AC: Forward to Anthropic<br/>Authorization: Bearer {server_api_key}

        AC->>AC: Validate API key
        alt Valid API key
            AC->>AC: Process request
            AC-->>BE: Return result
            BE-->>C: Return JSON response
        else Invalid API key
            AC-->>BE: 401 Unauthorized
            BE-->>C: 500 Server Error<br/>(hide internal error)
        end

    else Invalid token
        MW-->>BE: Unauthorized ✗
        BE-->>C: 401 Unauthorized
        C->>C: Show error:<br/>"Authentication failed"
    end
```

---

## 8. Caching Strategy Flow

```mermaid
flowchart TD
    A[User Requests Thread Summary] --> B{Check Local Cache}
    B -->|Cache Hit| C[Return Cached Summary]
    B -->|Cache Miss| D[Make API Request]

    C --> E{Cache Age?}
    E -->|< 5 minutes| F[Display Cached Result]
    E -->|> 5 minutes| G{User Force Refresh?}

    G -->|Yes| D
    G -->|No| F

    D --> H[Backend: POST /api/thread-summary]
    H --> I{Check Server Cache}
    I -->|Cache Hit| J[Return Server Cache]
    I -->|Cache Miss| K[Call Anthropic API]

    K --> L[Generate Fresh Summary]
    L --> M[Store in Server Cache]
    M --> N[Return to Client]

    J --> N
    N --> O[Store in Local Cache]
    O --> P[Display Result]

    F --> Q{User satisfied?}
    Q -->|Yes| R[Done]
    Q -->|No - wants fresh| S[Click Force Refresh]
    S --> D
```

---

## 9. Progressive Disclosure UI Flow

```mermaid
stateDiagram-v2
    [*] --> Primary: Default State

    Primary --> Standard: User clicks disclosure toggle
    Standard --> Advanced: User clicks disclosure toggle
    Advanced --> Primary: User clicks disclosure toggle (cycle)

    state Primary {
        [*] --> ShowBasic
        ShowBasic: Show Basic Features
        ShowBasic: - Thread split
        ShowBasic: - Media upload
        ShowBasic: - Emoji picker
    }

    state Standard {
        [*] --> ShowStandard
        ShowStandard: Show Standard Features
        ShowStandard: - All Primary features
        ShowStandard: - Tone adjustment
    }

    state Advanced {
        [*] --> ShowAdvanced
        ShowAdvanced: Show Advanced Features
        ShowAdvanced: - All Standard features
        ShowAdvanced: - Writing feedback
        ShowAdvanced: - Thread optimization
    }
```

---

## 10. Data Privacy Flow

```mermaid
flowchart LR
    A[User Input] --> B{Content Type}

    B -->|Public Post Text| C[Send to Backend]
    B -->|Image| D[Convert to Base64]
    B -->|Sensitive Data?| E[Warning Dialog]

    D --> C

    C --> F{TLS/HTTPS Encryption}
    F --> G[Backend Server]

    G --> H{Validate & Sanitize}
    H --> I[Send to Anthropic]

    I --> J{Anthropic Processing}
    J -->|Claude Model| K[Generate Response]

    K --> L[Return to Backend]
    L --> M{Encrypt Response}
    M --> N[Return to Client]

    N --> O[Display to User]

    E -->|User Confirms| C
    E -->|User Cancels| P[Don't Send]

    style E fill:#ff9999
    style P fill:#ff9999
    style F fill:#99ff99
    style M fill:#99ff99
```

---

## 11. Rate Limiting Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant RL as Rate Limiter
    participant BE as Backend
    participant AC as Anthropic

    loop Multiple Requests
        C->>RL: API Request
        RL->>RL: Check request count

        alt Under limit
            RL->>BE: Forward request
            BE->>AC: Call Anthropic
            AC-->>BE: Response
            BE-->>RL: Response
            RL-->>C: Return result
        else Over limit (client-side)
            RL-->>C: 429 Too Many Requests<br/>Retry-After: {seconds}
            C->>C: Show error + countdown
            C->>C: Wait and retry
        end

        RL->>RL: Increment counter

        Note over BE: Backend also tracks rate limits
        BE->>BE: Check rate per user/IP

        alt Over backend limit
            BE-->>C: 429 Rate Limited
            C->>C: Exponential backoff
        end
    end

    Note over RL: Rate limits reset after time window
    RL->>RL: Reset counters periodically
```

---

## 12. Complete Request Lifecycle

```mermaid
flowchart TD
    A[User Action] --> B[Component Handler]
    B --> C{Validate Input}

    C -->|Invalid| D[Show Error Message]
    C -->|Valid| E[Update Loading State]

    E --> F[Call Service Function]
    F --> G[Construct Request]
    G --> H[Add Auth Headers]
    H --> I{Environment?}

    I -->|Dev| J[Use Vite Proxy<br/>to localhost:3002]
    I -->|Prod| K[Use API Gateway URL]

    J --> L[fetchWithRetry]
    K --> L

    L --> M{Success?}
    M -->|Yes| N[Parse JSON Response]
    M -->|Network Error| O[Retry with Backoff]
    M -->|Timeout| O

    O --> P{Max Retries?}
    P -->|No| L
    P -->|Yes| Q[Throw Error]

    N --> R[Validate Response Schema]
    R --> S{Valid?}

    S -->|Yes| T[Return Typed Result]
    S -->|No| Q

    Q --> U[Catch in Service]
    U --> V{Error Type?}

    V -->|401| W[Auth Failed Error]
    V -->|429| X[Rate Limited Error]
    V -->|500| Y[Service Unavailable]
    V -->|Other| Z[Generic Error]

    W --> AA[Display Error to User]
    X --> AA
    Y --> AA
    Z --> AA

    AA --> AB[Log Error]
    AB --> AC[Clear Loading State]

    T --> AD[Update Component State]
    AD --> AE[Display Result UI]
    AE --> AF[Clear Loading State]

    D --> AG[Stay on Current State]
    AC --> AG
    AF --> AH[Complete]
```

---

## Notes

### Diagram Rendering

These diagrams use Mermaid syntax and can be rendered in:
- GitHub (natively supports Mermaid)
- GitLab (natively supports Mermaid)
- VS Code (with Mermaid preview extension)
- Documentation sites (Docusaurus, VuePress, etc.)
- Mermaid Live Editor: https://mermaid.live

### Key Takeaways

1. **Async Nature**: All AI operations are asynchronous with loading states
2. **Error Resilience**: Multiple retry layers and graceful degradation
3. **Security**: Multi-layer authentication, no client-side API keys
4. **User Experience**: Clear feedback at each stage, cancellable operations
5. **Performance**: Caching, progressive disclosure, smart retry logic

### Related Documentation

- Architecture Overview: `AI_WRITING_ASSISTANT_INTEGRATION.md`
- Retry Logic Details: `docs/RETRY_LOGIC.md`
- AT Protocol Integration: `docs/atproto-validation-and-rate-limiting.md`

---

**Last Updated**: 2025-12-27
