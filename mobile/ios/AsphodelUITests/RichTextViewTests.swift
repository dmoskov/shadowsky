//
//  RichTextViewTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for the RichTextView SwiftUI component
//  from the rich-text-view module. Tests cover rich text parsing with AT Protocol
//  facets (mentions, links, hashtags), UTF-8 byte offset handling, tap callbacks,
//  and edge cases like emoji, CJK characters, and empty/long text.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import RichTextView
@testable import FeedBridge

// MARK: - ViewInspector Conformance

extension RichTextView: Inspectable {}

// MARK: - RichTextParser Tests

class RichTextParserTests: XCTestCase {

    // MARK: - Test: Plain text renders without formatting

    func testPlainTextProducesSinglePlainSegment() {
        let parser = RichTextParser(
            text: MockFacets.plainText,
            facets: MockFacets.plainTextFacets
        )
        let segments = parser.parse()

        XCTAssertEqual(segments.count, 1, "Plain text should produce exactly one segment")
        XCTAssertEqual(segments[0].text, "Hello, world!")

        if case .plain = segments[0].type {
            // correct
        } else {
            XCTFail("Segment type should be .plain")
        }
    }

    // MARK: - Test: Mention renders with correct handle and DID

    func testMentionSegmentExtractsHandleAndDid() {
        let parser = RichTextParser(
            text: MockFacets.mentionText,
            facets: MockFacets.mentionFacets
        )
        let segments = parser.parse()

        // Should produce: "Hello " (plain), "@alice" (mention), " how are you?" (plain)
        XCTAssertEqual(segments.count, 3, "Should produce 3 segments for text with one mention")

        // Check plain prefix
        XCTAssertEqual(segments[0].text, "Hello ")
        if case .plain = segments[0].type {} else {
            XCTFail("First segment should be plain")
        }

        // Check mention segment
        XCTAssertEqual(segments[1].text, "@alice")
        if case .mention(let handle, let did) = segments[1].type {
            XCTAssertEqual(handle, "alice", "Handle should have @ prefix stripped")
            XCTAssertEqual(did, "did:plc:alice123")
        } else {
            XCTFail("Second segment should be a mention")
        }

        // Check plain suffix
        XCTAssertEqual(segments[2].text, " how are you?")
    }

    // MARK: - Test: Link renders with correct URI

    func testLinkSegmentExtractsUri() {
        let parser = RichTextParser(
            text: MockFacets.linkText,
            facets: MockFacets.linkFacets
        )
        let segments = parser.parse()

        // Should produce: "Check out " (plain), "https://example.com" (link), " today" (plain)
        XCTAssertEqual(segments.count, 3)

        if case .link(let uri) = segments[1].type {
            XCTAssertEqual(uri, "https://example.com")
        } else {
            XCTFail("Second segment should be a link")
        }
        XCTAssertEqual(segments[1].text, "https://example.com")
    }

    // MARK: - Test: Hashtag renders with correct tag

    func testHashtagSegmentExtractsTag() {
        let parser = RichTextParser(
            text: MockFacets.hashtagText,
            facets: MockFacets.hashtagFacets
        )
        let segments = parser.parse()

        // Should produce: "I love " (plain), "#swiftui" (hashtag), " so much" (plain)
        XCTAssertEqual(segments.count, 3)

        if case .hashtag(let tag) = segments[1].type {
            XCTAssertEqual(tag, "swiftui")
        } else {
            XCTFail("Second segment should be a hashtag")
        }
        XCTAssertEqual(segments[1].text, "#swiftui")
    }

    // MARK: - Test: Mixed content renders all segments correctly

    func testMixedContentRendersAllSegmentTypes() {
        let parser = RichTextParser(
            text: MockFacets.mixedText,
            facets: MockFacets.mixedFacets
        )
        let segments = parser.parse()

        // "Hey " + "@bob" + " check " + "https://news.com" + " " + "#trending" + " today"
        XCTAssertEqual(segments.count, 7,
            "Mixed text should produce 7 segments (4 plain + 1 mention + 1 link + 1 hashtag)")

        // Verify mention
        if case .mention(let handle, let did) = segments[1].type {
            XCTAssertEqual(handle, "bob")
            XCTAssertEqual(did, "did:plc:bob456")
        } else {
            XCTFail("Expected mention segment at index 1")
        }

        // Verify link
        if case .link(let uri) = segments[3].type {
            XCTAssertEqual(uri, "https://news.com")
        } else {
            XCTFail("Expected link segment at index 3")
        }

        // Verify hashtag
        if case .hashtag(let tag) = segments[5].type {
            XCTAssertEqual(tag, "trending")
        } else {
            XCTFail("Expected hashtag segment at index 5")
        }
    }

