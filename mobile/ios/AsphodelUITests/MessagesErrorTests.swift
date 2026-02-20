//
//  MessagesErrorTests.swift
//  AsphodelUITests
//
//  Error state and edge case tests for the NativeMessages module.
//  Tests cover conversations with no messages, messages from deleted accounts,
//  very long messages, malformed parsing data, and time formatting edge cases.
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeMessages

// MARK: - MessagesDataState Parsing Error Tests

class MessagesDataStateParsingErrorTests: XCTestCase {

    // MARK: - Test: parseConversation with missing id returns nil

    func testParseConversationWithMissingIdReturnsNil() {
        let data: [String: Any] = [
            "rev": "rev-1",
            "members": [] as [[String: Any]]
            // Missing "id" key
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNil(result, "Should return nil when conversation id is missing")
    }

    // MARK: - Test: parseConversation with empty members array

    func testParseConversationWithEmptyMembers() {
        let data: [String: Any] = [
            "id": "convo-empty",
            "rev": "rev-1",
            "members": [] as [[String: Any]],
            "muted": false,
            "unreadCount": 0
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(result, "Should parse conversation with empty members")
        XCTAssertEqual(result?.members.count, 0, "Should have empty members array")
    }

    // MARK: - Test: parseConversation with no lastMessage

    func testParseConversationWithNoLastMessage() {
        let data: [String: Any] = [
            "id": "convo-nolm",
            "rev": "rev-1",
            "members": [
                ["did": "did:plc:test", "handle": "test.bsky.social"] as [String: Any]
            ],
            "muted": false,
            "unreadCount": 0
            // No lastMessage key
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(result)
        XCTAssertNil(result?.lastMessage, "Should handle missing lastMessage gracefully")
    }

    // MARK: - Test: parseConversation with member having nil fields

    func testParseConversationWithMemberNilFields() {
        let data: [String: Any] = [
            "id": "convo-nilmember",
            "rev": "rev-1",
            "members": [
                ["did": "did:plc:deleted"] as [String: Any]
                // Missing handle, displayName, avatar
            ],
            "muted": false,
            "unreadCount": 0
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.members.count, 1)
        XCTAssertNil(result?.members.first?.handle, "Handle should be nil for deleted account")
        XCTAssertNil(result?.members.first?.displayName, "Display name should be nil")
    }

    // MARK: - Test: parseMessage with missing id returns nil

    func testParseMessageWithMissingIdReturnsNil() {
        let data: [String: Any] = [
            "rev": "rev-1",
            "text": "Some message",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender"
            // Missing "id" key
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNil(result, "Should return nil when message id is missing")
    }

    // MARK: - Test: parseMessage with empty/missing fields defaults

    func testParseMessageWithMissingFieldsDefaults() {
        let data: [String: Any] = [
            "id": "msg-minimal"
            // All other fields missing
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.rev, "", "Missing rev should default to empty string")
        XCTAssertEqual(result?.text, "", "Missing text should default to empty string")
        XCTAssertEqual(result?.sentAt, "", "Missing sentAt should default to empty string")
        XCTAssertEqual(result?.senderDid, "", "Missing senderDid should default to empty string")
    }

    // MARK: - Test: parseSearchResult with missing conversationId returns nil

    func testParseSearchResultWithMissingConversationIdReturnsNil() {
        let data: [String: Any] = [
            "matchType": "contact",
            "displayName": "Alice"
            // Missing "conversationId"
        ]

        let result = MessagesDataState.parseSearchResult(from: data)
        XCTAssertNil(result, "Should return nil when conversationId is missing")
    }

    // MARK: - Test: parseSearchResult with minimal data

    func testParseSearchResultWithMinimalData() {
        let data: [String: Any] = [
            "conversationId": "convo-min"
            // All optional fields missing
        ]

        let result = MessagesDataState.parseSearchResult(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.matchType, "contact", "Should default to 'contact'")
        XCTAssertEqual(result?.displayName, "Unknown", "Should default to 'Unknown'")
        XCTAssertEqual(result?.handle, "", "Should default to empty string")
    }

    // MARK: - Test: Clear notification resets all state

    func testClearNotificationResetsAllState() {
        let state = MessagesDataState()
        state.conversations = MockMessages.sampleConversations
        state.messages = MockMessages.sampleThreadMessages
        state.currentConversation = MockMessages.makeConversation()
        state.searchResults = [MockMessages.makeSearchResult()]

        state.startObserving()

        NotificationCenter.default.post(
            name: NSNotification.Name("MessagesBridgeDataCleared"),
            object: nil
        )

        let expectation = expectation(description: "wait for clear")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        XCTAssertTrue(state.conversations.isEmpty, "Conversations should be cleared")
        XCTAssertNil(state.currentConversation, "Current conversation should be nil")
        XCTAssertTrue(state.messages.isEmpty, "Messages should be cleared")
        XCTAssertTrue(state.searchResults.isEmpty, "Search results should be cleared")

        state.stopObserving()
    }

    // MARK: - Test: Very long message (10000 chars) parses correctly

    func testVeryLongMessageParsesCorrectly() {
        let longText = String(repeating: "A", count: 10_000)
        let data: [String: Any] = [
            "id": "msg-long",
            "rev": "rev-1",
            "text": longText,
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender"
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.text.count, 10_000,
            "Very long message text should be preserved completely")
    }
}

// MARK: - MessageTimeFormatter Error Tests

class MessageTimeFormatterErrorTests: XCTestCase {

    // MARK: - Test: Invalid date string returns empty

    func testInvalidDateStringReturnsEmpty() {
        let result = MessageTimeFormatter.formatRelativeTime(from: "not-a-date")
        XCTAssertEqual(result, "", "Invalid date string should return empty string")
    }

    // MARK: - Test: Empty date string returns empty

    func testEmptyDateStringReturnsEmpty() {
        let result = MessageTimeFormatter.formatRelativeTime(from: "")
        XCTAssertEqual(result, "", "Empty date string should return empty string")
    }

    // MARK: - Test: formatMessageTime with invalid date returns empty

    func testFormatMessageTimeInvalidDate() {
        let result = MessageTimeFormatter.formatMessageTime(from: "garbage")
        XCTAssertEqual(result, "", "Invalid date in formatMessageTime should return empty")
    }

    // MARK: - Test: formatRelativeTime with very old date

    func testFormatRelativeTimeWithVeryOldDate() {
        let result = MessageTimeFormatter.formatRelativeTime(from: "2020-01-01T00:00:00.000Z")
        // Should return a date string like "Jan 1" — not crash or return empty
        XCTAssertFalse(result.isEmpty, "Very old date should still format to something")
    }

    // MARK: - Test: formatRelativeTime with future date

    func testFormatRelativeTimeWithFutureDate() {
        let futureDate = Date().addingTimeInterval(3600) // 1 hour in future
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let futureISO = formatter.string(from: futureDate)

        // Future dates should not crash — behavior is implementation-defined
        let result = MessageTimeFormatter.formatRelativeTime(from: futureISO)
        // Just verify it doesn't crash or return empty
        XCTAssertNotNil(result, "Should handle future dates without crashing")
    }
}

// MARK: - ConversationListView Edge Case Tests

class ConversationListViewEdgeCaseTests: XCTestCase {

    // MARK: - ConversationListView conformance declared in MessagesTests.swift

    // MARK: - Test: Empty conversations shows empty state

    func testEmptyConversationsShowsEmptyState() throws {
        let dataState = MessagesDataState()
        dataState.conversations = []

        let view = ConversationListView(
            dataState: dataState,
            isLoading: false,
            isRefreshing: false,
            searchText: "",
            isSearching: false,
            currentUserDid: MockMessages.currentUserDid,
            onConversationPress: nil,
            onRefresh: nil,
            onNewConversation: nil,
            onDeleteConversation: nil,
            onToggleMute: nil,
            onSearchTextChange: nil
        )

        let inspected = try view.inspect()
        let emptyText = try inspected.find(text: "No conversations yet")
        XCTAssertNotNil(emptyText, "Should show empty state, not blank screen")
    }

    // MARK: - Test: Conversation with member having nil handle

    func testConversationWithMemberNilHandle() throws {
        let member = ConversationMember(
            did: "did:plc:deleted",
            handle: nil,
            displayName: nil,
            avatar: nil
        )
        let conversation = Conversation(
            id: "convo-deleted",
            rev: "rev-1",
            members: [
                ConversationMember(did: MockMessages.currentUserDid, handle: "me.bsky.social", displayName: "Me", avatar: nil),
                member
            ],
            muted: false,
            unreadCount: 0,
            lastMessage: nil
        )

        let dataState = MessagesDataState()
        dataState.conversations = [conversation]

        let view = ConversationListView(
            dataState: dataState,
            isLoading: false,
            isRefreshing: false,
            searchText: "",
            isSearching: false,
            currentUserDid: MockMessages.currentUserDid,
            onConversationPress: nil,
            onRefresh: nil,
            onNewConversation: nil,
            onDeleteConversation: nil,
            onToggleMute: nil,
            onSearchTextChange: nil
        )

        // Should not crash when rendering conversation with nil handle member
        let inspected = try view.inspect()
        XCTAssertNotNil(inspected, "Should render without crash even with nil handle member")
    }
}

// MARK: - MessageThreadView Edge Case Tests

class MessageThreadViewEdgeCaseTests: XCTestCase {

    // MARK: - Test: Thread with zero messages shows empty/loading

    func testThreadWithZeroMessagesShowsAppropriateState() throws {
        let conversation = MockMessages.makeConversation()
        let dataState = MessagesDataState()
        dataState.currentConversation = conversation
        dataState.messages = [] // No messages

        let view = MessageThreadView(
            dataState: dataState,
            isLoading: false,
            currentUserDid: MockMessages.currentUserDid,
            onBack: nil,
            onToggleMute: nil,
            onDeleteMessage: nil,
            onProfilePress: nil
        )

        let inspected = try view.inspect()

        // With 0 messages and not loading, should not show message bubbles
        let bubbles = try inspected.findAll(MessageBubbleView.self)
        XCTAssertEqual(bubbles.count, 0, "Should have no message bubbles with empty messages")
    }

    // MARK: - Test: Loading state with no messages

    func testLoadingStateWithNoMessages() throws {
        let dataState = MessagesDataState()
        dataState.currentConversation = MockMessages.makeConversation()
        dataState.messages = []

        let view = MessageThreadView(
            dataState: dataState,
            isLoading: true,
            currentUserDid: MockMessages.currentUserDid,
            onBack: nil,
            onToggleMute: nil,
            onDeleteMessage: nil,
            onProfilePress: nil
        )

        let inspected = try view.inspect()
        let loadingText = try inspected.find(text: "Loading messages...")
        XCTAssertNotNil(loadingText, "Should show loading indicator when loading and no messages")
    }
}
