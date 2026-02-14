//
// FeedBridgeTypes.swift
// Feed Bridge Module
//
// Swift Codable structs for AT Protocol feed data
// These types match the TypeScript serialization format
//

import Foundation

// MARK: - Rich Text Facets

struct FacetFeatureMention: Codable {
    let type: String
    let did: String

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case did
    }
}

struct FacetFeatureLink: Codable {
    let type: String
    let uri: String

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case uri
    }
}

struct FacetFeatureTag: Codable {
    let type: String
    let tag: String

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case tag
    }
}

enum FacetFeature: Codable {
    case mention(FacetFeatureMention)
    case link(FacetFeatureLink)
    case tag(FacetFeatureTag)

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: TypeCodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "app.bsky.richtext.facet#mention":
            let mention = try FacetFeatureMention(from: decoder)
            self = .mention(mention)
        case "app.bsky.richtext.facet#link":
            let link = try FacetFeatureLink(from: decoder)
            self = .link(link)
        case "app.bsky.richtext.facet#tag":
            let tag = try FacetFeatureTag(from: decoder)
            self = .tag(tag)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown facet feature type: \(type)"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .mention(let mention):
            try mention.encode(to: encoder)
        case .link(let link):
            try link.encode(to: encoder)
        case .tag(let tag):
            try tag.encode(to: encoder)
        }
    }

    private enum TypeCodingKeys: String, CodingKey {
        case type = "$type"
    }
}

struct FacetIndex: Codable {
    let byteStart: Int
    let byteEnd: Int
}

struct Facet: Codable {
    let index: FacetIndex
    let features: [FacetFeature]
}

// MARK: - Embeds

struct ViewImage: Codable {
    let thumb: String
    let fullsize: String
    let alt: String
    let aspectRatio: AspectRatio?
}

struct AspectRatio: Codable {
    let width: Int
    let height: Int
}

struct EmbedImages: Codable {
    let type: String
    let images: [ViewImage]

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case images
    }
}

struct ViewExternal: Codable {
    let uri: String
    let title: String
    let description: String
    let thumb: String?
}

struct EmbedExternal: Codable {
    let type: String
    let external: ViewExternal

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case external
    }
}

struct ViewRecord: Codable {
    let type: String
    let uri: String
    let cid: String
    let author: SerializedAuthor
    let value: RecordValue
    let embeds: [SerializedEmbed]?
    let indexedAt: String

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case uri, cid, author, value, embeds, indexedAt
    }
}

struct RecordValue: Codable {
    let text: String
    let createdAt: String
}

struct EmbedRecord: Codable {
    let type: String
    let record: ViewRecord

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case record
    }
}

struct EmbedRecordWrapper: Codable {
    let record: ViewRecord
}

struct EmbedRecordWithMedia: Codable {
    let type: String
    let record: EmbedRecordWrapper
    let media: SerializedEmbed

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case record, media
    }
}

struct ViewVideo: Codable {
    let cid: String
    let playlist: String
    let thumbnail: String?
    let aspectRatio: AspectRatio?
}

struct EmbedVideo: Codable {
    let type: String
    let video: ViewVideo

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case video
    }
}

enum SerializedEmbed: Codable {
    case images(EmbedImages)
    case external(EmbedExternal)
    case record(EmbedRecord)
    case recordWithMedia(EmbedRecordWithMedia)
    case video(EmbedVideo)

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: TypeCodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "app.bsky.embed.images#view":
            let images = try EmbedImages(from: decoder)
            self = .images(images)
        case "app.bsky.embed.external#view":
            let external = try EmbedExternal(from: decoder)
            self = .external(external)
        case "app.bsky.embed.record#view":
            let record = try EmbedRecord(from: decoder)
            self = .record(record)
        case "app.bsky.embed.recordWithMedia#view":
            let recordWithMedia = try EmbedRecordWithMedia(from: decoder)
            self = .recordWithMedia(recordWithMedia)
        case "app.bsky.embed.video#view":
            let video = try EmbedVideo(from: decoder)
            self = .video(video)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown embed type: \(type)"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .images(let images):
            try images.encode(to: encoder)
        case .external(let external):
            try external.encode(to: encoder)
        case .record(let record):
            try record.encode(to: encoder)
        case .recordWithMedia(let recordWithMedia):
            try recordWithMedia.encode(to: encoder)
        case .video(let video):
            try video.encode(to: encoder)
        }
    }

    private enum TypeCodingKeys: String, CodingKey {
        case type = "$type"
    }
}

