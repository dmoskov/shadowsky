//
//  NotificationsErrorTests.swift
//  AsphodelUITests
//
//  Error state and edge case tests for the NotificationBridge and
//  NativeNotificationsList modules. Tests cover malformed notification data,
//  missing actors, unknown reason types, aggregated notifications with
//  many actors, and the lenient decoder.
//

import XCTest
@testable import NotificationBridge
@testable import FeedBridge
@testable import NativeNotificationsList

// MARK: - NotificationBridge Decode Error Tests

class NotificationBridgeDecodeErrorTests: XCTestCase {

    // MARK: - Helpers

    private func jsonString(from dict: [String: Any]) throws -> String {
        let data = try JSONSerialization.data(withJSONObject: dict)
        return String(data: data, encoding: .utf8)!
    }

    // MARK: - Test: Completely invalid JSON does not crash

    func testCompletelyInvalidJSONDoesNotCrash() {
        XCTAssertThrowsError(try SerializedNotificationData.decode(from: "not json"),
            "Should throw for invalid JSON")
        XCTAssertThrowsError(try SerializedNotificationData.decodeLenient(from: "not json"),
            "Lenient decoder should throw for non-JSON")
    }

    // MARK: - Test: Empty string throws

    func testEmptyStringThrows() {
        XCTAssertThrowsError(try SerializedNotificationData.decode(from: ""),
            "Should throw for empty string")
    }

    // MARK: - Test: Empty JSON object throws

    func testEmptyJSONObjectThrows() {
        XCTAssertThrowsError(try SerializedNotificationData.decode(from: "{}"),
            "Should throw for empty object (missing required fields)")
    }

    // MARK: - Test: Empty notifications array decodes

    func testEmptyNotificationsArrayDecodes() throws {
        let dict: [String: Any] = [
            "notifications": [] as [[String: Any]],
            "metadata": ["timestamp": 1708430400, "isOnline": true] as [String: Any],
            "cursor": NSNull()
        ]
        let json = try jsonString(from: dict)

        let data = try SerializedNotificationData.decode(from: json)
        XCTAssertEqual(data.notifications.count, 0)
        XCTAssertNil(data.cursor)
    }

    // MARK: - Test: Notification with missing author — strict throws, lenient skips

    func testNotificationWithMissingAuthor() throws {
        let dict: [String: Any] = [
            "notifications": [
                [
                    "type": "single",
                    "notification": [
                        "uri": "at://bad/notif/1",
                        "cid": "bafyrei-bad",
                        // Missing "author" — required field
                        "reason": "like",
                        "isRead": false,
                        "indexedAt": "2026-02-20T12:00:00.000Z"
                    ] as [String: Any]
                ],
                [
                    "type": "single",
                    "notification": [
                        "uri": "at://good/notif/1",
                        "cid": "bafyrei-good",
                        "author": [
                            "did": "did:plc:good",
                            "handle": "good.bsky.social"
                        ] as [String: Any],
                        "reason": "follow",
                        "isRead": true,
                        "indexedAt": "2026-02-20T13:00:00.000Z"
                    ] as [String: Any]
                ]
            ],
            "metadata": ["timestamp": 1708430400, "isOnline": true] as [String: Any],
            "cursor": NSNull()
        ]
        let json = try jsonString(from: dict)

        // Strict decode should fail
        XCTAssertThrowsError(try SerializedNotificationData.decode(from: json))

        // Lenient decode should skip the bad one, keep the good one
        let result = try SerializedNotificationData.decodeLenient(from: json)
        XCTAssertEqual(result.data.notifications.count, 1,
            "Lenient decoder should skip malformed notification")
        XCTAssertEqual(result.skippedCount, 1, "Should report 1 skipped notification")
    }

    // MARK: - Test: Unknown notification type is skipped by lenient decoder

    func testUnknownNotificationTypeSkippedByLenientDecoder() throws {
        let dict: [String: Any] = [
            "notifications": [
                [
                    "type": "future_type",
                    "someField": "value"
                ],
                [
                    "type": "single",
                    "notification": [
                        "uri": "at://good/notif/2",
                        "cid": "bafyrei-good2",
                        "author": ["did": "did:plc:good2", "handle": "good2.bsky.social"] as [String: Any],
                        "reason": "like",
                        "isRead": false,
                        "indexedAt": "2026-02-20T12:00:00.000Z"
                    ] as [String: Any]
                ]
            ],
            "metadata": ["timestamp": 1708430400, "isOnline": true] as [String: Any],
            "cursor": NSNull()
        ]
        let json = try jsonString(from: dict)

        let result = try SerializedNotificationData.decodeLenient(from: json)
        XCTAssertEqual(result.data.notifications.count, 1,
            "Should skip unknown type and keep valid notification")
        XCTAssertEqual(result.skippedCount, 1, "Should report 1 skipped notification")
    }

    // MARK: - Test: ProcessedSerializedNotification unknown type throws

