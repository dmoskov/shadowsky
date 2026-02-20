//
//  ComposeViewTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for the native-compose SwiftUI module.
//  Tests cover ComposeView, ComposeTextEditor, ComposeMediaGrid,
//  ComposeMentionSuggestions, AltTextSheet, and ComposeState.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeCompose

// MARK: - ViewInspector Conformance

extension ComposeView: Inspectable {}
extension ComposeTextEditor: Inspectable {}
extension ComposeMediaGrid: Inspectable {}
extension ComposeToolbarView: Inspectable {}
extension ComposeMentionSuggestionsView: Inspectable {}
extension AltTextSheet: Inspectable {}
extension ThreadPostEditor: Inspectable {}

// MARK: - ComposeView Tests

class ComposeViewTests: XCTestCase {

    /// Helper to build a ComposeView with sensible defaults and optional overrides
    private func makeComposeView(
        composeState: NativeComposeState = NativeComposeState(),
        onClose: @escaping () -> Void = {},
        onPost: @escaping () -> Void = {},
        onSaveDraft: @escaping () -> Void = {},
        onOpenDrafts: @escaping () -> Void = {},
        onImagePicker: @escaping () -> Void = {},
        onVideoPicker: @escaping () -> Void = {},
        onGifPicker: @escaping () -> Void = {},
        onEmojiPicker: @escaping () -> Void = {},
        onLanguagePicker: @escaping () -> Void = {},
        onRemoveMedia: @escaping (Int) -> Void = { _ in },
        onEditAltText: @escaping (Int) -> Void = { _ in },
        onGenerateAltText: @escaping (Int) -> Void = { _ in },
        onSaveAltText: @escaping (Int, String) -> Void = { _, _ in },
        onToggleThreadMode: @escaping () -> Void = {},
        onAddThreadPost: @escaping () -> Void = {},
        onRemoveThreadPost: @escaping (Int) -> Void = { _ in },
        onUpdateThreadPost: @escaping (Int, String) -> Void = { _, _ in },
        onMentionSearch: @escaping (String) -> Void = { _ in },
        onThreadImagePicker: @escaping (Int) -> Void = { _ in }
    ) -> ComposeView {
        ComposeView(
            composeState: composeState,
            onClose: onClose,
            onPost: onPost,
            onSaveDraft: onSaveDraft,
            onOpenDrafts: onOpenDrafts,
            onImagePicker: onImagePicker,
            onVideoPicker: onVideoPicker,
            onGifPicker: onGifPicker,
            onEmojiPicker: onEmojiPicker,
            onLanguagePicker: onLanguagePicker,
            onRemoveMedia: onRemoveMedia,
            onEditAltText: onEditAltText,
            onGenerateAltText: onGenerateAltText,
            onSaveAltText: onSaveAltText,
            onToggleThreadMode: onToggleThreadMode,
            onAddThreadPost: onAddThreadPost,
            onRemoveThreadPost: onRemoveThreadPost,
            onUpdateThreadPost: onUpdateThreadPost,
            onMentionSearch: onMentionSearch,
            onThreadImagePicker: onThreadImagePicker
        )
    }

    // MARK: - Test: Empty compose shows placeholder and disables post button

