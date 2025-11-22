# Bluesky API Capabilities Audit

**Date:** 2025-01-22
**Status:** ✅ Completed

## Executive Summary

This document outlines the actual capabilities of the Bluesky/AT Protocol API based on official documentation and community resources. Multiple proposed features depend on API capabilities that do not currently exist.

## Available Features

### 1. Search API ✅

The Bluesky API provides comprehensive search capabilities:

- **Post Search**: `app.bsky.feed.searchPosts` - Search through posts with filters
- **User Search**: `app.bsky.actor.searchActors` - Find users by name/handle
- **Typeahead Search**: `app.bsky.actor.searchActorsTypeahead` - Quick user search for autocomplete
- **Starter Pack Search**: `app.bsky.graph.searchStarterPacks` - Discover starter packs

**Implementation Status**: Can be implemented as planned.

### 2. WebSocket Support (Firehose) ✅

The AT Protocol provides real-time data streaming:

- **Endpoint**: `com.atproto.sync.subscribeRepos`
- **Format**: WebSocket connection with CBOR-encoded data
- **Simplified Option**: Jetstream (JSON-encoded WebSocket messages)
- **Scale**: Handles 2,000+ events per second
- **Use Cases**: Real-time posts, likes, follows, DM updates

**Implementation Status**: Can be used for real-time DM updates and other live features.

### 3. Bookmarks and DMs ✅

These features are supported by the AT Protocol but not well-documented:

- **Bookmarks**: Confirmed supported (mentioned by user)
- **Direct Messages**: Confirmed supported (mentioned by user)

**Implementation Status**: Keep existing implementation.

## Unavailable Features

### 1. Trending API ❌

**Status**: No dedicated endpoints exist for:
- Trending hashtags
- Trending topics
- Trending posts
- Discovery algorithms (beyond basic search)

**Workaround**: Third-party tools analyze the Firehose data to calculate trending topics client-side.

**Decision**: Remove trending-related tasks unless we want to build client-side trending analysis.

### 2. Analytics API ❌

**Status**: No API for analytics or metrics:
- No impressions data
- No engagement rate calculations
- No follower growth metrics
- No post performance analytics
- No demographic data

**Workaround**: Third-party tools (Metricool, Fedica, BlueSkyHunter, Graphtracks) consume the Firehose to build analytics.

**Decision**: Remove analytics dashboard tasks. Users can use third-party tools for analytics.

### 3. Poll API ❌

**Status**: No native poll support in AT Protocol:
- Polls are on the roadmap but not implemented
- No voting mechanism in the API
- No poll creation endpoints

**Workaround**: Third-party services like poll.blue exist but require external integration.

**Decision**: Remove poll-related tasks unless we want to integrate with third-party poll services.

### 4. Background Sync / Offline Posting ❌

**Status**: Not officially documented or supported:
- No service worker API for offline posting
- No background sync queue
- AT Protocol supports data backups and server-to-server sync, but not client-side offline posting

**Workaround**: Could implement browser-based service worker background sync independently, but this is standard PWA functionality, not an AT Protocol feature.

**Decision**: Remove offline posting tasks unless we want to implement standard PWA offline features.

## Tasks to Remove

Based on the API audit, the following tasks should be removed from the backlog:

1. ❌ **Create trending topics and hashtag hub** - No trending API
2. ❌ **Implement suggested accounts discovery with personalization** - No discovery algorithm API (basic search exists)
3. ❌ **Create per-post analytics dashboard** - No analytics API
4. ❌ **Build account growth and follower analytics** - No analytics API
5. ❌ **Implement poll creation in post composer** - No poll API
6. ❌ **Build poll voting and results visualization** - No poll API
7. ❌ **Implement service worker for offline content caching** - Not an AT Protocol feature
8. ❌ **Build offline post composer with sync queue** - No background sync API

## Tasks to Keep

These tasks are supported by existing APIs:

1. ✅ **Implement advanced post search with content filters** - `app.bsky.feed.searchPosts` exists
2. ✅ **Create user and hashtag discovery search** - `app.bsky.actor.searchActors` exists
3. ✅ **Implement real-time DM updates via WebSocket or polling** - Firehose WebSocket exists

## References

- [AT Protocol XRPC API Documentation](https://docs.bsky.app/docs/api/at-protocol-xrpc-api)
- [GitHub - bluesky-social/atproto](https://github.com/bluesky-social/atproto)
- [Firehose Documentation](https://docs.bsky.app/docs/advanced-guides/firehose)
- [Bluesky Polls Discussion](https://github.com/bluesky-social/atproto/discussions/1310)
- [Ultimate Guide to Bluesky Analytics](https://theblue.social/articles/ultimate-guide-to-bluesky-analytics-for-engagement)
- [Introducing Jetstream](https://docs.bsky.app/blog/jetstream)

## Recommendations

1. **Implement search features** - These are fully supported and can be built as planned
2. **Use WebSocket for real-time updates** - Consider using Jetstream for easier JSON-based integration
3. **Remove analytics features** - Direct users to third-party analytics tools
4. **Remove poll features** - Not worth integrating third-party poll services
5. **Remove offline posting** - Standard PWA features are out of scope for this project
6. **Remove trending features** - Building client-side trending analysis is complex and resource-intensive

## Next Steps

1. Update blocked tasks in Asana to mark unsupported features as "Rejected/Wontfix"
2. Focus development efforts on search and real-time features that are actually supported
3. Update effort estimates for remaining tasks based on confirmed API capabilities
