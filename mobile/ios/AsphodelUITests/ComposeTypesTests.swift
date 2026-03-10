//
//  ComposeTypesTests.swift
//  AsphodelUITests
//
//  Unit tests for compose data type parsing (fromDict/toDict).
//

import XCTest
@testable import NativeCompose

// MARK: - MediaAttachment Tests

class MediaAttachmentTests: XCTestCase {

    // MARK: - Test: fromDict with all fields

    func testFromDictWithAllFields() {
        let dict: [String: Any] = [
            "id": "attachment-1",
            "uri": "https://example.com/photo.jpg",
            "mimeType": "image/png",
            "altText": "A beautiful landscape",
            "width": 1920,
            "height": 1080,
            "isVideo": false,
            "thumbnail": "https://example.com/thumb.jpg",
            "duration": 0.0,
        ]

        let attachment = MediaAttachment.fromDict(dict)
        XCTAssertNotNil(attachment, "Should create attachment when all fields are present")
        XCTAssertEqual(attachment?.id, "attachment-1")
        XCTAssertEqual(attachment?.uri, "https://example.com/photo.jpg")
        XCTAssertEqual(attachment?.mimeType, "image/png")
        XCTAssertEqual(attachment?.altText, "A beautiful landscape")
        XCTAssertEqual(attachment?.width, 1920)
        XCTAssertEqual(attachment?.height, 1080)
        XCTAssertFalse(attachment!.isVideo)
        XCTAssertEqual(attachment?.thumbnail, "https://example.com/thumb.jpg")
        XCTAssertEqual(attachment?.duration, 0.0)
    }

    // MARK: - Test: fromDict with only uri uses defaults for other fields

    func testFromDictWithOnlyUri() {
        let dict: [String: Any] = [
            "uri": "https://example.com/image.jpg",
        ]

        let attachment = MediaAttachment.fromDict(dict)
        XCTAssertNotNil(attachment, "Should create attachment with just uri")
        XCTAssertEqual(attachment?.uri, "https://example.com/image.jpg")
        // id should be auto-generated (non-empty UUID)
        XCTAssertFalse(attachment!.id.isEmpty, "Should auto-generate a non-empty id")
    }

    // MARK: - Test: fromDict returns nil when uri is missing

    func testFromDictReturnsNilWhenUriMissing() {
        let dict: [String: Any] = [
            "id": "no-uri",
            "mimeType": "image/png",
            "altText": "Some text",
            "width": 800,
            "height": 600,
        ]

        let attachment = MediaAttachment.fromDict(dict)
        XCTAssertNil(attachment, "Should return nil when uri is missing from dict")
    }

    // MARK: - Test: fromDict default values

    func testFromDictDefaultValues() {
        let dict: [String: Any] = [
            "uri": "https://example.com/image.jpg",
        ]

        let attachment = MediaAttachment.fromDict(dict)
        XCTAssertNotNil(attachment)
        XCTAssertEqual(attachment?.mimeType, "image/jpeg", "Default mimeType should be image/jpeg")
        XCTAssertEqual(attachment?.altText, "", "Default altText should be empty string")
        XCTAssertEqual(attachment?.width, 0, "Default width should be 0")
        XCTAssertEqual(attachment?.height, 0, "Default height should be 0")
        XCTAssertFalse(attachment!.isVideo, "Default isVideo should be false")
    }

    // MARK: - Test: toDict includes all non-nil fields

