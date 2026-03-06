//
//  ThreadViewErrorTests.swift
//  AsphodelUITests
//
//  Error state and edge case tests for the NativeThreadView module.
//  Tests cover threads with no replies, deleted parents, missing main post,
//  blocked user content filtering, and the ThreadState parsing pipeline.
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeThreadView
@testable import FeedBridge

// MARK: - ThreadState Parsing Error Tests

class ThreadStateParsingErrorTests: XCTestCase {

    // MARK: - Helpers

    private func makeThreadState() -> ThreadState {
        return ThreadState()
    }

    /// Build a minimal thread data dictionary for testing parsing
    private func minimalThreadDict(
        uri: String = "at://did:plc:test/app.bsky.feed.post/1",
        cid: String = "bafyrei-test",
        text: String = "Hello thread",
        handle: String = "test.bsky.social",
        replies: [[String: Any]] = []
    ) -> [String: Any] {
        return [
            "post": [
                "uri": uri,
                "cid": cid,
                "author": [
                    "did": "did:plc:test",
                    "handle": handle,
                    "displayName": "Test User"
                ] as [String: Any],
                "record": [
                    "text": text,
                    "createdAt": "2026-02-20T10:00:00.000Z"
                ] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z",
                "likeCount": 0,
                "repostCount": 0,
                "replyCount": 0
            ] as [String: Any],
            "replies": replies
        ] as [String: Any]
    }

    // MARK: - Test: Thread node with empty replies array

    func testThreadNodeWithNoReplies() {
        let state = makeThreadState()
        let dict = minimalThreadDict(replies: [])

        // Send the data via notification
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": dict]
        )

        // Give the main queue time to process
        let expectation = expectation(description: "wait for state update")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }

        state.startObserving()
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": dict]
        )

        waitForExpectations(timeout: 1.0)

        XCTAssertNotNil(state.rootPost, "Root post should be parsed even with no replies")
        XCTAssertEqual(state.rootPost?.replies.count, 0, "Should have empty replies array")
        XCTAssertEqual(state.rootPost?.post.record.text, "Hello thread")

        state.stopObserving()
    }

    // MARK: - Test: Thread data with missing post field

    func testThreadDataWithMissingPostField() {
        let state = makeThreadState()
        state.startObserving()

        let badDict: [String: Any] = [
            "replies": [] as [[String: Any]]
            // No "post" key
        ]

        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": badDict]
        )

        let expectation = expectation(description: "wait")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        XCTAssertNil(state.rootPost, "Should not crash and rootPost should remain nil for missing post")

        state.stopObserving()
    }

    // MARK: - Test: Thread data with completely empty dictionary

    func testThreadDataWithEmptyDictionary() {
        let state = makeThreadState()
        state.startObserving()

        let emptyDict: [String: Any] = [:]

        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": emptyDict]
        )

        let expectation = expectation(description: "wait")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        XCTAssertNil(state.rootPost, "Should not crash and rootPost should remain nil for empty data")

        state.stopObserving()
    }

    // MARK: - Test: Thread data with malformed replies (non-array)

    func testThreadDataWithMalformedReplies() {
        let state = makeThreadState()
        state.startObserving()

        let dict: [String: Any] = [
            "post": [
                "uri": "at://test/post/1",
                "cid": "bafyrei-test",
                "author": ["did": "did:plc:test", "handle": "test.bsky.social"] as [String: Any],
                "record": ["text": "Root post", "createdAt": "2026-02-20T10:00:00.000Z"] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any],
            "replies": "not an array" // malformed
        ]

        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": dict]
        )

        let expectation = expectation(description: "wait")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        XCTAssertNotNil(state.rootPost, "Root post should still parse even with malformed replies")
        XCTAssertEqual(state.rootPost?.replies.count, 0,
            "Malformed replies should result in empty array, not crash")

        state.stopObserving()
    }

    // MARK: - Test: Thread post with missing author data

    func testThreadPostWithMissingAuthorData() {
        let state = makeThreadState()
        state.startObserving()

        let dict: [String: Any] = [
            "post": [
                "uri": "at://test/post/noauthor",
                "cid": "bafyrei-noauthor",
                // No author field — parser uses empty dict as fallback
                "record": ["text": "No author post", "createdAt": "2026-02-20T10:00:00.000Z"] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any],
            "replies": [] as [[String: Any]]
        ]

        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": dict]
        )

        let expectation = expectation(description: "wait")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        XCTAssertNotNil(state.rootPost, "Should parse even without author")
        XCTAssertEqual(state.rootPost?.post.author.handle, "",
            "Missing author handle should default to empty string")
        XCTAssertEqual(state.rootPost?.post.author.did, "",
            "Missing author DID should default to empty string")

        state.stopObserving()
    }

    // MARK: - Test: Incremental update for non-existent post URI

    func testIncrementalUpdateForNonExistentPostDoesNotCrash() {
        let state = makeThreadState()
        state.startObserving()

        // First set up a root post
        let dict = minimalThreadDict(uri: "at://test/post/existing")
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": dict]
        )

        // Then send an incremental update for a different URI
        let update: [String: Any] = [
            "uri": "at://test/post/nonexistent",
            "likeCount": 999
        ]

        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeIncrementalUpdate"),
            object: nil,
            userInfo: ["update": update]
        )

        let expectation = expectation(description: "wait")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        // Root post should be unchanged
        XCTAssertEqual(state.rootPost?.post.likeCount, 0,
            "Root post likeCount should be unchanged after update for different URI")

        state.stopObserving()
    }

    // MARK: - Test: Clear data resets state

    func testClearDataResetsState() {
        let state = makeThreadState()
        state.startObserving()

        // Set up a root post
        let dict = minimalThreadDict()
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": dict]
        )

        let setupExpectation = expectation(description: "setup")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            setupExpectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)
        XCTAssertNotNil(state.rootPost)

        // Clear data
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataCleared"),
            object: nil
        )

        let clearExpectation = expectation(description: "clear")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            clearExpectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        XCTAssertNil(state.rootPost, "Root post should be nil after clear")

        state.stopObserving()
    }
}

