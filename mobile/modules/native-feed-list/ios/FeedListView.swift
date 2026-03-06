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

// MARK: - Pre-computed Post Model

/// Holds a pre-converted FeedViewPost alongside its serialized source data.
/// Conversions happen once when data arrives, not per-cell during render.
struct ConvertedFeedPost: Identifiable {
    let id: String // post URI
    let feedViewPost: FeedViewPost
    let isBookmarked: Bool
    let sourcePost: SerializedFeedViewPost
}

// MARK: - Scroll Offset Tracking

/// PreferenceKey for tracking ScrollView content offset
struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - Feed List Props

/// ObservableObject for props passed from React Native.
/// Using an observable object allows SwiftUI to diff individual property
/// changes instead of replacing the entire rootView on every prop update.
class FeedListProps: ObservableObject {
    @Published var isLoading: Bool = true  // Default true so skeletons show before first prop update
    @Published var isRefreshing: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String? = nil
    @Published var emptyMessage: String = "No posts yet"
    @Published var scrollToTopTrigger: Int = 0
}

// MARK: - FeedListView

/// SwiftUI view that displays a scrollable feed of posts
/// Uses data from the FeedBridge module and PostCardView for rendering
struct FeedListView: View {
    // MARK: - Properties

    // Feed data
    @StateObject private var feedState = FeedState()

    // Scroll position restoration
    @State private var visiblePostIds: Set<String> = []
    @State private var firstVisiblePostId: String? = nil
    @State private var scrollProxy: ScrollViewProxy? = nil

    // Configuration (observable to avoid full rootView replacement)
    @ObservedObject var props: FeedListProps

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
    let onQuotePost: ((String, String, String, String?, String?, String) -> Void)? // (uri, cid, handle, displayName?, avatar?, text)
    let onScroll: ((CGFloat) -> Void)?

    // MARK: - Body

    var body: some View {
        ZStack {
            if feedState.convertedPosts.isEmpty && (props.isLoading || !feedState.hasReceivedData) {
                loadingView
            } else if let error = props.error ?? feedState.decodeError, feedState.convertedPosts.isEmpty {
                errorView(error)
            } else if feedState.convertedPosts.isEmpty {
                emptyView
            } else {
                feedScrollView
            }
        }
        .accessibilityIdentifier("feed-list")
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
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    // Invisible scroll offset tracker
                    GeometryReader { geo in
                        Color.clear.preference(
                            key: ScrollOffsetPreferenceKey.self,
                            value: -geo.frame(in: .named("feedScroll")).minY
                        )
                    }
                    .frame(height: 0)

                    // Post items - uses pre-computed conversions
                    ForEach(Array(feedState.convertedPosts.enumerated()), id: \.element.id) { index, converted in
                        PostCardView(
                            post: converted.feedViewPost,
                            isBookmarked: converted.isBookmarked,
                            isOnline: true,
                            currentUserDid: nil,
                            onPress: {
                                onPostPress?(converted.sourcePost.post.uri, converted.sourcePost.post.author.handle)
                            },
                            onPressProfile: { handle in
                                onProfilePress?(handle)
                            },
                            onLike: {
                                onLike?(
                                    converted.sourcePost.post.uri,
                                    converted.sourcePost.post.cid,
                                    converted.sourcePost.post.viewer?.like
                                )
                            },
                            onRepost: {
                                onRepost?(
                                    converted.sourcePost.post.uri,
                                    converted.sourcePost.post.cid,
                                    converted.sourcePost.post.viewer?.repost
                                )
                            },
                            onReply: {
                                onReply?(
                                    converted.sourcePost.post.uri,
                                    converted.sourcePost.post.cid,
                                    converted.sourcePost.post.author.handle
                                )
                            },
                            onBookmark: {
                                onBookmark?(converted.sourcePost.post.uri)
                            },
                            onMentionPress: { handle, did in
                                onMentionPress?(handle, did)
                            },
                            onHashtagPress: { tag in
                                onHashtagPress?(tag)
                            },
                            onShare: {
                                onShare?(converted.sourcePost.post.uri)
                            },
                            onMute: nil,
                            onBlock: nil,
                            onDelete: nil,
                            onReport: nil,
                            onImagePress: onImagePress,
                            onLinkPress: onLinkPress,
                            onQuotePress: onQuotePress,
                            onQuotePost: {
                                onQuotePost?(
                                    converted.sourcePost.post.uri,
                                    converted.sourcePost.post.cid,
                                    converted.sourcePost.post.author.handle,
                                    converted.sourcePost.post.author.displayName,
                                    converted.sourcePost.post.author.avatar,
                                    converted.sourcePost.post.record.text
                                )
                            }
                        )
                        .id(converted.id)
                        .accessibilityIdentifier("feed-post-\(index)")
                        .onAppear {
                            visiblePostIds.insert(converted.id)
                            updateFirstVisiblePost()
                        }
                        .onDisappear {
                            visiblePostIds.remove(converted.id)
                            updateFirstVisiblePost()
                        }

                        // Load more trigger - fire when near end of list
                        if converted.id == feedState.convertedPosts.dropLast(min(3, feedState.convertedPosts.count)).last?.id {
                            Color.clear
                                .frame(height: 1)
                                .onAppear {
                                    if !props.isLoadingMore {
                                        onLoadMore?()
                                    }
                                }
                        }
                    }

                    // Loading more indicator
                    if props.isLoadingMore {
                        ProgressView()
                            .padding()
                    }
                }
            }
            .coordinateSpace(name: "feedScroll")
            .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                onScroll?(value)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable {
                // Clear tracked position so refresh shows content from top
                firstVisiblePostId = nil
                visiblePostIds.removeAll()
                onRefresh?()
            }
            .onAppear {
                scrollProxy = proxy
            }
            .onChangeCompat(of: feedState.convertedPosts.count) { _ in
                restoreScrollPositionIfNeeded()
            }
            .onChangeCompat(of: props.scrollToTopTrigger) { _ in
                guard props.scrollToTopTrigger > 0 else { return }
                if let firstId = feedState.convertedPosts.first?.id {
                    withAnimation {
                        proxy.scrollTo(firstId, anchor: .top)
                    }
                }
            }
        }
    }

    // MARK: - Scroll Position Tracking

    /// Determines the topmost visible post based on the order in the feed.
    /// Posts report visibility via onAppear/onDisappear; this finds the first
    /// one in feed order that is currently on screen.
    private func updateFirstVisiblePost() {
        guard !visiblePostIds.isEmpty else {
            firstVisiblePostId = nil
            return
        }
        firstVisiblePostId = feedState.convertedPosts.first { visiblePostIds.contains($0.id) }?.id
    }

    /// When new posts are prepended to the feed (e.g. after background refetch),
    /// scroll back to the post the user was viewing so their position isn't lost.
    private func restoreScrollPositionIfNeeded() {
        guard let target = firstVisiblePostId,
              let proxy = scrollProxy,
              feedState.convertedPosts.contains(where: { $0.id == target }) else {
            return
        }

        // Only restore if the target post is not the first post
        // (if it's the first post, the user is already at the top)
        guard feedState.convertedPosts.first?.id != target else { return }

        // Dispatch async to allow LazyVStack layout to settle after data change
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            proxy.scrollTo(target, anchor: .top)
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        ScrollView {
            FeedSkeletonView()
        }
        .accessibilityIdentifier("feed-loading")
    }

    // MARK: - Error View

    private func errorView(_ errorMessage: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
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
                .font(.largeTitle)
                .foregroundColor(.secondary)

            Text(props.emptyMessage)
                .foregroundColor(.secondary)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .accessibilityIdentifier("feed-empty")
    }
}

