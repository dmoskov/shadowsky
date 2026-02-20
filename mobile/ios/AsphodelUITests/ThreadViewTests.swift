//
//  ThreadViewTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for ThreadView, ThreadSummaryView,
//  and PostTranslationView in the native-thread-view SwiftUI module.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeThreadView
@testable import FeedBridge
@testable import ExpoSwiftUIFeed

// MARK: - ViewInspector Conformance

extension ThreadView: Inspectable {}
extension ThreadPostCard: Inspectable {}
extension ThreadReplyView: Inspectable {}
extension ThreadSummaryView: Inspectable {}
extension ThreadSummaryLoadingView: Inspectable {}
extension PostTranslationView: Inspectable {}
extension ActionButton: Inspectable {}
extension MentionSuggestionsView: Inspectable {}
extension ComposerToolbarView: Inspectable {}
extension ThreadReplyComposer: Inspectable {}
extension AutoGrowingTextEditor: Inspectable {}

// MARK: - ThreadView Tests

class ThreadViewTests: XCTestCase {

    // MARK: - Test: Thread renders with main post and replies

    func testThreadRendersWithMainPostAndReplies() throws {
        let composerState = ComposerState()

        // Post thread data notification to populate ThreadState
        let rootNode = MockThread.sampleRootNode
        let threadData = threadNodeToDict(rootNode)
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadBridgeDataUpdated"),
            object: nil,
            userInfo: ["threadData": threadData]
        )

        let view = ThreadView(
            composerState: composerState,
            isLoading: false,
            isRefreshing: false,
            error: nil,
            threadUri: rootNode.post.uri,
            summaryData: nil,
            isSummaryLoading: false,
            summaryMode: "quick",
            onRefresh: nil,
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

        let inspected = try view.inspect()

        // The view should contain the VStack with thread content and composer
        let vStack = try inspected.find(ViewType.VStack.self)
        XCTAssertNotNil(vStack, "ThreadView should render its main VStack container")
    }

    // MARK: - Test: Loading state shows spinner

    func testLoadingStateShowsSpinner() throws {
        let composerState = ComposerState()

        let view = ThreadView(
            composerState: composerState,
            isLoading: true,
            isRefreshing: false,
            error: nil,
            threadUri: "at://did:plc:test/app.bsky.feed.post/test",
            summaryData: nil,
            isSummaryLoading: false,
            summaryMode: "quick",
            onRefresh: nil,
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

        let inspected = try view.inspect()

        // When loading with no data, should show loading view with ProgressView and text
        let loadingText = try inspected.find(text: "Loading thread...")
        XCTAssertNotNil(loadingText, "Should show 'Loading thread...' when isLoading is true")

        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show ProgressView spinner when loading")
    }

    // MARK: - Test: Error state shows error message with retry

    func testErrorStateShowsErrorMessageWithRetry() throws {
        let composerState = ComposerState()
        var refreshCalled = false
        let expectation = expectation(description: "onRefresh called")

        let view = ThreadView(
            composerState: composerState,
            isLoading: false,
            isRefreshing: false,
            error: "Network connection failed",
            threadUri: "at://did:plc:test/app.bsky.feed.post/test",
            summaryData: nil,
            isSummaryLoading: false,
            summaryMode: "quick",
            onRefresh: {
                refreshCalled = true
                expectation.fulfill()
            },
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

        let inspected = try view.inspect()

        // Should show error message
        let errorText = try inspected.find(text: "Network connection failed")
        XCTAssertNotNil(errorText, "Should display the error message")

        // Should show retry button
        let retryButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Try Again")) != nil
        })
        try retryButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(refreshCalled, "Tapping 'Try Again' should call onRefresh")
    }

    // MARK: - Test: Empty thread shows not found message