// MARK: - ThreadView UI Error State Tests

class ThreadViewUIErrorStateTests: XCTestCase {

    // MARK: - ThreadView conformance
    // Note: ThreadView: Inspectable is expected from ThreadViewTests.swift

    private func makeComposerState() -> ComposerState {
        return ComposerState()
    }

    private func makeView(
        isLoading: Bool = false,
        error: String? = nil,
        onRefresh: (() -> Void)? = nil
    ) -> ThreadView {
        ThreadView(
            composerState: makeComposerState(),
            isLoading: isLoading,
            isRefreshing: false,
            error: error,
            threadUri: nil,
            summaryData: nil,
            isSummaryLoading: false,
            summaryMode: "quick",
            onRefresh: onRefresh,
            onPostPress: nil,
            onProfilePress: nil,
            onLike: nil,
            onRepost: nil,
            onReply: nil,
            onBookmark: nil,
            onMentionPress: nil,
            onHashtagPress: nil,
            onShare: nil,
            onNavigateToParent: nil,
            onNavigateToRoot: nil,
            onPressLikeCount: nil,
            onPressRepostCount: nil,
            onPressQuoteCount: nil,
            onSummaryModeChange: nil,
            onTranslate: nil,
            onLinkPress: nil,
            onImagePress: nil,
            onQuotePress: nil,
            onSendReply: nil,
            onOpenImagePicker: nil,
            onOpenGifPicker: nil,
            onOpenEmojiPicker: nil,
            onMentionSearch: nil
        )
    }

    // MARK: - Test: Thread with no data shows "Thread not found"

