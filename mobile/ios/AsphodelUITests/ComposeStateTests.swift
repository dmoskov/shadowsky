//
//  ComposeStateTests.swift
//  AsphodelUITests
//
//  Unit tests for NativeComposeState logic, computed properties, and mention detection.
//

import XCTest
@testable import NativeCompose

// MARK: - ComposeStateTests

class ComposeStateTests: XCTestCase {

    // MARK: - remainingCharacters

    func testRemainingCharactersWithEmptyText() {
        let state = NativeComposeState()
        XCTAssertEqual(state.remainingCharacters, 300,
            "Empty text should leave all 300 characters remaining")
    }

    func testRemainingCharactersWith100CharText() {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 100)
        XCTAssertEqual(state.remainingCharacters, 200,
            "100 characters of text should leave 200 remaining")
    }

    func testRemainingCharactersAtExactLimit() {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 300)
        XCTAssertEqual(state.remainingCharacters, 0,
            "Exactly 300 characters should leave 0 remaining")
    }

    func testRemainingCharactersOverLimit() {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 301)
        XCTAssertEqual(state.remainingCharacters, -1,
            "301 characters should show -1 remaining")
    }

    // MARK: - isOverLimit

    func testIsOverLimitFalseAtExactLimit() {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 300)
        XCTAssertFalse(state.isOverLimit,
            "Exactly 300 characters should not be over limit")
    }

    func testIsOverLimitTrueWhenExceedingLimit() {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 301)
        XCTAssertTrue(state.isOverLimit,
            "301 characters should be over limit")
    }

    func testIsOverLimitFalseForEmptyText() {
        let state = NativeComposeState()
        XCTAssertFalse(state.isOverLimit,
            "Empty text should not be over limit")
    }

    // MARK: - hasContent

    func testHasContentReturnsFalseForEmptyState() {
        let state = NativeComposeState()
        XCTAssertFalse(state.hasContent,
            "Empty state should have no content")
    }

    func testHasContentReturnsFalseForWhitespaceOnlyText() {
        let state = NativeComposeState()
        state.text = "   \n\t  "
        XCTAssertFalse(state.hasContent,
            "Whitespace-only text should not count as content")
    }

    func testHasContentReturnsTrueWithTrimmedText() {
        let state = NativeComposeState()
        state.text = "Hello world"
        XCTAssertTrue(state.hasContent,
            "Non-whitespace text should count as content")
    }

    func testHasContentReturnsTrueWithMediaOnly() {
        let state = NativeComposeState()
        state.text = ""
        state.mediaAttachments = [MockCompose.makeMediaAttachment(id: "m1")]
        XCTAssertTrue(state.hasContent,
            "Media attachment alone should count as content")
    }

    func testHasContentInThreadModeReturnsTrueWhenAnyPostHasContent() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.threadPosts = [
            ComposeThreadPost(text: ""),
            ComposeThreadPost(text: "Some text"),
            ComposeThreadPost(text: ""),
        ]
        XCTAssertTrue(state.hasContent,
            "Thread mode should have content when any thread post has text")
    }

    func testHasContentInThreadModeReturnsFalseWhenAllPostsEmpty() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.threadPosts = [
            ComposeThreadPost(text: ""),
            ComposeThreadPost(text: "  \n  "),
        ]
        XCTAssertFalse(state.hasContent,
            "Thread mode should have no content when all posts are empty/whitespace")
    }

    func testHasContentInThreadModeReturnsTrueWhenPostHasImages() {
        let state = NativeComposeState()
        state.isThreadMode = true
        let attachment = MockCompose.makeMediaAttachment(id: "m1")
        state.threadPosts = [
            ComposeThreadPost(text: "", images: [attachment]),
        ]
        XCTAssertTrue(state.hasContent,
            "Thread mode should have content when a thread post has images")
    }

    // MARK: - canPost

    func testCanPostReturnsFalseWhenIsPostingTrue() {
        let state = NativeComposeState()
        state.text = "Hello"
        state.isPosting = true
        XCTAssertFalse(state.canPost,
            "canPost should be false when isPosting is true")
    }

    func testCanPostReturnsFalseWhenIsUploadingTrue() {
        let state = NativeComposeState()
        state.text = "Hello"
        state.isUploading = true
        XCTAssertFalse(state.canPost,
            "canPost should be false when isUploading is true")
    }

    func testCanPostReturnsFalseWhenIsOfflineTrue() {
        let state = NativeComposeState()
        state.text = "Hello"
        state.isOffline = true
        XCTAssertFalse(state.canPost,
            "canPost should be false when isOffline is true")
    }

    func testCanPostReturnsFalseWhenOverCharacterLimit() {
        let state = NativeComposeState()
        state.text = String(repeating: "x", count: 301)
        XCTAssertFalse(state.canPost,
            "canPost should be false when text exceeds 300 characters")
    }

    func testCanPostReturnsTrueForValidStateWithContent() {
        let state = NativeComposeState()
        state.text = "A valid post"
        XCTAssertTrue(state.canPost,
            "canPost should be true for valid state with text content")
    }

    func testCanPostReturnsTrueWithMediaOnly() {
        let state = NativeComposeState()
        state.text = ""
        state.mediaAttachments = [MockCompose.makeMediaAttachment(id: "m1")]
        XCTAssertTrue(state.canPost,
            "canPost should be true when media is attached even without text")
    }

    func testCanPostInThreadModeRequiresContentAndWithinLimit() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.threadPosts = [
            ComposeThreadPost(text: "First post"),
            ComposeThreadPost(text: "Second post"),
        ]
        XCTAssertTrue(state.canPost,
            "canPost in thread mode should be true when posts have content within limit")
    }

    func testCanPostInThreadModeReturnsFalseWhenPostOverLimit() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.threadPosts = [
            ComposeThreadPost(text: "Short"),
            ComposeThreadPost(text: String(repeating: "x", count: 301)),
        ]
        XCTAssertFalse(state.canPost,
            "canPost in thread mode should be false when any post exceeds character limit")
    }

    func testCanPostInThreadModeReturnsFalseWhenAllPostsEmpty() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.threadPosts = [
            ComposeThreadPost(text: ""),
            ComposeThreadPost(text: ""),
        ]
        XCTAssertFalse(state.canPost,
            "canPost in thread mode should be false when no posts have content")
    }

    // MARK: - detectMention

    func testDetectMentionFindsAtEndOfText() {
        let state = NativeComposeState()
        state.detectMention(in: "Hello @alice")
        XCTAssertEqual(state.mentionQuery, "alice",
            "Should detect 'alice' as the mention query")
        XCTAssertTrue(state.isShowingMentions,
            "Should show mention suggestions")
        XCTAssertEqual(state.mentionStartIndex, 6,
            "mentionStartIndex should be at the '@' position")
    }

    func testDetectMentionWithAtPrecededBySpace() {
        let state = NativeComposeState()
        state.detectMention(in: "Hey there @bob")
        XCTAssertEqual(state.mentionQuery, "bob",
            "Should detect 'bob' when @ is preceded by a space")
        XCTAssertTrue(state.isShowingMentions)
    }

    func testDetectMentionClearsMentionQueryWhenNoActiveMention() {
        let state = NativeComposeState()

        // First set up a mention
        state.detectMention(in: "Hello @alice")
        XCTAssertNotNil(state.mentionQuery)

        // Then type text without an active mention
        state.detectMention(in: "Hello ")
        XCTAssertNil(state.mentionQuery,
            "Should clear mentionQuery when no active mention detected")
        XCTAssertFalse(state.isShowingMentions,
            "Should hide mention suggestions")
    }

    func testDetectMentionIgnoresAtInMiddleOfWord() {
        let state = NativeComposeState()
        state.detectMention(in: "email@test")
        XCTAssertNil(state.mentionQuery,
            "Should not detect mention when @ is in the middle of a word")
        XCTAssertFalse(state.isShowingMentions)
    }

    func testDetectMentionAtStartOfText() {
        let state = NativeComposeState()
        state.detectMention(in: "@alice")
        XCTAssertEqual(state.mentionQuery, "alice",
            "Should detect mention at the very start of text")
        XCTAssertEqual(state.mentionStartIndex, 0,
            "mentionStartIndex should be 0 when @ is at start")
        XCTAssertTrue(state.isShowingMentions)
    }

    func testDetectMentionClearsWhenJustAtSign() {
        let state = NativeComposeState()
        state.detectMention(in: "Hello @")
        XCTAssertNil(state.mentionQuery,
            "Should not set mentionQuery for bare @ with no query text")
        XCTAssertFalse(state.isShowingMentions)
    }

    // MARK: - insertMention

    func testInsertMentionReplacesFromMentionStartIndex() {
        let state = NativeComposeState()
        state.text = "Hello @ali"
        state.mentionStartIndex = 6 // Position of @

        let suggestion = MockCompose.makeMentionSuggestion(
            id: "did:plc:alice1",
            handle: "alice.bsky.social",
            displayName: "Alice"
        )
        state.insertMention(suggestion)

        XCTAssertEqual(state.text, "Hello @alice.bsky.social ",
            "Should replace @query with @handle followed by a space")
        XCTAssertNil(state.mentionQuery,
            "mentionQuery should be cleared after insertion")
        XCTAssertFalse(state.isShowingMentions,
            "Should hide mentions after insertion")
    }

    func testInsertMentionAtStartOfText() {
        let state = NativeComposeState()
        state.text = "@bo"
        state.mentionStartIndex = 0

        let suggestion = MockCompose.makeMentionSuggestion(
            id: "did:plc:bob1",
            handle: "bob.bsky.social"
        )
        state.insertMention(suggestion)

        XCTAssertEqual(state.text, "@bob.bsky.social ",
            "Should replace mention at start of text correctly")
    }

    // MARK: - toggleThreadMode

    func testToggleThreadModeMovesTextToFirstThreadPost() {
        let state = NativeComposeState()
        state.text = "My post content"

        state.toggleThreadMode()

        XCTAssertTrue(state.isThreadMode, "Should be in thread mode")
        XCTAssertEqual(state.text, "",
            "Main text should be cleared when entering thread mode")
        XCTAssertEqual(state.threadPosts.first?.text, "My post content",
            "First thread post should contain the original text")
    }

    func testToggleThreadModeBackMovesFirstPostTextBack() {
        let state = NativeComposeState()
        state.text = "Original text"

        // Enter thread mode
        state.toggleThreadMode()
        XCTAssertTrue(state.isThreadMode)

        // Exit thread mode
        state.toggleThreadMode()
        XCTAssertFalse(state.isThreadMode, "Should be back in single-post mode")
        XCTAssertEqual(state.text, "Original text",
            "Text should be restored from the first thread post")
        XCTAssertEqual(state.threadPosts.count, 1,
            "Thread posts should be reset to a single empty post")
    }

    func testToggleThreadModePreservesEditedFirstPost() {
        let state = NativeComposeState()
        state.text = "Initial"

        state.toggleThreadMode()
        state.threadPosts[0].text = "Edited in thread"

        state.toggleThreadMode()
        XCTAssertEqual(state.text, "Edited in thread",
            "Should restore the edited first thread post text when exiting thread mode")
    }

    // MARK: - addThreadPost

    func testAddThreadPostAppends() {
        let state = NativeComposeState()
        state.isThreadMode = true
        XCTAssertEqual(state.threadPosts.count, 1)

        state.addThreadPost()
        XCTAssertEqual(state.threadPosts.count, 2,
            "Should append a new thread post")

        state.addThreadPost()
        XCTAssertEqual(state.threadPosts.count, 3,
            "Should append another thread post")
    }

    func testAddThreadPostCreatesEmptyPost() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.addThreadPost()

        let lastPost = state.threadPosts.last
        XCTAssertNotNil(lastPost)
        XCTAssertEqual(lastPost?.text, "",
            "Newly added thread post should have empty text")
        XCTAssertTrue(lastPost?.images.isEmpty ?? false,
            "Newly added thread post should have no images")
    }

    // MARK: - removeThreadPost

    func testRemoveThreadPostGuardsMinimumCountOfOne() {
        let state = NativeComposeState()
        state.isThreadMode = true
        XCTAssertEqual(state.threadPosts.count, 1)

        state.removeThreadPost(at: 0)
        XCTAssertEqual(state.threadPosts.count, 1,
            "Should not remove the last remaining thread post")
    }

    func testRemoveThreadPostRemovesAtValidIndex() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.addThreadPost()
        state.addThreadPost()
        XCTAssertEqual(state.threadPosts.count, 3)

        state.removeThreadPost(at: 1)
        XCTAssertEqual(state.threadPosts.count, 2,
            "Should remove the thread post at index 1")
    }

    // MARK: - updateThreadPost

    func testUpdateThreadPostOutOfBoundsIsSafe() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.threadPosts = [ComposeThreadPost(text: "Original")]

        // Out of bounds index should not crash
        state.updateThreadPost(at: 5, text: "Updated")
        XCTAssertEqual(state.threadPosts[0].text, "Original",
            "Should not modify any post for out-of-bounds index")
    }

    func testUpdateThreadPostAtValidIndex() {
        let state = NativeComposeState()
        state.isThreadMode = true
        state.threadPosts = [ComposeThreadPost(text: "First"), ComposeThreadPost(text: "Second")]

        state.updateThreadPost(at: 1, text: "Updated second")
        XCTAssertEqual(state.threadPosts[1].text, "Updated second",
            "Should update the text of the thread post at the given index")
    }

    // MARK: - reset

    func testResetClearsAllFields() {
        let state = NativeComposeState()

        // Set various fields to non-default values
        state.text = "Some text"
        state.mediaAttachments = MockCompose.sampleImageAttachments
        state.replyContext = MockCompose.makeReplyContext()
        state.quoteContext = MockCompose.makeQuoteContext()
        state.isThreadMode = true
        state.threadPosts = [
            ComposeThreadPost(text: "Post 1"),
            ComposeThreadPost(text: "Post 2"),
        ]
        state.mentionQuery = "alice"
        state.isShowingMentions = true
        state.mentionSuggestions = MockCompose.sampleMentionSuggestions
        state.isPosting = true
        state.isUploading = true
        state.isOffline = true
        state.draftId = "draft-123"
        state.editingAltTextIndex = 1
        state.tempAltText = "Alt text"
        state.isGeneratingAltText = true

        state.reset()

        XCTAssertEqual(state.text, "", "text should be empty after reset")
        XCTAssertTrue(state.mediaAttachments.isEmpty, "mediaAttachments should be empty after reset")
        XCTAssertNil(state.replyContext, "replyContext should be nil after reset")
        XCTAssertNil(state.quoteContext, "quoteContext should be nil after reset")
        XCTAssertFalse(state.isThreadMode, "isThreadMode should be false after reset")
        XCTAssertEqual(state.threadPosts.count, 1, "threadPosts should have exactly 1 post after reset")
        XCTAssertNil(state.mentionQuery, "mentionQuery should be nil after reset")
        XCTAssertFalse(state.isShowingMentions, "isShowingMentions should be false after reset")
        XCTAssertTrue(state.mentionSuggestions.isEmpty, "mentionSuggestions should be empty after reset")
        XCTAssertFalse(state.isPosting, "isPosting should be false after reset")
        XCTAssertFalse(state.isUploading, "isUploading should be false after reset")
        XCTAssertFalse(state.isOffline, "isOffline should be false after reset")
        XCTAssertNil(state.draftId, "draftId should be nil after reset")
        XCTAssertNil(state.editingAltTextIndex, "editingAltTextIndex should be nil after reset")
        XCTAssertEqual(state.tempAltText, "", "tempAltText should be empty after reset")
        XCTAssertFalse(state.isGeneratingAltText, "isGeneratingAltText should be false after reset")
    }

    // MARK: - removeMediaAttachment

    func testRemoveMediaAttachmentAtValidIndex() {
        let state = NativeComposeState()
        state.mediaAttachments = MockCompose.sampleImageAttachments
        XCTAssertEqual(state.mediaAttachments.count, 3)

        state.removeMediaAttachment(at: 1)
        XCTAssertEqual(state.mediaAttachments.count, 2)
        XCTAssertEqual(state.mediaAttachments[0].id, "img-1")
        XCTAssertEqual(state.mediaAttachments[1].id, "img-3")
    }

    func testRemoveMediaAttachmentOutOfBoundsIsSafe() {
        let state = NativeComposeState()
        state.mediaAttachments = [MockCompose.makeMediaAttachment(id: "m1")]

        state.removeMediaAttachment(at: 10)
        XCTAssertEqual(state.mediaAttachments.count, 1,
            "Should not remove anything for out-of-bounds index")
    }

    // MARK: - updateAltText

    func testUpdateAltTextAtValidIndex() {
        let state = NativeComposeState()
        state.mediaAttachments = [MockCompose.makeMediaAttachment(id: "m1", altText: "")]

        state.updateAltText(at: 0, altText: "A beautiful sunset over the ocean")
        XCTAssertEqual(state.mediaAttachments[0].altText, "A beautiful sunset over the ocean")
    }

    func testUpdateAltTextOutOfBoundsIsSafe() {
        let state = NativeComposeState()
        state.mediaAttachments = [MockCompose.makeMediaAttachment(id: "m1", altText: "Original")]

        state.updateAltText(at: 5, altText: "New text")
        XCTAssertEqual(state.mediaAttachments[0].altText, "Original",
            "Should not modify any attachment for out-of-bounds index")
    }
}

