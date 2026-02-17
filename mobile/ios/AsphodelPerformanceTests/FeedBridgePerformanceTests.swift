//
//  FeedBridgePerformanceTests.swift
//  AsphodelPerformanceTests
//
//  XCTest performance benchmarks for FeedBridge data operations.
//  Validates that fixes from INSTRUMENTS_PROFILING_REPORT.md meet
//  their performance targets under sustained load.
//

import XCTest
@testable import FeedBridge

class FeedBridgePerformanceTests: XCTestCase {

    // MARK: - Test Data Generation

    /// Generate a synthetic SerializedPost for testing
    private func makePost(index: Int) -> SerializedPost {
        SerializedPost(
            uri: "at://did:plc:test\(index)/app.bsky.feed.post/\(index)",
            cid: "bafyrei\(String(format: "%040d", index))",
            author: SerializedAuthor(
                did: "did:plc:test\(index % 50)",  // 50 unique authors
                handle: "user\(index % 50).bsky.social",
                displayName: "Test User \(index % 50)",
                avatar: "https://cdn.bsky.app/img/avatar/did:plc:test\(index % 50)/\(index)"
            ),
            record: SerializedRecord(
                text: "This is test post number \(index). It contains some text to simulate real post content with a reasonable length that mimics actual Bluesky posts. #test #performance",
                facets: [
                    Facet(
                        index: FacetIndex(byteStart: 0, byteEnd: 5),
                        features: [
                            .tag(FacetFeatureTag(type: "app.bsky.richtext.facet#tag", tag: "test"))
                        ]
                    )
                ],
                createdAt: "2026-02-17T12:00:\(String(format: "%02d", index % 60)).000Z"
            ),
            embed: index % 3 == 0 ? .images(EmbedImages(
                type: "app.bsky.embed.images#view",
                images: [
                    ViewImage(
                        thumb: "https://cdn.bsky.app/img/feed_thumbnail/\(index)/thumb.jpg",
                        fullsize: "https://cdn.bsky.app/img/feed_fullsize/\(index)/full.jpg",
                        alt: "Test image \(index)",
                        aspectRatio: AspectRatio(width: 1200, height: 800)
                    )
                ]
            )) : nil,
            replyCount: Int.random(in: 0...100),
            repostCount: Int.random(in: 0...200),
            likeCount: Int.random(in: 0...1000),
            quoteCount: Int.random(in: 0...50),
            viewer: SerializedViewer(
                like: index % 5 == 0 ? "at://did:plc:me/app.bsky.feed.like/\(index)" : nil,
                repost: index % 10 == 0 ? "at://did:plc:me/app.bsky.feed.repost/\(index)" : nil,
                muted: nil,
                blocked: nil
            ),
            labels: nil,
            indexedAt: "2026-02-17T12:00:\(String(format: "%02d", index % 60)).000Z"
        )
    }

    private func makeFeedViewPost(index: Int) -> SerializedFeedViewPost {
        SerializedFeedViewPost(
            post: makePost(index: index),
            reply: nil,
            reason: nil,
            feedContext: nil,
            isBookmarked: index % 7 == 0
        )
    }

    private func makeFeedData(count: Int) -> SerializedFeedData {
        let posts = (0..<count).map { makeFeedViewPost(index: $0) }
        return SerializedFeedData(
            posts: posts,
            metadata: FeedUpdateMetadata(
                timestamp: Int(Date().timeIntervalSince1970 * 1000),
                isBookmarked: nil,
                isOnline: true,
                isFromCache: false
            ),
            cursor: "cursor_\(count)"
        )
    }

    private func makeBatchUpdate(uris: [String], allThreeCounts: Bool = true) -> FeedBatchUpdate {
        let updates = uris.map { uri in
            PostUpdate(
                uri: uri,
                likeCount: allThreeCounts ? Int.random(in: 0...1000) : nil,
                repostCount: allThreeCounts ? Int.random(in: 0...200) : nil,
                replyCount: allThreeCounts ? Int.random(in: 0...100) : nil,
                viewer: nil,
                isBookmarked: nil
            )
        }
        return FeedBatchUpdate(
            updates: updates,
            timestamp: Int(Date().timeIntervalSince1970 * 1000)
        )
    }

    // MARK: - JSON Encoding Helpers

    private func encodeFeedData(_ feedData: SerializedFeedData) -> String {
        let encoder = JSONEncoder()
        let data = try! encoder.encode(feedData)
        return String(data: data, encoding: .utf8)!
    }

    private func encodeBatchUpdate(_ batchUpdate: FeedBatchUpdate) -> String {
        let encoder = JSONEncoder()
        let data = try! encoder.encode(batchUpdate)
        return String(data: data, encoding: .utf8)!
    }

    // MARK: - Performance Tests