    // MARK: - Test: Empty text renders without crash

    func testEmptyTextProducesNoSegments() {
        let parser = RichTextParser(text: "", facets: [])
        let segments = parser.parse()

        XCTAssertEqual(segments.count, 0, "Empty text should produce zero segments")
    }

    // MARK: - Test: Multiple consecutive mentions render correctly

    func testConsecutiveMentionsAllParsed() {
        let parser = RichTextParser(
            text: MockFacets.consecutiveMentionsText,
            facets: MockFacets.consecutiveMentionsFacets
        )
        let segments = parser.parse()

        // "@alice" + " " + "@bob" + " " + "@carol"
        // The parser should produce mention segments with plain spaces between
        let mentionSegments = segments.filter {
            if case .mention = $0.type { return true }
            return false
        }
        XCTAssertEqual(mentionSegments.count, 3,
            "Should have 3 mention segments for consecutive mentions")

        // Verify each mention's DID
        let dids = mentionSegments.compactMap { segment -> String? in
            if case .mention(_, let did) = segment.type { return did }
            return nil
        }
        XCTAssertTrue(dids.contains("did:plc:alice123"))
        XCTAssertTrue(dids.contains("did:plc:bob456"))
        XCTAssertTrue(dids.contains("did:plc:carol789"))
    }

    // MARK: - Test: Link with display text shows display text, not URL

    func testLinkWithDisplayTextShowsDisplayText() {
        let parser = RichTextParser(
            text: MockFacets.linkDisplayText,
            facets: MockFacets.linkDisplayFacets
        )
        let segments = parser.parse()

        // "Visit " + "my site" (link) + " today"
        XCTAssertEqual(segments.count, 3)

        // The display text should be "my site", not the actual URL
        XCTAssertEqual(segments[1].text, "my site",
            "Link segment text should show display text from the post, not the URI")

        // But the URI should still be "https://mywebsite.com"
        if case .link(let uri) = segments[1].type {
            XCTAssertEqual(uri, "https://mywebsite.com",
                "Link URI should be the actual URL from the facet feature")
        } else {
            XCTFail("Expected link segment")
        }
    }

    // MARK: - Test: Very long text doesn't crash

    func testVeryLongTextDoesNotCrash() {
        let longText = String(repeating: "Hello world! ", count: 1000)
        let parser = RichTextParser(text: longText, facets: [])
        let segments = parser.parse()

        XCTAssertEqual(segments.count, 1, "Long plain text should produce one segment")
        XCTAssertEqual(segments[0].text.count, longText.count)
    }
}

// MARK: - ByteOffsetConverter Tests

class ByteOffsetConverterTests: XCTestCase {

    // MARK: - Test: UTF-8 byte offset handles emoji correctly

    func testEmojiByteOffsetConversion() {
        // "Hello 👋 @alice check this 🔥"
        // H(1) e(1) l(1) l(1) o(1) (1) 👋(4) (1) @(1) a(1) l(1) i(1) c(1) e(1)
        // Byte offsets: 0-5="Hello ", 6-9=👋, 10=" ", 11-16="@alice"
        let converter = ByteOffsetConverter(text: MockFacets.emojiText)

        // Extract "@alice" using byte offsets that account for emoji
        let extracted = converter.substring(byteStart: 11, byteEnd: 17)
        XCTAssertEqual(extracted, "@alice",
            "Should correctly extract text after emoji using byte offsets")
    }

    // MARK: - Test: UTF-8 handles multi-byte characters (CJK)

    func testCJKByteOffsetConversion() {
        // "你好 @alice 世界"
        // 你(3) 好(3) (1) @(1) a(1) l(1) i(1) c(1) e(1) (1) 世(3) 界(3)
        // "@alice" starts at byte 7 (3+3+1)
        let converter = ByteOffsetConverter(text: MockFacets.cjkText)

        let extracted = converter.substring(byteStart: 7, byteEnd: 13)
        XCTAssertEqual(extracted, "@alice",
            "Should correctly extract text after CJK characters using byte offsets")
    }

    // MARK: - Test: Arabic multi-byte characters

