//
//  ProfileBridgeTypesTests.swift
//  AsphodelUITests
//
//  Unit tests for ProfileBridgeTypes JSON decoding and Codable round-trips.
//

import XCTest
@testable import NativeProfileView

// MARK: - ProfileBridgeTypesTests

class ProfileBridgeTypesTests: XCTestCase {

    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    // MARK: - SerializedProfile.decode: Full JSON (all fields)

    func testDecodeProfileWithAllFields() throws {
        let json = """
        {
            "did": "did:plc:alice123",
            "handle": "alice.bsky.social",
            "displayName": "Alice Example",
            "description": "Just a demo profile for testing.",
            "avatar": "https://example.com/avatar.jpg",
            "banner": "https://example.com/banner.jpg",
            "followersCount": 1234,
            "followsCount": 567,
            "postsCount": 890,
            "indexedAt": "2026-03-10T12:00:00.000Z",
            "isVerified": true,
            "viewer": {
                "muted": false,
                "blockedBy": false,
                "blocking": null,
                "blockingByList": null,
                "following": "at://did:plc:me/app.bsky.graph.follow/abc",
                "followedBy": "at://did:plc:alice123/app.bsky.graph.follow/xyz"
            },
            "labels": [
                {
                    "src": "did:plc:labeler1",
                    "uri": "at://did:plc:alice123/app.bsky.feed.post/post1",
                    "cid": "bafyreilabel1",
                    "val": "!warn",
                    "cts": "2026-03-01T00:00:00.000Z"
                }
            ],
            "pinnedPost": {
                "uri": "at://did:plc:alice123/app.bsky.feed.post/pinned1"
            },
            "associated": {
                "lists": 3,
                "feedgens": 2,
                "starterPacks": 1,
                "labeler": false,
                "chat": {
                    "allowIncoming": "following"
                }
            },
            "knownFollowers": {
                "count": 2,
                "followers": [
                    {
                        "did": "did:plc:follower1",
                        "handle": "bob.bsky.social",
                        "displayName": "Bob Smith",
                        "avatar": "https://example.com/bob-avatar.jpg"
                    },
                    {
                        "did": "did:plc:follower2",
                        "handle": "carol.bsky.social",
                        "displayName": null,
                        "avatar": null
                    }
                ]
            }
        }
        """

        let profile = try SerializedProfile.decode(from: json)

        XCTAssertEqual(profile.did, "did:plc:alice123")
        XCTAssertEqual(profile.handle, "alice.bsky.social")
        XCTAssertEqual(profile.displayName, "Alice Example")
        XCTAssertEqual(profile.description, "Just a demo profile for testing.")
        XCTAssertEqual(profile.avatar, "https://example.com/avatar.jpg")
        XCTAssertEqual(profile.banner, "https://example.com/banner.jpg")
        XCTAssertEqual(profile.followersCount, 1234)
        XCTAssertEqual(profile.followsCount, 567)
        XCTAssertEqual(profile.postsCount, 890)
        XCTAssertEqual(profile.indexedAt, "2026-03-10T12:00:00.000Z")
        XCTAssertEqual(profile.isVerified, true)

        // Viewer
        XCTAssertNotNil(profile.viewer)
        XCTAssertEqual(profile.viewer?.muted, false)
        XCTAssertEqual(profile.viewer?.blockedBy, false)
        XCTAssertNil(profile.viewer?.blocking)
        XCTAssertNil(profile.viewer?.blockingByList)
        XCTAssertEqual(profile.viewer?.following, "at://did:plc:me/app.bsky.graph.follow/abc")
        XCTAssertEqual(profile.viewer?.followedBy, "at://did:plc:alice123/app.bsky.graph.follow/xyz")

        // Labels
        XCTAssertEqual(profile.labels?.count, 1)
        XCTAssertEqual(profile.labels?[0].val, "!warn")
        XCTAssertEqual(profile.labels?[0].src, "did:plc:labeler1")

        // Pinned post ref
        XCTAssertEqual(profile.pinnedPost?.uri, "at://did:plc:alice123/app.bsky.feed.post/pinned1")

        // Associated
        XCTAssertEqual(profile.associated?.lists, 3)
        XCTAssertEqual(profile.associated?.feedgens, 2)
        XCTAssertEqual(profile.associated?.starterPacks, 1)
        XCTAssertEqual(profile.associated?.labeler, false)
        XCTAssertEqual(profile.associated?.chat?.allowIncoming, "following")

        // Known followers
        XCTAssertEqual(profile.knownFollowers?.count, 2)
        XCTAssertEqual(profile.knownFollowers?.followers.count, 2)
        XCTAssertEqual(profile.knownFollowers?.followers[0].did, "did:plc:follower1")
        XCTAssertEqual(profile.knownFollowers?.followers[0].handle, "bob.bsky.social")
        XCTAssertEqual(profile.knownFollowers?.followers[0].displayName, "Bob Smith")
        XCTAssertEqual(profile.knownFollowers?.followers[1].did, "did:plc:follower2")
        XCTAssertNil(profile.knownFollowers?.followers[1].displayName)
        XCTAssertNil(profile.knownFollowers?.followers[1].avatar)
    }

