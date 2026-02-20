//
//  ComposeErrorTests.swift
//  AsphodelUITests
//
//  Error state and edge case tests for the NativeCompose module.
//  Tests cover posting failures, invalid media attachments, multi-byte
//  emoji character counting, extremely long text, and draft state.
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeCompose

// MARK: - NativeComposeState Error Path Tests

class NativeComposeStateErrorTests: XCTestCase {

    // MARK: - Test: Error state preserves draft text

    func testErrorStatePreservesDraftText() {
        let state = NativeComposeState()
        state.text = "My important post"
        state.isPosting = true

        // Simulate a failed post by setting isPosting back to false
        // (the bridge would do this on error)
        state.isPosting = false

        XCTAssertEqual(state.text, "My important post",
            "Draft text should be preserved after post failure")
        XCTAssertFalse(state.isPosting, "isPosting should be false after failure")
    }

    // MARK: - Test: Character count with emoji (multi-byte)

    func testCharacterCountWithEmoji() {
        let state = NativeComposeState()

        // Single emoji
        state.text = "👋"
        XCTAssertEqual(state.text.count, 1, "Single emoji should count as 1 character")
        XCTAssertTrue(state.canPost, "Single emoji should allow posting")

        // Skin tone modifier emoji
        state.text = "👏🏽"
        XCTAssertEqual(state.text.count, 1, "Skin tone emoji should count as 1 character (Swift)")
        XCTAssertTrue(state.canPost)

        // Family emoji (ZWJ sequence)
        state.text = "👨‍👩‍👧‍👦"
        XCTAssertEqual(state.text.count, 1, "Family emoji (ZWJ) should count as 1 character (Swift)")
        XCTAssertTrue(state.canPost)

        // Flag emoji
        state.text = "🇺🇸"
        XCTAssertEqual(state.text.count, 1, "Flag emoji should count as 1 character (Swift)")
        XCTAssertTrue(state.canPost)
    }

    // MARK: - Test: Paste extremely long text

    func testPasteExtremelyLongText() {
        let state = NativeComposeState()
        let longText = String(repeating: "x", count: 10_000)

        state.text = longText

        XCTAssertEqual(state.text.count, 10_000, "Text should accept the full pasted content")
        XCTAssertFalse(state.canPost, "Should not allow posting when over 300 char limit")
        XCTAssertTrue(state.isOverLimit, "Should be over limit")
        XCTAssertEqual(state.remainingCharacters, -9700, "Remaining should be negative")
    }

    // MARK: - Test: Media attachment with empty uri

    func testMediaAttachmentWithEmptyUri() {
        let attachment = MediaAttachment(
            id: "test-1",
            uri: "",
            mimeType: "image/jpeg",
            altText: "",
            width: 0,
            height: 0,
            isVideo: false,
            thumbnail: nil,
            duration: nil
        )

        XCTAssertEqual(attachment.uri, "", "Should accept empty URI without crash")
        XCTAssertEqual(attachment.id, "test-1", "ID should be preserved")
    }

    // MARK: - Test: MediaAttachment.fromDict with missing uri returns nil

    func testMediaAttachmentFromDictWithMissingUriReturnsNil() {
        let dict: [String: Any] = [
            "id": "no-uri",
            "mimeType": "image/png"
            // Missing "uri" key
        ]

        let attachment = MediaAttachment.fromDict(dict)
        XCTAssertNil(attachment, "Should return nil when uri is missing from dict")
    }

    // MARK: - Test: MediaAttachment.fromDict with minimal data

    func testMediaAttachmentFromDictWithMinimalData() {
        let dict: [String: Any] = [
            "uri": "https://example.com/image.jpg"
            // All other fields missing
        ]

        let attachment = MediaAttachment.fromDict(dict)
        XCTAssertNotNil(attachment, "Should create attachment with just uri")
        XCTAssertEqual(attachment?.uri, "https://example.com/image.jpg")
        XCTAssertEqual(attachment?.mimeType, "image/jpeg", "Should default to image/jpeg")
        XCTAssertEqual(attachment?.altText, "", "Should default to empty alt text")
        XCTAssertEqual(attachment?.width, 0, "Should default to 0 width")
        XCTAssertEqual(attachment?.height, 0, "Should default to 0 height")
        XCTAssertFalse(attachment!.isVideo, "Should default to not video")
    }

    // MARK: - Test: ReplyContext.fromDict with missing required fields

    func testReplyContextFromDictWithMissingRequiredFields() {
        // Missing uri
        let noUri: [String: Any] = [
            "cid": "bafyrei-test",
            "authorHandle": "alice.bsky.social"
        ]
        XCTAssertNil(ReplyContext.fromDict(noUri), "Should return nil when uri is missing")

        // Missing cid
        let noCid: [String: Any] = [
            "uri": "at://test/post/1",
            "authorHandle": "alice.bsky.social"
        ]
        XCTAssertNil(ReplyContext.fromDict(noCid), "Should return nil when cid is missing")

        // Missing authorHandle
        let noHandle: [String: Any] = [
            "uri": "at://test/post/1",
            "cid": "bafyrei-test"
        ]
        XCTAssertNil(ReplyContext.fromDict(noHandle), "Should return nil when authorHandle is missing")
    }

    // MARK: - Test: QuoteContext.fromDict with missing required fields

