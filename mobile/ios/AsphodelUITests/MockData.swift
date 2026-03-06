//
//  MockData.swift
//  AsphodelUITests
//
//  Shared mock data factories for SwiftUI interaction tests.
//  Each module section provides convenience builders for its types.
//

import Foundation
import ExpoSwiftUIFeed
@testable import NativeFeedList

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
            description: description,
            isVerified: false
        )
    }

    static func makePostResult(
        id: String = "at://did:plc:author1/app.bsky.feed.post/post1",
        uri: String = "at://did:plc:author1/app.bsky.feed.post/post1",
        authorHandle: String = "alice.bsky.social",
        authorDisplayName: String? = "Alice Johnson",
        authorAvatar: String? = nil,
        authorIsVerified: Bool = false,
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
            authorIsVerified: authorIsVerified,
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

// MARK: - Feed Mock Data

enum MockFeed {

    static func makePostAuthor(
        did: String = "did:plc:author1",
        handle: String = "alice.bsky.social",
        displayName: String? = "Alice Johnson",
        avatar: String? = nil,
        isVerified: Bool = false
    ) -> PostAuthor {
        PostAuthor(
            did: did,
            handle: handle,
            displayName: displayName,
            avatar: avatar,
            isVerified: isVerified
        )
    }

    static func makePostRecord(
        text: String = "Hello world! This is a test post.",
        facets: [PostFacet]? = nil,
        createdAt: String = "2026-02-20T10:00:00.000Z",
        embed: PostEmbedData? = nil
    ) -> PostRecord {
        PostRecord(
            text: text,
            facets: facets,
            createdAt: createdAt,
            embed: embed
        )
    }

    static func makePostView(
        uri: String = "at://did:plc:author1/app.bsky.feed.post/post1",
        cid: String = "bafyrei-post1",
        author: PostAuthor? = nil,
        record: PostRecord? = nil,
        indexedAt: String = "2026-02-20T10:00:00.000Z",
        likeCount: Int = 0,
        repostCount: Int = 0,
        replyCount: Int = 0,
        viewer: PostViewer? = nil,
        labels: [ContentLabel]? = nil
    ) -> PostView {
        PostView(
            uri: uri,
            cid: cid,
            author: author ?? makePostAuthor(),
            record: record ?? makePostRecord(),
            indexedAt: indexedAt,
            likeCount: likeCount,
            repostCount: repostCount,
            replyCount: replyCount,
            viewer: viewer,
            labels: labels
        )
    }

    static func makeFeedViewPost(
        post: PostView? = nil
    ) -> FeedViewPost {
        FeedViewPost(post: post ?? makePostView())
    }

    /// A post with engagement counts for testing action bar display
    static var postWithCounts: FeedViewPost {
        makeFeedViewPost(post: makePostView(
            uri: "at://did:plc:author1/app.bsky.feed.post/counted",
            likeCount: 42,
            repostCount: 7,
            replyCount: 13
        ))
    }

    /// A post that the current user has liked
    static var likedPost: FeedViewPost {
        makeFeedViewPost(post: makePostView(
            uri: "at://did:plc:author1/app.bsky.feed.post/liked",
            likeCount: 10,
            viewer: PostViewer(like: "at://did:plc:me/app.bsky.feed.like/abc", repost: nil)
        ))
    }

    /// A post that the current user has reposted
    static var repostedPost: FeedViewPost {
        makeFeedViewPost(post: makePostView(
            uri: "at://did:plc:author1/app.bsky.feed.post/reposted",
            repostCount: 5,
            viewer: PostViewer(like: nil, repost: "at://did:plc:me/app.bsky.feed.repost/abc")
        ))
    }

    /// A post with an image embed
    static var postWithImages: FeedViewPost {
        makeFeedViewPost(post: makePostView(
            uri: "at://did:plc:author1/app.bsky.feed.post/images",
            record: makePostRecord(
                text: "Check out these photos!",
                embed: PostEmbedData(embedType: .images([
                    ImageEmbedData(
                        thumb: "https://example.com/thumb1.jpg",
                        fullsize: "https://example.com/full1.jpg",
                        alt: "A sunset",
                        aspectRatio: 1.5
                    ),
                ]))
            )
        ))
    }

    /// A post with a quote embed
    static var postWithQuote: FeedViewPost {
        makeFeedViewPost(post: makePostView(
            uri: "at://did:plc:author1/app.bsky.feed.post/quote",
            record: makePostRecord(
                text: "Great post!",
                embed: PostEmbedData(embedType: .quote(QuoteEmbedData(
                    uri: "at://did:plc:quoted/app.bsky.feed.post/orig",
                    author: AuthorData(
                        handle: "bob.bsky.social",
                        displayName: "Bob Smith",
                        avatar: nil
                    ),
                    text: "This is the quoted post.",
                    createdAt: "2026-02-19T08:00:00.000Z"
                )))
            )
        ))
    }

    /// A post with an external link embed
    static var postWithExternalLink: FeedViewPost {
        makeFeedViewPost(post: makePostView(
            uri: "at://did:plc:author1/app.bsky.feed.post/link",
            record: makePostRecord(
                text: "Check out this article",
                embed: PostEmbedData(embedType: .external(ExternalLinkEmbedData(
                    uri: "https://example.com/article",
                    title: "An Example Article",
                    description: "A fascinating read about testing.",
                    thumb: nil
                )))
            )
        ))
    }

    /// A post with a video embed
    static var postWithVideo: FeedViewPost {
        makeFeedViewPost(post: makePostView(
            uri: "at://did:plc:author1/app.bsky.feed.post/video",
            record: makePostRecord(
                text: "Watch this video",
                embed: PostEmbedData(embedType: .video(VideoEmbedData(
                    playlist: "https://example.com/video.m3u8",
                    thumbnail: "https://example.com/video-thumb.jpg",
                    alt: "A fun video",
                    aspectRatio: 1.78
                )))
            )
        ))
    }

    /// A list of sample posts for feed list tests
    static var samplePosts: [FeedViewPost] {
        [
            makeFeedViewPost(post: makePostView(
                uri: "at://did:plc:a1/app.bsky.feed.post/p1",
                author: makePostAuthor(did: "did:plc:a1", handle: "alice.bsky.social", displayName: "Alice Johnson"),
                record: makePostRecord(text: "Hello from Alice!"),
                likeCount: 10,
                repostCount: 2,
                replyCount: 3
            )),
            makeFeedViewPost(post: makePostView(
                uri: "at://did:plc:a2/app.bsky.feed.post/p2",
                author: makePostAuthor(did: "did:plc:a2", handle: "bob.bsky.social", displayName: "Bob Smith"),
                record: makePostRecord(text: "Bob here with an update."),
                likeCount: 5,
                repostCount: 1,
                replyCount: 0
            )),
            makeFeedViewPost(post: makePostView(
                uri: "at://did:plc:a3/app.bsky.feed.post/p3",
                author: makePostAuthor(did: "did:plc:a3", handle: "carol.bsky.social", displayName: "Carol Davis"),
                record: makePostRecord(text: "Testing the feed!"),
                likeCount: 0,
                repostCount: 0,
                replyCount: 1
            )),
        ]
    }
}

// MARK: - Embed View Mock Data

enum MockEmbed {

    // MARK: - Image Embed Mocks

    static func makeImage(
        thumb: String = "https://example.com/thumb.jpg",
        fullsize: String = "https://example.com/full.jpg",
        alt: String? = nil,
        aspectRatio: Double? = 1.5
    ) -> ImageEmbedData {
        ImageEmbedData(
            thumb: thumb,
            fullsize: fullsize,
            alt: alt,
            aspectRatio: aspectRatio
        )
    }

    static var singleImage: [ImageEmbedData] {
        [makeImage(alt: "A sunset photo", aspectRatio: 1.5)]
    }

    static var twoImages: [ImageEmbedData] {
        [
            makeImage(thumb: "https://example.com/thumb1.jpg", fullsize: "https://example.com/full1.jpg", alt: "First image"),
            makeImage(thumb: "https://example.com/thumb2.jpg", fullsize: "https://example.com/full2.jpg", alt: nil),
        ]
    }

    static var threeImages: [ImageEmbedData] {
        [
            makeImage(thumb: "https://example.com/thumb1.jpg", fullsize: "https://example.com/full1.jpg", alt: nil),
            makeImage(thumb: "https://example.com/thumb2.jpg", fullsize: "https://example.com/full2.jpg", alt: nil),
            makeImage(thumb: "https://example.com/thumb3.jpg", fullsize: "https://example.com/full3.jpg", alt: "Third image"),
        ]
    }

    static var fourImages: [ImageEmbedData] {
        [
            makeImage(thumb: "https://example.com/thumb1.jpg", fullsize: "https://example.com/full1.jpg"),
            makeImage(thumb: "https://example.com/thumb2.jpg", fullsize: "https://example.com/full2.jpg"),
            makeImage(thumb: "https://example.com/thumb3.jpg", fullsize: "https://example.com/full3.jpg"),
            makeImage(thumb: "https://example.com/thumb4.jpg", fullsize: "https://example.com/full4.jpg"),
        ]
    }

    // MARK: - Video Embed Mocks

    static func makeVideo(
        playlist: String = "https://example.com/video.m3u8",
        thumbnail: String? = "https://example.com/video-thumb.jpg",
        alt: String? = nil,
        aspectRatio: Double? = 1.78
    ) -> VideoEmbedData {
        VideoEmbedData(
            playlist: playlist,
            thumbnail: thumbnail,
            alt: alt,
            aspectRatio: aspectRatio
        )
    }

    static var videoWithThumbnail: VideoEmbedData {
        makeVideo(thumbnail: "https://example.com/video-thumb.jpg", alt: "Demo video")
    }

    static var videoWithoutThumbnail: VideoEmbedData {
        makeVideo(thumbnail: nil, alt: nil)
    }

    // MARK: - Quote Embed Mocks

    static func makeAuthor(
        handle: String = "alice.bsky.social",
        displayName: String? = "Alice Johnson",
        avatar: String? = nil
    ) -> AuthorData {
        AuthorData(handle: handle, displayName: displayName, avatar: avatar)
    }

    static func makeQuote(
        uri: String = "at://did:plc:quoted/app.bsky.feed.post/orig",
        author: AuthorData? = nil,
        text: String? = "This is the quoted post content.",
        createdAt: String? = "2026-02-19T08:00:00.000Z"
    ) -> QuoteEmbedData {
        QuoteEmbedData(
            uri: uri,
            author: author ?? makeAuthor(),
            text: text,
            createdAt: createdAt
        )
    }

    static var validQuote: QuoteEmbedData {
        makeQuote(
            author: makeAuthor(
                handle: "bob.bsky.social",
                displayName: "Bob Smith",
                avatar: "https://example.com/avatar.jpg"
            ),
            text: "This is a great post that I want to share with everyone."
        )
    }

    static var quoteWithoutAvatar: QuoteEmbedData {
        makeQuote(
            author: makeAuthor(handle: "carol.bsky.social", displayName: nil, avatar: nil),
            text: "Short quote."
        )
    }

    // MARK: - External Link Embed Mocks

    static func makeExternalLink(
        uri: String = "https://example.com/article",
        title: String? = "An Interesting Article",
        description: String? = "A detailed description of this article.",
        thumb: String? = "https://example.com/thumb.jpg"
    ) -> ExternalLinkEmbedData {
        ExternalLinkEmbedData(
            uri: uri,
            title: title,
            description: description,
            thumb: thumb
        )
    }

    static var linkWithThumbnail: ExternalLinkEmbedData {
        makeExternalLink(
            uri: "https://www.news.com/story",
            title: "Breaking News Story",
            description: "Latest updates on the developing situation.",
            thumb: "https://example.com/news-thumb.jpg"
        )
    }

    static var linkWithoutThumbnail: ExternalLinkEmbedData {
        makeExternalLink(
            uri: "https://blog.example.com/post",
            title: "Blog Post Title",
            description: "A blog post description.",
            thumb: nil
        )
    }

    static var linkMinimal: ExternalLinkEmbedData {
        makeExternalLink(
            uri: "https://example.com",
            title: nil,
            description: nil,
            thumb: nil
        )
    }

    static var linkWithLongTitle: ExternalLinkEmbedData {
        makeExternalLink(
            uri: "https://example.com/long",
            title: "This is a very long article title that should be truncated when displayed because it exceeds the normal display width for link cards in the feed",
            description: "This is also a very long description that provides extensive detail about the content of the article and should also be truncated after two lines.",
            thumb: "https://example.com/thumb.jpg"
        )
    }

    // MARK: - PostEmbed Mocks

    static var imagePostEmbed: PostEmbedData {
        PostEmbedData(embedType: .images(singleImage))
    }

    static var videoPostEmbed: PostEmbedData {
        PostEmbedData(embedType: .video(videoWithThumbnail))
    }

    static var quotePostEmbed: PostEmbedData {
        PostEmbedData(embedType: .quote(validQuote))
    }

    static var externalPostEmbed: PostEmbedData {
        PostEmbedData(embedType: .external(linkWithThumbnail))
    }

    static var recordWithMediaEmbed: PostEmbedData {
        PostEmbedData(embedType: .recordWithMedia(
            media: .images(singleImage),
            record: validQuote
        ))
    }

    static var nilQuotePostEmbed: PostEmbedData {
        PostEmbedData(embedType: .quote(nil))
    }
}