    // MARK: - SerializedProfile.decode: Minimal JSON (only did, handle)

    func testDecodeProfileWithMinimalFields() throws {
        let json = """
        {
            "did": "did:plc:minimal1",
            "handle": "minimal.bsky.social"
        }
        """

        let profile = try SerializedProfile.decode(from: json)

        XCTAssertEqual(profile.did, "did:plc:minimal1")
        XCTAssertEqual(profile.handle, "minimal.bsky.social")
        XCTAssertNil(profile.displayName, "displayName should be nil when not provided")
        XCTAssertNil(profile.description, "description should be nil when not provided")
        XCTAssertNil(profile.avatar, "avatar should be nil when not provided")
        XCTAssertNil(profile.banner, "banner should be nil when not provided")
        XCTAssertNil(profile.followersCount, "followersCount should be nil when not provided")
        XCTAssertNil(profile.followsCount, "followsCount should be nil when not provided")
        XCTAssertNil(profile.postsCount, "postsCount should be nil when not provided")
        XCTAssertNil(profile.indexedAt, "indexedAt should be nil when not provided")
        XCTAssertNil(profile.isVerified, "isVerified should be nil when not provided")
        XCTAssertNil(profile.viewer, "viewer should be nil when not provided")
        XCTAssertNil(profile.labels, "labels should be nil when not provided")
        XCTAssertNil(profile.pinnedPost, "pinnedPost should be nil when not provided")
        XCTAssertNil(profile.associated, "associated should be nil when not provided")
        XCTAssertNil(profile.knownFollowers, "knownFollowers should be nil when not provided")
    }

    // MARK: - SerializedProfile.decode: Invalid JSON throws error

    func testDecodeProfileWithInvalidJsonThrows() {
        let invalidJson = "{ this is not valid json }"

        XCTAssertThrowsError(try SerializedProfile.decode(from: invalidJson)) { error in
            XCTAssertTrue(error is DecodingError, "Should throw a DecodingError for invalid JSON")
        }
    }

    // MARK: - SerializedProfile.decode: Empty string throws error

    func testDecodeProfileWithEmptyStringThrows() {
        let emptyString = ""

        XCTAssertThrowsError(try SerializedProfile.decode(from: emptyString)) { error in
            // Empty string produces valid UTF-8 data but fails JSON decoding
            XCTAssertTrue(
                error is DecodingError,
                "Should throw a DecodingError for empty string"
            )
        }
    }

    // MARK: - SerializedProfile Codable round-trip via JSONEncoder/JSONDecoder

