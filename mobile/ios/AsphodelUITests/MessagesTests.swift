//
//  MessagesTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for the native-messages SwiftUI module.
//  Tests cover ConversationListView, MessageThreadView, and MessageComposerView.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeMessages

// MARK: - ViewInspector Conformance

extension ConversationListView: Inspectable {}
extension ConversationRowView: Inspectable {}
extension MessageThreadView: Inspectable {}
extension MessageBubbleView: Inspectable {}
extension MessageComposerView: Inspectable {}
extension MessagesView: Inspectable {}
extension HighlightedText: Inspectable {}
extension MessageSearchResultRow: Inspectable {}

// MARK: - ConversationListView Tests

class ConversationListViewTests: XCTestCase {

    private func makeDataState(conversations: [Conversation] = []) -> MessagesDataState {
        let state = MessagesDataState()
        state.conversations = conversations
        return state
    }

    // MARK: - Test: Conversation list renders with participant names and last message preview

    func testConversationListRendersParticipantNamesAndLastMessagePreview() throws {
        let dataState = makeDataState(conversations: MockMessages.sampleConversations)

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

        // Should find conversation rows for each conversation
        // The view uses LazyVStack > ForEach > ConversationRowView
        let scrollView = try inspected.find(ViewType.ScrollView.self)
        let lazyVStack = try scrollView.find(ViewType.LazyVStack.self)

        // Verify the ForEach renders rows for all 3 conversations
        let forEach = try lazyVStack.find(ViewType.ForEach<[Conversation], String, ConversationRowView>.self)
        XCTAssertEqual(forEach.count, 3, "Should render 3 conversation rows")

        // Verify first conversation shows Alice Johnson's name
        let firstRow = try forEach.view(ConversationRowView.self, 0)
        let nameText = try firstRow.find(text: "Alice Johnson")
        XCTAssertNotNil(nameText)

        // Verify last message preview is shown
        let lastMessageText = try firstRow.find(text: "Hey, how are you?")
        XCTAssertNotNil(lastMessageText)

        // Verify second conversation shows Bob Smith
        let secondRow = try forEach.view(ConversationRowView.self, 1)
        let bobName = try secondRow.find(text: "Bob Smith")
        XCTAssertNotNil(bobName)
    }

    // MARK: - Test: Tap conversation calls onConversationPress

    func testTapConversationCallsOnConversationPress() throws {
        let dataState = makeDataState(conversations: MockMessages.sampleConversations)
        var pressedConversationId: String?
        let expectation = expectation(description: "onConversationPress called")

        let view = ConversationListView(
            dataState: dataState,
            isLoading: false,
            isRefreshing: false,
            searchText: "",
            isSearching: false,
            currentUserDid: MockMessages.currentUserDid,
            onConversationPress: { conversationId in
                pressedConversationId = conversationId
                expectation.fulfill()
            },
            onRefresh: nil,
            onNewConversation: nil,
            onDeleteConversation: nil,
            onToggleMute: nil,
            onSearchTextChange: nil
        )

        let inspected = try view.inspect()

        // Find the first conversation row's button and tap it
        let scrollView = try inspected.find(ViewType.ScrollView.self)
        let firstButton = try scrollView.find(ViewType.Button.self)
        try firstButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedConversationId, "convo-1", "Should pass the correct conversation ID")
    }

    // MARK: - Test: Unread indicator shows for unread conversations

    func testUnreadIndicatorShowsForUnreadConversations() throws {
        let dataState = makeDataState(conversations: MockMessages.sampleConversations)

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

        // First conversation has unreadCount: 3 - should show badge
        let scrollView = try inspected.find(ViewType.ScrollView.self)
        let unreadBadge = try scrollView.find(text: "3")
        XCTAssertNotNil(unreadBadge, "Should display unread count badge with '3'")

        // Second conversation has unreadCount: 0 - no badge
        // Third conversation has unreadCount: 0 - no badge
        // Verify only one unread badge is shown
        let allTexts = try scrollView.findAll(ViewType.Text.self)
        let unreadTexts = allTexts.filter { (try? $0.string()) == "3" }
        XCTAssertEqual(unreadTexts.count, 1, "Should have exactly one unread badge")
    }

    // MARK: - Test: Search filters conversations

    func testSearchFiltersConversations() throws {
        let dataState = makeDataState(conversations: MockMessages.sampleConversations)

        // Search for "alice" - should filter to only Alice's conversation
        let view = ConversationListView(
            dataState: dataState,
            isLoading: false,
            isRefreshing: false,
            searchText: "alice",
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

        // With search "alice", filteredConversations should only include Alice's convo
        let scrollView = try inspected.find(ViewType.ScrollView.self)
        let lazyVStack = try scrollView.find(ViewType.LazyVStack.self)

        // The ForEach should only have 1 item (Alice's conversation matches)
        let forEach = try lazyVStack.find(ViewType.ForEach<[Conversation], String, ConversationRowView>.self)
        XCTAssertEqual(forEach.count, 1, "Search for 'alice' should filter to 1 conversation")
    }

    // MARK: - Test: Empty state shows when no conversations

    func testEmptyStateShowsWhenNoConversations() throws {
        let dataState = makeDataState(conversations: [])

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
        XCTAssertNotNil(emptyText, "Should show empty state message")
    }
}

