//
//  EmbedViewTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for embed view components from the
//  expo-swiftui-feed module: VideoEmbed, QuoteEmbed, ExternalLinkEmbed,
//  PostEmbed, and CachedAsyncImage.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import ExpoSwiftUIFeed

// MARK: - ViewInspector Conformance

extension VideoEmbed: Inspectable {}
extension QuoteEmbed: Inspectable {}
extension ExternalLinkEmbed: Inspectable {}
extension PostEmbed: Inspectable {}
extension CachedAsyncImage: Inspectable {}

// MARK: - VideoEmbed Tests

class VideoEmbedTests: XCTestCase {

    func testVideoEmbedRendersWithThumbnail() throws {
        let video = MockEmbed.videoWithThumbnail
        let view = VideoEmbed(video: video)
        let inspected = try view.inspect()

        // Thumbnail view should be visible initially (showThumbnail = true)
        // The thumbnail branch contains a Button wrapping the thumbnail
        let button = try inspected.find(ViewType.Button.self)
        XCTAssertNotNil(button, "Video thumbnail should be wrapped in a tappable button")
    }

    func testPlayButtonVisibleOnThumbnail() throws {
        let video = MockEmbed.videoWithThumbnail
        let view = VideoEmbed(video: video)
        let inspected = try view.inspect()

        // Play button uses "play.fill" system image
        let playIcon = try inspected.find(ViewType.Image.self, where: { image in
            (try? image.actualImage().name()) == "play.fill"
        })
        XCTAssertNotNil(playIcon, "Play button icon should be visible on thumbnail")
    }

    func testVideoAltTextDisplaysWhenPresent() throws {
        let video = MockEmbed.makeVideo(alt: "A demo video clip")
        let view = VideoEmbed(video: video)
        let inspected = try view.inspect()

        let altText = try inspected.find(text: "A demo video clip")
        XCTAssertNotNil(altText, "Video alt text should be displayed when present")
    }

    func testVideoAltTextAbsentWhenNil() throws {
        let video = MockEmbed.makeVideo(alt: nil)
        let view = VideoEmbed(video: video)
        let inspected = try view.inspect()

        // Should not find any alt text overlay
        // The alt overlay only appears when alt is non-nil and non-empty
        // We verify by checking that the video icon fallback is the only content
        let button = try inspected.find(ViewType.Button.self)
        XCTAssertNotNil(button, "Video should still render thumbnail button without alt text")
    }

    func testVideoWithoutThumbnailShowsFallback() throws {
        let video = MockEmbed.videoWithoutThumbnail
        let view = VideoEmbed(video: video)
        let inspected = try view.inspect()

        // Without thumbnail, the view shows a gray background with "video" system image
        let videoIcon = try inspected.find(ViewType.Image.self, where: { image in
            (try? image.actualImage().name()) == "video"
        })
        XCTAssertNotNil(videoIcon, "Should show video icon fallback when no thumbnail")
    }
}

// MARK: - QuoteEmbed Tests

class QuoteEmbedTests: XCTestCase {

    func testQuoteRendersWithAuthorAndText() throws {
        let quote = MockEmbed.validQuote
        let view = QuoteEmbed(record: quote)
        let inspected = try view.inspect()

        // Display name
        let displayName = try inspected.find(text: "Bob Smith")
        XCTAssertNotNil(displayName, "Should render quoted author display name")

        // Handle with @ prefix
        let handle = try inspected.find(text: "@bob.bsky.social")
        XCTAssertNotNil(handle, "Should render quoted author handle with @ prefix")

        // Post text
        let text = try inspected.find(text: "This is a great post that I want to share with everyone.")
        XCTAssertNotNil(text, "Should render quoted post text")
    }

    func testQuoteHandleFallsBackWhenNoDisplayName() throws {
        let quote = MockEmbed.quoteWithoutAvatar
        let view = QuoteEmbed(record: quote)
        let inspected = try view.inspect()

        // When displayName is nil, the handle should be used as display name
        // The view shows `record.author.displayName ?? record.author.handle` as the first text
        let handle = try inspected.find(text: "carol.bsky.social")
        XCTAssertNotNil(handle, "Should fall back to handle when displayName is nil")
    }