    func testProfileCodableRoundTrip() throws {
        let original = SerializedProfile(
            did: "did:plc:roundtrip1",
            handle: "roundtrip.bsky.social",
            displayName: "Round Trip User",
            description: "Testing Codable round-trip.",
            avatar: "https://example.com/avatar.jpg",
            banner: "https://example.com/banner.jpg",
            followersCount: 500,
            followsCount: 250,
            postsCount: 100,
            indexedAt: "2026-03-10T08:00:00.000Z",
            isVerified: true,
            viewer: nil,
            labels: [
                SerializedLabel(src: "did:plc:labeler1", uri: nil, cid: nil, val: "!warn", cts: nil)
            ],
            pinnedPost: SerializedPinnedPostRef(uri: "at://did:plc:roundtrip1/app.bsky.feed.post/pinned"),
            associated: nil,
            knownFollowers: nil
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedProfile.self, from: data)

        XCTAssertEqual(decoded.did, original.did)
        XCTAssertEqual(decoded.handle, original.handle)
        XCTAssertEqual(decoded.displayName, original.displayName)
        XCTAssertEqual(decoded.description, original.description)
        XCTAssertEqual(decoded.avatar, original.avatar)
        XCTAssertEqual(decoded.banner, original.banner)
        XCTAssertEqual(decoded.followersCount, original.followersCount)
        XCTAssertEqual(decoded.followsCount, original.followsCount)
        XCTAssertEqual(decoded.postsCount, original.postsCount)
        XCTAssertEqual(decoded.indexedAt, original.indexedAt)
        XCTAssertEqual(decoded.isVerified, original.isVerified)
        XCTAssertNil(decoded.viewer)
        XCTAssertEqual(decoded.labels?.count, 1)
        XCTAssertEqual(decoded.labels?[0].val, "!warn")
        XCTAssertEqual(decoded.pinnedPost?.uri, original.pinnedPost?.uri)
        XCTAssertNil(decoded.associated)
        XCTAssertNil(decoded.knownFollowers)
    }

    // MARK: - SerializedProfile with viewer data round-trips

    func testProfileWithViewerDataRoundTrips() throws {
        let viewer = SerializedProfileViewer(
            muted: true,
            blockedBy: false,
            blocking: "at://did:plc:me/app.bsky.graph.block/blk1",
            blockingByList: SerializedListViewBasic(
                uri: "at://did:plc:mod/app.bsky.graph.list/modlist1",
                cid: "bafyreilist1",
                name: "Mod List",
                purpose: "app.bsky.graph.defs#modlist",
                avatar: nil,
                viewer: SerializedListViewerState(muted: true, blocked: nil)
            ),
            following: nil,
            followedBy: "at://did:plc:other/app.bsky.graph.follow/fol1"
        )

        let original = SerializedProfile(
            did: "did:plc:viewertest1",
            handle: "viewertest.bsky.social",
            displayName: nil,
            description: nil,
            avatar: nil,
            banner: nil,
            followersCount: nil,
            followsCount: nil,
            postsCount: nil,
            indexedAt: nil,
            isVerified: nil,
            viewer: viewer,
            labels: nil,
            pinnedPost: nil,
            associated: nil,
            knownFollowers: nil
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedProfile.self, from: data)

        XCTAssertNotNil(decoded.viewer)
        XCTAssertEqual(decoded.viewer?.muted, true)
        XCTAssertEqual(decoded.viewer?.blockedBy, false)
        XCTAssertEqual(decoded.viewer?.blocking, "at://did:plc:me/app.bsky.graph.block/blk1")
        XCTAssertNil(decoded.viewer?.following)
        XCTAssertEqual(decoded.viewer?.followedBy, "at://did:plc:other/app.bsky.graph.follow/fol1")

        // blockingByList round-trip
        XCTAssertNotNil(decoded.viewer?.blockingByList)
        XCTAssertEqual(decoded.viewer?.blockingByList?.uri, "at://did:plc:mod/app.bsky.graph.list/modlist1")
        XCTAssertEqual(decoded.viewer?.blockingByList?.cid, "bafyreilist1")
        XCTAssertEqual(decoded.viewer?.blockingByList?.name, "Mod List")
        XCTAssertEqual(decoded.viewer?.blockingByList?.purpose, "app.bsky.graph.defs#modlist")
        XCTAssertNil(decoded.viewer?.blockingByList?.avatar)
        XCTAssertEqual(decoded.viewer?.blockingByList?.viewer?.muted, true)
        XCTAssertNil(decoded.viewer?.blockingByList?.viewer?.blocked)
    }