    func testToDictIncludesAllNonNilFields() {
        let attachment = MediaAttachment(
            id: "img-1",
            uri: "https://example.com/photo.jpg",
            mimeType: "image/png",
            altText: "Sunset over the ocean",
            width: 1200,
            height: 800,
            isVideo: false,
            thumbnail: "https://example.com/thumb.jpg",
            duration: 5.5
        )

        let dict = attachment.toDict()

        XCTAssertEqual(dict["id"] as? String, "img-1")
        XCTAssertEqual(dict["uri"] as? String, "https://example.com/photo.jpg")
        XCTAssertEqual(dict["mimeType"] as? String, "image/png")
        XCTAssertEqual(dict["altText"] as? String, "Sunset over the ocean")
        XCTAssertEqual(dict["width"] as? Int, 1200)
        XCTAssertEqual(dict["height"] as? Int, 800)
        XCTAssertEqual(dict["isVideo"] as? Bool, false)
        XCTAssertEqual(dict["thumbnail"] as? String, "https://example.com/thumb.jpg")
        XCTAssertEqual(dict["duration"] as? Double, 5.5)
    }

    // MARK: - Test: toDict omits nil thumbnail and duration

    func testToDictOmitsNilThumbnailAndDuration() {
        let attachment = MediaAttachment(
            id: "img-2",
            uri: "https://example.com/photo.jpg",
            mimeType: "image/jpeg",
            altText: "",
            width: 640,
            height: 480,
            isVideo: false,
            thumbnail: nil,
            duration: nil
        )

        let dict = attachment.toDict()

        XCTAssertNil(dict["thumbnail"], "thumbnail should be omitted when nil")
        XCTAssertNil(dict["duration"], "duration should be omitted when nil")
        // Ensure required fields are still present
        XCTAssertNotNil(dict["id"])
        XCTAssertNotNil(dict["uri"])
        XCTAssertNotNil(dict["mimeType"])
        XCTAssertNotNil(dict["altText"])
        XCTAssertNotNil(dict["width"])
        XCTAssertNotNil(dict["height"])
        XCTAssertNotNil(dict["isVideo"])
    }

    // MARK: - Test: toDict includes thumbnail and duration when set

    func testToDictIncludesThumbnailAndDurationWhenSet() {
        let attachment = MediaAttachment(
            id: "vid-1",
            uri: "https://example.com/video.mp4",
            mimeType: "video/mp4",
            altText: "A short clip",
            width: 1920,
            height: 1080,
            isVideo: true,
            thumbnail: "https://example.com/video-thumb.jpg",
            duration: 30.0
        )

        let dict = attachment.toDict()

        XCTAssertEqual(dict["thumbnail"] as? String, "https://example.com/video-thumb.jpg",
            "thumbnail should be included when set")
        XCTAssertEqual(dict["duration"] as? Double, 30.0,
            "duration should be included when set")
        XCTAssertEqual(dict["isVideo"] as? Bool, true)
    }

    // MARK: - Test: fromDict -> toDict round trip

    func testFromDictToDictRoundTrip() {
        let originalDict: [String: Any] = [
            "id": "round-trip-1",
            "uri": "https://example.com/roundtrip.jpg",
            "mimeType": "image/webp",
            "altText": "Round trip test image",
            "width": 1024,
            "height": 768,
            "isVideo": false,
            "thumbnail": "https://example.com/roundtrip-thumb.jpg",
            "duration": 12.5,
        ]

        let attachment = MediaAttachment.fromDict(originalDict)
        XCTAssertNotNil(attachment, "Should create attachment from dict")

        let resultDict = attachment!.toDict()

        XCTAssertEqual(resultDict["id"] as? String, originalDict["id"] as? String)
        XCTAssertEqual(resultDict["uri"] as? String, originalDict["uri"] as? String)
        XCTAssertEqual(resultDict["mimeType"] as? String, originalDict["mimeType"] as? String)
        XCTAssertEqual(resultDict["altText"] as? String, originalDict["altText"] as? String)
        XCTAssertEqual(resultDict["width"] as? Int, originalDict["width"] as? Int)
        XCTAssertEqual(resultDict["height"] as? Int, originalDict["height"] as? Int)
        XCTAssertEqual(resultDict["isVideo"] as? Bool, originalDict["isVideo"] as? Bool)
        XCTAssertEqual(resultDict["thumbnail"] as? String, originalDict["thumbnail"] as? String)
        XCTAssertEqual(resultDict["duration"] as? Double, originalDict["duration"] as? Double)
    }
}