// MARK: - MessageThreadView Tests

class MessageThreadViewTests: XCTestCase {

    private func makeDataState(
        conversation: Conversation? = nil,
        messages: [Message] = []
    ) -> MessagesDataState {
        let state = MessagesDataState()
        state.currentConversation = conversation
        state.messages = messages
        return state
    }

    // MARK: - Test: Messages render in order

    func testMessagesRenderInOrder() throws {
        let conversation = MockMessages.makeConversation()
        let messages = MockMessages.sampleThreadMessages
        let dataState = makeDataState(conversation: conversation, messages: messages)

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

        // Find all MessageBubbleView instances in the scroll view
        let bubbles = try inspected.findAll(MessageBubbleView.self)
        XCTAssertEqual(bubbles.count, 5, "Should render all 5 messages")

        // Verify message order by checking text content
        let firstBubbleText = try bubbles[0].find(text: "Hi! How are you doing?")
        XCTAssertNotNil(firstBubbleText, "First message should be 'Hi! How are you doing?'")

        let lastBubbleText = try bubbles[4].find(text: "How about 3pm at the usual place?")
        XCTAssertNotNil(lastBubbleText, "Last message should be 'How about 3pm at the usual place?'")
    }

    // MARK: - Test: Own messages vs others styled differently

    func testOwnMessagesVsOtherMessagesStyling() throws {
        let conversation = MockMessages.makeConversation()
        let messages = [
            MockMessages.makeMessage(id: "msg-other", text: "From other", senderDid: MockMessages.otherUserDid),
            MockMessages.makeMessage(id: "msg-own", text: "From me", senderDid: MockMessages.currentUserDid),
        ]
        let dataState = makeDataState(conversation: conversation, messages: messages)

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

        let bubbles = try inspected.findAll(MessageBubbleView.self)
        XCTAssertEqual(bubbles.count, 2)

        // Other person's message: has leading alignment (Spacer at end)
        let otherBubble = try bubbles[0].find(ViewType.HStack.self)
        // Verify the HStack has Spacer at the end (non-own message layout)
        // The HStack children should end with a Spacer(minLength: 60) for non-own messages
        let otherBubbleText = try bubbles[0].find(text: "From other")
        XCTAssertNotNil(otherBubbleText)

        // Own message: has trailing alignment (Spacer at start)
        let ownBubbleText = try bubbles[1].find(text: "From me")
        XCTAssertNotNil(ownBubbleText)

        // Own messages show double checkmark delivery indicator
        let checkmarks = try bubbles[1].find(text: "\u{2713}\u{2713}")
        XCTAssertNotNil(checkmarks, "Own messages should show delivery checkmarks")
    }

    // MARK: - Test: Tap profile in message header navigates to profile