    // MARK: - SerializedProfile with knownFollowers round-trips

    func testProfileWithKnownFollowersRoundTrips() throws {
        let knownFollowers = SerializedKnownFollowers(
            count: 3,
            followers: [
                SerializedKnownFollower(
                    did: "did:plc:kf1",
                    handle: "known1.bsky.social",
                    displayName: "Known One",
                    avatar: "https://example.com/kf1.jpg"
                ),
                SerializedKnownFollower(
                    did: "did:plc:kf2",
                    handle: "known2.bsky.social",
                    displayName: nil,
                    avatar: nil
                ),
                SerializedKnownFollower(
                    did: "did:plc:kf3",
                    handle: "known3.bsky.social",
                    displayName: "Known Three",
                    avatar: nil
                ),
            ]
        )

        let original = SerializedProfile(
            did: "did:plc:kftest1",
            handle: "kftest.bsky.social",
            displayName: nil,
            description: nil,
            avatar: nil,
            banner: nil,
            followersCount: nil,
            followsCount: nil,
            postsCount: nil,
            indexedAt: nil,
            isVerified: nil,
            viewer: nil,
            labels: nil,
            pinnedPost: nil,
            associated: nil,
            knownFollowers: knownFollowers
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedProfile.self, from: data)

        XCTAssertNotNil(decoded.knownFollowers)
        XCTAssertEqual(decoded.knownFollowers?.count, 3)
        XCTAssertEqual(decoded.knownFollowers?.followers.count, 3)

        XCTAssertEqual(decoded.knownFollowers?.followers[0].did, "did:plc:kf1")
        XCTAssertEqual(decoded.knownFollowers?.followers[0].handle, "known1.bsky.social")
        XCTAssertEqual(decoded.knownFollowers?.followers[0].displayName, "Known One")
        XCTAssertEqual(decoded.knownFollowers?.followers[0].avatar, "https://example.com/kf1.jpg")

        XCTAssertEqual(decoded.knownFollowers?.followers[1].did, "did:plc:kf2")
        XCTAssertNil(decoded.knownFollowers?.followers[1].displayName)
        XCTAssertNil(decoded.knownFollowers?.followers[1].avatar)

        XCTAssertEqual(decoded.knownFollowers?.followers[2].did, "did:plc:kf3")
        XCTAssertEqual(decoded.knownFollowers?.followers[2].displayName, "Known Three")
        XCTAssertNil(decoded.knownFollowers?.followers[2].avatar)
    }

    // MARK: - SerializedPinnedPost.decode with all fields

    func testDecodePinnedPostWithAllFields() throws {
        let json = """
        {
            "uri": "at://did:plc:alice123/app.bsky.feed.post/pinned1",
            "authorHandle": "alice.bsky.social",
            "authorDisplayName": "Alice Example",
            "authorAvatar": "https://example.com/alice-avatar.jpg",
            "text": "This is my pinned post!",
            "indexedAt": "2026-03-10T09:00:00.000Z",
            "likeCount": 42,
            "repostCount": 7,
            "replyCount": 3
        }
        """

        let post = try SerializedPinnedPost.decode(from: json)

        XCTAssertEqual(post.uri, "at://did:plc:alice123/app.bsky.feed.post/pinned1")
        XCTAssertEqual(post.authorHandle, "alice.bsky.social")
        XCTAssertEqual(post.authorDisplayName, "Alice Example")
        XCTAssertEqual(post.authorAvatar, "https://example.com/alice-avatar.jpg")
        XCTAssertEqual(post.text, "This is my pinned post!")
        XCTAssertEqual(post.indexedAt, "2026-03-10T09:00:00.000Z")
        XCTAssertEqual(post.likeCount, 42)
        XCTAssertEqual(post.repostCount, 7)
        XCTAssertEqual(post.replyCount, 3)
    }

