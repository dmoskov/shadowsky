//
//  FeedListPerformanceTests.swift
//  AsphodelPerformanceTests
//
//  XCTest performance benchmarks for FeedListView post conversion
//  and rendering data preparation. Validates that pre-computed conversions
//  (FeedState.convertPost) meet performance targets.
//

import XCTest
@testable import FeedBridge
@testable import NativeFeedList

class FeedListPerformanceTests: XCTestCase {

    // MARK: - Test Data Generation

    private func makePost(index: Int, withEmbed: Bool = false) -> SerializedPost {
        SerializedPost(
            uri: "at://did:plc:perf\(index)/app.bsky.feed.post/\(index)",
            cid: "bafyrei\(String(format: "%040d", index))",
            author: SerializedAuthor(
                did: "did:plc:perf\(index % 50)",
                handle: "perf\(index % 50).bsky.social",
                displayName: "Perf User \(index % 50)",
                avatar: "https://cdn.bsky.app/img/avatar/did:plc:perf\(index % 50)/\(index)"
            ),
            record: SerializedRecord(
                text: "Performance test post \(index). Lorem ipsum dolor sit amet, consectetur adipiscing elit. @mention #hashtag https://example.com",
                facets: [
                    Facet(
                        index: FacetIndex(byteStart: 45, byteEnd: 53),
                        features: [
                            .mention(FacetFeatureMention(
                                type: "app.bsky.richtext.facet#mention",
                                did: "did:plc:mentioned"
                            ))
                        ]
                    ),
                    Facet(
                        index: FacetIndex(byteStart: 54, byteEnd: 62),
                        features: [
                            .tag(FacetFeatureTag(
                                type: "app.bsky.richtext.facet#tag",
                                tag: "hashtag"
                            ))
                        ]
                    ),
                    Facet(
                        index: FacetIndex(byteStart: 63, byteEnd: 83),
                        features: [
                            .link(FacetFeatureLink(
                                type: "app.bsky.richtext.facet#link",
                                uri: "https://example.com"
                            ))
                        ]
                    )
                ],
                createdAt: "2026-02-17T12:\(String(format: "%02d", index % 60)):00.000Z"
            ),
            embed: withEmbed ? .images(EmbedImages(
                type: "app.bsky.embed.images#view",
                images: [
                    ViewImage(
                        thumb: "https://cdn.bsky.app/img/feed_thumbnail/\(index)/1.jpg",
                        fullsize: "https://cdn.bsky.app/img/feed_fullsize/\(index)/1.jpg",
                        alt: "Image 1 for post \(index)",
                        aspectRatio: AspectRatio(width: 1200, height: 800)
                    ),
                    ViewImage(
                        thumb: "https://cdn.bsky.app/img/feed_thumbnail/\(index)/2.jpg",
                        fullsize: "https://cdn.bsky.app/img/feed_fullsize/\(index)/2.jpg",
                        alt: "Image 2 for post \(index)",
                        aspectRatio: AspectRatio(width: 800, height: 1200)
                    )
                ]
            )) : nil,
            replyCount: Int.random(in: 0...100),
            repostCount: Int.random(in: 0...200),
            likeCount: Int.random(in: 0...1000),
            quoteCount: Int.random(in: 0...50),
            viewer: SerializedViewer(
                like: index % 3 == 0 ? "at://did:plc:me/app.bsky.feed.like/\(index)" : nil,
                repost: index % 7 == 0 ? "at://did:plc:me/app.bsky.feed.repost/\(index)" : nil,
                muted: nil,
                blocked: nil
            ),
            labels: index % 20 == 0 ? [
                SerializedLabel(val: "nsfw", src: "did:plc:mod", uri: "", cid: nil, cts: "2026-02-17T00:00:00.000Z")
            ] : nil,
            indexedAt: "2026-02-17T12:\(String(format: "%02d", index % 60)):00.000Z"
        )
    }

    private func makeFeedViewPost(index: Int, withEmbed: Bool = false) -> SerializedFeedViewPost {
        SerializedFeedViewPost(
            post: makePost(index: index, withEmbed: withEmbed),
            reply: nil,
            reason: index % 5 == 0 ? .repost(SerializedReasonRepost(
                type: "app.bsky.feed.defs#reasonRepost",
                by: SerializedAuthor(
                    did: "did:plc:reposter\(index)",
                    handle: "reposter\(index).bsky.social",
                    displayName: "Reposter \(index)",
                    avatar: nil
                ),
                indexedAt: "2026-02-17T12:00:00.000Z"
            )) : nil,
            feedContext: nil,
            isBookmarked: index % 10 == 0
        )
    }

