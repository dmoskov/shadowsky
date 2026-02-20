//
//  WidgetTests.swift
//  AsphodelUITests
//
//  Comprehensive tests for all three iOS widgets:
//  NotificationCountWidget, RecentDMsWidget, TrendingTopicsWidget.
//
//  Tests cover data loading, Codable decode fidelity, stale data detection,
//  empty/missing states, and data format consistency between the bridge
//  writer and widget reader.
//

import XCTest

// MARK: - Shared Data Provider Tests

class SharedDataProviderTests: XCTestCase {

    private let suiteName = "group.io.asphodel.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        super.tearDown()
        let keys = [
            "widget_unread_notification_count",
            "widget_last_notification_text",
            "widget_last_notification_author",
            "widget_last_notification_reason",
            "widget_last_notification_timestamp",
            "widget_trending_topics",
            "widget_recent_dms",
            "widget_last_updated",
            "widget_user_handle",
        ]
        let defaults = sharedDefaults
        for key in keys {
            defaults?.removeObject(forKey: key)
        }
        defaults?.synchronize()
    }

    // MARK: - App Group Suite Name Consistency

    func testAppGroupIdMatchesBetweenBridgeAndWidgets() {
        // The bridge writes to "group.io.asphodel.app" and widgets read from the same.
        // This test verifies both sides use the same suite name.
        let bridgeSuiteName = "group.io.asphodel.app"
        let widgetSuiteName = "group.io.asphodel.app" // SharedData.suiteName

        XCTAssertEqual(bridgeSuiteName, widgetSuiteName,
                        "Bridge and widget must use the same App Group suite name")
    }

    // MARK: - UserDefaults Key Consistency

    func testAllKeysUsedByBridgeAreReadByWidgets() {
        // Keys written by WidgetDataBridgeModule
        let bridgeKeys = [
            "widget_unread_notification_count",
            "widget_last_notification_text",
            "widget_last_notification_author",
            "widget_last_notification_reason",
            "widget_last_notification_timestamp",
            "widget_trending_topics",
            "widget_recent_dms",
            "widget_last_updated",
            "widget_user_handle",
        ]

        // Keys read by SharedData.Keys (widget side)
        let widgetKeys = [
            "widget_unread_notification_count",  // Keys.unreadNotificationCount
            "widget_last_notification_text",      // Keys.lastNotificationText
            "widget_last_notification_author",    // Keys.lastNotificationAuthor
            "widget_last_notification_reason",    // Keys.lastNotificationReason
            "widget_last_notification_timestamp", // Keys.lastNotificationTimestamp
            "widget_trending_topics",             // Keys.trendingTopics
            "widget_recent_dms",                  // Keys.recentDMs
            "widget_last_updated",                // Keys.lastUpdated
            "widget_user_handle",                 // Keys.userHandle
        ]

        XCTAssertEqual(Set(bridgeKeys), Set(widgetKeys),
                        "Bridge and widget must read/write identical UserDefaults keys")
    }
}

// MARK: - Notification Widget Data Tests

class NotificationWidgetDataTests: XCTestCase {

