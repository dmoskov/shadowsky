//
//  FeedList.swift
//  Asphodel
//
//  Native SwiftUI feed list implementation replacing React Native FlatList
//  Features:
//  - Efficient virtualization using List/LazyVStack
//  - Pull-to-refresh support
//  - Infinite scroll with pagination
//  - Loading, error, and empty states
//  - Muted word filtering
//  - Optimized performance for 100+ posts
//

import SwiftUI

// MARK: - Feed List Props
struct FeedListProps {
    var posts: [FeedViewPost]
    var isLoading: Bool
    var isRefreshing: Bool
    var isLoadingMore: Bool
    var error: Error?
    var emptyMessage: String
    var feedType: String
    var mutedWords: [MutedWord]
    var isOnline: Bool

    // Callbacks
    var onRefresh: (() -> Void)?
    var onLoadMore: (() -> Void)?
    var onPostPress: ((FeedViewPost) -> Void)?
    var onProfilePress: ((String) -> Void)?
    var onLike: ((FeedViewPost) -> Void)?
    var onRepost: ((FeedViewPost) -> Void)?
    var onReply: ((FeedViewPost) -> Void)?
    var onBookmark: ((FeedViewPost) -> Void)?
    var isBookmarked: ((String) -> Bool)?
    var onMentionPress: ((String, String) -> Void)?
    var onHashtagPress: ((String) -> Void)?

    init(
        posts: [FeedViewPost] = [],
        isLoading: Bool = false,
        isRefreshing: Bool = false,
        isLoadingMore: Bool = false,
        error: Error? = nil,
        emptyMessage: String = "No posts yet",
        feedType: String = "other",
        mutedWords: [MutedWord] = [],
        isOnline: Bool = true,
        onRefresh: (() -> Void)? = nil,
        onLoadMore: (() -> Void)? = nil,
        onPostPress: ((FeedViewPost) -> Void)? = nil,
        onProfilePress: ((String) -> Void)? = nil,
        onLike: ((FeedViewPost) -> Void)? = nil,
        onRepost: ((FeedViewPost) -> Void)? = nil,
        onReply: ((FeedViewPost) -> Void)? = nil,
        onBookmark: ((FeedViewPost) -> Void)? = nil,
        isBookmarked: ((String) -> Bool)? = nil,
        onMentionPress: ((String, String) -> Void)? = nil,
        onHashtagPress: ((String) -> Void)? = nil
    ) {
        self.posts = posts
        self.isLoading = isLoading
        self.isRefreshing = isRefreshing
        self.isLoadingMore = isLoadingMore
        self.error = error
        self.emptyMessage = emptyMessage
        self.feedType = feedType
        self.mutedWords = mutedWords
        self.isOnline = isOnline
        self.onRefresh = onRefresh
        self.onLoadMore = onLoadMore
        self.onPostPress = onPostPress
        self.onProfilePress = onProfilePress
        self.onLike = onLike
        self.onRepost = onRepost
        self.onReply = onReply
        self.onBookmark = onBookmark
        self.isBookmarked = isBookmarked
        self.onMentionPress = onMentionPress
        self.onHashtagPress = onHashtagPress
    }
}

// MARK: - Feed List View
struct FeedList: View {
    let props: FeedListProps

    // Filtered posts based on muted words
    private var filteredPosts: [FeedViewPost] {
        ContentFilter.filterMutedPosts(
            posts: props.posts,
            mutedWords: props.mutedWords,
            feedType: props.feedType
        )
    }

    var body: some View {
        ZStack {
            // Background color
            Color(hex: "0a0a0f")
                .ignoresSafeArea()

            if props.isLoading && props.posts.isEmpty {
                // Initial loading state with skeletons
                loadingView
            } else if let error = props.error, props.posts.isEmpty {
                // Error state
                errorView(error: error)
            } else if filteredPosts.isEmpty && !props.isLoading {
                // Empty state
                emptyView
            } else {
                // Main feed list
                feedListView
            }
        }
    }

    // MARK: - Feed List with Posts
    private var feedListView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(filteredPosts) { post in
                    PostCard(
                        post: post,
                        onPress: { props.onPostPress?(post) },
                        onPressProfile: props.onProfilePress,
                        onLike: { props.onLike?(post) },
                        onRepost: { props.onRepost?(post) },
                        onReply: { props.onReply?(post) },
                        onBookmark: { props.onBookmark?(post) },
                        isBookmarked: props.isBookmarked?(post.post.uri) ?? false,
                        onMentionPress: props.onMentionPress,
                        onHashtagPress: props.onHashtagPress
                    )
                    .id(post.post.uri)

                    // Divider between posts
                    Divider()
                        .background(Color.gray.opacity(0.2))

                    // Pagination trigger: Load more when reaching near the end
                    // Triggers at 0.5 threshold (similar to RN onEndReachedThreshold)
                    if shouldTriggerLoadMore(for: post) {
                        Color.clear
                            .frame(height: 1)
                            .onAppear {
                                if !props.isLoadingMore && !props.isLoading {
                                    props.onLoadMore?()
                                }
                            }
                    }
                }

