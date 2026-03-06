//
//  PostCardTypes.swift
//  NativeFeedList
//
//  Local UI types for rendering posts in the feed list.
//  These are converted from FeedBridge's serialized types.
//

import Foundation
import FeedBridge
import ExpoSwiftUIFeed

// MARK: - Reply Parent (UI Model)

struct ReplyParent: Equatable {
    let uri: String
    let authorHandle: String
    let authorDisplayName: String?
    let authorAvatar: String?
    let text: String?
}

// MARK: - Feed View Post (UI Model)

struct FeedViewPost: Equatable {
    let post: PostView
    let replyParent: ReplyParent?

    init(post: PostView, replyParent: ReplyParent? = nil) {
        self.post = post
        self.replyParent = replyParent
    }
}

struct PostView: Equatable {
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

struct PostAuthor: Equatable {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
    let isVerified: Bool
}

struct PostRecord: Equatable {
    let text: String
    let facets: [PostFacet]?
    let createdAt: String
    let embed: PostEmbedData?
}

struct PostViewer: Equatable {
    let like: String?
    let repost: String?
}

struct ContentLabel: Equatable {
    let val: String
    let src: String
}

// MARK: - Facets (UI Model)

struct PostFacet: Equatable {
    let index: PostFacetIndex
    let features: [PostFacetFeature]
}

struct PostFacetIndex: Equatable {
    let byteStart: Int
    let byteEnd: Int
}

enum PostFacetFeature: Equatable {
    case mention(did: String)
    case link(uri: String)
    case hashtag(tag: String)
}

// MARK: - Embed Conversion

extension PostEmbedData {
    /// Convert from FeedBridge SerializedEmbed to ExpoSwiftUIFeed PostEmbedData
    static func from(serializedEmbed: SerializedEmbed) -> PostEmbedData? {
        switch serializedEmbed {
        case .images(let embedImages):
            return fromImages(embedImages)
        case .external(let embedExternal):
            return fromExternal(embedExternal)
        case .record(let embedRecord):
            return fromRecord(embedRecord)
        case .recordWithMedia(let embedRecordWithMedia):
            return fromRecordWithMedia(embedRecordWithMedia)
        case .video(let embedVideo):
            return fromVideo(embedVideo)
        }
    }

    private static func fromImages(_ embedImages: EmbedImages) -> PostEmbedData? {
        let images = embedImages.images.map { viewImage in
            ImageEmbedData(
                thumb: viewImage.thumb,
                fullsize: viewImage.fullsize,
                alt: viewImage.alt,
                aspectRatio: viewImage.aspectRatio.map { Double($0.width) / Double($0.height) }
            )
        }
        guard !images.isEmpty else { return nil }
        return PostEmbedData(embedType: .images(images))
    }

    private static func fromVideo(_ embedVideo: EmbedVideo) -> PostEmbedData? {
        let video = VideoEmbedData(
            playlist: embedVideo.video.playlist,
            thumbnail: embedVideo.video.thumbnail,
            alt: nil,
            aspectRatio: embedVideo.video.aspectRatio.map { Double($0.width) / Double($0.height) }
        )
        return PostEmbedData(embedType: .video(video))
    }

    private static func fromExternal(_ embedExternal: EmbedExternal) -> PostEmbedData? {
        let external = ExternalLinkEmbedData(
            uri: embedExternal.external.uri,
            title: embedExternal.external.title,
            description: embedExternal.external.description,
            thumb: embedExternal.external.thumb
        )
        return PostEmbedData(embedType: .external(external))
    }

    private static func fromRecord(_ embedRecord: EmbedRecord) -> PostEmbedData? {
        let quote = parseQuoteRecord(viewRecord: embedRecord.record)
        return PostEmbedData(embedType: .quote(quote))
    }

    private static func fromRecordWithMedia(_ embedRecordWithMedia: EmbedRecordWithMedia) -> PostEmbedData? {
        // Convert media first
        guard let mediaEmbed = PostEmbedData.from(serializedEmbed: embedRecordWithMedia.media) else {
            return nil
        }

        // Convert record
        let quote = parseQuoteRecord(viewRecord: embedRecordWithMedia.record.record)

        return PostEmbedData(embedType: .recordWithMedia(media: mediaEmbed.embedType, record: quote))
    }

    private static func parseQuoteRecord(viewRecord: ViewRecord) -> QuoteEmbedData? {
        let author = AuthorData(
            handle: viewRecord.author.handle,
            displayName: viewRecord.author.displayName,
            avatar: viewRecord.author.avatar
        )

        return QuoteEmbedData(
            uri: viewRecord.uri,
            author: author,
            text: viewRecord.value.text,
            createdAt: viewRecord.value.createdAt
        )
    }
}