    func testEmptyThreadShowsNotFoundMessage() throws {
        let composerState = ComposerState()

        let view = ThreadView(
            composerState: composerState,
            isLoading: false,
            isRefreshing: false,
            error: nil,
            threadUri: "at://did:plc:test/app.bsky.feed.post/nonexistent",
            summaryData: nil,
            isSummaryLoading: false,
            summaryMode: "quick",
            onRefresh: nil,
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

        let inspected = try view.inspect()

        // When no data, no loading, and no error, should show empty view
        let emptyText = try inspected.find(text: "Thread not found")
        XCTAssertNotNil(emptyText, "Should show 'Thread not found' when no data is available")
    }

    // MARK: - Helpers

    /// Convert a ThreadNode to a dictionary (simulates bridge data format)
    private func threadNodeToDict(_ node: ThreadNode) -> [String: Any] {
        var dict: [String: Any] = [:]
        dict["post"] = [
            "uri": node.post.uri,
            "cid": node.post.cid,
            "author": [
                "did": node.post.author.did,
                "handle": node.post.author.handle,
                "displayName": node.post.author.displayName as Any,
                "avatar": node.post.author.avatar as Any
            ],
            "record": [
                "text": node.post.record.text,
                "createdAt": node.post.record.createdAt,
                "langs": node.post.record.langs as Any
            ],
            "indexedAt": node.post.indexedAt,
            "likeCount": node.post.likeCount,
            "repostCount": node.post.repostCount,
            "replyCount": node.post.replyCount,
            "quoteCount": node.post.quoteCount as Any
        ] as [String: Any]

        if let viewer = node.post.viewer {
            dict["viewer"] = [
                "like": viewer.like as Any,
                "repost": viewer.repost as Any
            ]
        }

        if !node.replies.isEmpty {
            dict["replies"] = node.replies.map { threadNodeToDict($0) }
        }

        return dict
    }
}

// MARK: - ThreadSummaryView Tests

class ThreadSummaryViewTests: XCTestCase {

    // MARK: - Test: Summary section renders when data present

    func testSummarySectionRendersWhenDataPresent() throws {
        let summaryData = MockThread.makeSummaryData()

        let view = ThreadSummaryView(
            summaryData: summaryData,
            summaryMode: "quick",
            onToggleMode: nil
        )

        let inspected = try view.inspect()

        // Should show "AI Summary" label
        let aiLabel = try inspected.find(text: "AI Summary")
        XCTAssertNotNil(aiLabel, "Should display 'AI Summary' label")

        // Should show the summary text
        let summaryText = try inspected.find(text: "This thread discusses SwiftUI testing patterns.")
        XCTAssertNotNil(summaryText, "Should display the summary text")
    }

    // MARK: - Test: Loading state shows spinner

    func testSummaryLoadingStateShowsSpinner() throws {
        let view = ThreadSummaryLoadingView()
        let inspected = try view.inspect()

        let loadingText = try inspected.find(text: "Generating summary...")
        XCTAssertNotNil(loadingText, "Should show 'Generating summary...' text")

        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show ProgressView while loading")
    }

    // MARK: - Test: Quick vs full mode shows different detail levels

    func testQuickVsFullModeToggle() throws {
        var toggledMode: String?
        let expectation = expectation(description: "onToggleMode called")

        let summaryData = MockThread.makeSummaryData()

        let view = ThreadSummaryView(
            summaryData: summaryData,
            summaryMode: "quick",
            onToggleMode: { mode in
                toggledMode = mode
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Should show Quick and Full mode buttons
        let quickText = try inspected.find(text: "Quick")
        XCTAssertNotNil(quickText, "Should show 'Quick' mode button")

        let fullText = try inspected.find(text: "Full")
        XCTAssertNotNil(fullText, "Should show 'Full' mode button")

        // Tap "Full" to switch mode
        let fullButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Full")) != nil
        })
        try fullButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(toggledMode, "full", "Tapping 'Full' should call onToggleMode with 'full'")
    }

    // MARK: - Test: Comprehensive summary shows highlights and engagement