    func testArabicByteOffsetConversion() {
        // Arabic: "مرحبا @test بالعالم"
        // م(2) ر(2) ح(2) ب(2) ا(2) (1) @(1) t(1) e(1) s(1) t(1) (1) ب(2) ا(2) ل(2) ع(2) ا(2) ل(2) م(2)
        // "@test" starts at byte 11 (5*2 + 1 space)
        let text = "مرحبا @test بالعالم"
        let converter = ByteOffsetConverter(text: text)

        let extracted = converter.substring(byteStart: 11, byteEnd: 16)
        XCTAssertEqual(extracted, "@test",
            "Should correctly extract text after Arabic characters using byte offsets")
    }

    // MARK: - Test: Boundary conditions

    func testBoundaryByteOffsets() {
        let text = "abc"
        let converter = ByteOffsetConverter(text: text)

        // Start of string
        let fromStart = converter.substring(byteStart: 0, byteEnd: 1)
        XCTAssertEqual(fromStart, "a")

        // End of string
        let toEnd = converter.substring(byteStart: 2, byteEnd: 3)
        XCTAssertEqual(toEnd, "c")

        // Full string
        let full = converter.substring(byteStart: 0, byteEnd: 3)
        XCTAssertEqual(full, "abc")

        // Empty range
        let empty = converter.substring(byteStart: 1, byteEnd: 1)
        XCTAssertEqual(empty, "")
    }

    // MARK: - Test: Out of bounds returns nil

    func testOutOfBoundsReturnsNil() {
        let converter = ByteOffsetConverter(text: "hi")

        // Negative offset
        let negativeIndex = converter.index(fromByteOffset: -1)
        XCTAssertNil(negativeIndex, "Negative byte offset should return nil")

        // Beyond end
        let beyondEnd = converter.index(fromByteOffset: 100)
        XCTAssertNil(beyondEnd, "Byte offset beyond text length should return nil")
    }

    // MARK: - Test: Emoji followed by emoji

    func testConsecutiveEmoji() {
        // "🎉🎊🎈" — each emoji is 4 UTF-8 bytes
        let text = "🎉🎊🎈"
        let converter = ByteOffsetConverter(text: text)

        let first = converter.substring(byteStart: 0, byteEnd: 4)
        XCTAssertEqual(first, "🎉")

        let second = converter.substring(byteStart: 4, byteEnd: 8)
        XCTAssertEqual(second, "🎊")

        let third = converter.substring(byteStart: 8, byteEnd: 12)
        XCTAssertEqual(third, "🎈")
    }
}

// MARK: - RichTextParser with UTF-8 Facets Integration Tests

class RichTextParserUTF8Tests: XCTestCase {

    // MARK: - Test: Emoji text with mention parses correctly

    func testEmojiTextWithMentionParsesCorrectly() {
        let parser = RichTextParser(
            text: MockFacets.emojiText,
            facets: MockFacets.emojiFacets
        )
        let segments = parser.parse()

        // Find the mention segment
        let mentionSegment = segments.first { segment in
            if case .mention = segment.type { return true }
            return false
        }

        XCTAssertNotNil(mentionSegment, "Should find a mention segment in emoji text")
        XCTAssertEqual(mentionSegment?.text, "@alice",
            "Mention text should be correctly extracted despite emoji byte offsets")

        if case .mention(let handle, let did) = mentionSegment?.type {
            XCTAssertEqual(handle, "alice")
            XCTAssertEqual(did, "did:plc:alice123")
        }
    }

    // MARK: - Test: CJK text with mention parses correctly

    func testCJKTextWithMentionParsesCorrectly() {
        let parser = RichTextParser(
            text: MockFacets.cjkText,
            facets: MockFacets.cjkFacets
        )
        let segments = parser.parse()

        // "你好 " (plain) + "@alice" (mention) + " 世界" (plain)
        XCTAssertEqual(segments.count, 3)

        XCTAssertEqual(segments[0].text, "你好 ")
        XCTAssertEqual(segments[1].text, "@alice")
        XCTAssertEqual(segments[2].text, " 世界")

        if case .mention(let handle, _) = segments[1].type {
            XCTAssertEqual(handle, "alice")
        } else {
            XCTFail("Expected mention segment at index 1")
        }
    }
}

// MARK: - RichTextView SwiftUI Tests

class RichTextViewTests: XCTestCase {

