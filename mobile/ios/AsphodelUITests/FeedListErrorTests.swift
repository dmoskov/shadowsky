//
//  FeedListErrorTests.swift
//  AsphodelUITests
//
//  Error state and edge case tests for the NativeFeedList module.
//  Tests cover empty feeds, missing author data, emoji-only text,
//  extremely long text, and the FeedState conversion pipeline.
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeFeedList
@testable import FeedBridge

// MARK: - FeedState Conversion Error Tests

class FeedStateConversionErrorTests: XCTestCase {

    // MARK: - Test: Convert post with nil optional counts defaults to 0

    func testConvertPostWithNilCountsDefaultsToZero() {
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/1",
            cid: "bafyrei-test",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "No counts post", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: nil,
            repostCount: nil,
            likeCount: nil,
            quoteCount: nil,
            viewer: nil,
            labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertEqual(converted.feedViewPost.post.likeCount, 0, "Nil likeCount should default to 0")
        XCTAssertEqual(converted.feedViewPost.post.repostCount, 0, "Nil repostCount should default to 0")
        XCTAssertEqual(converted.feedViewPost.post.replyCount, 0, "Nil replyCount should default to 0")
    }

    // MARK: - Test: Convert post with missing author displayName and avatar

    func testConvertPostWithMissingAuthorDisplayNameAndAvatar() {
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/noavatar",
            cid: "bafyrei-noavatar",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "No avatar post", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil, labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertNil(converted.feedViewPost.post.author.displayName,
            "Missing displayName should remain nil (view shows handle as fallback)")
        XCTAssertNil(converted.feedViewPost.post.author.avatar,
            "Missing avatar should remain nil (view shows placeholder)")
    }

    // MARK: - Test: Convert post with all-emoji text

    func testConvertPostWithAllEmojiText() {
        let emojiText = "🔥💯🎉👏🏽✨🌈🦋🎨🎵🏆"
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/emoji",
            cid: "bafyrei-emoji",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: "Emoji User", avatar: nil),
            record: SerializedRecord(text: emojiText, facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil, labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertEqual(converted.feedViewPost.post.record.text, emojiText,
            "Emoji text should be preserved through conversion")
    }

    // MARK: - Test: Convert post with 4000+ character text

    func testConvertPostWith4000CharText() {
        let longText = String(repeating: "This is a very long post. ", count: 200) // ~5200 chars
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/long",
            cid: "bafyrei-long",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: longText, facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil, labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertEqual(converted.feedViewPost.post.record.text, longText,
            "Long text should be preserved without truncation in the model")
    }

    // MARK: - Test: Convert post with nil embed

    func testConvertPostWithNilEmbed() {
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/noembed",
            cid: "bafyrei-noembed",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "No embed", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil, labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertNil(converted.feedViewPost.post.record.embed,
            "Nil embed should remain nil after conversion")
    }

    // MARK: - Test: Convert post with nil viewer

    func testConvertPostWithNilViewer() {
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/noviewer",
            cid: "bafyrei-noviewer",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "No viewer", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil, labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertNil(converted.feedViewPost.post.viewer,
            "Nil viewer should remain nil after conversion")
    }

    // MARK: - Test: Convert post with empty labels array

    func testConvertPostWithEmptyLabelsArray() {
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/emptylabels",
            cid: "bafyrei-emptylabels",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "Empty labels", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil,
            labels: [],
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertNotNil(converted.feedViewPost.post.labels, "Empty labels array should not become nil")
        XCTAssertEqual(converted.feedViewPost.post.labels?.count, 0, "Empty labels should stay empty")
    }

    // MARK: - Test: ConvertedFeedPost ID uses post URI

    func testConvertedFeedPostIDUsesPostURI() {
        let testURI = "at://did:plc:test/app.bsky.feed.post/unique123"
        let post = SerializedPost(
            uri: testURI,
            cid: "bafyrei-unique",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "Test", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil, labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertEqual(converted.id, testURI, "ConvertedFeedPost id should be the post URI")
    }

    // MARK: - Test: isBookmarked defaults to false when nil

    func testIsBookmarkedDefaultsToFalse() {
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/bookmark",
            cid: "bafyrei-bm",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "Test", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: nil,
            viewer: nil, labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil, isBookmarked: nil)
        let converted = FeedState.convertPost(feedViewPost)

        XCTAssertFalse(converted.isBookmarked, "Nil isBookmarked should default to false")
    }
}

// MARK: - FeedListView Error State Tests

class FeedListViewErrorStateTests: XCTestCase {

    // MARK: - FeedListView conformance
    // Note: FeedListView: Inspectable is declared in FeedListTests.swift

    private func makeView(
        props: FeedListProps = FeedListProps(),
        onRefresh: (() -> Void)? = nil
    ) -> FeedListView {
        FeedListView(
            props: props,
            onRefresh: onRefresh,
            onLoadMore: nil,
            onPostPress: nil,
            onProfilePress: nil,
            onLike: nil,
            onRepost: nil,
            onReply: nil,
            onBookmark: nil,
            onMentionPress: nil,
            onHashtagPress: nil,
            onShare: nil,
            onImagePress: nil,
            onLinkPress: nil,
            onQuotePress: nil
        )
    }

    // MARK: - Test: Feed with 0 posts shows empty state, not blank screen

    func testFeedWithZeroPostsShowsEmptyState() throws {
        let props = FeedListProps()
        let view = makeView(props: props)
        let inspected = try view.inspect()

        let emptyText = try inspected.find(text: "No posts yet")
        XCTAssertNotNil(emptyText, "Empty feed should show 'No posts yet' message, not a blank screen")
    }

    // MARK: - Test: Error state displays error message

    func testErrorStateDisplaysErrorMessage() throws {
        let props = FeedListProps()
        props.error = "Something went wrong"

        let view = makeView(props: props)
        let inspected = try view.inspect()

        let errorText = try inspected.find(text: "Something went wrong")
        XCTAssertNotNil(errorText, "Should display the error message")

        let retryButton = try inspected.find(text: "Try Again")
        XCTAssertNotNil(retryButton, "Should show retry button in error state")
    }

    // MARK: - Test: Error state retry triggers refresh

    func testErrorStateRetryTriggersRefresh() throws {
        let props = FeedListProps()
        props.error = "Network error"

        var refreshCalled = false
        let expectation = expectation(description: "refresh called")

        let view = makeView(props: props, onRefresh: {
            refreshCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        let retryButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Try Again")) != nil
        })
        try retryButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(refreshCalled, "Retry should call onRefresh")
    }

    // MARK: - Test: Loading state shows loading indicator, not blank screen

    func testLoadingStateShowsLoadingIndicator() throws {
        let props = FeedListProps()
        props.isLoading = true

        let view = makeView(props: props)
        let inspected = try view.inspect()

        let loadingText = try inspected.find(text: "Loading feed...")
        XCTAssertNotNil(loadingText, "Loading state should show loading text, not blank screen")

        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Loading state should show progress indicator")
    }
}
