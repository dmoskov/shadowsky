//
//  ThreadView.swift
//  NativeThreadView
//
//  Native SwiftUI thread/post detail view with nested replies
//

import SwiftUI
import ExpoModulesCore
import FeedBridge

// MARK: - ThreadView

/// SwiftUI view that displays a thread with nested replies
/// Uses lazy loading and supports thread navigation
struct ThreadView: View {
    // MARK: - Properties

    // Thread data
    @StateObject private var threadState = ThreadState()

    // Configuration
    let isLoading: Bool
    let isRefreshing: Bool
    let error: String?
    let threadUri: String?

    // Event handlers (sent back to React Native)
    let onRefresh: (() -> Void)?
    let onPostPress: ((String, String) -> Void)? // (uri, handle)
    let onProfilePress: ((String) -> Void)? // handle
    let onLike: ((String, String, String?) -> Void)? // (uri, cid, likeUri?)
    let onRepost: ((String, String, String?) -> Void)? // (uri, cid, repostUri?)
    let onReply: ((String, String, String) -> Void)? // (uri, cid, handle)
    let onBookmark: ((String) -> Void)? // uri
    let onMentionPress: ((String, String) -> Void)? // (handle, did)
    let onHashtagPress: ((String) -> Void)? // tag
    let onShare: ((String) -> Void)? // uri
    let onNavigateToParent: ((String) -> Void)? // parentUri
    let onNavigateToRoot: ((String) -> Void)? // rootUri
    let onPressLikeCount: ((String) -> Void)? // uri
    let onPressRepostCount: ((String) -> Void)? // uri
    let onPressQuoteCount: ((String) -> Void)? // uri

    // MARK: - Body

    var body: some View {
        ZStack {
            if isLoading && threadState.rootPost == nil {
                // Initial loading state
                loadingView
            } else if let error = error, threadState.rootPost == nil {
                // Error state
                errorView(error)
            } else if let rootPost = threadState.rootPost {
                // Thread content
                threadScrollView(rootPost: rootPost)
            } else {
                // Empty state
                emptyView
            }
        }
        .background(Color(UIColor.systemBackground))
        .onAppear {
            threadState.startObserving()
        }
        .onDisappear {
            threadState.stopObserving()
        }
    }

    // MARK: - Thread Scroll View

    private func threadScrollView(rootPost: ThreadNode) -> some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Pull to refresh indicator
                if isRefreshing {
                    ProgressView()
                        .padding()
                }

                // Root post
                ThreadPostCard(
                    node: rootPost,
                    isRoot: true,
                    onPress: {
                        onPostPress?(rootPost.post.uri, rootPost.post.author.handle)
                    },
                    onPressProfile: { handle in
                        onProfilePress?(handle)
                    },
                    onLike: {
                        onLike?(
                            rootPost.post.uri,
                            rootPost.post.cid,
                            rootPost.post.viewer?.like
                        )
                    },
                    onRepost: {
                        onRepost?(
                            rootPost.post.uri,
                            rootPost.post.cid,
                            rootPost.post.viewer?.repost
                        )
                    },
                    onReply: {
                        onReply?(
                            rootPost.post.uri,
                            rootPost.post.cid,
                            rootPost.post.author.handle
                        )
                    },
                    onBookmark: {
                        onBookmark?(rootPost.post.uri)
                    },
                    onMentionPress: { handle, did in
                        onMentionPress?(handle, did)
                    },
                    onHashtagPress: { tag in
                        onHashtagPress?(tag)
                    },
                    onShare: {
                        onShare?(rootPost.post.uri)
                    },
                    onPressLikeCount: {
                        onPressLikeCount?(rootPost.post.uri)
                    },
                    onPressRepostCount: {
                        onPressRepostCount?(rootPost.post.uri)
                    },
                    onPressQuoteCount: {
                        onPressQuoteCount?(rootPost.post.uri)
                    }
                )

                // Divider
                if !rootPost.replies.isEmpty {
                    Divider()
                        .padding(.vertical, 8)
                }

                // Nested replies
                ForEach(rootPost.replies) { replyNode in
                    ThreadReplyView(
                        node: replyNode,
                        onPress: { uri, handle in
                            onPostPress?(uri, handle)
                        },
                        onPressProfile: { handle in
                            onProfilePress?(handle)
                        },
                        onLike: { uri, cid, likeUri in
                            onLike?(uri, cid, likeUri)
                        },
                        onRepost: { uri, cid, repostUri in
                            onRepost?(uri, cid, repostUri)
                        },
                        onReply: { uri, cid, handle in
                            onReply?(uri, cid, handle)
                        },
                        onBookmark: { uri in
                            onBookmark?(uri)
                        },
                        onMentionPress: { handle, did in
                            onMentionPress?(handle, did)
                        },
                        onHashtagPress: { tag in
                            onHashtagPress?(tag)
                        },
                        onShare: { uri in
                            onShare?(uri)
                        },
                        onPressLikeCount: { uri in
                            onPressLikeCount?(uri)
                        },
                        onPressRepostCount: { uri in
                            onPressRepostCount?(uri)
                        },
                        onPressQuoteCount: { uri in
                            onPressQuoteCount?(uri)
                        }
                    )
                }