    func testEmptyComposeShowsPlaceholderAndDisablesPostButton() throws {
        let state = NativeComposeState()
        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        // Placeholder should show "What's happening?"
        let placeholder = try inspected.find(text: "What's happening?")
        XCTAssertNotNil(placeholder)

        // Post button should be present but disabled (canPost is false for empty text)
        let postButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Post")) != nil
        })
        XCTAssertTrue(try postButton.isDisabled(), "Post button should be disabled when text is empty")
    }

    // MARK: - Test: Post with text enables the send button

    func testPostWithTextEnablesSendButton() throws {
        let state = NativeComposeState()
        state.text = "Hello, Bluesky!"
        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        let postButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Post")) != nil
        })
        XCTAssertFalse(try postButton.isDisabled(), "Post button should be enabled when text has content")
    }

    // MARK: - Test: Character counter shows remaining chars

    func testCharacterCounterShowsRemainingChars() throws {
        let state = NativeComposeState()
        state.text = "Hello world"  // 11 chars
        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        // The toolbar shows "charCount/maxLength" e.g., "11/300"
        let counterText = try inspected.find(text: "11/300")
        XCTAssertNotNil(counterText, "Should display character count as 11/300")
    }

    // MARK: - Test: Counter turns red when over limit

    func testCounterTurnsRedWhenOverLimit() throws {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 305)  // Over 300 limit
        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        // The toolbar's character count text should show "305/300"
        let counterText = try inspected.find(text: "305/300")
        XCTAssertNotNil(counterText, "Should display character count as 305/300")

        // Post button should be disabled when over limit
        let postButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Post")) != nil
        })
        XCTAssertTrue(try postButton.isDisabled(), "Post button should be disabled when over character limit")
    }

    // MARK: - Test: Tap post button calls onPost callback

    func testTapPostButtonCallsOnPostCallback() throws {
        let state = NativeComposeState()
        state.text = "Test post"
        var postCalled = false
        let expectation = expectation(description: "onPost called")

        let view = makeComposeView(composeState: state, onPost: {
            postCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        let postButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Post")) != nil
        })
        try postButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(postCalled, "onPost callback should be called when Post button is tapped")
    }

    // MARK: - Test: Cancel button calls onClose callback

    func testCancelButtonCallsOnCloseCallback() throws {
        let state = NativeComposeState()
        var closeCalled = false
        let expectation = expectation(description: "onClose called")

        let view = makeComposeView(composeState: state, onClose: {
            closeCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        let cancelButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Cancel")) != nil
        })
        try cancelButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(closeCalled, "onClose callback should be called when Cancel button is tapped")
    }

    // MARK: - Test: Reply context shows author info

    func testReplyContextShowsAuthorInfo() throws {
        let state = NativeComposeState()
        state.replyContext = MockCompose.makeReplyContext(
            authorHandle: "alice.bsky.social",
            authorDisplayName: "Alice Johnson",
            text: "Original post being replied to"
        )
        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        // Should show replying indicator
        let replyText = try inspected.find(text: "Replying to @alice.bsky.social")
        XCTAssertNotNil(replyText, "Should show replying context with author handle")

        // Placeholder should change to "Post your reply"
        let placeholder = try inspected.find(text: "Post your reply")
        XCTAssertNotNil(placeholder, "Should show reply placeholder when reply context is set")
    }

    // MARK: - Test: Posting state shows progress and disables post button

    func testPostingStateShowsProgressAndDisablesPostButton() throws {
        let state = NativeComposeState()
        state.text = "Test post"
        state.isPosting = true
        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        // When isPosting is true, the Post button shows ProgressView instead of text
        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show ProgressView when posting")

        // The button should be disabled (canPost returns false when isPosting)
        // Find the button by looking for the one with ProgressView
        let postArea = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.ProgressView.self)) != nil
        })
        XCTAssertTrue(try postArea.isDisabled(), "Post button should be disabled while posting")
    }
}

// MARK: - ComposeMediaGrid Tests

class ComposeMediaGridTests: XCTestCase {

    // MARK: - Test: Media grid renders attached images

    func testMediaGridRendersAttachedImages() throws {
        let attachments = MockCompose.sampleImageAttachments
        let view = ComposeMediaGrid(
            attachments: attachments,
            isUploading: false,
            onRemove: { _ in },
            onEditAltText: { _ in }
        )
        let inspected = try view.inspect()

        // Should find AsyncImage instances for each attachment
        let asyncImages = try inspected.findAll(ViewType.AsyncImage.self)
        XCTAssertEqual(asyncImages.count, 3, "Should render 3 image thumbnails for 3 attachments")
    }

    // MARK: - Test: Remove button calls onRemove with correct index