    func testComprehensiveSummaryShowsHighlights() throws {
        let summaryData = MockThread.sampleComprehensiveSummary

        let view = ThreadSummaryView(
            summaryData: summaryData,
            summaryMode: "full",
            onToggleMode: nil
        )

        let inspected = try view.inspect()

        // Should show "NOTABLE DISCUSSIONS" section
        let notableText = try inspected.find(text: "NOTABLE DISCUSSIONS")
        XCTAssertNotNil(notableText, "Comprehensive summary should show 'NOTABLE DISCUSSIONS'")

        // Should show highlighted sub-thread authors
        let bobHighlight = try inspected.find(text: "@bob.bsky.social")
        XCTAssertNotNil(bobHighlight, "Should show highlighted author handle")

        // Should show total engagement for detailed+ summaries
        let engagementText = try inspected.find(text: "250 total interactions")
        XCTAssertNotNil(engagementText, "Should show total engagement count")
    }

    // MARK: - Test: Cached indicator shows when summary is cached

    func testCachedIndicatorShows() throws {
        let summaryData = MockThread.makeSummaryData(cached: true)

        let view = ThreadSummaryView(
            summaryData: summaryData,
            summaryMode: "quick",
            onToggleMode: nil
        )

        let inspected = try view.inspect()

        let cachedText = try inspected.find(text: " cached")
        XCTAssertNotNil(cachedText, "Should show 'cached' indicator when summary is cached")
    }

    // MARK: - Test: Post count and participants show in metadata

    func testPostCountAndParticipantsShow() throws {
        let summaryData = MockThread.makeSummaryData(postCount: 12, authors: ["a", "b", "c"])

        let view = ThreadSummaryView(
            summaryData: summaryData,
            summaryMode: "quick",
            onToggleMode: nil
        )

        let inspected = try view.inspect()

        let postCountText = try inspected.find(text: " \u{2022} 12 posts")
        XCTAssertNotNil(postCountText, "Should show post count in metadata")

        let participantsText = try inspected.find(text: ", 3 participants")
        XCTAssertNotNil(participantsText, "Should show participant count in metadata")
    }
}

// MARK: - PostTranslationView Tests

class PostTranslationViewTests: XCTestCase {

    override func setUp() {
        super.setUp()
        // Reset the singleton translation state before each test
        // Post a clear notification for any stale state
    }

    // MARK: - Test: Translate button appears for non-English posts

    func testTranslateButtonAppearsForNonEnglishPosts() throws {
        let node = MockThread.sampleForeignLanguageNode

        let view = PostTranslationView(
            postUri: node.post.uri,
            postText: node.post.record.text,
            postLangs: node.post.record.langs,
            onTranslate: nil
        )

        let inspected = try view.inspect()

        // Should show "Translate from French" button in idle state
        let translateButton = try inspected.find(text: "Translate from French")
        XCTAssertNotNil(translateButton, "Should show translate button for French posts")
    }

    // MARK: - Test: Tap translate triggers translation callback

    func testTapTranslateTriggersCallback() throws {
        var translatedUri: String?
        var translatedText: String?
        var translatedLang: String?
        let expectation = expectation(description: "onTranslate called")

        let node = MockThread.sampleForeignLanguageNode

        let view = PostTranslationView(
            postUri: node.post.uri,
            postText: node.post.record.text,
            postLangs: node.post.record.langs,
            onTranslate: { uri, text, lang in
                translatedUri = uri
                translatedText = text
                translatedLang = lang
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Tap the translate button
        let translateButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Translate from French")) != nil
        })
        try translateButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(translatedUri, node.post.uri, "Should pass the correct post URI")
        XCTAssertEqual(translatedText, "Bonjour le monde!", "Should pass the post text")
        XCTAssertEqual(translatedLang, "fr", "Should pass the source language code")
    }

    // MARK: - Test: Translated text displays after completion

    func testTranslatedTextDisplaysAfterCompletion() throws {
        let postUri = "at://did:plc:france/app.bsky.feed.post/trans1"

        // Simulate translation completion via notification
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadTranslationResult"),
            object: nil,
            userInfo: [
                "postUri": postUri,
                "translatedText": "Hello world!",
                "sourceLang": "fr"
            ]
        )

