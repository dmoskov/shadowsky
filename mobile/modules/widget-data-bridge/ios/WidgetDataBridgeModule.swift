//
// WidgetDataBridgeModule.swift
// Widget Data Bridge
//
// Expo Module for writing data to shared App Group UserDefaults
// so that WidgetKit widgets can read it.
//

import ExpoModulesCore
import WidgetKit

public class WidgetDataBridgeModule: Module {
    private let suiteName = "group.io.shadowsky.app"

    private var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }

    public func definition() -> ModuleDefinition {
        Name("WidgetDataBridge")

        /// Update notification widget data
        Function("updateNotificationData") { (data: [String: Any]) in
            guard let defaults = self.sharedDefaults else { return }

            let unreadCount = data["unreadCount"] as? Int ?? 0
            let lastText = data["lastNotificationText"] as? String ?? ""
            let lastAuthor = data["lastNotificationAuthor"] as? String ?? ""
            let lastReason = data["lastNotificationReason"] as? String ?? ""
            let lastTimestamp = data["lastNotificationTimestamp"] as? Double ?? 0

            defaults.set(unreadCount, forKey: "widget_unread_notification_count")
            defaults.set(lastText, forKey: "widget_last_notification_text")
            defaults.set(lastAuthor, forKey: "widget_last_notification_author")
            defaults.set(lastReason, forKey: "widget_last_notification_reason")
            defaults.set(lastTimestamp, forKey: "widget_last_notification_timestamp")
            defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "widget_last_updated")

            self.reloadWidgets()
        }

        /// Update trending topics widget data
        Function("updateTrendingData") { (jsonString: String) in
            guard let defaults = self.sharedDefaults else { return }

            defaults.set(jsonString, forKey: "widget_trending_topics")
            defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "widget_last_updated")

            self.reloadWidgets()
        }

        /// Update recent DMs widget data
        Function("updateDMData") { (jsonString: String) in
            guard let defaults = self.sharedDefaults else { return }

            defaults.set(jsonString, forKey: "widget_recent_dms")
            defaults.set(Date().timeIntervalSince1970 * 1000, forKey: "widget_last_updated")

            self.reloadWidgets()
        }

        /// Update user handle (for widget display)
        Function("updateUserHandle") { (handle: String) in
            guard let defaults = self.sharedDefaults else { return }
            defaults.set(handle, forKey: "widget_user_handle")
        }

        /// Clear all widget data (on sign out)
        Function("clearWidgetData") { () in
            guard let defaults = self.sharedDefaults else { return }

            let keys = [
                "widget_unread_notification_count",
                "widget_last_notification_text",
                "widget_last_notification_author",
                "widget_last_notification_reason",
                "widget_last_notification_timestamp",
                "widget_trending_topics",
                "widget_recent_dms",
                "widget_last_updated",
                "widget_user_handle",
            ]
            for key in keys {
                defaults.removeObject(forKey: key)
            }

            self.reloadWidgets()
        }

        /// Force reload all widgets
        Function("reloadAllWidgets") { () in
            self.reloadWidgets()
        }
    }

    private func reloadWidgets() {
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
    }
}