    func testRemoveButtonCallsOnRemoveWithCorrectIndex() throws {
        let attachments = MockCompose.sampleImageAttachments
        var removedIndex: Int?
        let expectation = expectation(description: "onRemove called")

        let view = ComposeMediaGrid(
            attachments: attachments,
            isUploading: false,
            onRemove: { index in
                removedIndex = index
                expectation.fulfill()
            },
            onEditAltText: { _ in }
        )
        let inspected = try view.inspect()

        // Find the first remove button (xmark.circle.fill) and tap it
        let removeButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(ViewType.Image.self, where: { image in
                try image.actualImage().name() == "xmark.circle.fill"
            })) != nil
        })
        try removeButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(removedIndex, 0, "Should call onRemove with index 0 for the first attachment")
    }

    // MARK: - Test: ALT badge tap calls onEditAltText

    func testAltBadgeTapCallsOnEditAltText() throws {
        let attachments = [MockCompose.makeMediaAttachment(id: "img-1", altText: "")]
        var editedIndex: Int?
        let expectation = expectation(description: "onEditAltText called")

        let view = ComposeMediaGrid(
            attachments: attachments,
            isUploading: false,
            onRemove: { _ in },
            onEditAltText: { index in
                editedIndex = index
                expectation.fulfill()
            }
        )
        let inspected = try view.inspect()

        // Find the ALT button text and its parent button
        let altButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "ALT")) != nil
        })
        try altButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(editedIndex, 0, "Should call onEditAltText with index 0")
    }

    // MARK: - Test: Empty attachments renders nothing

    func testEmptyAttachmentsRendersNothing() throws {
        let view = ComposeMediaGrid(
            attachments: [],
            isUploading: false,
            onRemove: { _ in },
            onEditAltText: { _ in }
        )
        let inspected = try view.inspect()

        // With no attachments, the grid returns EmptyView
        let asyncImages = try inspected.findAll(ViewType.AsyncImage.self)
        XCTAssertEqual(asyncImages.count, 0, "Should render no images when attachments are empty")
    }

    // MARK: - Test: Upload overlay shows when uploading

    func testUploadOverlayShowsWhenUploading() throws {
        let attachments = [MockCompose.makeMediaAttachment()]
        let view = ComposeMediaGrid(
            attachments: attachments,
            isUploading: true,
            onRemove: { _ in },
            onEditAltText: { _ in }
        )
        let inspected = try view.inspect()

        // When uploading, a ProgressView overlay is shown on each card
        let progressViews = try inspected.findAll(ViewType.ProgressView.self)
        XCTAssertGreaterThan(progressViews.count, 0, "Should show ProgressView overlay when uploading")
    }
}

// MARK: - ComposeMentionSuggestions Tests

class ComposeMentionSuggestionsTests: XCTestCase {

    // MARK: - Test: Suggestions render with display names and handles

    func testSuggestionsRenderWithDisplayNamesAndHandles() throws {
        let suggestions = MockCompose.sampleMentionSuggestions
        let view = ComposeMentionSuggestionsView(
            suggestions: suggestions,
            onSelect: { _ in }
        )
        let inspected = try view.inspect()

        // Should show display names
        let aliceName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(aliceName, "Should show Alice's display name")

        let alexName = try inspected.find(text: "Alex Smith")
        XCTAssertNotNil(alexName, "Should show Alex's display name")

        // Should show handles with @ prefix
        let aliceHandle = try inspected.find(text: "@alice.bsky.social")
        XCTAssertNotNil(aliceHandle, "Should show Alice's handle")
    }

    // MARK: - Test: Tap suggestion calls onSelect with correct suggestion

    func testTapSuggestionCallsOnSelectWithCorrectSuggestion() throws {
        let suggestions = MockCompose.sampleMentionSuggestions
        var selectedSuggestion: ComposeMentionSuggestion?
        let expectation = expectation(description: "onSelect called")

        let view = ComposeMentionSuggestionsView(
            suggestions: suggestions,
            onSelect: { suggestion in
                selectedSuggestion = suggestion
                expectation.fulfill()
            }
        )
        let inspected = try view.inspect()

        // Find and tap the first suggestion button (Alice)
        let firstButton = try inspected.find(ViewType.Button.self)
        try firstButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(selectedSuggestion?.handle, "alice.bsky.social",
            "Should select Alice's suggestion when first row is tapped")
    }
}

// MARK: - AltTextSheet Tests

class AltTextSheetTests: XCTestCase {

    // MARK: - Test: Alt text sheet shows image and description prompt

