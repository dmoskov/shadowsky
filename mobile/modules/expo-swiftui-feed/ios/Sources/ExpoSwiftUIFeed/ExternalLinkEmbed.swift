import SwiftUI

/// Model for external link embed data
public struct ExternalLinkEmbedData {
    public let uri: String
    public let title: String?
    public let description: String?
    public let thumb: String?
    public init(uri: String, title: String?, description: String?, thumb: String?) {
        self.uri = uri
        self.title = title
        self.description = description
        self.thumb = thumb
    }
}

/// SwiftUI view for external link embeds with thumbnail and metadata
struct ExternalLinkEmbed: View {
    let external: ExternalLinkEmbedData
    let onPress: ((String) -> Void)?

    init(external: ExternalLinkEmbedData, onPress: ((String) -> Void)? = nil) {
        self.external = external
        self.onPress = onPress
    }

    var body: some View {
        Button(action: handlePress) {
            VStack(spacing: 0) {
                // Thumbnail
                if let thumbURL = external.thumb, let url = URL(string: thumbURL) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .empty:
                            Color.gray.opacity(0.2)
                                .frame(height: 180)
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(height: 180)
                                .clipped()
                        case .failure:
                            Color.gray.opacity(0.2)
                                .frame(height: 180)
                                .overlay(
                                    Image(systemName: "link")
                                        .foregroundColor(.gray)
                                )
                        @unknown default:
                            Color.gray.opacity(0.2)
                                .frame(height: 180)
                        }
                    }
                }

                // Text content
                VStack(alignment: .leading, spacing: 4) {
                    // Domain
                    Text(getDomain(from: external.uri))
                        .font(.system(size: 12))
                        .foregroundColor(.gray)
                        .lineLimit(1)

                    // Title
                    if let title = external.title {
                        Text(title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundColor(.primary)
                            .lineLimit(2)
                    }

                    // Description
                    if let description = external.description {
                        Text(description)
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(PlainButtonStyle())
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
        )
        .padding(.vertical, 8)
    }

    private func handlePress() {
        if let onPress = onPress {
            onPress(external.uri)
        } else {
            // Default behavior: open URL if no handler provided
            if let url = URL(string: external.uri) {
                UIApplication.shared.open(url)
            }
        }
    }

    private func getDomain(from urlString: String) -> String {
        guard let url = URL(string: urlString),
              let host = url.host else {
            return urlString
        }
        // Remove www. prefix if present
        return host.replacingOccurrences(of: "^www\\.", with: "", options: .regularExpression)
    }
}

#if DEBUG
struct ExternalLinkEmbed_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            // With thumbnail
            ExternalLinkEmbed(
                external: ExternalLinkEmbedData(
                    uri: "https://example.com/article",
                    title: "An Interesting Article About Technology",
                    description: "This is a description of the article that provides more context about what the reader can expect.",
                    thumb: "https://picsum.photos/400/180"
                )
            )

            // Without thumbnail
            ExternalLinkEmbed(
                external: ExternalLinkEmbedData(
                    uri: "https://www.news.com/story",
                    title: "Breaking News Story",
                    description: "Latest updates on the developing situation.",
                    thumb: nil
                )
            )

            // Minimal
            ExternalLinkEmbed(
                external: ExternalLinkEmbedData(
                    uri: "https://blog.example.com",
                    title: "Blog Post",
                    description: nil,
                    thumb: nil
                )
            )
        }
        .padding()
    }
}
#endif
