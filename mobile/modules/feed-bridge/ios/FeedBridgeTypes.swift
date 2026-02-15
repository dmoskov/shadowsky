//
// FeedBridgeTypes.swift
// Feed Bridge Module
//
// Swift Codable structs for AT Protocol feed data
// These types match the TypeScript serialization format
// All types are public for cross-module access (e.g., NativeFeedList)
//

import Foundation

// MARK: - Rich Text Facets

public struct FacetFeatureMention: Codable {
    public let type: String
    public let did: String

    public init(type: String, did: String) {
        self.type = type
        self.did = did
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case did
    }
}

public struct FacetFeatureLink: Codable {
    public let type: String
    public let uri: String

    public init(type: String, uri: String) {
        self.type = type
        self.uri = uri
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case uri
    }
}

public struct FacetFeatureTag: Codable {
    public let type: String
    public let tag: String

    public init(type: String, tag: String) {
        self.type = type
        self.tag = tag
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case tag
    }
}

public enum FacetFeature: Codable {
    case mention(FacetFeatureMention)
    case link(FacetFeatureLink)
    case tag(FacetFeatureTag)

    public init(from decoder: Decoder) throws {
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

    public func encode(to encoder: Encoder) throws {
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

public struct FacetIndex: Codable {
    public let byteStart: Int
    public let byteEnd: Int

    public init(byteStart: Int, byteEnd: Int) {
        self.byteStart = byteStart
        self.byteEnd = byteEnd
    }
}

public struct Facet: Codable {
    public let index: FacetIndex
    public let features: [FacetFeature]

    public init(index: FacetIndex, features: [FacetFeature]) {
        self.index = index
        self.features = features
    }
}

// MARK: - Embeds

public struct ViewImage: Codable {
    public let thumb: String
    public let fullsize: String
    public let alt: String
    public let aspectRatio: AspectRatio?

    public init(thumb: String, fullsize: String, alt: String, aspectRatio: AspectRatio?) {
        self.thumb = thumb
        self.fullsize = fullsize
        self.alt = alt
        self.aspectRatio = aspectRatio
    }
}

public struct AspectRatio: Codable {
    public let width: Int
    public let height: Int

    public init(width: Int, height: Int) {
        self.width = width
        self.height = height
    }
}

public struct EmbedImages: Codable {
    public let type: String
    public let images: [ViewImage]

    public init(type: String, images: [ViewImage]) {
        self.type = type
        self.images = images
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case images
    }
}

public struct ViewExternal: Codable {
    public let uri: String
    public let title: String
    public let description: String
    public let thumb: String?

    public init(uri: String, title: String, description: String, thumb: String?) {
        self.uri = uri
        self.title = title
        self.description = description
        self.thumb = thumb
    }
}

public struct EmbedExternal: Codable {
    public let type: String
    public let external: ViewExternal

    public init(type: String, external: ViewExternal) {
        self.type = type
        self.external = external
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case external
    }
}

public struct ViewRecord: Codable {
    public let type: String
    public let uri: String
    public let cid: String
    public let author: SerializedAuthor
    public let value: RecordValue
    public let embeds: [SerializedEmbed]?
    public let indexedAt: String

    public init(type: String, uri: String, cid: String, author: SerializedAuthor, value: RecordValue, embeds: [SerializedEmbed]?, indexedAt: String) {
        self.type = type
        self.uri = uri
        self.cid = cid
        self.author = author
        self.value = value
        self.embeds = embeds
        self.indexedAt = indexedAt
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case uri, cid, author, value, embeds, indexedAt
    }
}

public struct RecordValue: Codable {
    public let text: String
    public let createdAt: String

    public init(text: String, createdAt: String) {
        self.text = text
        self.createdAt = createdAt
    }
}

public struct EmbedRecord: Codable {
    public let type: String
    public let record: ViewRecord

    public init(type: String, record: ViewRecord) {
        self.type = type
        self.record = record
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case record
    }
}

public struct EmbedRecordWrapper: Codable {
    public let record: ViewRecord

    public init(record: ViewRecord) {
        self.record = record
    }
}

public struct EmbedRecordWithMedia: Codable {
    public let type: String
    public let record: EmbedRecordWrapper
    public let media: SerializedEmbed

    public init(type: String, record: EmbedRecordWrapper, media: SerializedEmbed) {
        self.type = type
        self.record = record
        self.media = media
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case record, media
    }
}

public struct ViewVideo: Codable {
    public let cid: String
    public let playlist: String
    public let thumbnail: String?
    public let aspectRatio: AspectRatio?

    public init(cid: String, playlist: String, thumbnail: String?, aspectRatio: AspectRatio?) {
        self.cid = cid
        self.playlist = playlist
        self.thumbnail = thumbnail
        self.aspectRatio = aspectRatio
    }
}

public struct EmbedVideo: Codable {
    public let type: String
    public let video: ViewVideo

    public init(type: String, video: ViewVideo) {
        self.type = type
        self.video = video
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case video
    }
}

public indirect enum SerializedEmbed: Codable {
    case images(EmbedImages)
    case external(EmbedExternal)
    case record(EmbedRecord)
    case recordWithMedia(EmbedRecordWithMedia)
    case video(EmbedVideo)

    public init(from decoder: Decoder) throws {
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

    public func encode(to encoder: Encoder) throws {
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

public struct SerializedAuthor: Codable {
    public let did: String
    public let handle: String
    public let displayName: String?
    public let avatar: String?

    public init(did: String, handle: String, displayName: String?, avatar: String?) {
        self.did = did
        self.handle = handle
        self.displayName = displayName
        self.avatar = avatar
    }
}

// MARK: - Post Record

public struct SerializedRecord: Codable {
    public let text: String
    public let facets: [Facet]?
    public let createdAt: String

    public init(text: String, facets: [Facet]?, createdAt: String) {
        self.text = text
        self.facets = facets
        self.createdAt = createdAt
    }
}

// MARK: - Viewer State

public struct SerializedViewer: Codable {
    public let like: String?
    public let repost: String?
    public let muted: Bool?
    public let blocked: Bool?

    public init(like: String?, repost: String?, muted: Bool?, blocked: Bool?) {
        self.like = like
        self.repost = repost
        self.muted = muted
        self.blocked = blocked
    }
}

// MARK: - Labels

public struct SerializedLabel: Codable {
    public let val: String
    public let src: String
    public let uri: String
    public let cid: String?
    public let cts: String

    public init(val: String, src: String, uri: String, cid: String?, cts: String) {
        self.val = val
        self.src = src
        self.uri = uri
        self.cid = cid
        self.cts = cts
    }
}

// MARK: - Post

public struct SerializedPost: Codable {
    public let uri: String
    public let cid: String
    public let author: SerializedAuthor
    public let record: SerializedRecord
    public let embed: SerializedEmbed?
    public let replyCount: Int?
    public let repostCount: Int?
    public let likeCount: Int?
    public let quoteCount: Int?
    public let viewer: SerializedViewer?
    public let labels: [SerializedLabel]?
    public let indexedAt: String

    public init(uri: String, cid: String, author: SerializedAuthor, record: SerializedRecord, embed: SerializedEmbed?, replyCount: Int?, repostCount: Int?, likeCount: Int?, quoteCount: Int?, viewer: SerializedViewer?, labels: [SerializedLabel]?, indexedAt: String) {
        self.uri = uri
        self.cid = cid
        self.author = author
        self.record = record
        self.embed = embed
        self.replyCount = replyCount
        self.repostCount = repostCount
        self.likeCount = likeCount
        self.quoteCount = quoteCount
        self.viewer = viewer
        self.labels = labels
        self.indexedAt = indexedAt
    }
}

// MARK: - Reply Reference

public struct SerializedReplyRef: Codable {
    public let parent: SerializedPost
    public let root: SerializedPost

    public init(parent: SerializedPost, root: SerializedPost) {
        self.parent = parent
        self.root = root
    }
}

// MARK: - Reason

public struct SerializedReasonRepost: Codable {
    public let type: String
    public let by: SerializedAuthor
    public let indexedAt: String

    public init(type: String, by: SerializedAuthor, indexedAt: String) {
        self.type = type
        self.by = by
        self.indexedAt = indexedAt
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case by, indexedAt
    }
}

public enum SerializedReason: Codable {
    case repost(SerializedReasonRepost)

    public init(from decoder: Decoder) throws {
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

    public func encode(to encoder: Encoder) throws {
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

public struct SerializedFeedViewPost: Codable {
    public let post: SerializedPost
    public let reply: SerializedReplyRef?
    public let reason: SerializedReason?
    public let feedContext: String?

    public init(post: SerializedPost, reply: SerializedReplyRef?, reason: SerializedReason?, feedContext: String?) {
        self.post = post
        self.reply = reply
        self.reason = reason
        self.feedContext = feedContext
    }
}

// MARK: - Metadata

public struct FeedUpdateMetadata: Codable {
    public let timestamp: Int
    public let isBookmarked: Bool?
    public let isOnline: Bool
    public let isFromCache: Bool?

    public init(timestamp: Int, isBookmarked: Bool?, isOnline: Bool, isFromCache: Bool?) {
        self.timestamp = timestamp
        self.isBookmarked = isBookmarked
        self.isOnline = isOnline
        self.isFromCache = isFromCache
    }
}

// MARK: - Complete Feed Data

public struct SerializedFeedData: Codable {
    public var posts: [SerializedFeedViewPost]
    public let metadata: FeedUpdateMetadata
    public let cursor: String?

    public init(posts: [SerializedFeedViewPost], metadata: FeedUpdateMetadata, cursor: String?) {
        self.posts = posts
        self.metadata = metadata
        self.cursor = cursor
    }
}

// MARK: - Incremental Updates

public struct PostUpdate: Codable {
    public let uri: String
    public let likeCount: Int?
    public let repostCount: Int?
    public let replyCount: Int?
    public let viewer: SerializedViewer?
    public let isBookmarked: Bool?

    public init(uri: String, likeCount: Int?, repostCount: Int?, replyCount: Int?, viewer: SerializedViewer?, isBookmarked: Bool?) {
        self.uri = uri
        self.likeCount = likeCount
        self.repostCount = repostCount
        self.replyCount = replyCount
        self.viewer = viewer
        self.isBookmarked = isBookmarked
    }
}

public struct FeedBatchUpdate: Codable {
    public let updates: [PostUpdate]
    public let timestamp: Int

    public init(updates: [PostUpdate], timestamp: Int) {
        self.updates = updates
        self.timestamp = timestamp
    }
}

// MARK: - Helper Extensions

public extension SerializedFeedData {
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

public extension FeedBatchUpdate {
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
