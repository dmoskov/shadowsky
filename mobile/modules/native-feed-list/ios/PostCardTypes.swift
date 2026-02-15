//
//  PostCardTypes.swift
//  NativeFeedList
//
//  Local UI types for rendering posts in the feed list.
//  These are converted from FeedBridge's serialized types.
//

import Foundation

// MARK: - Feed View Post (UI Model)

struct FeedViewPost {
    let post: PostView
}

struct PostView {
    let uri: String
    let cid: String
    let author: PostAuthor
    let record: PostRecord
    let indexedAt: String
    let likeCount: Int
    let repostCount: Int
    let replyCount: Int
    let viewer: PostViewer?
    let labels: [ContentLabel]?
}

struct PostAuthor {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
}

struct PostRecord {
    let text: String
    let facets: [PostFacet]?
    let createdAt: String
}

struct PostViewer {
    let like: String?
    let repost: String?
}

struct ContentLabel {
    let val: String
    let src: String
}

// MARK: - Facets (UI Model)

struct PostFacet {
    let index: PostFacetIndex
    let features: [PostFacetFeature]
}

struct PostFacetIndex {
    let byteStart: Int
    let byteEnd: Int
}

enum PostFacetFeature {
    case mention(did: String)
    case link(uri: String)
    case hashtag(tag: String)
}
