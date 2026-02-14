import SwiftUI

/// Enum representing different embed types from AT Protocol
enum EmbedType {
    case images([ImageEmbedData])
    case video(VideoEmbedData)
    case external(ExternalLinkEmbedData)
    case quote(QuoteEmbedData?)
    case recordWithMedia(media: EmbedType, record: QuoteEmbedData?)
}

/// Model for post embed data that includes type information
struct PostEmbedData {
    let embedType: EmbedType
}

/// Dispatcher view that routes to the correct embed component based on AT Protocol type
struct PostEmbed: View {
    let embed: PostEmbedData?
    let onImagePress: (([ImageEmbedData], Int) -> Void)?
    let onLinkPress: ((String) -> Void)?
    let onQuotePress: ((String, String) -> Void)?
    let blurImages: Bool

    init(
        embed: PostEmbedData?,
        onImagePress: (([ImageEmbedData], Int) -> Void)? = nil,
        onLinkPress: ((String) -> Void)? = nil,
        onQuotePress: ((String, String) -> Void)? = nil,
        blurImages: Bool = false
    ) {
        self.embed = embed
        self.onImagePress = onImagePress
        self.onLinkPress = onLinkPress
        self.onQuotePress = onQuotePress
        self.blurImages = blurImages
    }

    var body: some View {
        Group {
            if let embed = embed {
                embedView(for: embed.embedType)
            }
        }
    }

    @ViewBuilder
    private func embedView(for type: EmbedType) -> some View {
        switch type {
        case .images(let images):
            ImageEmbed(
                images: images,
                blurImages: blurImages,
                onImagePress: onImagePress
            )

        case .video(let video):
            VideoEmbed(
                video: video,
                onPress: onLinkPress
            )

        case .external(let external):
            ExternalLinkEmbed(
                external: external,
                onPress: onLinkPress
            )

        case .quote(let record):
            QuoteEmbed(
                record: record,
                onPress: onQuotePress
            )

        case .recordWithMedia(let media, let record):
            // RecordWithMedia combines media + quote - render both
            VStack(spacing: 0) {
                // Render the media part
                embedView(for: media)

                // Render the quoted record part
                if let record = record {
                    QuoteEmbed(
                        record: record,
                        onPress: onQuotePress
                    )
                }
            }
        }
    }
}

// MARK: - Helper Extensions for AT Protocol Type Detection

/// Extension to help create PostEmbedData from AT Protocol JSON data
/// This would typically be called from TypeScript/React Native side
extension PostEmbedData {
    /// Create PostEmbedData from a dictionary representation
    /// This mirrors the type guard logic from the React Native PostEmbed.tsx
    static func from(dict: [String: Any]) -> PostEmbedData? {
        guard let type = dict["$type"] as? String else { return nil }

        switch type {
        case "app.bsky.embed.images#view":
            return fromImagesView(dict: dict)

        case "app.bsky.embed.external#view":
            return fromExternalView(dict: dict)

        case "app.bsky.embed.record#view":
            return fromRecordView(dict: dict)

        case "app.bsky.embed.recordWithMedia#view":
            return fromRecordWithMediaView(dict: dict)

        case "app.bsky.embed.video#view":
            return fromVideoView(dict: dict)

        default:
            return nil
        }
    }

    private static func fromImagesView(dict: [String: Any]) -> PostEmbedData? {
        guard let imagesArray = dict["images"] as? [[String: Any]] else { return nil }

        let images = imagesArray.compactMap { imageDict -> ImageEmbedData? in
            guard let thumb = imageDict["thumb"] as? String,
                  let fullsize = imageDict["fullsize"] as? String else {
                return nil
            }
            return ImageEmbedData(
                thumb: thumb,
                fullsize: fullsize,
                alt: imageDict["alt"] as? String,
                aspectRatio: imageDict["aspectRatio"] as? Double
            )
        }

        guard !images.isEmpty else { return nil }
        return PostEmbedData(embedType: .images(images))
    }

