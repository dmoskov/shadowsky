//
//  ThreadTypes.swift
//  NativeThreadView
//
//  Thread-specific types for rendering thread views with nested replies
//

import Foundation

// MARK: - Thread Node (for nested structure)

/// Represents a post in a thread with its nested replies
struct ThreadNode: Identifiable {
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
struct ThreadPost {
    let uri: String
    let cid: String
    let author: ThreadAuthor
    let record: ThreadRecord
    let indexedAt: String
    let likeCount: Int
    let repostCount: Int
    let replyCount: Int
    let quoteCount: Int?
    let viewer: ThreadViewer?
    let labels: [ThreadLabel]?
}

struct ThreadAuthor {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
}

struct ThreadRecord {
    let text: String
    let facets: [ThreadFacet]?
    let createdAt: String
}

struct ThreadViewer {
    let like: String?
    let repost: String?
}

struct ThreadLabel {
    let val: String
    let src: String
}

struct ThreadReplyRef {
    let uri: String
    let cid: String
}

// MARK: - Facets

struct ThreadFacet {
    let index: ThreadFacetIndex
    let features: [ThreadFacetFeature]
}

struct ThreadFacetIndex {
    let byteStart: Int
    let byteEnd: Int
}

enum ThreadFacetFeature {
    case mention(did: String)
    case link(uri: String)
    case hashtag(tag: String)
}

// MARK: - Thread Navigation

/// Helper for thread navigation (parent/root jumps)
struct ThreadNavigationInfo {
    let rootUri: String
    let parentUri: String?
    let currentDepth: Int
}
