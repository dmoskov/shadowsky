# AI Features Documentation Index

## Overview

This index provides a comprehensive guide to all AI feature documentation in the ShadowSky (BSKY) project.

**Asana Task**: https://app.asana.com/0/1211710875848660/1212598914422287
**Created**: 2025-12-27

---

## Documentation Structure

### 1. Architecture Documentation

#### [AI Writing Assistant Integration Architecture](./architecture/AI_WRITING_ASSISTANT_INTEGRATION.md)
**Purpose**: Complete technical architecture specification
**Audience**: Architects, Senior Developers, Technical Leads
**Length**: ~960 lines

**Covers**:
- High-level system architecture
- Implementation approach (Cloud API with Anthropic Claude)
- Component breakdown (client, network, backend layers)
- Authentication & security model
- Error handling strategy
- API endpoint specifications
- Performance considerations
- Future enhancement roadmap

**Use When**:
- Planning new AI features
- Understanding system design decisions
- Onboarding new team members
- Making architectural changes

---

#### [AI Integration Data Flow Diagrams](./architecture/AI_INTEGRATION_DATA_FLOW.md)
**Purpose**: Visual data flow documentation
**Audience**: All developers
**Length**: ~580 lines

**Covers**:
- 12 Mermaid diagrams showing data flows
- Tone adjustment flow
- Alt text generation flow
- Writing feedback flow
- Thread optimization flow
- Error handling flow
- Authentication & security flow
- Caching strategy
- Progressive disclosure UI
- Complete request lifecycle

**Use When**:
- Understanding how features work
- Debugging issues
- Planning integrations
- Explaining system to stakeholders

---

### 2. Developer Guides

#### [AI Features Developer Guide](./guides/AI_FEATURES_DEVELOPER_GUIDE.md)
**Purpose**: Practical implementation guide
**Audience**: Developers implementing or extending AI features
**Length**: ~855 lines

**Covers**:
- Step-by-step guide to adding new AI features
- Usage examples for existing services
- Error handling patterns
- Testing strategies (unit & integration)
- Best practices
- Common pitfalls to avoid
- Performance optimization tips

**Use When**:
- Implementing a new AI feature
- Using existing AI services
- Writing tests
- Troubleshooting issues
- Code review reference

---

## Quick Reference by Task

### I want to...

#### Understand the overall architecture
→ Start with [AI Writing Assistant Integration Architecture](./architecture/AI_WRITING_ASSISTANT_INTEGRATION.md)
→ Read sections: Architecture Overview, Implementation Approach, System Components

#### See how data flows through the system
→ View [AI Integration Data Flow Diagrams](./architecture/AI_INTEGRATION_DATA_FLOW.md)
→ Pick the specific flow diagram you need

#### Add a new AI feature
→ Follow [AI Features Developer Guide](./guides/AI_FEATURES_DEVELOPER_GUIDE.md)
→ Section: "Adding a New AI Feature" (6 steps)

#### Use an existing AI service
→ Reference [AI Features Developer Guide](./guides/AI_FEATURES_DEVELOPER_GUIDE.md)
→ Section: "Using Existing AI Services"

#### Understand authentication & security
→ See [AI Writing Assistant Integration Architecture](./architecture/AI_WRITING_ASSISTANT_INTEGRATION.md)
→ Section: "Authentication & Security"
→ And [AI Integration Data Flow Diagrams](./architecture/AI_INTEGRATION_DATA_FLOW.md)
→ Diagram: "Authentication & Security Flow"

#### Handle errors properly
→ Read [AI Features Developer Guide](./guides/AI_FEATURES_DEVELOPER_GUIDE.md)
→ Section: "Error Handling Patterns"
→ And [AI Writing Assistant Integration Architecture](./architecture/AI_WRITING_ASSISTANT_INTEGRATION.md)
→ Section: "Error Handling"

#### Write tests for AI features
→ Follow [AI Features Developer Guide](./guides/AI_FEATURES_DEVELOPER_GUIDE.md)
→ Section: "Testing AI Features"

#### Understand API endpoints
→ Reference [AI Writing Assistant Integration Architecture](./architecture/AI_WRITING_ASSISTANT_INTEGRATION.md)
→ Section: "API Endpoints" (9 endpoints documented)

#### Optimize performance
→ Check [AI Features Developer Guide](./guides/AI_FEATURES_DEVELOPER_GUIDE.md)
→ Section: "Performance Tips"
→ And [AI Writing Assistant Integration Architecture](./architecture/AI_WRITING_ASSISTANT_INTEGRATION.md)
→ Section: "Performance Considerations"

---

## Key Concepts

### Architecture Approach

The system uses **Option A: Cloud API (Anthropic Claude)** with a backend proxy:

✅ **Advantages**:
- High-quality AI responses
- No client-side resource usage
- Secure API key management
- Scalable infrastructure