    func testTapProfileHeaderNavigatesToProfile() throws {
        let conversation = MockMessages.makeConversation()
        let dataState = makeDataState(conversation: conversation, messages: [])
        var pressedHandle: String?
        let expectation = expectation(description: "onProfilePress called")

        let view = MessageThreadView(
            dataState: dataState,
            isLoading: false,
            currentUserDid: MockMessages.currentUserDid,
            onBack: nil,
            onToggleMute: nil,
            onDeleteMessage: nil,
            onProfilePress: { handle in
                pressedHandle = handle
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Find the profile info button in the header (shows displayName and handle)
        // The chatHeader has a Button that contains the profile info
        let profileButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Alice Johnson")) != nil
        })
        try profileButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedHandle, "alice.bsky.social", "Should navigate to the other member's profile")
    }

    // MARK: - Test: Loading state shows when loading messages

    func testLoadingStateShowsWhenLoadingMessages() throws {
        let dataState = makeDataState(conversation: MockMessages.makeConversation(), messages: [])

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
        XCTAssertNotNil(loadingText, "Should show loading indicator when isLoading is true and messages are empty")
    }
}

// MARK: - MessageComposerView Tests

class MessageComposerViewTests: XCTestCase {

    // MARK: - Test: Text input updates state

    func testTextInputUpdatesState() throws {
        let composerState = MessageComposerState()

        let view = MessageComposerView(
            composerState: composerState,
            onSendMessage: nil
        )

        let inspected = try view.inspect()

        // Find the TextField and set its input
        let textField = try inspected.find(ViewType.TextField.self)
        try textField.setInput("Hello world")

        XCTAssertEqual(composerState.text, "Hello world", "Typing in TextField should update composerState.text")
    }

    // MARK: - Test: Send button disabled when empty

    func testSendButtonDisabledWhenEmpty() throws {
        let composerState = MessageComposerState()
        composerState.text = ""

        let view = MessageComposerView(
            composerState: composerState,
            onSendMessage: nil
        )

        let inspected = try view.inspect()

        // Find the Send button
        let sendButton = try inspected.find(ViewType.Button.self)
        XCTAssertTrue(try sendButton.isDisabled(), "Send button should be disabled when text is empty")
    }

    // MARK: - Test: Send button calls onSend with message text

    func testSendButtonCallsOnSendWithMessageText() throws {
        let composerState = MessageComposerState()
        composerState.text = "Test message"
        var sentText: String?
        let expectation = expectation(description: "onSendMessage called")

        let view = MessageComposerView(
            composerState: composerState,
            onSendMessage: { text in
                sentText = text
                expectation.fulfill()
            }
        )

        let inspected = try view.inspect()

        // Find and tap the Send button
        let sendButton = try inspected.find(ViewType.Button.self)
        try sendButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(sentText, "Test message", "Should send the trimmed message text")
        XCTAssertTrue(composerState.isSending, "Should set isSending to true after send")
    }

    // MARK: - Test: Input clears after send (via reset)

    func testInputClearsAfterSend() throws {
        let composerState = MessageComposerState()
        composerState.text = "Message to send"

        let view = MessageComposerView(
            composerState: composerState,
            onSendMessage: { _ in
                // Simulate successful send by calling reset
                composerState.reset()
            }
        )

        let inspected = try view.inspect()

        let sendButton = try inspected.find(ViewType.Button.self)
        try sendButton.tap()

        XCTAssertEqual(composerState.text, "", "Composer text should be cleared after successful send")
        XCTAssertFalse(composerState.isSending, "isSending should be reset after successful send")
    }

    // MARK: - Test: Send button disabled while sending

    func testSendButtonDisabledWhileSending() throws {
        let composerState = MessageComposerState()
        composerState.text = "Some text"
        composerState.isSending = true

        let view = MessageComposerView(
            composerState: composerState,
            onSendMessage: nil
        )

        let inspected = try view.inspect()

        // When isSending is true, the button shows ProgressView and is disabled
        let sendButton = try inspected.find(ViewType.Button.self)
        XCTAssertTrue(try sendButton.isDisabled(), "Send button should be disabled while sending")

        // Should show progress indicator
        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show ProgressView while sending")
    }

    // MARK: - Test: Whitespace-only text does not enable send

