import SwiftUI

/// Model for author data in quoted posts
struct AuthorData {
    let handle: String
    let displayName: String?
    let avatar: String?
}

/// Model for quoted post embed data
struct QuoteEmbedData {
    let uri: String
    let author: AuthorData
    let text: String?
    let createdAt: String?
}

/// SwiftUI view for quoted post embeds
struct QuoteEmbed: View {
    let record: QuoteEmbedData?
    let onPress: ((String, String) -> Void)?

    init(record: QuoteEmbedData?, onPress: ((String, String) -> Void)? = nil) {
        self.record = record
        self.onPress = onPress
    }

    var body: some View {
        Group {
            if let record = record {
                validQuoteView(record: record)
            } else {
                notFoundView
            }
        }
    }

    private func validQuoteView(record: QuoteEmbedData) -> some View {
        Button(action: { handlePress(record: record) }) {
            VStack(alignment: .leading, spacing: 8) {
                // Author header
                HStack(spacing: 8) {
                    // Avatar
                    if let avatarURL = record.author.avatar, let url = URL(string: avatarURL) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .empty:
                                Circle()
                                    .fill(Color.gray.opacity(0.3))
                            case .success(let image):
                                image
                                    .resizable()
                                    .aspectRatio(contentMode: .fill)
                            case .failure:
                                Circle()
                                    .fill(Color.gray.opacity(0.3))
                                    .overlay(
                                        Image(systemName: "person.fill")
                                            .font(.system(size: 10))
                                            .foregroundColor(.gray)
                                    )
                            @unknown default:
                                Circle()
                                    .fill(Color.gray.opacity(0.3))
                            }
                        }
                        .frame(width: 20, height: 20)
                        .clipShape(Circle())
                    } else {
                        Circle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(width: 20, height: 20)
                            .overlay(
                                Image(systemName: "person.fill")
                                    .font(.system(size: 10))
                                    .foregroundColor(.gray)
                            )
                    }

                    // Author info
                    HStack(spacing: 6) {
                        Text(record.author.displayName ?? record.author.handle)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                            .lineLimit(1)

                        Text("@\(record.author.handle)")
                            .font(.system(size: 13))
                            .foregroundColor(.gray)
                            .lineLimit(1)
                    }

                    Spacer()
                }

                // Post text (truncated to 3 lines)
                if let text = record.text {
                    Text(text)
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)
                }
            }
            .padding(12)
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

    private var notFoundView: some View {
        VStack {
            Text("[Post not found]")
                .font(.system(size: 14))
                .foregroundColor(.gray)
                .italic()
                .padding(16)
        }
        .frame(maxWidth: .infinity)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
        )
        .padding(.vertical, 8)
    }

    private func handlePress(record: QuoteEmbedData) {
        onPress?(record.uri, record.author.handle)
    }
}

#if DEBUG
struct QuoteEmbed_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            // Valid quote
            QuoteEmbed(
                record: QuoteEmbedData(
                    uri: "at://did:plc:123/app.bsky.feed.post/456",
                    author: AuthorData(
                        handle: "alice.bsky.social",
                        displayName: "Alice Smith",
                        avatar: "https://picsum.photos/100/100"
                    ),
                    text: "This is a quoted post with some interesting content that might span multiple lines and should be truncated after three lines.",
                    createdAt: "2024-01-15T12:00:00Z"
                )
            )

            // Without avatar
            QuoteEmbed(
                record: QuoteEmbedData(
                    uri: "at://did:plc:789/app.bsky.feed.post/012",
                    author: AuthorData(
                        handle: "bob.bsky.social",
                        displayName: nil,
                        avatar: nil
                    ),
                    text: "Short quote.",
                    createdAt: "2024-01-15T12:00:00Z"
                )
            )

            // Not found
            QuoteEmbed(record: nil)
        }
        .padding()
    }
}
#endif