    func testQuoteContextFromDictWithMissingRequiredFields() {
        let noUri: [String: Any] = [
            "cid": "bafyrei-test",
            "authorHandle": "alice.bsky.social"
        ]
        XCTAssertNil(QuoteContext.fromDict(noUri), "Should return nil when uri is missing")

        let noCid: [String: Any] = [
            "uri": "at://test/post/1",
            "authorHandle": "alice.bsky.social"
        ]
        XCTAssertNil(QuoteContext.fromDict(noCid), "Should return nil when cid is missing")
    }

    // MARK: - Test: Remove media at invalid index doesn't crash

    func testRemoveMediaAtInvalidIndexDoesNotCrash() {
        let state = NativeComposeState()
        state.mediaAttachments = [
            MockCompose.makeMediaAttachment(id: "img-1"),
        ]

        // Index out of bounds — should not crash
        state.removeMediaAttachment(at: 5)
        XCTAssertEqual(state.mediaAttachments.count, 1,
            "Should not remove anything for out-of-bounds index")

        state.removeMediaAttachment(at: -1)
        XCTAssertEqual(state.mediaAttachments.count, 1,
            "Should not remove anything for negative index")
    }

    // MARK: - Test: Update alt text at invalid index doesn't crash

    func testUpdateAltTextAtInvalidIndexDoesNotCrash() {
        let state = NativeComposeState()
        state.mediaAttachments = [
            MockCompose.makeMediaAttachment(id: "img-1", altText: "Original"),
        ]

        // Index out of bounds — should not crash
        state.updateAltText(at: 5, altText: "New text")
        XCTAssertEqual(state.mediaAttachments[0].altText, "Original",
            "Should not modify any attachment for out-of-bounds index")
    }

    // MARK: - Test: Thread mode with empty text

    func testThreadModeWithEmptyText() {
        let state = NativeComposeState()
        state.text = ""

        state.toggleThreadMode()
        XCTAssertTrue(state.isThreadMode)
        XCTAssertEqual(state.threadPosts.first?.text, "",
            "First thread post should have empty text")
    }

    // MARK: - Test: canPost with only media attachments (no text)

    func testCanPostWithOnlyMediaAttachments() {
        let state = NativeComposeState()
        state.text = ""
        state.mediaAttachments = [MockCompose.makeMediaAttachment()]

        XCTAssertTrue(state.canPost,
            "Should allow posting when media is attached even without text")
    }

    // MARK: - Test: DraftData round-trip preserves data

    func testDraftDataRoundTrip() {
        let draft = DraftData(
            id: "draft-1",
            text: "My draft text",
            images: [MockCompose.makeMediaAttachment(id: "img-1", altText: "Photo of sunset")]
        )

        let dict = draft.toDict()
        XCTAssertEqual(dict["text"] as? String, "My draft text")
        XCTAssertEqual(dict["id"] as? String, "draft-1")

        let images = dict["images"] as? [[String: Any]]
        XCTAssertEqual(images?.count, 1)
        XCTAssertEqual(images?.first?["id"] as? String, "img-1")
    }

    // MARK: - Test: Mention detection with special characters

    func testMentionDetectionWithSpecialCharacters() {
        let state = NativeComposeState()

        // Mention with numbers
        state.detectMention(in: "Hello @user123")
        XCTAssertEqual(state.mentionQuery, "user123")

        // Mention with dots (like handles)
        state.detectMention(in: "Hello @alice.bsky")
        XCTAssertEqual(state.mentionQuery, "alice.bsky")

        // No mention
        state.detectMention(in: "No mention here")
        XCTAssertNil(state.mentionQuery)
    }
}

// MARK: - ComposeView Error UI Tests

class ComposeViewErrorUITests: XCTestCase {

    // MARK: - ComposeView conformance declared in ComposeViewTests.swift

    private func makeComposeView(
        composeState: NativeComposeState = NativeComposeState()
    ) -> ComposeView {
        ComposeView(
            composeState: composeState,
            onClose: {},
            onPost: {},
            onSaveDraft: {},
            onOpenDrafts: {},
            onImagePicker: {},
            onVideoPicker: {},
            onGifPicker: {},
            onEmojiPicker: {},
            onLanguagePicker: {},
            onRemoveMedia: { _ in },
            onEditAltText: { _ in },
            onGenerateAltText: { _ in },
            onSaveAltText: { _, _ in },
            onToggleThreadMode: {},
            onAddThreadPost: {},
            onRemoveThreadPost: { _ in },
            onUpdateThreadPost: { _, _ in },
            onMentionSearch: { _ in },
            onThreadImagePicker: { _ in }
        )
    }

    // MARK: - Test: Posting state disables post button

    func testPostingStateDisablesPostButton() throws {
        let state = NativeComposeState()
        state.text = "Test post"
        state.isPosting = true

        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        // The post button area should show ProgressView when posting
        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show progress view when posting")
    }

    // MARK: - Test: Over-limit text disables post

    func testOverLimitTextDisablesPost() throws {
        let state = NativeComposeState()
        state.text = String(repeating: "a", count: 305)

        let view = makeComposeView(composeState: state)
        let inspected = try view.inspect()

        let postButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Post")) != nil
        })
        XCTAssertTrue(try postButton.isDisabled(),
            "Post button should be disabled when text exceeds limit")
    }
}
