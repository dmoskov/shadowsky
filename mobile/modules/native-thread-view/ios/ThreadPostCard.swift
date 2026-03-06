//
//  ThreadPostCard.swift
//  NativeThreadView
//
//  SwiftUI component for rendering individual thread posts
//

import SwiftUI
import ExpoSwiftUIFeed
import struct RichTextView.RichTextView
import FeedBridge

// MARK: - Static Date Formatters

private enum ThreadDateFormatting {
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

    static func relativeTimeString(from isoString: String) -> String {
        guard let date = iso8601WithFractional.date(from: isoString)
                ?? iso8601Standard.date(from: isoString) else {
            return ""
        }

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

// MARK: - Thread Post Card

/// Card view for a single post in a thread
struct ThreadPostCard: View {
    let node: ThreadNode
    let isRoot: Bool
    let currentUserDid: String?

    // Event handlers
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
    let onPressLikeCount: (() -> Void)?
    let onPressRepostCount: (() -> Void)?
    let onPressQuoteCount: (() -> Void)?
    let onTranslate: ((String, String, String) -> Void)? // (uri, text, sourceLang)
    let onLinkPress: ((String) -> Void)?
    let onImagePress: (([ImageEmbedData], Int) -> Void)?
    let onQuotePress: ((String, String) -> Void)?
    let onQuotePost: (() -> Void)?

    // Optimistic local state for instant feedback
    @State private var likeOverride: Bool? = nil
    @State private var likeCountOverride: Int? = nil
    @State private var repostOverride: Bool? = nil
    @State private var repostCountOverride: Int? = nil

    private var isLiked: Bool { likeOverride ?? (node.post.viewer?.like != nil) }
    private var displayLikeCount: Int { likeCountOverride ?? node.post.likeCount }
    private var isReposted: Bool { repostOverride ?? (node.post.viewer?.repost != nil) }
    private var displayRepostCount: Int { repostCountOverride ?? node.post.repostCount }

    /// Whether the current user authored this post
    private var isOwnPost: Bool {
        guard let currentUserDid = currentUserDid else { return false }
        return currentUserDid == node.post.author.did
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tappable content area — navigates to post on tap
            VStack(alignment: .leading, spacing: 12) {
                // Author info
                HStack(spacing: 12) {
                    // Avatar
                    if let avatarUrl = node.post.author.avatar {
                        CachedAsyncImage(url: URL(string: avatarUrl)) { image in
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                        } placeholder: {
                            Circle()
                                .fill(Color.gray.opacity(0.3))
                        }
                        .frame(width: 48, height: 48)
                        .clipShape(Circle())
                        .onTapGesture {
                            onPressProfile?(node.post.author.handle)
                        }
                    } else {
                        Circle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(width: 48, height: 48)
                            .onTapGesture {
                                onPressProfile?(node.post.author.handle)
                            }
                    }

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Text(node.post.author.displayName.orIfEmpty(node.post.author.handle))
                                .font(.body.weight(.semibold))
                                .foregroundColor(.primary)

                            if node.post.author.isVerified {
                                VerifiedBadge(size: .medium)
                            }
                        }

                        Text("@\(node.post.author.handle)")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .onTapGesture {
                        onPressProfile?(node.post.author.handle)
                    }

                    Spacer()

                    // Timestamp
                    Text(ThreadDateFormatting.relativeTimeString(from: node.post.record.createdAt))
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                // Post content (rich text with facets)
                if !node.post.record.text.isEmpty {
                    renderPostText()
                }

                // Embed (images, video, links, quotes)
                if let embed = node.post.embed {
                    PostEmbed(
                        embed: embed,
                        onImagePress: onImagePress,
                        onLinkPress: onLinkPress,
                        onQuotePress: onQuotePress,
                        blurImages: false
                    )
                }

                // Inline translation
                if LanguageUtils.needsTranslation(postLangs: node.post.record.langs) {
                    PostTranslationView(
                        postUri: node.post.uri,
                        postText: node.post.record.text,
                        postLangs: node.post.record.langs,
                        onTranslate: onTranslate
                    )
                }
            }
            .contentShape(Rectangle())
            .onTapGesture {
                onPress?()
            }

            // Action buttons — kept outside the content tap area so Button
            // actions (like, repost, reply, share) fire correctly on iOS.
            // A parent .onTapGesture intercepts Button taps in SwiftUI.
            HStack(spacing: 4) {
                // Reply
                ActionButton(
                    iconName: "bubble.left",
                    count: node.post.replyCount,
                    isActive: false,
                    color: .secondary,
                    action: onReply
                )

                // Repost / Quote menu
                if isReposted {
                    // Already reposted — tap to undo repost
                    ActionButton(
                        iconName: "arrow.2.squarepath",
                        count: displayRepostCount,
                        isActive: true,
                        color: .green,
                        action: {
                            repostOverride = false
                            repostCountOverride = displayRepostCount - 1
                            onRepost?()
                        },
                        onPressCount: onPressRepostCount
                    )
                } else {
                    // Not reposted — show menu with Repost and Quote options
                    Menu {
                        Button {
                            repostOverride = true
                            repostCountOverride = displayRepostCount + 1
                            onRepost?()
                        } label: {
                            Label("Repost", systemImage: "arrow.2.squarepath")
                        }
                        Button {
                            onQuotePost?()
                        } label: {
                            Label("Quote Post", systemImage: "quote.bubble")
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.2.squarepath")
                                .font(.body)
                            if displayRepostCount > 0 {
                                Text("\(displayRepostCount)")
                                    .font(.subheadline)
                            }
                        }
                        .foregroundColor(.secondary)
                        .frame(minWidth: 48, minHeight: 48)
                        .contentShape(Rectangle())
                    }
                }

                // Like
                ActionButton(
                    iconName: isLiked ? "heart.fill" : "heart",
                    count: displayLikeCount,
                    isActive: isLiked,
                    color: .red,
                    action: {
                        likeOverride = !isLiked
                        likeCountOverride = displayLikeCount + (isLiked ? -1 : 1)
                        onLike?()
                    },
                    onPressCount: onPressLikeCount
                )

                Spacer()

                // Share
                Button(action: {
                    onShare?()
                }) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.body)
                        .foregroundColor(.secondary)
                        .frame(minWidth: 48, minHeight: 48)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 4)
            .contentShape(Rectangle())
        }
        .padding(16)
        .background(isRoot ? Color(UIColor.systemBackground) : Color.clear)
        .onChangeCompat(of: node.post.viewer?.like) { _ in likeOverride = nil; likeCountOverride = nil }
        .onChangeCompat(of: node.post.likeCount) { _ in likeCountOverride = nil }
        .onChangeCompat(of: node.post.viewer?.repost) { _ in repostOverride = nil; repostCountOverride = nil }
        .onChangeCompat(of: node.post.repostCount) { _ in repostCountOverride = nil }
        .contextMenu {
            Button { onReply?() } label: {
                Label("Reply", systemImage: "bubble.left")
            }
            Button {
                repostOverride = !isReposted
                repostCountOverride = displayRepostCount + (isReposted ? -1 : 1)
                onRepost?()
            } label: {
                Label(isReposted ? "Undo Repost" : "Repost", systemImage: "arrow.2.squarepath")
            }
            Button {
                onQuotePost?()
            } label: {
                Label("Quote Post", systemImage: "quote.bubble")
            }
            Button {
                likeOverride = !isLiked
                likeCountOverride = displayLikeCount + (isLiked ? -1 : 1)
                onLike?()
            } label: {
                Label(isLiked ? "Unlike" : "Like", systemImage: isLiked ? "heart.fill" : "heart")
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
    }

    // MARK: - Rich Text Rendering

    private func renderPostText() -> some View {
        let facets: [Facet] = (node.post.record.facets ?? []).map { facet in
            facet
        }

        return RichTextView(
            text: node.post.record.text,
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

}

// MARK: - Action Button

struct ActionButton: View {
    let iconName: String
    let count: Int
    let isActive: Bool
    let color: Color
    let action: (() -> Void)?
    let onPressCount: (() -> Void)?

    init(
        iconName: String,
        count: Int,
        isActive: Bool,
        color: Color,
        action: (() -> Void)?,
        onPressCount: (() -> Void)? = nil
    ) {
        self.iconName = iconName
        self.count = count
        self.isActive = isActive
        self.color = color
        self.action = action
        self.onPressCount = onPressCount
    }

    var body: some View {
        Button(action: {
            action?()
        }) {
            HStack(spacing: 4) {
                Image(systemName: iconName)
                    .font(.body)
                if count > 0 {
                    Text("\(count)")
                        .font(.subheadline)
                        .onTapGesture {
                            onPressCount?()
                        }
                }
            }
            .foregroundColor(isActive ? color : .secondary)
            .frame(minWidth: 48, minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Thread Reply View

/// View for a reply with indentation and nested children
struct ThreadReplyView: View {
    let node: ThreadNode
    let currentUserDid: String?
    @State private var isCollapsed: Bool = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Event handlers
    let onPress: ((String, String) -> Void)?
    let onPressProfile: ((String) -> Void)?
    let onLike: ((String, String, String?) -> Void)?
    let onRepost: ((String, String, String?) -> Void)?
    let onReply: ((String, String, String) -> Void)?
    let onBookmark: ((String) -> Void)?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?
    let onShare: ((String) -> Void)?
    let onMute: ((String) -> Void)?
    let onBlock: ((String) -> Void)?
    let onDelete: ((String) -> Void)?
    let onReport: ((String) -> Void)?
    let onPressLikeCount: ((String) -> Void)?
    let onPressRepostCount: ((String) -> Void)?
    let onPressQuoteCount: ((String) -> Void)?
    let onTranslate: ((String, String, String) -> Void)?
    let onLinkPress: ((String) -> Void)?
    let onImagePress: (([ImageEmbedData], Int) -> Void)?
    let onQuotePress: ((String, String) -> Void)?
    let onQuotePost: ((String, String, String, String?, String?, String) -> Void)? // (uri, cid, handle, displayName?, avatar?, text)

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Reply post with indentation
            HStack(spacing: 0) {
                // Indentation indicator
                if node.depth > 0 {
                    ForEach(0..<min(node.depth, 5), id: \.self) { _ in
                        Rectangle()
                            .fill(Color.gray.opacity(0.2))
                            .frame(width: 2)
                            .padding(.leading, 12)
                    }
                }

                VStack(alignment: .leading, spacing: 0) {
                    // Collapse/expand button for threads with replies
                    if !node.replies.isEmpty {
                        HStack {
                            Button(action: {
                                if reduceMotion {
                                    isCollapsed.toggle()
                                } else {
                                    withAnimation {
                                        isCollapsed.toggle()
                                    }
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: isCollapsed ? "chevron.right" : "chevron.down")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("\(node.replies.count) \(node.replies.count == 1 ? "reply" : "replies")")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                            .padding(.leading, 16)
                            .padding(.top, 8)

                            Spacer()
                        }
                    }

                    // Post card
                    ThreadPostCard(
                        node: node,
                        isRoot: false,
                        currentUserDid: currentUserDid,
                        onPress: {
                            onPress?(node.post.uri, node.post.author.handle)
                        },
                        onPressProfile: { handle in
                            onPressProfile?(handle)
                        },
                        onLike: {
                            onLike?(node.post.uri, node.post.cid, node.post.viewer?.like)
                        },
                        onRepost: {
                            onRepost?(node.post.uri, node.post.cid, node.post.viewer?.repost)
                        },
                        onReply: {
                            onReply?(node.post.uri, node.post.cid, node.post.author.handle)
                        },
                        onBookmark: {
                            onBookmark?(node.post.uri)
                        },
                        onMentionPress: { handle, did in
                            onMentionPress?(handle, did)
                        },
                        onHashtagPress: { tag in
                            onHashtagPress?(tag)
                        },
                        onShare: {
                            onShare?(node.post.uri)
                        },
                        onMute: {
                            onMute?(node.post.author.handle)
                        },
                        onBlock: {
                            onBlock?(node.post.author.handle)
                        },
                        onDelete: {
                            onDelete?(node.post.uri)
                        },
                        onReport: {
                            onReport?(node.post.uri)
                        },
                        onPressLikeCount: {
                            onPressLikeCount?(node.post.uri)
                        },
                        onPressRepostCount: {
                            onPressRepostCount?(node.post.uri)
                        },
                        onPressQuoteCount: {
                            onPressQuoteCount?(node.post.uri)
                        },
                        onTranslate: onTranslate,
                        onLinkPress: { uri in
                            onLinkPress?(uri)
                        },
                        onImagePress: { images, index in
                            onImagePress?(images, index)
                        },
                        onQuotePress: { uri, handle in
                            onQuotePress?(uri, handle)
                        },
                        onQuotePost: {
                            onQuotePost?(
                                node.post.uri,
                                node.post.cid,
                                node.post.author.handle,
                                node.post.author.displayName,
                                node.post.author.avatar,
                                node.post.record.text
                            )
                        }
                    )
                }
            }

            // Nested replies (if not collapsed)
            if !isCollapsed {
                ForEach(node.replies) { childNode in
                    ThreadReplyView(
                        node: childNode,
                        currentUserDid: currentUserDid,
                        onPress: onPress,
                        onPressProfile: onPressProfile,
                        onLike: onLike,
                        onRepost: onRepost,
                        onReply: onReply,
                        onBookmark: onBookmark,
                        onMentionPress: onMentionPress,
                        onHashtagPress: onHashtagPress,
                        onShare: onShare,
                        onMute: onMute,
                        onBlock: onBlock,
                        onDelete: onDelete,
                        onReport: onReport,
                        onPressLikeCount: onPressLikeCount,
                        onPressRepostCount: onPressRepostCount,
                        onPressQuoteCount: onPressQuoteCount,
                        onTranslate: onTranslate,
                        onLinkPress: onLinkPress,
                        onImagePress: onImagePress,
                        onQuotePress: onQuotePress,
                        onQuotePost: onQuotePost
                    )
                }
            }
        }
    }
}
