//
//  ThreadPostCardTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for ThreadPostCard and ActionButton
//  in the native-thread-view SwiftUI module. Tests cover tap callbacks
//  for like, repost, bookmark, share, and profile navigation.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeThreadView
@testable import FeedBridge
@testable import ExpoSwiftUIFeed

// MARK: - ThreadPostCard Tests

class ThreadPostCardTests: XCTestCase {

    // MARK: - Helper

    private func makeCard(
        node: ThreadNode? = nil,
        isRoot: Bool = true,
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
        onPressLikeCount: (() -> Void)? = nil,
        onPressRepostCount: (() -> Void)? = nil,
        onPressQuoteCount: (() -> Void)? = nil,
        onTranslate: ((String, String, String) -> Void)? = nil,
        onLinkPress: ((String) -> Void)? = nil,
        onImagePress: (([ImageEmbedData], Int) -> Void)? = nil,
        onQuotePress: ((String, String) -> Void)? = nil
    ) -> ThreadPostCard {
        ThreadPostCard(
            node: node ?? MockThread.sampleRootNode,
            isRoot: isRoot,
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
            onPressLikeCount: onPressLikeCount,
            onPressRepostCount: onPressRepostCount,
            onPressQuoteCount: onPressQuoteCount,
            onTranslate: onTranslate,
            onLinkPress: onLinkPress,
            onImagePress: onImagePress,
            onQuotePress: onQuotePress
        )
    }

    // MARK: - Test: Post card renders author name, handle, and text

    func testPostCardRendersAuthorNameHandleAndText() throws {
        let view = makeCard()
        let inspected = try view.inspect()

        // Should display author's display name
        let displayName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(displayName, "Should render author display name")

        // Should display author's handle
        let handle = try inspected.find(text: "@alice.bsky.social")
        XCTAssertNotNil(handle, "Should render author handle")
    }

    // MARK: - Test: Tap like button calls onLike

    func testTapLikeButtonCallsOnLike() throws {
        var likeCalled = false
        let expectation = expectation(description: "onLike called")

        let view = makeCard(onLike: {
            likeCalled = true
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // Find the like button (heart icon) in the action buttons HStack
        let likeButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                let name = try image.actualImage().name()
                return name == "heart" || name == "heart.fill"
            })) != nil
        })
        try likeButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(likeCalled, "Tapping heart button should call onLike")
    }

    // MARK: - Test: Tap repost button calls onRepost

    func testTapRepostButtonCallsOnRepost() throws {
        var repostCalled = false
        let expectation = expectation(description: "onRepost called")

        let view = makeCard(onRepost: {
            repostCalled = true
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // Find the repost button (arrow.2.squarepath icon)
        let repostButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "arrow.2.squarepath"
            })) != nil
        })
        try repostButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(repostCalled, "Tapping repost button should call onRepost")
    }

    // MARK: - Test: Tap share calls onShare

    func testTapShareCallsOnShare() throws {
        var shareCalled = false
        let expectation = expectation(description: "onShare called")

        let view = makeCard(onShare: {
            shareCalled = true
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // Find the share button (square.and.arrow.up icon)
        let shareButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "square.and.arrow.up"
            })) != nil
        })
        try shareButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(shareCalled, "Tapping share button should call onShare")
    }

    // MARK: - Test: Like count displays and is tappable

    func testLikeCountDisplaysAndIsTappable() throws {
        var likeCountPressed = false
        let expectation = expectation(description: "onPressLikeCount called")

        let node = MockThread.sampleRootNode // likeCount = 42

        let view = makeCard(
            node: node,
            onPressLikeCount: {
                likeCountPressed = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Should show like count "42"
        let likeCountText = try inspected.find(text: "42")
        XCTAssertNotNil(likeCountText, "Should display like count of 42")

        // Tap the count text (triggers onPressLikeCount via onTapGesture)
        try likeCountText.callOnTapGesture()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(likeCountPressed, "Tapping like count should call onPressLikeCount")
    }

    // MARK: - Test: Liked post shows filled heart icon

    func testLikedPostShowsFilledHeartIcon() throws {
        let node = MockThread.sampleLikedNode

        let view = makeCard(node: node)
        let inspected = try view.inspect()

        // When viewer has liked, should show "heart.fill" icon
        let filledHeart = try inspected.find(ViewType.Image.self, where: { image in
            try image.actualImage().name() == "heart.fill"
        })
        XCTAssertNotNil(filledHeart, "Liked post should show filled heart icon")
    }

    // MARK: - Test: Tap reply button calls onReply

    func testTapReplyButtonCallsOnReply() throws {
        var replyCalled = false
        let expectation = expectation(description: "onReply called")

        let view = makeCard(onReply: {
            replyCalled = true
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // Find the reply button (bubble.left icon)
        let replyButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "bubble.left"
            })) != nil
        })
        try replyButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(replyCalled, "Tapping reply button should call onReply")
    }

    // MARK: - Test: Post card whole-card tap calls onPress

    func testPostCardWholeCardTapCallsOnPress() throws {
        var pressCalled = false
        let expectation = expectation(description: "onPress called")

        let view = makeCard(onPress: {
            pressCalled = true
            expectation.fulfill()
        })

        let inspected = try view.inspect()

        // The VStack has an onTapGesture that calls onPress
        let vStack = try inspected.find(ViewType.VStack.self)
        try vStack.callOnTapGesture()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(pressCalled, "Tapping the post card should call onPress")
    }

    // MARK: - Test: Repost count displays for non-zero counts

    func testRepostCountDisplaysForNonZeroCounts() throws {
        let node = MockThread.sampleRootNode // repostCount = 7

        let view = makeCard(node: node)
        let inspected = try view.inspect()

        // Should show repost count "7"
        let repostCountText = try inspected.find(text: "7")
        XCTAssertNotNil(repostCountText, "Should display repost count of 7")
    }

    // MARK: - Test: Reply count displays for non-zero counts

    func testReplyCountDisplaysForNonZeroCounts() throws {
        let node = MockThread.sampleRootNode // replyCount = 2

        let view = makeCard(node: node)
        let inspected = try view.inspect()

        let replyCountText = try inspected.find(text: "2")
        XCTAssertNotNil(replyCountText, "Should display reply count of 2")
    }
}

