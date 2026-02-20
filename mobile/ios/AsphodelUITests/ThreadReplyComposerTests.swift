//
//  ThreadReplyComposerTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for ThreadReplyComposer, ComposerState,
//  ComposerToolbarView, and MentionSuggestionsView in the native-thread-view module.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeThreadView

// MARK: - ThreadReplyComposer Tests

class ThreadReplyComposerTests: XCTestCase {

    // MARK: - Helper

    private func makeComposer(
        state: ComposerState? = nil,
        onSendReply: ((String, String?, String?) -> Void)? = nil,
        onOpenImagePicker: (() -> Void)? = nil,
        onOpenGifPicker: (() -> Void)? = nil,
        onOpenEmojiPicker: (() -> Void)? = nil,
        onMentionSearch: ((String) -> Void)? = nil
    ) -> ThreadReplyComposer {
        ThreadReplyComposer(
            state: state ?? ComposerState(),
            onSendReply: onSendReply,
            onOpenImagePicker: onOpenImagePicker,
            onOpenGifPicker: onOpenGifPicker,
            onOpenEmojiPicker: onOpenEmojiPicker,
            onMentionSearch: onMentionSearch,
            onDismissKeyboard: nil
        )
    }

    // MARK: - Test: Send button disabled when empty

    func testSendButtonDisabledWhenEmpty() throws {
        let state = ComposerState()
        state.text = ""

        let view = makeComposer(state: state)
        let inspected = try view.inspect()

        // Find the send button (arrow.up.circle.fill icon)
        let sendButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "arrow.up.circle.fill"
            })) != nil
        })
        XCTAssertTrue(try sendButton.isDisabled(), "Send button should be disabled when text is empty")
    }

    // MARK: - Test: Send button enabled when text is present

    func testSendButtonEnabledWhenTextPresent() throws {
        let state = ComposerState()
        state.text = "Hello world"

        let view = makeComposer(state: state)
        let inspected = try view.inspect()

        let sendButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "arrow.up.circle.fill"
            })) != nil
        })
        XCTAssertFalse(try sendButton.isDisabled(), "Send button should be enabled when text is present")
    }

    // MARK: - Test: Send button calls onReply with correct params

    func testSendButtonCallsOnReplyWithCorrectParams() throws {
        let state = ComposerState()
        state.text = "My reply text"
        state.replyToUri = "at://did:plc:test/app.bsky.feed.post/123"
        state.replyToCid = "bafytest123"

        var sentText: String?
        var sentUri: String?
        var sentCid: String?
        let expectation = expectation(description: "onSendReply called")

        let view = makeComposer(
            state: state,
            onSendReply: { text, uri, cid in
                sentText = text
                sentUri = uri
                sentCid = cid
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        let sendButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "arrow.up.circle.fill"
            })) != nil
        })
        try sendButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(sentText, "My reply text", "Should send trimmed text")
        XCTAssertEqual(sentUri, "at://did:plc:test/app.bsky.feed.post/123", "Should pass reply-to URI")
        XCTAssertEqual(sentCid, "bafytest123", "Should pass reply-to CID")
        XCTAssertTrue(state.isSending, "Should set isSending to true after send")
    }

    // MARK: - Test: Character count displays when text entered

    func testCharacterCountDisplaysWhenTextEntered() throws {
        let state = ComposerState()
        state.text = "Hello"

        let view = makeComposer(state: state)
        let inspected = try view.inspect()

        // Should show "5/300"
        let charCount = try inspected.find(text: "5/300")
        XCTAssertNotNil(charCount, "Should display character count when text is present")
    }

    // MARK: - Test: Character count hidden when empty

    func testCharacterCountHiddenWhenEmpty() throws {
        let state = ComposerState()
        state.text = ""

        let view = makeComposer(state: state)
        let inspected = try view.inspect()

        // Should NOT show character count
        let allTexts = try inspected.findAll(ViewType.Text.self)
        let charCountTexts = allTexts.filter { (try? $0.string())?.contains("/300") ?? false }
        XCTAssertEqual(charCountTexts.count, 0, "Should not display character count when text is empty")
    }

    // MARK: - Test: Reply context bar shows replyToHandle

    func testReplyContextBarShowsReplyToHandle() throws {
        let state = ComposerState()
        state.replyToHandle = "alice.bsky.social"

        let view = makeComposer(state: state)
        let inspected = try view.inspect()

        let replyContext = try inspected.find(text: "Replying to @alice.bsky.social")
        XCTAssertNotNil(replyContext, "Should show reply context bar with handle")
    }

    // MARK: - Test: Sending state shows progress indicator

    func testSendingStateShowsProgressIndicator() throws {
        let state = ComposerState()
        state.text = "Sending..."
        state.isSending = true

        let view = makeComposer(state: state)
        let inspected = try view.inspect()

        // When isSending is true, the send button area shows ProgressView
        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show ProgressView while sending")
    }

    // MARK: - Test: Mention suggestions appear when available

    func testMentionSuggestionsAppearWhenAvailable() throws {
        let state = ComposerState()
        state.text = "Hey @al"
        state.isShowingMentions = true
        state.mentionSuggestions = MockThread.sampleMentionSuggestions

        let view = makeComposer(state: state)
        let inspected = try view.inspect()

        // Should show MentionSuggestionsView with suggestion handles
        let aliceHandle = try inspected.find(text: "@alice.bsky.social")
        XCTAssertNotNil(aliceHandle, "Should show mention suggestion handle")

        let aliceName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(aliceName, "Should show mention suggestion display name")
    }
}

