//
// NotificationBridgeModule.swift
// Notification Bridge Module
//
// Expo Module for passing notification data from React to Swift
//

import ExpoModulesCore
import Foundation

public class NotificationBridgeModule: Module {
    // Shared notification data store
    private var currentNotificationData: SerializedNotificationData?
    private var notificationDataLock = NSLock()

    // Notification names for notification updates
    public static let notificationDataUpdatedNotification = Notification.Name("NotificationBridgeDataUpdated")
    public static let notificationDataClearedNotification = Notification.Name("NotificationBridgeDataCleared")

    public func definition() -> ModuleDefinition {
        Name("NotificationBridge")

        // Update notification data with full serialized data
        Function("updateNotificationData") { (jsonData: String) in
            do {
                let notificationData = try SerializedNotificationData.decode(from: jsonData)

                self.notificationDataLock.lock()
                self.currentNotificationData = notificationData
                self.notificationDataLock.unlock()

                // Post notification for SwiftUI views to observe
                NotificationCenter.default.post(
                    name: NotificationBridgeModule.notificationDataUpdatedNotification,
                    object: nil,
                    userInfo: ["notificationData": notificationData]
                )
            } catch {
                print("[NotificationBridge] Failed to decode notification data: \(error)")
                throw error
            }
        }

        // Clear notification data
        Function("clearNotificationData") {
            self.notificationDataLock.lock()
            self.currentNotificationData = nil
            self.notificationDataLock.unlock()

            NotificationCenter.default.post(
                name: NotificationBridgeModule.notificationDataClearedNotification,
                object: nil
            )
        }
    }

    // Public accessor for current notification data (thread-safe)
    public func getCurrentNotificationData() -> SerializedNotificationData? {
        notificationDataLock.lock()
        defer { notificationDataLock.unlock() }
        return currentNotificationData
    }
}
