//
//  PostCardView.swift
//  NativeFeedList
//
//  SwiftUI view that renders a single post card in the feed.
//

import SwiftUI
import ExpoSwiftUIFeed
import struct RichTextView.RichTextView
import FeedBridge

// MARK: - Static Date Formatters

/// Shared ISO8601 formatters to avoid per-cell allocation overhead.
/// ISO8601DateFormatter is expensive to create and should be reused.
enum DateFormatting {
    static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let iso8601Standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static func parseISO8601(_ isoString: String) -> Date? {
        return iso8601WithFractional.date(from: isoString)
            ?? iso8601Standard.date(from: isoString)
    }

    static func relativeTimeString(from isoString: String) -> String {
        guard let date = parseISO8601(isoString) else { return "" }

        let interval = Date().timeIntervalSince(date)

        if interval < 60 {
            return "\(Int(interval))s"
        } else if interval < 3600 {
            return "\(Int(interval / 60))m"
        } else if interval < 86400 {
            return "\(Int(interval / 3600))h"
        } else {
            return "\(Int(interval / 86400))d"
        }
    }
}

struct PostCardView: View {
    let post: FeedViewPost
    let isBookmarked: Bool
    let isOnline: Bool
    let currentUserDid: String?

    // Actions
    let onPress: (() -> Void)?
    let onPressProfile: ((String) -> Void)?
    let onLike: (() -> Void)?
    let onRepost: (() -> Void)?
    let onReply: (() -> Void)?
    let onBookmark: (() -> Void)?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?
    let onShare: (() -> Void)?
    let onMute: (() -> Void)?
    let onBlock: (() -> Void)?
    let onImagePress: (([ImageEmbedData], Int) -> Void)?
    let onLinkPress: ((String) -> Void)?
    let onQuotePress: ((String, String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Author row
            HStack(spacing: 8) {
                // Avatar
                if let avatarUrl = post.post.author.avatar,
                   let url = URL(string: avatarUrl) {
                    CachedAsyncImage(url: url) { image in
                        image.resizable()
                            .aspectRatio(contentMode: .fill)
                    } placeholder: {
                        Circle().fill(Color.gray.opacity(0.3))
                    }
                    .frame(width: 40, height: 40)
                    .clipShape(Circle())
                } else {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 40, height: 40)
                }

                VStack(alignment: .leading, spacing: 2) {
                    if let displayName = post.post.author.displayName, !displayName.isEmpty {
                        Text(displayName)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                            .lineLimit(1)
                    }
                    Text("@\(post.post.author.handle)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Timestamp
                Text(DateFormatting.relativeTimeString(from: post.post.record.createdAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .contentShape(Rectangle())
            .onTapGesture {
                onPressProfile?(post.post.author.handle)
            }

            // Post text
            if !post.post.record.text.isEmpty {
                renderPostText()
            }

            // Embed (images, video, links, quotes)
            if let embed = post.post.record.embed {
                PostEmbed(
                    embed: embed,
                    onImagePress: onImagePress,
                    onLinkPress: onLinkPress,
                    onQuotePress: onQuotePress,
                    blurImages: false
                )
            }

            // Action bar
            HStack(spacing: 24) {
                // Reply
                actionButton(
                    icon: "bubble.left",
                    count: post.post.replyCount,
                    isActive: false,
                    activeColor: .blue,
                    action: { onReply?() }
                )

                // Repost
                actionButton(
                    icon: "arrow.2.squarepath",
                    count: post.post.repostCount,
                    isActive: post.post.viewer?.repost != nil,
                    activeColor: .green,
                    action: { onRepost?() }
                )

                // Like
                actionButton(
                    icon: post.post.viewer?.like != nil ? "heart.fill" : "heart",
                    count: post.post.likeCount,
                    isActive: post.post.viewer?.like != nil,
                    activeColor: .red,
                    action: { onLike?() }
                )

                Spacer()

                // Share
                Button(action: { onShare?() }) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.top, 4)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
        .onTapGesture {
            onPress?()
        }

        Divider()
            .padding(.leading, 64)
    }

    // MARK: - Helpers

    private func renderPostText() -> some View {
        // Convert PostFacet to FeedBridge Facet format for RichTextView
        let facets: [Facet] = (post.post.record.facets ?? []).map { postFacet in
            Facet(
                index: FacetIndex(
                    byteStart: postFacet.index.byteStart,
                    byteEnd: postFacet.index.byteEnd
                ),
                features: postFacet.features.map { feature in
                    switch feature {
                    case .mention(let did):
                        return .mention(FacetFeatureMention(type: "app.bsky.richtext.facet#mention", did: did))
                    case .link(let uri):
                        return .link(FacetFeatureLink(type: "app.bsky.richtext.facet#link", uri: uri))
                    case .hashtag(let tag):
                        return .tag(FacetFeatureTag(type: "app.bsky.richtext.facet#tag", tag: tag))
                    }
                }
            )
        }

        return RichTextView(
            text: post.post.record.text,
            facets: facets,
            onMentionTap: { handle, did in
                onMentionPress?(handle, did)
            },
            onHashtagTap: { tag in
                onHashtagPress?(tag)
            },
            onLinkTap: { uri in
                onLinkPress?(uri)
            }
        )
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func actionButton(icon: String, count: Int, isActive: Bool, activeColor: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                if count > 0 {
                    Text(formatCount(count))
                        .font(.caption)
                }
            }
            .foregroundColor(isActive ? activeColor : .secondary)
        }
    }

    private func formatCount(_ count: Int) -> String {
        if count >= 1_000_000 {
            return String(format: "%.1fM", Double(count) / 1_000_000)
        } else if count >= 1_000 {
            return String(format: "%.1fK", Double(count) / 1_000)
        }
        return "\(count)"
    }

}