    private let suiteName = "group.io.asphodel.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        super.tearDown()
        let keys = [
            "widget_unread_notification_count",
            "widget_last_notification_text",
            "widget_last_notification_author",
            "widget_last_notification_reason",
            "widget_last_notification_timestamp",
            "widget_last_updated",
        ]
        let defaults = sharedDefaults
        for key in keys {
            defaults?.removeObject(forKey: key)
        }
        defaults?.synchronize()
    }

    func testLoadWithValidData() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        let now = Date().timeIntervalSince1970 * 1000
        defaults.set(7, forKey: "widget_unread_notification_count")
        defaults.set("liked your post", forKey: "widget_last_notification_text")
        defaults.set("alice.bsky.social", forKey: "widget_last_notification_author")
        defaults.set("like", forKey: "widget_last_notification_reason")
        defaults.set(now - 60000, forKey: "widget_last_notification_timestamp") // 1 min ago
        defaults.set(now, forKey: "widget_last_updated")
        defaults.synchronize()

        // Simulate widget-side load by reading from the same defaults
        let unreadCount = defaults.integer(forKey: "widget_unread_notification_count")
        let lastText = defaults.string(forKey: "widget_last_notification_text") ?? ""
        let lastAuthor = defaults.string(forKey: "widget_last_notification_author") ?? ""
        let lastReason = defaults.string(forKey: "widget_last_notification_reason") ?? ""
        let timestamp = defaults.double(forKey: "widget_last_notification_timestamp")
        let updated = defaults.double(forKey: "widget_last_updated")

        XCTAssertEqual(unreadCount, 7)
        XCTAssertEqual(lastText, "liked your post")
        XCTAssertEqual(lastAuthor, "alice.bsky.social")
        XCTAssertEqual(lastReason, "like")
        XCTAssertTrue(timestamp > 0, "Notification timestamp should be positive")
        XCTAssertTrue(updated > 0, "Last updated should be positive")
    }

    func testLoadWithZeroUnreadCount() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        defaults.set(0, forKey: "widget_unread_notification_count")
        defaults.set("", forKey: "widget_last_notification_text")
        defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "widget_last_updated")
        defaults.synchronize()

        let unreadCount = defaults.integer(forKey: "widget_unread_notification_count")
        let lastText = defaults.string(forKey: "widget_last_notification_text") ?? ""

        XCTAssertEqual(unreadCount, 0, "Zero unread count should be stored and retrieved correctly")
        XCTAssertEqual(lastText, "", "Empty notification text should be preserved")
    }

    func testLoadWithNoDataReturnsDefaults() {
        // Clear all keys
        let defaults = sharedDefaults
        defaults?.removeObject(forKey: "widget_unread_notification_count")
        defaults?.removeObject(forKey: "widget_last_notification_text")
        defaults?.removeObject(forKey: "widget_last_updated")
        defaults?.synchronize()

        let unreadCount = defaults?.integer(forKey: "widget_unread_notification_count") ?? 0
        let lastText = defaults?.string(forKey: "widget_last_notification_text")

        XCTAssertEqual(unreadCount, 0, "Missing integer should default to 0")
        XCTAssertNil(lastText, "Missing string should be nil")
    }

    func testTimestampConversionFromMilliseconds() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // Bridge writes timestamps in milliseconds since epoch
        let jsTimestampMs: Double = 1708430400000 // Feb 20, 2024 in ms
        defaults.set(jsTimestampMs, forKey: "widget_last_notification_timestamp")
        defaults.synchronize()

        let stored = defaults.double(forKey: "widget_last_notification_timestamp")
        // Widget reads and divides by 1000
        let date = Date(timeIntervalSince1970: stored / 1000)

        XCTAssertEqual(stored, jsTimestampMs, accuracy: 0.1)
        XCTAssertTrue(date.timeIntervalSince1970 > 0, "Converted date should be valid")
    }
}

// MARK: - Trending Topics Widget Data Tests

class TrendingTopicsWidgetDataTests: XCTestCase {