⚖️ **Trade-offs**:
- Per-request API costs
- Content sent to Anthropic
- External service dependency

### Security Model

```
Client (No API keys)
  ↓ Custom auth headers
Backend (Has API key in env vars)
  ↓ Server API key
Anthropic Cloud
```

### Data Flow Pattern

All AI features follow this pattern:
1. User action in Composer UI
2. Component state update (loading)
3. Service function call
4. Network request with retry logic
5. Backend validation & forwarding
6. Anthropic API processing
7. Response parsing & validation
8. UI update with results
9. User accepts/rejects changes

### Error Handling Strategy

- **Network errors**: Retry with exponential backoff
- **Rate limits (429)**: Backoff and user notification
- **Auth errors (401)**: Display error, don't retry
- **Server errors (500)**: Retry, then graceful degradation
- **Timeouts**: Retry, increase timeout for heavy operations

---

## Code References

### Key Files

**Service Layer**:
- `src/services/anthropic.ts` - Main AI service (664 lines)

**Composer Components**:
- `src/components/composer/ComposerRefactored.tsx` - Main composer
- `src/components/composer/ComposerToolbar.tsx` - Toolbar with AI buttons
- `src/components/composer/ComposerAIFeatures.tsx` - AI feature panels
- `src/components/composer/useComposerState.ts` - State management
- `src/components/composer/types.ts` - Type definitions

**Configuration**:
- `src/config/amplify.ts` - API base URL configuration
- `src/utils/retry.ts` - Retry logic implementation
- `src/utils/api-auth.ts` - Authentication headers

### AI Features Implemented

1. **Tone Adjustment** - Rewrite text in different tones
2. **Thread Optimization** - Split long text into posts
3. **Hashtag Suggestions** - Generate relevant hashtags
4. **Writing Feedback** - Grammar, style, and engagement feedback
5. **Style Analysis** - Match user's writing style
6. **Alt Text Generation** - Image descriptions for accessibility
7. **Post Analysis** - Analyze posting patterns and engagement
8. **Thread Summary** - Summarize long conversation threads
9. **Link Metadata** - Fetch Open Graph data for links

---

## Integration Points

### User Interface Touchpoints

1. **Composer Toolbar** (`ComposerToolbar.tsx`)
   - Tone adjustment button (standard level)
   - Writing feedback button (advanced level)
   - Progressive disclosure toggle

2. **AI Features Panel** (`ComposerAIFeatures.tsx`)
   - Tone selection UI
   - Feedback display
   - Hashtag suggestions
   - Thread preview

3. **Media Upload** (`ComposerMediaUpload.tsx`)
   - Alt text generation (auto & manual)
   - Loading indicators
   - Edit controls

4. **Settings** (`ComposerSettings.tsx`)
   - Auto-generate alt text toggle
   - Hashtag suggestions toggle

### Backend Endpoints

All endpoints at `/api/*`:
- `/api/adjust-tone` - POST
- `/api/optimize-thread` - POST
- `/api/suggest-hashtags` - POST
- `/api/writing-feedback` - POST
- `/api/style-analysis` - POST
- `/api/generate-alt-text` - POST
- `/api/analyze-posts` - POST
- `/api/thread-summary` - POST (with `?forceRefresh`)
- `/api/fetch-link-metadata` - POST

---

## Future Enhancements

### Planned Features (from architecture doc)

1. **Hybrid Approach** - Local + Cloud option for privacy
2. **Enhanced Privacy** - Content filtering, audit logs
3. **Advanced AI** - Engagement prediction, reply suggestions
4. **Performance** - Streaming responses, edge computing
5. **Integration** - Deeper Bluesky profile integration

### Contributing

When adding new AI features:
1. Follow the 6-step process in the Developer Guide
2. Add comprehensive error handling
3. Include loading states and cancellation
4. Write unit tests with mocks
5. Update this documentation
6. Add types to `types.ts`
7. Follow security best practices (no API keys in client!)

---

## Related Documentation

- **Retry Logic**: `docs/RETRY_LOGIC.md`
- **AT Protocol**: `docs/atproto-validation-and-rate-limiting.md`
- **Bluesky API**: `docs/bluesky-api-capabilities.md`
- **Architecture Analysis**: `docs/architecture/ARCHITECTURE_ANALYSIS.md`

---

## Support & Questions

For questions about AI features:
1. Check this index for relevant documentation
2. Review code examples in Developer Guide
3. Examine data flow diagrams for understanding
4. Reference architecture doc for design decisions

---

## Document Maintenance

**Update When**:
- New AI features are added
- API endpoints change
- Architecture decisions evolve
- New best practices emerge

**Owned By**: Engineering Team
**Review Cycle**: Quarterly or on major changes

---

**Last Updated**: 2025-12-27
**Version**: 1.0