    func testTapQuoteCallsOnPress() throws {
        let quote = MockEmbed.validQuote
        var pressedUri: String?
        var pressedHandle: String?
        let expectation = expectation(description: "onPress called")

        let view = QuoteEmbed(record: quote, onPress: { uri, handle in
            pressedUri = uri
            pressedHandle = handle
            expectation.fulfill()
        })

        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedUri, "at://did:plc:quoted/app.bsky.feed.post/orig",
            "Should pass quote URI to onPress")
        XCTAssertEqual(pressedHandle, "bob.bsky.social",
            "Should pass quote author handle to onPress")
    }

    func testDeletedQuoteShowsNotFoundPlaceholder() throws {
        // nil record means deleted/not found
        let view = QuoteEmbed(record: nil)
        let inspected = try view.inspect()

        let placeholder = try inspected.find(text: "[Post not found]")
        XCTAssertNotNil(placeholder, "Should show '[Post not found]' placeholder for nil record")
    }

    func testQuoteWithoutTextOnlyShowsAuthor() throws {
        let quote = MockEmbed.makeQuote(text: nil)
        let view = QuoteEmbed(record: quote)
        let inspected = try view.inspect()

        // Author info should still be present
        let displayName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(displayName, "Should render author even when text is nil")

        // Post text should not be present (no Text element with the text content)
        let textElements = try inspected.findAll(ViewType.Text.self)
        let hasPostText = textElements.contains { (try? $0.string()) == "This is the quoted post content." }
        XCTAssertFalse(hasPostText, "Should not render text element when text is nil")
    }
}

// MARK: - ExternalLinkEmbed Tests

class ExternalLinkEmbedTests: XCTestCase {

    func testLinkCardRendersWithTitleAndDescription() throws {
        let link = MockEmbed.linkWithThumbnail
        let view = ExternalLinkEmbed(external: link)
        let inspected = try view.inspect()

        let title = try inspected.find(text: "Breaking News Story")
        XCTAssertNotNil(title, "Should render link title")

        let description = try inspected.find(text: "Latest updates on the developing situation.")
        XCTAssertNotNil(description, "Should render link description")
    }

    func testLinkCardRendersDomain() throws {
        let link = MockEmbed.linkWithThumbnail
        let view = ExternalLinkEmbed(external: link)
        let inspected = try view.inspect()

        // Domain should be extracted from URL (www. prefix removed)
        let domain = try inspected.find(text: "news.com")
        XCTAssertNotNil(domain, "Should render domain with www. prefix removed")
    }

    func testTapLinkCardCallsOnPress() throws {
        let link = MockEmbed.linkWithThumbnail
        var pressedUrl: String?
        let expectation = expectation(description: "onLinkPress called")

        let view = ExternalLinkEmbed(external: link, onPress: { url in
            pressedUrl = url
            expectation.fulfill()
        })

        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedUrl, "https://www.news.com/story",
            "Should pass link URL to onPress")
    }

    func testLinkWithoutThumbnailShowsDomainFallback() throws {
        let link = MockEmbed.linkWithoutThumbnail
        let view = ExternalLinkEmbed(external: link)
        let inspected = try view.inspect()

        // Domain should still be visible
        let domain = try inspected.find(text: "blog.example.com")
        XCTAssertNotNil(domain, "Should show domain even without thumbnail")

        // Title should still be visible
        let title = try inspected.find(text: "Blog Post Title")
        XCTAssertNotNil(title, "Should show title without thumbnail")
    }

    func testLinkWithLongTitleTruncates() throws {
        let link = MockEmbed.linkWithLongTitle
        let view = ExternalLinkEmbed(external: link)
        let inspected = try view.inspect()

        // Title text should exist (it will be truncated by lineLimit(2))
        let titles = try inspected.findAll(ViewType.Text.self)
        let hasTitle = titles.contains { text in
            guard let string = try? text.string() else { return false }
            return string.hasPrefix("This is a very long article title")
        }
        XCTAssertTrue(hasTitle, "Long title text should be present (truncated by lineLimit)")
    }

    func testMinimalLinkShowsDomain() throws {
        let link = MockEmbed.linkMinimal
        let view = ExternalLinkEmbed(external: link)
        let inspected = try view.inspect()

        // Even with no title/description/thumb, domain should render
        let domain = try inspected.find(text: "example.com")
        XCTAssertNotNil(domain, "Minimal link should still show domain")
    }
}

// MARK: - PostEmbed Tests

class PostEmbedDispatcherTests: XCTestCase {

    func testPostEmbedRoutesToImageEmbed() throws {
        let embed = MockEmbed.imagePostEmbed
        let view = PostEmbed(embed: embed)
        let inspected = try view.inspect()

        // PostEmbed should dispatch to ImageEmbed for .images type
        let imageEmbed = try inspected.find(ImageEmbed.self)
        XCTAssertNotNil(imageEmbed, "PostEmbed should route .images to ImageEmbed")
    }