    // MARK: - SerializedPinnedPost.decode with minimal fields

    func testDecodePinnedPostWithMinimalFields() throws {
        let json = """
        {
            "uri": "at://did:plc:bob456/app.bsky.feed.post/pinned2",
            "authorHandle": "bob.bsky.social"
        }
        """

        let post = try SerializedPinnedPost.decode(from: json)

        XCTAssertEqual(post.uri, "at://did:plc:bob456/app.bsky.feed.post/pinned2")
        XCTAssertEqual(post.authorHandle, "bob.bsky.social")
        XCTAssertNil(post.authorDisplayName, "authorDisplayName should be nil when not provided")
        XCTAssertNil(post.authorAvatar, "authorAvatar should be nil when not provided")
        XCTAssertNil(post.text, "text should be nil when not provided")
        XCTAssertNil(post.indexedAt, "indexedAt should be nil when not provided")
        XCTAssertNil(post.likeCount, "likeCount should be nil when not provided")
        XCTAssertNil(post.repostCount, "repostCount should be nil when not provided")
        XCTAssertNil(post.replyCount, "replyCount should be nil when not provided")
    }

    // MARK: - SerializedPinnedPost.decode with invalid JSON throws

    func testDecodePinnedPostWithInvalidJsonThrows() {
        let invalidJson = "not a json object"

        XCTAssertThrowsError(try SerializedPinnedPost.decode(from: invalidJson)) { error in
            XCTAssertTrue(error is DecodingError, "Should throw a DecodingError for invalid JSON")
        }
    }

    // MARK: - SerializedStarterPack.decodeArray with multiple packs

    func testDecodeStarterPackArrayWithMultiplePacks() throws {
        let json = """
        [
            {
                "uri": "at://did:plc:alice123/app.bsky.graph.starterpack/sp1",
                "cid": "bafyreisp1",
                "name": "Cool People Pack",
                "listItemCount": 25,
                "joinedAllTimeCount": 100
            },
            {
                "uri": "at://did:plc:alice123/app.bsky.graph.starterpack/sp2",
                "cid": null,
                "name": "Developer Starter Pack",
                "listItemCount": 10,
                "joinedAllTimeCount": null
            },
            {
                "uri": "at://did:plc:alice123/app.bsky.graph.starterpack/sp3",
                "name": "Minimal Pack"
            }
        ]
        """

        let packs = try SerializedStarterPack.decodeArray(from: json)

        XCTAssertEqual(packs.count, 3)

        XCTAssertEqual(packs[0].uri, "at://did:plc:alice123/app.bsky.graph.starterpack/sp1")
        XCTAssertEqual(packs[0].cid, "bafyreisp1")
        XCTAssertEqual(packs[0].name, "Cool People Pack")
        XCTAssertEqual(packs[0].listItemCount, 25)
        XCTAssertEqual(packs[0].joinedAllTimeCount, 100)

        XCTAssertEqual(packs[1].uri, "at://did:plc:alice123/app.bsky.graph.starterpack/sp2")
        XCTAssertNil(packs[1].cid)
        XCTAssertEqual(packs[1].name, "Developer Starter Pack")
        XCTAssertEqual(packs[1].listItemCount, 10)
        XCTAssertNil(packs[1].joinedAllTimeCount)

        XCTAssertEqual(packs[2].uri, "at://did:plc:alice123/app.bsky.graph.starterpack/sp3")
        XCTAssertNil(packs[2].cid)
        XCTAssertEqual(packs[2].name, "Minimal Pack")
        XCTAssertNil(packs[2].listItemCount)
        XCTAssertNil(packs[2].joinedAllTimeCount)
    }

