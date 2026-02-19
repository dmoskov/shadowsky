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

    // Summary data (passed from JS via bridge)
    let summaryData: ThreadSummaryData?
    let isSummaryLoading: Bool
    let summaryMode: String // "quick" or "full"

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
    let onSummaryModeChange: ((String) -> Void)? // "quick" or "full"
    let onTranslate: ((String, String, String) -> Void)? // (uri, text, sourceLang)

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
            threadState.startSpotlightTimer()
        }
        .onDisappear {
            threadState.cancelSpotlightTimer()
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
                    },
                    onTranslate: onTranslate
                )

                // AI Thread Summary (between root post and replies)
                if isSummaryLoading {
                    ThreadSummaryLoadingView()
                } else if let summary = summaryData {
                    ThreadSummaryView(
                        summaryData: summary,
                        summaryMode: summaryMode,
                        onToggleMode: { mode in
                            onSummaryModeChange?(mode)
                        }
                    )
                }

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
                        },
                        onTranslate: onTranslate
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

    /// Timer for Spotlight indexing — only index after 2+ seconds of viewing
    private var spotlightTimer: Timer?
    private var hasIndexedCurrentThread = false
    private var spotlightTimerElapsed = false

    /// Call when the thread view appears to start the 2-second indexing timer.
    func startSpotlightTimer() {
        cancelSpotlightTimer()
        hasIndexedCurrentThread = false
        spotlightTimerElapsed = false
        spotlightTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            self?.spotlightTimerElapsed = true
            self?.indexCurrentThreadIfNeeded()
        }
    }

    /// Cancel the Spotlight timer (e.g. when the view disappears before 2 seconds).
    func cancelSpotlightTimer() {
        spotlightTimer?.invalidate()
        spotlightTimer = nil
    }

    /// Index the current thread if the 2-second timer has elapsed and data is available.
    /// Called both when the timer fires and when thread data arrives.
    private func indexCurrentThreadIfNeeded() {
        guard !hasIndexedCurrentThread,
              spotlightTimerElapsed,
              let rootPost = rootPost else { return }
        hasIndexedCurrentThread = true
        ThreadSpotlightIndexer.shared.indexThread(rootPost: rootPost.post)
    }

    func startObserving() {
        // Observe thread data updates
        threadDataObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let threadData = notification.userInfo?["threadData"] as? [String: Any] {
                self?.rootPost = self?.parseThreadNode(from: threadData, depth: 0)
                // Attempt Spotlight indexing (succeeds only if 2s timer has elapsed)
                self?.indexCurrentThreadIfNeeded()
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
        cancelSpotlightTimer()
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
                facets: parseFacets(from: recordData["facets"] as? [[String: Any]]),
                createdAt: recordData["createdAt"] as? String ?? "",
                langs: recordData["langs"] as? [String]
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

    private func parseFacets(from facetsData: [[String: Any]]?) -> [Facet]? {
        guard let facetsData = facetsData else { return nil }

        return facetsData.compactMap { facetDict -> Facet? in
            guard let indexDict = facetDict["index"] as? [String: Any],
                  let byteStart = indexDict["byteStart"] as? Int,
                  let byteEnd = indexDict["byteEnd"] as? Int,
                  let featuresArray = facetDict["features"] as? [[String: Any]] else {
                return nil
            }

            let features: [FacetFeature] = featuresArray.compactMap { featureDict in
                guard let type = featureDict["$type"] as? String else { return nil }

                switch type {
                case "app.bsky.richtext.facet#mention":
                    guard let did = featureDict["did"] as? String else { return nil }
                    return .mention(FacetFeatureMention(type: type, did: did))
                case "app.bsky.richtext.facet#link":
                    guard let uri = featureDict["uri"] as? String else { return nil }
                    return .link(FacetFeatureLink(type: type, uri: uri))
                case "app.bsky.richtext.facet#tag":
                    guard let tag = featureDict["tag"] as? String else { return nil }
                    return .tag(FacetFeatureTag(type: type, tag: tag))
                default:
                    return nil
                }
            }

            return Facet(
                index: FacetIndex(byteStart: byteStart, byteEnd: byteEnd),
                features: features
            )
        }
    }

    private func parseReplyRef(from data: [String: Any]?) -> ThreadReplyRef? {
        guard let data = data else { return nil }
        return ThreadReplyRef(
            uri: data["uri"] as? String ?? "",
            cid: data["cid"] as? String ?? ""
        )
    }

    private func applyIncrementalUpdate(_ update: [String: Any]) {
        guard let uri = update["uri"] as? String,
              let rootPost = rootPost else { return }

        self.rootPost = updateNodeRecursively(rootPost, uri: uri, update: update)
    }

    private func updateNodeRecursively(_ node: ThreadNode, uri: String, update: [String: Any]) -> ThreadNode {
        if node.post.uri == uri {
            let viewerData = update["viewer"] as? [String: Any]
            let updatedPost = ThreadPost(
                uri: node.post.uri,
                cid: node.post.cid,
                author: node.post.author,
                record: node.post.record,
                indexedAt: node.post.indexedAt,
                likeCount: update["likeCount"] as? Int ?? node.post.likeCount,
                repostCount: update["repostCount"] as? Int ?? node.post.repostCount,
                replyCount: update["replyCount"] as? Int ?? node.post.replyCount,
                quoteCount: update["quoteCount"] as? Int ?? node.post.quoteCount,
                viewer: viewerData.map { ThreadViewer(
                    like: $0["like"] as? String,
                    repost: $0["repost"] as? String
                )} ?? node.post.viewer,
                labels: node.post.labels
            )
            return ThreadNode(post: updatedPost, parent: node.parent, replies: node.replies, depth: node.depth)
        }

        let updatedReplies = node.replies.map { updateNodeRecursively($0, uri: uri, update: update) }
        return ThreadNode(post: node.post, parent: node.parent, replies: updatedReplies, depth: node.depth)
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
            summaryData: nil,
            isSummaryLoading: false,
            summaryMode: "quick",
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
            onPressQuoteCount: { uri in print("Press quote count: \(uri)") },
            onSummaryModeChange: { mode in print("Summary mode: \(mode)") },
            onTranslate: { uri, text, lang in print("Translate \(uri) from \(lang)") }
        )
    }
}
#endif