    func testWhitespaceOnlyTextDoesNotEnableSend() throws {
        let composerState = MessageComposerState()
        composerState.text = "   \n   "

        let view = MessageComposerView(
            composerState: composerState,
            onSendMessage: nil
        )

        let inspected = try view.inspect()

        let sendButton = try inspected.find(ViewType.Button.self)
        XCTAssertTrue(try sendButton.isDisabled(), "Send button should be disabled for whitespace-only text")
    }
}

// MARK: - MessageComposerState Unit Tests

class MessageComposerStateTests: XCTestCase {

    func testInitialState() {
        let state = MessageComposerState()
        XCTAssertEqual(state.text, "")
        XCTAssertFalse(state.isSending)
    }

    func testResetClearsState() {
        let state = MessageComposerState()
        state.text = "Some text"
        state.isSending = true

        state.reset()

        XCTAssertEqual(state.text, "")
        XCTAssertFalse(state.isSending)
    }
}

// MARK: - MessagesDataState Unit Tests

class MessagesDataStateTests: XCTestCase {

    func testInitialState() {
        let state = MessagesDataState()
        XCTAssertTrue(state.conversations.isEmpty)
        XCTAssertNil(state.currentConversation)
        XCTAssertTrue(state.messages.isEmpty)
        XCTAssertTrue(state.searchResults.isEmpty)
    }

    func testParseConversation() {
        let data: [String: Any] = [
            "id": "convo-1",
            "rev": "rev-1",
            "members": [
                ["did": "did:plc:user1", "handle": "user1.bsky.social", "displayName": "User One", "avatar": nil] as [String: Any?]
            ],
            "muted": false,
            "unreadCount": 5,
            "lastMessage": [
                "id": "msg-1",
                "text": "Hello",
                "sentAt": "2026-02-20T10:00:00.000Z",
                "senderDid": "did:plc:user1"
            ]
        ]

        let conversation = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(conversation)
        XCTAssertEqual(conversation?.id, "convo-1")
        XCTAssertEqual(conversation?.unreadCount, 5)
        XCTAssertEqual(conversation?.lastMessage?.text, "Hello")
        XCTAssertEqual(conversation?.members.count, 1)
        XCTAssertEqual(conversation?.members.first?.handle, "user1.bsky.social")
    }

    func testParseMessage() {
        let data: [String: Any] = [
            "id": "msg-1",
            "rev": "rev-1",
            "text": "Test message",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender"
        ]

        let message = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(message)
        XCTAssertEqual(message?.id, "msg-1")
        XCTAssertEqual(message?.text, "Test message")
        XCTAssertEqual(message?.senderDid, "did:plc:sender")
    }

    func testParseSearchResult() {
        let data: [String: Any] = [
            "conversationId": "convo-search-1",
            "matchType": "message",
            "displayName": "Alice",
            "handle": "alice.bsky.social",
            "matchedMessageText": "Found this text",
            "matchedMessageSentAt": "2026-02-20T10:00:00.000Z"
        ]

        let result = MessagesDataState.parseSearchResult(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.conversationId, "convo-search-1")
        XCTAssertEqual(result?.matchType, "message")
        XCTAssertEqual(result?.matchedMessageText, "Found this text")
    }
}

// MARK: - MessageTimeFormatter Tests

class MessageTimeFormatterTests: XCTestCase {

    func testFormatRelativeTimeJustNow() {
        let now = ISO8601DateFormatter().string(from: Date())
        let result = MessageTimeFormatter.formatRelativeTime(from: now)
        XCTAssertEqual(result, "just now")
    }

    func testFormatRelativeTimeMinutesAgo() {
        let fiveMinutesAgo = Date().addingTimeInterval(-300)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let result = MessageTimeFormatter.formatRelativeTime(from: formatter.string(from: fiveMinutesAgo))
        XCTAssertEqual(result, "5m ago")
    }

    func testFormatRelativeTimeHoursAgo() {
        let twoHoursAgo = Date().addingTimeInterval(-7200)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let result = MessageTimeFormatter.formatRelativeTime(from: formatter.string(from: twoHoursAgo))
        XCTAssertEqual(result, "2h ago")
    }

    func testFormatRelativeTimeInvalidString() {
        let result = MessageTimeFormatter.formatRelativeTime(from: "not-a-date")
        XCTAssertEqual(result, "")
    }
}