// MARK: - ReplyContext Tests

class ReplyContextTests: XCTestCase {

    // MARK: - Test: fromDict with all fields

    func testFromDictWithAllFields() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/reply1",
            "cid": "bafyreireply1",
            "authorHandle": "alice.bsky.social",
            "authorDisplayName": "Alice Johnson",
            "authorAvatar": "https://example.com/alice-avatar.jpg",
            "text": "This is the original post text",
        ]

        let context = ReplyContext.fromDict(dict)
        XCTAssertNotNil(context, "Should create ReplyContext when all fields are present")
        XCTAssertEqual(context?.uri, "at://did:plc:author1/app.bsky.feed.post/reply1")
        XCTAssertEqual(context?.cid, "bafyreireply1")
        XCTAssertEqual(context?.authorHandle, "alice.bsky.social")
        XCTAssertEqual(context?.authorDisplayName, "Alice Johnson")
        XCTAssertEqual(context?.authorAvatar, "https://example.com/alice-avatar.jpg")
        XCTAssertEqual(context?.text, "This is the original post text")
    }

    // MARK: - Test: fromDict returns nil when uri missing

    func testFromDictReturnsNilWhenUriMissing() {
        let dict: [String: Any] = [
            "cid": "bafyreireply1",
            "authorHandle": "alice.bsky.social",
            "text": "Some text",
        ]

        let context = ReplyContext.fromDict(dict)
        XCTAssertNil(context, "Should return nil when uri is missing")
    }

    // MARK: - Test: fromDict returns nil when cid missing

    func testFromDictReturnsNilWhenCidMissing() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/reply1",
            "authorHandle": "alice.bsky.social",
            "text": "Some text",
        ]

        let context = ReplyContext.fromDict(dict)
        XCTAssertNil(context, "Should return nil when cid is missing")
    }

    // MARK: - Test: fromDict returns nil when authorHandle missing

    func testFromDictReturnsNilWhenAuthorHandleMissing() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/reply1",
            "cid": "bafyreireply1",
            "text": "Some text",
        ]

        let context = ReplyContext.fromDict(dict)
        XCTAssertNil(context, "Should return nil when authorHandle is missing")
    }

    // MARK: - Test: fromDict defaults text to empty string when missing

    func testFromDictDefaultsTextToEmptyWhenMissing() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/reply1",
            "cid": "bafyreireply1",
            "authorHandle": "alice.bsky.social",
        ]

        let context = ReplyContext.fromDict(dict)
        XCTAssertNotNil(context, "Should create ReplyContext without text field")
        XCTAssertEqual(context?.text, "", "text should default to empty string when missing")
        XCTAssertNil(context?.authorDisplayName, "authorDisplayName should be nil when missing")
        XCTAssertNil(context?.authorAvatar, "authorAvatar should be nil when missing")
    }
}

// MARK: - QuoteContext Tests

class QuoteContextTests: XCTestCase {

    // MARK: - Test: fromDict with all fields

