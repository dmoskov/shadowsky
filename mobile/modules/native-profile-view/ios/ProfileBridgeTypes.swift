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
    let viewer: SerializedProfileViewer?
    let labels: [SerializedLabel]?
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

// MARK: - Decoding Helper

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
