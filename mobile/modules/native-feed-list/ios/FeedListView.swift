//
//  FeedListView.swift
//  Asphodel
//
//  Created by Claude Code
//  Native SwiftUI feed list implementation
//

import SwiftUI
import ExpoModulesCore
import FeedBridge
import ExpoSwiftUIFeed

// MARK: - FeedListView

/// SwiftUI view that displays a scrollable feed of posts
/// Uses data from the FeedBridge module and PostCardView for rendering
struct FeedListView: View {
    // MARK: - Properties

    // Feed data
    @StateObject private var feedState = FeedState()

    // Configuration
    let isLoading: Bool
    let isRefreshing: Bool
    let isLoadingMore: Bool
    let error: String?
    let emptyMessage: String

    // Event handlers (sent back to React Native)
    let onRefresh: (() -> Void)?
    let onLoadMore: (() -> Void)?
    let onPostPress: ((String, String) -> Void)? // (uri, handle)
    let onProfilePress: ((String) -> Void)? // handle
    let onLike: ((String, String, String?) -> Void)? // (uri, cid, likeUri?)
    let onRepost: ((String, String, String?) -> Void)? // (uri, cid, repostUri?)
    let onReply: ((String, String, String) -> Void)? // (uri, cid, handle)
    let onBookmark: ((String) -> Void)? // uri
    let onMentionPress: ((String, String) -> Void)? // (handle, did)
    let onHashtagPress: ((String) -> Void)? // tag
    let onShare: ((String) -> Void)? // uri
    let onImagePress: (([ImageEmbedData], Int) -> Void)?
    let onLinkPress: ((String) -> Void)?
    let onQuotePress: ((String, String) -> Void)?

    // MARK: - Body

    var body: some View {
        ZStack {
            if isLoading && feedState.posts.isEmpty {
                // Initial loading state
                loadingView
            } else if let error = error, feedState.posts.isEmpty {
                // Error state
                errorView(error)
            } else if feedState.posts.isEmpty {
                // Empty state
                emptyView
            } else {
                // Feed content
                feedScrollView
            }
        }
        .background(Color(UIColor.systemBackground))
        .onAppear {
            feedState.startObserving()
        }
        .onDisappear {
            feedState.stopObserving()
        }
    }

    // MARK: - Feed Scroll View

    private var feedScrollView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Pull to refresh indicator
                if isRefreshing {
                    ProgressView()
                        .padding()
                }

                // Post items
                ForEach(feedState.posts, id: \.post.uri) { feedPost in
                    PostCardView(
                        post: convertToFeedViewPost(feedPost),
                        isBookmarked: feedPost.post.viewer?.like != nil, // Placeholder
                        isOnline: true,
                        currentUserDid: nil,
                        onPress: {
                            onPostPress?(feedPost.post.uri, feedPost.post.author.handle)
                        },
                        onPressProfile: { handle in
                            onProfilePress?(handle)
                        },
                        onLike: {
                            onLike?(
                                feedPost.post.uri,
                                feedPost.post.cid,
                                feedPost.post.viewer?.like
                            )
                        },
                        onRepost: {
                            onRepost?(
                                feedPost.post.uri,
                                feedPost.post.cid,
                                feedPost.post.viewer?.repost
                            )
                        },
                        onReply: {
                            onReply?(
                                feedPost.post.uri,
                                feedPost.post.cid,
                                feedPost.post.author.handle
                            )
                        },
                        onBookmark: {
                            onBookmark?(feedPost.post.uri)
                        },
                        onMentionPress: { handle, did in
                            onMentionPress?(handle, did)
                        },
                        onHashtagPress: { tag in
                            onHashtagPress?(tag)
                        },
                        onShare: {
                            onShare?(feedPost.post.uri)
                        },
                        onMute: nil,
                        onBlock: nil,
                        onImagePress: onImagePress,
                        onLinkPress: onLinkPress,
                        onQuotePress: onQuotePress
                    )

                    // Load more trigger - fire when near end of list
                    if feedPost.post.uri == feedState.posts.dropLast(min(3, feedState.posts.count)).last?.post.uri {
                        Color.clear
                            .frame(height: 1)
                            .onAppear {
                                if !isLoadingMore {
                                    onLoadMore?()
                                }
                            }
                    }
                }