    // MARK: - SerializedStarterPack.decodeArray with empty array

    func testDecodeStarterPackArrayWithEmptyArray() throws {
        let json = "[]"

        let packs = try SerializedStarterPack.decodeArray(from: json)

        XCTAssertTrue(packs.isEmpty, "Decoding an empty JSON array should return an empty array")
    }

    // MARK: - SerializedStarterPack.decodeArray with invalid JSON throws

    func testDecodeStarterPackArrayWithInvalidJsonThrows() {
        let invalidJson = "{ not an array }"

        XCTAssertThrowsError(try SerializedStarterPack.decodeArray(from: invalidJson)) { error in
            XCTAssertTrue(error is DecodingError, "Should throw a DecodingError for invalid JSON")
        }
    }

    // MARK: - SerializedProfileViewer Codable round-trip with all nil optionals

    func testProfileViewerCodableRoundTripWithAllNilOptionals() throws {
        let original = SerializedProfileViewer(
            muted: nil,
            blockedBy: nil,
            blocking: nil,
            blockingByList: nil,
            following: nil,
            followedBy: nil
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedProfileViewer.self, from: data)

        XCTAssertNil(decoded.muted, "muted should remain nil after round-trip")
        XCTAssertNil(decoded.blockedBy, "blockedBy should remain nil after round-trip")
        XCTAssertNil(decoded.blocking, "blocking should remain nil after round-trip")
        XCTAssertNil(decoded.blockingByList, "blockingByList should remain nil after round-trip")
        XCTAssertNil(decoded.following, "following should remain nil after round-trip")
        XCTAssertNil(decoded.followedBy, "followedBy should remain nil after round-trip")
    }

    // MARK: - SerializedProfileViewer Codable round-trip with all fields set

    func testProfileViewerCodableRoundTripWithAllFieldsSet() throws {
        let listViewer = SerializedListViewerState(
            muted: false,
            blocked: "at://did:plc:mod/app.bsky.graph.listblock/lb1"
        )
        let blockingByList = SerializedListViewBasic(
            uri: "at://did:plc:mod/app.bsky.graph.list/list1",
            cid: "bafyreilistcid1",
            name: "Block List",
            purpose: "app.bsky.graph.defs#modlist",
            avatar: "https://example.com/list-avatar.jpg",
            viewer: listViewer
        )
        let original = SerializedProfileViewer(
            muted: true,
            blockedBy: true,
            blocking: "at://did:plc:me/app.bsky.graph.block/blk1",
            blockingByList: blockingByList,
            following: "at://did:plc:me/app.bsky.graph.follow/fol1",
            followedBy: "at://did:plc:other/app.bsky.graph.follow/fol2"
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedProfileViewer.self, from: data)

        XCTAssertEqual(decoded.muted, true)
        XCTAssertEqual(decoded.blockedBy, true)
        XCTAssertEqual(decoded.blocking, "at://did:plc:me/app.bsky.graph.block/blk1")
        XCTAssertEqual(decoded.following, "at://did:plc:me/app.bsky.graph.follow/fol1")
        XCTAssertEqual(decoded.followedBy, "at://did:plc:other/app.bsky.graph.follow/fol2")

        XCTAssertNotNil(decoded.blockingByList)
        XCTAssertEqual(decoded.blockingByList?.uri, blockingByList.uri)
        XCTAssertEqual(decoded.blockingByList?.cid, blockingByList.cid)
        XCTAssertEqual(decoded.blockingByList?.name, blockingByList.name)
        XCTAssertEqual(decoded.blockingByList?.purpose, blockingByList.purpose)
        XCTAssertEqual(decoded.blockingByList?.avatar, blockingByList.avatar)
        XCTAssertEqual(decoded.blockingByList?.viewer?.muted, false)
        XCTAssertEqual(decoded.blockingByList?.viewer?.blocked, "at://did:plc:mod/app.bsky.graph.listblock/lb1")
    }