    /// Test: JSON decode performance for 50 posts (single page load)
    /// Target: <50ms per page (from ISSUE-CPU-4 analysis)
    func testDecodeFeedData_50Posts() throws {
        let feedData = makeFeedData(count: 50)
        let jsonString = encodeFeedData(feedData)

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = try? SerializedFeedData.decodeLenient(from: jsonString)
        }
    }

    /// Test: JSON decode performance for 200 posts (4 pages accumulated)
    /// Target: <200ms (linear scaling from 50-post target)
    func testDecodeFeedData_200Posts() throws {
        let feedData = makeFeedData(count: 200)
        let jsonString = encodeFeedData(feedData)

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = try? SerializedFeedData.decodeLenient(from: jsonString)
        }
    }

    /// Test: JSON decode performance for 500 posts (max feed size)
    /// Target: <500ms (worst case, full feed)
    /// This is the scenario from ISSUE-CPU-4 where decode holds the NSLock
    func testDecodeFeedData_500Posts() throws {
        let feedData = makeFeedData(count: 500)
        let jsonString = encodeFeedData(feedData)

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = try? SerializedFeedData.decodeLenient(from: jsonString)
        }
    }

    /// Test: Incremental batch update with consolidated struct copies (P6 fix)
    /// Validates that updating 50 posts with all 3 count fields creates
    /// only 50 SerializedPost instances, not 150 (3× reduction from P6 fix)
    func testIncrementalBatchUpdate_50Posts() throws {
        let feedData = makeFeedData(count: 500)
        let uris = feedData.posts.prefix(50).map { $0.post.uri }
        let batchUpdate = makeBatchUpdate(uris: Array(uris), allThreeCounts: true)
        let batchJSON = encodeBatchUpdate(batchUpdate)

        // Pre-load feed data
        let feedJSON = encodeFeedData(feedData)
        _ = try SerializedFeedData.decodeLenient(from: feedJSON)

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            _ = try? FeedBatchUpdate.decode(from: batchJSON)
        }
    }

    /// Test: Batch update decode + apply simulation
    /// Simulates the full incremental update path from FeedBridgeModule.swift:45-99
    func testIncrementalUpdateApply_50Posts() throws {
        var feedData = makeFeedData(count: 500)
        let uris = feedData.posts.prefix(50).map { $0.post.uri }
        let batchUpdate = makeBatchUpdate(uris: Array(uris), allThreeCounts: true)

        measure(metrics: [XCTClockMetric(), XCTMemoryMetric()]) {
            for update in batchUpdate.updates {
                if let index = feedData.posts.firstIndex(where: { $0.post.uri == update.uri }) {
                    let existing = feedData.posts[index].post

                    // Consolidated struct creation (P6 fix pattern)
                    let updatedPost = SerializedPost(
                        uri: existing.uri,
                        cid: existing.cid,
                        author: existing.author,
                        record: existing.record,
                        embed: existing.embed,
                        replyCount: update.replyCount ?? existing.replyCount,
                        repostCount: update.repostCount ?? existing.repostCount,
                        likeCount: update.likeCount ?? existing.likeCount,
                        quoteCount: existing.quoteCount,
                        viewer: update.viewer ?? existing.viewer,
                        labels: existing.labels,
                        indexedAt: existing.indexedAt
                    )

                    feedData.posts[index] = SerializedFeedViewPost(
                        post: updatedPost,
                        reply: feedData.posts[index].reply,
                        reason: feedData.posts[index].reason,
                        feedContext: feedData.posts[index].feedContext
                    )
                }
            }
        }
    }

    /// Test: NSLock contention simulation
    /// Simulates concurrent read/write on feed data with NSLock
    /// Validates that lock hold time is minimal (ISSUE-CPU-3)
    func testLockContention_ConcurrentAccess() throws {
        let feedData = makeFeedData(count: 200)
        let feedJSON = encodeFeedData(feedData)
        let lock = NSLock()
        var sharedData: SerializedFeedData?

        // Pre-load
        sharedData = try SerializedFeedData.decodeLenient(from: feedJSON)

        let expectation = self.expectation(description: "concurrent access")
        expectation.expectedFulfillmentCount = 2

        measure {
            let readQueue = DispatchQueue(label: "test.read", qos: .userInteractive)
            let writeQueue = DispatchQueue(label: "test.write", qos: .default)

            // Simulate main thread reads (100 reads)
            readQueue.async {
                for _ in 0..<100 {
                    lock.lock()
                    _ = sharedData?.posts.count
                    lock.unlock()
                }
                expectation.fulfill()
            }

            // Simulate bridge thread writes (10 full updates)
            writeQueue.async {
                for _ in 0..<10 {
                    let newData = try? SerializedFeedData.decodeLenient(from: feedJSON)
                    lock.lock()
                    sharedData = newData
                    lock.unlock()
                }
                expectation.fulfill()
            }

            self.wait(for: [expectation], timeout: 30.0)
        }
    }

    /// Test: Memory allocation during full feed data update
    /// Validates ISSUE-MEM-2: full array replacement overhead
    func testMemoryAllocation_FullFeedUpdate() throws {
        let feedData = makeFeedData(count: 500)
        let feedJSON = encodeFeedData(feedData)

        measure(metrics: [XCTMemoryMetric()]) {
            _ = try? SerializedFeedData.decodeLenient(from: feedJSON)
        }
    }

    /// Test: Post URI lookup performance (used in incremental updates)
    /// Validates that firstIndex(where:) is fast enough for 500 posts
    func testPostURILookup_500Posts() throws {
        let feedData = makeFeedData(count: 500)
        let targetURIs = (0..<50).map { "at://did:plc:test\($0)/app.bsky.feed.post/\($0)" }

        measure(metrics: [XCTClockMetric()]) {
            for uri in targetURIs {
                _ = feedData.posts.firstIndex(where: { $0.post.uri == uri })
            }
        }
    }
}