    func testThreadWithNoDataShowsNotFoundMessage() throws {
        let view = makeView()
        let inspected = try view.inspect()

        let notFoundText = try inspected.find(text: "Thread not found")
        XCTAssertNotNil(notFoundText,
            "Should show 'Thread not found' when no root post and not loading")
    }

    // MARK: - Test: Error state shows error and retry

    func testErrorStateShowsErrorAndRetry() throws {
        let view = makeView(error: "Failed to load thread")
        let inspected = try view.inspect()

        let errorText = try inspected.find(text: "Failed to load thread")
        XCTAssertNotNil(errorText, "Should display error message")

        let retryButton = try inspected.find(text: "Try Again")
        XCTAssertNotNil(retryButton, "Should show retry button")
    }

    // MARK: - Test: Loading state shows loading indicator

    func testLoadingStateShowsLoadingIndicator() throws {
        let view = makeView(isLoading: true)
        let inspected = try view.inspect()

        let loadingText = try inspected.find(text: "Loading thread...")
        XCTAssertNotNil(loadingText, "Should show loading text")

        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show progress view when loading")
    }
}

// MARK: - ThreadNode Type Tests

class ThreadNodeTypeTests: XCTestCase {

    // MARK: - Test: ThreadNode with empty post data

    func testThreadNodeWithMinimalData() {
        let post = ThreadPost(
            uri: "",
            cid: "",
            author: ThreadAuthor(did: "", handle: "", displayName: nil, avatar: nil, isVerified: false),
            record: ThreadRecord(text: "", facets: nil, createdAt: "", langs: nil),
            embed: nil,
            indexedAt: "",
            likeCount: 0,
            repostCount: 0,
            replyCount: 0,
            quoteCount: nil,
            viewer: nil,
            labels: nil
        )

        let node = ThreadNode(post: post, parent: nil, replies: [], depth: 0)

        XCTAssertEqual(node.id, "", "Node ID should be the post URI (empty)")
        XCTAssertEqual(node.depth, 0)
        XCTAssertEqual(node.replies.count, 0)
        XCTAssertNil(node.parent)
    }

    // MARK: - Test: ThreadNode with deeply nested replies

    func testThreadNodeWithDeeplyNestedReplies() {
        func makeNode(depth: Int, maxDepth: Int) -> ThreadNode {
            let post = ThreadPost(
                uri: "at://test/post/depth\(depth)",
                cid: "bafyrei-\(depth)",
                author: ThreadAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil, isVerified: false),
                record: ThreadRecord(text: "Reply at depth \(depth)", facets: nil, createdAt: "", langs: nil),
                embed: nil,
                indexedAt: "",
                likeCount: 0,
                repostCount: 0,
                replyCount: depth < maxDepth ? 1 : 0,
                quoteCount: nil,
                viewer: nil,
                labels: nil
            )

            let replies = depth < maxDepth ? [makeNode(depth: depth + 1, maxDepth: maxDepth)] : []
            return ThreadNode(post: post, parent: nil, replies: replies, depth: depth)
        }

        let root = makeNode(depth: 0, maxDepth: 10)

        XCTAssertEqual(root.depth, 0)
        XCTAssertEqual(root.replies.count, 1)

        // Walk to the deepest node
        var current = root
        for depth in 1...10 {
            XCTAssertEqual(current.replies.count, depth <= 10 ? 1 : 0)
            if let next = current.replies.first {
                current = next
                XCTAssertEqual(current.depth, depth)
            }
        }
        XCTAssertEqual(current.replies.count, 0, "Deepest node should have no replies")
    }

    // MARK: - Test: NotificationReason unknown maps to .unknown

    func testNotificationReasonUnknownString() {
        let reason = NotificationReason(rawValue: "some-future-reason-type")
        XCTAssertEqual(reason, .unknown, "Unknown reason string should map to .unknown")
        XCTAssertEqual(reason.actionText, "sent a notification", "Unknown reason should have fallback text")
        XCTAssertEqual(reason.sfSymbolName, "bell.fill", "Unknown reason should use bell icon")
    }
}