    // MARK: - Post Conversion Performance Tests

    /// Test: Convert 50 posts (single page) from serialized to FeedViewPost
    /// This is the core operation from FeedState.updatePosts (line 324-327)
    /// Target: <10ms for 50 posts
    func testConvertPosts_50Posts() {
        let posts = (0..<50).map { makeFeedViewPost(index: $0, withEmbed: $0 % 3 == 0) }

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = posts.map { FeedState.convertPost($0) }
        }
    }

    /// Test: Convert 200 posts (4 pages accumulated)
    /// Target: <40ms for 200 posts (linear scaling)
    func testConvertPosts_200Posts() {
        let posts = (0..<200).map { makeFeedViewPost(index: $0, withEmbed: $0 % 3 == 0) }

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = posts.map { FeedState.convertPost($0) }
        }
    }

    /// Test: Convert 500 posts (max feed, all with embeds and facets)
    /// This is the worst-case scenario from ISSUE-MEM-2
    /// Target: <100ms for 500 posts
    func testConvertPosts_500Posts_AllEmbeds() {
        let posts = (0..<500).map { makeFeedViewPost(index: $0, withEmbed: true) }

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = posts.map { FeedState.convertPost($0) }
        }
    }

    /// Test: Single post re-conversion (incremental update path)
    /// This happens when a post's like/repost count changes
    /// Target: <0.5ms per post (negligible)
    func testConvertSinglePost_WithFacets() {
        let post = makeFeedViewPost(index: 0, withEmbed: true)

        measure(metrics: [XCTClockMetric()]) {
            for _ in 0..<1000 {
                _ = FeedState.convertPost(post)
            }
        }
    }

    /// Test: Facet conversion performance
    /// Posts with many facets (mentions, links, hashtags) take longer to convert
    func testConvertPosts_ManyFacets() {
        // Create posts with 5 facets each (heavy facet load)
        let posts = (0..<100).map { index -> SerializedFeedViewPost in
            let facets = (0..<5).map { f -> Facet in
                Facet(
                    index: FacetIndex(byteStart: f * 20, byteEnd: f * 20 + 10),
                    features: [
                        f % 3 == 0 ?
                            .mention(FacetFeatureMention(type: "app.bsky.richtext.facet#mention", did: "did:plc:m\(f)")) :
                        f % 3 == 1 ?
                            .link(FacetFeatureLink(type: "app.bsky.richtext.facet#link", uri: "https://example.com/\(f)")) :
                            .tag(FacetFeatureTag(type: "app.bsky.richtext.facet#tag", tag: "tag\(f)"))
                    ]
                )
            }

            let post = SerializedPost(
                uri: "at://did:plc:facet\(index)/app.bsky.feed.post/\(index)",
                cid: "bafyrei\(String(format: "%040d", index))",
                author: SerializedAuthor(did: "did:plc:facet\(index)", handle: "facet\(index).bsky.social", displayName: "Facet User", avatar: nil),
                record: SerializedRecord(text: "Post with many facets for performance testing", facets: facets, createdAt: "2026-02-17T12:00:00.000Z"),
                embed: nil,
                replyCount: 0, repostCount: 0, likeCount: 0, quoteCount: 0,
                viewer: nil, labels: nil, indexedAt: "2026-02-17T12:00:00.000Z"
            )
            return SerializedFeedViewPost(post: post, reply: nil, reason: nil, feedContext: nil)
        }

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = posts.map { FeedState.convertPost($0) }
        }
    }

    // MARK: - Memory Behavior Tests

    /// Test: Memory footprint of 500 ConvertedFeedPost objects
    /// Validates that pre-computed conversion doesn't use excessive memory
    func testMemoryFootprint_500ConvertedPosts() {
        let posts = (0..<500).map { makeFeedViewPost(index: $0, withEmbed: $0 % 3 == 0) }

        measure(metrics: [XCTMemoryMetric()]) {
            let converted = posts.map { FeedState.convertPost($0) }
            // Force retain to measure actual footprint
            XCTAssertEqual(converted.count, 500)
        }
    }

    /// Test: Memory overhead of keeping both serialized and converted arrays
    /// FeedState keeps posts + convertedPosts simultaneously
    func testMemoryFootprint_DualArrayRetention() {
        let posts = (0..<500).map { makeFeedViewPost(index: $0, withEmbed: $0 % 3 == 0) }

        measure(metrics: [XCTMemoryMetric()]) {
            // Simulate what FeedState.updatePosts does
            let serialized = posts
            let converted = posts.map { FeedState.convertPost($0) }
            XCTAssertEqual(serialized.count, 500)
            XCTAssertEqual(converted.count, 500)
        }
    }
}