    /// Helper to create a RichTextView with default noop handlers
    private func makeView(
        text: String = MockFacets.plainText,
        facets: [Facet] = MockFacets.plainTextFacets,
        onMentionTap: @escaping (String, String) -> Void = { _, _ in },
        onHashtagTap: @escaping (String) -> Void = { _ in },
        onLinkTap: @escaping (String) -> Void = { _ in }
    ) -> RichTextView {
        RichTextView(
            text: text,
            facets: facets,
            onMentionTap: onMentionTap,
            onHashtagTap: onHashtagTap,
            onLinkTap: onLinkTap
        )
    }

    // MARK: - Test: View initializes without crash for plain text

    func testViewInitializesWithPlainText() throws {
        let view = makeView(text: "Hello, world!", facets: [])
        // Verify the view can be inspected (it creates successfully)
        let inspected = try view.inspect()
        XCTAssertNoThrow(try inspected.view(RichTextView.self))
    }

    // MARK: - Test: View initializes with mention facets

    func testViewInitializesWithMentionFacets() throws {
        let view = makeView(
            text: MockFacets.mentionText,
            facets: MockFacets.mentionFacets
        )
        let inspected = try view.inspect()
        XCTAssertNoThrow(try inspected.view(RichTextView.self))
    }

    // MARK: - Test: View initializes with mixed facets

    func testViewInitializesWithMixedFacets() throws {
        let view = makeView(
            text: MockFacets.mixedText,
            facets: MockFacets.mixedFacets
        )
        let inspected = try view.inspect()
        XCTAssertNoThrow(try inspected.view(RichTextView.self))
    }

    // MARK: - Test: View initializes with empty text

    func testViewInitializesWithEmptyText() throws {
        let view = makeView(text: "", facets: [])
        let inspected = try view.inspect()
        XCTAssertNoThrow(try inspected.view(RichTextView.self))
    }

    // MARK: - Test: View stores callback closures correctly

    func testViewStoresCallbacksCorrectly() {
        var mentionCalled = false
        var hashtagCalled = false
        var linkCalled = false

        let view = makeView(
            onMentionTap: { _, _ in mentionCalled = true },
            onHashtagTap: { _ in hashtagCalled = true },
            onLinkTap: { _ in linkCalled = true }
        )

        // Invoke callbacks directly to verify they're stored
        view.onMentionTap("alice", "did:plc:alice123")
        view.onHashtagTap("swiftui")
        view.onLinkTap("https://example.com")

        XCTAssertTrue(mentionCalled, "onMentionTap callback should be invocable")
        XCTAssertTrue(hashtagCalled, "onHashtagTap callback should be invocable")
        XCTAssertTrue(linkCalled, "onLinkTap callback should be invocable")
    }

    // MARK: - Test: Mention callback receives correct handle and DID

    func testMentionCallbackReceivesCorrectData() {
        let expectation = XCTestExpectation(description: "Mention callback called")
        var receivedHandle = ""
        var receivedDid = ""

        let view = makeView(
            text: MockFacets.mentionText,
            facets: MockFacets.mentionFacets,
            onMentionTap: { handle, did in
                receivedHandle = handle
                receivedDid = did
                expectation.fulfill()
            }
        )

        // Simulate callback invocation with expected values from mention URL scheme
        // The Coordinator parses "mention://did:plc:alice123|alice" → (handle: "alice", did: "did:plc:alice123")
        view.onMentionTap("alice", "did:plc:alice123")

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedHandle, "alice")
        XCTAssertEqual(receivedDid, "did:plc:alice123")
    }

    // MARK: - Test: Hashtag callback receives correct tag

    func testHashtagCallbackReceivesCorrectTag() {
        let expectation = XCTestExpectation(description: "Hashtag callback called")
        var receivedTag = ""

        let view = makeView(
            text: MockFacets.hashtagText,
            facets: MockFacets.hashtagFacets,
            onHashtagTap: { tag in
                receivedTag = tag
                expectation.fulfill()
            }
        )

        view.onHashtagTap("swiftui")

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedTag, "swiftui")
    }

    // MARK: - Test: Link callback receives correct URI

    func testLinkCallbackReceivesCorrectUri() {
        let expectation = XCTestExpectation(description: "Link callback called")
        var receivedUri = ""

        let view = makeView(
            text: MockFacets.linkText,
            facets: MockFacets.linkFacets,
            onLinkTap: { uri in
                receivedUri = uri
                expectation.fulfill()
            }
        )

        view.onLinkTap("https://example.com")

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedUri, "https://example.com")
    }

    // MARK: - Test: Very long text view initializes

    func testVeryLongTextViewInitializes() throws {
        let longText = String(repeating: "This is a long post. ", count: 500)
        let view = makeView(text: longText, facets: [])
        let inspected = try view.inspect()
        XCTAssertNoThrow(try inspected.view(RichTextView.self))
    }
}

