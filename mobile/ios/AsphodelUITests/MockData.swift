//
//  MockData.swift
//  AsphodelUITests
//
//  Shared mock data factories for SwiftUI interaction tests.
//  Each module section provides convenience builders for its types.
//

import Foundation
@testable import FeedBridge

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

// MARK: - Profile Mock Data

enum MockProfile {

    static func makeProfile(
        did: String = "did:plc:alice123",
        handle: String = "alice.bsky.social",
        displayName: String? = "Alice Example",
        description: String? = "Just a demo profile for testing.",
        avatar: String? = nil,
        banner: String? = nil,
        followersCount: Int? = 1234,
        followsCount: Int? = 567,
        postsCount: Int? = 890,
        indexedAt: String? = nil,
        viewer: SerializedProfileViewer? = nil,
        labels: [SerializedLabel]? = nil,
        pinnedPost: SerializedPinnedPostRef? = nil,
        associated: SerializedProfileAssociated? = nil,
        knownFollowers: SerializedKnownFollowers? = nil
    ) -> SerializedProfile {
        SerializedProfile(
            did: did,
            handle: handle,
            displayName: displayName,
            description: description,
            avatar: avatar,
            banner: banner,
            followersCount: followersCount,
            followsCount: followsCount,
            postsCount: postsCount,
            indexedAt: indexedAt,
            viewer: viewer,
            labels: labels,
            pinnedPost: pinnedPost,
            associated: associated,
            knownFollowers: knownFollowers
        )
    }

    static func makeViewer(
        muted: Bool? = false,
        blockedBy: Bool? = false,
        blocking: String? = nil,
        blockingByList: SerializedListViewBasic? = nil,
        following: String? = nil,
        followedBy: String? = nil
    ) -> SerializedProfileViewer {
        SerializedProfileViewer(
            muted: muted,
            blockedBy: blockedBy,
            blocking: blocking,
            blockingByList: blockingByList,
            following: following,
            followedBy: followedBy
        )
    }

    static func makePinnedPost(
        uri: String = "at://did:plc:alice123/app.bsky.feed.post/abc",
        authorHandle: String = "alice.bsky.social",
        authorDisplayName: String? = "Alice Example",
        authorAvatar: String? = nil,
        text: String? = "This is my pinned post!",
        indexedAt: String? = nil,
        likeCount: Int? = 42,
        repostCount: Int? = 7,
        replyCount: Int? = 3
    ) -> SerializedPinnedPost {
        SerializedPinnedPost(
            uri: uri,
            authorHandle: authorHandle,
            authorDisplayName: authorDisplayName,
            authorAvatar: authorAvatar,
            text: text,
            indexedAt: indexedAt,
            likeCount: likeCount,
            repostCount: repostCount,
            replyCount: replyCount
        )
    }

    static func makeStarterPack(
        uri: String = "at://did:plc:alice123/app.bsky.graph.starterpack/sp1",
        cid: String? = nil,
        name: String = "Cool People Pack",
        listItemCount: Int? = 25,
        joinedAllTimeCount: Int? = 100
    ) -> SerializedStarterPack {
        SerializedStarterPack(
            uri: uri,
            cid: cid,
            name: name,
            listItemCount: listItemCount,
            joinedAllTimeCount: joinedAllTimeCount
        )
    }

    /// Standard profile for a non-self user (other person's profile)
    static var otherUserProfile: SerializedProfile {
        makeProfile(
            viewer: makeViewer(followedBy: "at://did:plc:alice123/app.bsky.graph.follow/xyz")
        )
    }

    /// Profile for the current user (own profile)
    static var ownProfile: SerializedProfile {
        makeProfile(
            did: "did:plc:me123",
            handle: "me.bsky.social",
            displayName: "My Name",
            description: "My bio goes here.",
            followersCount: 100,
            followsCount: 50,
            postsCount: 200
        )
    }
}

// MARK: - Search Mock Data

enum MockSearch {