                // Loading more indicator
                if isLoadingMore {
                    ProgressView()
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
            Text("Loading feed...")
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
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text(emptyMessage)
                .foregroundColor(.secondary)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    // MARK: - Conversion Helpers

    /// Convert SerializedFeedViewPost to FeedViewPost for PostCardView
    private func convertToFeedViewPost(_ serializedPost: SerializedFeedViewPost) -> FeedViewPost {
        let post = serializedPost.post

        return FeedViewPost(
            post: PostView(
                uri: post.uri,
                cid: post.cid,
                author: PostAuthor(
                    did: post.author.did,
                    handle: post.author.handle,
                    displayName: post.author.displayName,
                    avatar: post.author.avatar
                ),
                record: PostRecord(
                    text: post.record.text,
                    facets: convertFacets(post.record.facets),
                    createdAt: post.record.createdAt,
                    embed: post.embed.flatMap { PostEmbedData.from(serializedEmbed: $0) }
                ),
                indexedAt: post.indexedAt,
                likeCount: post.likeCount ?? 0,
                repostCount: post.repostCount ?? 0,
                replyCount: post.replyCount ?? 0,
                viewer: post.viewer.map { PostViewer(like: $0.like, repost: $0.repost) },
                labels: post.labels?.map { ContentLabel(val: $0.val, src: $0.src) }
            )
        )
    }

    /// Convert serialized facets to PostFacet
    private func convertFacets(_ facets: [Facet]?) -> [PostFacet]? {
        guard let facets = facets else { return nil }

        return facets.map { facet in
            PostFacet(
                index: PostFacetIndex(
                    byteStart: facet.index.byteStart,
                    byteEnd: facet.index.byteEnd
                ),
                features: facet.features.compactMap { feature in
                    switch feature {
                    case .mention(let mention):
                        return .mention(did: mention.did)
                    case .link(let link):
                        return .link(uri: link.uri)
                    case .tag(let tag):
                        return .hashtag(tag: tag.tag)
                    }
                }
            )
        }
    }
}

// MARK: - Feed State

/// Observable object that manages feed data from FeedBridge
class FeedState: ObservableObject {
    @Published var posts: [SerializedFeedViewPost] = []

    private var feedDataObserver: NSObjectProtocol?
    private var incrementalUpdateObserver: NSObjectProtocol?
    private var clearDataObserver: NSObjectProtocol?

    func startObserving() {
        // Observe feed data updates
        feedDataObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("FeedBridgeDataUpdated"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let feedData = notification.userInfo?["feedData"] as? SerializedFeedData {
                self?.posts = feedData.posts
            }
        }

        // Observe incremental updates
        incrementalUpdateObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("FeedBridgeIncrementalUpdate"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self = self else { return }

            if let batchUpdate = notification.userInfo?["batchUpdate"] as? FeedBatchUpdate {
                for update in batchUpdate.updates {
                    if let index = self.posts.firstIndex(where: { $0.post.uri == update.uri }) {
                        var post = self.posts[index].post

                        // Update counts
                        if let likeCount = update.likeCount {
                            post = SerializedPost(
                                uri: post.uri,
                                cid: post.cid,
                                author: post.author,
                                record: post.record,
                                embed: post.embed,
                                replyCount: post.replyCount,
                                repostCount: post.repostCount,
                                likeCount: likeCount,
                                quoteCount: post.quoteCount,
                                viewer: update.viewer ?? post.viewer,
                                labels: post.labels,
                                indexedAt: post.indexedAt
                            )
                        }

                        if let repostCount = update.repostCount {
                            post = SerializedPost(
                                uri: post.uri,
                                cid: post.cid,
                                author: post.author,
                                record: post.record,
                                embed: post.embed,
                                replyCount: post.replyCount,
                                repostCount: repostCount,
                                likeCount: post.likeCount,
                                quoteCount: post.quoteCount,
                                viewer: update.viewer ?? post.viewer,
                                labels: post.labels,
                                indexedAt: post.indexedAt
                            )
                        }

                        if let replyCount = update.replyCount {
                            post = SerializedPost(
                                uri: post.uri,
                                cid: post.cid,
                                author: post.author,
                                record: post.record,
                                embed: post.embed,
                                replyCount: replyCount,
                                repostCount: post.repostCount,
                                likeCount: post.likeCount,
                                quoteCount: post.quoteCount,
                                viewer: update.viewer ?? post.viewer,
                                labels: post.labels,
                                indexedAt: post.indexedAt
                            )
                        }

                        // Update the post
                        self.posts[index] = SerializedFeedViewPost(
                            post: post,
                            reply: self.posts[index].reply,
                            reason: self.posts[index].reason,
                            feedContext: self.posts[index].feedContext
                        )
                    }
                }
            }
        }

        // Observe clear data
        clearDataObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("FeedBridgeDataCleared"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.posts = []
        }
    }

    func stopObserving() {
        if let observer = feedDataObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = incrementalUpdateObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = clearDataObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}

// MARK: - Preview

#if DEBUG
struct FeedListView_Previews: PreviewProvider {
    static var previews: some View {
        FeedListView(
            isLoading: false,
            isRefreshing: false,
            isLoadingMore: false,
            error: nil,
            emptyMessage: "No posts yet",
            onRefresh: { print("Refresh") },
            onLoadMore: { print("Load more") },
            onPostPress: { uri, handle in print("Post: \(uri)") },
            onProfilePress: { handle in print("Profile: \(handle)") },
            onLike: { uri, cid, likeUri in print("Like: \(uri)") },
            onRepost: { uri, cid, repostUri in print("Repost: \(uri)") },
            onReply: { uri, cid, handle in print("Reply: \(uri)") },
            onBookmark: { uri in print("Bookmark: \(uri)") },
            onMentionPress: { handle, did in print("Mention: \(handle)") },
            onHashtagPress: { tag in print("Hashtag: \(tag)") },
            onShare: { uri in print("Share: \(uri)") }
        )
    }
}
#endif