    func testProcessedSerializedNotificationUnknownTypeThrows() throws {
        let json = """
        {"type": "brand_new_type", "data": {}}
        """
        let data = json.data(using: .utf8)!

        XCTAssertThrowsError(try JSONDecoder().decode(ProcessedSerializedNotification.self, from: data),
            "Should throw for unknown notification type")
    }

    // MARK: - Test: Aggregated notification with 100+ actors

    func testAggregatedNotificationWith100PlusActors() throws {
        var users: [[String: Any]] = []
        var notifications: [[String: Any]] = []

        for i in 0..<105 {
            let user: [String: Any] = [
                "did": "did:plc:user\(i)",
                "handle": "user\(i).bsky.social"
            ]
            users.append(user)

            let notif: [String: Any] = [
                "uri": "at://did:plc:user\(i)/app.bsky.feed.like/like\(i)",
                "cid": "bafyrei-\(i)",
                "author": user,
                "reason": "like",
                "isRead": false,
                "indexedAt": "2026-02-20T12:00:00.000Z"
            ]
            notifications.append(notif)
        }

        let aggDict: [String: Any] = [
            "type": "aggregated",
            "reason": "like",
            "count": 105,
            "users": users,
            "latestTimestamp": "2026-02-20T12:00:00.000Z",
            "notifications": notifications,
            "targetPostUri": "at://did:plc:me/app.bsky.feed.post/popular"
        ]

        let fullDict: [String: Any] = [
            "notifications": [aggDict],
            "metadata": ["timestamp": 1708430400, "isOnline": true] as [String: Any],
            "cursor": NSNull()
        ]
        let json = try jsonString(from: fullDict)

        let result = try SerializedNotificationData.decodeLenient(from: json)
        let data = result.data
        XCTAssertEqual(data.notifications.count, 1, "Should decode the aggregated notification")

        if case .aggregated(let agg) = data.notifications.first {
            XCTAssertEqual(agg.count, 105, "Should have count of 105")
            XCTAssertEqual(agg.users.count, 105, "Should have 105 users")
            XCTAssertEqual(agg.notifications.count, 105, "Should have 105 inner notifications")
        } else {
            XCTFail("Expected aggregated notification")
        }
    }

    // MARK: - Test: Notification with nil optional fields

    func testNotificationWithNilOptionalFields() throws {
        let notification = SerializedNotification(
            uri: "at://test/notif/1",
            cid: "bafyrei-test",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            reason: "follow",
            reasonSubject: nil,
            record: nil,
            isRead: false,
            indexedAt: "2026-02-20T12:00:00.000Z",
            labels: nil,
            postPreview: nil
        )

        let encoded = try JSONEncoder().encode(notification)
        let decoded = try JSONDecoder().decode(SerializedNotification.self, from: encoded)

        XCTAssertNil(decoded.reasonSubject)
        XCTAssertNil(decoded.record)
        XCTAssertNil(decoded.labels)
        XCTAssertNil(decoded.postPreview)
        XCTAssertNil(decoded.author.displayName)
        XCTAssertNil(decoded.author.avatar)
    }

    // MARK: - Test: Truncated JSON throws

    func testTruncatedJSONThrows() {
        let truncated = """
        {"notifications": [{"type": "sin
        """
        XCTAssertThrowsError(try SerializedNotificationData.decode(from: truncated))
    }
}

// MARK: - NotificationReason Edge Case Tests

class NotificationReasonEdgeCaseTests: XCTestCase {

    // MARK: - Test: Unknown reason string maps to .unknown

    func testUnknownReasonStringMapsToUnknown() {
        let reason = NotificationReason(rawValue: "totally-new-reason")
        XCTAssertEqual(reason, .unknown)
        XCTAssertEqual(reason.actionText, "sent a notification")
        XCTAssertEqual(reason.sfSymbolName, "bell.fill")
    }

    // MARK: - Test: Empty string maps to .unknown

    func testEmptyStringReasonMapsToUnknown() {
        let reason = NotificationReason(rawValue: "")
        XCTAssertEqual(reason, .unknown)
    }

    // MARK: - Test: All known reason types

    func testAllKnownReasonTypes() {
        let testCases: [(String, NotificationReason)] = [
            ("like", .like),
            ("repost", .repost),
            ("follow", .follow),
            ("mention", .mention),
            ("reply", .reply),
            ("quote", .quote),
            ("like-via-repost", .likeViaRepost),
            ("repost-via-repost", .repostViaRepost),
            ("starterpack-joined", .starterpackJoined),
        ]

        for (rawValue, expected) in testCases {
            let reason = NotificationReason(rawValue: rawValue)
            XCTAssertEqual(reason, expected, "'\(rawValue)' should map to \(expected)")
            XCTAssertFalse(reason.actionText.isEmpty, "Action text should not be empty for \(rawValue)")
            XCTAssertFalse(reason.sfSymbolName.isEmpty, "SF Symbol should not be empty for \(rawValue)")
        }
    }

    // MARK: - Test: NotificationReason rawValue round-trip

