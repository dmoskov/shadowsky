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

// MARK: - Thread Mock Data

enum MockThread {

    // MARK: - Authors

    static func makeAuthor(
        did: String = "did:plc:author1",
        handle: String = "alice.bsky.social",
        displayName: String? = "Alice Johnson",
        avatar: String? = nil
    ) -> ThreadAuthor {
        ThreadAuthor(
            did: did,
            handle: handle,
            displayName: displayName,
            avatar: avatar
        )
    }

    // MARK: - Records

    static func makeRecord(
        text: String = "Hello world!",
        facets: [Facet]? = nil,
        createdAt: String = "2026-02-20T10:00:00.000Z",
        langs: [String]? = ["en"]
    ) -> ThreadRecord {
        ThreadRecord(
            text: text,
            facets: facets,
            createdAt: createdAt,
            langs: langs
        )
    }

    // MARK: - Posts

    static func makePost(
        uri: String = "at://did:plc:author1/app.bsky.feed.post/post1",
        cid: String = "bafypost1",
        author: ThreadAuthor? = nil,
        record: ThreadRecord? = nil,
        embed: PostEmbedData? = nil,
        indexedAt: String = "2026-02-20T10:00:00.000Z",
        likeCount: Int = 10,
        repostCount: Int = 3,
        replyCount: Int = 2,
        quoteCount: Int? = 1,
        viewer: ThreadViewer? = nil,
        labels: [ThreadLabel]? = nil
    ) -> ThreadPost {
        ThreadPost(
            uri: uri,
            cid: cid,
            author: author ?? makeAuthor(),
            record: record ?? makeRecord(),
            embed: embed,
            indexedAt: indexedAt,
            likeCount: likeCount,
            repostCount: repostCount,
            replyCount: replyCount,
            quoteCount: quoteCount,
            viewer: viewer,
            labels: labels
        )
    }

    // MARK: - Nodes

    static func makeNode(
        post: ThreadPost? = nil,
        parent: ThreadReplyRef? = nil,
        replies: [ThreadNode] = [],
        depth: Int = 0
    ) -> ThreadNode {
        ThreadNode(
            post: post ?? makePost(),
            parent: parent,
            replies: replies,
            depth: depth
        )
    }

    // MARK: - Summary Data

    static func makeSummaryData(
        summary: String = "This thread discusses SwiftUI testing patterns.",
        format: String = "brief",
        postCount: Int? = 5,
        authors: [String]? = ["alice.bsky.social", "bob.bsky.social"],
        generatedAt: String? = "2026-02-20T10:05:00.000Z",
        cached: Bool = false,
        totalEngagement: Int? = nil,
        highlightedSubThreads: [SubThreadHighlight]? = nil
    ) -> ThreadSummaryData {
        ThreadSummaryData(
            summary: summary,
            format: format,
            metadata: ThreadSummaryMetadata(
                postCount: postCount,
                authors: authors,
                generatedAt: generatedAt,
                cached: cached,
                totalEngagement: totalEngagement,
                highlightedSubThreads: highlightedSubThreads
            )
        )
    }

    // MARK: - Mention Suggestions

    static func makeMentionSuggestion(
        did: String = "did:plc:mention1",
        handle: String = "bob.bsky.social",
        displayName: String? = "Bob Smith",
        avatar: String? = nil
    ) -> MentionSuggestion {
        MentionSuggestion(
            id: did,
            handle: handle,
            displayName: displayName,
            avatar: avatar
        )
    }

    // MARK: - Prebuilt Samples