                // Empty replies message
                if rootPost.replies.isEmpty {
                    Text("No replies yet")
                        .foregroundColor(.secondary)
                        .font(.subheadline)
                        .padding()
                }
            }
        }
        .refreshable {
            onRefresh?()
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading thread...")
                .foregroundColor(.secondary)
                .font(.subheadline)
        }
    }

    // MARK: - Error View

    private func errorView(_ errorMessage: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text(errorMessage)
                .foregroundColor(.secondary)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button("Try Again") {
                onRefresh?()
            }
            .buttonStyle(.bordered)
        }
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("Thread not found")
                .foregroundColor(.secondary)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }
}

// MARK: - Thread State

/// Observable object that manages thread data from bridge
class ThreadState: ObservableObject {
    @Published var rootPost: ThreadNode?

    private var threadDataObserver: NSObjectProtocol?
    private var incrementalUpdateObserver: NSObjectProtocol?
    private var clearDataObserver: NSObjectProtocol?

    func startObserving() {
        // Observe thread data updates
        threadDataObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let threadData = notification.userInfo?["threadData"] as? [String: Any] {
                self?.rootPost = self?.parseThreadNode(from: threadData, depth: 0)
            }
        }

        // Observe incremental updates (like/repost changes)
        incrementalUpdateObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ThreadBridgeIncrementalUpdate"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            // Handle incremental updates similar to FeedListView
            // Update like/repost counts and viewer state
            if let update = notification.userInfo?["update"] as? [String: Any] {
                self?.applyIncrementalUpdate(update)
            }
        }

        // Observe clear data
        clearDataObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ThreadBridgeDataCleared"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.rootPost = nil
        }
    }

    func stopObserving() {
        if let observer = threadDataObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = incrementalUpdateObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = clearDataObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Parsing

    private func parseThreadNode(from data: [String: Any], depth: Int) -> ThreadNode? {
        guard let postData = data["post"] as? [String: Any] else { return nil }

        let post = parseThreadPost(from: postData)
        let parent = parseReplyRef(from: data["parent"] as? [String: Any])
        let repliesData = data["replies"] as? [[String: Any]] ?? []
        let replies = repliesData.compactMap { parseThreadNode(from: $0, depth: depth + 1) }

        return ThreadNode(post: post, parent: parent, replies: replies, depth: depth)
    }

    private func parseThreadPost(from data: [String: Any]) -> ThreadPost {
        let authorData = data["author"] as? [String: Any] ?? [:]
        let recordData = data["record"] as? [String: Any] ?? [:]
        let viewerData = data["viewer"] as? [String: Any]

        return ThreadPost(
            uri: data["uri"] as? String ?? "",
            cid: data["cid"] as? String ?? "",
            author: ThreadAuthor(
                did: authorData["did"] as? String ?? "",
                handle: authorData["handle"] as? String ?? "",
                displayName: authorData["displayName"] as? String,
                avatar: authorData["avatar"] as? String
            ),
            record: ThreadRecord(
                text: recordData["text"] as? String ?? "",
                facets: nil, // TODO: Parse facets if needed
                createdAt: recordData["createdAt"] as? String ?? ""
            ),
            indexedAt: data["indexedAt"] as? String ?? "",
            likeCount: data["likeCount"] as? Int ?? 0,
            repostCount: data["repostCount"] as? Int ?? 0,
            replyCount: data["replyCount"] as? Int ?? 0,
            quoteCount: data["quoteCount"] as? Int,
            viewer: viewerData.map { ThreadViewer(
                like: $0["like"] as? String,
                repost: $0["repost"] as? String
            )},
            labels: nil
        )
    }

    private func parseReplyRef(from data: [String: Any]?) -> ThreadReplyRef? {
        guard let data = data else { return nil }
        return ThreadReplyRef(
            uri: data["uri"] as? String ?? "",
            cid: data["cid"] as? String ?? ""
        )
    }

    private func applyIncrementalUpdate(_ update: [String: Any]) {
        // Update the thread tree with new like/repost data
        // This is a simplified version - full implementation would recursively update nodes
        guard let uri = update["uri"] as? String else { return }
        // TODO: Implement recursive update of thread nodes
    }
}

// MARK: - Preview

#if DEBUG
struct ThreadView_Previews: PreviewProvider {
    static var previews: some View {
        ThreadView(
            isLoading: false,
            isRefreshing: false,
            error: nil,
            threadUri: "at://did:plc:test/app.bsky.feed.post/test",
            onRefresh: { print("Refresh") },
            onPostPress: { uri, handle in print("Post: \(uri)") },
            onProfilePress: { handle in print("Profile: \(handle)") },
            onLike: { uri, cid, likeUri in print("Like: \(uri)") },
            onRepost: { uri, cid, repostUri in print("Repost: \(uri)") },
            onReply: { uri, cid, handle in print("Reply: \(uri)") },
            onBookmark: { uri in print("Bookmark: \(uri)") },
            onMentionPress: { handle, did in print("Mention: \(handle)") },
            onHashtagPress: { tag in print("Hashtag: \(tag)") },
            onShare: { uri in print("Share: \(uri)") },
            onNavigateToParent: { uri in print("Navigate to parent: \(uri)") },
            onNavigateToRoot: { uri in print("Navigate to root: \(uri)") },
            onPressLikeCount: { uri in print("Press like count: \(uri)") },
            onPressRepostCount: { uri in print("Press repost count: \(uri)") },
            onPressQuoteCount: { uri in print("Press quote count: \(uri)") }
        )
    }
}
#endif
