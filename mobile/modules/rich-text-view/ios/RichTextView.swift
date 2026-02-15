import SwiftUI
import FeedBridge

// MARK: - Facet Models

/// Represents an AT Protocol facet with byte range and features
/// Uses FacetFeature from FeedBridge module to avoid duplication
struct ATFacet: Codable {
    let index: ByteSlice
    let features: [FacetFeature]

    struct ByteSlice: Codable {
        let byteStart: Int
        let byteEnd: Int
    }

    /// Convert from FeedBridge.Facet to ATFacet
    init(from bridgeFacet: Facet) {
        self.index = ByteSlice(
            byteStart: bridgeFacet.index.byteStart,
            byteEnd: bridgeFacet.index.byteEnd
        )
        self.features = bridgeFacet.features
    }

    init(index: ByteSlice, features: [FacetFeature]) {
        self.index = index
        self.features = features
    }
}

// MARK: - Rich Text Segment

/// Represents a parsed segment of rich text
struct RichTextSegment {
    let text: String
    let type: SegmentType

    enum SegmentType {
        case plain
        case mention(handle: String, did: String)
        case link(uri: String)
        case hashtag(tag: String)
    }
}

// MARK: - UTF-8 Byte Offset Converter

/// Handles conversion between UTF-8 byte offsets (used by AT Protocol) and Swift String.Index
struct ByteOffsetConverter {
    let text: String
    private let utf8View: String.UTF8View

    init(text: String) {
        self.text = text
        self.utf8View = text.utf8
    }

    /// Convert byte offset to String.Index
    /// - Parameter byteOffset: UTF-8 byte offset
    /// - Returns: Corresponding String.Index, or nil if out of bounds
    func index(fromByteOffset byteOffset: Int) -> String.Index? {
        guard byteOffset >= 0 && byteOffset <= utf8View.count else {
            return nil
        }

        // Get UTF-8 index
        let utf8Index = utf8View.index(utf8View.startIndex, offsetBy: byteOffset)

        // Convert to String.Index
        // This handles multi-byte characters correctly
        return utf8Index.samePosition(in: text)
    }

    /// Extract substring using byte offsets
    /// - Parameters:
    ///   - start: Start byte offset
    ///   - end: End byte offset
    /// - Returns: Substring, or nil if offsets are invalid
    func substring(byteStart start: Int, byteEnd end: Int) -> String? {
        guard let startIndex = index(fromByteOffset: start),
              let endIndex = index(fromByteOffset: end),
              startIndex <= endIndex else {
            return nil
        }

        return String(text[startIndex..<endIndex])
    }
}

// MARK: - Rich Text Parser

/// Parses text with AT Protocol facets into segments
struct RichTextParser {
    let text: String
    let facets: [ATFacet]

    /// Parse text into segments with facet information
    func parse() -> [RichTextSegment] {
        var segments: [RichTextSegment] = []
        let converter = ByteOffsetConverter(text: text)

        // Sort facets by byte start position
        let sortedFacets = facets.sorted { $0.index.byteStart < $1.index.byteStart }

        var currentByteOffset = 0

        for facet in sortedFacets {
            let byteStart = facet.index.byteStart
            let byteEnd = facet.index.byteEnd

            // Add plain text segment before this facet
            if currentByteOffset < byteStart {
                if let plainText = converter.substring(byteStart: currentByteOffset, byteEnd: byteStart),
                   !plainText.isEmpty {
                    segments.append(RichTextSegment(text: plainText, type: .plain))
                }
            }

            // Add faceted segment
            if let facetText = converter.substring(byteStart: byteStart, byteEnd: byteEnd) {
                let segment = createSegment(text: facetText, features: facet.features)
                segments.append(segment)
            }

            currentByteOffset = max(currentByteOffset, byteEnd)
        }

        // Add remaining plain text after last facet
        let textByteCount = text.utf8.count
        if currentByteOffset < textByteCount {
            if let plainText = converter.substring(byteStart: currentByteOffset, byteEnd: textByteCount),
               !plainText.isEmpty {
                segments.append(RichTextSegment(text: plainText, type: .plain))
            }
        }

        return segments
    }

    private func createSegment(text: String, features: [FacetFeature]) -> RichTextSegment {
        // Use first feature (AT Protocol allows multiple features per facet, but we use the first)
        guard let feature = features.first else {
            return RichTextSegment(text: text, type: .plain)
        }

        switch feature {
        case .mention(let mention):
            // Extract handle from text (remove @ prefix if present)
            let handle = text.hasPrefix("@") ? String(text.dropFirst()) : text
            return RichTextSegment(text: text, type: .mention(handle: handle, did: mention.did))

        case .link(let link):
            return RichTextSegment(text: text, type: .link(uri: link.uri))

        case .tag(let tag):
            return RichTextSegment(text: text, type: .hashtag(tag: tag.tag))
        }
    }
}

// MARK: - SwiftUI View