// MARK: - ComposerState Unit Tests

class ComposerStateTests: XCTestCase {

    // MARK: - Test: Initial state

    func testInitialState() {
        let state = ComposerState()
        XCTAssertEqual(state.text, "")
        XCTAssertFalse(state.isSending)
        XCTAssertNil(state.replyToHandle)
        XCTAssertNil(state.replyToUri)
        XCTAssertNil(state.replyToCid)
        XCTAssertNil(state.mentionQuery)
        XCTAssertFalse(state.isShowingMentions)
        XCTAssertTrue(state.mentionSuggestions.isEmpty)
    }

    // MARK: - Test: Remaining characters calculation

    func testRemainingCharacters() {
        let state = ComposerState()
        XCTAssertEqual(state.remainingCharacters, 300)

        state.text = "Hello"
        XCTAssertEqual(state.remainingCharacters, 295)

        state.text = String(repeating: "a", count: 300)
        XCTAssertEqual(state.remainingCharacters, 0)

        state.text = String(repeating: "a", count: 310)
        XCTAssertEqual(state.remainingCharacters, -10)
    }

    // MARK: - Test: isOverLimit flag

    func testIsOverLimit() {
        let state = ComposerState()
        state.text = "Short"
        XCTAssertFalse(state.isOverLimit)

        state.text = String(repeating: "a", count: 300)
        XCTAssertFalse(state.isOverLimit)

        state.text = String(repeating: "a", count: 301)
        XCTAssertTrue(state.isOverLimit)
    }

    // MARK: - Test: canSend requirements

    func testCanSendRequirements() {
        let state = ComposerState()

        // Empty text: cannot send
        state.text = ""
        XCTAssertFalse(state.canSend, "Cannot send when text is empty")

        // Whitespace only: cannot send
        state.text = "   \n   "
        XCTAssertFalse(state.canSend, "Cannot send when text is whitespace only")

        // Valid text: can send
        state.text = "Hello"
        XCTAssertTrue(state.canSend, "Should be able to send valid text")

        // Over limit: cannot send
        state.text = String(repeating: "a", count: 301)
        XCTAssertFalse(state.canSend, "Cannot send when over character limit")

        // While sending: cannot send
        state.text = "Hello"
        state.isSending = true
        XCTAssertFalse(state.canSend, "Cannot send while already sending")
    }

    // MARK: - Test: Mention detection

    func testMentionDetection() {
        let state = ComposerState()

        // Typing "@al" should detect mention
        state.detectMention(in: "@al")
        XCTAssertEqual(state.mentionQuery, "al")
        XCTAssertTrue(state.isShowingMentions)
        XCTAssertEqual(state.mentionStartIndex, 0)

        // Typing "Hey @bob" should detect mention
        state.detectMention(in: "Hey @bob")
        XCTAssertEqual(state.mentionQuery, "bob")
        XCTAssertTrue(state.isShowingMentions)

        // No @ sign: no mention
        state.detectMention(in: "Hello world")
        XCTAssertNil(state.mentionQuery)
        XCTAssertFalse(state.isShowingMentions)
    }

    // MARK: - Test: Mention insertion

