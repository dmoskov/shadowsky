//
//  PostCardViewTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for the PostCardView SwiftUI component
//  from the native-feed-list module. Tests cover post rendering, author info,
//  timestamps, tap handlers, engagement counts, and embed types.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
import ExpoSwiftUIFeed
@testable import NativeFeedList

// MARK: - ViewInspector Conformance

extension PostCardView: Inspectable {}

// MARK: - PostCardView Tests

class PostCardViewTests: XCTestCase {

    /// Helper to create a PostCardView with default noop handlers
    private func makeView(
        post: FeedViewPost = MockFeed.makeFeedViewPost(),
        isBookmarked: Bool = false,
        isOnline: Bool = true,
        currentUserDid: String? = nil,
        onPress: (() -> Void)? = nil,
        onPressProfile: ((String) -> Void)? = nil,
        onLike: (() -> Void)? = nil,
        onRepost: (() -> Void)? = nil,
        onReply: (() -> Void)? = nil,
        onBookmark: (() -> Void)? = nil,
        onMentionPress: ((String, String) -> Void)? = nil,
        onHashtagPress: ((String) -> Void)? = nil,
        onShare: (() -> Void)? = nil,
        onMute: (() -> Void)? = nil,
        onBlock: (() -> Void)? = nil,
        onDelete: (() -> Void)? = nil,
        onReport: (() -> Void)? = nil,
        onImagePress: (([ImageEmbedData], Int) -> Void)? = nil,
        onLinkPress: ((String) -> Void)? = nil,
        onQuotePress: ((String, String) -> Void)? = nil
    ) -> PostCardView {
        PostCardView(
            post: post,
            isBookmarked: isBookmarked,
            isOnline: isOnline,
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
            onImagePress: onImagePress,
            onLinkPress: onLinkPress,
            onQuotePress: onQuotePress
        )
    }

    // MARK: - Test: Post renders with author name, handle, and text

    func testPostRendersWithAuthorNameHandleAndText() throws {
        let post = MockFeed.makeFeedViewPost(post: MockFeed.makePostView(
            author: MockFeed.makePostAuthor(
                handle: "alice.bsky.social",
                displayName: "Alice Johnson"
            ),
            record: MockFeed.makePostRecord(text: "Hello world from the feed!")
        ))

        let view = makeView(post: post)
        let inspected = try view.inspect()

        // Display name should be visible
        let displayName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(displayName, "Should render author display name")

        // Handle should be visible with @ prefix
        let handle = try inspected.find(text: "@alice.bsky.social")
        XCTAssertNotNil(handle, "Should render author handle with @ prefix")
    }

    // MARK: - Test: Relative time formatting works for seconds

    func testRelativeTimeFormattingSeconds() {
        // Create a timestamp that is 30 seconds ago
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let thirtySecondsAgo = Date().addingTimeInterval(-30)
        let isoString = formatter.string(from: thirtySecondsAgo)

        let result = DateFormatting.relativeTimeString(from: isoString)
        XCTAssertEqual(result, "30s", "30 seconds ago should format as '30s'")
    }

    // MARK: - Test: Relative time formatting works for minutes

    func testRelativeTimeFormattingMinutes() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let fiveMinutesAgo = Date().addingTimeInterval(-300)
        let isoString = formatter.string(from: fiveMinutesAgo)