        let view = PostTranslationView(
            postUri: postUri,
            postText: "Bonjour le monde!",
            postLangs: ["fr"],
            onTranslate: nil
        )

        let inspected = try view.inspect()

        // After translation, should show the translated text
        let translatedText = try inspected.find(text: "Hello world!")
        XCTAssertNotNil(translatedText, "Should display translated text after completion")

        // Should show "Show original" toggle
        let showOriginal = try inspected.find(text: "Show original")
        XCTAssertNotNil(showOriginal, "Should show 'Show original' toggle after translation")
    }

    // MARK: - Test: Toggle back to original text works

    func testToggleBackToOriginalTextWorks() throws {
        let postUri = "at://did:plc:france/app.bsky.feed.post/toggle1"

        // Set up translated state
        NotificationCenter.default.post(
            name: NSNotification.Name("ThreadTranslationResult"),
            object: nil,
            userInfo: [
                "postUri": postUri,
                "translatedText": "Hello world!",
                "sourceLang": "fr"
            ]
        )

        let view = PostTranslationView(
            postUri: postUri,
            postText: "Bonjour le monde!",
            postLangs: ["fr"],
            onTranslate: nil
        )

        let inspected = try view.inspect()

        // Find the toggle button ("Show original") and tap it
        let toggleButton = try inspected.find(ViewType.Button.self, where: { button in
            let text = try? button.find(text: "Show original")
            let text2 = try? button.find(text: "Show translation")
            return text != nil || text2 != nil
        })
        try toggleButton.tap()

        // After toggling, PostTranslationManager should flip the showing state
        let manager = PostTranslationManager.shared
        // The toggle should have been called - verify the state changed
        let isShowing = manager.isShowingTranslation(for: postUri)
        // After one toggle from showing=true -> showing=false
        XCTAssertFalse(isShowing, "After toggling, translation should be hidden")
    }
}

// MARK: - LanguageUtils Unit Tests

class LanguageUtilsTests: XCTestCase {

    func testNeedsTranslationReturnsFalseForDeviceLanguage() {
        // Device language is typically "en" in test environments
        let result = LanguageUtils.needsTranslation(postLangs: ["en"])
        XCTAssertFalse(result, "Should not need translation for English posts on English device")
    }

    func testNeedsTranslationReturnsTrueForForeignLanguage() {
        let result = LanguageUtils.needsTranslation(postLangs: ["fr"])
        XCTAssertTrue(result, "Should need translation for French posts on English device")
    }

    func testNeedsTranslationReturnsFalseForNilLangs() {
        let result = LanguageUtils.needsTranslation(postLangs: nil)
        XCTAssertFalse(result, "Should not need translation when langs is nil")
    }

    func testNeedsTranslationReturnsFalseForEmptyLangs() {
        let result = LanguageUtils.needsTranslation(postLangs: [])
        XCTAssertFalse(result, "Should not need translation when langs is empty")
    }

    func testLanguageNameReturnsCorrectName() {
        XCTAssertEqual(LanguageUtils.languageName(for: "en"), "English")
        XCTAssertEqual(LanguageUtils.languageName(for: "fr"), "French")
        XCTAssertEqual(LanguageUtils.languageName(for: "ja"), "Japanese")
        XCTAssertEqual(LanguageUtils.languageName(for: "zh"), "Chinese")
    }

    func testLanguageNameHandlesRegionCodes() {
        XCTAssertEqual(LanguageUtils.languageName(for: "en-US"), "English")
        XCTAssertEqual(LanguageUtils.languageName(for: "fr-FR"), "French")
        XCTAssertEqual(LanguageUtils.languageName(for: "pt-BR"), "Portuguese")
    }

    func testLanguageNameFallsBackToUppercaseCode() {
        XCTAssertEqual(LanguageUtils.languageName(for: "xx"), "XX")
    }
}