    /// A root post with two reply children
    static var sampleRootNode: ThreadNode {
        let rootPost = makePost(
            uri: "at://did:plc:alice/app.bsky.feed.post/root1",
            cid: "bafyroot1",
            author: makeAuthor(did: "did:plc:alice", handle: "alice.bsky.social", displayName: "Alice Johnson"),
            record: makeRecord(text: "This is the root post of the thread."),
            likeCount: 42,
            repostCount: 7,
            replyCount: 2,
            quoteCount: 3,
            viewer: ThreadViewer(like: nil, repost: nil)
        )

        let reply1Post = makePost(
            uri: "at://did:plc:bob/app.bsky.feed.post/reply1",
            cid: "bafyreply1",
            author: makeAuthor(did: "did:plc:bob", handle: "bob.bsky.social", displayName: "Bob Smith"),
            record: makeRecord(text: "Great post, Alice!"),
            likeCount: 5,
            repostCount: 0,
            replyCount: 0,
            quoteCount: nil,
            viewer: ThreadViewer(like: "at://did:plc:me/app.bsky.feed.like/1", repost: nil)
        )

        let reply2Post = makePost(
            uri: "at://did:plc:carol/app.bsky.feed.post/reply2",
            cid: "bafyreply2",
            author: makeAuthor(did: "did:plc:carol", handle: "carol.bsky.social", displayName: "Carol Davis"),
            record: makeRecord(text: "I agree, this is interesting."),
            likeCount: 2,
            repostCount: 1,
            replyCount: 0,
            quoteCount: nil,
            viewer: nil
        )

        return makeNode(
            post: rootPost,
            replies: [
                makeNode(post: reply1Post, depth: 1),
                makeNode(post: reply2Post, depth: 1)
            ],
            depth: 0
        )
    }

    /// A root post with no replies
    static var sampleEmptyThread: ThreadNode {
        makeNode(
            post: makePost(
                uri: "at://did:plc:alice/app.bsky.feed.post/empty1",
                cid: "bafyempty1",
                author: makeAuthor(did: "did:plc:alice", handle: "alice.bsky.social", displayName: "Alice Johnson"),
                record: makeRecord(text: "A post with no replies yet."),
                likeCount: 0,
                repostCount: 0,
                replyCount: 0,
                quoteCount: nil,
                viewer: nil
            ),
            replies: [],
            depth: 0
        )
    }

    /// A liked root post (viewer has liked it)
    static var sampleLikedNode: ThreadNode {
        makeNode(
            post: makePost(
                viewer: ThreadViewer(like: "at://did:plc:me/app.bsky.feed.like/abc", repost: nil)
            )
        )
    }

    /// A reposted root post (viewer has reposted it)
    static var sampleRepostedNode: ThreadNode {
        makeNode(
            post: makePost(
                viewer: ThreadViewer(like: nil, repost: "at://did:plc:me/app.bsky.feed.repost/xyz")
            )
        )
    }

    /// A post in a non-English language for translation tests
    static var sampleForeignLanguageNode: ThreadNode {
        makeNode(
            post: makePost(
                uri: "at://did:plc:france/app.bsky.feed.post/fr1",
                cid: "bafyfr1",
                author: makeAuthor(did: "did:plc:france", handle: "jean.bsky.social", displayName: "Jean Dupont"),
                record: makeRecord(text: "Bonjour le monde!", langs: ["fr"]),
                likeCount: 8,
                repostCount: 1,
                replyCount: 0
            )
        )
    }

    /// Sample mention suggestions for autocomplete tests
    static var sampleMentionSuggestions: [MentionSuggestion] {
        [
            makeMentionSuggestion(did: "did:plc:m1", handle: "alice.bsky.social", displayName: "Alice Johnson"),
            makeMentionSuggestion(did: "did:plc:m2", handle: "bob.bsky.social", displayName: "Bob Smith"),
            makeMentionSuggestion(did: "did:plc:m3", handle: "carol.bsky.social", displayName: nil),
        ]
    }

    /// Comprehensive summary with highlights
    static var sampleComprehensiveSummary: ThreadSummaryData {
        makeSummaryData(
            summary: "A comprehensive discussion about Swift testing patterns, with multiple participants sharing their experiences.",
            format: "comprehensive",
            postCount: 15,
            authors: ["alice.bsky.social", "bob.bsky.social", "carol.bsky.social"],
            cached: true,
            totalEngagement: 250,
            highlightedSubThreads: [
                SubThreadHighlight(
                    id: "at://did:plc:bob/app.bsky.feed.post/hl1",
                    uri: "at://did:plc:bob/app.bsky.feed.post/hl1",
                    authorHandle: "bob.bsky.social",
                    snippet: "Great insight about ViewInspector",
                    engagement: 45
                ),
                SubThreadHighlight(
                    id: "at://did:plc:carol/app.bsky.feed.post/hl2",
                    uri: "at://did:plc:carol/app.bsky.feed.post/hl2",
                    authorHandle: "carol.bsky.social",
                    snippet: "Alternative approach using XCTest",
                    engagement: 30
                )
            ]
        )
    }
}
