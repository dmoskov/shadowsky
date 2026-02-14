//
//  RichTextView.swift
//  Asphodel
//
//  Created by Claude Code
//  Task 7 dependency - Rich text rendering for SwiftUI
//

import SwiftUI

/// Renders rich text with mentions, hashtags, and links
struct RichTextView: View {
    let text: String
    let facets: [PostFacet]?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?
    let textColor: Color
    let linkColor: Color
    let fontSize: CGFloat

    init(
        text: String,
        facets: [PostFacet]? = nil,
        onMentionPress: ((String, String) -> Void)? = nil,
        onHashtagPress: ((String) -> Void)? = nil,
        textColor: Color = .white,
        linkColor: Color = Color(hex: "#3b82f6"),
        fontSize: CGFloat = 15
    ) {
        self.text = text
        self.facets = facets
        self.onMentionPress = onMentionPress
        self.onHashtagPress = onHashtagPress
        self.textColor = textColor
        self.linkColor = linkColor
        self.fontSize = fontSize
    }

    var body: some View {
        if let facets = facets, !facets.isEmpty {
            renderRichText()
        } else {
            Text(text)
                .foregroundColor(textColor)
                .font(.system(size: fontSize))
        }
    }

    @ViewBuilder
    private func renderRichText() -> some View {
        let segments = parseSegments()

        Text(segments.reduce(Text("")) { result, segment in
            result + segment
        })
        .font(.system(size: fontSize))
        .lineSpacing(5)
    }

    private func parseSegments() -> [Text] {
        guard let facets = facets else {
            return [Text(text).foregroundColor(textColor)]
        }

        var segments: [Text] = []
        var currentIndex = 0
        let textData = text.data(using: .utf8) ?? Data()

        // Sort facets by byte position
        let sortedFacets = facets.sorted { $0.index.byteStart < $1.index.byteStart }

        for facet in sortedFacets {
            // Add text before this facet
            if currentIndex < facet.index.byteStart {
                let range = currentIndex..<facet.index.byteStart
                if let substring = extractSubstring(from: textData, range: range) {
                    segments.append(Text(substring).foregroundColor(textColor))
                }
            }

            // Add the facet text
            let facetRange = facet.index.byteStart..<facet.index.byteEnd
            if let facetText = extractSubstring(from: textData, range: facetRange) {
                let facetSegment = createFacetSegment(text: facetText, features: facet.features)
                segments.append(facetSegment)
            }

            currentIndex = facet.index.byteEnd
        }

        // Add remaining text
        if currentIndex < textData.count {
            let range = currentIndex..<textData.count
            if let substring = extractSubstring(from: textData, range: range) {
                segments.append(Text(substring).foregroundColor(textColor))
            }
        }

        return segments
    }

    private func extractSubstring(from data: Data, range: Range<Int>) -> String? {
        guard range.lowerBound >= 0, range.upperBound <= data.count else {
            return nil
        }
        let subdata = data[range.lowerBound..<range.upperBound]
        return String(data: subdata, encoding: .utf8)
    }

    private func createFacetSegment(text: String, features: [PostFacetFeature]) -> Text {
        guard let feature = features.first else {
            return Text(text).foregroundColor(textColor)
        }

        switch feature {
        case .mention(let did):
            // Note: SwiftUI Text doesn't support onTapGesture per segment
            // In a full implementation, you'd need to use AttributedString or custom layout
            return Text(text)
                .foregroundColor(linkColor)
                .underline(false)

        case .link:
            return Text(text)
                .foregroundColor(linkColor)
                .underline()

        case .hashtag:
            return Text(text)
                .foregroundColor(linkColor)
                .underline(false)
        }
    }
}

// MARK: - Tappable Rich Text (Alternative Implementation)

/// A more interactive version using UIViewRepresentable for tap handling
/// This would be the preferred implementation for production use
struct TappableRichTextView: View {
    let text: String
    let facets: [PostFacet]?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?
    let textColor: Color
    let linkColor: Color
    let fontSize: CGFloat

    var body: some View {
        // For now, use the simpler RichTextView
        // TODO: Implement UITextView-based solution for true tap handling
        RichTextView(
            text: text,
            facets: facets,
            onMentionPress: onMentionPress,
            onHashtagPress: onHashtagPress,
            textColor: textColor,
            linkColor: linkColor,
            fontSize: fontSize
        )
    }
}

// MARK: - Color Extension

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