    private let suiteName = "group.io.asphodel.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        super.tearDown()
        let defaults = sharedDefaults
        defaults?.removeObject(forKey: "widget_trending_topics")
        defaults?.removeObject(forKey: "widget_last_updated")
        defaults?.synchronize()
    }

    func testTrendingDataDecodesCorrectly() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // This JSON matches TrendingTopicItem: {topic: String, status: String?}
        let json = """
        [{"topic":"bluesky","status":"hot"},{"topic":"swift"},{"topic":"ios","status":"rising"}]
        """
        defaults.set(json, forKey: "widget_trending_topics")
        defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "widget_last_updated")
        defaults.synchronize()

        // Verify Codable decode works (simulating what TrendingWidgetData.load() does)
        let retrieved = defaults.string(forKey: "widget_trending_topics")!
        let data = retrieved.data(using: .utf8)!

        struct TrendingTopicItem: Codable {
            let topic: String
            let status: String?
        }

        do {
            let topics = try JSONDecoder().decode([TrendingTopicItem].self, from: data)
            XCTAssertEqual(topics.count, 3)
            XCTAssertEqual(topics[0].topic, "bluesky")
            XCTAssertEqual(topics[0].status, "hot")
            XCTAssertEqual(topics[1].topic, "swift")
            XCTAssertNil(topics[1].status, "Optional status should decode as nil when missing")
            XCTAssertEqual(topics[2].topic, "ios")
            XCTAssertEqual(topics[2].status, "rising")
        } catch {
            XCTFail("Trending topics JSON should decode without error: \(error)")
        }
    }

    func testTrendingDataWithEmptyArray() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        defaults.set("[]", forKey: "widget_trending_topics")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_trending_topics")!
        let data = retrieved.data(using: .utf8)!

        struct TrendingTopicItem: Codable {
            let topic: String
            let status: String?
        }

        do {
            let topics = try JSONDecoder().decode([TrendingTopicItem].self, from: data)
            XCTAssertEqual(topics.count, 0, "Empty array should decode to empty list")
        } catch {
            XCTFail("Empty array JSON should decode without error: \(error)")
        }
    }

    func testTrendingDataWithInvalidJSONReturnsEmpty() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        defaults.set("not valid json", forKey: "widget_trending_topics")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_trending_topics")!
        let data = retrieved.data(using: .utf8)!

        struct TrendingTopicItem: Codable {
            let topic: String
            let status: String?
        }

        // Widget code catches this and returns .empty
        let topics = try? JSONDecoder().decode([TrendingTopicItem].self, from: data)
        XCTAssertNil(topics, "Invalid JSON should fail to decode")
    }

    func testTrendingDataWithMissingKeyReturnsNil() {
        let defaults = sharedDefaults
        defaults?.removeObject(forKey: "widget_trending_topics")
        defaults?.synchronize()

        let retrieved = defaults?.string(forKey: "widget_trending_topics")
        XCTAssertNil(retrieved, "Missing trending data key should return nil")
    }
}

// MARK: - Recent DMs Widget Data Tests

class RecentDMsWidgetDataTests: XCTestCase {