// MARK: - ComposeMentionSuggestionTests

class ComposeMentionSuggestionTests: XCTestCase {

    // MARK: - parse with valid dict

    func testParseWithValidDict() {
        let dict: [String: Any] = [
            "did": "did:plc:alice123",
            "handle": "alice.bsky.social",
            "displayName": "Alice Johnson",
            "avatar": "https://example.com/avatar.jpg",
        ]

        let suggestion = ComposeMentionSuggestion.parse(from: dict)

        XCTAssertNotNil(suggestion, "Should parse a valid dictionary into a suggestion")
        XCTAssertEqual(suggestion?.id, "did:plc:alice123")
        XCTAssertEqual(suggestion?.handle, "alice.bsky.social")
        XCTAssertEqual(suggestion?.displayName, "Alice Johnson")
        XCTAssertEqual(suggestion?.avatar, "https://example.com/avatar.jpg")
    }

    func testParseWithValidDictMinimalFields() {
        let dict: [String: Any] = [
            "did": "did:plc:bob456",
            "handle": "bob.bsky.social",
        ]

        let suggestion = ComposeMentionSuggestion.parse(from: dict)

        XCTAssertNotNil(suggestion, "Should parse with only required fields")
        XCTAssertEqual(suggestion?.id, "did:plc:bob456")
        XCTAssertEqual(suggestion?.handle, "bob.bsky.social")
        XCTAssertNil(suggestion?.displayName, "displayName should be nil when not provided")
        XCTAssertNil(suggestion?.avatar, "avatar should be nil when not provided")
    }