    // MARK: - SerializedProfileAssociated round-trip with chat settings

    func testProfileAssociatedRoundTripWithChatSettings() throws {
        let original = SerializedProfileAssociated(
            lists: 5,
            feedgens: 3,
            starterPacks: 2,
            labeler: true,
            chat: SerializedProfileAssociatedChat(allowIncoming: "all")
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedProfileAssociated.self, from: data)

        XCTAssertEqual(decoded.lists, 5)
        XCTAssertEqual(decoded.feedgens, 3)
        XCTAssertEqual(decoded.starterPacks, 2)
        XCTAssertEqual(decoded.labeler, true)
        XCTAssertNotNil(decoded.chat)
        XCTAssertEqual(decoded.chat?.allowIncoming, "all")
    }

    // MARK: - SerializedProfileAssociated round-trip with all nil optionals

    func testProfileAssociatedRoundTripWithAllNilOptionals() throws {
        let original = SerializedProfileAssociated(
            lists: nil,
            feedgens: nil,
            starterPacks: nil,
            labeler: nil,
            chat: nil
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedProfileAssociated.self, from: data)

        XCTAssertNil(decoded.lists)
        XCTAssertNil(decoded.feedgens)
        XCTAssertNil(decoded.starterPacks)
        XCTAssertNil(decoded.labeler)
        XCTAssertNil(decoded.chat)
    }

    // MARK: - SerializedPinnedPost Codable round-trip

    func testPinnedPostCodableRoundTrip() throws {
        let original = SerializedPinnedPost(
            uri: "at://did:plc:test/app.bsky.feed.post/pp1",
            authorHandle: "test.bsky.social",
            authorDisplayName: "Test User",
            authorAvatar: "https://example.com/test-avatar.jpg",
            text: "Pinned post round-trip test",
            indexedAt: "2026-03-10T10:00:00.000Z",
            likeCount: 99,
            repostCount: 15,
            replyCount: 8
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedPinnedPost.self, from: data)

        XCTAssertEqual(decoded.uri, original.uri)
        XCTAssertEqual(decoded.authorHandle, original.authorHandle)
        XCTAssertEqual(decoded.authorDisplayName, original.authorDisplayName)
        XCTAssertEqual(decoded.authorAvatar, original.authorAvatar)
        XCTAssertEqual(decoded.text, original.text)
        XCTAssertEqual(decoded.indexedAt, original.indexedAt)
        XCTAssertEqual(decoded.likeCount, original.likeCount)
        XCTAssertEqual(decoded.repostCount, original.repostCount)
        XCTAssertEqual(decoded.replyCount, original.replyCount)
    }

    // MARK: - SerializedStarterPack Codable round-trip

    func testStarterPackCodableRoundTrip() throws {
        let original = SerializedStarterPack(
            uri: "at://did:plc:test/app.bsky.graph.starterpack/sp1",
            cid: "bafyreistarterpack1",
            name: "My Starter Pack",
            listItemCount: 50,
            joinedAllTimeCount: 200
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedStarterPack.self, from: data)

        XCTAssertEqual(decoded.uri, original.uri)
        XCTAssertEqual(decoded.cid, original.cid)
        XCTAssertEqual(decoded.name, original.name)
        XCTAssertEqual(decoded.listItemCount, original.listItemCount)
        XCTAssertEqual(decoded.joinedAllTimeCount, original.joinedAllTimeCount)
    }

    // MARK: - SerializedLabel Codable round-trip

