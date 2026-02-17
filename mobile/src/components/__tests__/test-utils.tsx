import React from 'react';
import { darkColors } from '../../constants/theme';

/**
 * Shared test utilities for component tests.
 * Provides mock data factories and a wrapper that supplies
 * the contexts most components depend on.
 */

// ─── Mock theme ────────────────────────────────────────────
export const mockColors = darkColors;

export const mockTheme = {
  colors: mockColors,
  isDark: true,
};

// ─── Mock author factory ───────────────────────────────────
export function makeAuthor(overrides: Record<string, any> = {}) {
  return {
    did: 'did:plc:test123',
    handle: 'alice.bsky.social',
    displayName: 'Alice',
    avatar: 'https://example.com/avatar.jpg',
    labels: [],
    ...overrides,
  };
}

// ─── Mock post record factory ──────────────────────────────
export function makeRecord(overrides: Record<string, any> = {}) {
  return {
    $type: 'app.bsky.feed.post',
    text: 'Hello world! This is a test post.',
    createdAt: '2025-01-01T12:00:00.000Z',
    langs: ['en'],
    ...overrides,
  };
}

// ─── Mock PostView factory ─────────────────────────────────
export function makePostView(overrides: Record<string, any> = {}) {
  const { author: authorOverrides, record: recordOverrides, ...rest } = overrides;
  return {
    uri: 'at://did:plc:test123/app.bsky.feed.post/abc123',
    cid: 'bafyreiabc123',
    author: makeAuthor(authorOverrides),
    record: makeRecord(recordOverrides),
    replyCount: 3,
    repostCount: 5,
    likeCount: 12,
    quoteCount: 1,
    indexedAt: '2025-01-01T12:00:00.000Z',
    labels: [],
    viewer: {},
    ...rest,
  };
}

// ─── Mock FeedViewPost factory ─────────────────────────────
export function makeFeedViewPost(overrides: Record<string, any> = {}) {
  const { post: postOverrides, ...rest } = overrides;
  return {
    post: makePostView(postOverrides),
    ...rest,
  };
}

// ─── Mock embed factories ──────────────────────────────────
export function makeImageEmbed() {
  return {
    $type: 'app.bsky.embed.images#view',
    images: [
      {
        thumb: 'https://example.com/thumb1.jpg',
        fullsize: 'https://example.com/full1.jpg',
        alt: 'A test image',
        aspectRatio: { width: 800, height: 600 },
      },
    ],
  };
}

export function makeExternalEmbed() {
  return {
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://example.com/article',
      title: 'Test Article',
      description: 'A test article description',
      thumb: 'https://example.com/article-thumb.jpg',
    },
  };
}

export function makeQuoteEmbed() {
  return {
    $type: 'app.bsky.embed.record#view',
    record: {
      $type: 'app.bsky.embed.record#viewRecord',
      uri: 'at://did:plc:quoted/app.bsky.feed.post/quoted1',
      cid: 'bafyreiquoted1',
      author: makeAuthor({ handle: 'bob.bsky.social', displayName: 'Bob' }),
      value: makeRecord({ text: 'This is a quoted post' }),
      indexedAt: '2025-01-01T11:00:00.000Z',
      labels: [],
    },
  };
}

export function makeVideoEmbed() {
  return {
    $type: 'app.bsky.embed.video#view',
    cid: 'bafyreivideo1',
    playlist: 'https://video.example.com/playlist.m3u8',
    thumbnail: 'https://example.com/video-thumb.jpg',
    aspectRatio: { width: 1920, height: 1080 },
  };
}

export function makeRecordWithMediaEmbed() {
  return {
    $type: 'app.bsky.embed.recordWithMedia#view',
    media: makeImageEmbed(),
    record: {
      record: {
        $type: 'app.bsky.embed.record#viewRecord',
        uri: 'at://did:plc:quoted/app.bsky.feed.post/quoted2',
        cid: 'bafyreiquoted2',
        author: makeAuthor({ handle: 'carol.bsky.social', displayName: 'Carol' }),
        value: makeRecord({ text: 'Quote with media' }),
        indexedAt: '2025-01-01T10:00:00.000Z',
        labels: [],
      },
    },
  };
}
