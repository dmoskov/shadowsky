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

    // Notification names for feed updates
    public static let feedDataUpdatedNotification = Notification.Name("FeedBridgeDataUpdated")
    public static let feedIncrementalUpdateNotification = Notification.Name("FeedBridgeIncrementalUpdate")
    public static let feedDataClearedNotification = Notification.Name("FeedBridgeDataCleared")

    public func definition() -> ModuleDefinition {
        Name("FeedBridge")

        // Update feed data with full serialized data
        Function("updateFeedData") { (jsonData: String) in
            do {
                let feedData = try SerializedFeedData.decode(from: jsonData)

                self.feedDataLock.lock()
                self.currentFeedData = feedData
                self.feedDataLock.unlock()

                // Post notification for SwiftUI views to observe
                NotificationCenter.default.post(
                    name: FeedBridgeModule.feedDataUpdatedNotification,
                    object: nil,
                    userInfo: ["feedData": feedData]
                )
            } catch {
                print("[FeedBridge] Failed to decode feed data: \(error)")
                throw error
            }
        }

        // Update feed data incrementally
        Function("updateFeedIncremental") { (jsonData: String) in
            do {
                let batchUpdate = try FeedBatchUpdate.decode(from: jsonData)

                // Apply updates to current feed data
                self.feedDataLock.lock()
                if var feedData = self.currentFeedData {
                    for update in batchUpdate.updates {
                        // Find and update the post
                        if let index = feedData.posts.firstIndex(where: { $0.post.uri == update.uri }) {
                            var post = feedData.posts[index].post

                            // Update counts
                            if let likeCount = update.likeCount {
                                post = SerializedPost(
                                    uri: post.uri,
                                    cid: post.cid,
                                    author: post.author,
                                    record: post.record,
                                    embed: post.embed,
                                    replyCount: post.replyCount,
                                    repostCount: post.repostCount,
                                    likeCount: likeCount,
                                    quoteCount: post.quoteCount,
                                    viewer: update.viewer ?? post.viewer,
                                    labels: post.labels,
                                    indexedAt: post.indexedAt
                                )
                            }

                            if let repostCount = update.repostCount {
                                post = SerializedPost(
                                    uri: post.uri,
                                    cid: post.cid,
                                    author: post.author,
                                    record: post.record,
                                    embed: post.embed,
                                    replyCount: post.replyCount,
                                    repostCount: repostCount,
                                    likeCount: post.likeCount,
                                    quoteCount: post.quoteCount,
                                    viewer: update.viewer ?? post.viewer,
                                    labels: post.labels,
                                    indexedAt: post.indexedAt
                                )
                            }

                            if let replyCount = update.replyCount {
                                post = SerializedPost(
                                    uri: post.uri,
                                    cid: post.cid,
                                    author: post.author,
                                    record: post.record,
                                    embed: post.embed,
                                    replyCount: replyCount,
                                    repostCount: post.repostCount,
                                    likeCount: post.likeCount,
                                    quoteCount: post.quoteCount,
                                    viewer: update.viewer ?? post.viewer,
                                    labels: post.labels,
                                    indexedAt: post.indexedAt
                                )
                            }

                            // Update the post in feed data
                            feedData.posts[index] = SerializedFeedViewPost(
                                post: post,
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
                throw error
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
