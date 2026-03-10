//
//  NotificationListTypes.swift
//  NativeNotificationsList
//
//  UI model types for rendering notifications in the native list.
//  These are converted from the serialized bridge types.
//

import Foundation
import FeedBridge

// MARK: - Notification Reason

enum NotificationReason {
    case like
    case repost
    case follow
    case mention
    case reply
    case quote
    case likeViaRepost
    case repostViaRepost
    case starterpackJoined
    case unknown

    init(rawValue: String) {
        switch rawValue {
        case "like": self = .like
        case "repost": self = .repost
        case "follow": self = .follow
        case "mention": self = .mention
        case "reply": self = .reply
        case "quote": self = .quote
        case "like-via-repost": self = .likeViaRepost
        case "repost-via-repost": self = .repostViaRepost
        case "starterpack-joined": self = .starterpackJoined
        default: self = .unknown
        }
    }

    var rawValue: String {
        switch self {
        case .like: return "like"
        case .repost: return "repost"
        case .follow: return "follow"
        case .mention: return "mention"
        case .reply: return "reply"
        case .quote: return "quote"
        case .likeViaRepost: return "like-via-repost"
        case .repostViaRepost: return "repost-via-repost"
        case .starterpackJoined: return "starterpack-joined"
        case .unknown: return "unknown"
        }
    }

    var actionText: String {
        switch self {
        case .like: return "liked your post"
        case .repost: return "reposted your post"
        case .follow: return "followed you"
        case .mention: return "mentioned you"
        case .reply: return "replied to your post"
        case .quote: return "quoted your post"
        case .likeViaRepost: return "liked your repost"
        case .repostViaRepost: return "reposted your repost"
        case .starterpackJoined: return "joined from your starter pack"
        case .unknown: return "sent a notification"
        }
    }

    var sfSymbolName: String {
        switch self {
        case .like, .likeViaRepost: return "heart.fill"
        case .repost, .repostViaRepost: return "arrow.2.squarepath"
        case .follow, .starterpackJoined: return "person.badge.plus"
        case .mention: return "at"
        case .reply: return "arrowshape.turn.up.left.fill"
        case .quote: return "quote.opening"
        case .unknown: return "bell.fill"
        }
    }
}

// MARK: - Notification Filter

enum NotificationListFilter: String, CaseIterable {
    case all
    case likes
    case reposts
    case replies
    case mentions
    case follows
    case quotes

    var label: String {
        switch self {
        case .all: return "All"
        case .likes: return "Likes"
        case .reposts: return "Reposts"
        case .replies: return "Replies"
        case .mentions: return "Mentions"
        case .follows: return "Follows"
        case .quotes: return "Quotes"
        }
    }

    var matchingReasons: [String] {
        switch self {
        case .all: return []
        case .likes: return ["like", "like-via-repost"]
        case .reposts: return ["repost", "repost-via-repost"]
        case .replies: return ["reply"]
        case .follows: return ["follow", "starterpack-joined"]
        case .mentions: return ["mention"]
        case .quotes: return ["quote"]
        }
    }
}

// MARK: - Converted UI Models

/// A single notification ready for rendering
struct NotificationUIModel: Identifiable {
    let id: String
    let uri: String
    let authorDid: String
    let authorHandle: String
    let authorDisplayName: String?
    let authorAvatar: String?
    let authorIsVerified: Bool
    let reason: NotificationReason
    let reasonSubject: String?
    let postText: String?
    let postFacets: [Facet]?
    let isRead: Bool
    let indexedAt: Date
    let timestamp: String
    let postPreview: PostPreview?
}

/// An aggregated notification group ready for rendering
struct AggregatedNotificationUIModel: Identifiable {
    let id: String
    let reason: NotificationReason
    let count: Int
    let users: [(did: String, handle: String, displayName: String?, avatar: String?, isVerified: Bool)]
    let latestTimestamp: Date
    let timestamp: String
    let hasUnread: Bool
    let targetPostUri: String?
    let notifications: [NotificationUIModel]
    let postPreview: PostPreview?
}

/// Union type for processed notifications
enum ProcessedNotificationUIModel: Identifiable {
    case single(NotificationUIModel)
    case aggregated(AggregatedNotificationUIModel)

    var id: String {
        switch self {
        case .single(let model): return model.id
        case .aggregated(let model): return model.id
        }
    }

    var reason: NotificationReason {
        switch self {
        case .single(let model): return model.reason
        case .aggregated(let model): return model.reason
        }
    }
}

// MARK: - Conversion from Bridge Types

extension NotificationUIModel {
    fileprivate static let iso8601Formatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
    fileprivate static let iso8601FallbackFormatter = ISO8601DateFormatter()
    fileprivate static let dateOnlyFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d"
        return f
    }()

    static func from(_ serialized: SerializedNotification) -> NotificationUIModel {
        let reason = NotificationReason(rawValue: serialized.reason)
        let date = iso8601Formatter.date(from: serialized.indexedAt)
            ?? iso8601FallbackFormatter.date(from: serialized.indexedAt)
            ?? Date()
        let timestamp = Self.formatRelativeTime(from: date)

        // Facet type from FeedBridge
        let facets: [Facet]? = serialized.record?.facets

        return NotificationUIModel(
            id: serialized.uri,
            uri: serialized.uri,
            authorDid: serialized.author.did,
            authorHandle: serialized.author.handle,
            authorDisplayName: serialized.author.displayName,
            authorAvatar: serialized.author.avatar,
            authorIsVerified: serialized.author.isVerified ?? false,
            reason: reason,
            reasonSubject: serialized.reasonSubject,
            postText: serialized.record?.text,
            postFacets: facets,
            isRead: serialized.isRead,
            indexedAt: date,
            timestamp: timestamp,
            postPreview: serialized.postPreview
        )
    }

    static func formatRelativeTime(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)

        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        if interval < 604800 { return "\(Int(interval / 86400))d ago" }

        return dateOnlyFormatter.string(from: date)
    }
}

extension AggregatedNotificationUIModel {
    static func from(_ aggregated: AggregatedNotification) -> AggregatedNotificationUIModel {
        let reason = NotificationReason(rawValue: aggregated.reason)
        let date = NotificationUIModel.iso8601Formatter.date(from: aggregated.latestTimestamp)
            ?? NotificationUIModel.iso8601FallbackFormatter.date(from: aggregated.latestTimestamp)
            ?? Date()
        let timestamp = NotificationUIModel.formatRelativeTime(from: date)
        let hasUnread = aggregated.notifications.contains(where: { !$0.isRead })

        let users = aggregated.users.map { user in
            (did: user.did, handle: user.handle, displayName: user.displayName, avatar: user.avatar, isVerified: user.isVerified ?? false)
        }

        let notifications = aggregated.notifications.map { NotificationUIModel.from($0) }

        let targetKey = aggregated.targetPostUri ?? aggregated.notifications.first?.uri ?? ""

        return AggregatedNotificationUIModel(
            id: "agg-\(aggregated.reason)-\(targetKey)",
            reason: reason,
            count: aggregated.count,
            users: users,
            latestTimestamp: date,
            timestamp: timestamp,
            hasUnread: hasUnread,
            targetPostUri: aggregated.targetPostUri,
            notifications: notifications,
            postPreview: aggregated.postPreview
        )
    }
}
