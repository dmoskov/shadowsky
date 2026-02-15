//
// NotificationBridgeTypes.swift
// Notification Bridge Module
//
// Swift Codable structs for AT Protocol notification data
// These types match the TypeScript serialization format
// All types are public for cross-module access (e.g., NativeNotificationsList)
//

import Foundation

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
    public let facets: [NotificationFacet]?
    public let createdAt: String

    public init(text: String?, facets: [NotificationFacet]?, createdAt: String) {
        self.text = text
        self.facets = facets
        self.createdAt = createdAt
    }
}

// MARK: - Facets (simplified for notifications)

public struct NotificationFacetIndex: Codable {
    public let byteStart: Int
    public let byteEnd: Int

    public init(byteStart: Int, byteEnd: Int) {
        self.byteStart = byteStart
        self.byteEnd = byteEnd
    }
}

public struct NotificationFacetFeatureMention: Codable {
    public let type: String
    public let did: String

    public init(type: String, did: String) {
        self.type = type
        self.did = did
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case did
    }
}

public struct NotificationFacetFeatureLink: Codable {
    public let type: String
    public let uri: String

    public init(type: String, uri: String) {
        self.type = type
        self.uri = uri
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case uri
    }
}

public struct NotificationFacetFeatureTag: Codable {
    public let type: String
    public let tag: String

    public init(type: String, tag: String) {
        self.type = type
        self.tag = tag
    }

    enum CodingKeys: String, CodingKey {
        case type = "$type"
        case tag
    }
}

public enum NotificationFacetFeature: Codable {
    case mention(NotificationFacetFeatureMention)
    case link(NotificationFacetFeatureLink)
    case tag(NotificationFacetFeatureTag)

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: TypeCodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "app.bsky.richtext.facet#mention":
            let mention = try NotificationFacetFeatureMention(from: decoder)
            self = .mention(mention)
        case "app.bsky.richtext.facet#link":
            let link = try NotificationFacetFeatureLink(from: decoder)
            self = .link(link)
        case "app.bsky.richtext.facet#tag":
            let tag = try NotificationFacetFeatureTag(from: decoder)
            self = .tag(tag)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown facet feature type: \(type)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        switch self {
        case .mention(let mention):
            try mention.encode(to: encoder)
        case .link(let link):
            try link.encode(to: encoder)
        case .tag(let tag):
            try tag.encode(to: encoder)
        }
    }

    private enum TypeCodingKeys: String, CodingKey {
        case type = "$type"
    }
}

public struct NotificationFacet: Codable {
    public let index: NotificationFacetIndex
    public let features: [NotificationFacetFeature]

    public init(index: NotificationFacetIndex, features: [NotificationFacetFeature]) {
        self.index = index
        self.features = features
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