/// SwiftUI view for rendering rich text with AT Protocol facets
struct RichTextView: View {
    let text: String
    let facets: [ATFacet]
    let onMentionTap: (String, String) -> Void  // (handle, did)
    let onHashtagTap: (String) -> Void
    let onLinkTap: (String) -> Void

    // Theme colors - matching React Native theme (primary blue #1d9bf0)
    private let primaryColor = Color(red: 0x1d / 255.0, green: 0x9b / 255.0, blue: 0xf0 / 255.0)

    var body: some View {
        let parser = RichTextParser(text: text, facets: facets)
        let segments = parser.parse()

        // Use a wrapping text view with tap detection
        // Note: SwiftUI's Text with attributed strings supports some gestures,
        // but for full tap handling we use an overlay approach
        WrappingRichText(
            segments: segments,
            primaryColor: primaryColor,
            onMentionTap: onMentionTap,
            onHashtagTap: onHashtagTap,
            onLinkTap: onLinkTap
        )
    }
}

// MARK: - Wrapping Rich Text View

/// A view that renders rich text segments with tap handling
/// Uses Text concatenation for layout with gesture detection overlay
private struct WrappingRichText: View {
    let segments: [RichTextSegment]
    let primaryColor: Color
    let onMentionTap: (String, String) -> Void
    let onHashtagTap: (String) -> Void
    let onLinkTap: (String) -> Void

    var body: some View {
        // Concatenate all segments into styled text
        let styledText = segments.reduce(Text("")) { result, segment in
            result + segmentText(for: segment)
        }

        // TODO: Tap handling for individual facets
        // SwiftUI's Text view with concatenation doesn't support per-segment tap gestures.
        // Current implementation styles the text correctly (colors, underlines) but taps
        // are not functional. To enable tap handling, consider these approaches:
        // 1. Use UIViewRepresentable with UITextView and NSAttributedString with link attributes
        // 2. Use a custom Layout that positions individual Text views wrapped in Buttons
        // 3. Wait for SwiftUI to add native support for tappable text segments
        // The event handlers (onMentionTap, onHashtagTap, onLinkTap) are wired up in
        // RichTextViewWrapper but cannot be called without proper tap detection.
        styledText
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func segmentText(for segment: RichTextSegment) -> Text {
        switch segment.type {
        case .plain:
            return Text(segment.text)

        case .mention:
            return Text(segment.text)
                .foregroundColor(primaryColor)
                .fontWeight(.medium)

        case .link:
            return Text(segment.text)
                .foregroundColor(primaryColor)
                .underline()

        case .hashtag:
            return Text(segment.text)
                .foregroundColor(primaryColor)
                .fontWeight(.medium)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct RichTextView_Previews: PreviewProvider {
    static var previews: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Plain text
            RichTextView(
                text: "This is plain text with no facets",
                facets: [],
                onMentionTap: { _, _ in },
                onHashtagTap: { _ in },
                onLinkTap: { _ in }
            )
            .padding()

            // Text with mention
            RichTextView(
                text: "Hello @alice.bsky.social how are you?",
                facets: [
                    ATFacet(
                        index: ATFacet.ByteSlice(byteStart: 6, byteEnd: 24),
                        features: [.mention(FacetFeatureMention(type: "app.bsky.richtext.facet#mention", did: "did:plc:alice123"))]
                    )
                ],
                onMentionTap: { handle, did in
                    print("Tapped mention: \(handle), \(did)")
                },
                onHashtagTap: { _ in },
                onLinkTap: { _ in }
            )
            .padding()

            // Text with link and hashtag
            RichTextView(
                text: "Check out https://example.com and #swiftui",
                facets: [
                    ATFacet(
                        index: ATFacet.ByteSlice(byteStart: 10, byteEnd: 29),
                        features: [.link(FacetFeatureLink(type: "app.bsky.richtext.facet#link", uri: "https://example.com"))]
                    ),
                    ATFacet(
                        index: ATFacet.ByteSlice(byteStart: 34, byteEnd: 42),
                        features: [.tag(FacetFeatureTag(type: "app.bsky.richtext.facet#tag", tag: "swiftui"))]
                    )
                ],
                onMentionTap: { _, _ in },
                onHashtagTap: { tag in
                    print("Tapped hashtag: \(tag)")
                },
                onLinkTap: { uri in
                    print("Tapped link: \(uri)")
                }
            )
            .padding()

            // Text with emoji (tests UTF-8 handling)
            RichTextView(
                text: "Hello 👋 @alice check this 🔥",
                facets: [
                    ATFacet(
                        index: ATFacet.ByteSlice(byteStart: 11, byteEnd: 17),
                        features: [.mention(FacetFeatureMention(type: "app.bsky.richtext.facet#mention", did: "did:plc:alice123"))]
                    )
                ],
                onMentionTap: { handle, did in
                    print("Tapped mention: \(handle), \(did)")
                },
                onHashtagTap: { _ in },
                onLinkTap: { _ in }
            )
            .padding()
        }
    }
}
#endif
