//
//  PostCardModels.swift
//  Asphodel
//
//  Created by Claude Code
//

import Foundation

// MARK: - Post Models

/// Represents an AT Protocol post author
struct PostAuthor: Codable {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
}

/// Represents a facet (mention, link, or hashtag) in rich text
struct PostFacet: Codable {
    let index: PostFacetIndex
    let features: [PostFacetFeature]
}

struct PostFacetIndex: Codable {
    let byteStart: Int
    let byteEnd: Int
}

enum PostFacetFeature: Codable {
    case mention(did: String)
    case link(uri: String)
    case hashtag(tag: String)

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case did, uri, tag
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "app.bsky.richtext.facet#mention":
            let did = try container.decode(String.self, forKey: .did)
            self = .mention(did: did)
        case "app.bsky.richtext.facet#link":
            let uri = try container.decode(String.self, forKey: .uri)
            self = .link(uri: uri)
        case "app.bsky.richtext.facet#tag":
            let tag = try container.decode(String.self, forKey: .tag)
            self = .hashtag(tag: tag)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown facet type: \(type)"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        switch self {
        case .mention(let did):
            try container.encode("app.bsky.richtext.facet#mention", forKey: .type)
            try container.encode(did, forKey: .did)
        case .link(let uri):
            try container.encode("app.bsky.richtext.facet#link", forKey: .type)
            try container.encode(uri, forKey: .uri)
        case .hashtag(let tag):
            try container.encode("app.bsky.richtext.facet#tag", forKey: .type)
            try container.encode(tag, forKey: .tag)
        }
    }
}

/// Represents the record data of a post
struct PostRecord: Codable {
    let text: String
    let facets: [PostFacet]?
    let createdAt: String
}

/// Represents viewer interaction state
struct PostViewer: Codable {
    let like: String?
    let repost: String?
}

/// Represents a content label for moderation
struct ContentLabel: Codable {
    let val: String
    let src: String?
}

/// Represents a complete post view
struct PostView: Codable {
    let uri: String
    let cid: String
    let author: PostAuthor
    let record: PostRecord
    let indexedAt: String
    let likeCount: Int?
    let repostCount: Int?
    let replyCount: Int?
    let viewer: PostViewer?
    let labels: [ContentLabel]?
}

/// Represents a feed view post (wrapper around PostView)
struct FeedViewPost: Codable {
    let post: PostView
}

// MARK: - Event Handlers

/// Events that can be sent back to React Native
enum PostCardEvent {
    case press
    case pressProfile(handle: String)
    case like
    case repost
    case reply
    case bookmark
    case mentionPress(handle: String, did: String)
    case hashtagPress(tag: String)
    case share
    case mute(did: String)
    case block(did: String)
    case report(uri: String, cid: String)
}

// MARK: - Moderation

/// Moderation action for content labels
enum ModerationAction {
    case hide
    case warn
    case blur
    case none
}

struct ModerationResult {
    let shouldHide: Bool
    let shouldWarn: Bool
    let shouldBlur: Bool
    let warningText: String?
}
