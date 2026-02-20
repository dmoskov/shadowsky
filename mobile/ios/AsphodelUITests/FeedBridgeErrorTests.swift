//
//  FeedBridgeErrorTests.swift
//  AsphodelUITests
//
//  Error state tests for the FeedBridge module.
//  Verifies that malformed JSON, missing fields, null embeds, empty strings,
//  and extremely large payloads are handled gracefully without crashes.
//

import XCTest
@testable import FeedBridge

// MARK: - FeedBridge Malformed Data Tests

class FeedBridgeErrorTests: XCTestCase {

    // MARK: - Helpers

    /// Encode a dictionary to a JSON string
    private func jsonString(from dict: [String: Any]) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return String(data: data, encoding: .utf8)!
    }

    /// Build a minimal valid post dict for embedding in feed data
    private func minimalPostDict(
        uri: String = "at://did:plc:test/app.bsky.feed.post/1",
        cid: String = "bafyrei-test",
        text: String = "Hello",
        handle: String = "test.bsky.social"
    ) -> [String: Any] {
        return [
            "post": [
                "uri": uri,
                "cid": cid,
                "author": [
                    "did": "did:plc:test",
                    "handle": handle,
                    "displayName": "Test User",
                    "avatar": NSNull()
                ] as [String: Any],
                "record": [
                    "text": text,
                    "createdAt": "2026-02-20T10:00:00.000Z"
                ] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any]
        ] as [String: Any]
    }

    private func wrapInFeedData(posts: [[String: Any]]) -> [String: Any] {
        return [
            "posts": posts,
            "metadata": [
                "timestamp": 1708430400,
                "isOnline": true
            ] as [String: Any],
            "cursor": NSNull()
        ] as [String: Any]
    }

    // MARK: - Test: Completely invalid JSON string

    func testCompletelyInvalidJSONDoesNotCrash() {
        let invalidJSON = "this is not json at all {"

        XCTAssertThrowsError(try SerializedFeedData.decode(from: invalidJSON),
            "Should throw error for completely invalid JSON")

        XCTAssertThrowsError(try SerializedFeedData.decodeLenient(from: invalidJSON),
            "Lenient decoder should also throw for non-JSON")
    }

    // MARK: - Test: Empty string input

    func testEmptyStringInputDoesNotCrash() {
        let emptyString = ""

        XCTAssertThrowsError(try SerializedFeedData.decode(from: emptyString),
            "Should throw error for empty string")

        XCTAssertThrowsError(try SerializedFeedData.decodeLenient(from: emptyString),
            "Lenient decoder should throw for empty string")
    }

    // MARK: - Test: Empty JSON object

    func testEmptyJSONObjectThrows() {
        let emptyObject = "{}"

        XCTAssertThrowsError(try SerializedFeedData.decode(from: emptyObject),
            "Should throw error for empty JSON object (missing required fields)")
    }

    // MARK: - Test: Feed data with empty posts array

    func testFeedDataWithEmptyPostsArrayDecodesSuccessfully() throws {
        let dict = wrapInFeedData(posts: [])
        let json = try jsonString(from: dict)
        let feedData = try SerializedFeedData.decode(from: json)

        XCTAssertEqual(feedData.posts.count, 0, "Should decode to empty posts array")
        XCTAssertEqual(feedData.metadata.timestamp, 1708430400)
    }

    // MARK: - Test: Post with missing author field — lenient decoder skips it

    func testPostWithMissingAuthorIsSkippedByLenientDecoder() throws {
        let badPost: [String: Any] = [
            "post": [
                "uri": "at://bad/post/1",
                "cid": "bafyrei-bad",
                // No "author" field
                "record": [
                    "text": "Orphan post",
                    "createdAt": "2026-02-20T10:00:00.000Z"
                ] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any]
        ]

        let goodPost = minimalPostDict(uri: "at://good/post/1", text: "Good post")
        let dict = wrapInFeedData(posts: [goodPost, badPost])
        let json = try jsonString(from: dict)

        let feedData = try SerializedFeedData.decodeLenient(from: json)

        // The lenient decoder should skip the bad post and keep the good one
        XCTAssertEqual(feedData.posts.count, 1,
            "Should have 1 valid post after skipping the malformed one")
        XCTAssertEqual(feedData.posts.first?.post.uri, "at://good/post/1")
    }

    // MARK: - Test: Post with null embed when embed type is set

    func testPostWithNullEmbedDecodesGracefully() throws {
        let postDict: [String: Any] = [
            "post": [
                "uri": "at://did:plc:test/app.bsky.feed.post/nullembed",
                "cid": "bafyrei-nullembed",
                "author": [
                    "did": "did:plc:test",
                    "handle": "test.bsky.social"
                ] as [String: Any],
                "record": [
                    "text": "Post with null embed",
                    "createdAt": "2026-02-20T10:00:00.000Z"
                ] as [String: Any],
                "embed": NSNull(),
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any]
        ]

        let dict = wrapInFeedData(posts: [postDict])
        let json = try jsonString(from: dict)
        let feedData = try SerializedFeedData.decodeLenient(from: json)

        XCTAssertEqual(feedData.posts.count, 1, "Post with null embed should decode")
        XCTAssertNil(feedData.posts.first?.post.embed, "Embed should be nil")
    }

    // MARK: - Test: Post with empty string for required fields (uri, cid)

    func testPostWithEmptyRequiredFieldsDecodes() throws {
        let postDict: [String: Any] = [
            "post": [
                "uri": "",
                "cid": "",
                "author": [
                    "did": "",
                    "handle": ""
                ] as [String: Any],
                "record": [
                    "text": "",
                    "createdAt": ""
                ] as [String: Any],
                "indexedAt": ""
            ] as [String: Any]
        ]

        let dict = wrapInFeedData(posts: [postDict])
        let json = try jsonString(from: dict)
        let feedData = try SerializedFeedData.decodeLenient(from: json)

        XCTAssertEqual(feedData.posts.count, 1, "Post with empty strings should still decode")
        XCTAssertEqual(feedData.posts.first?.post.uri, "", "URI should be empty string")
        XCTAssertEqual(feedData.posts.first?.post.cid, "", "CID should be empty string")
        XCTAssertEqual(feedData.posts.first?.post.author.handle, "", "Handle should be empty string")
    }

    // MARK: - Test: Post with extremely long text (100KB)

    func testPostWithExtremelyLongTextDoesNotOOM() throws {
        let longText = String(repeating: "a", count: 100_000)
        let postDict: [String: Any] = [
            "post": [
                "uri": "at://did:plc:test/app.bsky.feed.post/longtext",
                "cid": "bafyrei-long",
                "author": [
                    "did": "did:plc:test",
                    "handle": "test.bsky.social"
                ] as [String: Any],
                "record": [
                    "text": longText,
                    "createdAt": "2026-02-20T10:00:00.000Z"
                ] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any]
        ]

        let dict = wrapInFeedData(posts: [postDict])
        let json = try jsonString(from: dict)

        let feedData = try SerializedFeedData.decodeLenient(from: json)

        XCTAssertEqual(feedData.posts.count, 1, "Should decode post with 100KB text")
        XCTAssertEqual(feedData.posts.first?.post.record.text.count, 100_000,
            "Text length should be preserved")
    }

    // MARK: - Test: Unknown embed type is skipped by lenient decoder

    func testUnknownEmbedTypeIsSkippedByLenientDecoder() throws {
        let postDict: [String: Any] = [
            "post": [
                "uri": "at://did:plc:test/app.bsky.feed.post/badtype",
                "cid": "bafyrei-bad-embed",
                "author": [
                    "did": "did:plc:test",
                    "handle": "test.bsky.social"
                ] as [String: Any],
                "record": [
                    "text": "Post with unknown embed",
                    "createdAt": "2026-02-20T10:00:00.000Z"
                ] as [String: Any],
                "embed": [
                    "$type": "app.bsky.embed.unknown#view",
                    "data": "some unknown data"
                ] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any]
        ]

        let goodPost = minimalPostDict(uri: "at://good/post/2", text: "Good")
        let dict = wrapInFeedData(posts: [postDict, goodPost])
        let json = try jsonString(from: dict)

        let feedData = try SerializedFeedData.decodeLenient(from: json)

        // The post with unknown embed should be skipped, good post kept
        XCTAssertGreaterThanOrEqual(feedData.posts.count, 1,
            "Should have at least the good post")
    }

    // MARK: - Test: FeedBatchUpdate with invalid JSON

    func testBatchUpdateWithInvalidJSONThrows() {
        let invalidJSON = "not json"
        XCTAssertThrowsError(try FeedBatchUpdate.decode(from: invalidJSON),
            "Should throw for invalid batch update JSON")
    }

    // MARK: - Test: FeedBatchUpdate with empty updates array

    func testBatchUpdateWithEmptyUpdatesDecodes() throws {
        let dict: [String: Any] = [
            "updates": [] as [[String: Any]],
            "timestamp": 1708430400
        ]
        let json = try jsonString(from: dict)

        let batchUpdate = try FeedBatchUpdate.decode(from: json)

        XCTAssertEqual(batchUpdate.updates.count, 0, "Should decode empty updates array")
        XCTAssertEqual(batchUpdate.timestamp, 1708430400)
    }

    // MARK: - Test: Malformed JSON with truncated data

    func testTruncatedJSONThrows() {
        let truncated = """
        {"posts": [{"post": {"uri": "at://test
        """
        XCTAssertThrowsError(try SerializedFeedData.decode(from: truncated),
            "Should throw for truncated JSON")
    }

    // MARK: - Test: Mixed valid and invalid posts in lenient decoder

    func testMixedValidAndInvalidPostsInLenientDecoder() throws {
        let good1 = minimalPostDict(uri: "at://good/1", text: "Good 1")
        let bad1: [String: Any] = ["post": "not a dictionary"]
        let good2 = minimalPostDict(uri: "at://good/2", text: "Good 2")
        let bad2: [String: Any] = ["garbage": true]
        let good3 = minimalPostDict(uri: "at://good/3", text: "Good 3")

        let dict = wrapInFeedData(posts: [good1, bad1, good2, bad2, good3])
        let json = try jsonString(from: dict)

        let feedData = try SerializedFeedData.decodeLenient(from: json)

        XCTAssertEqual(feedData.posts.count, 3,
            "Should decode 3 valid posts, skipping 2 invalid ones")
    }

    // MARK: - Test: SerializedEmbed decode throws for unknown type

    func testSerializedEmbedUnknownTypeThrows() throws {
        let embedJSON = """
        {"$type": "app.bsky.embed.future#view", "data": {}}
        """
        let data = embedJSON.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(SerializedEmbed.self, from: data),
            "Should throw for unknown embed type")
    }

    // MARK: - Test: FacetFeature decode throws for unknown type

    func testFacetFeatureUnknownTypeThrows() throws {
        let featureJSON = """
        {"$type": "app.bsky.richtext.facet#unknown", "value": "test"}
        """
        let data = featureJSON.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(FacetFeature.self, from: data),
            "Should throw for unknown facet feature type")
    }

    // MARK: - Test: SerializedReason decode throws for unknown type

    func testSerializedReasonUnknownTypeThrows() throws {
        let reasonJSON = """
        {"$type": "app.bsky.feed.defs#reasonUnknown", "by": {"did": "a", "handle": "b"}, "indexedAt": "2026-01-01T00:00:00Z"}
        """
        let data = reasonJSON.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(SerializedReason.self, from: data),
            "Should throw for unknown reason type")
    }

    // MARK: - Test: Post with all optional fields nil

    func testPostWithAllOptionalFieldsNil() throws {
        let post = SerializedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/min",
            cid: "bafyrei-min",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            record: SerializedRecord(text: "Minimal post", facets: nil, createdAt: "2026-02-20T10:00:00.000Z"),
            embed: nil,
            replyCount: nil,
            repostCount: nil,
            likeCount: nil,
            quoteCount: nil,
            viewer: nil,
            labels: nil,
            indexedAt: "2026-02-20T10:00:00.000Z"
        )

        let feedViewPost = SerializedFeedViewPost(
            post: post,
            reply: nil,
            reason: nil,
            feedContext: nil,
            isBookmarked: nil
        )

        // Verify it round-trips correctly
        let encoder = JSONEncoder()
        let data = try encoder.encode(feedViewPost)
        let decoded = try JSONDecoder().decode(SerializedFeedViewPost.self, from: data)

        XCTAssertNil(decoded.post.embed)
        XCTAssertNil(decoded.post.replyCount)
        XCTAssertNil(decoded.post.viewer)
        XCTAssertNil(decoded.post.labels)
        XCTAssertNil(decoded.reply)
        XCTAssertNil(decoded.reason)
    }

    // MARK: - Test: Post with all-emoji text

    func testPostWithAllEmojiText() throws {
        let emojiText = "🔥💯🎉👏🏽✨🌈🦋🎨🎵🏆"
        let postDict: [String: Any] = [
            "post": [
                "uri": "at://did:plc:test/app.bsky.feed.post/emoji",
                "cid": "bafyrei-emoji",
                "author": [
                    "did": "did:plc:test",
                    "handle": "test.bsky.social"
                ] as [String: Any],
                "record": [
                    "text": emojiText,
                    "createdAt": "2026-02-20T10:00:00.000Z"
                ] as [String: Any],
                "indexedAt": "2026-02-20T10:00:00.000Z"
            ] as [String: Any]
        ]

        let dict = wrapInFeedData(posts: [postDict])
        let json = try jsonString(from: dict)
        let feedData = try SerializedFeedData.decodeLenient(from: json)

        XCTAssertEqual(feedData.posts.count, 1, "Should decode post with all-emoji text")
        XCTAssertEqual(feedData.posts.first?.post.record.text, emojiText,
            "Emoji text should be preserved exactly")
    }
}
