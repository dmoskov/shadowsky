//
//  ThreadPostCard.swift
//  NativeThreadView
//
//  SwiftUI component for rendering individual thread posts
//

import SwiftUI
import ExpoSwiftUIFeed

// MARK: - Thread Post Card

/// Card view for a single post in a thread
struct ThreadPostCard: View {
    let node: ThreadNode
    let isRoot: Bool

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
    let onPressLikeCount: (() -> Void)?
    let onPressRepostCount: (() -> Void)?
    let onPressQuoteCount: (() -> Void)?

    var body: some View {
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
                    Text(node.post.author.displayName ?? node.post.author.handle)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.primary)

                    Text("@\(node.post.author.handle)")
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                }
                .onTapGesture {
                    onPressProfile?(node.post.author.handle)
                }

                Spacer()

                // Timestamp
                Text(formatTimestamp(node.post.record.createdAt))
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
            }

            // Post content
            Text(node.post.record.text)
                .font(.system(size: 16))
                .foregroundColor(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)

            // Action buttons
            HStack(spacing: 24) {
                // Reply
                ActionButton(
                    iconName: "bubble.left",
                    count: node.post.replyCount,
                    isActive: false,
                    color: .secondary,
                    action: onReply
                )

                // Repost
                ActionButton(
                    iconName: "arrow.2.squarepath",
                    count: node.post.repostCount,
                    isActive: node.post.viewer?.repost != nil,
                    color: .green,
                    action: onRepost,
                    onPressCount: onPressRepostCount
                )

                // Like
                ActionButton(
                    iconName: node.post.viewer?.like != nil ? "heart.fill" : "heart",
                    count: node.post.likeCount,
                    isActive: node.post.viewer?.like != nil,
                    color: .red,
                    action: onLike,
                    onPressCount: onPressLikeCount
                )

                Spacer()

                // Share
                Button(action: {
                    onShare?()
                }) {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                }
            }
            .padding(.top, 4)
        }
        .padding(16)
        .background(isRoot ? Color(UIColor.systemBackground) : Color.clear)
        .contentShape(Rectangle())
        .onTapGesture {
            onPress?()
        }
    }

    private func formatTimestamp(_ timestamp: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: timestamp) ?? ISO8601DateFormatter().date(from: timestamp) else {
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
        } else {
            return "\(Int(interval / 86400))d"
        }
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
        HStack(spacing: 6) {
            Button(action: {
                action?()
            }) {
                Image(systemName: iconName)
                    .font(.system(size: 16))
                    .foregroundColor(isActive ? color : .secondary)
            }

            if count > 0 {
                Text("\(count)")
                    .font(.system(size: 14))
                    .foregroundColor(isActive ? color : .secondary)
                    .onTapGesture {
                        onPressCount?()
                    }
            }
        }
    }
}

// MARK: - Thread Reply View

/// View for a reply with indentation and nested children
struct ThreadReplyView: View {
    let node: ThreadNode
    @State private var isCollapsed: Bool = false

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
    let onPressLikeCount: ((String) -> Void)?
    let onPressRepostCount: ((String) -> Void)?
    let onPressQuoteCount: ((String) -> Void)?

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
                                withAnimation {
                                    isCollapsed.toggle()
                                }
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: isCollapsed ? "chevron.right" : "chevron.down")
                                        .font(.system(size: 12))
                                        .foregroundColor(.secondary)
                                    Text("\(node.replies.count) \(node.replies.count == 1 ? "reply" : "replies")")
                                        .font(.system(size: 12))
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
                        onPressLikeCount: {
                            onPressLikeCount?(node.post.uri)
                        },
                        onPressRepostCount: {
                            onPressRepostCount?(node.post.uri)
                        },
                        onPressQuoteCount: {
                            onPressQuoteCount?(node.post.uri)
                        }
                    )
                }
            }

            // Nested replies (if not collapsed)
            if !isCollapsed {
                ForEach(node.replies) { childNode in
                    ThreadReplyView(
                        node: childNode,
                        onPress: onPress,
                        onPressProfile: onPressProfile,
                        onLike: onLike,
                        onRepost: onRepost,
                        onReply: onReply,
                        onBookmark: onBookmark,
                        onMentionPress: onMentionPress,
                        onHashtagPress: onHashtagPress,
                        onShare: onShare,
                        onPressLikeCount: onPressLikeCount,
                        onPressRepostCount: onPressRepostCount,
                        onPressQuoteCount: onPressQuoteCount
                    )
                }
            }
        }
    }
}