    static func makeActorResult(
        id: String = "did:plc:actor1",
        handle: String = "alice.bsky.social",
        displayName: String? = "Alice Johnson",
        avatar: String? = nil,
        description: String? = "Bluesky enthusiast"
    ) -> SearchActorResult {
        SearchActorResult(
            id: id,
            handle: handle,
            displayName: displayName,
            avatar: avatar,
            description: description
        )
    }

    static func makePostResult(
        id: String = "at://did:plc:author1/app.bsky.feed.post/post1",
        uri: String = "at://did:plc:author1/app.bsky.feed.post/post1",
        authorHandle: String = "alice.bsky.social",
        authorDisplayName: String? = "Alice Johnson",
        authorAvatar: String? = nil,
        text: String = "Hello world! This is a sample post.",
        indexedAt: String = "2026-02-20T10:00:00.000Z",
        likeCount: Int = 10,
        repostCount: Int = 3,
        replyCount: Int = 2
    ) -> SearchPostResult {
        SearchPostResult(
            id: id,
            uri: uri,
            authorHandle: authorHandle,
            authorDisplayName: authorDisplayName,
            authorAvatar: authorAvatar,
            text: text,
            indexedAt: indexedAt,
            likeCount: likeCount,
            repostCount: repostCount,
            replyCount: replyCount
        )
    }

    static func makeTrendingTopic(
        tag: String = "bluesky",
        displayName: String? = nil
    ) -> TrendingTopic {
        TrendingTopic(
            id: tag,
            tag: tag,
            displayName: displayName ?? "#\(tag)"
        )
    }

    static func makeTrendItem(
        topic: String = "SwiftUI",
        displayName: String? = nil,
        postCount: Int = 500
    ) -> TrendItem {
        TrendItem(
            id: topic,
            topic: topic,
            displayName: displayName ?? topic,
            postCount: postCount
        )
    }

    /// Sample actor results for people search
    static var sampleActors: [SearchActorResult] {
        [
            makeActorResult(id: "did:plc:actor1", handle: "alice.bsky.social", displayName: "Alice Johnson", description: "Bluesky enthusiast"),
            makeActorResult(id: "did:plc:actor2", handle: "bob.bsky.social", displayName: "Bob Smith", description: "Developer"),
            makeActorResult(id: "did:plc:actor3", handle: "carol.bsky.social", displayName: "Carol Davis", description: nil),
        ]
    }

    /// Sample post results for posts search
    static var samplePosts: [SearchPostResult] {
        [
            makePostResult(
                id: "at://did:plc:a1/app.bsky.feed.post/p1",
                uri: "at://did:plc:a1/app.bsky.feed.post/p1",
                authorHandle: "alice.bsky.social",
                authorDisplayName: "Alice Johnson",
                text: "Loving the new features on Bluesky!",
                likeCount: 42,
                repostCount: 5,
                replyCount: 8
            ),
            makePostResult(
                id: "at://did:plc:a2/app.bsky.feed.post/p2",
                uri: "at://did:plc:a2/app.bsky.feed.post/p2",
                authorHandle: "bob.bsky.social",
                authorDisplayName: "Bob Smith",
                text: "SwiftUI is amazing for building native iOS apps.",
                likeCount: 15,
                repostCount: 2,
                replyCount: 1
            ),
        ]
    }

    /// Sample trending topics
    static var sampleTrendingTopics: [TrendingTopic] {
        [
            makeTrendingTopic(tag: "bluesky"),
            makeTrendingTopic(tag: "swiftui"),
            makeTrendingTopic(tag: "ios"),
        ]
    }

    /// Sample trending items
    static var sampleTrends: [TrendItem] {
        [
            makeTrendItem(topic: "SwiftUI", displayName: "SwiftUI", postCount: 1500),
            makeTrendItem(topic: "Bluesky", displayName: "Bluesky", postCount: 3200),
        ]
    }
}

// MARK: - Compose Mock Data

enum MockCompose {