    func testLabelCodableRoundTrip() throws {
        let original = SerializedLabel(
            src: "did:plc:labeler1",
            uri: "at://did:plc:user1/app.bsky.feed.post/post1",
            cid: "bafyreilabelcid1",
            val: "porn",
            cts: "2026-03-10T00:00:00.000Z"
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedLabel.self, from: data)

        XCTAssertEqual(decoded.src, original.src)
        XCTAssertEqual(decoded.uri, original.uri)
        XCTAssertEqual(decoded.cid, original.cid)
        XCTAssertEqual(decoded.val, original.val)
        XCTAssertEqual(decoded.cts, original.cts)
    }

    // MARK: - SerializedLabel with minimal fields

    func testLabelCodableRoundTripWithMinimalFields() throws {
        let original = SerializedLabel(
            src: nil,
            uri: nil,
            cid: nil,
            val: "!hide",
            cts: nil
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedLabel.self, from: data)

        XCTAssertNil(decoded.src)
        XCTAssertNil(decoded.uri)
        XCTAssertNil(decoded.cid)
        XCTAssertEqual(decoded.val, "!hide")
        XCTAssertNil(decoded.cts)
    }

    // MARK: - SerializedKnownFollowers Codable round-trip

    func testKnownFollowersCodableRoundTrip() throws {
        let original = SerializedKnownFollowers(
            count: 1,
            followers: [
                SerializedKnownFollower(
                    did: "did:plc:kf1",
                    handle: "knownfollower.bsky.social",
                    displayName: "Known Follower",
                    avatar: "https://example.com/kf.jpg"
                )
            ]
        )

        let data = try encoder.encode(original)
        let decoded = try decoder.decode(SerializedKnownFollowers.self, from: data)

        XCTAssertEqual(decoded.count, 1)
        XCTAssertEqual(decoded.followers.count, 1)
        XCTAssertEqual(decoded.followers[0].did, "did:plc:kf1")
        XCTAssertEqual(decoded.followers[0].handle, "knownfollower.bsky.social")
        XCTAssertEqual(decoded.followers[0].displayName, "Known Follower")
        XCTAssertEqual(decoded.followers[0].avatar, "https://example.com/kf.jpg")
    }

    // MARK: - SerializedProfile.decode with missing required field throws

    func testDecodeProfileMissingDidThrows() {
        let json = """
        {
            "handle": "nohandle.bsky.social"
        }
        """

        XCTAssertThrowsError(try SerializedProfile.decode(from: json)) { error in
            XCTAssertTrue(error is DecodingError, "Should throw DecodingError when 'did' is missing")
        }
    }

    // MARK: - SerializedProfile.decode with missing handle throws

    func testDecodeProfileMissingHandleThrows() {
        let json = """
        {
            "did": "did:plc:nohandle1"
        }
        """

        XCTAssertThrowsError(try SerializedProfile.decode(from: json)) { error in
            XCTAssertTrue(error is DecodingError, "Should throw DecodingError when 'handle' is missing")
        }
    }

    // MARK: - SerializedPinnedPost.decode with missing required uri throws

    func testDecodePinnedPostMissingUriThrows() {
        let json = """
        {
            "authorHandle": "alice.bsky.social",
            "text": "Missing uri field"
        }
        """

        XCTAssertThrowsError(try SerializedPinnedPost.decode(from: json)) { error in
            XCTAssertTrue(error is DecodingError, "Should throw DecodingError when 'uri' is missing")
        }
    }

    // MARK: - SerializedStarterPack.decodeArray with non-array JSON throws

    func testDecodeStarterPackArrayWithNonArrayJsonThrows() {
        let json = """
        {
            "uri": "at://did:plc:x/app.bsky.graph.starterpack/sp1",
            "name": "Single object, not array"
        }
        """

        XCTAssertThrowsError(try SerializedStarterPack.decodeArray(from: json)) { error in
            XCTAssertTrue(
                error is DecodingError,
                "Should throw DecodingError when JSON is an object instead of an array"
            )
        }
    }
}
