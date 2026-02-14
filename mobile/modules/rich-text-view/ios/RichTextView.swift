import SwiftUI

// MARK: - Facet Models

/// Represents an AT Protocol facet with byte range and features
struct ATFacet: Codable {
    let index: ByteSlice
    let features: [FacetFeature]

    struct ByteSlice: Codable {
        let byteStart: Int
        let byteEnd: Int
    }
}

/// Different types of facet features supported by AT Protocol
enum FacetFeature: Codable {
    case mention(did: String)
    case link(uri: String)
    case tag(tag: String)

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case did
        case uri
        case tag
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
        case .tag(let tag):
            try container.encode("app.bsky.richtext.facet#tag", forKey: .type)
            try container.encode(tag, forKey: .tag)
        }
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
        case .mention(let did):
            // Extract handle from text (remove @ prefix if present)
            let handle = text.hasPrefix("@") ? String(text.dropFirst()) : text
            return RichTextSegment(text: text, type: .mention(handle: handle, did: did))

        case .link(let uri):
            return RichTextSegment(text: text, type: .link(uri: uri))

        case .tag(let tag):
            return RichTextSegment(text: text, type: .hashtag(tag: tag))
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

        // Use Text concatenation for inline rendering
        segments.reduce(Text("")) { result, segment in
            result + segmentText(for: segment)
        }
    }

    private func segmentText(for segment: RichTextSegment) -> Text {
        switch segment.type {
        case .plain:
            return Text(segment.text)

        case .mention(let handle, let did):
            return Text(segment.text)
                .foregroundColor(primaryColor)
                .onTapGesture {
                    onMentionTap(handle, did)
                }

        case .link(let uri):
            return Text(segment.text)
                .foregroundColor(primaryColor)
                .underline()
                .onTapGesture {
                    onLinkTap(uri)
                }

        case .hashtag(let tag):
            return Text(segment.text)
                .foregroundColor(primaryColor)
                .onTapGesture {
                    onHashtagTap(tag)
                }
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
                        features: [.mention(did: "did:plc:alice123")]
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
                        features: [.link(uri: "https://example.com")]
                    ),
                    ATFacet(
                        index: ATFacet.ByteSlice(byteStart: 34, byteEnd: 42),
                        features: [.tag(tag: "swiftui")]
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
                        features: [.mention(did: "did:plc:alice123")]
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