    static func makeMediaAttachment(
        id: String = "media-1",
        uri: String = "https://example.com/image1.jpg",
        mimeType: String = "image/jpeg",
        altText: String = "",
        width: Int = 800,
        height: Int = 600,
        isVideo: Bool = false,
        thumbnail: String? = nil,
        duration: Double? = nil
    ) -> MediaAttachment {
        MediaAttachment(
            id: id,
            uri: uri,
            mimeType: mimeType,
            altText: altText,
            width: width,
            height: height,
            isVideo: isVideo,
            thumbnail: thumbnail,
            duration: duration
        )
    }

    static func makeReplyContext(
        uri: String = "at://did:plc:author1/app.bsky.feed.post/reply1",
        cid: String = "bafyreireply1",
        authorHandle: String = "alice.bsky.social",
        authorDisplayName: String? = "Alice Johnson",
        authorAvatar: String? = nil,
        text: String = "Original post being replied to"
    ) -> ReplyContext {
        ReplyContext(
            uri: uri,
            cid: cid,
            authorHandle: authorHandle,
            authorDisplayName: authorDisplayName,
            authorAvatar: authorAvatar,
            text: text
        )
    }

    static func makeQuoteContext(
        uri: String = "at://did:plc:author1/app.bsky.feed.post/quote1",
        cid: String = "bafyreiquote1",
        authorHandle: String = "bob.bsky.social",
        authorDisplayName: String? = "Bob Smith",
        authorAvatar: String? = nil,
        text: String = "Post being quoted"
    ) -> QuoteContext {
        QuoteContext(
            uri: uri,
            cid: cid,
            authorHandle: authorHandle,
            authorDisplayName: authorDisplayName,
            authorAvatar: authorAvatar,
            text: text
        )
    }

    static func makeMentionSuggestion(
        id: String = "did:plc:mention1",
        handle: String = "alice.bsky.social",
        displayName: String? = "Alice Johnson",
        avatar: String? = nil
    ) -> ComposeMentionSuggestion {
        ComposeMentionSuggestion(
            id: id,
            handle: handle,
            displayName: displayName,
            avatar: avatar
        )
    }

    /// Sample media attachments for grid tests
    static var sampleImageAttachments: [MediaAttachment] {
        [
            makeMediaAttachment(id: "img-1", uri: "https://example.com/photo1.jpg", altText: ""),
            makeMediaAttachment(id: "img-2", uri: "https://example.com/photo2.jpg", altText: "A sunset"),
            makeMediaAttachment(id: "img-3", uri: "https://example.com/photo3.jpg", altText: ""),
        ]
    }

    /// Four images (max allowed)
    static var maxImageAttachments: [MediaAttachment] {
        (1...4).map { i in
            makeMediaAttachment(id: "img-\(i)", uri: "https://example.com/photo\(i).jpg")
        }
    }

    /// Sample video attachment
    static var sampleVideoAttachment: MediaAttachment {
        makeMediaAttachment(
            id: "vid-1",
            uri: "https://example.com/video1.mp4",
            mimeType: "video/mp4",
            isVideo: true,
            duration: 30.0
        )
    }

    /// Sample mention suggestions
    static var sampleMentionSuggestions: [ComposeMentionSuggestion] {
        [
            makeMentionSuggestion(id: "did:plc:alice1", handle: "alice.bsky.social", displayName: "Alice Johnson"),
            makeMentionSuggestion(id: "did:plc:alex1", handle: "alex.bsky.social", displayName: "Alex Smith"),
            makeMentionSuggestion(id: "did:plc:amy1", handle: "amy.bsky.social", displayName: "Amy Davis"),
        ]
    }
}

// MARK: - Rich Text / Facet Mock Data

enum MockFacets {

    // MARK: - Facet Builders

    static func makeMentionFacet(
        byteStart: Int,
        byteEnd: Int,
        did: String = "did:plc:alice123"
    ) -> Facet {
        Facet(
            index: FacetIndex(byteStart: byteStart, byteEnd: byteEnd),
            features: [.mention(FacetFeatureMention(type: "app.bsky.richtext.facet#mention", did: did))]
        )
    }