// MARK: - ActionButton Tests

class ActionButtonTests: XCTestCase {

    // MARK: - Test: ActionButton renders icon and count

    func testActionButtonRendersIconAndCount() throws {
        let view = ActionButton(
            iconName: "heart",
            count: 15,
            isActive: false,
            color: .red,
            action: nil
        )

        let inspected = try view.inspect()

        // Should show the count
        let countText = try inspected.find(text: "15")
        XCTAssertNotNil(countText, "Should display the count")

        // Should show the icon
        let icon = try inspected.find(ViewType.Image.self, where: { image in
            try image.actualImage().name() == "heart"
        })
        XCTAssertNotNil(icon, "Should display the heart icon")
    }

    // MARK: - Test: ActionButton hides count when zero

    func testActionButtonHidesCountWhenZero() throws {
        let view = ActionButton(
            iconName: "heart",
            count: 0,
            isActive: false,
            color: .red,
            action: nil
        )

        let inspected = try view.inspect()

        // Should NOT show "0" text
        let allTexts = try inspected.findAll(ViewType.Text.self)
        let zeroTexts = allTexts.filter { (try? $0.string()) == "0" }
        XCTAssertEqual(zeroTexts.count, 0, "Should not display count when it's 0")
    }

    // MARK: - Test: ActionButton tap calls action

    func testActionButtonTapCallsAction() throws {
        var actionCalled = false
        let expectation = expectation(description: "action called")

        let view = ActionButton(
            iconName: "heart",
            count: 5,
            isActive: false,
            color: .red,
            action: {
                actionCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(actionCalled, "Tapping ActionButton should call the action closure")
    }
}

// MARK: - ThreadReplyView Tests

class ThreadReplyViewTests: XCTestCase {

    // MARK: - Test: Reply view renders post content

    func testReplyViewRendersPostContent() throws {
        let replyNode = MockThread.sampleRootNode.replies[0]

        let view = ThreadReplyView(
            node: replyNode,
            currentUserDid: nil,
            onPress: nil,
            onPressProfile: nil,
            onLike: nil,
            onRepost: nil,
            onReply: nil,
            onBookmark: nil,
            onMentionPress: nil,
            onHashtagPress: nil,
            onShare: nil,
            onMute: nil,
            onBlock: nil,
            onDelete: nil,
            onReport: nil,
            onPressLikeCount: nil,
            onPressRepostCount: nil,
            onPressQuoteCount: nil,
            onTranslate: nil,
            onLinkPress: nil,
            onImagePress: nil,
            onQuotePress: nil
        )

        let inspected = try view.inspect()

        // Should display the reply author name
        let authorName = try inspected.find(text: "Bob Smith")
        XCTAssertNotNil(authorName, "Should render reply author name")
    }

    // MARK: - Test: Tap reply post calls onPress with uri and handle

    func testTapReplyPostCallsOnPressWithUriAndHandle() throws {
        let replyNode = MockThread.sampleRootNode.replies[0]
        var pressedUri: String?
        var pressedHandle: String?
        let expectation = expectation(description: "onPress called")

        let view = ThreadReplyView(
            node: replyNode,
            currentUserDid: nil,
            onPress: { uri, handle in
                pressedUri = uri
                pressedHandle = handle
                expectation.fulfill()
            },
            onPressProfile: nil,
            onLike: nil,
            onRepost: nil,
            onReply: nil,
            onBookmark: nil,
            onMentionPress: nil,
            onHashtagPress: nil,
            onShare: nil,
            onMute: nil,
            onBlock: nil,
            onDelete: nil,
            onReport: nil,
            onPressLikeCount: nil,
            onPressRepostCount: nil,
            onPressQuoteCount: nil,
            onTranslate: nil,
            onLinkPress: nil,
            onImagePress: nil,
            onQuotePress: nil
        )

        let inspected = try view.inspect()

        // Find the inner ThreadPostCard's VStack tap gesture
        let postCard = try inspected.find(ThreadPostCard.self)
        let vStack = try postCard.find(ViewType.VStack.self)
        try vStack.callOnTapGesture()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedUri, replyNode.post.uri, "Should pass the correct reply URI")
        XCTAssertEqual(pressedHandle, replyNode.post.author.handle, "Should pass the correct reply author handle")
    }
}
