//
//  MockData.swift
//  AsphodelUITests
//
//  Shared mock data factories for SwiftUI interaction tests.
//  Each module section provides convenience builders for its types.
//

import Foundation

// MARK: - Messages Mock Data

enum MockMessages {
    static let currentUserDid = "did:plc:currentuser123"
    static let otherUserDid = "did:plc:otheruser456"
    static let thirdUserDid = "did:plc:thirduser789"

    static func makeMember(
        did: String = otherUserDid,
        handle: String? = "alice.bsky.social",
        displayName: String? = "Alice Johnson",
        avatar: String? = nil
    ) -> ConversationMember {
        ConversationMember(
            did: did,
            handle: handle,
            displayName: displayName,
            avatar: avatar
        )
    }

    static func makeLastMessage(
        id: String = "msg-last-1",
        text: String = "Hey, how are you?",
        sentAt: String = "2026-02-20T10:30:00.000Z",
        senderDid: String = otherUserDid
    ) -> LastMessagePreview {
        LastMessagePreview(
            id: id,
            text: text,
            sentAt: sentAt,
            senderDid: senderDid
        )
    }

    static func makeConversation(
        id: String = "convo-1",
        rev: String = "rev-1",
        members: [ConversationMember]? = nil,
        muted: Bool = false,
        unreadCount: Int = 0,
        lastMessage: LastMessagePreview? = nil
    ) -> Conversation {
        let defaultMembers = members ?? [
            makeMember(did: currentUserDid, handle: "me.bsky.social", displayName: "Me"),
            makeMember()
        ]
        return Conversation(
            id: id,
            rev: rev,
            members: defaultMembers,
            muted: muted,
            unreadCount: unreadCount,
            lastMessage: lastMessage ?? makeLastMessage()
        )
    }

    static func makeMessage(
        id: String = "msg-1",
        rev: String = "rev-1",
        text: String = "Hello there!",
        sentAt: String = "2026-02-20T10:00:00.000Z",
        senderDid: String = otherUserDid
    ) -> Message {
        Message(
            id: id,
            rev: rev,
            text: text,
            sentAt: sentAt,
            senderDid: senderDid
        )
    }

    static func makeSearchResult(
        conversationId: String = "convo-search-1",
        matchType: String = "contact",
        displayName: String = "Alice Johnson",
        handle: String = "alice.bsky.social",
        avatar: String? = nil,
        matchedMessageText: String? = nil,
        matchedMessageSentAt: String? = nil
    ) -> SearchResult {
        SearchResult(
            id: conversationId,
            conversationId: conversationId,
            matchType: matchType,
            displayName: displayName,
            handle: handle,
            avatar: avatar,
            matchedMessageText: matchedMessageText,
            matchedMessageSentAt: matchedMessageSentAt
        )
    }

    /// A set of sample conversations for list tests
    static var sampleConversations: [Conversation] {
        [
            makeConversation(
                id: "convo-1",
                members: [
                    makeMember(did: currentUserDid, handle: "me.bsky.social", displayName: "Me"),
                    makeMember(did: otherUserDid, handle: "alice.bsky.social", displayName: "Alice Johnson")
                ],
                unreadCount: 3,
                lastMessage: makeLastMessage(text: "Hey, how are you?", senderDid: otherUserDid)
            ),
            makeConversation(
                id: "convo-2",
                members: [
                    makeMember(did: currentUserDid, handle: "me.bsky.social", displayName: "Me"),
                    makeMember(did: thirdUserDid, handle: "bob.bsky.social", displayName: "Bob Smith")
                ],
                muted: true,
                unreadCount: 0,
                lastMessage: makeLastMessage(id: "msg-last-2", text: "See you tomorrow!", senderDid: currentUserDid)
            ),
            makeConversation(
                id: "convo-3",
                members: [
                    makeMember(did: currentUserDid, handle: "me.bsky.social", displayName: "Me"),
                    makeMember(did: "did:plc:carol999", handle: "carol.bsky.social", displayName: "Carol Davis")
                ],
                unreadCount: 0,
                lastMessage: makeLastMessage(id: "msg-last-3", text: "Thanks for the info!", senderDid: "did:plc:carol999")
            )
        ]
    }

    /// A set of sample messages for thread tests
    static var sampleThreadMessages: [Message] {
        [
            makeMessage(id: "msg-1", text: "Hi! How are you doing?", sentAt: "2026-02-20T09:00:00.000Z", senderDid: otherUserDid),
            makeMessage(id: "msg-2", text: "I'm doing great, thanks! How about you?", sentAt: "2026-02-20T09:01:00.000Z", senderDid: currentUserDid),
            makeMessage(id: "msg-3", text: "Pretty good! Want to grab coffee later?", sentAt: "2026-02-20T09:02:00.000Z", senderDid: otherUserDid),
            makeMessage(id: "msg-4", text: "Sure, sounds great! What time?", sentAt: "2026-02-20T09:03:00.000Z", senderDid: currentUserDid),
            makeMessage(id: "msg-5", text: "How about 3pm at the usual place?", sentAt: "2026-02-20T09:04:00.000Z", senderDid: otherUserDid),
        ]
    }
}
