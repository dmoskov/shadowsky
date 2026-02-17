import Foundation
import WidgetKit

/// Shared constants and data access for all widgets.
/// Data is written by the main app via App Groups UserDefaults.
enum SharedData {
    static let appGroupId = "group.io.shadowsky.app"
    static let suiteName = "group.io.shadowsky.app"

    // UserDefaults keys
    enum Keys {
        static let unreadNotificationCount = "widget_unread_notification_count"
        static let lastNotificationText = "widget_last_notification_text"
        static let lastNotificationAuthor = "widget_last_notification_author"
        static let lastNotificationReason = "widget_last_notification_reason"
        static let lastNotificationTimestamp = "widget_last_notification_timestamp"
        static let trendingTopics = "widget_trending_topics"
        static let recentDMs = "widget_recent_dms"
        static let lastUpdated = "widget_last_updated"
        static let userHandle = "widget_user_handle"
    }

    static var defaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }
}

// MARK: - Notification Data

struct NotificationWidgetData {
    let unreadCount: Int
    let lastNotificationText: String
    let lastNotificationAuthor: String
    let lastNotificationReason: String
    let lastNotificationTimestamp: Date?
    let lastUpdated: Date?

    static func load() -> NotificationWidgetData {
        guard let defaults = SharedData.defaults else {
            return .empty
        }
        let timestamp = defaults.double(forKey: SharedData.Keys.lastNotificationTimestamp)
        let updated = defaults.double(forKey: SharedData.Keys.lastUpdated)
        return NotificationWidgetData(
            unreadCount: defaults.integer(forKey: SharedData.Keys.unreadNotificationCount),
            lastNotificationText: defaults.string(forKey: SharedData.Keys.lastNotificationText) ?? "",
            lastNotificationAuthor: defaults.string(forKey: SharedData.Keys.lastNotificationAuthor) ?? "",
            lastNotificationReason: defaults.string(forKey: SharedData.Keys.lastNotificationReason) ?? "",
            lastNotificationTimestamp: timestamp > 0 ? Date(timeIntervalSince1970: timestamp / 1000) : nil,
            lastUpdated: updated > 0 ? Date(timeIntervalSince1970: updated / 1000) : nil
        )
    }

    static let empty = NotificationWidgetData(
        unreadCount: 0,
        lastNotificationText: "",
        lastNotificationAuthor: "",
        lastNotificationReason: "",
        lastNotificationTimestamp: nil,
        lastUpdated: nil
    )
}

// MARK: - Trending Topic Data

struct TrendingTopicItem: Codable, Identifiable {
    let topic: String
    let status: String?
    var id: String { topic }
}

struct TrendingWidgetData {
    let topics: [TrendingTopicItem]
    let lastUpdated: Date?

    static func load() -> TrendingWidgetData {
        guard let defaults = SharedData.defaults,
              let jsonString = defaults.string(forKey: SharedData.Keys.trendingTopics),
              let data = jsonString.data(using: .utf8) else {
            return .empty
        }
        let updated = defaults.double(forKey: SharedData.Keys.lastUpdated)
        do {
            let topics = try JSONDecoder().decode([TrendingTopicItem].self, from: data)
            return TrendingWidgetData(
                topics: topics,
                lastUpdated: updated > 0 ? Date(timeIntervalSince1970: updated / 1000) : nil
            )
        } catch {
            return .empty
        }
    }

    static let empty = TrendingWidgetData(topics: [], lastUpdated: nil)
}

// MARK: - Recent DMs Data

struct DMConversationItem: Codable, Identifiable {
    let conversationId: String
    let memberName: String
    let memberHandle: String
    let lastMessageText: String
    let lastMessageTimestamp: Double
    let unreadCount: Int
    var id: String { conversationId }
}

struct DMWidgetData {
    let conversations: [DMConversationItem]
    let lastUpdated: Date?

    static func load() -> DMWidgetData {
        guard let defaults = SharedData.defaults,
              let jsonString = defaults.string(forKey: SharedData.Keys.recentDMs),
              let data = jsonString.data(using: .utf8) else {
            return .empty
        }
        let updated = defaults.double(forKey: SharedData.Keys.lastUpdated)
        do {
            let convos = try JSONDecoder().decode([DMConversationItem].self, from: data)
            return DMWidgetData(
                conversations: convos,
                lastUpdated: updated > 0 ? Date(timeIntervalSince1970: updated / 1000) : nil
            )
        } catch {
            return .empty
        }
    }

    static let empty = DMWidgetData(conversations: [], lastUpdated: nil)
}
