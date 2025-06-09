import React from 'react'
import { PostCard } from './PostCard'
import { PostCardTailwind } from './PostCardTailwind'
import type { FeedItem } from '../../types/atproto'

// Mock data for testing
const mockPost: FeedItem = {
  post: {
    uri: 'at://did:plc:example/app.bsky.feed.post/abc123',
    cid: 'cid123',
    author: {
      did: 'did:plc:example',
      handle: 'testuser.bsky.social',
      displayName: 'Test User',
      avatar: undefined,
      viewer: {
        muted: false,
        blockedBy: false
      }
    },
    record: {
      $type: 'app.bsky.feed.post',
      text: 'This is a test post to compare the original CSS version with the new Tailwind version. Let\'s see how they look side by side! 🚀',
      createdAt: new Date().toISOString()
    },
    replyCount: 5,
    repostCount: 12,
    likeCount: 42,
    indexedAt: new Date().toISOString(),
    viewer: {
      like: undefined,
      repost: undefined
    }
  }
}

const mockRepost: FeedItem = {
  ...mockPost,
  reason: {
    $type: 'app.bsky.feed.defs#reasonRepost',
    by: {
      did: 'did:plc:reposter',
      handle: 'reposter.bsky.social',
      displayName: 'Reposter User'
    },
    indexedAt: new Date().toISOString()
  }
}

export const PostCardComparison: React.FC = () => {
  return (
    <div className="twp-8">
      <h1 className="twtext-3xl twfont-bold twmb-8">PostCard Migration Comparison</h1>
      
      <div className="twgrid twgrid-cols-2 twgap-8">
        {/* Original CSS Version */}
        <div>
          <h2 className="twtext-xl twfont-semibold twmb-4">Original (CSS)</h2>
          <div className="twspace-y-4">
            <PostCard item={mockPost} />
            <PostCard item={mockRepost} />
          </div>
        </div>
        
        {/* Tailwind Version */}
        <div>
          <h2 className="twtext-xl twfont-semibold twmb-4">New (Tailwind)</h2>
          <div className="twspace-y-4">
            <PostCardTailwind item={mockPost} />
            <PostCardTailwind item={mockRepost} />
          </div>
        </div>
      </div>
      
      <div className="twmt-8 twp-4 twbg-bg-secondary twrounded-lg twborder twborder-border">
        <h3 className="twfont-semibold twmb-2">Migration Notes:</h3>
        <ul className="twlist-disc twlist-inside twspace-y-1 twtext-sm twtext-text-secondary">
          <li>Both versions should look identical</li>
          <li>Tailwind version uses utility classes with "tw" prefix</li>
          <li>All interactive behaviors remain the same</li>
          <li>Design tokens are preserved through CSS variables</li>
        </ul>
      </div>
    </div>
  )
}