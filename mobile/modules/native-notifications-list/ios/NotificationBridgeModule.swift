//
// NotificationBridgeModule.swift
// NativeNotificationsList
//
// Expo Module for passing notification data from React to Swift.
// Mirrors the FeedBridgeModule pattern. Posts NotificationCenter events
// that NotificationListView observes (via NotificationBridgeNotifications).
//
// This lives inside the native-notifications-list pod so it can reuse the
// inlined SerializedNotificationData types and NotificationBridgeNotifications
// names defined in NotificationBridgeTypes.swift.
//

import ExpoModulesCore
import Foundation

/// Shared, thread-safe holder for the latest serialized notification data.
///
/// The SwiftUI view registers its NotificationCenter observers in `.onAppear`,
/// which can land *after* React has already pushed (and the module has already
/// posted) the data — so the live post is missed and there is nothing to replay.
/// The view reads `shared.latest` on appear to recover the most recent payload
/// regardless of post/observe ordering.
public final class NotificationBridgeStore {
    public static let shared = NotificationBridgeStore()
    private let lock = NSLock()
    private var _latest: SerializedNotificationData?

    private init() {}

    public var latest: SerializedNotificationData? {
        lock.lock(); defer { lock.unlock() }
        return _latest
    }

    func set(_ data: SerializedNotificationData?) {
        lock.lock(); _latest = data; lock.unlock()
    }
}

public class NotificationBridgeModule: Module {

    // Serial queue for JSON decoding — keeps work off the bridge thread
    // while preserving update ordering.
    private let decodeQueue = DispatchQueue(
        label: "com.shadowsky.notificationbridge.decode",
        qos: .userInitiated
    )

    public func definition() -> ModuleDefinition {
        Name("NotificationBridge")

        Function("updateNotificationData") { (jsonData: String) in
            self.decodeQueue.async { [weak self] in
                guard let self = self else { return }
                do {
                    let result = try SerializedNotificationData.decodeLenient(from: jsonData)

                    NotificationBridgeStore.shared.set(result.data)

                    NotificationCenter.default.post(
                        name: NotificationBridgeNotifications.dataUpdated,
                        object: nil,
                        userInfo: ["notificationData": result.data]
                    )

                    // If some notifications were skipped, notify so UI can inform user
                    if result.skippedCount > 0 {
                        #if DEBUG
                        print("[NotificationBridge] Lenient decode skipped \(result.skippedCount) notifications")
                        #endif
                        NotificationCenter.default.post(
                            name: NotificationBridgeNotifications.decodeError,
                            object: nil,
                            userInfo: [
                                "message": "\(result.skippedCount) notification(s) couldn't be loaded",
                                "skippedCount": result.skippedCount,
                                "isPartial": true
                            ]
                        )
                    }
                } catch {
                    #if DEBUG
                    print("[NotificationBridge] Failed to decode notification data: \(error)")
                    #endif
                    NotificationCenter.default.post(
                        name: NotificationBridgeNotifications.decodeError,
                        object: nil,
                        userInfo: [
                            "message": "Failed to decode notifications: \(error.localizedDescription)",
                            "error": String(describing: error),
                            "isPartial": false
                        ]
                    )
                }
            }
        }

        Function("clearNotificationData") {
            NotificationBridgeStore.shared.set(nil)

            NotificationCenter.default.post(
                name: NotificationBridgeNotifications.dataCleared,
                object: nil
            )
        }
    }
}
