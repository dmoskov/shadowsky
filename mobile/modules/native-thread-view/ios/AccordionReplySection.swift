//
//  AccordionReplySection.swift
//  NativeThreadView
//
//  Accordion-style reply section for thread views.
//  Shows a top-level reply with an expandable subthread.
//  Only one section can be expanded at a time (managed by parent).
//  Children are displayed flat (not recursively accordioned).
//

import SwiftUI
import ExpoSwiftUIFeed
import FeedBridge

// MARK: - Flattened Reply

/// A descendant reply flattened for display with its relative depth
struct FlattenedReply: Identifiable {
    let id: String
    let node: ThreadNode
    /// Depth relative to the accordion section (1 = direct child, 2 = grandchild, etc.)
    let relativeDepth: Int
}

// MARK: - Accordion Reply Section

/// Displays a top-level reply as an accordion section.
/// The reply post card is always visible. Child replies are shown
/// as a flat list when expanded, with depth-based indentation.
struct AccordionReplySection: View {
    let node: ThreadNode
    let isExpanded: Bool
    let onToggle: () -> Void
    let currentUserDid: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    // Event handlers (pass-through to post cards)
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
    let onQuotePost: ((String, String, String, String?, String?, String) -> Void)?
    let onEditPost: ((String) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Top-level reply post card (always visible)
            postCard(for: node)

            // Expand/collapse bar for replies
            if !node.replies.isEmpty {
                accordionToggle
            }

            // Expanded flat child list
            if isExpanded && !node.replies.isEmpty {
                let flattened = Self.flattenDescendants(of: node)
                ForEach(flattened) { item in
                    flatChildRow(item: item)
                        .id(item.id) // Needed for ScrollViewReader focus
                }
            }

            Divider()
                .padding(.leading, 16)
        }
    }

    // MARK: - Accordion Toggle

    private var accordionToggle: some View {
        Button(action: {
            if reduceMotion {
                onToggle()
            } else {
                withAnimation(.easeInOut(duration: 0.25)) {
                    onToggle()
                }
            }
        }) {
            HStack(spacing: 6) {
                Image(systemName: isExpanded ? "chevron.down" : "chevron.right")
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(.accentColor)

                let total = Self.countAllDescendants(node)
                Text("\(total) \(total == 1 ? "reply" : "replies")")
                    .font(.caption)
                    .foregroundColor(.accentColor)

                Spacer()

                if isExpanded {
                    Text("Collapse")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .background(
            isExpanded
                ? Color.accentColor.opacity(0.04)
                : Color.clear
        )
    }

    // MARK: - Top-level post card

    private func postCard(for node: ThreadNode) -> some View {
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
            },
            onEditPost: {
                onEditPost?(node.post.uri)
            }
        )
    }

    // MARK: - Flat child row (indented, no accordion)

    private func flatChildRow(item: FlattenedReply) -> some View {
        HStack(spacing: 0) {
            // Depth indentation lines
            let depthBars = min(item.relativeDepth, 5)
            if depthBars > 0 {
                ForEach(0..<depthBars, id: \.self) { _ in
                    Rectangle()
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 2)
                        .padding(.leading, 12)
                }
            }

            ThreadPostCard(
                node: item.node,
                isRoot: false,
                currentUserDid: currentUserDid,
                onPress: {
                    onPress?(item.node.post.uri, item.node.post.author.handle)
                },
                onPressProfile: { handle in
                    onPressProfile?(handle)
                },
                onLike: {
                    onLike?(item.node.post.uri, item.node.post.cid, item.node.post.viewer?.like)
                },
                onRepost: {
                    onRepost?(item.node.post.uri, item.node.post.cid, item.node.post.viewer?.repost)
                },
                onReply: {
                    onReply?(item.node.post.uri, item.node.post.cid, item.node.post.author.handle)
                },
                onBookmark: {
                    onBookmark?(item.node.post.uri)
                },
                onMentionPress: { handle, did in
                    onMentionPress?(handle, did)
                },
                onHashtagPress: { tag in
                    onHashtagPress?(tag)
                },
                onShare: {
                    onShare?(item.node.post.uri)
                },
                onMute: {
                    onMute?(item.node.post.author.handle)
                },
                onBlock: {
                    onBlock?(item.node.post.author.handle)
                },
                onDelete: {
                    onDelete?(item.node.post.uri)
                },
                onReport: {
                    onReport?(item.node.post.uri)
                },
                onPressLikeCount: {
                    onPressLikeCount?(item.node.post.uri)
                },
                onPressRepostCount: {
                    onPressRepostCount?(item.node.post.uri)
                },
                onPressQuoteCount: {
                    onPressQuoteCount?(item.node.post.uri)
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
                        item.node.post.uri,
                        item.node.post.cid,
                        item.node.post.author.handle,
                        item.node.post.author.displayName,
                        item.node.post.author.avatar,
                        item.node.post.record.text
                    )
                },
                onEditPost: {
                    onEditPost?(item.node.post.uri)
                }
            )
        }
    }

    // MARK: - Helpers

    /// Flatten all descendants of a node into a depth-first list with relative depths
    static func flattenDescendants(of node: ThreadNode) -> [FlattenedReply] {
        var result: [FlattenedReply] = []
        func walk(_ children: [ThreadNode], depth: Int) {
            for child in children {
                result.append(FlattenedReply(
                    id: child.post.uri,
                    node: child,
                    relativeDepth: depth
                ))
                walk(child.replies, depth: depth + 1)
            }
        }
        walk(node.replies, depth: 1)
        return result
    }

    /// Count all descendants (not just direct children)
    static func countAllDescendants(_ node: ThreadNode) -> Int {
        return node.replies.count + node.replies.reduce(0) { $0 + countAllDescendants($1) }
    }
}
