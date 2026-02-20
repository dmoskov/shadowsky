//
//  ComposeToolbarTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for ComposeToolbarView.
//  Tests cover media buttons, thread mode toggle, character count display,
//  and button disable states.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeCompose

// MARK: - ComposeToolbarView Tests

class ComposeToolbarViewTests: XCTestCase {

    /// Helper to build a standard toolbar with sensible defaults
    private func makeToolbar(
        charCount: Int = 0,
        maxLength: Int = 300,
        isThreadMode: Bool = false,
        hasImages: Bool = false,
        hasVideo: Bool = false,
        imageCount: Int = 0,
        selectedLanguages: [String] = ["en"],
        isReply: Bool = false,
        isQuote: Bool = false,
        onImagePicker: @escaping () -> Void = {},
        onVideoPicker: @escaping () -> Void = {},
        onGifPicker: @escaping () -> Void = {},
        onEmojiPicker: @escaping () -> Void = {},
        onToggleThreadMode: @escaping () -> Void = {},
        onLanguagePicker: @escaping () -> Void = {}
    ) -> ComposeToolbarView {
        ComposeToolbarView(
            charCount: charCount,
            maxLength: maxLength,
            isThreadMode: isThreadMode,
            hasImages: hasImages,
            hasVideo: hasVideo,
            imageCount: imageCount,
            selectedLanguages: selectedLanguages,
            isReply: isReply,
            isQuote: isQuote,
            onImagePicker: onImagePicker,
            onVideoPicker: onVideoPicker,
            onGifPicker: onGifPicker,
            onEmojiPicker: onEmojiPicker,
            onToggleThreadMode: onToggleThreadMode,
            onLanguagePicker: onLanguagePicker
        )
    }

    // MARK: - Test: Photo button triggers onImagePicker

    func testPhotoButtonTriggersOnImagePicker() throws {
        var imagePickerCalled = false
        let expectation = expectation(description: "onImagePicker called")

        let view = makeToolbar(onImagePicker: {
            imagePickerCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        // Find the photo button by its accessibility label "Add photo"
        let photoButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.accessibilityLabel().string()) == "Add photo"
        })
        try photoButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(imagePickerCalled, "onImagePicker should be called when photo button is tapped")
    }

    // MARK: - Test: GIF button is visible and triggers callback

    func testGifButtonTriggersOnGifPicker() throws {
        var gifPickerCalled = false
        let expectation = expectation(description: "onGifPicker called")

        let view = makeToolbar(onGifPicker: {
            gifPickerCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        let gifButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.accessibilityLabel().string()) == "Add GIF"
        })
        try gifButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(gifPickerCalled, "onGifPicker should be called when GIF button is tapped")
    }

    // MARK: - Test: Emoji button is visible and triggers callback

    func testEmojiButtonTriggersOnEmojiPicker() throws {
        var emojiPickerCalled = false
        let expectation = expectation(description: "onEmojiPicker called")

        let view = makeToolbar(onEmojiPicker: {
            emojiPickerCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        let emojiButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.accessibilityLabel().string()) == "Add emoji"
        })
        try emojiButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(emojiPickerCalled, "onEmojiPicker should be called when emoji button is tapped")
    }

    // MARK: - Test: Thread button triggers onToggleThreadMode

    func testThreadButtonTriggersOnToggleThreadMode() throws {
        var toggleCalled = false
        let expectation = expectation(description: "onToggleThreadMode called")

        let view = makeToolbar(onToggleThreadMode: {
            toggleCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        let threadButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.accessibilityLabel().string()) == "Thread mode"
        })
        try threadButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(toggleCalled, "onToggleThreadMode should be called when thread button is tapped")
    }

    // MARK: - Test: Thread button hidden for replies and quotes

    func testThreadButtonHiddenForReplies() throws {
        let view = makeToolbar(isReply: true)
        let inspected = try view.inspect()

        // The thread button should not be present when isReply is true
        let threadButtons = try inspected.findAll(ViewType.Button.self).filter { button in
            (try? button.accessibilityLabel().string()) == "Thread mode"
        }
        XCTAssertEqual(threadButtons.count, 0, "Thread mode button should be hidden for replies")
    }

    // MARK: - Test: Photo button disabled when max images reached

    func testPhotoButtonDisabledWhenMaxImagesReached() throws {
        let view = makeToolbar(hasImages: true, imageCount: 4)
        let inspected = try view.inspect()

        let photoButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.accessibilityLabel().string()) == "Add photo"
        })
        XCTAssertTrue(try photoButton.isDisabled(), "Photo button should be disabled when 4 images attached")
    }

    // MARK: - Test: Video button disabled when images present

    func testVideoButtonDisabledWhenImagesPresent() throws {
        let view = makeToolbar(hasImages: true, imageCount: 1)
        let inspected = try view.inspect()

        let videoButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.accessibilityLabel().string()) == "Add video"
        })
        XCTAssertTrue(try videoButton.isDisabled(), "Video button should be disabled when images are attached")
    }

    // MARK: - Test: Character count displays in toolbar

    func testCharacterCountDisplaysInToolbar() throws {
        let view = makeToolbar(charCount: 42, maxLength: 300)
        let inspected = try view.inspect()

        let countText = try inspected.find(text: "42/300")
        XCTAssertNotNil(countText, "Should display character count as '42/300'")
    }

    // MARK: - Test: Thread mode toolbar shows exit button

    func testThreadModeToolbarShowsExitButton() throws {
        var toggleCalled = false
        let expectation = expectation(description: "onToggleThreadMode called")

        let view = makeToolbar(isThreadMode: true, onToggleThreadMode: {
            toggleCalled = true
            expectation.fulfill()
        })
        let inspected = try view.inspect()

        // Thread mode toolbar shows "Exit Thread Mode" text
        let exitText = try inspected.find(text: "Exit Thread Mode")
        XCTAssertNotNil(exitText, "Should show 'Exit Thread Mode' in thread mode toolbar")

        // Tap the exit button
        let exitButton = try inspected.find(ViewType.Button.self)
        try exitButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(toggleCalled, "Tapping exit thread button should call onToggleThreadMode")
    }

    // MARK: - Test: Language picker shows selected language

    func testLanguagePickerShowsSelectedLanguage() throws {
        let view = makeToolbar(selectedLanguages: ["en"])
        let inspected = try view.inspect()

        let langLabel = try inspected.find(text: "EN")
        XCTAssertNotNil(langLabel, "Should display selected language as 'EN'")
    }
}