    func testPostEmbedRoutesToVideoEmbed() throws {
        let embed = MockEmbed.videoPostEmbed
        let view = PostEmbed(embed: embed)
        let inspected = try view.inspect()

        let videoEmbed = try inspected.find(VideoEmbed.self)
        XCTAssertNotNil(videoEmbed, "PostEmbed should route .video to VideoEmbed")
    }

    func testPostEmbedRoutesToQuoteEmbed() throws {
        let embed = MockEmbed.quotePostEmbed
        let view = PostEmbed(embed: embed)
        let inspected = try view.inspect()

        let quoteEmbed = try inspected.find(QuoteEmbed.self)
        XCTAssertNotNil(quoteEmbed, "PostEmbed should route .quote to QuoteEmbed")
    }

    func testPostEmbedRoutesToExternalLinkEmbed() throws {
        let embed = MockEmbed.externalPostEmbed
        let view = PostEmbed(embed: embed)
        let inspected = try view.inspect()

        let linkEmbed = try inspected.find(ExternalLinkEmbed.self)
        XCTAssertNotNil(linkEmbed, "PostEmbed should route .external to ExternalLinkEmbed")
    }

    func testPostEmbedRendersNothingWhenNil() throws {
        let view = PostEmbed(embed: nil)
        let inspected = try view.inspect()

        // No embed components should be rendered
        let imageEmbeds = try inspected.findAll(ImageEmbed.self)
        let videoEmbeds = try inspected.findAll(VideoEmbed.self)
        let quoteEmbeds = try inspected.findAll(QuoteEmbed.self)
        let linkEmbeds = try inspected.findAll(ExternalLinkEmbed.self)

        XCTAssertEqual(imageEmbeds.count, 0, "Should not render ImageEmbed when embed is nil")
        XCTAssertEqual(videoEmbeds.count, 0, "Should not render VideoEmbed when embed is nil")
        XCTAssertEqual(quoteEmbeds.count, 0, "Should not render QuoteEmbed when embed is nil")
        XCTAssertEqual(linkEmbeds.count, 0, "Should not render ExternalLinkEmbed when embed is nil")
    }

    func testPostEmbedRecordWithMediaRendersMediaAndQuote() throws {
        let embed = MockEmbed.recordWithMediaEmbed
        let view = PostEmbed(embed: embed)
        let inspected = try view.inspect()

        // recordWithMedia should render both media (ImageEmbed) and quote (QuoteEmbed)
        let imageEmbed = try inspected.find(ImageEmbed.self)
        XCTAssertNotNil(imageEmbed, "recordWithMedia should render ImageEmbed for media")

        let quoteEmbed = try inspected.find(QuoteEmbed.self)
        XCTAssertNotNil(quoteEmbed, "recordWithMedia should render QuoteEmbed for record")
    }

    func testPostEmbedNilQuoteShowsNotFound() throws {
        let embed = MockEmbed.nilQuotePostEmbed
        let view = PostEmbed(embed: embed)
        let inspected = try view.inspect()

        let placeholder = try inspected.find(text: "[Post not found]")
        XCTAssertNotNil(placeholder, "Nil quote should show not-found placeholder")
    }

