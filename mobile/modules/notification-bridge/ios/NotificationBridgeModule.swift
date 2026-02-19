//
// NotificationBridgeModule.swift
// NotificationBridge
//
// Expo Module for passing notification data from React to Swift.
// Mirrors the FeedBridgeModule pattern.
//

import ExpoModulesCore
import Foundation

public class NotificationBridgeModule: Module {
    private var currentNotificationData: SerializedNotificationData?
    private var notificationDataLock = NSLock()

    private let decodeQueue = DispatchQueue(
        label: "com.shadowsky.notificationbridge.decode",
        qos: .userInitiated
    )

    public static let notificationDataUpdatedNotification = Notification.Name("NotificationBridgeDataUpdated")
    public static let notificationDataClearedNotification = Notification.Name("NotificationBridgeDataCleared")

    public func definition() -> ModuleDefinition {
        Name("NotificationBridge")

        Function("updateNotificationData") { (jsonData: String) in
            self.decodeQueue.async { [weak self] in
                guard let self = self else { return }
                do {
                    let notificationData = try SerializedNotificationData.decodeLenient(from: jsonData)

                    self.notificationDataLock.lock()
                    self.currentNotificationData = notificationData
                    self.notificationDataLock.unlock()

                    NotificationCenter.default.post(
                        name: NotificationBridgeModule.notificationDataUpdatedNotification,
                        object: nil,
                        userInfo: ["notificationData": notificationData]
                    )
                } catch {
                    print("[NotificationBridge] Failed to decode notification data: \(error)")
                }
            }
        }

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

    public func getCurrentNotificationData() -> SerializedNotificationData? {
        notificationDataLock.lock()
        defer { notificationDataLock.unlock() }
        return currentNotificationData
    }
}
