//
//  PostCard.swift
//  Asphodel
//
//  SwiftUI view for displaying a single post
//  NOTE: This is a placeholder implementation. The full implementation
//  depends on Task 2 (PostCard SwiftUI view) which includes:
//  - Full post rendering with rich text
//  - Embedded content (images, videos, external links)
//  - Interaction buttons (like, repost, reply, bookmark)
//  - Avatar and profile information
//  - Timestamp and metadata
//

import SwiftUI

struct PostCard: View {
    let post: FeedViewPost
    let onPress: (() -> Void)?
    let onPressProfile: ((String) -> Void)?
    let onLike: (() -> Void)?
    let onRepost: (() -> Void)?
    let onReply: (() -> Void)?
    let onBookmark: (() -> Void)?
    let isBookmarked: Bool
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header: Avatar and author info
            HStack(spacing: 12) {
                // Avatar placeholder
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 40, height: 40)
                    .onTapGesture {
                        onPressProfile?(post.post.author.handle)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(post.post.author.displayName ?? post.post.author.handle)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(.white)

                    Text("@\(post.post.author.handle)")
                        .font(.system(size: 13))
                        .foregroundColor(.gray)
                }

                Spacer()

                // Timestamp
                Text(formatTimestamp(post.post.indexedAt))
                    .font(.system(size: 13))
                    .foregroundColor(.gray)
            }

            // Post content
            Text(post.post.record.text)
                .font(.system(size: 15))
                .foregroundColor(.white)
                .fixedSize(horizontal: false, vertical: true)
                .onTapGesture {
                    onPress?()
                }

            // TODO: Add embed rendering (images, videos, external links, quoted posts)
            // This will be implemented in Task 3 (embed views)

            // Action buttons
            HStack(spacing: 40) {
                // Reply
                Button(action: { onReply?() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "bubble.left")
                        if let count = post.post.replyCount, count > 0 {
                            Text("\(count)")
                                .font(.system(size: 13))
                        }
                    }
                    .foregroundColor(.gray)
                }

                // Repost
                Button(action: { onRepost?() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.2.squarepath")
                        if let count = post.post.repostCount, count > 0 {
                            Text("\(count)")
                                .font(.system(size: 13))
                        }
                    }
                    .foregroundColor(post.post.viewer?.repost != nil ? .green : .gray)
                }

                // Like
                Button(action: { onLike?() }) {
                    HStack(spacing: 4) {
                        Image(systemName: post.post.viewer?.like != nil ? "heart.fill" : "heart")
                        if let count = post.post.likeCount, count > 0 {
                            Text("\(count)")
                                .font(.system(size: 13))
                        }
                    }
                    .foregroundColor(post.post.viewer?.like != nil ? .red : .gray)
                }

                // Bookmark
                Button(action: { onBookmark?() }) {
                    Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                        .foregroundColor(isBookmarked ? .yellow : .gray)
                }

                Spacer()
            }
            .font(.system(size: 16))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(hex: "0a0a0f"))
    }

    private func formatTimestamp(_ isoString: String) -> String {
        // Simple relative time formatting
        // TODO: Use proper date formatting library
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: isoString) else {
            return ""
        }

        let now = Date()
        let interval = now.timeIntervalSince(date)

        if interval < 60 {
            return "\(Int(interval))s"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m"
        } else if interval < 86400 {
            return "\(Int(interval / 3600))h"
        } else if interval < 604800 {
            return "\(Int(interval / 86400))d"
        } else {
            let dateFormatter = DateFormatter()
            dateFormatter.dateFormat = "MMM d"
            return dateFormatter.string(from: date)
        }
    }
}

// MARK: - Color Extension for Hex
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
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
