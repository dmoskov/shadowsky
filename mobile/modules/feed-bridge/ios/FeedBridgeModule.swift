//
// FeedBridgeModule.swift
// Feed Bridge Module
//
// Expo Module for passing feed data from React to Swift
//

import ExpoModulesCore
import Foundation

public class FeedBridgeModule: Module {
    // Shared feed data store
    private var currentFeedData: SerializedFeedData?
    private var feedDataLock = NSLock()

    // Serial queue for JSON decoding — keeps work off the bridge thread
    // while preserving update ordering.
    private let decodeQueue = DispatchQueue(label: "com.shadowsky.feedbridge.decode", qos: .userInitiated)

    // Notification names for feed updates
    public static let feedDataUpdatedNotification = Notification.Name("FeedBridgeDataUpdated")
    public static let feedIncrementalUpdateNotification = Notification.Name("FeedBridgeIncrementalUpdate")
    public static let feedDataClearedNotification = Notification.Name("FeedBridgeDataCleared")
    public static let feedDecodeErrorNotification = Notification.Name("FeedBridgeDecodeError")

    public func definition() -> ModuleDefinition {
        Name("FeedBridge")

        // Update feed data with full serialized data
        Function("updateFeedData") { (jsonData: String) in
            self.decodeQueue.async { [weak self] in
                guard let self = self else { return }
                do {
                    let result = try SerializedFeedData.decodeLenient(from: jsonData)

                    self.feedDataLock.lock()
                    self.currentFeedData = result.data
                    self.feedDataLock.unlock()

                    // Post notification for SwiftUI views to observe
                    NotificationCenter.default.post(
                        name: FeedBridgeModule.feedDataUpdatedNotification,
                        object: nil,
                        userInfo: ["feedData": result.data]
                    )

                    // If some posts were skipped, notify so UI can inform user
                    if result.skippedCount > 0 {
                        print("[FeedBridge] Lenient decode skipped \(result.skippedCount) posts")
                        NotificationCenter.default.post(
                            name: FeedBridgeModule.feedDecodeErrorNotification,
                            object: nil,
                            userInfo: [
                                "message": "\(result.skippedCount) post(s) couldn't be loaded",
                                "skippedCount": result.skippedCount,
                                "isPartial": true
                            ]
                        )
                    }
                } catch {
                    print("[FeedBridge] Failed to decode feed data: \(error)")
                    NotificationCenter.default.post(
                        name: FeedBridgeModule.feedDecodeErrorNotification,
                        object: nil,
                        userInfo: [
                            "message": "Failed to decode feed data: \(error.localizedDescription)",
                            "error": String(describing: error),
                            "isPartial": false
                        ]
                    )
                }
            }
        }

        // Update feed data incrementally
        Function("updateFeedIncremental") { (jsonData: String) in
            self.decodeQueue.async { [weak self] in
                guard let self = self else { return }
                do {
                    let batchUpdate = try FeedBatchUpdate.decode(from: jsonData)

                    // Apply updates to current feed data
                    self.feedDataLock.lock()
                    if var feedData = self.currentFeedData {
                        for update in batchUpdate.updates {
                            // Find and update the post
                            if let index = feedData.posts.firstIndex(where: { $0.post.uri == update.uri }) {
                                let existing = feedData.posts[index].post

                                // Consolidate all count updates into a single struct creation
                                // (avoids creating up to 3 intermediate copies per update)
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

                        self.currentFeedData = feedData
                        self.feedDataLock.unlock()

                        // Post notification
                        NotificationCenter.default.post(
                            name: FeedBridgeModule.feedIncrementalUpdateNotification,
                            object: nil,
                            userInfo: ["batchUpdate": batchUpdate]
                        )
                    } else {
                        self.feedDataLock.unlock()
                    }
                } catch {
                    print("[FeedBridge] Failed to decode batch update: \(error)")
                    NotificationCenter.default.post(
                        name: FeedBridgeModule.feedDecodeErrorNotification,
                        object: nil,
                        userInfo: [
                            "message": "Failed to decode feed update: \(error.localizedDescription)",
                            "error": String(describing: error),
                            "isPartial": false
                        ]
                    )
                }
            }
        }

        // Clear feed data
        Function("clearFeedData") {
            self.feedDataLock.lock()
            self.currentFeedData = nil
            self.feedDataLock.unlock()

            NotificationCenter.default.post(
                name: FeedBridgeModule.feedDataClearedNotification,
                object: nil
            )
        }
    }

    // Public accessor for current feed data (thread-safe)
    public func getCurrentFeedData() -> SerializedFeedData? {
        feedDataLock.lock()
        defer { feedDataLock.unlock() }
        return currentFeedData
    }
}
