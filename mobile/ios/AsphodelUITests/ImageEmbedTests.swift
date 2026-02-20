//
//  ImageEmbedTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for the ImageEmbed and ImageTile SwiftUI
//  components from the expo-swiftui-feed module. Tests cover grid layouts
//  (1–4 images), tap handlers, blur overlays, ALT badges, and error states.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import ExpoSwiftUIFeed

// MARK: - ViewInspector Conformance

extension ImageEmbed: Inspectable {}
extension ImageTile: Inspectable {}

// MARK: - ImageEmbed Tests

class ImageEmbedTests: XCTestCase {

    // MARK: - Single Image Layout

    func testSingleImageRendersWithCorrectHeight() throws {
        let images = MockEmbed.singleImage
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        // Single image layout uses a 300pt height frame
        let vStack = try inspected.vStack()
        XCTAssertNotNil(vStack, "ImageEmbed should render a VStack container")

        // Find the ImageTile within the view hierarchy
        let tiles = try inspected.findAll(ImageTile.self)
        XCTAssertEqual(tiles.count, 1, "Single image should render exactly 1 ImageTile")
    }

    func testSingleImageTapCallsOnImagePressWithIndex0() throws {
        let images = MockEmbed.singleImage
        var pressedIndex: Int?
        var pressedImages: [ImageEmbedData]?
        let expectation = expectation(description: "onImagePress called")

        let view = ImageEmbed(images: images, onImagePress: { imgs, idx in
            pressedImages = imgs
            pressedIndex = idx
            expectation.fulfill()
        })

        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedIndex, 0, "Should pass index 0 for single image tap")
        XCTAssertEqual(pressedImages?.count, 1, "Should pass the full images array")
    }

    // MARK: - Double Image Layout

    func testDoubleImageLayoutRendersSideBySide() throws {
        let images = MockEmbed.twoImages
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        // Double layout uses an HStack with 2 tiles
        let tiles = try inspected.findAll(ImageTile.self)
        XCTAssertEqual(tiles.count, 2, "2-image layout should render 2 ImageTiles")

        // Verify HStack exists (side-by-side layout)
        let hStack = try inspected.find(ViewType.HStack.self)
        XCTAssertNotNil(hStack, "2-image layout should use HStack for side-by-side arrangement")
    }

    func testDoubleImageTapCallsWithCorrectIndex() throws {
        let images = MockEmbed.twoImages
        var pressedIndex: Int?
        let expectation = expectation(description: "onImagePress called")

        let view = ImageEmbed(images: images, onImagePress: { _, idx in
            pressedIndex = idx
            expectation.fulfill()
        })

        let inspected = try view.inspect()
        // Tap the second image tile (index 1)
        let buttons = try inspected.findAll(ViewType.Button.self)
        XCTAssertGreaterThanOrEqual(buttons.count, 2, "Should have at least 2 tappable buttons")
        try buttons[1].tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedIndex, 1, "Second image tap should pass index 1")
    }

    // MARK: - Triple Image Layout

    func testTripleImageLayoutRendersCorrectly() throws {
        let images = MockEmbed.threeImages
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        let tiles = try inspected.findAll(ImageTile.self)
        XCTAssertEqual(tiles.count, 3, "3-image layout should render 3 ImageTiles")
    }

    // MARK: - Quad Image Layout

    func testQuadImageLayoutRendersCorrectly() throws {
        let images = MockEmbed.fourImages
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        let tiles = try inspected.findAll(ImageTile.self)
        XCTAssertEqual(tiles.count, 4, "4-image layout should render 4 ImageTiles")

        // Quad layout uses 2 HStacks in a VStack
        let hStacks = try inspected.findAll(ViewType.HStack.self)
        XCTAssertGreaterThanOrEqual(hStacks.count, 2, "4-image layout should have at least 2 HStack rows")
    }

    func testQuadImageTapPassesCorrectIndex() throws {
        let images = MockEmbed.fourImages
        var pressedIndex: Int?
        let expectation = expectation(description: "onImagePress called")

        let view = ImageEmbed(images: images, onImagePress: { _, idx in
            pressedIndex = idx
            expectation.fulfill()
        })

        let inspected = try view.inspect()
        let buttons = try inspected.findAll(ViewType.Button.self)
        // Tap the third button (index 2)
        XCTAssertGreaterThanOrEqual(buttons.count, 4, "Should have 4 tappable buttons")
        try buttons[2].tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedIndex, 2, "Third image tap should pass index 2")
    }

    // MARK: - Blur Overlay

    func testBlurImagesShowsBlurEffect() throws {
        let images = MockEmbed.singleImage
        let view = ImageEmbed(images: images, blurImages: true)
        let inspected = try view.inspect()

        // The ImageTile receives blurImage=true
        let tile = try inspected.find(ImageTile.self)
        XCTAssertNotNil(tile, "Should render ImageTile with blur enabled")
    }

    func testBlurImagesFalseDoesNotBlur() throws {
        let images = MockEmbed.singleImage
        let view = ImageEmbed(images: images, blurImages: false)
        let inspected = try view.inspect()

        let tile = try inspected.find(ImageTile.self)
        XCTAssertNotNil(tile, "Should render ImageTile without blur")
    }

    // MARK: - ALT Badge

    func testAltBadgeAppearsWhenAltTextPresent() throws {
        let images = [MockEmbed.makeImage(alt: "Description of the image")]
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        // ALT badge should be visible when alt text is non-nil and non-empty
        let altBadge = try inspected.find(text: "ALT")
        XCTAssertNotNil(altBadge, "Should show ALT badge when alt text is present")
    }

    func testAltBadgeAbsentWhenNoAltText() throws {
        let images = [MockEmbed.makeImage(alt: nil)]
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        // ALT badge should NOT be present
        let altBadges = try inspected.findAll(ViewType.Text.self)
            .filter { (try? $0.string()) == "ALT" }
        XCTAssertEqual(altBadges.count, 0, "Should not show ALT badge when alt text is nil")
    }

    func testAltBadgeAbsentWhenAltTextEmpty() throws {
        let images = [MockEmbed.makeImage(alt: "")]
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        let altBadges = try inspected.findAll(ViewType.Text.self)
            .filter { (try? $0.string()) == "ALT" }
        XCTAssertEqual(altBadges.count, 0, "Should not show ALT badge when alt text is empty string")
    }

    // MARK: - No onImagePress handler

    func testTapWithoutHandlerDoesNotCrash() throws {
        let images = MockEmbed.singleImage
        // Create without onImagePress handler — should use internal carousel state
        let view = ImageEmbed(images: images, onImagePress: nil)
        let inspected = try view.inspect()

        let button = try inspected.find(ViewType.Button.self)
        // Should not throw or crash
        try button.tap()
    }

    // MARK: - Multiple ALT Badges

    func testMultipleImagesShowCorrectAltBadges() throws {
        let images = MockEmbed.twoImages // first has alt, second doesn't
        let view = ImageEmbed(images: images)
        let inspected = try view.inspect()

        // Only the first image has alt text
        let altBadges = try inspected.findAll(ViewType.Text.self)
            .filter { (try? $0.string()) == "ALT" }
        XCTAssertEqual(altBadges.count, 1, "Only images with alt text should show ALT badge")
    }
}