    func testAltTextSheetShowsImageAndDescriptionPrompt() throws {
        let view = AltTextSheet(
            imageUri: "https://example.com/image.jpg",
            altText: .constant(""),
            isGenerating: false,
            onGenerateAltText: {},
            onSave: { _ in },
            onDismiss: {}
        )
        let inspected = try view.inspect()

        // Should show the description prompt
        let prompt = try inspected.find(text: "Describe this image for people who are blind or have low vision.")
        XCTAssertNotNil(prompt, "Should show accessibility description prompt")

        // Should show the Generate with AI button
        let generateButton = try inspected.find(text: "Generate with AI")
        XCTAssertNotNil(generateButton, "Should show Generate with AI button")

        // Should show navigation title
        let navTitle = try inspected.find(text: "Add Alt Text")
        XCTAssertNotNil(navTitle, "Should show Add Alt Text navigation title")
    }

    // MARK: - Test: Save button calls onSave with entered text

    func testSaveButtonCallsOnSaveWithEnteredText() throws {
        var savedText: String?
        let expectation = expectation(description: "onSave called")

        let view = AltTextSheet(
            imageUri: "https://example.com/image.jpg",
            altText: .constant("A photo of a sunset"),
            isGenerating: false,
            onGenerateAltText: {},
            onSave: { text in
                savedText = text
                expectation.fulfill()
            },
            onDismiss: {}
        )
        let inspected = try view.inspect()

        // Find and tap the Save toolbar button
        let saveButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Save")) != nil
        })
        try saveButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertNotNil(savedText, "onSave should be called with the alt text")
    }

    // MARK: - Test: Cancel dismisses without saving

    func testCancelDismissesWithoutSaving() throws {
        var dismissCalled = false
        var saveCalled = false
        let expectation = expectation(description: "onDismiss called")

        let view = AltTextSheet(
            imageUri: "https://example.com/image.jpg",
            altText: .constant(""),
            isGenerating: false,
            onGenerateAltText: {},
            onSave: { _ in saveCalled = true },
            onDismiss: {
                dismissCalled = true
                expectation.fulfill()
            }
        )
        let inspected = try view.inspect()

        // Find and tap the Cancel toolbar button
        let cancelButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Cancel")) != nil
        })
        try cancelButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(dismissCalled, "onDismiss should be called when Cancel is tapped")
        XCTAssertFalse(saveCalled, "onSave should not be called when Cancel is tapped")
    }

    // MARK: - Test: Generating state shows progress and disables button

    func testGeneratingStateShowsProgressAndDisablesButton() throws {
        let view = AltTextSheet(
            imageUri: "https://example.com/image.jpg",
            altText: .constant(""),
            isGenerating: true,
            onGenerateAltText: {},
            onSave: { _ in },
            onDismiss: {}
        )
        let inspected = try view.inspect()

        // Should show "Generating..." text
        let generatingText = try inspected.find(text: "Generating...")
        XCTAssertNotNil(generatingText, "Should show Generating... text when isGenerating is true")

        // Should show ProgressView
        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show ProgressView when generating")

        // Generate button should be disabled
        let generateButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Generating...")) != nil
        })
        XCTAssertTrue(try generateButton.isDisabled(), "Generate button should be disabled while generating")
    }
}

// MARK: - NativeComposeState Unit Tests

class NativeComposeStateTests: XCTestCase {

    func testInitialState() {
        let state = NativeComposeState()
        XCTAssertEqual(state.text, "")
        XCTAssertTrue(state.mediaAttachments.isEmpty)
        XCTAssertNil(state.replyContext)
        XCTAssertNil(state.quoteContext)
        XCTAssertFalse(state.isThreadMode)
        XCTAssertEqual(state.threadPosts.count, 1)
        XCTAssertFalse(state.isPosting)
        XCTAssertFalse(state.isUploading)
        XCTAssertFalse(state.canPost)
    }

    func testCanPostWithText() {
        let state = NativeComposeState()
        state.text = "Hello"
        XCTAssertTrue(state.canPost, "canPost should be true with non-empty text")
    }

    func testCanPostFalseForWhitespaceOnly() {
        let state = NativeComposeState()
        state.text = "   \n  "
        XCTAssertFalse(state.canPost, "canPost should be false for whitespace-only text")
    }