// MARK: - Feed State

/// Observable object that manages feed data from FeedBridge.
/// Pre-computes FeedViewPost conversions when data arrives so the
/// ForEach body doesn't run convertToFeedViewPost per cell per render.
class FeedState: ObservableObject {
    @Published var posts: [SerializedFeedViewPost] = []
    @Published var convertedPosts: [ConvertedFeedPost] = []
    @Published var decodeError: String? = nil
    @Published var hasReceivedData: Bool = false

    private var feedDataObserver: NSObjectProtocol?
    private var incrementalUpdateObserver: NSObjectProtocol?
    private var clearDataObserver: NSObjectProtocol?
    private var decodeErrorObserver: NSObjectProtocol?

    func startObserving() {
        // Observe feed data updates
        feedDataObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("FeedBridgeDataUpdated"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let feedData = notification.userInfo?["feedData"] as? SerializedFeedData {
                self?.decodeError = nil // Clear error on successful data
                self?.updatePosts(feedData.posts)
            }
        }

        // Observe decode errors from bridge
        decodeErrorObserver = NotificationCenter.default.addObserver(
            forName: FeedBridgeModule.feedDecodeErrorNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            let isPartial = notification.userInfo?["isPartial"] as? Bool ?? false
            let message = notification.userInfo?["message"] as? String ?? "Failed to load feed"
            // Only set full error if it's a total failure (not partial skip)
            if !isPartial {
                self?.decodeError = message
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
                        let existing = self.posts[index].post

                        // Consolidate all count updates into a single struct creation
                        let updatedPost = SerializedPost(
                            uri: existing.uri,
                            cid: existing.cid,
                            author: existing.author,
                            record: existing.record,
                            embed: existing.embed,
                            replyCount: update.replyCount ?? existing.replyCount,
                            repostCount: update.repostCount ?? existing.repostCount,
                            likeCount: update.likeCount ?? existing.likeCount,
                            quoteCount: existing.quoteCount,
                            viewer: update.viewer ?? existing.viewer,
                            labels: existing.labels,
                            indexedAt: existing.indexedAt
                        )

                        let updatedFeedViewPost = SerializedFeedViewPost(
                            post: updatedPost,
                            reply: self.posts[index].reply,
                            reason: self.posts[index].reason,
                            feedContext: self.posts[index].feedContext,
                            isBookmarked: update.isBookmarked ?? self.posts[index].isBookmarked
                        )
                        self.posts[index] = updatedFeedViewPost

                        // Re-convert only the changed post
                        if index < self.convertedPosts.count {
                            self.convertedPosts[index] = Self.convertPost(updatedFeedViewPost)
                        }
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
            self?.convertedPosts = []
            self?.hasReceivedData = false
        }
    }

    deinit {
        stopObserving()
    }

    func stopObserving() {
        if let observer = feedDataObserver {
            NotificationCenter.default.removeObserver(observer)
            feedDataObserver = nil
        }
        if let observer = incrementalUpdateObserver {
            NotificationCenter.default.removeObserver(observer)
            incrementalUpdateObserver = nil
        }
        if let observer = clearDataObserver {
            NotificationCenter.default.removeObserver(observer)
            clearDataObserver = nil
        }
        if let observer = decodeErrorObserver {
            NotificationCenter.default.removeObserver(observer)
            decodeErrorObserver = nil
        }
    }

    // MARK: - Pre-computation

    /// Builds a lightweight fingerprint for a serialized post to detect changes
    /// without performing a full conversion. Compares fields that affect rendering.
    private static func postFingerprint(_ post: SerializedFeedViewPost) -> String {
        let p = post.post
        let viewerLike = p.viewer?.like ?? ""
        let viewerRepost = p.viewer?.repost ?? ""
        let bookmarked = post.isBookmarked ?? false
        return "\(p.cid)|\(p.likeCount ?? 0)|\(p.repostCount ?? 0)|\(p.replyCount ?? 0)|\(viewerLike)|\(viewerRepost)|\(bookmarked)"
    }

    private func updatePosts(_ newPosts: [SerializedFeedViewPost]) {
        // Build a lookup of existing converted posts by URI for O(1) access
        // Use uniquingKeysWith to handle duplicate URIs (e.g. repost + original in same feed)
        let existingByURI: [String: ConvertedFeedPost] = Dictionary(
            convertedPosts.map { ($0.id, $0) },
            uniquingKeysWith: { _, latest in latest }
        )

        // Build fingerprint lookup for existing posts to detect changes
        let existingFingerprints: [String: String] = Dictionary(
            posts.map { ($0.post.uri, Self.postFingerprint($0)) },
            uniquingKeysWith: { _, latest in latest }
        )

        // Map new posts, reusing existing conversions where possible
        let newConverted = newPosts.map { newPost -> ConvertedFeedPost in
            let uri = newPost.post.uri
            if let existing = existingByURI[uri],
               let oldFingerprint = existingFingerprints[uri],
               oldFingerprint == Self.postFingerprint(newPost) {
                // Post unchanged — reuse existing conversion
                return existing
            }
            // New or changed post — convert it
            return Self.convertPost(newPost)
        }

        posts = newPosts
        convertedPosts = newConverted
        hasReceivedData = true
    }

    /// Convert a single SerializedFeedViewPost to ConvertedFeedPost.
    /// This is a static method so it can be called without capturing self.
    static func convertPost(_ serializedPost: SerializedFeedViewPost) -> ConvertedFeedPost {
        let post = serializedPost.post

        // Convert reply parent if present
        let replyParent: ReplyParent? = serializedPost.reply.map { reply in
            ReplyParent(
                uri: reply.parent.uri,
                authorHandle: reply.parent.author.handle,
                authorDisplayName: reply.parent.author.displayName,
                authorAvatar: reply.parent.author.avatar,
                text: reply.parent.record.text.isEmpty ? nil : reply.parent.record.text
            )
        }

        let feedViewPost = FeedViewPost(
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
                    facets: Self.convertFacets(post.record.facets),
                    createdAt: post.record.createdAt,
                    embed: post.embed.flatMap { PostEmbedData.from(serializedEmbed: $0) }
                ),
                indexedAt: post.indexedAt,
                likeCount: post.likeCount ?? 0,
                repostCount: post.repostCount ?? 0,
                replyCount: post.replyCount ?? 0,
                viewer: post.viewer.map { PostViewer(like: $0.like, repost: $0.repost) },
                labels: post.labels?.map { ContentLabel(val: $0.val, src: $0.src) }
            ),
            replyParent: replyParent
        )

        return ConvertedFeedPost(
            id: post.uri,
            feedViewPost: feedViewPost,
            isBookmarked: serializedPost.isBookmarked ?? false,
            sourcePost: serializedPost
        )
    }

    /// Convert serialized facets to PostFacet
    private static func convertFacets(_ facets: [Facet]?) -> [PostFacet]? {
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

// MARK: - Preview

#if DEBUG
struct FeedListView_Previews: PreviewProvider {
    static var previews: some View {
        let props = FeedListProps()
        FeedListView(
            props: props,
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
            onShare: { uri in print("Share: \(uri)") },
            onImagePress: { images, index in print("Image: \(index)") },
            onLinkPress: { url in print("Link: \(url)") },
            onQuotePress: { uri, handle in print("Quote: \(uri)") },
            onQuotePost: { uri, cid, handle, displayName, avatar, text in print("QuotePost: \(uri)") },
            onScroll: { offset in print("Scroll: \(offset)") }
        )
    }
}
#endif