    func testMentionInsertion() {
        let state = ComposerState()

        state.text = "Hey @al"
        state.mentionStartIndex = 4
        state.mentionQuery = "al"
        state.isShowingMentions = true

        let suggestion = MockThread.makeMentionSuggestion(
            handle: "alice.bsky.social",
            displayName: "Alice"
        )
        state.insertMention(suggestion)

        XCTAssertEqual(state.text, "Hey @alice.bsky.social ", "Should insert full handle")
        XCTAssertNil(state.mentionQuery, "Should clear mention query after insertion")
        XCTAssertFalse(state.isShowingMentions, "Should hide mention suggestions after insertion")
    }

    // MARK: - Test: Reset clears all state

    func testResetClearsAllState() {
        let state = ComposerState()
        state.text = "Some text"
        state.isSending = true
        state.mentionQuery = "test"
        state.isShowingMentions = true
        state.mentionSuggestions = MockThread.sampleMentionSuggestions

        state.reset()

        XCTAssertEqual(state.text, "")
        XCTAssertFalse(state.isSending)
        XCTAssertNil(state.mentionQuery)
        XCTAssertFalse(state.isShowingMentions)
        XCTAssertTrue(state.mentionSuggestions.isEmpty)
    }
}

// MARK: - ComposerToolbarView Tests

class ComposerToolbarViewTests: XCTestCase {

    // MARK: - Test: Toolbar buttons trigger correct callbacks

    func testToolbarImagePickerButton() throws {
        var imagePickerCalled = false
        let expectation = expectation(description: "onImagePicker called")

        let view = ComposerToolbarView(
            onImagePicker: {
                imagePickerCalled = true
                expectation.fulfill()
            },
            onGifPicker: {},
            onEmojiPicker: {}
        )

        let inspected = try view.inspect()

        // Find the photo button
        let photoButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "photo"
            })) != nil
        })
        try photoButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(imagePickerCalled, "Tapping photo button should call onImagePicker")
    }

    func testToolbarGifPickerButton() throws {
        var gifPickerCalled = false
        let expectation = expectation(description: "onGifPicker called")

        let view = ComposerToolbarView(
            onImagePicker: {},
            onGifPicker: {
                gifPickerCalled = true
                expectation.fulfill()
            },
            onEmojiPicker: {}
        )

        let inspected = try view.inspect()

        // Find the gift/GIF button
        let gifButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "gift"
            })) != nil
        })
        try gifButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(gifPickerCalled, "Tapping GIF button should call onGifPicker")
    }

    func testToolbarEmojiPickerButton() throws {
        var emojiPickerCalled = false
        let expectation = expectation(description: "onEmojiPicker called")

        let view = ComposerToolbarView(
            onImagePicker: {},
            onGifPicker: {},
            onEmojiPicker: {
                emojiPickerCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Find the emoji button (face.smiling icon)
        let emojiButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "face.smiling"
            })) != nil
        })
        try emojiButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(emojiPickerCalled, "Tapping emoji button should call onEmojiPicker")
    }
}

// MARK: - MentionSuggestionsView Tests

class MentionSuggestionsViewTests: XCTestCase {

    // MARK: - Test: Suggestion list renders all suggestions (up to 5)

    func testSuggestionListRendersAllSuggestions() throws {
        var selectedSuggestion: MentionSuggestion?

        let view = MentionSuggestionsView(
            suggestions: MockThread.sampleMentionSuggestions,
            onSelect: { suggestion in
                selectedSuggestion = suggestion
            }
        )

        let inspected = try view.inspect()

        // Should show all 3 suggestion handles
        let aliceHandle = try inspected.find(text: "@alice.bsky.social")
        XCTAssertNotNil(aliceHandle)

        let bobHandle = try inspected.find(text: "@bob.bsky.social")
        XCTAssertNotNil(bobHandle)

        let carolHandle = try inspected.find(text: "@carol.bsky.social")
        XCTAssertNotNil(carolHandle)

        // Display names should show where available
        let aliceName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(aliceName, "Should show display name for Alice")

        let bobName = try inspected.find(text: "Bob Smith")
        XCTAssertNotNil(bobName, "Should show display name for Bob")
    }

    // MARK: - Test: Tap suggestion calls onSelect

    func testTapSuggestionCallsOnSelect() throws {
        var selectedHandle: String?
        let expectation = expectation(description: "onSelect called")

        let view = MentionSuggestionsView(
            suggestions: MockThread.sampleMentionSuggestions,
            onSelect: { suggestion in
                selectedHandle = suggestion.handle
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Find and tap the first suggestion button
        let firstButton = try inspected.find(ViewType.Button.self)
        try firstButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(selectedHandle, "alice.bsky.social", "Should select the first suggestion")
    }
}