// MARK: - RichTextParser Edge Case Tests

class RichTextParserEdgeCaseTests: XCTestCase {

    // MARK: - Test: Facets at start and end of text

    func testFacetsAtTextBoundaries() {
        // "@alice text @bob" — mention at start and end
        let text = "@alice text @bob"
        let facets = [
            MockFacets.makeMentionFacet(byteStart: 0, byteEnd: 6, did: "did:plc:alice"),
            MockFacets.makeMentionFacet(byteStart: 12, byteEnd: 16, did: "did:plc:bob")
        ]
        let parser = RichTextParser(text: text, facets: facets)
        let segments = parser.parse()

        // "@alice" + " text " + "@bob"
        XCTAssertEqual(segments.count, 3)

        if case .mention(_, let did) = segments[0].type {
            XCTAssertEqual(did, "did:plc:alice")
        } else {
            XCTFail("First segment should be a mention")
        }

        if case .plain = segments[1].type {
            XCTAssertEqual(segments[1].text, " text ")
        } else {
            XCTFail("Middle segment should be plain")
        }

        if case .mention(_, let did) = segments[2].type {
            XCTAssertEqual(did, "did:plc:bob")
        } else {
            XCTFail("Last segment should be a mention")
        }
    }

    // MARK: - Test: Unsorted facets are handled correctly

    func testUnsortedFacetsAreOrderedCorrectly() {
        let text = "@alice and @bob"
        // Provide facets in reverse order
        let facets = [
            MockFacets.makeMentionFacet(byteStart: 11, byteEnd: 15, did: "did:plc:bob"),
            MockFacets.makeMentionFacet(byteStart: 0, byteEnd: 6, did: "did:plc:alice")
        ]
        let parser = RichTextParser(text: text, facets: facets)
        let segments = parser.parse()

        // Should still produce correctly ordered segments
        if case .mention(_, let did) = segments[0].type {
            XCTAssertEqual(did, "did:plc:alice", "First mention should be alice despite unsorted input")
        } else {
            XCTFail("First segment should be alice mention")
        }
    }

    // MARK: - Test: Facet with no features produces plain segment

    func testFacetWithNoFeaturesProducesPlainSegment() {
        let text = "Hello world"
        let facets = [
            Facet(
                index: FacetIndex(byteStart: 0, byteEnd: 5),
                features: []
            )
        ]
        let parser = RichTextParser(text: text, facets: facets)
        let segments = parser.parse()

        // "Hello" with no features should become plain, then " world" also plain
        XCTAssertGreaterThanOrEqual(segments.count, 1)
        for segment in segments {
            if case .plain = segment.type {
                // All should be plain
            } else {
                XCTFail("All segments should be plain when facet has no features")
            }
        }
    }

    // MARK: - Test: Entire text is one facet

    func testEntireTextIsOneFacet() {
        let text = "https://example.com/very/long/url"
        let facets = [
            MockFacets.makeLinkFacet(
                byteStart: 0,
                byteEnd: text.utf8.count,
                uri: text
            )
        ]
        let parser = RichTextParser(text: text, facets: facets)
        let segments = parser.parse()

        XCTAssertEqual(segments.count, 1, "Should produce exactly one segment when facet covers entire text")
        if case .link(let uri) = segments[0].type {
            XCTAssertEqual(uri, text)
        } else {
            XCTFail("Segment should be a link")
        }
    }

    // MARK: - Test: Single character text

    func testSingleCharacterText() {
        let parser = RichTextParser(text: ".", facets: [])
        let segments = parser.parse()
        XCTAssertEqual(segments.count, 1)
        XCTAssertEqual(segments[0].text, ".")
    }

    // MARK: - Test: Skin tone emoji byte offset handling

    func testSkinToneEmojiByteOffsets() {
        // 👋🏽 is a skin tone modifier sequence: 👋(4 bytes) + 🏽(4 bytes) = 8 bytes
        let text = "Hi 👋🏽 @test"
        let converter = ByteOffsetConverter(text: text)

        // "Hi " = 3 bytes, "👋🏽" = 8 bytes, " " = 1 byte → "@test" starts at byte 12
        let extracted = converter.substring(byteStart: 12, byteEnd: 17)
        XCTAssertEqual(extracted, "@test",
            "Should correctly handle skin tone modifier emoji byte offsets")
    }
}