    func testFromDictWithAllFields() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/quote1",
            "cid": "bafyreiquote1",
            "authorHandle": "bob.bsky.social",
            "authorDisplayName": "Bob Smith",
            "authorAvatar": "https://example.com/bob-avatar.jpg",
            "text": "Post being quoted here",
        ]

        let context = QuoteContext.fromDict(dict)
        XCTAssertNotNil(context, "Should create QuoteContext when all fields are present")
        XCTAssertEqual(context?.uri, "at://did:plc:author1/app.bsky.feed.post/quote1")
        XCTAssertEqual(context?.cid, "bafyreiquote1")
        XCTAssertEqual(context?.authorHandle, "bob.bsky.social")
        XCTAssertEqual(context?.authorDisplayName, "Bob Smith")
        XCTAssertEqual(context?.authorAvatar, "https://example.com/bob-avatar.jpg")
        XCTAssertEqual(context?.text, "Post being quoted here")
    }

    // MARK: - Test: fromDict returns nil when uri missing

    func testFromDictReturnsNilWhenUriMissing() {
        let dict: [String: Any] = [
            "cid": "bafyreiquote1",
            "authorHandle": "bob.bsky.social",
        ]

        let context = QuoteContext.fromDict(dict)
        XCTAssertNil(context, "Should return nil when uri is missing")
    }

    // MARK: - Test: fromDict returns nil when cid missing

    func testFromDictReturnsNilWhenCidMissing() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/quote1",
            "authorHandle": "bob.bsky.social",
        ]

        let context = QuoteContext.fromDict(dict)
        XCTAssertNil(context, "Should return nil when cid is missing")
    }

    // MARK: - Test: fromDict returns nil when authorHandle missing

    func testFromDictReturnsNilWhenAuthorHandleMissing() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/quote1",
            "cid": "bafyreiquote1",
        ]

        let context = QuoteContext.fromDict(dict)
        XCTAssertNil(context, "Should return nil when authorHandle is missing")
    }

    // MARK: - Test: fromDict defaults text to empty string when missing

    func testFromDictDefaultsTextToEmptyWhenMissing() {
        let dict: [String: Any] = [
            "uri": "at://did:plc:author1/app.bsky.feed.post/quote1",
            "cid": "bafyreiquote1",
            "authorHandle": "bob.bsky.social",
        ]

        let context = QuoteContext.fromDict(dict)
        XCTAssertNotNil(context, "Should create QuoteContext without text field")
        XCTAssertEqual(context?.text, "", "text should default to empty string when missing")
        XCTAssertNil(context?.authorDisplayName, "authorDisplayName should be nil when missing")
        XCTAssertNil(context?.authorAvatar, "authorAvatar should be nil when missing")
    }
}

// MARK: - DraftData Tests

class DraftDataTests: XCTestCase {

    // MARK: - Test: toDict includes text and images array

    func testToDictIncludesTextAndImagesArray() {
        let images = [
            MockCompose.makeMediaAttachment(id: "img-1", uri: "https://example.com/a.jpg", altText: "First"),
            MockCompose.makeMediaAttachment(id: "img-2", uri: "https://example.com/b.jpg", altText: "Second"),
        ]
        let draft = DraftData(id: "draft-1", text: "Hello world", images: images)

        let dict = draft.toDict()

        XCTAssertEqual(dict["text"] as? String, "Hello world")

        let imagesArray = dict["images"] as? [[String: Any]]
        XCTAssertNotNil(imagesArray, "images should be an array of dictionaries")
        XCTAssertEqual(imagesArray?.count, 2, "Should contain 2 image dictionaries")
        XCTAssertEqual(imagesArray?[0]["id"] as? String, "img-1")
        XCTAssertEqual(imagesArray?[1]["id"] as? String, "img-2")
        XCTAssertEqual(imagesArray?[0]["altText"] as? String, "First")
        XCTAssertEqual(imagesArray?[1]["altText"] as? String, "Second")
    }

    // MARK: - Test: toDict includes id when present, omits when nil

    func testToDictIncludesIdWhenPresent() {
        let draft = DraftData(id: "draft-42", text: "My draft", images: [])

        let dict = draft.toDict()

        XCTAssertEqual(dict["id"] as? String, "draft-42", "id should be included when present")
        XCTAssertEqual(dict["text"] as? String, "My draft")
    }

    func testToDictOmitsIdWhenNil() {
        let draft = DraftData(id: nil, text: "No id draft", images: [])

        let dict = draft.toDict()

        XCTAssertNil(dict["id"], "id should be omitted when nil")
        XCTAssertEqual(dict["text"] as? String, "No id draft")

        let imagesArray = dict["images"] as? [[String: Any]]
        XCTAssertNotNil(imagesArray, "images should be present even when empty")
        XCTAssertEqual(imagesArray?.count, 0, "images array should be empty")
    }
}
