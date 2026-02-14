//
//  PostCardView.swift
//  Asphodel
//
//  Created by Claude Code
//  SwiftUI implementation of PostCard component
//

import SwiftUI
import UIKit

// MARK: - PostCardView

/// Main SwiftUI view for displaying a post card
/// Replaces the React Native PostCard.tsx component
struct PostCardView: View {
    // MARK: - Properties

    let post: FeedViewPost
    let isBookmarked: Bool
    let isOnline: Bool
    let currentUserDid: String?

    // Event handlers (sent back to React Native)
    let onPress: (() -> Void)?
    let onPressProfile: ((String) -> Void)?
    let onLike: (() -> Void)?
    let onRepost: (() -> Void)?
    let onReply: (() -> Void)?
    let onBookmark: (() -> Void)?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?
    let onShare: (() -> Void)?
    let onMute: ((String) -> Void)?
    let onBlock: ((String) -> Void)?
    let onReport: ((String, String) -> Void)?

    // MARK: - State

    @State private var showMenu = false
    @State private var contentRevealed = false

    // MARK: - Computed Properties

    private var postView: PostView {
        post.post
    }

    private var author: PostAuthor {
        postView.author
    }

    private var isOwnPost: Bool {
        currentUserDid == author.did
    }

    private var isLiked: Bool {
        postView.viewer?.like != nil
    }

    private var timestamp: String {
        guard let date = ISO8601DateFormatter().date(from: postView.indexedAt) else {
            return ""
        }
        return date.timeAgoString()
    }

    private var moderationResult: ModerationResult {
        evaluateModeration(labels: postView.labels)
    }

    // MARK: - Body

    var body: some View {
        // Don't render if content should be hidden
        if moderationResult.shouldHide {
            EmptyView()
        } else {
            mainContent
                .background(PostCardTheme.background)
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(PostCardTheme.border),
                    alignment: .bottom
                )
                .sheet(isPresented: $showMenu) {
                    menuModal
                }
        }
    }

    // MARK: - Main Content

    @ViewBuilder
    private var mainContent: some View {
        if moderationResult.shouldWarn && !contentRevealed {
            // Show content warning overlay
            ContentWarningOverlay(
                warningText: moderationResult.warningText ?? "Sensitive Content",
                isRevealed: $contentRevealed
            )
        } else {
            // Show normal post content
            Button(action: {
                triggerHaptic(.light)
                onPress?()
            }) {
                postContent
            }
            .buttonStyle(PlainButtonStyle())
        }
    }

    // MARK: - Post Content

    private var postContent: View {
        VStack(alignment: .leading, spacing: 12) {
            // Author Header
            AuthorHeader(
                author: author,
                timestamp: timestamp,
                isOwnPost: isOwnPost,
                isOnline: isOnline,
                onProfilePress: {
                    onPressProfile?(author.handle)
                },
                onMenuPress: {
                    showMenu = true
                }
            )

            // Post Text with Rich Text
            if !postView.record.text.isEmpty {
                RichTextView(
                    text: postView.record.text,
                    facets: postView.record.facets,
                    onMentionPress: onMentionPress,
                    onHashtagPress: onHashtagPress,
                    textColor: PostCardTheme.text,
                    linkColor: PostCardTheme.primary,
                    fontSize: 15
                )
                .lineSpacing(5)
            }

            // Engagement Bar
            EngagementBar(
                replyCount: postView.replyCount ?? 0,
                repostCount: postView.repostCount ?? 0,
                likeCount: postView.likeCount ?? 0,
                isLiked: isLiked,
                isBookmarked: isBookmarked,
                isOnline: isOnline,
                onReply: {
                    onReply?()
                },
                onRepost: {
                    triggerHaptic(.medium)
                    onRepost?()
                },
                onLike: {
                    triggerHaptic(.light)
                    onLike?()
                },
                onBookmark: {
                    triggerHaptic(.light)
                    onBookmark?()
                },
                onShare: {
                    onShare?()
                }
            )
        }
        .padding(16)
    }

    // MARK: - Menu Modal

    private var menuModal: some View {
        ZStack {
            Color.black.opacity(0.5)
                .edgesIgnoringSafeArea(.all)
                .onTapGesture {
                    showMenu = false
                }

            VStack {
                Spacer()

                MenuModal(
                    author: author,
                    isPresented: $showMenu,
                    onMute: {
                        onMute?(author.did)
                    },
                    onBlock: {
                        onBlock?(author.did)
                    },
                    onReport: {
                        onReport?(postView.uri, postView.cid)
                    }
                )
                .padding(.bottom, 32)
            }
        }
    }

    // MARK: - Moderation

    private func evaluateModeration(labels: [ContentLabel]?) -> ModerationResult {
        guard let labels = labels, !labels.isEmpty else {
            return ModerationResult(
                shouldHide: false,
                shouldWarn: false,
                shouldBlur: false,
                warningText: nil
            )
        }

        var shouldHide = false
        var shouldWarn = false
        var shouldBlur = false
        var warningText: String?

        for label in labels {
            switch label.val {
            // Hide content labels
            case "!hide", "dmca-violation", "doxxing":
                shouldHide = true

            // Warn content labels
            case "sexual", "nudity", "porn", "graphic-media":
                shouldWarn = true
                warningText = "Sensitive Content"

            // Blur image labels
            case "sexual", "nudity", "porn":
                shouldBlur = true

            // Other labels
            case "spam", "impersonation":
                shouldWarn = true
                warningText = "Potentially Misleading"

            default:
                break
            }
        }

        return ModerationResult(
            shouldHide: shouldHide,
            shouldWarn: shouldWarn,
            shouldBlur: shouldBlur,
            warningText: warningText
        )
    }

    // MARK: - Haptic Feedback

    private func triggerHaptic(_ style: UIImpactFeedbackGenerator.FeedbackStyle) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }
}

// MARK: - Preview

#if DEBUG
struct PostCardView_Previews: PreviewProvider {
    static var previews: some View {
        let samplePost = FeedViewPost(
            post: PostView(
                uri: "at://did:plc:example/app.bsky.feed.post/12345",
                cid: "cid12345",
                author: PostAuthor(
                    did: "did:plc:example",
                    handle: "example.bsky.social",
                    displayName: "Example User",
                    avatar: nil
                ),
                record: PostRecord(
                    text: "This is a sample post with @mention.bsky.social and #hashtag!",
                    facets: nil,
                    createdAt: ISO8601DateFormatter().string(from: Date())
                ),
                indexedAt: ISO8601DateFormatter().string(from: Date()),
                likeCount: 42,
                repostCount: 7,
                replyCount: 3,
                viewer: nil,
                labels: nil
            )
        )

        PostCardView(
            post: samplePost,
            isBookmarked: false,
            isOnline: true,
            currentUserDid: "did:plc:different",
            onPress: { print("Press") },
            onPressProfile: { handle in print("Profile: \(handle)") },
            onLike: { print("Like") },
            onRepost: { print("Repost") },
            onReply: { print("Reply") },
            onBookmark: { print("Bookmark") },
            onMentionPress: { handle, did in print("Mention: \(handle)") },
            onHashtagPress: { tag in print("Hashtag: \(tag)") },
            onShare: { print("Share") },
            onMute: { did in print("Mute: \(did)") },
            onBlock: { did in print("Block: \(did)") },
            onReport: { uri, cid in print("Report: \(uri)") }
        )
        .previewLayout(.sizeThatFits)
        .background(PostCardTheme.background)
    }
}
#endif
