//
// NotificationBridgeTypes.swift
// NotificationBridge
//
// Swift Codable structs for AT Protocol notification data.
// These types match the TypeScript serialization format from
// src/services/notification-bridge/serializer.ts
//
// All types are public for cross-module access (e.g., NativeNotificationsList).
//

import Foundation
import FeedBridge

// MARK: - Serialized Author

public struct SerializedAuthor: Codable {
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

// MARK: - Serialized Record

public struct SerializedRecord: Codable {
    public let text: String?
    public let facets: [Facet]?
    public let createdAt: String?

    public init(text: String?, facets: [Facet]?, createdAt: String?) {
        self.text = text
        self.facets = facets
        self.createdAt = createdAt
    }
}

// MARK: - Serialized Label

public struct SerializedLabel: Codable {
    public let val: String
    public let src: String

    public init(val: String, src: String) {
        self.val = val
        self.src = src
    }
}

// MARK: - Serialized Notification

public struct SerializedNotification: Codable {
    public let uri: String
    public let cid: String
    public let author: SerializedAuthor
    public let reason: String
    public let reasonSubject: String?
    public let record: SerializedRecord?
    public let isRead: Bool
    public let indexedAt: String
    public let labels: [SerializedLabel]?

    public init(
        uri: String,
        cid: String,
        author: SerializedAuthor,
        reason: String,
        reasonSubject: String?,
        record: SerializedRecord?,
        isRead: Bool,
        indexedAt: String,
        labels: [SerializedLabel]?
    ) {
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
    public let type: String
    public let reason: String
    public let count: Int
    public let users: [SerializedAuthor]
    public let latestTimestamp: String
    public let notifications: [SerializedNotification]
    public let targetPostUri: String?

    public init(
        type: String,
        reason: String,
        count: Int,
        users: [SerializedAuthor],
        latestTimestamp: String,
        notifications: [SerializedNotification],
        targetPostUri: String?
    ) {
        self.type = type
        self.reason = reason
        self.count = count
        self.users = users
        self.latestTimestamp = latestTimestamp
        self.notifications = notifications
        self.targetPostUri = targetPostUri
    }
}

// MARK: - Single Notification Wrapper

public struct SingleNotificationWrapper: Codable {
    public let type: String
    public let notification: SerializedNotification

    public init(type: String, notification: SerializedNotification) {
        self.type = type
        self.notification = notification
    }
}

// MARK: - Processed Notification (Union)

public enum ProcessedSerializedNotification: Codable {
    case single(SingleNotificationWrapper)
    case aggregated(AggregatedNotification)

    private enum TypeCodingKeys: String, CodingKey {
        case type
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: TypeCodingKeys.self)
        let type = try container.decode(String.self, forKey: .type)

        switch type {
        case "single":
            let single = try SingleNotificationWrapper(from: decoder)
            self = .single(single)
        case "aggregated":
            let aggregated = try AggregatedNotification(from: decoder)
            self = .aggregated(aggregated)
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type,
                in: container,
                debugDescription: "Unknown notification type: \(type)"
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
}

// MARK: - Update Metadata

public struct NotificationUpdateMetadata: Codable {
    public let timestamp: Int
    public let isOnline: Bool

    public init(timestamp: Int, isOnline: Bool) {
        self.timestamp = timestamp
        self.isOnline = isOnline
    }
}

// MARK: - Serialized Notification Data (Top Level)

public struct SerializedNotificationData: Codable {
    public let notifications: [ProcessedSerializedNotification]
    public let metadata: NotificationUpdateMetadata
    public let cursor: String?

    public init(
        notifications: [ProcessedSerializedNotification],
        metadata: NotificationUpdateMetadata,
        cursor: String?
    ) {
        self.notifications = notifications
        self.metadata = metadata
        self.cursor = cursor
    }

    public static func decode(from jsonString: String) throws -> SerializedNotificationData {
        guard let data = jsonString.data(using: .utf8) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: [], debugDescription: "Invalid UTF8 string")
            )
        }
        return try JSONDecoder().decode(SerializedNotificationData.self, from: data)
    }

    public static func decodeLenient(from jsonString: String) throws -> SerializedNotificationData {
        guard let data = jsonString.data(using: .utf8) else {
            throw DecodingError.dataCorrupted(
                DecodingError.Context(codingPath: [], debugDescription: "Invalid UTF8 string")
            )
        }

        do {
            return try JSONDecoder().decode(SerializedNotificationData.self, from: data)
        } catch {
            // Lenient fallback: decode metadata+cursor, then try each notification individually
            struct PartialData: Codable {
                let metadata: NotificationUpdateMetadata
                let cursor: String?
            }

            let partial = try JSONDecoder().decode(PartialData.self, from: data)

            // Try to decode notifications array individually
            struct RawNotifications: Codable {
                let notifications: [AnyCodable]
            }
            struct AnyCodable: Codable {
                let value: Any

                init(from decoder: Decoder) throws {
                    let container = try decoder.singleValueContainer()
                    if let data = try? container.decode(Data.self) {
                        value = data
                    } else {
                        value = NSNull()
                    }
                }

                func encode(to encoder: Encoder) throws {}
            }

            // Re-decode full JSON to get raw notifications
            var decodedNotifications: [ProcessedSerializedNotification] = []
            if let jsonObject = try JSONSerialization.jsonObject(with: data) as? [String: Any],
               let notificationsArray = jsonObject["notifications"] as? [[String: Any]] {
                for notifDict in notificationsArray {
                    do {
                        let notifData = try JSONSerialization.data(withJSONObject: notifDict)
                        let notification = try JSONDecoder().decode(ProcessedSerializedNotification.self, from: notifData)
                        decodedNotifications.append(notification)
                    } catch {
                        // Skip individual failures
                        continue
                    }
                }
            }

            return SerializedNotificationData(
                notifications: decodedNotifications,
                metadata: partial.metadata,
                cursor: partial.cursor
            )
        }
    }
}