// MARK: - Author

struct SerializedAuthor: Codable {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
}

// MARK: - Post Record

struct SerializedRecord: Codable {
    let text: String
    let facets: [Facet]?
    let createdAt: String
}

// MARK: - Viewer State

struct SerializedViewer: Codable {
    let like: String?
    let repost: String?
    let muted: Bool?
    let blocked: Bool?
}

// MARK: - Labels

struct SerializedLabel: Codable {
    let val: String
    let src: String
    let uri: String
    let cid: String?
    let cts: String
}

// MARK: - Post

struct SerializedPost: Codable {
    let uri: String
    let cid: String
    let author: SerializedAuthor
    let record: SerializedRecord
    let embed: SerializedEmbed?
    let replyCount: Int?
    let repostCount: Int?
    let likeCount: Int?
    let quoteCount: Int?
    let viewer: SerializedViewer?
    let labels: [SerializedLabel]?
    let indexedAt: String
}

// MARK: - Reply Reference

struct SerializedReplyRef: Codable {
    let parent: SerializedPost
    let root: SerializedPost
}

// MARK: - Reason

struct SerializedReasonRepost: Codable {
    let type: String
    let by: SerializedAuthor
    let indexedAt: String

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case by, indexedAt
    }
}

enum SerializedReason: Codable {
    case repost(SerializedReasonRepost)

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: TypeCodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        if type == "app.bsky.feed.defs#reasonRepost" {
            let repost = try SerializedReasonRepost(from: decoder)
            self = .repost(repost)
        } else {
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown reason type: \(type)"
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        switch self {
        case .repost(let repost):
            try repost.encode(to: encoder)
        }
    }

    private enum TypeCodingKeys: String, CodingKey {
        case type = "$type"
    }
}

// MARK: - Feed View Post

struct SerializedFeedViewPost: Codable {
    let post: SerializedPost
    let reply: SerializedReplyRef?
    let reason: SerializedReason?
    let feedContext: String?
}

// MARK: - Metadata

struct FeedUpdateMetadata: Codable {
    let timestamp: Int
    let isBookmarked: Bool?
    let isOnline: Bool
    let isFromCache: Bool?
}

// MARK: - Complete Feed Data

struct SerializedFeedData: Codable {
    let posts: [SerializedFeedViewPost]
    let metadata: FeedUpdateMetadata
    let cursor: String?
}

// MARK: - Incremental Updates

struct PostUpdate: Codable {
    let uri: String
    let likeCount: Int?
    let repostCount: Int?
    let replyCount: Int?
    let viewer: SerializedViewer?
    let isBookmarked: Bool?
}

struct FeedBatchUpdate: Codable {
    let updates: [PostUpdate]
    let timestamp: Int
}

// MARK: - Helper Extensions

extension SerializedFeedData {
    /// Decode from JSON string
    static func decode(from jsonString: String) throws -> SerializedFeedData {
        guard let data = jsonString.data(using: .utf8) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: [],
                    debugDescription: "Invalid UTF-8 string"
                )
            )
        }

        let decoder = JSONDecoder()
        return try decoder.decode(SerializedFeedData.self, from: data)
    }
}

extension FeedBatchUpdate {
    /// Decode from JSON string
    static func decode(from jsonString: String) throws -> FeedBatchUpdate {
        guard let data = jsonString.data(using: .utf8) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: [],
                    debugDescription: "Invalid UTF-8 string"
                )
            )
        }

        let decoder = JSONDecoder()
        return try decoder.decode(FeedBatchUpdate.self, from: data)
    }
}