    static func makeLinkFacet(
        byteStart: Int,
        byteEnd: Int,
        uri: String = "https://example.com"
    ) -> Facet {
        Facet(
            index: FacetIndex(byteStart: byteStart, byteEnd: byteEnd),
            features: [.link(FacetFeatureLink(type: "app.bsky.richtext.facet#link", uri: uri))]
        )
    }

    static func makeHashtagFacet(
        byteStart: Int,
        byteEnd: Int,
        tag: String = "bluesky"
    ) -> Facet {
        Facet(
            index: FacetIndex(byteStart: byteStart, byteEnd: byteEnd),
            features: [.tag(FacetFeatureTag(type: "app.bsky.richtext.facet#tag", tag: tag))]
        )
    }

    // MARK: - Pre-built Scenarios

    /// Plain text with no facets: "Hello, world!"
    static let plainText = "Hello, world!"
    static let plainTextFacets: [Facet] = []

    /// Text with a single mention: "Hello @alice how are you?"
    /// "@alice" is bytes 6..12
    static let mentionText = "Hello @alice how are you?"
    static let mentionFacets: [Facet] = [
        makeMentionFacet(byteStart: 6, byteEnd: 12, did: "did:plc:alice123")
    ]

    /// Text with a single link: "Check out https://example.com today"
    /// "https://example.com" is bytes 10..29
    static let linkText = "Check out https://example.com today"
    static let linkFacets: [Facet] = [
        makeLinkFacet(byteStart: 10, byteEnd: 29, uri: "https://example.com")
    ]

    /// Text with a single hashtag: "I love #swiftui so much"
    /// "#swiftui" is bytes 7..15
    static let hashtagText = "I love #swiftui so much"
    static let hashtagFacets: [Facet] = [
        makeHashtagFacet(byteStart: 7, byteEnd: 15, tag: "swiftui")
    ]

    /// Mixed content: "Hey @bob check https://news.com #trending today"
    static let mixedText = "Hey @bob check https://news.com #trending today"
    static let mixedFacets: [Facet] = [
        makeMentionFacet(byteStart: 4, byteEnd: 8, did: "did:plc:bob456"),
        makeLinkFacet(byteStart: 15, byteEnd: 31, uri: "https://news.com"),
        makeHashtagFacet(byteStart: 32, byteEnd: 41, tag: "trending")
    ]

    /// Text with emoji before a mention (tests UTF-8 byte offset):
    /// "Hello 👋 @alice check this 🔥"
    /// 👋 is 4 bytes in UTF-8, so "@alice" starts at byte 11 (6 + 1 space + 4 emoji bytes)
    static let emojiText = "Hello 👋 @alice check this 🔥"
    static let emojiFacets: [Facet] = [
        makeMentionFacet(byteStart: 11, byteEnd: 17, did: "did:plc:alice123")
    ]

    /// Multi-byte characters (CJK): "你好 @alice 世界"
    /// 你 = 3 bytes, 好 = 3 bytes, space = 1 → "@alice" starts at byte 7
    static let cjkText = "你好 @alice 世界"
    static let cjkFacets: [Facet] = [
        makeMentionFacet(byteStart: 7, byteEnd: 13, did: "did:plc:alice123")
    ]

    /// Multiple consecutive mentions: "@alice @bob @carol"
    static let consecutiveMentionsText = "@alice @bob @carol"
    static let consecutiveMentionsFacets: [Facet] = [
        makeMentionFacet(byteStart: 0, byteEnd: 6, did: "did:plc:alice123"),
        makeMentionFacet(byteStart: 7, byteEnd: 11, did: "did:plc:bob456"),
        makeMentionFacet(byteStart: 12, byteEnd: 18, did: "did:plc:carol789")
    ]

    /// Link with display text (display text differs from URL):
    /// "Visit my site today" where "my site" is the link text
    static let linkDisplayText = "Visit my site today"
    static let linkDisplayFacets: [Facet] = [
        makeLinkFacet(byteStart: 6, byteEnd: 13, uri: "https://mywebsite.com")
    ]
}