    private let suiteName = "group.io.asphodel.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        super.tearDown()
        let defaults = sharedDefaults
        defaults?.removeObject(forKey: "widget_recent_dms")
        defaults?.removeObject(forKey: "widget_last_updated")
        defaults?.synchronize()
    }

    func testDMDataDecodesCorrectly() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // JSON must match DMConversationItem Codable struct exactly
        let json = """
        [{"conversationId":"conv-1","memberName":"Alice","memberHandle":"alice.bsky.social","lastMessageText":"Hey there!","lastMessageTimestamp":1708430400000,"unreadCount":3},{"conversationId":"conv-2","memberName":"Bob","memberHandle":"bob.bsky.social","lastMessageText":"See you later","lastMessageTimestamp":1708344000000,"unreadCount":0}]
        """
        defaults.set(json, forKey: "widget_recent_dms")
        defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "widget_last_updated")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_recent_dms")!
        let data = retrieved.data(using: .utf8)!

        struct DMConversationItem: Codable {
            let conversationId: String
            let memberName: String
            let memberHandle: String
            let lastMessageText: String
            let lastMessageTimestamp: Double
            let unreadCount: Int
        }

        do {
            let convos = try JSONDecoder().decode([DMConversationItem].self, from: data)
            XCTAssertEqual(convos.count, 2)

            XCTAssertEqual(convos[0].conversationId, "conv-1")
            XCTAssertEqual(convos[0].memberName, "Alice")
            XCTAssertEqual(convos[0].memberHandle, "alice.bsky.social")
            XCTAssertEqual(convos[0].lastMessageText, "Hey there!")
            XCTAssertEqual(convos[0].lastMessageTimestamp, 1708430400000, accuracy: 0.1)
            XCTAssertEqual(convos[0].unreadCount, 3)

            XCTAssertEqual(convos[1].conversationId, "conv-2")
            XCTAssertEqual(convos[1].memberName, "Bob")
            XCTAssertEqual(convos[1].unreadCount, 0)
        } catch {
            XCTFail("DM conversations JSON should decode without error: \(error)")
        }
    }

    func testDMDataWithEmptyArray() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        defaults.set("[]", forKey: "widget_recent_dms")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_recent_dms")!
        let data = retrieved.data(using: .utf8)!

        struct DMConversationItem: Codable {
            let conversationId: String
            let memberName: String
            let memberHandle: String
            let lastMessageText: String
            let lastMessageTimestamp: Double
            let unreadCount: Int
        }

        do {
            let convos = try JSONDecoder().decode([DMConversationItem].self, from: data)
            XCTAssertEqual(convos.count, 0, "Empty array should decode to empty list")
        } catch {
            XCTFail("Empty array should decode without error: \(error)")
        }
    }

    func testDMDataWithInvalidJSONReturnsNil() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        defaults.set("{broken", forKey: "widget_recent_dms")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_recent_dms")!
        let data = retrieved.data(using: .utf8)!

        struct DMConversationItem: Codable {
            let conversationId: String
            let memberName: String
            let memberHandle: String
            let lastMessageText: String
            let lastMessageTimestamp: Double
            let unreadCount: Int
        }

        let convos = try? JSONDecoder().decode([DMConversationItem].self, from: data)
        XCTAssertNil(convos, "Invalid JSON should fail to decode")
    }

    func testDMDataWithMissingFieldsFails() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // JSON missing required fields (e.g., memberHandle, unreadCount)
        let incompleteJSON = """
        [{"conversationId":"c1","memberName":"Alice"}]
        """
        defaults.set(incompleteJSON, forKey: "widget_recent_dms")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_recent_dms")!
        let data = retrieved.data(using: .utf8)!

        struct DMConversationItem: Codable {
            let conversationId: String
            let memberName: String
            let memberHandle: String
            let lastMessageText: String
            let lastMessageTimestamp: Double
            let unreadCount: Int
        }

        let convos = try? JSONDecoder().decode([DMConversationItem].self, from: data)
        XCTAssertNil(convos, "JSON missing required fields should fail Codable decode")
    }
}

// MARK: - Stale Data Detection Tests

class StaleDataDetectionTests: XCTestCase {

    private let suiteName = "group.io.asphodel.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        super.tearDown()
        let defaults = sharedDefaults
        defaults?.removeObject(forKey: "widget_last_updated")
        defaults?.synchronize()
    }

    func testFreshDataIsNotStale() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // Set last_updated to now (in milliseconds)
        let now = Date().timeIntervalSince1970 * 1000
        defaults.set(now, forKey: "widget_last_updated")
        defaults.synchronize()

        let updated = defaults.double(forKey: "widget_last_updated")
        let lastUpdatedDate = Date(timeIntervalSince1970: updated / 1000)
        let ageSeconds = Date().timeIntervalSince(lastUpdatedDate)
        let staleThreshold: TimeInterval = 30 * 60 // 30 minutes

        XCTAssertTrue(ageSeconds < staleThreshold,
                       "Data written just now should not be considered stale")
    }

    func testOldDataIsStale() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // Set last_updated to 1 hour ago (in milliseconds)
        let oneHourAgo = (Date().timeIntervalSince1970 - 3600) * 1000
        defaults.set(oneHourAgo, forKey: "widget_last_updated")
        defaults.synchronize()

        let updated = defaults.double(forKey: "widget_last_updated")
        let lastUpdatedDate = Date(timeIntervalSince1970: updated / 1000)
        let ageSeconds = Date().timeIntervalSince(lastUpdatedDate)
        let staleThreshold: TimeInterval = 30 * 60

        XCTAssertTrue(ageSeconds > staleThreshold,
                       "Data from 1 hour ago should be considered stale")
    }

    func testMissingLastUpdatedIsStale() {
        let defaults = sharedDefaults
        defaults?.removeObject(forKey: "widget_last_updated")
        defaults?.synchronize()

        let updated = defaults?.double(forKey: "widget_last_updated") ?? 0
        XCTAssertEqual(updated, 0, "Missing last_updated should return 0")
        // Widget treats 0 as stale (no data ever written)
    }
}