    func testCanPostFalseWhenOverLimit() {
        let state = NativeComposeState()
        state.text = String(repeating: "x", count: 301)
        XCTAssertFalse(state.canPost, "canPost should be false when text exceeds max characters")
    }

    func testCanPostFalseWhenPosting() {
        let state = NativeComposeState()
        state.text = "Hello"
        state.isPosting = true
        XCTAssertFalse(state.canPost, "canPost should be false while posting")
    }

    func testRemainingCharacters() {
        let state = NativeComposeState()
        state.text = "Hello"
        XCTAssertEqual(state.remainingCharacters, 295)
    }

    func testIsOverLimit() {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 301)
        XCTAssertTrue(state.isOverLimit)
    }

    func testToggleThreadMode() {
        let state = NativeComposeState()
        state.text = "My post text"

        state.toggleThreadMode()
        XCTAssertTrue(state.isThreadMode, "Should enter thread mode")
        XCTAssertEqual(state.threadPosts.first?.text, "My post text",
            "First thread post should contain original text")
        XCTAssertEqual(state.text, "", "Main text should be cleared in thread mode")

        state.toggleThreadMode()
        XCTAssertFalse(state.isThreadMode, "Should exit thread mode")
        XCTAssertEqual(state.text, "My post text", "Text should be restored from first thread post")
    }

    func testAddAndRemoveThreadPost() {
        let state = NativeComposeState()
        state.toggleThreadMode()
        XCTAssertEqual(state.threadPosts.count, 1)

        state.addThreadPost()
        XCTAssertEqual(state.threadPosts.count, 2)

        state.addThreadPost()
        XCTAssertEqual(state.threadPosts.count, 3)

        state.removeThreadPost(at: 1)
        XCTAssertEqual(state.threadPosts.count, 2)

        // Cannot remove the last post
        state.removeThreadPost(at: 0)
        XCTAssertEqual(state.threadPosts.count, 1)
        state.removeThreadPost(at: 0)
        XCTAssertEqual(state.threadPosts.count, 1, "Should not remove the last thread post")
    }

    func testDetectMention() {
        let state = NativeComposeState()

        state.detectMention(in: "Hello @ali")
        XCTAssertEqual(state.mentionQuery, "ali", "Should detect mention query 'ali'")
        XCTAssertTrue(state.isShowingMentions)

        state.detectMention(in: "Hello ")
        XCTAssertNil(state.mentionQuery, "Should clear mention query when no @ in progress")
        XCTAssertFalse(state.isShowingMentions)
    }

    func testInsertMention() {
        let state = NativeComposeState()
        state.text = "Hello @ali"
        state.mentionStartIndex = 6  // Position of @

        let suggestion = MockCompose.makeMentionSuggestion(handle: "alice.bsky.social")
        state.insertMention(suggestion)

        XCTAssertEqual(state.text, "Hello @alice.bsky.social ",
            "Should replace mention query with full handle")
        XCTAssertNil(state.mentionQuery)
        XCTAssertFalse(state.isShowingMentions)
    }

    func testReset() {
        let state = NativeComposeState()
        state.text = "Some text"
        state.isPosting = true
        state.isThreadMode = true
        state.mediaAttachments = MockCompose.sampleImageAttachments

        state.reset()

        XCTAssertEqual(state.text, "")
        XCTAssertFalse(state.isPosting)
        XCTAssertFalse(state.isThreadMode)
        XCTAssertTrue(state.mediaAttachments.isEmpty)
    }

    func testMediaAttachmentRemoval() {
        let state = NativeComposeState()
        state.mediaAttachments = MockCompose.sampleImageAttachments
        XCTAssertEqual(state.mediaAttachments.count, 3)

        state.removeMediaAttachment(at: 1)
        XCTAssertEqual(state.mediaAttachments.count, 2)
        XCTAssertEqual(state.mediaAttachments[0].id, "img-1")
        XCTAssertEqual(state.mediaAttachments[1].id, "img-3")
    }

    func testUpdateAltText() {
        let state = NativeComposeState()
        state.mediaAttachments = [MockCompose.makeMediaAttachment(id: "img-1", altText: "")]

        state.updateAltText(at: 0, altText: "A beautiful sunset")
        XCTAssertEqual(state.mediaAttachments[0].altText, "A beautiful sunset")
    }
}