    private static func fromVideoView(dict: [String: Any]) -> PostEmbedData? {
        guard let playlist = dict["playlist"] as? String else { return nil }

        let video = VideoEmbedData(
            playlist: playlist,
            thumbnail: dict["thumbnail"] as? String,
            alt: dict["alt"] as? String,
            aspectRatio: dict["aspectRatio"] as? Double
        )

        return PostEmbedData(embedType: .video(video))
    }

    private static func fromExternalView(dict: [String: Any]) -> PostEmbedData? {
        guard let externalDict = dict["external"] as? [String: Any],
              let uri = externalDict["uri"] as? String else {
            return nil
        }

        let external = ExternalLinkEmbedData(
            uri: uri,
            title: externalDict["title"] as? String,
            description: externalDict["description"] as? String,
            thumb: externalDict["thumb"] as? String
        )

        return PostEmbedData(embedType: .external(external))
    }

    private static func fromRecordView(dict: [String: Any]) -> PostEmbedData? {
        guard let recordDict = dict["record"] as? [String: Any] else {
            return PostEmbedData(embedType: .quote(nil))
        }

        let quote = parseQuoteRecord(recordDict: recordDict)
        return PostEmbedData(embedType: .quote(quote))
    }

    private static func fromRecordWithMediaView(dict: [String: Any]) -> PostEmbedData? {
        guard let mediaDict = dict["media"] as? [String: Any],
              let mediaEmbed = PostEmbedData.from(dict: mediaDict) else {
            return nil
        }

        var quoteRecord: QuoteEmbedData?
        if let recordDict = dict["record"] as? [String: Any],
           let nestedRecord = recordDict["record"] as? [String: Any] {
            quoteRecord = parseQuoteRecord(recordDict: nestedRecord)
        }

        return PostEmbedData(embedType: .recordWithMedia(media: mediaEmbed.embedType, record: quoteRecord))
    }

    private static func parseQuoteRecord(recordDict: [String: Any]) -> QuoteEmbedData? {
        guard let uri = recordDict["uri"] as? String,
              let authorDict = recordDict["author"] as? [String: Any],
              let handle = authorDict["handle"] as? String else {
            return nil
        }

        let author = AuthorData(
            handle: handle,
            displayName: authorDict["displayName"] as? String,
            avatar: authorDict["avatar"] as? String
        )

        var text: String?
        if let valueDict = recordDict["value"] as? [String: Any] {
            text = valueDict["text"] as? String
        }

        return QuoteEmbedData(
            uri: uri,
            author: author,
            text: text,
            createdAt: recordDict["createdAt"] as? String
        )
    }
}

#if DEBUG
struct PostEmbed_Previews: PreviewProvider {
    static var previews: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Images embed
                PostEmbed(
                    embed: PostEmbedData(embedType: .images([
                        ImageEmbedData(thumb: "https://picsum.photos/400/300", fullsize: "https://picsum.photos/1200/900", alt: "Test", aspectRatio: 1.33)
                    ]))
                )

                // Video embed
                PostEmbed(
                    embed: PostEmbedData(embedType: .video(
                        VideoEmbedData(
                            playlist: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                            thumbnail: "https://picsum.photos/400/240",
                            alt: nil,
                            aspectRatio: 1.78
                        )
                    ))
                )

                // External link embed
                PostEmbed(
                    embed: PostEmbedData(embedType: .external(
                        ExternalLinkEmbedData(
                            uri: "https://example.com/article",
                            title: "Example Article",
                            description: "An interesting article",
                            thumb: "https://picsum.photos/400/180"
                        )
                    ))
                )

                // Quote embed
                PostEmbed(
                    embed: PostEmbedData(embedType: .quote(
                        QuoteEmbedData(
                            uri: "at://did:plc:123/app.bsky.feed.post/456",
                            author: AuthorData(
                                handle: "alice.bsky.social",
                                displayName: "Alice",
                                avatar: "https://picsum.photos/100/100"
                            ),
                            text: "Quoted post text",
                            createdAt: "2024-01-15T12:00:00Z"
                        )
                    ))
                )
            }
            .padding()
        }
    }
}
#endif