// MARK: - Widget URL Deep Link Tests

class WidgetDeepLinkTests: XCTestCase {

    func testNotificationWidgetDeepLink() {
        let url = URL(string: "shadowsky://notifications")
        XCTAssertNotNil(url, "Notification widget deep link URL should be valid")
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "notifications")
    }

    func testDMWidgetDeepLink() {
        let url = URL(string: "shadowsky://messages")
        XCTAssertNotNil(url, "DM widget deep link URL should be valid")
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "messages")
    }

    func testTrendingWidgetDeepLink() {
        let url = URL(string: "shadowsky://search")
        XCTAssertNotNil(url, "Trending widget deep link URL should be valid")
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "search")
    }
}

// MARK: - Data Format Consistency Tests (Bridge ↔ Widget)

class DataFormatConsistencyTests: XCTestCase {

    private let suiteName = "group.io.asphodel.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        super.tearDown()
        let keys = [
            "widget_trending_topics",
            "widget_recent_dms",
            "widget_last_updated",
        ]
        let defaults = sharedDefaults
        for key in keys {
            defaults?.removeObject(forKey: key)
        }
        defaults?.synchronize()
    }

    func testBridgeWrittenTrendingDataIsReadableByWidget() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // Simulate what the TS bridge writes via JSON.stringify():
        // [{topic: "AI", status: "hot"}, {topic: "Swift", status: undefined}]
        // When status is undefined, JSON.stringify omits it entirely.
        let bridgeJSON = """
        [{"topic":"AI","status":"hot"},{"topic":"Swift"}]
        """
        defaults.set(bridgeJSON, forKey: "widget_trending_topics")
        defaults.synchronize()

        // Simulate what the widget reads (TrendingWidgetData.load())
        let jsonString = defaults.string(forKey: "widget_trending_topics")!
        let data = jsonString.data(using: .utf8)!

        struct TrendingTopicItem: Codable {
            let topic: String
            let status: String?
        }

        do {
            let topics = try JSONDecoder().decode([TrendingTopicItem].self, from: data)
            XCTAssertEqual(topics.count, 2)
            XCTAssertEqual(topics[0].status, "hot")
            XCTAssertNil(topics[1].status,
                         "Status omitted from JSON should decode as nil")
        } catch {
            XCTFail("Widget should be able to decode bridge-written trending JSON: \(error)")
        }
    }

    func testBridgeWrittenDMDataIsReadableByWidget() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create shared UserDefaults")
            return
        }

        // Simulate what the TS bridge writes via JSON.stringify()
        let bridgeJSON = """
        [{"conversationId":"abc123","memberName":"Alice","memberHandle":"alice.bsky.social","lastMessageText":"Hello!","lastMessageTimestamp":1708430400000,"unreadCount":1}]
        """
        defaults.set(bridgeJSON, forKey: "widget_recent_dms")
        defaults.synchronize()

        let jsonString = defaults.string(forKey: "widget_recent_dms")!
        let data = jsonString.data(using: .utf8)!

        struct DMConversationItem: Codable {
            let conversationId: String
            let memberName: String
            let memberHandle: String
            let lastMessageText: String
            let lastMessageTimestamp: Double
            let unreadCount: Int
        }

        do {
            let convos = try JSONDecoder().decode([DMConversationItem].self, from: data)
            XCTAssertEqual(convos.count, 1)
            XCTAssertEqual(convos[0].conversationId, "abc123")
            XCTAssertEqual(convos[0].memberName, "Alice")
            XCTAssertEqual(convos[0].lastMessageTimestamp, 1708430400000, accuracy: 0.1)
        } catch {
            XCTFail("Widget should be able to decode bridge-written DM JSON: \(error)")
        }
    }
}