    func testNotificationReasonRawValueRoundTrip() {
        for reasonStr in ["like", "repost", "follow", "mention", "reply", "quote"] {
            let reason = NotificationReason(rawValue: reasonStr)
            XCTAssertEqual(reason.rawValue, reasonStr,
                "rawValue should round-trip for \(reasonStr)")
        }
    }
}

// MARK: - NotificationListFilter Tests

class NotificationListFilterTests: XCTestCase {

    // MARK: - Test: All filter has empty matching reasons (matches everything)

    func testAllFilterHasEmptyMatchingReasons() {
        let filter = NotificationListFilter.all
        XCTAssertEqual(filter.matchingReasons.count, 0,
            "All filter should have empty matching reasons (UI handles 'all' specially)")
        XCTAssertEqual(filter.label, "All")
    }

    // MARK: - Test: Each filter has at least one matching reason

    func testEachFilterExceptAllHasMatchingReasons() {
        for filter in NotificationListFilter.allCases where filter != .all {
            XCTAssertGreaterThan(filter.matchingReasons.count, 0,
                "\(filter.label) filter should have at least one matching reason")
        }
    }

    // MARK: - Test: Filter labels are non-empty

    func testFilterLabelsAreNonEmpty() {
        for filter in NotificationListFilter.allCases {
            XCTAssertFalse(filter.label.isEmpty, "Filter label should not be empty")
        }
    }
}

// MARK: - NotificationUIModel Conversion Error Tests

class NotificationUIModelConversionErrorTests: XCTestCase {

    // MARK: - Test: Notification with unknown reason creates UI model with .unknown

    func testNotificationWithUnknownReasonCreatesUIModel() {
        let notification = SerializedNotification(
            uri: "at://test/notif/unknown",
            cid: "bafyrei-unknown",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            reason: "some-future-reason",
            reasonSubject: nil,
            record: nil,
            isRead: false,
            indexedAt: "2026-02-20T12:00:00.000Z",
            labels: nil
        )

        let uiModel = NotificationUIModel.from(notification)

        XCTAssertEqual(uiModel.reason, .unknown,
            "Unknown reason string should map to .unknown in UI model")
        XCTAssertFalse(uiModel.isRead)
        XCTAssertEqual(uiModel.authorHandle, "test.bsky.social")
    }

    // MARK: - Test: Notification with invalid timestamp uses current date

    func testNotificationWithInvalidTimestampUsesCurrentDate() {
        let notification = SerializedNotification(
            uri: "at://test/notif/badts",
            cid: "bafyrei-badts",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: nil, avatar: nil),
            reason: "like",
            reasonSubject: nil,
            record: nil,
            isRead: false,
            indexedAt: "not-a-valid-timestamp",
            labels: nil
        )

        let uiModel = NotificationUIModel.from(notification)

        // Should not crash, and indexedAt should fallback to Date()
        XCTAssertNotNil(uiModel.indexedAt, "Should have a date even for invalid timestamp")
        XCTAssertFalse(uiModel.timestamp.isEmpty, "Timestamp string should not be empty")
    }

    // MARK: - Test: Notification with nil record

    func testNotificationWithNilRecord() {
        let notification = SerializedNotification(
            uri: "at://test/notif/norec",
            cid: "bafyrei-norec",
            author: SerializedAuthor(did: "did:plc:test", handle: "test.bsky.social", displayName: "Test", avatar: nil),
            reason: "follow",
            reasonSubject: nil,
            record: nil,
            isRead: true,
            indexedAt: "2026-02-20T12:00:00.000Z",
            labels: nil
        )

        let uiModel = NotificationUIModel.from(notification)

        XCTAssertNil(uiModel.postText, "Post text should be nil when record is nil")
        XCTAssertNil(uiModel.postFacets, "Post facets should be nil when record is nil")
    }

    // MARK: - Test: AggregatedNotificationUIModel conversion with empty notifications

    func testAggregatedNotificationWithEmptyNotifications() {
        let aggregated = AggregatedNotification(
            type: "aggregated",
            reason: "like",
            count: 0,
            users: [],
            latestTimestamp: "2026-02-20T12:00:00.000Z",
            notifications: [],
            targetPostUri: nil,
            postPreview: nil
        )

        let uiModel = AggregatedNotificationUIModel.from(aggregated)

        XCTAssertEqual(uiModel.count, 0)
        XCTAssertEqual(uiModel.users.count, 0)
        XCTAssertEqual(uiModel.notifications.count, 0)
        XCTAssertFalse(uiModel.hasUnread, "Empty notifications should not have unread")
    }
}

// MARK: - NotificationBridgeModule Tests

class NotificationBridgeModuleErrorTests: XCTestCase {

    // MARK: - Test: Module definition is not nil

    func testModuleDefinitionNotNil() {
        let module = NotificationBridgeModule()
        let definition = module.definition()
        XCTAssertNotNil(definition)
    }

    // MARK: - Test: Current data is nil initially

    func testCurrentDataNilInitially() {
        let module = NotificationBridgeModule()
        XCTAssertNil(module.getCurrentNotificationData(),
            "Data should be nil before any updates")
    }
}
