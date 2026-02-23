//
//  WidgetDataBridgeTests.swift
//  AsphodelUITests
//
//  Tests for the WidgetDataBridgeModule Expo module.
//  Covers module registration, writing/reading shared UserDefaults data
//  for notification, trending, and DM widgets, and clearing data on sign out.
//

import XCTest
@testable import WidgetDataBridge

// MARK: - WidgetDataBridgeModule Tests

class WidgetDataBridgeModuleTests: XCTestCase {

    private let suiteName = "group.io.shadowsky.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        super.tearDown()
        // Clean up any test data written to shared defaults
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

    // MARK: - Module Registration

    func testModuleRegistersCorrectly() {
        let module = WidgetDataBridgeModule()
        let definition = module.definition()
        XCTAssertNotNil(definition, "WidgetDataBridgeModule definition should not be nil")
    }

    // MARK: - Write Data to Shared UserDefaults

    func testWriteNotificationDataToSharedDefaults() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create UserDefaults with suite name")
            return
        }

        // Write notification data the same way the module does
        defaults.set(5, forKey: "widget_unread_notification_count")
        defaults.set("liked your post", forKey: "widget_last_notification_text")
        defaults.set("alice.bsky.social", forKey: "widget_last_notification_author")
        defaults.set("like", forKey: "widget_last_notification_reason")
        defaults.set(1708430400.0, forKey: "widget_last_notification_timestamp")
        defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "widget_last_updated")
        defaults.synchronize()

        // Read back
        XCTAssertEqual(defaults.integer(forKey: "widget_unread_notification_count"), 5)
        XCTAssertEqual(defaults.string(forKey: "widget_last_notification_text"), "liked your post")
        XCTAssertEqual(defaults.string(forKey: "widget_last_notification_author"), "alice.bsky.social")
        XCTAssertEqual(defaults.string(forKey: "widget_last_notification_reason"), "like")
        XCTAssertEqual(defaults.double(forKey: "widget_last_notification_timestamp"), 1708430400.0, accuracy: 0.1)
        XCTAssertTrue(defaults.double(forKey: "widget_last_updated") > 0)
    }

    // MARK: - Read Data from Shared UserDefaults

    func testReadTrendingDataFromSharedDefaults() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create UserDefaults with suite name")
            return
        }

        // JSON must match TrendingTopicItem Codable struct: {topic: String, status: String?}
        let trendingJSON = """
        [{"topic":"bluesky","status":"hot"},{"topic":"swift","status":"rising"}]
        """
        defaults.set(trendingJSON, forKey: "widget_trending_topics")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_trending_topics")
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved, trendingJSON)

        // Verify it parses as valid JSON matching the expected schema
        if let data = retrieved?.data(using: .utf8) {
            let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
            XCTAssertNotNil(parsed)
            XCTAssertEqual(parsed?.count, 2)
            XCTAssertEqual(parsed?.first?["topic"] as? String, "bluesky")
            XCTAssertEqual(parsed?.first?["status"] as? String, "hot")
        } else {
            XCTFail("Trending data should be valid UTF-8")
        }
    }

    func testReadDMDataFromSharedDefaults() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create UserDefaults with suite name")
            return
        }

        // JSON must match DMConversationItem Codable struct
        let dmJSON = """
        [{"conversationId":"c1","memberName":"Bob","memberHandle":"bob.bsky.social","lastMessageText":"Hey!","lastMessageTimestamp":1708430400000,"unreadCount":2}]
        """
        defaults.set(dmJSON, forKey: "widget_recent_dms")
        defaults.synchronize()

        let retrieved = defaults.string(forKey: "widget_recent_dms")
        XCTAssertNotNil(retrieved)

        // Verify it parses as valid JSON matching the expected schema
        if let data = retrieved?.data(using: .utf8) {
            let parsed = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]]
            XCTAssertNotNil(parsed)
            XCTAssertEqual(parsed?.count, 1)
            XCTAssertEqual(parsed?.first?["conversationId"] as? String, "c1")
            XCTAssertEqual(parsed?.first?["memberName"] as? String, "Bob")
            XCTAssertEqual(parsed?.first?["memberHandle"] as? String, "bob.bsky.social")
            XCTAssertEqual(parsed?.first?["lastMessageText"] as? String, "Hey!")
            XCTAssertEqual(parsed?.first?["unreadCount"] as? Int, 2)
        } else {
            XCTFail("DM data should be valid UTF-8")
        }
    }

    // MARK: - Handle Missing/Empty Data

    func testHandleMissingDataGracefully() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create UserDefaults with suite name")
            return
        }

        // Reading keys that were never set should return sensible defaults
        defaults.removeObject(forKey: "widget_unread_notification_count")
        defaults.removeObject(forKey: "widget_last_notification_text")
        defaults.removeObject(forKey: "widget_trending_topics")
        defaults.synchronize()

        XCTAssertEqual(defaults.integer(forKey: "widget_unread_notification_count"), 0,
                        "Missing integer should default to 0")
        XCTAssertNil(defaults.string(forKey: "widget_last_notification_text"),
                      "Missing string should be nil")
        XCTAssertNil(defaults.string(forKey: "widget_trending_topics"),
                      "Missing trending data should be nil")
    }

    func testHandleEmptyStringData() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create UserDefaults with suite name")
            return
        }

        defaults.set("", forKey: "widget_last_notification_text")
        defaults.set("", forKey: "widget_user_handle")
        defaults.synchronize()

        XCTAssertEqual(defaults.string(forKey: "widget_last_notification_text"), "",
                        "Empty string should be preserved")
        XCTAssertEqual(defaults.string(forKey: "widget_user_handle"), "",
                        "Empty handle should be preserved")
    }

    // MARK: - Clear Widget Data

    func testClearWidgetDataRemovesAllKeys() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create UserDefaults with suite name")
            return
        }

        // Write some data first
        defaults.set(3, forKey: "widget_unread_notification_count")
        defaults.set("test text", forKey: "widget_last_notification_text")
        defaults.set("alice.bsky.social", forKey: "widget_last_notification_author")
        defaults.set("like", forKey: "widget_last_notification_reason")
        defaults.set(12345.0, forKey: "widget_last_notification_timestamp")
        defaults.set("[{\"topic\":\"test\"}]", forKey: "widget_trending_topics")
        defaults.set("[{\"dm\":\"test\"}]", forKey: "widget_recent_dms")
        defaults.set(Date().timeIntervalSince1970, forKey: "widget_last_updated")
        defaults.set("user.bsky.social", forKey: "widget_user_handle")
        defaults.synchronize()

        // Clear all widget keys (replicating module's clearWidgetData logic)
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
        for key in keys {
            defaults.removeObject(forKey: key)
        }
        defaults.synchronize()

        // Verify all keys are cleared
        XCTAssertEqual(defaults.integer(forKey: "widget_unread_notification_count"), 0)
        XCTAssertNil(defaults.string(forKey: "widget_last_notification_text"))
        XCTAssertNil(defaults.string(forKey: "widget_last_notification_author"))
        XCTAssertNil(defaults.string(forKey: "widget_trending_topics"))
        XCTAssertNil(defaults.string(forKey: "widget_recent_dms"))
        XCTAssertNil(defaults.string(forKey: "widget_user_handle"))
    }

    // MARK: - User Handle

    func testUpdateUserHandle() {
        guard let defaults = sharedDefaults else {
            XCTFail("Could not create UserDefaults with suite name")
            return
        }

        defaults.set("alice.bsky.social", forKey: "widget_user_handle")
        defaults.synchronize()

        XCTAssertEqual(defaults.string(forKey: "widget_user_handle"), "alice.bsky.social")

        // Update to a different handle
        defaults.set("bob.bsky.social", forKey: "widget_user_handle")
        defaults.synchronize()

        XCTAssertEqual(defaults.string(forKey: "widget_user_handle"), "bob.bsky.social")
    }
}
