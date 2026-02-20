//
//  FeedBridgeTests.swift
//  AsphodelUITests
//
//  Codable round-trip and module tests for FeedBridge data types.
//  Verifies encode/decode correctness for all major AT Protocol feed
//  serialization types used at the JS-to-Swift boundary.
//

import XCTest
@testable import FeedBridge

// MARK: - FeedBridge Codable Round-Trip Tests

class FeedBridgeTests: XCTestCase {

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    // MARK: - Helpers

    private func roundTrip<T: Codable & Equatable>(_ value: T) throws -> T {
        let data = try encoder.encode(value)
        return try decoder.decode(T.self, from: data)
    }

    private func roundTripJSON<T: Codable>(_ value: T) throws -> T {
        let data = try encoder.encode(value)
        return try decoder.decode(T.self, from: data)
    }

    private func makeMinimalAuthor(
        did: String = "did:plc:abc123",
        handle: String = "alice.bsky.social",
        displayName: String? = "Alice",
        avatar: String? = "https://cdn.bsky.app/avatar/alice.jpg"
    ) -> SerializedAuthor {
        SerializedAuthor(did: did, handle: handle, displayName: displayName, avatar: avatar)
    }

    private func makeMinimalRecord(
        text: String = "Hello world",
        facets: [Facet]? = nil,
        createdAt: String = "2026-02-20T12:00:00.000Z"
    ) -> SerializedRecord {
        SerializedRecord(text: text, facets: facets, createdAt: createdAt)
    }

    private func makeMinimalPost(
        uri: String = "at://did:plc:abc123/app.bsky.feed.post/3abc",
        cid: String = "bafyreiabc123",
        embed: SerializedEmbed? = nil,
        replyCount: Int? = 5,
        repostCount: Int? = 3,
        likeCount: Int? = 42,
        quoteCount: Int? = 1,
        viewer: SerializedViewer? = nil,
        labels: [SerializedLabel]? = nil
    ) -> SerializedPost {
        SerializedPost(
            uri: uri,
            cid: cid,
            author: makeMinimalAuthor(),
            record: makeMinimalRecord(),
            embed: embed,
            replyCount: replyCount,
            repostCount: repostCount,
            likeCount: likeCount,
            quoteCount: quoteCount,
            viewer: viewer,
            labels: labels,
            indexedAt: "2026-02-20T12:00:00.000Z"
        )
    }

    // MARK: - Test: SerializedPost encode/decode

    func testSerializedPostRoundTrip() throws {
        let viewer = SerializedViewer(
            like: "at://did:plc:me/app.bsky.feed.like/1",
            repost: nil,
            muted: false,
            blocked: nil
        )
        let label = SerializedLabel(
            val: "nsfw",
            src: "did:plc:labeler",
            uri: "at://did:plc:abc123/app.bsky.feed.post/3abc",
            cid: "bafyreiabc123",
            cts: "2026-02-20T12:00:00.000Z"
        )
        let post = makeMinimalPost(
            viewer: viewer,
            labels: [label]
        )

        let data = try encoder.encode(post)
        let decoded = try decoder.decode(SerializedPost.self, from: data)

        XCTAssertEqual(decoded.uri, post.uri)
        XCTAssertEqual(decoded.cid, post.cid)
        XCTAssertEqual(decoded.author.did, post.author.did)
        XCTAssertEqual(decoded.author.handle, post.author.handle)
        XCTAssertEqual(decoded.author.displayName, post.author.displayName)
        XCTAssertEqual(decoded.author.avatar, post.author.avatar)
        XCTAssertEqual(decoded.record.text, post.record.text)
        XCTAssertEqual(decoded.record.createdAt, post.record.createdAt)
        XCTAssertEqual(decoded.replyCount, 5)
        XCTAssertEqual(decoded.repostCount, 3)
        XCTAssertEqual(decoded.likeCount, 42)
        XCTAssertEqual(decoded.quoteCount, 1)
        XCTAssertEqual(decoded.viewer?.like, "at://did:plc:me/app.bsky.feed.like/1")
        XCTAssertNil(decoded.viewer?.repost)
        XCTAssertEqual(decoded.viewer?.muted, false)
        XCTAssertEqual(decoded.labels?.count, 1)
        XCTAssertEqual(decoded.labels?.first?.val, "nsfw")
        XCTAssertEqual(decoded.indexedAt, post.indexedAt)
    }

