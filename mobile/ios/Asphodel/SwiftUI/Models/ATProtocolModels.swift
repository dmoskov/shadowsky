//
//  ATProtocolModels.swift
//  Asphodel
//
//  Swift models representing AT Protocol data types
//

import Foundation

// MARK: - Feed View Post
struct FeedViewPost: Identifiable, Codable, Hashable {
    let post: Post
    let reply: ReplyRef?
    let reason: ReasonRepost?
    let feedContext: String?

    var id: String { post.uri }

    func hash(into hasher: inout Hasher) {
        hasher.combine(post.uri)
    }

    static func == (lhs: FeedViewPost, rhs: FeedViewPost) -> Bool {
        lhs.post.uri == rhs.post.uri
    }
}

// MARK: - Post
struct Post: Codable {
    let uri: String
    let cid: String
    let author: ProfileViewBasic
    let record: PostRecord
    let embed: PostEmbed?
    let replyCount: Int?
    let repostCount: Int?
    let likeCount: Int?
    let quoteCount: Int?
    let indexedAt: String
    let viewer: ViewerState?
    let labels: [Label]?
}

// MARK: - Post Record
struct PostRecord: Codable {
    let text: String
    let createdAt: String
    let facets: [Facet]?
    let embed: RecordEmbed?
    let langs: [String]?
    let reply: ReplyRecord?
}

// MARK: - Profile View Basic
struct ProfileViewBasic: Codable {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
    let labels: [Label]?
    let viewer: ProfileViewerState?
}

// MARK: - Viewer State
struct ViewerState: Codable {
    let repost: String?
    let like: String?
    let replyDisabled: Bool?
}

// MARK: - Profile Viewer State
struct ProfileViewerState: Codable {
    let muted: Bool?
    let blockedBy: Bool?
    let blocking: String?
    let following: String?
    let followedBy: String?
}

// MARK: - Label
struct Label: Codable {
    let val: String
    let src: String?
    let uri: String?
    let cid: String?
    let cts: String?
}

// MARK: - Reply Reference
struct ReplyRef: Codable {
    let root: PostReference
    let parent: PostReference
}

// MARK: - Post Reference
struct PostReference: Codable {
    let uri: String
    let cid: String
}

// MARK: - Reply Record
struct ReplyRecord: Codable {
    let root: PostReference
    let parent: PostReference
}

// MARK: - Reason Repost
struct ReasonRepost: Codable {
    let by: ProfileViewBasic
    let indexedAt: String
}

// MARK: - Facet (for rich text)
struct Facet: Codable {
    let index: ByteSlice
    let features: [FacetFeature]
}

struct ByteSlice: Codable {
    let byteStart: Int
    let byteEnd: Int
}

enum FacetFeature: Codable {
    case mention(did: String)
    case link(uri: String)
    case tag(tag: String)

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
            self = .tag(tag: tag)
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown facet type: \(type)")
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
        case .tag(let tag):
            try container.encode("app.bsky.richtext.facet#tag", forKey: .type)
            try container.encode(tag, forKey: .tag)
        }
    }
}

// MARK: - Embed Types
enum PostEmbed: Codable {
    case images([ImageEmbed])
    case external(ExternalEmbed)
    case record(RecordEmbed)
    case recordWithMedia(RecordWithMediaEmbed)
    case video(VideoEmbed)

    // Simplified decoding - actual implementation would need proper type discrimination
    init(from decoder: Decoder) throws {
        // Placeholder implementation - would need proper type checking
        let container = try decoder.singleValueContainer()
        if let images = try? container.decode([ImageEmbed].self) {
            self = .images(images)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown embed type")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .images(let images):
            try container.encode(images)
        case .external(let external):
            try container.encode(external)
        case .record(let record):
            try container.encode(record)
        case .recordWithMedia(let media):
            try container.encode(media)
        case .video(let video):
            try container.encode(video)
        }
    }
}

struct ImageEmbed: Codable {
    let thumb: String
    let fullsize: String
    let alt: String?
}

struct ExternalEmbed: Codable {
    let uri: String
    let title: String
    let description: String
    let thumb: String?
}

struct RecordEmbed: Codable {
    let record: EmbeddedRecord
}

struct EmbeddedRecord: Codable {
    let uri: String
    let cid: String
    let value: PostRecord?
    let author: ProfileViewBasic?
}

struct RecordWithMediaEmbed: Codable {
    let record: RecordEmbed
    let media: PostEmbed
}

struct VideoEmbed: Codable {
    let playlist: String
    let thumbnail: String?
    let alt: String?
}