                // Loading more indicator at the bottom
                if props.isLoadingMore {
                    HStack {
                        Spacer()
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: props.isOnline ? .blue : .gray))
                            .padding(20)
                        Spacer()
                    }
                }
            }
        }
        .refreshable {
            // Pull-to-refresh functionality
            // Only trigger if online
            if props.isOnline {
                await withCheckedContinuation { continuation in
                    props.onRefresh?()
                    // Provide haptic feedback
                    let generator = UIImpactFeedbackGenerator(style: .light)
                    generator.impactOccurred()
                    continuation.resume()
                }
            }
        }
    }

    // MARK: - Loading State
    private var loadingView: some View {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(0..<5, id: \.self) { _ in
                    PostCardSkeleton()
                }
            }
        }
    }

    // MARK: - Error State
    private func errorView(error: Error) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.red)

            Text("Failed to load feed")
                .font(.system(size: 18, weight: .semibold))
                .foregroundColor(.white)

            Text(error.localizedDescription)
                .font(.system(size: 14))
                .foregroundColor(.gray)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            if let onRefresh = props.onRefresh {
                Button(action: {
                    onRefresh()
                }) {
                    Text("Retry")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white)
                        .padding(.horizontal, 32)
                        .padding(.vertical, 12)
                        .background(Color.blue)
                        .cornerRadius(8)
                }
                .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State
    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundColor(.gray)

            Text(props.emptyMessage)
                .font(.system(size: 16))
                .foregroundColor(.gray)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Pagination Helper
    /// Determines if we should trigger load more based on the current post
    /// Triggers when we're near the end (0.5 threshold like React Native)
    private func shouldTriggerLoadMore(for post: FeedViewPost) -> Bool {
        guard let lastPost = filteredPosts.last else {
            return false
        }

        // Calculate position in the list
        let totalPosts = filteredPosts.count
        guard let currentIndex = filteredPosts.firstIndex(where: { $0.id == post.id }) else {
            return false
        }

        // Trigger when we're at 50% from the end (0.5 threshold)
        // Similar to React Native's onEndReachedThreshold
        let threshold = 0.5
        let triggerPoint = Int(Double(totalPosts) * (1.0 - threshold))

        return currentIndex >= triggerPoint && !props.isLoadingMore
    }
}

// MARK: - Post Card Skeleton
struct PostCardSkeleton: View {
    @State private var isAnimating = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                // Avatar skeleton
                Circle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 4) {
                    // Name skeleton
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 120, height: 14)

                    // Handle skeleton
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 80, height: 12)
                }

                Spacer()
            }

            // Content skeleton
            VStack(spacing: 6) {
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.3))
                    .frame(height: 14)

                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.3))
                    .frame(height: 14)

                RoundedRectangle(cornerRadius: 4)
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 200, height: 14)
            }

            // Action buttons skeleton
            HStack(spacing: 40) {
                ForEach(0..<4, id: \.self) { _ in
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(width: 30, height: 14)
                }
                Spacer()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .opacity(isAnimating ? 0.5 : 1.0)
        .animation(
            Animation.easeInOut(duration: 1.0)
                .repeatForever(autoreverses: true),
            value: isAnimating
        )
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - Preview
#if DEBUG
struct FeedList_Previews: PreviewProvider {
    static var previews: some View {
        // Sample data for preview
        let samplePost = FeedViewPost(
            post: Post(
                uri: "at://did:plc:example/app.bsky.feed.post/1",
                cid: "cid123",
                author: ProfileViewBasic(
                    did: "did:plc:example",
                    handle: "user.bsky.social",
                    displayName: "Example User",
                    avatar: nil,
                    labels: nil,
                    viewer: nil
                ),
                record: PostRecord(
                    text: "This is a sample post for preview",
                    createdAt: ISO8601DateFormatter().string(from: Date()),
                    facets: nil,
                    embed: nil,
                    langs: ["en"],
                    reply: nil
                ),
                embed: nil,
                replyCount: 2,
                repostCount: 5,
                likeCount: 10,
                quoteCount: 1,
                indexedAt: ISO8601DateFormatter().string(from: Date()),
                viewer: nil,
                labels: nil
            ),
            reply: nil,
            reason: nil,
            feedContext: nil
        )

        let props = FeedListProps(
            posts: [samplePost, samplePost, samplePost],
            isLoading: false,
            isRefreshing: false,
            isLoadingMore: false,
            error: nil,
            emptyMessage: "No posts yet",
            feedType: "other",
            mutedWords: [],
            isOnline: true
        )

        FeedList(props: props)
            .preferredColorScheme(.dark)
    }
}
#endif