    // MARK: - Test: SerializedAuthor encode/decode

    func testSerializedAuthorRoundTrip() throws {
        let author = makeMinimalAuthor()

        let data = try encoder.encode(author)
        let decoded = try decoder.decode(SerializedAuthor.self, from: data)

        XCTAssertEqual(decoded.did, author.did)
        XCTAssertEqual(decoded.handle, author.handle)
        XCTAssertEqual(decoded.displayName, author.displayName)
        XCTAssertEqual(decoded.avatar, author.avatar)
    }

    func testSerializedAuthorWithNilOptionals() throws {
        let author = SerializedAuthor(did: "did:plc:xyz", handle: "bob.bsky.social", displayName: nil, avatar: nil)

        let data = try encoder.encode(author)
        let decoded = try decoder.decode(SerializedAuthor.self, from: data)

        XCTAssertEqual(decoded.did, "did:plc:xyz")
        XCTAssertEqual(decoded.handle, "bob.bsky.social")
        XCTAssertNil(decoded.displayName)
        XCTAssertNil(decoded.avatar)
    }

    // MARK: - Test: Facet with mention feature round-trips

    func testFacetMentionRoundTrip() throws {
        let mention = FacetFeatureMention(
            type: "app.bsky.richtext.facet#mention",
            did: "did:plc:mentioned-user"
        )
        let facet = Facet(
            index: FacetIndex(byteStart: 0, byteEnd: 15),
            features: [.mention(mention)]
        )

        let data = try encoder.encode(facet)
        let decoded = try decoder.decode(Facet.self, from: data)

        XCTAssertEqual(decoded.index.byteStart, 0)
        XCTAssertEqual(decoded.index.byteEnd, 15)
        XCTAssertEqual(decoded.features.count, 1)

        if case .mention(let decodedMention) = decoded.features[0] {
            XCTAssertEqual(decodedMention.type, "app.bsky.richtext.facet#mention")
            XCTAssertEqual(decodedMention.did, "did:plc:mentioned-user")
        } else {
            XCTFail("Expected mention feature")
        }
    }

    // MARK: - Test: Facet with link feature round-trips

    func testFacetLinkRoundTrip() throws {
        let link = FacetFeatureLink(
            type: "app.bsky.richtext.facet#link",
            uri: "https://example.com/some-page"
        )
        let facet = Facet(
            index: FacetIndex(byteStart: 10, byteEnd: 40),
            features: [.link(link)]
        )

        let data = try encoder.encode(facet)
        let decoded = try decoder.decode(Facet.self, from: data)

        XCTAssertEqual(decoded.index.byteStart, 10)
        XCTAssertEqual(decoded.index.byteEnd, 40)

        if case .link(let decodedLink) = decoded.features[0] {
            XCTAssertEqual(decodedLink.type, "app.bsky.richtext.facet#link")
            XCTAssertEqual(decodedLink.uri, "https://example.com/some-page")
        } else {
            XCTFail("Expected link feature")
        }
    }

    // MARK: - Test: Facet with hashtag feature round-trips

    func testFacetTagRoundTrip() throws {
        let tag = FacetFeatureTag(
            type: "app.bsky.richtext.facet#tag",
            tag: "swiftui"
        )
        let facet = Facet(
            index: FacetIndex(byteStart: 50, byteEnd: 58),
            features: [.tag(tag)]
        )

        let data = try encoder.encode(facet)
        let decoded = try decoder.decode(Facet.self, from: data)

        if case .tag(let decodedTag) = decoded.features[0] {
            XCTAssertEqual(decodedTag.type, "app.bsky.richtext.facet#tag")
            XCTAssertEqual(decodedTag.tag, "swiftui")
        } else {
            XCTFail("Expected tag feature")
        }
    }

    // MARK: - Test: Embed image decode round-trip

