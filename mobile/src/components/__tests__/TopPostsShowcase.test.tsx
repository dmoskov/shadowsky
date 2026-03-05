import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { mockTheme } from './test-utils';

jest.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => mockTheme,
}));

import { TopPostsShowcase } from '../TopPostsShowcase';

function makeTopPost(uri: string, likes: number, reposts: number, replies: number, text = 'test post') {
  return {
    uri,
    text,
    createdAt: '2025-01-01T00:00:00Z',
    likes,
    reposts,
    replies,
    totalEngagement: likes + reposts + replies,
    author: {
      handle: 'test.bsky.social',
      displayName: 'Test User',
      avatar: 'https://example.com/avatar.jpg',
    },
    post: {
      uri,
      cid: `cid-${uri}`,
      author: {
        did: 'did:plc:test',
        handle: 'test.bsky.social',
        displayName: 'Test User',
        avatar: 'https://example.com/avatar.jpg',
        labels: [],
        viewer: {},
      },
      record: { $type: 'app.bsky.feed.post', text, createdAt: '2025-01-01T00:00:00Z' },
      likeCount: likes,
      repostCount: reposts,
      replyCount: replies,
      indexedAt: '2025-01-01T00:00:00Z',
      labels: [],
      viewer: {},
    },
  };
}

describe('TopPostsShowcase', () => {
  it('renders nothing when topPosts is empty', () => {
    const { toJSON } = render(
      <TopPostsShowcase topPosts={[]} totalPostsAnalyzed={0} />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders header with "Top Posts" title', () => {
    const posts = [makeTopPost('post-1', 50, 20, 10)];
    const { getByText } = render(
      <TopPostsShowcase topPosts={posts as any} totalPostsAnalyzed={100} />
    );

    expect(getByText('Top Posts')).toBeTruthy();
    expect(getByText('by engagement')).toBeTruthy();
  });

  it('renders up to 5 posts', () => {
    const posts = Array.from({ length: 8 }, (_, i) =>
      makeTopPost(`post-${i}`, (8 - i) * 10, 5, 2)
    );

    const { getAllByLabelText } = render(
      <TopPostsShowcase topPosts={posts as any} totalPostsAnalyzed={200} />
    );

    // Should render exactly 5 cards via accessibility labels
    const cards = getAllByLabelText(/^Top post \d/);
    expect(cards).toHaveLength(5);
  });

  it('shows total posts analyzed footer', () => {
    const posts = [makeTopPost('post-1', 50, 20, 10)];
    const { getByText } = render(
      <TopPostsShowcase topPosts={posts as any} totalPostsAnalyzed={150} />
    );

    expect(getByText('Based on 150 posts analyzed')).toBeTruthy();
  });

  it('calls onPostPress when a card is tapped', () => {
    const onPostPress = jest.fn();
    const posts = [makeTopPost('post-1', 50, 20, 10)];

    const { getByText } = render(
      <TopPostsShowcase
        topPosts={posts as any}
        totalPostsAnalyzed={100}
        onPostPress={onPostPress}
      />
    );

    fireEvent.press(getByText('test post'));
    expect(onPostPress).toHaveBeenCalledWith('post-1');
  });

  it('displays engagement metrics on cards', () => {
    const posts = [makeTopPost('post-1', 50, 20, 10)];
    const { getByText } = render(
      <TopPostsShowcase topPosts={posts as any} totalPostsAnalyzed={100} />
    );

    expect(getByText('80 total')).toBeTruthy();
    expect(getByText('50')).toBeTruthy();
    expect(getByText('20')).toBeTruthy();
    expect(getByText('10')).toBeTruthy();
  });

  it('shows (media post) for posts without text', () => {
    const posts = [makeTopPost('post-1', 50, 20, 10, '')];
    const { getByText } = render(
      <TopPostsShowcase topPosts={posts as any} totalPostsAnalyzed={100} />
    );

    expect(getByText('(media post)')).toBeTruthy();
  });

  it('formats large numbers with K suffix', () => {
    const posts = [makeTopPost('post-1', 1500, 200, 50)];
    const { getByText } = render(
      <TopPostsShowcase topPosts={posts as any} totalPostsAnalyzed={100} />
    );

    expect(getByText('1.8K total')).toBeTruthy();
    expect(getByText('1.5K')).toBeTruthy();
  });
});