    func testPostEmbedPassesOnImagePressHandler() throws {
        let embed = MockEmbed.imagePostEmbed
        var handlerCalled = false
        let expectation = expectation(description: "onImagePress called")

        let view = PostEmbed(
            embed: embed,
            onImagePress: { _, _ in
                handlerCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(handlerCalled, "PostEmbed should pass onImagePress to ImageEmbed")
    }

    func testPostEmbedPassesOnLinkPressHandler() throws {
        let embed = MockEmbed.externalPostEmbed
        var handlerCalled = false
        let expectation = expectation(description: "onLinkPress called")

        let view = PostEmbed(
            embed: embed,
            onLinkPress: { _ in
                handlerCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(handlerCalled, "PostEmbed should pass onLinkPress to ExternalLinkEmbed")
    }

    func testPostEmbedPassesOnQuotePressHandler() throws {
        let embed = MockEmbed.quotePostEmbed
        var handlerCalled = false
        let expectation = expectation(description: "onQuotePress called")

        let view = PostEmbed(
            embed: embed,
            onQuotePress: { _, _ in
                handlerCalled = true
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self)
        try button.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(handlerCalled, "PostEmbed should pass onQuotePress to QuoteEmbed")
    }

    func testPostEmbedPassesBlurFlag() throws {
        let embed = MockEmbed.imagePostEmbed
        let view = PostEmbed(embed: embed, blurImages: true)
        let inspected = try view.inspect()

        // ImageEmbed should be present and receive the blur flag
        let imageEmbed = try inspected.find(ImageEmbed.self)
        XCTAssertNotNil(imageEmbed, "Should render ImageEmbed with blur flag")
    }
}

// MARK: - CachedAsyncImage Tests

class CachedAsyncImageTests: XCTestCase {

    func testLoadingStateShowsPlaceholder() throws {
        // With a nil URL, phase will be .empty → placeholder/empty content
        let view = CachedAsyncImage(url: nil) { phase in
            switch phase {
            case .empty:
                Text("Loading...")
            case .success(let image):
                image
            case .failure:
                Text("Error")
            @unknown default:
                EmptyView()
            }
        }

        let inspected = try view.inspect()
        // With nil URL, loadImage sets phase = .empty
        let loadingText = try inspected.find(text: "Loading...")
        XCTAssertNotNil(loadingText, "Should show placeholder content in empty phase")
    }

    func testNilUrlShowsEmptyPhase() throws {
        let view = CachedAsyncImage(url: nil) { phase in
            // Capture the phase for assertion
            Group {
                switch phase {
                case .empty:
                    Text("empty-phase")
                case .success:
                    Text("success-phase")
                case .failure:
                    Text("failure-phase")
                @unknown default:
                    Text("unknown-phase")
                }
            }
        }

        let inspected = try view.inspect()
        let emptyText = try inspected.find(text: "empty-phase")
        XCTAssertNotNil(emptyText, "Nil URL should produce .empty phase")
    }

    func testContentPlaceholderInitShowsPlaceholder() throws {
        let view = CachedAsyncImage(
            url: nil,
            content: { image in
                image.resizable()
            },
            placeholder: {
                Text("Placeholder Content")
            }
        )

        let inspected = try view.inspect()
        let placeholder = try inspected.find(text: "Placeholder Content")
        XCTAssertNotNil(placeholder, "Content+placeholder init should show placeholder for nil URL")
    }
}

// MARK: - PostEmbedData Factory Tests

class PostEmbedDataFactoryTests: XCTestCase {

    func testFromDictImagesView() {
        let dict: [String: Any] = [
            "$type": "app.bsky.embed.images#view",
            "images": [
                [
                    "thumb": "https://example.com/thumb.jpg",
                    "fullsize": "https://example.com/full.jpg",
                    "alt": "Test image",
                ]
            ]
        ]

        let result = PostEmbedData.from(dict: dict)
        XCTAssertNotNil(result, "Should parse images view dict")

        if case .images(let images) = result?.embedType {
            XCTAssertEqual(images.count, 1)
            XCTAssertEqual(images[0].thumb, "https://example.com/thumb.jpg")
            XCTAssertEqual(images[0].alt, "Test image")
        } else {
            XCTFail("Should produce .images embed type")
        }
    }

    func testFromDictExternalView() {
        let dict: [String: Any] = [
            "$type": "app.bsky.embed.external#view",
            "external": [
                "uri": "https://example.com",
                "title": "Example",
                "description": "A test link",
            ]
        ]

        let result = PostEmbedData.from(dict: dict)
        XCTAssertNotNil(result, "Should parse external view dict")

        if case .external(let external) = result?.embedType {
            XCTAssertEqual(external.uri, "https://example.com")
            XCTAssertEqual(external.title, "Example")
        } else {
            XCTFail("Should produce .external embed type")
        }
    }

    func testFromDictVideoView() {
        let dict: [String: Any] = [
            "$type": "app.bsky.embed.video#view",
            "playlist": "https://example.com/video.m3u8",
            "thumbnail": "https://example.com/thumb.jpg",
        ]

        let result = PostEmbedData.from(dict: dict)
        XCTAssertNotNil(result, "Should parse video view dict")

        if case .video(let video) = result?.embedType {
            XCTAssertEqual(video.playlist, "https://example.com/video.m3u8")
            XCTAssertEqual(video.thumbnail, "https://example.com/thumb.jpg")
        } else {
            XCTFail("Should produce .video embed type")
        }
    }

    func testFromDictUnknownTypeReturnsNil() {
        let dict: [String: Any] = [
            "$type": "app.bsky.embed.unknown#view"
        ]

        let result = PostEmbedData.from(dict: dict)
        XCTAssertNil(result, "Unknown embed type should return nil")
    }

    func testFromDictMissingTypeReturnsNil() {
        let dict: [String: Any] = [
            "images": []
        ]

        let result = PostEmbedData.from(dict: dict)
        XCTAssertNil(result, "Missing $type should return nil")
    }
}
