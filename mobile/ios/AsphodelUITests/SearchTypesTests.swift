//
//  SearchTypesTests.swift
//  AsphodelUITests
//
//  Unit tests for SearchTypes data parsing and enum behavior.
//

import XCTest
@testable import NativeSearch

// MARK: - SearchTypesTests

class SearchTypesTests: XCTestCase {

    // MARK: - SearchActorResult.fromDict

    func testSearchActorResultFromDictWithAllFieldsPresent() {
        let dict: [String: Any] = [
            "did": "did:plc:actor123",
            "handle": "alice.bsky.social",
            "displayName": "Alice Johnson",
            "avatar": "https://example.com/avatar.jpg",
            "description": "Bluesky enthusiast and developer",
            "isVerified": true
        ]

        let result = SearchActorResult.fromDict(dict)

        XCTAssertEqual(result.id, "did:plc:actor123")
        XCTAssertEqual(result.handle, "alice.bsky.social")
        XCTAssertEqual(result.displayName, "Alice Johnson")
        XCTAssertEqual(result.avatar, "https://example.com/avatar.jpg")
        XCTAssertEqual(result.description, "Bluesky enthusiast and developer")
        XCTAssertTrue(result.isVerified)
    }

    func testSearchActorResultFromDictWithMissingOptionalFields() {
        let dict: [String: Any] = [
            "did": "did:plc:actor456",
            "handle": "bob.bsky.social"
        ]

        let result = SearchActorResult.fromDict(dict)

        XCTAssertEqual(result.id, "did:plc:actor456")
        XCTAssertEqual(result.handle, "bob.bsky.social")
        XCTAssertNil(result.displayName, "displayName should be nil when not provided")
        XCTAssertNil(result.avatar, "avatar should be nil when not provided")
        XCTAssertNil(result.description, "description should be nil when not provided")
        XCTAssertFalse(result.isVerified, "isVerified should default to false")
    }

    func testSearchActorResultFromDictWithMissingDidUsesUUID() {
        let dict: [String: Any] = [
            "handle": "carol.bsky.social",
            "displayName": "Carol Davis"
        ]

        let result = SearchActorResult.fromDict(dict)

        XCTAssertFalse(result.id.isEmpty, "id should not be empty when did is missing")
        XCTAssertNotEqual(result.id, "", "id should be a generated UUID when did is missing")
        // Verify it looks like a UUID (36 chars with hyphens)
        XCTAssertEqual(result.id.count, 36, "Generated UUID string should be 36 characters")
        XCTAssertEqual(result.handle, "carol.bsky.social")
        XCTAssertEqual(result.displayName, "Carol Davis")
    }

    // MARK: - SearchPostResult.fromDict

    func testSearchPostResultFromDictWithNestedDicts() {
        let dict: [String: Any] = [
            "post": [
                "uri": "at://did:plc:author1/app.bsky.feed.post/abc123",
                "indexedAt": "2026-03-10T12:00:00.000Z",
                "likeCount": 42,
                "repostCount": 7,
                "replyCount": 13,
                "author": [
                    "handle": "alice.bsky.social",
                    "displayName": "Alice Johnson",
                    "avatar": "https://example.com/alice-avatar.jpg",
                    "isVerified": true
                ],
                "record": [
                    "text": "Loving the new features on Bluesky!"
                ]
            ] as [String: Any]
        ]

        let result = SearchPostResult.fromDict(dict)

        XCTAssertEqual(result.id, "at://did:plc:author1/app.bsky.feed.post/abc123")
        XCTAssertEqual(result.uri, "at://did:plc:author1/app.bsky.feed.post/abc123")
        XCTAssertEqual(result.authorHandle, "alice.bsky.social")
        XCTAssertEqual(result.authorDisplayName, "Alice Johnson")
        XCTAssertEqual(result.authorAvatar, "https://example.com/alice-avatar.jpg")
        XCTAssertTrue(result.authorIsVerified)
        XCTAssertEqual(result.text, "Loving the new features on Bluesky!")
        XCTAssertEqual(result.indexedAt, "2026-03-10T12:00:00.000Z")
        XCTAssertEqual(result.likeCount, 42)
        XCTAssertEqual(result.repostCount, 7)
        XCTAssertEqual(result.replyCount, 13)
    }

    func testSearchPostResultFromDictWithFlatDict() {
        // When there is no nested "post" key, the dict itself is used as the post
        let dict: [String: Any] = [
            "uri": "at://did:plc:author2/app.bsky.feed.post/flat1",
            "indexedAt": "2026-03-09T08:00:00.000Z",
            "likeCount": 5,
            "repostCount": 1,
            "replyCount": 0,
            "author": [
                "handle": "bob.bsky.social",
                "displayName": "Bob Smith"
            ] as [String: Any],
            "record": [
                "text": "A flat dict post."
            ] as [String: Any]
        ]

        let result = SearchPostResult.fromDict(dict)

        XCTAssertEqual(result.id, "at://did:plc:author2/app.bsky.feed.post/flat1")
        XCTAssertEqual(result.uri, "at://did:plc:author2/app.bsky.feed.post/flat1")
        XCTAssertEqual(result.authorHandle, "bob.bsky.social")
        XCTAssertEqual(result.authorDisplayName, "Bob Smith")
        XCTAssertEqual(result.text, "A flat dict post.")
        XCTAssertEqual(result.indexedAt, "2026-03-09T08:00:00.000Z")
        XCTAssertEqual(result.likeCount, 5)
        XCTAssertEqual(result.repostCount, 1)
        XCTAssertEqual(result.replyCount, 0)
    }

