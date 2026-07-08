//
// NotificationBridgeModule.swift
// NotificationBridge
//
// Standalone Expo Module for passing notification data from React to Swift.
// Mirrors the FeedBridgeModule pattern. Posts NotificationCenter events that
// NotificationListView (in the NativeNotificationsList package) observes.
//
// The serialized types, NotificationBridgeNotifications names, and the
// NotificationBridgeStore live in this same package (NotificationBridgeTypes.swift);
// native-notifications-list imports this package to use them, mirroring how
// native-feed-list imports feed-bridge.
//

import ExpoModulesCore
import Foundation

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
            self.decodeQueue.async {
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