    // MARK: - parse returns nil for missing required fields

    func testParseReturnsNilForMissingDid() {
        let dict: [String: Any] = [
            "handle": "alice.bsky.social",
            "displayName": "Alice",
        ]

        let suggestion = ComposeMentionSuggestion.parse(from: dict)
        XCTAssertNil(suggestion,
            "Should return nil when 'did' is missing")
    }

    func testParseReturnsNilForMissingHandle() {
        let dict: [String: Any] = [
            "did": "did:plc:alice123",
            "displayName": "Alice",
        ]

        let suggestion = ComposeMentionSuggestion.parse(from: dict)
        XCTAssertNil(suggestion,
            "Should return nil when 'handle' is missing")
    }

    func testParseReturnsNilForEmptyDict() {
        let dict: [String: Any] = [:]

        let suggestion = ComposeMentionSuggestion.parse(from: dict)
        XCTAssertNil(suggestion,
            "Should return nil for an empty dictionary")
    }

    func testParseReturnsNilForWrongTypes() {
        let dict: [String: Any] = [
            "did": 12345,      // Wrong type: Int instead of String
            "handle": true,    // Wrong type: Bool instead of String
        ]

        let suggestion = ComposeMentionSuggestion.parse(from: dict)
        XCTAssertNil(suggestion,
            "Should return nil when required fields have wrong types")
    }

    // MARK: - Equatable conformance

    func testEquatableConformance() {
        let a = ComposeMentionSuggestion(
            id: "did:plc:test1",
            handle: "test.bsky.social",
            displayName: "Test User",
            avatar: nil
        )
        let b = ComposeMentionSuggestion(
            id: "did:plc:test1",
            handle: "test.bsky.social",
            displayName: "Test User",
            avatar: nil
        )
        let c = ComposeMentionSuggestion(
            id: "did:plc:other",
            handle: "other.bsky.social",
            displayName: nil,
            avatar: nil
        )

        XCTAssertEqual(a, b, "Identical suggestions should be equal")
        XCTAssertNotEqual(a, c, "Different suggestions should not be equal")
    }
}