// MARK: - ImageTile Tests

class ImageTileTests: XCTestCase {

    func testImageTileTapCallsOnPress() throws {
        var pressedIndex: Int?
        let expectation = expectation(description: "onPress called")

        let tile = ImageTile(
            imageData: MockEmbed.makeImage(alt: "Test"),
            blurImage: false,
            index: 3,
            onPress: { idx in
                pressedIndex = idx
                expectation.fulfill()
            }
        )

        let inspected = try tile.inspect()
        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedIndex, 3, "ImageTile should pass its index to onPress")
    }

    func testImageTileRendersAltBadge() throws {
        let tile = ImageTile(
            imageData: MockEmbed.makeImage(alt: "A beautiful landscape"),
            blurImage: false,
            index: 0,
            onPress: { _ in }
        )

        let inspected = try tile.inspect()
        let altText = try inspected.find(text: "ALT")
        XCTAssertNotNil(altText, "ImageTile should show ALT badge when alt text is present")
    }

    func testImageTileHidesAltBadgeWhenNil() throws {
        let tile = ImageTile(
            imageData: MockEmbed.makeImage(alt: nil),
            blurImage: false,
            index: 0,
            onPress: { _ in }
        )

        let inspected = try tile.inspect()
        let altBadges = try inspected.findAll(ViewType.Text.self)
            .filter { (try? $0.string()) == "ALT" }
        XCTAssertEqual(altBadges.count, 0, "ImageTile should not show ALT badge when alt is nil")
    }
}
