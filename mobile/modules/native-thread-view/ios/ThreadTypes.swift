//
//  ThreadTypes.swift
//  NativeThreadView
//
//  Thread-specific types for rendering thread views with nested replies
//

import Foundation
import FeedBridge
import ExpoSwiftUIFeed

// MARK: - Thread Node (for nested structure)

/// Represents a post in a thread with its nested replies
struct ThreadNode: Identifiable, Equatable {
    let id: String // Use post URI as ID
    let post: ThreadPost
    let parent: ThreadReplyRef?
    let replies: [ThreadNode]
    let depth: Int // Depth in the reply tree (0 = root)

    init(post: ThreadPost, parent: ThreadReplyRef?, replies: [ThreadNode], depth: Int) {
        self.id = post.uri
        self.post = post
        self.parent = parent
        self.replies = replies
        self.depth = depth
    }
}

/// Simplified post structure for thread display
struct ThreadPost: Equatable {
    let uri: String
    let cid: String
    let author: ThreadAuthor
    let record: ThreadRecord
    let embed: PostEmbedData?
    let indexedAt: String
    let likeCount: Int
    let repostCount: Int
    let replyCount: Int
    let quoteCount: Int?
    let viewer: ThreadViewer?
    let labels: [ThreadLabel]?
}

struct ThreadAuthor: Equatable {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
    let isVerified: Bool
}

struct ThreadRecord: Equatable {
    let text: String
    let facets: [Facet]?
    let createdAt: String
    let langs: [String]?
}

struct ThreadViewer: Equatable {
    let like: String?
    let repost: String?
}

struct ThreadLabel: Equatable {
    let val: String
    let src: String
}

struct ThreadReplyRef: Equatable {
    let uri: String
    let cid: String
}

// MARK: - Facets
// Uses Facet types from FeedBridge module (FacetIndex, FacetFeature, Facet)
// to avoid duplicating AT Protocol facet type definitions.

// MARK: - Thread Navigation

/// Helper for thread navigation (parent/root jumps)
struct ThreadNavigationInfo {
    let rootUri: String
    let parentUri: String?
    let currentDepth: Int
}