    func testEmbedImagesRoundTrip() throws {
        let embed = SerializedEmbed.images(EmbedImages(
            type: "app.bsky.embed.images#view",
            images: [
                ViewImage(
                    thumb: "https://cdn.bsky.app/thumb.jpg",
                    fullsize: "https://cdn.bsky.app/full.jpg",
                    alt: "A photo of a sunset",
                    aspectRatio: AspectRatio(width: 1920, height: 1080)
                ),
                ViewImage(
                    thumb: "https://cdn.bsky.app/thumb2.jpg",
                    fullsize: "https://cdn.bsky.app/full2.jpg",
                    alt: "",
                    aspectRatio: nil
                )
            ]
        ))

        let data = try encoder.encode(embed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .images(let images) = decoded {
            XCTAssertEqual(images.type, "app.bsky.embed.images#view")
            XCTAssertEqual(images.images.count, 2)
            XCTAssertEqual(images.images[0].alt, "A photo of a sunset")
            XCTAssertEqual(images.images[0].aspectRatio?.width, 1920)
            XCTAssertEqual(images.images[0].aspectRatio?.height, 1080)
            XCTAssertNil(images.images[1].aspectRatio)
        } else {
            XCTFail("Expected images embed")
        }
    }

    // MARK: - Test: Embed video decode round-trip

    func testEmbedVideoRoundTrip() throws {
        let embed = SerializedEmbed.video(EmbedVideo(
            type: "app.bsky.embed.video#view",
            video: ViewVideo(
                cid: "bafyreivideo123",
                playlist: "https://video.bsky.app/watch/v1/playlist.m3u8",
                thumbnail: "https://video.bsky.app/watch/v1/thumb.jpg",
                aspectRatio: AspectRatio(width: 1280, height: 720)
            )
        ))

        let data = try encoder.encode(embed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .video(let video) = decoded {
            XCTAssertEqual(video.video.cid, "bafyreivideo123")
            XCTAssertEqual(video.video.playlist, "https://video.bsky.app/watch/v1/playlist.m3u8")
            XCTAssertEqual(video.video.thumbnail, "https://video.bsky.app/watch/v1/thumb.jpg")
            XCTAssertEqual(video.video.aspectRatio?.width, 1280)
        } else {
            XCTFail("Expected video embed")
        }
    }

    // MARK: - Test: Embed external decode round-trip

    func testEmbedExternalRoundTrip() throws {
        let embed = SerializedEmbed.external(EmbedExternal(
            type: "app.bsky.embed.external#view",
            external: ViewExternal(
                uri: "https://example.com/article",
                title: "Interesting Article",
                description: "A description of the article",
                thumb: "https://example.com/thumb.jpg"
            )
        ))

        let data = try encoder.encode(embed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .external(let ext) = decoded {
            XCTAssertEqual(ext.external.uri, "https://example.com/article")
            XCTAssertEqual(ext.external.title, "Interesting Article")
            XCTAssertEqual(ext.external.description, "A description of the article")
            XCTAssertEqual(ext.external.thumb, "https://example.com/thumb.jpg")
        } else {
            XCTFail("Expected external embed")
        }
    }

    // MARK: - Test: Embed quote (record) decode round-trip

    func testEmbedRecordRoundTrip() throws {
        let quotedAuthor = makeMinimalAuthor(did: "did:plc:quoted", handle: "quoted.bsky.social")
        let embed = SerializedEmbed.record(EmbedRecord(
            type: "app.bsky.embed.record#view",
            record: ViewRecord(
                type: "app.bsky.embed.record#viewRecord",
                uri: "at://did:plc:quoted/app.bsky.feed.post/quoted1",
                cid: "bafyreiquoted1",
                author: quotedAuthor,
                value: RecordValue(text: "This is the quoted post", createdAt: "2026-02-19T08:00:00.000Z"),
                embeds: nil,
                indexedAt: "2026-02-19T08:00:00.000Z"
            )
        ))

        let data = try encoder.encode(embed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .record(let record) = decoded {
            XCTAssertEqual(record.record.uri, "at://did:plc:quoted/app.bsky.feed.post/quoted1")
            XCTAssertEqual(record.record.author.handle, "quoted.bsky.social")
            XCTAssertEqual(record.record.value.text, "This is the quoted post")
            XCTAssertNil(record.record.embeds)
        } else {
            XCTFail("Expected record embed")
        }
    }

    // MARK: - Test: Embed recordWithMedia decode round-trip

    func testEmbedRecordWithMediaRoundTrip() throws {
        let quotedAuthor = makeMinimalAuthor(did: "did:plc:quoted2", handle: "quoted2.bsky.social")
        let mediaEmbed = SerializedEmbed.images(EmbedImages(
            type: "app.bsky.embed.images#view",
            images: [
                ViewImage(
                    thumb: "https://cdn.bsky.app/media-thumb.jpg",
                    fullsize: "https://cdn.bsky.app/media-full.jpg",
                    alt: "Media image",
                    aspectRatio: AspectRatio(width: 800, height: 600)
                )
            ]
        ))

        let embed = SerializedEmbed.recordWithMedia(EmbedRecordWithMedia(
            type: "app.bsky.embed.recordWithMedia#view",
            record: EmbedRecordWrapper(
                record: ViewRecord(
                    type: "app.bsky.embed.record#viewRecord",
                    uri: "at://did:plc:quoted2/app.bsky.feed.post/rwm1",
                    cid: "bafyreirwm1",
                    author: quotedAuthor,
                    value: RecordValue(text: "Quoted with media", createdAt: "2026-02-18T12:00:00.000Z"),
                    embeds: nil,
                    indexedAt: "2026-02-18T12:00:00.000Z"
                )
            ),
            media: mediaEmbed
        ))

        let data = try encoder.encode(embed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .recordWithMedia(let rwm) = decoded {
            XCTAssertEqual(rwm.record.record.uri, "at://did:plc:quoted2/app.bsky.feed.post/rwm1")
            XCTAssertEqual(rwm.record.record.value.text, "Quoted with media")
            if case .images(let images) = rwm.media {
                XCTAssertEqual(images.images.count, 1)
                XCTAssertEqual(images.images[0].alt, "Media image")
            } else {
                XCTFail("Expected images media in recordWithMedia")
            }
        } else {
            XCTFail("Expected recordWithMedia embed")
        }
    }

    // MARK: - Test: Missing optional fields decode as nil

    func testMissingOptionalFieldsDecodeAsNil() throws {
        // Construct JSON manually with no optional fields
        let json = """
        {
            "uri": "at://did:plc:test/app.bsky.feed.post/1",
            "cid": "bafyrei-test",
            "author": {
                "did": "did:plc:test",
                "handle": "test.bsky.social"
            },
            "record": {
                "text": "Minimal",
                "createdAt": "2026-02-20T12:00:00.000Z"
            },
            "indexedAt": "2026-02-20T12:00:00.000Z"
        }
        """
        let data = json.data(using: .utf8)!
        let decoded = try decoder.decode(SerializedPost.self, from: data)

        XCTAssertEqual(decoded.uri, "at://did:plc:test/app.bsky.feed.post/1")
        XCTAssertNil(decoded.author.displayName)
        XCTAssertNil(decoded.author.avatar)
        XCTAssertNil(decoded.embed)
        XCTAssertNil(decoded.replyCount)
        XCTAssertNil(decoded.repostCount)
        XCTAssertNil(decoded.likeCount)
        XCTAssertNil(decoded.quoteCount)
        XCTAssertNil(decoded.viewer)
        XCTAssertNil(decoded.labels)
        XCTAssertNil(decoded.record.facets)
    }

    // MARK: - Test: Malformed JSON returns appropriate error

    func testMalformedJSONReturnsError() {
        let malformed = "{ invalid json }"
        XCTAssertThrowsError(try SerializedFeedData.decode(from: malformed)) { error in
            // Should be a DecodingError or similar
            XCTAssertTrue(error is DecodingError || error is Swift.DecodingError,
                "Expected a DecodingError, got \(type(of: error))")
        }
    }

    // MARK: - Test: FacetIndex byte offsets preserved through encode/decode

    func testFacetIndexByteOffsetsPreserved() throws {
        // Test with large Unicode byte offsets typical in AT Protocol
        let facetIndex = FacetIndex(byteStart: 127, byteEnd: 255)

        let data = try encoder.encode(facetIndex)
        let decoded = try decoder.decode(FacetIndex.self, from: data)

        XCTAssertEqual(decoded.byteStart, 127)
        XCTAssertEqual(decoded.byteEnd, 255)
    }

    func testFacetIndexZeroOffsets() throws {
        let facetIndex = FacetIndex(byteStart: 0, byteEnd: 0)

        let data = try encoder.encode(facetIndex)
        let decoded = try decoder.decode(FacetIndex.self, from: data)

        XCTAssertEqual(decoded.byteStart, 0)
        XCTAssertEqual(decoded.byteEnd, 0)
    }

    // MARK: - Test: Nested embeds (quote containing image) decode correctly

    func testNestedEmbedsDecodeCorrectly() throws {
        let innerImageEmbed = SerializedEmbed.images(EmbedImages(
            type: "app.bsky.embed.images#view",
            images: [
                ViewImage(
                    thumb: "https://cdn.bsky.app/nested-thumb.jpg",
                    fullsize: "https://cdn.bsky.app/nested-full.jpg",
                    alt: "Nested image",
                    aspectRatio: AspectRatio(width: 640, height: 480)
                )
            ]
        ))

        let quotedAuthor = makeMinimalAuthor(did: "did:plc:nested", handle: "nested.bsky.social")
        let outerEmbed = SerializedEmbed.record(EmbedRecord(
            type: "app.bsky.embed.record#view",
            record: ViewRecord(
                type: "app.bsky.embed.record#viewRecord",
                uri: "at://did:plc:nested/app.bsky.feed.post/nested1",
                cid: "bafyreinested1",
                author: quotedAuthor,
                value: RecordValue(text: "Quoted post with embedded image", createdAt: "2026-02-19T10:00:00.000Z"),
                embeds: [innerImageEmbed],
                indexedAt: "2026-02-19T10:00:00.000Z"
            )
        ))

        let data = try encoder.encode(outerEmbed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .record(let record) = decoded {
            XCTAssertEqual(record.record.embeds?.count, 1)
            if case .images(let images) = record.record.embeds?[0] {
                XCTAssertEqual(images.images[0].alt, "Nested image")
                XCTAssertEqual(images.images[0].aspectRatio?.width, 640)
            } else {
                XCTFail("Expected images embed inside quoted record")
            }
        } else {
            XCTFail("Expected record embed")
        }
    }

    // MARK: - Test: Full SerializedFeedData round-trip via decode helper

    func testSerializedFeedDataDecodeHelperRoundTrip() throws {
        let post = makeMinimalPost()
        let feedViewPost = SerializedFeedViewPost(
            post: post,
            reply: nil,
            reason: nil,
            feedContext: "feed-ctx-1",
            isBookmarked: true
        )
        let feedData = SerializedFeedData(
            posts: [feedViewPost],
            metadata: FeedUpdateMetadata(
                timestamp: 1708430400,
                isBookmarked: nil,
                isOnline: true,
                isFromCache: false
            ),
            cursor: "cursor_abc"
        )

        let data = try encoder.encode(feedData)
        let jsonString = String(data: data, encoding: .utf8)!
        let decoded = try SerializedFeedData.decode(from: jsonString)

        XCTAssertEqual(decoded.posts.count, 1)
        XCTAssertEqual(decoded.posts[0].post.uri, post.uri)
        XCTAssertEqual(decoded.posts[0].feedContext, "feed-ctx-1")
        XCTAssertEqual(decoded.posts[0].isBookmarked, true)
        XCTAssertEqual(decoded.metadata.timestamp, 1708430400)
        XCTAssertEqual(decoded.metadata.isOnline, true)
        XCTAssertEqual(decoded.cursor, "cursor_abc")
    }

    // MARK: - Test: convertPosts handles empty array (via FeedData decode)

    func testFeedDataWithEmptyPostsArray() throws {
        let feedData = SerializedFeedData(
            posts: [],
            metadata: FeedUpdateMetadata(
                timestamp: 1708430400,
                isBookmarked: nil,
                isOnline: true,
                isFromCache: nil
            ),
            cursor: nil
        )

        let data = try encoder.encode(feedData)
        let jsonString = String(data: data, encoding: .utf8)!
        let decoded = try SerializedFeedData.decode(from: jsonString)

        XCTAssertEqual(decoded.posts.count, 0)
        XCTAssertNil(decoded.cursor)
    }

    // MARK: - Test: convertPosts handles large batch (100+ posts)

    func testFeedDataWithLargeBatch() throws {
        let posts = (0..<150).map { i -> SerializedFeedViewPost in
            let post = SerializedPost(
                uri: "at://did:plc:user\(i)/app.bsky.feed.post/\(i)",
                cid: "bafyrei\(i)",
                author: makeMinimalAuthor(did: "did:plc:user\(i)", handle: "user\(i).bsky.social"),
                record: makeMinimalRecord(text: "Post number \(i)"),
                embed: nil,
                replyCount: i,
                repostCount: i * 2,
                likeCount: i * 10,
                quoteCount: nil,
                viewer: nil,
                labels: nil,
                indexedAt: "2026-02-20T12:00:00.000Z"
            )
            return SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        }

        let feedData = SerializedFeedData(
            posts: posts,
            metadata: FeedUpdateMetadata(
                timestamp: 1708430400,
                isBookmarked: nil,
                isOnline: true,
                isFromCache: false
            ),
            cursor: "cursor_150"
        )

        let data = try encoder.encode(feedData)
        let jsonString = String(data: data, encoding: .utf8)!
        let decoded = try SerializedFeedData.decode(from: jsonString)

        XCTAssertEqual(decoded.posts.count, 150, "Should decode all 150 posts")
        XCTAssertEqual(decoded.posts[0].post.uri, "at://did:plc:user0/app.bsky.feed.post/0")
        XCTAssertEqual(decoded.posts[149].post.uri, "at://did:plc:user149/app.bsky.feed.post/149")
        XCTAssertEqual(decoded.posts[149].post.record.text, "Post number 149")
        XCTAssertEqual(decoded.cursor, "cursor_150")
    }

    // MARK: - Test: FeedBatchUpdate decode round-trip

    func testFeedBatchUpdateRoundTrip() throws {
        let update = FeedBatchUpdate(
            updates: [
                PostUpdate(
                    uri: "at://did:plc:test/app.bsky.feed.post/1",
                    likeCount: 100,
                    repostCount: 50,
                    replyCount: 25,
                    viewer: SerializedViewer(like: "at://did:plc:me/like/1", repost: nil, muted: nil, blocked: nil),
                    isBookmarked: true
                ),
                PostUpdate(
                    uri: "at://did:plc:test/app.bsky.feed.post/2",
                    likeCount: nil,
                    repostCount: nil,
                    replyCount: nil,
                    viewer: nil,
                    isBookmarked: nil
                )
            ],
            timestamp: 1708430500
        )

        let data = try encoder.encode(update)
        let jsonString = String(data: data, encoding: .utf8)!
        let decoded = try FeedBatchUpdate.decode(from: jsonString)

        XCTAssertEqual(decoded.updates.count, 2)
        XCTAssertEqual(decoded.updates[0].uri, "at://did:plc:test/app.bsky.feed.post/1")
        XCTAssertEqual(decoded.updates[0].likeCount, 100)
        XCTAssertEqual(decoded.updates[0].isBookmarked, true)
        XCTAssertNil(decoded.updates[1].likeCount)
        XCTAssertNil(decoded.updates[1].isBookmarked)
        XCTAssertEqual(decoded.timestamp, 1708430500)
    }

    // MARK: - Test: SerializedReason repost round-trip

    func testSerializedReasonRepostRoundTrip() throws {
        let reason = SerializedReason.repost(SerializedReasonRepost(
            type: "app.bsky.feed.defs#reasonRepost",
            by: makeMinimalAuthor(did: "did:plc:reposter", handle: "reposter.bsky.social"),
            indexedAt: "2026-02-20T14:00:00.000Z"
        ))

        let data = try encoder.encode(reason)
        let decoded = try decoder.decode(SerializedReason.self, from: data)

        if case .repost(let repost) = decoded {
            XCTAssertEqual(repost.type, "app.bsky.feed.defs#reasonRepost")
            XCTAssertEqual(repost.by.did, "did:plc:reposter")
            XCTAssertEqual(repost.by.handle, "reposter.bsky.social")
            XCTAssertEqual(repost.indexedAt, "2026-02-20T14:00:00.000Z")
        } else {
            XCTFail("Expected repost reason")
        }
    }

    // MARK: - Test: SerializedReplyRef round-trip

    func testSerializedReplyRefRoundTrip() throws {
        let parentPost = makeMinimalPost(uri: "at://did:plc:parent/app.bsky.feed.post/parent1")
        let rootPost = makeMinimalPost(uri: "at://did:plc:root/app.bsky.feed.post/root1")

        let replyRef = SerializedReplyRef(parent: parentPost, root: rootPost)

        let data = try encoder.encode(replyRef)
        let decoded = try decoder.decode(SerializedReplyRef.self, from: data)

        XCTAssertEqual(decoded.parent.uri, "at://did:plc:parent/app.bsky.feed.post/parent1")
        XCTAssertEqual(decoded.root.uri, "at://did:plc:root/app.bsky.feed.post/root1")
    }

    // MARK: - Test: SerializedFeedViewPost with reply and reason

    func testFeedViewPostWithReplyAndReason() throws {
        let post = makeMinimalPost()
        let parentPost = makeMinimalPost(uri: "at://did:plc:parent/app.bsky.feed.post/p1")
        let rootPost = makeMinimalPost(uri: "at://did:plc:root/app.bsky.feed.post/r1")
        let replyRef = SerializedReplyRef(parent: parentPost, root: rootPost)
        let reason = SerializedReason.repost(SerializedReasonRepost(
            type: "app.bsky.feed.defs#reasonRepost",
            by: makeMinimalAuthor(did: "did:plc:rp", handle: "rp.bsky.social"),
            indexedAt: "2026-02-20T15:00:00.000Z"
        ))

        let feedViewPost = SerializedFeedViewPost(
            post: post,
            reply: replyRef,
            reason: reason,
            feedContext: "context123",
            isBookmarked: false
        )

        let data = try encoder.encode(feedViewPost)
        let decoded = try decoder.decode(SerializedFeedViewPost.self, from: data)

        XCTAssertEqual(decoded.post.uri, post.uri)
        XCTAssertEqual(decoded.reply?.parent.uri, "at://did:plc:parent/app.bsky.feed.post/p1")
        XCTAssertEqual(decoded.reply?.root.uri, "at://did:plc:root/app.bsky.feed.post/r1")
        XCTAssertEqual(decoded.feedContext, "context123")
        XCTAssertEqual(decoded.isBookmarked, false)

        if case .repost(let rp) = decoded.reason {
            XCTAssertEqual(rp.by.did, "did:plc:rp")
        } else {
            XCTFail("Expected repost reason")
        }
    }

    // MARK: - Test: SerializedRecord with multiple facets

    func testRecordWithMultipleFacets() throws {
        let facets = [
            Facet(
                index: FacetIndex(byteStart: 0, byteEnd: 12),
                features: [.mention(FacetFeatureMention(type: "app.bsky.richtext.facet#mention", did: "did:plc:user1"))]
            ),
            Facet(
                index: FacetIndex(byteStart: 20, byteEnd: 45),
                features: [.link(FacetFeatureLink(type: "app.bsky.richtext.facet#link", uri: "https://example.com"))]
            ),
            Facet(
                index: FacetIndex(byteStart: 50, byteEnd: 60),
                features: [.tag(FacetFeatureTag(type: "app.bsky.richtext.facet#tag", tag: "test"))]
            )
        ]

        let record = SerializedRecord(
            text: "@user1 check https://example.com #test",
            facets: facets,
            createdAt: "2026-02-20T12:00:00.000Z"
        )

        let data = try encoder.encode(record)
        let decoded = try decoder.decode(SerializedRecord.self, from: data)

        XCTAssertEqual(decoded.facets?.count, 3)

        // Verify each facet type preserved
        if case .mention(let m) = decoded.facets?[0].features[0] {
            XCTAssertEqual(m.did, "did:plc:user1")
        } else { XCTFail("Expected mention") }

        if case .link(let l) = decoded.facets?[1].features[0] {
            XCTAssertEqual(l.uri, "https://example.com")
        } else { XCTFail("Expected link") }

        if case .tag(let t) = decoded.facets?[2].features[0] {
            XCTAssertEqual(t.tag, "test")
        } else { XCTFail("Expected tag") }
    }

    // MARK: - Test: LenientFeedDecodeResult reports skipped count

    func testLenientDecodeReportsSkippedCount() throws {
        // Create JSON with a mix of valid and invalid posts using JSONSerialization
        let validPost: [String: Any] = [
            "post": [
                "uri": "at://did:plc:test/app.bsky.feed.post/good",
                "cid": "bafyrei-good",
                "author": ["did": "did:plc:test", "handle": "test.bsky.social"] as [String: Any],
                "record": ["text": "Good", "createdAt": "2026-02-20T12:00:00.000Z"] as [String: Any],
                "indexedAt": "2026-02-20T12:00:00.000Z"
            ] as [String: Any]
        ]
        let invalidPost: [String: Any] = [
            "post": [
                "uri": "at://did:plc:test/app.bsky.feed.post/bad",
                // Missing required "cid" field
                "record": ["text": "Bad", "createdAt": "2026-02-20T12:00:00.000Z"] as [String: Any],
                "indexedAt": "2026-02-20T12:00:00.000Z"
            ] as [String: Any]
        ]

        let feedDict: [String: Any] = [
            "posts": [validPost, invalidPost] as [[String: Any]],
            "metadata": ["timestamp": 1708430400, "isOnline": true] as [String: Any],
            "cursor": NSNull()
        ]

        let jsonData = try JSONSerialization.data(withJSONObject: feedDict)
        let jsonString = String(data: jsonData, encoding: .utf8)!

        let result = try SerializedFeedData.decodeLenient(from: jsonString)

        XCTAssertEqual(result.data.posts.count, 1, "Should have 1 valid post")
        XCTAssertEqual(result.skippedCount, 1, "Should report 1 skipped post")
    }

    // MARK: - Test: EmbedVideo with nil optional fields

    func testEmbedVideoWithNilOptionals() throws {
        let embed = SerializedEmbed.video(EmbedVideo(
            type: "app.bsky.embed.video#view",
            video: ViewVideo(
                cid: "bafyreivid-noopt",
                playlist: "https://video.bsky.app/minimal.m3u8",
                thumbnail: nil,
                aspectRatio: nil
            )
        ))

        let data = try encoder.encode(embed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .video(let video) = decoded {
            XCTAssertNil(video.video.thumbnail)
            XCTAssertNil(video.video.aspectRatio)
        } else {
            XCTFail("Expected video embed")
        }
    }

    // MARK: - Test: EmbedExternal with nil thumb

    func testEmbedExternalWithNilThumb() throws {
        let embed = SerializedEmbed.external(EmbedExternal(
            type: "app.bsky.embed.external#view",
            external: ViewExternal(
                uri: "https://example.com",
                title: "No Thumb",
                description: "An article without a thumbnail",
                thumb: nil
            )
        ))

        let data = try encoder.encode(embed)
        let decoded = try decoder.decode(SerializedEmbed.self, from: data)

        if case .external(let ext) = decoded {
            XCTAssertNil(ext.external.thumb)
        } else {
            XCTFail("Expected external embed")
        }
    }

    // MARK: - Test: FeedUpdateMetadata round-trip

    func testFeedUpdateMetadataRoundTrip() throws {
        let metadata = FeedUpdateMetadata(
            timestamp: 1708430400,
            isBookmarked: true,
            isOnline: false,
            isFromCache: true
        )

        let data = try encoder.encode(metadata)
        let decoded = try decoder.decode(FeedUpdateMetadata.self, from: data)

        XCTAssertEqual(decoded.timestamp, 1708430400)
        XCTAssertEqual(decoded.isBookmarked, true)
        XCTAssertEqual(decoded.isOnline, false)
        XCTAssertEqual(decoded.isFromCache, true)
    }
}
