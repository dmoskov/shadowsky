//
//  ProfileBridgeTypes.swift
//  NativeProfileView
//
//  Created by Claude Code
//  Data types for profile information passed from React Native to Swift
//

import Foundation

// MARK: - Serialized Profile Data

/// Profile data structure matching the AT Protocol profile view
public struct SerializedProfile: Codable {
    let did: String
    let handle: String
    let displayName: String?
    let description: String?
    let avatar: String?
    let banner: String?
    let followersCount: Int?
    let followsCount: Int?
    let postsCount: Int?
    let indexedAt: String?
    let isVerified: Bool?
    let viewer: SerializedProfileViewer?
    let labels: [SerializedLabel]?
    let pinnedPost: SerializedPinnedPostRef?
    let associated: SerializedProfileAssociated?
    let knownFollowers: SerializedKnownFollowers?
}

/// Reference to a pinned post
public struct SerializedPinnedPostRef: Codable {
    let uri: String
}

/// Associated profile data (chat settings, etc.)
public struct SerializedProfileAssociated: Codable {
    let lists: Int?
    let feedgens: Int?
    let starterPacks: Int?
    let labeler: Bool?
    let chat: SerializedProfileAssociatedChat?
}

/// Chat settings for profile
public struct SerializedProfileAssociatedChat: Codable {
    let allowIncoming: String?
}

/// Known followers (mutual follows) data
public struct SerializedKnownFollowers: Codable {
    let count: Int
    let followers: [SerializedKnownFollower]
}

/// Individual known follower
public struct SerializedKnownFollower: Codable {
    let did: String
    let handle: String
    let displayName: String?
    let avatar: String?
}

/// Starter pack data
public struct SerializedStarterPack: Codable {
    let uri: String
    let cid: String?
    let name: String
    let listItemCount: Int?
    let joinedAllTimeCount: Int?
}

/// Pinned post data (resolved post, not just the reference)
public struct SerializedPinnedPost: Codable {
    let uri: String
    let authorHandle: String
    let authorDisplayName: String?
    let authorAvatar: String?
    let text: String?
    let indexedAt: String?
    let likeCount: Int?
    let repostCount: Int?
    let replyCount: Int?
}

/// Profile viewer information (relationship to current user)
public struct SerializedProfileViewer: Codable {
    let muted: Bool?
    let blockedBy: Bool?
    let blocking: String?
    let blockingByList: SerializedListViewBasic?
    let following: String?
    let followedBy: String?
}

/// Basic list view information
public struct SerializedListViewBasic: Codable {
    let uri: String
    let cid: String
    let name: String
    let purpose: String
    let avatar: String?
    let viewer: SerializedListViewerState?
}

/// List viewer state
public struct SerializedListViewerState: Codable {
    let muted: Bool?
    let blocked: String?
}

/// Label information
public struct SerializedLabel: Codable {
    let src: String?
    let uri: String?
    let cid: String?
    let val: String
    let cts: String?
}

// MARK: - Profile Tab Type

/// Tab selection for profile feeds
public enum ProfileTab: String, Codable, CaseIterable {
    case posts
    case replies
    case media
    case likes

    var title: String {
        switch self {
        case .posts: return "Posts"
        case .replies: return "Replies"
        case .media: return "Media"
        case .likes: return "Likes"
        }
    }
}

// MARK: - Decoding Helpers

extension SerializedProfile {
    static func decode(from jsonString: String) throws -> SerializedProfile {
        guard let data = jsonString.data(using: .utf8) else {
            throw NSError(domain: "ProfileBridge", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "Failed to convert JSON string to data"
            ])
        }

        let decoder = JSONDecoder()
        return try decoder.decode(SerializedProfile.self, from: data)
    }
}

extension SerializedStarterPack {
    static func decodeArray(from jsonString: String) throws -> [SerializedStarterPack] {
        guard let data = jsonString.data(using: .utf8) else {
            throw NSError(domain: "ProfileBridge", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "Failed to convert JSON string to data"
            ])
        }

        let decoder = JSONDecoder()
        return try decoder.decode([SerializedStarterPack].self, from: data)
    }
}

extension SerializedPinnedPost {
    static func decode(from jsonString: String) throws -> SerializedPinnedPost {
        guard let data = jsonString.data(using: .utf8) else {
            throw NSError(domain: "ProfileBridge", code: -1, userInfo: [
                NSLocalizedDescriptionKey: "Failed to convert JSON string to data"
            ])
        }

        let decoder = JSONDecoder()
        return try decoder.decode(SerializedPinnedPost.self, from: data)
    }
}
