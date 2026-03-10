//
//  MessageParsingEdgeCaseTests.swift
//  AsphodelUITests
//
//  Edge case unit tests for MessageTypes parsing (reactions, link previews, error paths).
//

import XCTest
@testable import NativeMessages

// MARK: - MessageParsingEdgeCaseTests

class MessageParsingEdgeCaseTests: XCTestCase {

    // MARK: - parseConversation Edge Cases

    // MARK: - Test: parseConversation returns nil when "id" is missing

    func testParseConversationReturnsNilWhenIdMissing() {
        let data: [String: Any] = [
            "rev": "rev-1",
            "members": [
                ["did": "did:plc:user1", "handle": "user1.bsky.social"] as [String: Any]
            ],
            "muted": false,
            "unreadCount": 0
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNil(result, "parseConversation should return nil when 'id' key is missing")
    }

    // MARK: - Test: parseConversation with empty members array

    func testParseConversationWithEmptyMembersArray() {
        let data: [String: Any] = [
            "id": "convo-empty-members",
            "rev": "rev-1",
            "members": [] as [[String: Any]],
            "muted": false,
            "unreadCount": 0
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(result, "Should successfully parse conversation with empty members")
        XCTAssertEqual(result?.members.count, 0, "Members array should be empty")
        XCTAssertEqual(result?.id, "convo-empty-members")
    }

    // MARK: - Test: parseConversation with missing lastMessage defaults to nil

    func testParseConversationWithMissingLastMessageDefaultsToNil() {
        let data: [String: Any] = [
            "id": "convo-no-last-msg",
            "rev": "rev-2",
            "members": [
                ["did": "did:plc:user1", "handle": "user1.bsky.social"] as [String: Any]
            ],
            "muted": false,
            "unreadCount": 2
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(result)
        XCTAssertNil(result?.lastMessage, "lastMessage should be nil when not present in data")
        XCTAssertEqual(result?.unreadCount, 2, "Other fields should still parse correctly")
    }

    // MARK: - Test: parseConversation handles muted=true

    func testParseConversationHandlesMutedTrue() {
        let data: [String: Any] = [
            "id": "convo-muted",
            "rev": "rev-1",
            "members": [] as [[String: Any]],
            "muted": true,
            "unreadCount": 0
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(result)
        XCTAssertTrue(result?.muted ?? false, "Conversation should be marked as muted")
    }

    // MARK: - Test: parseConversation defaults members to empty when key missing

    func testParseConversationDefaultsMembersWhenKeyMissing() {
        let data: [String: Any] = [
            "id": "convo-no-members-key",
            "rev": "rev-1",
            "muted": false,
            "unreadCount": 0
        ]

        let result = MessagesDataState.parseConversation(from: data)
        XCTAssertNotNil(result, "Should parse even without members key")
        XCTAssertEqual(result?.members.count, 0, "Members should default to empty array when key is missing")
    }

    // MARK: - parseMessage Edge Cases

    // MARK: - Test: parseMessage returns nil when "id" is missing

    func testParseMessageReturnsNilWhenIdMissing() {
        let data: [String: Any] = [
            "rev": "rev-1",
            "text": "A message without an id",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender"
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNil(result, "parseMessage should return nil when 'id' key is missing")
    }

    // MARK: - Test: parseMessage with reactions array

    func testParseMessageWithReactionsArray() {
        let data: [String: Any] = [
            "id": "msg-reactions",
            "rev": "rev-1",
            "text": "Great message!",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "reactions": [
                [
                    "emoji": "heart",
                    "count": 3,
                    "userDids": ["did:plc:user1", "did:plc:user2", "did:plc:user3"]
                ] as [String: Any],
                [
                    "emoji": "thumbsup",
                    "count": 1,
                    "userDids": ["did:plc:user1"]
                ] as [String: Any]
            ]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.reactions.count, 2, "Should parse both reactions")
        XCTAssertEqual(result?.reactions[0].emoji, "heart")
        XCTAssertEqual(result?.reactions[0].count, 3)
        XCTAssertEqual(result?.reactions[0].userDids.count, 3)
        XCTAssertEqual(result?.reactions[1].emoji, "thumbsup")
        XCTAssertEqual(result?.reactions[1].count, 1)
    }

    // MARK: - Test: parseMessage with reactions containing missing emoji is filtered out

    func testParseMessageWithReactionsMissingEmojiFilteredOut() {
        let data: [String: Any] = [
            "id": "msg-bad-reaction",
            "rev": "rev-1",
            "text": "Message with bad reaction data",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "reactions": [
                [
                    "emoji": "fire",
                    "count": 2,
                    "userDids": ["did:plc:user1", "did:plc:user2"]
                ] as [String: Any],
                [
                    // Missing "emoji" key
                    "count": 1,
                    "userDids": ["did:plc:user3"]
                ] as [String: Any],
                [
                    "emoji": "star",
                    "count": 5,
                    "userDids": ["did:plc:user4"]
                ] as [String: Any]
            ]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.reactions.count, 2, "Reaction without emoji should be filtered out by compactMap")
        XCTAssertEqual(result?.reactions[0].emoji, "fire")
        XCTAssertEqual(result?.reactions[1].emoji, "star")
    }

    // MARK: - Test: parseMessage with empty reactions array

    func testParseMessageWithEmptyReactionsArray() {
        let data: [String: Any] = [
            "id": "msg-empty-reactions",
            "rev": "rev-1",
            "text": "No reactions here",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "reactions": [] as [[String: Any]]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.reactions.count, 0, "Empty reactions array should result in empty reactions")
    }

    // MARK: - Test: parseMessage with no reactions key defaults to empty

    func testParseMessageWithNoReactionsKeyDefaultsToEmpty() {
        let data: [String: Any] = [
            "id": "msg-no-reactions-key",
            "rev": "rev-1",
            "text": "No reactions key at all",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender"
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.reactions.count, 0, "Missing reactions key should default to empty array")
    }

    // MARK: - Test: parseMessage with linkPreview

    func testParseMessageWithLinkPreview() {
        let data: [String: Any] = [
            "id": "msg-link-preview",
            "rev": "rev-1",
            "text": "Check out https://example.com",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "linkPreview": [
                "url": "https://example.com",
                "title": "Example Domain",
                "description": "This domain is for use in illustrative examples.",
                "imageUrl": "https://example.com/og-image.png"
            ] as [String: Any]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertNotNil(result?.linkPreview, "Link preview should be parsed")
        XCTAssertEqual(result?.linkPreview?.url, "https://example.com")
        XCTAssertEqual(result?.linkPreview?.title, "Example Domain")
        XCTAssertEqual(result?.linkPreview?.description, "This domain is for use in illustrative examples.")
        XCTAssertEqual(result?.linkPreview?.imageUrl, "https://example.com/og-image.png")
    }

    // MARK: - Test: parseMessage with linkPreview missing required url results in nil linkPreview

    func testParseMessageWithLinkPreviewMissingUrlResultsInNilPreview() {
        let data: [String: Any] = [
            "id": "msg-no-url-preview",
            "rev": "rev-1",
            "text": "A link without url in preview",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "linkPreview": [
                // Missing "url" key
                "title": "Some Title",
                "description": "Some description"
            ] as [String: Any]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result, "Message itself should still parse")
        XCTAssertNil(result?.linkPreview, "Link preview should be nil when url is missing from preview data")
    }

    // MARK: - Test: parseMessage with linkPreview partial fields (only url and title)

    func testParseMessageWithLinkPreviewPartialFields() {
        let data: [String: Any] = [
            "id": "msg-partial-preview",
            "rev": "rev-1",
            "text": "Partial preview data",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "linkPreview": [
                "url": "https://minimal.example.com",
                "title": "Minimal Page"
                // No description or imageUrl
            ] as [String: Any]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertNotNil(result?.linkPreview, "Link preview should parse with only url and title")
        XCTAssertEqual(result?.linkPreview?.url, "https://minimal.example.com")
        XCTAssertEqual(result?.linkPreview?.title, "Minimal Page")
        XCTAssertNil(result?.linkPreview?.description, "Description should be nil when not provided")
        XCTAssertNil(result?.linkPreview?.imageUrl, "imageUrl should be nil when not provided")
    }

    // MARK: - Test: parseMessage with linkPreview url-only (no optional fields)

    func testParseMessageWithLinkPreviewUrlOnly() {
        let data: [String: Any] = [
            "id": "msg-url-only-preview",
            "rev": "rev-1",
            "text": "Just a URL",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "linkPreview": [
                "url": "https://bare.example.com"
            ] as [String: Any]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertNotNil(result?.linkPreview, "Link preview with only url should still parse")
        XCTAssertEqual(result?.linkPreview?.url, "https://bare.example.com")
        XCTAssertNil(result?.linkPreview?.title)
        XCTAssertNil(result?.linkPreview?.description)
        XCTAssertNil(result?.linkPreview?.imageUrl)
    }

    // MARK: - parseSearchResult Edge Cases

    // MARK: - Test: parseSearchResult returns nil when "conversationId" is missing

    func testParseSearchResultReturnsNilWhenConversationIdMissing() {
        let data: [String: Any] = [
            "matchType": "contact",
            "displayName": "Some User",
            "handle": "some.bsky.social"
        ]

        let result = MessagesDataState.parseSearchResult(from: data)
        XCTAssertNil(result, "parseSearchResult should return nil when 'conversationId' is missing")
    }

    // MARK: - Test: parseSearchResult with all optional fields present

    func testParseSearchResultWithAllOptionalFieldsPresent() {
        let data: [String: Any] = [
            "conversationId": "convo-full",
            "matchType": "message",
            "displayName": "Alice Johnson",
            "handle": "alice.bsky.social",
            "avatar": "https://example.com/avatar.jpg",
            "matchedMessageText": "This is the matched text",
            "matchedMessageSentAt": "2026-02-20T14:30:00.000Z"
        ]

        let result = MessagesDataState.parseSearchResult(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.conversationId, "convo-full")
        XCTAssertEqual(result?.id, "convo-full", "id should equal conversationId")
        XCTAssertEqual(result?.matchType, "message")
        XCTAssertEqual(result?.displayName, "Alice Johnson")
        XCTAssertEqual(result?.handle, "alice.bsky.social")
        XCTAssertEqual(result?.avatar, "https://example.com/avatar.jpg")
        XCTAssertEqual(result?.matchedMessageText, "This is the matched text")
        XCTAssertEqual(result?.matchedMessageSentAt, "2026-02-20T14:30:00.000Z")
    }

    // MARK: - Test: parseSearchResult defaults matchType to "contact" when missing

    func testParseSearchResultDefaultsMatchTypeToContactWhenMissing() {
        let data: [String: Any] = [
            "conversationId": "convo-no-match-type",
            "displayName": "Bob",
            "handle": "bob.bsky.social"
            // No matchType key
        ]

        let result = MessagesDataState.parseSearchResult(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.matchType, "contact", "matchType should default to 'contact' when not provided")
    }

    // MARK: - Test: parseSearchResult defaults displayName to "Unknown" when missing

    func testParseSearchResultDefaultsDisplayNameWhenMissing() {
        let data: [String: Any] = [
            "conversationId": "convo-no-name"
            // No displayName, handle, or other optional fields
        ]

        let result = MessagesDataState.parseSearchResult(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.displayName, "Unknown", "displayName should default to 'Unknown'")
        XCTAssertEqual(result?.handle, "", "handle should default to empty string")
        XCTAssertNil(result?.avatar, "avatar should be nil when not provided")
        XCTAssertNil(result?.matchedMessageText, "matchedMessageText should be nil when not provided")
        XCTAssertNil(result?.matchedMessageSentAt, "matchedMessageSentAt should be nil when not provided")
    }

    // MARK: - MessageReaction Identity Tests

    // MARK: - Test: MessageReaction id equals emoji

    func testMessageReactionIdEqualsEmoji() {
        let reaction = MessageReaction(emoji: "heart", count: 5, userDids: ["did:plc:user1"])
        XCTAssertEqual(reaction.id, "heart", "MessageReaction id should equal the emoji value")
        XCTAssertEqual(reaction.id, reaction.emoji, "id and emoji should be identical")
    }

    // MARK: - Test: MessageReaction with different emojis have different ids

    func testMessageReactionDifferentEmojisHaveDifferentIds() {
        let heart = MessageReaction(emoji: "heart", count: 1, userDids: [])
        let thumbsup = MessageReaction(emoji: "thumbsup", count: 1, userDids: [])

        XCTAssertNotEqual(heart.id, thumbsup.id, "Different emojis should produce different ids")
    }

    // MARK: - Test: MessageReaction defaults count to provided value

    func testMessageReactionCountAndUserDids() {
        let reaction = MessageReaction(
            emoji: "fire",
            count: 10,
            userDids: ["did:plc:a", "did:plc:b", "did:plc:c"]
        )

        XCTAssertEqual(reaction.count, 10)
        XCTAssertEqual(reaction.userDids.count, 3)
        XCTAssertEqual(reaction.userDids[0], "did:plc:a")
        XCTAssertEqual(reaction.userDids[2], "did:plc:c")
    }

    // MARK: - Test: MessageReaction with empty userDids

    func testMessageReactionWithEmptyUserDids() {
        let reaction = MessageReaction(emoji: "wave", count: 0, userDids: [])
        XCTAssertEqual(reaction.emoji, "wave")
        XCTAssertEqual(reaction.count, 0)
        XCTAssertTrue(reaction.userDids.isEmpty, "userDids should be empty")
    }

    // MARK: - ConversationMember Identity Tests

    // MARK: - Test: ConversationMember id equals did

    func testConversationMemberIdEqualsDid() {
        let member = ConversationMember(
            did: "did:plc:testmember",
            handle: "test.bsky.social",
            displayName: "Test Member",
            avatar: nil
        )

        XCTAssertEqual(member.id, "did:plc:testmember", "ConversationMember id should equal the did value")
        XCTAssertEqual(member.id, member.did, "id and did should be identical")
    }

    // MARK: - Test: ConversationMember with all nil optional fields

    func testConversationMemberWithAllNilOptionalFields() {
        let member = ConversationMember(
            did: "did:plc:minimal",
            handle: nil,
            displayName: nil,
            avatar: nil
        )

        XCTAssertEqual(member.id, "did:plc:minimal")
        XCTAssertEqual(member.did, "did:plc:minimal")
        XCTAssertNil(member.handle)
        XCTAssertNil(member.displayName)
        XCTAssertNil(member.avatar)
    }

    // MARK: - Reaction Parsing with Default Count

    // MARK: - Test: parseMessage reaction defaults count to 1 when missing

    func testParseMessageReactionDefaultsCountToOneWhenMissing() {
        let data: [String: Any] = [
            "id": "msg-reaction-no-count",
            "rev": "rev-1",
            "text": "Reaction without count",
            "sentAt": "2026-02-20T10:00:00.000Z",
            "senderDid": "did:plc:sender",
            "reactions": [
                [
                    "emoji": "thumbsup"
                    // No "count" or "userDids" keys
                ] as [String: Any]
            ]
        ]

        let result = MessagesDataState.parseMessage(from: data)
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.reactions.count, 1)
        XCTAssertEqual(result?.reactions.first?.emoji, "thumbsup")
        XCTAssertEqual(result?.reactions.first?.count, 1, "count should default to 1 when missing")
        XCTAssertEqual(result?.reactions.first?.userDids.count, 0, "userDids should default to empty array when missing")
    }

    // MARK: - MessageLinkPreview Field Tests

    // MARK: - Test: MessageLinkPreview stores all fields correctly

    func testMessageLinkPreviewStoresAllFields() {
        let preview = MessageLinkPreview(
            url: "https://example.com/page",
            title: "Page Title",
            description: "A description of the page",
            imageUrl: "https://example.com/image.png"
        )

        XCTAssertEqual(preview.url, "https://example.com/page")
        XCTAssertEqual(preview.title, "Page Title")
        XCTAssertEqual(preview.description, "A description of the page")
        XCTAssertEqual(preview.imageUrl, "https://example.com/image.png")
    }

    // MARK: - Test: MessageLinkPreview with nil optional fields

    func testMessageLinkPreviewWithNilOptionalFields() {
        let preview = MessageLinkPreview(
            url: "https://example.com",
            title: nil,
            description: nil,
            imageUrl: nil
        )

        XCTAssertEqual(preview.url, "https://example.com")
        XCTAssertNil(preview.title)
        XCTAssertNil(preview.description)
        XCTAssertNil(preview.imageUrl)
    }
}
