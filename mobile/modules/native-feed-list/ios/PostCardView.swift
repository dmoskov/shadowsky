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

    // Tap feedback
    @State private var isContentHighlighted = false

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
    let onDelete: (() -> Void)?
    let onReport: (() -> Void)?
    let onImagePress: (([ImageEmbedData], Int) -> Void)?
    let onLinkPress: ((String) -> Void)?
    let onQuotePress: ((String, String) -> Void)?

    /// Whether the current user authored this post
    private var isOwnPost: Bool {
        guard let currentUserDid = currentUserDid else { return false }
        return currentUserDid == post.post.author.did
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tappable content area — navigates to thread on tap
            VStack(alignment: .leading, spacing: 8) {
                // Reply context indicator
                if let parent = post.replyParent {
                    ReplyContextView(parent: parent, onProfilePress: onPressProfile)
                }

                // Author row — has its own tap gesture for profile navigation.
                // Child .onTapGesture takes priority over the parent content area's gesture.
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
            }
            .contentShape(Rectangle())
            .background(isContentHighlighted ? Color.primary.opacity(0.08) : Color.clear)
            .onTapGesture {
                // Instant visual + haptic feedback before navigation
                isContentHighlighted = true
                UIImpactFeedbackGenerator(style: .light).impactOccurred()
                onPress?()
                // Clear highlight after navigation begins
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                    isContentHighlighted = false
                }
            }

            // Action bar — kept outside the content tap area so button taps
            // are not intercepted by the parent .onTapGesture.
            // Uses .buttonStyle(.plain) to ensure reliable tap detection
            // inside ScrollView, and .frame(minHeight: 48) for comfortable
            // tap targets.
            HStack(spacing: 4) {
                // Reply
                actionButton(
                    icon: "bubble.left",
                    count: post.post.replyCount,
                    isActive: false,
                    activeColor: .blue,
                    action: { onReply?() }
                )
                .accessibilityIdentifier("reply-button")

                // Repost
                actionButton(
                    icon: "arrow.2.squarepath",
                    count: post.post.repostCount,
                    isActive: post.post.viewer?.repost != nil,
                    activeColor: .green,
                    action: { onRepost?() }
                )
                .accessibilityIdentifier("repost-button")

                // Like
                actionButton(
                    icon: post.post.viewer?.like != nil ? "heart.fill" : "heart",
                    count: post.post.likeCount,
                    isActive: post.post.viewer?.like != nil,
                    activeColor: .red,
                    action: { onLike?() }
                )
                .accessibilityIdentifier("like-button")

                // Bookmark
                actionButton(
                    icon: isBookmarked ? "bookmark.fill" : "bookmark",
                    count: 0,
                    isActive: isBookmarked,
                    activeColor: .blue,
                    action: { onBookmark?() }
                )
                .accessibilityIdentifier("bookmark-button")

                Spacer()

                // Share
                Button(action: { onShare?() }) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .frame(minWidth: 48, minHeight: 48)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("share-button")
            }
            .padding(.top, 4)
            .contentShape(Rectangle())
            .accessibilityIdentifier("post-actions")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .contextMenu {
            Button { onReply?() } label: {
                Label("Reply", systemImage: "bubble.left")
            }
            Button { onRepost?() } label: {
                Label(post.post.viewer?.repost != nil ? "Undo Repost" : "Repost", systemImage: "arrow.2.squarepath")
            }
            Button { onLike?() } label: {
                Label(post.post.viewer?.like != nil ? "Unlike" : "Like", systemImage: post.post.viewer?.like != nil ? "heart.fill" : "heart")
            }
            Button { onBookmark?() } label: {
                Label(isBookmarked ? "Remove Bookmark" : "Bookmark", systemImage: isBookmarked ? "bookmark.fill" : "bookmark")
            }
            Button { onShare?() } label: {
                Label("Share", systemImage: "square.and.arrow.up")
            }
            Divider()
            if isOwnPost {
                Button(role: .destructive) { onDelete?() } label: {
                    Label("Delete Post", systemImage: "trash")
                }
            } else {
                Button { onMute?() } label: {
                    Label("Mute User", systemImage: "speaker.slash")
                }
                Button(role: .destructive) { onBlock?() } label: {
                    Label("Block User", systemImage: "hand.raised")
                }
                Button(role: .destructive) { onReport?() } label: {
                    Label("Report Post", systemImage: "exclamationmark.triangle")
                }
            }
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

    /// Action button with 48pt minimum tap target.
    /// Uses .buttonStyle(.plain) to prevent SwiftUI's default button style
    /// from interfering with tap detection inside ScrollView.
    private func actionButton(icon: String, count: Int, isActive: Bool, activeColor: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.body)
                if count > 0 {
                    Text(formatCount(count))
                        .font(.subheadline)
                }
            }
            .foregroundColor(isActive ? activeColor : .secondary)
            .frame(minWidth: 48, minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
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

// MARK: - Reply Context View

/// Shows a "Replying to @handle" indicator with optional parent text preview
/// when a post in the feed is a reply.
struct ReplyContextView: View {
    let parent: ReplyParent
    let onProfilePress: ((String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "arrowshape.turn.up.left.fill")
                    .font(.caption2)
                    .foregroundColor(.blue.opacity(0.7))

                Text("Replying to ")
                    .font(.caption)
                    .foregroundColor(.secondary)
                +
                Text("@\(parent.authorHandle)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.blue)
            }
            .onTapGesture {
                onProfilePress?(parent.authorHandle)
            }

            // Show a preview of the parent post text
            if let parentText = parent.text {
                TruncatedText(parentText, lineLimit: 2, font: .caption, color: .secondary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.blue.opacity(0.06))
        .cornerRadius(8)
    }
}