    func testSearchPostResultFromDictWithMissingFieldsDefaultsToEmptyOrZero() {
        let dict: [String: Any] = [:]

        let result = SearchPostResult.fromDict(dict)

        // URI defaults to empty, id falls back to UUID
        XCTAssertEqual(result.uri, "")
        XCTAssertFalse(result.id.isEmpty, "id should fall back to UUID when uri is missing")
        XCTAssertEqual(result.authorHandle, "")
        XCTAssertNil(result.authorDisplayName)
        XCTAssertNil(result.authorAvatar)
        XCTAssertFalse(result.authorIsVerified)
        XCTAssertEqual(result.text, "")
        XCTAssertEqual(result.indexedAt, "")
        XCTAssertEqual(result.likeCount, 0, "likeCount should default to 0")
        XCTAssertEqual(result.repostCount, 0, "repostCount should default to 0")
        XCTAssertEqual(result.replyCount, 0, "replyCount should default to 0")
    }

    // MARK: - TrendingTopic.fromDict

    func testTrendingTopicFromDictWithDisplayName() {
        let dict: [String: Any] = [
            "tag": "swiftui",
            "displayName": "SwiftUI Development"
        ]

        let result = TrendingTopic.fromDict(dict)

        XCTAssertEqual(result.id, "swiftui")
        XCTAssertEqual(result.tag, "swiftui")
        XCTAssertEqual(result.displayName, "SwiftUI Development")
    }

    func testTrendingTopicFromDictWithoutDisplayNameDefaultsToHashTag() {
        let dict: [String: Any] = [
            "tag": "bluesky"
        ]

        let result = TrendingTopic.fromDict(dict)

        XCTAssertEqual(result.id, "bluesky")
        XCTAssertEqual(result.tag, "bluesky")
        XCTAssertEqual(result.displayName, "#bluesky", "displayName should default to '#tag' when not provided")
    }

    func testTrendingTopicFromDictWithEmptyTag() {
        let dict: [String: Any] = [:]

        let result = TrendingTopic.fromDict(dict)

        XCTAssertEqual(result.tag, "")
        XCTAssertEqual(result.id, "")
        XCTAssertEqual(result.displayName, "#", "displayName should be '#' when tag is empty and no displayName provided")
    }

    // MARK: - TrendItem.fromDict

    func testTrendItemFromDictWithAllFields() {
        let dict: [String: Any] = [
            "topic": "SwiftUI",
            "displayName": "SwiftUI Framework",
            "postCount": 1500
        ]

        let result = TrendItem.fromDict(dict)

        XCTAssertEqual(result.id, "SwiftUI")
        XCTAssertEqual(result.topic, "SwiftUI")
        XCTAssertEqual(result.displayName, "SwiftUI Framework")
        XCTAssertEqual(result.postCount, 1500)
    }

    func testTrendItemFromDictWithMissingPostCountDefaultsToZero() {
        let dict: [String: Any] = [
            "topic": "Bluesky",
            "displayName": "Bluesky Social"
        ]

        let result = TrendItem.fromDict(dict)

        XCTAssertEqual(result.id, "Bluesky")
        XCTAssertEqual(result.topic, "Bluesky")
        XCTAssertEqual(result.displayName, "Bluesky Social")
        XCTAssertEqual(result.postCount, 0, "postCount should default to 0 when not provided")
    }

    func testTrendItemFromDictWithMissingDisplayNameDefaultsToTopic() {
        let dict: [String: Any] = [
            "topic": "iOS",
            "postCount": 300
        ]

        let result = TrendItem.fromDict(dict)

        XCTAssertEqual(result.topic, "iOS")
        XCTAssertEqual(result.displayName, "iOS", "displayName should default to topic when not provided")
        XCTAssertEqual(result.postCount, 300)
    }

    // MARK: - SearchTab

    func testSearchTabCasesHaveCorrectLabels() {
        XCTAssertEqual(SearchTab.people.label, "People")
        XCTAssertEqual(SearchTab.posts.label, "Posts")
        XCTAssertEqual(SearchTab.hashtags.label, "Hashtags")
    }

    func testSearchTabAllCasesContainsAllTabs() {
        let allCases = SearchTab.allCases
        XCTAssertEqual(allCases.count, 3, "SearchTab should have exactly 3 cases")
        XCTAssertTrue(allCases.contains(.people))
        XCTAssertTrue(allCases.contains(.posts))
        XCTAssertTrue(allCases.contains(.hashtags))
    }

    func testSearchTabRawValues() {
        XCTAssertEqual(SearchTab.people.rawValue, "people")
        XCTAssertEqual(SearchTab.posts.rawValue, "posts")
        XCTAssertEqual(SearchTab.hashtags.rawValue, "hashtags")
    }

    // MARK: - SearchResults

    func testSearchResultsInitialEmptyState() {
        let results = SearchResults()

        XCTAssertTrue(results.actors.isEmpty, "actors should be empty on init")
        XCTAssertTrue(results.posts.isEmpty, "posts should be empty on init")
        XCTAssertFalse(results.hasMore, "hasMore should be false on init")
    }
}