        let result = DateFormatting.relativeTimeString(from: isoString)
        XCTAssertEqual(result, "5m", "5 minutes ago should format as '5m'")
    }

    // MARK: - Test: Relative time formatting works for hours

    func testRelativeTimeFormattingHours() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let twoHoursAgo = Date().addingTimeInterval(-7200)
        let isoString = formatter.string(from: twoHoursAgo)

        let result = DateFormatting.relativeTimeString(from: isoString)
        XCTAssertEqual(result, "2h", "2 hours ago should format as '2h'")
    }

    // MARK: - Test: Relative time formatting works for days

    func testRelativeTimeFormattingDays() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let threeDaysAgo = Date().addingTimeInterval(-259200)
        let isoString = formatter.string(from: threeDaysAgo)

        let result = DateFormatting.relativeTimeString(from: isoString)
        XCTAssertEqual(result, "3d", "3 days ago should format as '3d'")
    }

    // MARK: - Test: Tap post calls onPress

    func testTapPostCallsOnPress() throws {
        var pressCalled = false
        let expectation = expectation(description: "onPress called")

        let view = makeView(onPress: {
            pressCalled = true
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // The outermost VStack has an onTapGesture for onPress
        // Find the main content VStack and trigger its tap gesture
        let vStack = try inspected.find(ViewType.VStack.self)
        try vStack.callOnTapGesture()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(pressCalled, "onPress should be called when post is tapped")
    }

    // MARK: - Test: Tap author row calls onPressProfile

    func testTapAuthorRowCallsOnPressProfile() throws {
        let post = MockFeed.makeFeedViewPost(post: MockFeed.makePostView(
            author: MockFeed.makePostAuthor(handle: "alice.bsky.social")
        ))
        var pressedHandle: String?
        let expectation = expectation(description: "onPressProfile called")

        let view = makeView(post: post, onPressProfile: { handle in
            pressedHandle = handle
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // The author row HStack has an onTapGesture that calls onPressProfile
        let authorRow = try inspected.find(ViewType.HStack.self)
        try authorRow.callOnTapGesture()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedHandle, "alice.bsky.social", "Should pass author handle to onPressProfile")
    }

    // MARK: - Test: Like, repost, reply counts display correctly

    func testEngagementCountsDisplayCorrectly() throws {
        let view = makeView(post: MockFeed.postWithCounts)
        let inspected = try view.inspect()

        // Like count: 42
        let likeCount = try inspected.find(text: "42")
        XCTAssertNotNil(likeCount, "Should display like count of 42")

        // Repost count: 7
        let repostCount = try inspected.find(text: "7")
        XCTAssertNotNil(repostCount, "Should display repost count of 7")

        // Reply count: 13
        let replyCount = try inspected.find(text: "13")
        XCTAssertNotNil(replyCount, "Should display reply count of 13")
    }

    // MARK: - Test: Tap like calls onLike

    func testTapLikeCallsOnLike() throws {
        var likeCalled = false
        let expectation = expectation(description: "onLike called")

        let view = makeView(
            post: MockFeed.postWithCounts,
            onLike: {
                likeCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Find the like button - it uses "heart" icon and its count
        // The action bar has reply, repost, like, share buttons
        // Like is the third action button (index 2 in the HStack)
        let actionBar = try inspected.findAll(ViewType.Button.self)
        // The action buttons are: reply (bubble.left), repost (arrow.2.squarepath), like (heart), share (square.and.arrow.up)
        // Like button should have count "42"
        let likeButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "42")) != nil
        })
        try likeButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(likeCalled, "onLike should be called when like button is tapped")
    }

    // MARK: - Test: Tap repost calls onRepost

    func testTapRepostCallsOnRepost() throws {
        var repostCalled = false
        let expectation = expectation(description: "onRepost called")

        let view = makeView(
            post: MockFeed.postWithCounts,
            onRepost: {
                repostCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Repost button has count "7"
        let repostButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "7")) != nil
        })
        try repostButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(repostCalled, "onRepost should be called when repost button is tapped")
    }

    // MARK: - Test: Tap reply calls onReply

    func testTapReplyCallsOnReply() throws {
        var replyCalled = false
        let expectation = expectation(description: "onReply called")

        let view = makeView(
            post: MockFeed.postWithCounts,
            onReply: {
                replyCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Reply button has count "13"
        let replyButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "13")) != nil
        })
        try replyButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(replyCalled, "onReply should be called when reply button is tapped")
    }

    // MARK: - Test: Image embed renders when present

    func testImageEmbedRendersWhenPresent() throws {
        let view = makeView(post: MockFeed.postWithImages)
        let inspected = try view.inspect()

        // The post text should render
        let postText = try inspected.find(text: "Check out these photos!")
        XCTAssertNotNil(postText, "Should render post text with image embed")

        // PostEmbed component should be present (it renders the ImageEmbed)
        // The embed section renders via PostEmbed when post.post.record.embed is non-nil
        let embed = try inspected.find(PostEmbed.self)
        XCTAssertNotNil(embed, "Should render PostEmbed when image embed is present")
    }

    // MARK: - Test: Quote embed renders when present

    func testQuoteEmbedRendersWhenPresent() throws {
        let view = makeView(post: MockFeed.postWithQuote)
        let inspected = try view.inspect()

        // The post text should render
        let postText = try inspected.find(text: "Great post!")
        XCTAssertNotNil(postText, "Should render post text with quote embed")

        // PostEmbed component should be present
        let embed = try inspected.find(PostEmbed.self)
        XCTAssertNotNil(embed, "Should render PostEmbed when quote embed is present")
    }

    // MARK: - Test: External link embed renders when present

    func testExternalLinkEmbedRendersWhenPresent() throws {
        let view = makeView(post: MockFeed.postWithExternalLink)
        let inspected = try view.inspect()

        let postText = try inspected.find(text: "Check out this article")
        XCTAssertNotNil(postText, "Should render post text with external link embed")

        let embed = try inspected.find(PostEmbed.self)
        XCTAssertNotNil(embed, "Should render PostEmbed when external link embed is present")
    }

    // MARK: - Test: Video embed renders when present

    func testVideoEmbedRendersWhenPresent() throws {
        let view = makeView(post: MockFeed.postWithVideo)
        let inspected = try view.inspect()

        let postText = try inspected.find(text: "Watch this video")
        XCTAssertNotNil(postText, "Should render post text with video embed")

        let embed = try inspected.find(PostEmbed.self)
        XCTAssertNotNil(embed, "Should render PostEmbed when video embed is present")
    }

    // MARK: - Test: Post without embed does not render PostEmbed

    func testPostWithoutEmbedDoesNotRenderPostEmbed() throws {
        let post = MockFeed.makeFeedViewPost(post: MockFeed.makePostView(
            record: MockFeed.makePostRecord(text: "Just a text post", embed: nil)
        ))

        let view = makeView(post: post)
        let inspected = try view.inspect()

        // PostEmbed should not be present when there's no embed
        let embeds = try inspected.findAll(PostEmbed.self)
        XCTAssertEqual(embeds.count, 0, "Should not render PostEmbed when no embed is present")
    }

    // MARK: - Test: Tap share calls onShare

    func testTapShareCallsOnShare() throws {
        var shareCalled = false
        let expectation = expectation(description: "onShare called")

        let view = makeView(onShare: {
            shareCalled = true
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // The share button is the last button in the action bar
        // It uses "square.and.arrow.up" icon
        let allButtons = try inspected.findAll(ViewType.Button.self)
        // Share button is the last one in the action bar HStack
        let shareButton = allButtons.last!
        try shareButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(shareCalled, "onShare should be called when share button is tapped")
    }

    // MARK: - Test: Large counts format with K/M suffix

    func testLargeCountsFormatWithSuffix() throws {
        let post = MockFeed.makeFeedViewPost(post: MockFeed.makePostView(
            likeCount: 1500,
            repostCount: 2300000,
            replyCount: 999
        ))

        let view = makeView(post: post)
        let inspected = try view.inspect()

        // 1500 should format as "1.5K"
        let kCount = try inspected.find(text: "1.5K")
        XCTAssertNotNil(kCount, "Should format 1500 as '1.5K'")

        // 2300000 should format as "2.3M"
        let mCount = try inspected.find(text: "2.3M")
        XCTAssertNotNil(mCount, "Should format 2300000 as '2.3M'")

        // 999 should display as plain number
        let plainCount = try inspected.find(text: "999")
        XCTAssertNotNil(plainCount, "Should display 999 as plain number")
    }
}

// MARK: - DateFormatting Unit Tests

class DateFormattingTests: XCTestCase {

    func testParseISO8601WithFractionalSeconds() {
        let date = DateFormatting.parseISO8601("2026-02-20T10:30:00.123Z")
        XCTAssertNotNil(date, "Should parse ISO8601 with fractional seconds")
    }

    func testParseISO8601WithoutFractionalSeconds() {
        let date = DateFormatting.parseISO8601("2026-02-20T10:30:00Z")
        XCTAssertNotNil(date, "Should parse ISO8601 without fractional seconds")
    }

    func testParseISO8601InvalidStringReturnsNil() {
        let date = DateFormatting.parseISO8601("not-a-date")
        XCTAssertNil(date, "Should return nil for invalid date string")
    }

    func testRelativeTimeStringEmptyForInvalidDate() {
        let result = DateFormatting.relativeTimeString(from: "invalid")
        XCTAssertEqual(result, "", "Should return empty string for invalid date")
    }
}
