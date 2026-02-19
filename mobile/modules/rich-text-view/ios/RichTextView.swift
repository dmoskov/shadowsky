import SwiftUI
import UIKit
import FeedBridge

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
    let facets: [Facet]

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
public struct RichTextView: View {
    public let text: String
    public let facets: [Facet]
    public let onMentionTap: (String, String) -> Void  // (handle, did)
    public let onHashtagTap: (String) -> Void
    public let onLinkTap: (String) -> Void

    public init(text: String, facets: [Facet], onMentionTap: @escaping (String, String) -> Void, onHashtagTap: @escaping (String) -> Void, onLinkTap: @escaping (String) -> Void) {
        self.text = text
        self.facets = facets
        self.onMentionTap = onMentionTap
        self.onHashtagTap = onHashtagTap
        self.onLinkTap = onLinkTap
    }

    // Theme colors - matching React Native theme (primary blue #1d9bf0)
    private let primaryColor = Color(red: 0x1d / 255.0, green: 0x9b / 255.0, blue: 0xf0 / 255.0)

    public var body: some View {
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
/// Uses UITextView for proper link/tap detection
private struct WrappingRichText: UIViewRepresentable {
    let segments: [RichTextSegment]
    let primaryColor: Color
    let onMentionTap: (String, String) -> Void
    let onHashtagTap: (String) -> Void
    let onLinkTap: (String) -> Void

    func makeUIView(context: Context) -> UITextView {
        let textView = UITextView()
        textView.isEditable = false
        textView.isScrollEnabled = false
        textView.backgroundColor = .clear
        textView.textContainerInset = .zero
        textView.textContainer.lineFragmentPadding = 0
        textView.delegate = context.coordinator
        textView.linkTextAttributes = [
            .foregroundColor: UIColor(primaryColor),
            .underlineStyle: NSUnderlineStyle.single.rawValue
        ]
        // Prevent the text view from expanding beyond its container width.
        // Without this, UITextView's intrinsic content size can be wider than
        // the available space, causing parent SwiftUI views to overflow.
        textView.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        textView.setContentHuggingPriority(.defaultHigh, for: .vertical)
        return textView
    }

    func updateUIView(_ textView: UITextView, context: Context) {
        // Build attributed string from segments
        let attributedString = NSMutableAttributedString()

        // Default text attributes
        let defaultFont = UIFont.preferredFont(forTextStyle: .subheadline)
        let defaultColor = UIColor.label

        for segment in segments {
            let text = segment.text
            let attributes: [NSAttributedString.Key: Any]

            switch segment.type {
            case .plain:
                attributes = [
                    .font: defaultFont,
                    .foregroundColor: defaultColor
                ]

            case .mention(let handle, let did):
                attributes = [
                    .font: UIFont.preferredFont(forTextStyle: .subheadline).withWeight(.medium),
                    .foregroundColor: UIColor(primaryColor),
                    .link: "mention://\(did)|\(handle)"
                ]

            case .link(let uri):
                attributes = [
                    .font: defaultFont,
                    .foregroundColor: UIColor(primaryColor),
                    .underlineStyle: NSUnderlineStyle.single.rawValue,
                    .link: uri
                ]

            case .hashtag(let tag):
                attributes = [
                    .font: UIFont.preferredFont(forTextStyle: .subheadline).withWeight(.medium),
                    .foregroundColor: UIColor(primaryColor),
                    .link: "hashtag://\(tag)"
                ]
            }

            attributedString.append(NSAttributedString(string: text, attributes: attributes))
        }

        textView.attributedText = attributedString
        context.coordinator.onMentionTap = onMentionTap
        context.coordinator.onHashtagTap = onHashtagTap
        context.coordinator.onLinkTap = onLinkTap
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator: NSObject, UITextViewDelegate {
        var onMentionTap: ((String, String) -> Void)?
        var onHashtagTap: ((String) -> Void)?
        var onLinkTap: ((String) -> Void)?

        func textView(_ textView: UITextView, shouldInteractWith URL: URL, in characterRange: NSRange, interaction: UITextItemInteraction) -> Bool {
            let urlString = URL.absoluteString

            // Long-press on any link type shows an action sheet
            if interaction == .presentActions {
                let resolvedUri: String
                if urlString.hasPrefix("mention://") {
                    let components = urlString.replacingOccurrences(of: "mention://", with: "").split(separator: "|")
                    if components.count == 2 {
                        resolvedUri = "https://bsky.app/profile/\(components[1])"
                    } else {
                        return false
                    }
                } else if urlString.hasPrefix("hashtag://") {
                    let tag = urlString.replacingOccurrences(of: "hashtag://", with: "")
                    resolvedUri = "https://bsky.app/hashtag/\(tag)"
                } else {
                    resolvedUri = urlString
                }
                showLinkActionSheet(uri: resolvedUri, sourceView: textView)
                return false
            }

            // Normal tap handling
            if urlString.hasPrefix("mention://") {
                let components = urlString.replacingOccurrences(of: "mention://", with: "").split(separator: "|")
                if components.count == 2 {
                    let did = String(components[0])
                    let handle = String(components[1])
                    onMentionTap?(handle, did)
                }
                return false
            } else if urlString.hasPrefix("hashtag://") {
                let tag = urlString.replacingOccurrences(of: "hashtag://", with: "")
                onHashtagTap?(tag)
                return false
            } else {
                onLinkTap?(urlString)
                return false
            }
        }

        private func showLinkActionSheet(uri: String, sourceView: UIView) {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.impactOccurred()

            let alert = UIAlertController(title: uri, message: nil, preferredStyle: .actionSheet)

            alert.addAction(UIAlertAction(title: "Open in Browser", style: .default) { _ in
                if let url = Foundation.URL(string: uri) {
                    UIApplication.shared.open(url)
                }
            })

            alert.addAction(UIAlertAction(title: "Copy Link", style: .default) { _ in
                UIPasteboard.general.string = uri
            })

            alert.addAction(UIAlertAction(title: "Share Link", style: .default) { _ in
                let activityVC = UIActivityViewController(activityItems: [uri], applicationActivities: nil)
                activityVC.popoverPresentationController?.sourceView = sourceView
                activityVC.popoverPresentationController?.sourceRect = sourceView.bounds
                if let viewController = sourceView.findViewController() {
                    viewController.present(activityVC, animated: true)
                }
            })

            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))

            alert.popoverPresentationController?.sourceView = sourceView
            alert.popoverPresentationController?.sourceRect = sourceView.bounds

            if let viewController = sourceView.findViewController() {
                viewController.present(alert, animated: true)
            }
        }
    }
}

// MARK: - UIView Extension

private extension UIView {
    func findViewController() -> UIViewController? {
        var responder: UIResponder? = self
        while let next = responder?.next {
            if let vc = next as? UIViewController {
                return vc
            }
            responder = next
        }
        return nil
    }
}

// MARK: - UIFont Extension

private extension UIFont {
    func withWeight(_ weight: UIFont.Weight) -> UIFont {
        let descriptor = fontDescriptor.addingAttributes([
            .traits: [UIFontDescriptor.TraitKey.weight: weight]
        ])
        return UIFont(descriptor: descriptor, size: pointSize)
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
                    Facet(
                        index: FacetIndex(byteStart: 6, byteEnd: 24),
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
                    Facet(
                        index: FacetIndex(byteStart: 10, byteEnd: 29),
                        features: [.link(FacetFeatureLink(type: "app.bsky.richtext.facet#link", uri: "https://example.com"))]
                    ),
                    Facet(
                        index: FacetIndex(byteStart: 34, byteEnd: 42),
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
                text: "Hello \u{1F44B} @alice check this \u{1F525}",
                facets: [
                    Facet(
                        index: FacetIndex(byteStart: 11, byteEnd: 17),
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
