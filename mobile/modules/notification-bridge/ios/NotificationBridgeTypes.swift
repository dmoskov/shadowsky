//
// NotificationBridgeTypes.swift
// Notification Bridge Module
//
// Swift Codable structs for AT Protocol notification data
// These types match the TypeScript serialization format
// All types are public for cross-module access (e.g., NativeNotificationsList)
//
// Facet types (FacetIndex, FacetFeature, Facet, etc.) are imported from FeedBridge
// to avoid duplication across modules.
//

import Foundation
import FeedBridge

// MARK: - Facet Type Aliases (for backwards compatibility)

/// Aliases to FeedBridge facet types, preserving the Notification-prefixed names
/// for existing consumers that reference them.
public typealias NotificationFacetIndex = FacetIndex
public typealias NotificationFacetFeatureMention = FacetFeatureMention
public typealias NotificationFacetFeatureLink = FacetFeatureLink
public typealias NotificationFacetFeatureTag = FacetFeatureTag
public typealias NotificationFacetFeature = FacetFeature
public typealias NotificationFacet = Facet

// MARK: - Author (reusing from FeedBridge pattern)

public struct NotificationAuthor: Codable {
    public let did: String
    public let handle: String
    public let displayName: String?
    public let avatar: String?

    public init(did: String, handle: String, displayName: String?, avatar: String?) {
        self.did = did
        self.handle = handle
        self.displayName = displayName
        self.avatar = avatar
    }
}

// MARK: - Notification Record

public struct NotificationRecord: Codable {
    public let text: String?
    public let facets: [Facet]?
    public let createdAt: String

    public init(text: String?, facets: [Facet]?, createdAt: String) {
        self.text = text
        self.facets = facets
        self.createdAt = createdAt
    }
}

// MARK: - Single Notification

public struct SerializedNotification: Codable {
    public let uri: String
    public let cid: String
    public let author: NotificationAuthor
    public let reason: String // "like", "repost", "follow", "mention", "reply", "quote", "starterpack-joined"
    public let reasonSubject: String?
    public let record: NotificationRecord?
    public let isRead: Bool
    public let indexedAt: String
    public let labels: [NotificationLabel]?

    public init(uri: String, cid: String, author: NotificationAuthor, reason: String, reasonSubject: String?, record: NotificationRecord?, isRead: Bool, indexedAt: String, labels: [NotificationLabel]?) {
        self.uri = uri
        self.cid = cid
        self.author = author
        self.reason = reason
        self.reasonSubject = reasonSubject
        self.record = record
        self.isRead = isRead
        self.indexedAt = indexedAt
        self.labels = labels
    }
}

// MARK: - Aggregated Notification

public struct AggregatedNotification: Codable {
    public let type: String // "aggregated"
    public let reason: String
    public let count: Int
    public let users: [NotificationUser]
    public let latestTimestamp: String
    public let notifications: [SerializedNotification]
    public let targetPostUri: String?

    public init(type: String, reason: String, count: Int, users: [NotificationUser], latestTimestamp: String, notifications: [SerializedNotification], targetPostUri: String?) {
        self.type = type
        self.reason = reason
        self.count = count
        self.users = users
        self.latestTimestamp = latestTimestamp
        self.notifications = notifications
        self.targetPostUri = targetPostUri
    }
}

public struct NotificationUser: Codable {
    public let did: String
    public let handle: String
    public let displayName: String?
    public let avatar: String?

    public init(did: String, handle: String, displayName: String?, avatar: String?) {
        self.did = did
        self.handle = handle
        self.displayName = displayName
        self.avatar = avatar
    }
}

// MARK: - Single Notification Wrapper

public struct SingleNotification: Codable {
    public let type: String // "single"
    public let notification: SerializedNotification

    public init(type: String, notification: SerializedNotification) {
        self.type = type
        self.notification = notification
    }
}

// MARK: - Processed Notification (union type)

public enum ProcessedNotification: Codable {
    case single(SingleNotification)
    case aggregated(AggregatedNotification)

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "single":
            let single = try SingleNotification(from: decoder)
            self = .single(single)
        case "aggregated":
            let aggregated = try AggregatedNotification(from: decoder)
            self = .aggregated(aggregated)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown processed notification type: \(type)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .single(let single):
            try single.encode(to: encoder)
        case .aggregated(let aggregated):
            try aggregated.encode(to: encoder)
        }
    }

    private enum CodingKeys: String, CodingKey {
        case type
    }
}

// MARK: - Labels

public struct NotificationLabel: Codable {
    public let val: String
    public let src: String

    public init(val: String, src: String) {
        self.val = val
        self.src = src
    }
}

// MARK: - Metadata

public struct NotificationUpdateMetadata: Codable {
    public let timestamp: Int
    public let isOnline: Bool

    public init(timestamp: Int, isOnline: Bool) {
        self.timestamp = timestamp
        self.isOnline = isOnline
    }
}

// MARK: - Complete Notification Data

public struct SerializedNotificationData: Codable {
    public let notifications: [ProcessedNotification]
    public let metadata: NotificationUpdateMetadata
    public let cursor: String?

    public init(notifications: [ProcessedNotification], metadata: NotificationUpdateMetadata, cursor: String?) {
        self.notifications = notifications
        self.metadata = metadata
        self.cursor = cursor
    }
}

// MARK: - Helper Extensions

public extension SerializedNotificationData {
    static func decode(from jsonString: String) throws -> SerializedNotificationData {
        guard let data = jsonString.data(using: .utf8) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(
                    codingPath: [],
                    debugDescription: "Invalid UTF-8 string"
                )
            )
        }

        let decoder = JSONDecoder()
        return try decoder.decode(SerializedNotificationData.self, from: data)
    }
}
