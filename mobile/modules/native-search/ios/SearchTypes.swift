//
//  SearchTypes.swift
//  NativeSearch
//
//  Data types for the native search module.
//

import Foundation

// MARK: - Search Tab

enum SearchTab: String, CaseIterable {
    case people
    case posts
    case hashtags

    var label: String {
        switch self {
        case .people: return "People"
        case .posts: return "Posts"
        case .hashtags: return "Hashtags"
        }
    }
}

// MARK: - Search Result Types

struct SearchActorResult: Identifiable {
    let id: String // DID
    let handle: String
    let displayName: String?
    let avatar: String?
    let description: String?
    let isVerified: Bool

    static func fromDict(_ dict: [String: Any]) -> SearchActorResult {
        SearchActorResult(
            id: dict["did"] as? String ?? UUID().uuidString,
            handle: dict["handle"] as? String ?? "",
            displayName: dict["displayName"] as? String,
            avatar: dict["avatar"] as? String,
            description: dict["description"] as? String,
            isVerified: dict["isVerified"] as? Bool ?? false
        )
    }
}

struct SearchPostResult: Identifiable {
    let id: String // URI
    let uri: String
    let authorHandle: String
    let authorDisplayName: String?
    let authorAvatar: String?
    let authorIsVerified: Bool
    let text: String
    let indexedAt: String
    let likeCount: Int
    let repostCount: Int
    let replyCount: Int

    static func fromDict(_ dict: [String: Any]) -> SearchPostResult {
        let post = dict["post"] as? [String: Any] ?? dict
        let author = post["author"] as? [String: Any] ?? [:]
        let record = post["record"] as? [String: Any] ?? [:]

        return SearchPostResult(
            id: post["uri"] as? String ?? UUID().uuidString,
            uri: post["uri"] as? String ?? "",
            authorHandle: author["handle"] as? String ?? "",
            authorDisplayName: author["displayName"] as? String,
            authorAvatar: author["avatar"] as? String,
            authorIsVerified: author["isVerified"] as? Bool ?? false,
            text: record["text"] as? String ?? "",
            indexedAt: post["indexedAt"] as? String ?? "",
            likeCount: post["likeCount"] as? Int ?? 0,
            repostCount: post["repostCount"] as? Int ?? 0,
            replyCount: post["replyCount"] as? Int ?? 0
        )
    }
}

// MARK: - Trending Types

struct TrendingTopic: Identifiable {
    let id: String
    let tag: String
    let displayName: String

    static func fromDict(_ dict: [String: Any]) -> TrendingTopic {
        let tag = dict["tag"] as? String ?? ""
        return TrendingTopic(
            id: tag,
            tag: tag,
            displayName: dict["displayName"] as? String ?? "#\(tag)"
        )
    }
}

struct TrendItem: Identifiable {
    let id: String
    let topic: String
    let displayName: String
    let postCount: Int

    static func fromDict(_ dict: [String: Any]) -> TrendItem {
        let topic = dict["topic"] as? String ?? ""
        return TrendItem(
            id: topic,
            topic: topic,
            displayName: dict["displayName"] as? String ?? topic,
            postCount: dict["postCount"] as? Int ?? 0
        )
    }
}

// MARK: - Search Results Container

struct SearchResults {
    var actors: [SearchActorResult] = []
    var posts: [SearchPostResult] = []
    var hasMore: Bool = false
}
