import Foundation
import SwiftUI

// MARK: - Data Models

struct AnalyticsMetricsData {
    var likesReceived: Int = 0
    var repostsReceived: Int = 0
    var repliesReceived: Int = 0
    var followersCount: Int = 0
    var followsCount: Int = 0
    var postsCount: Int = 0
    var engagementRate: Double = 0
}

struct DailyEngagementData: Identifiable {
    let id = UUID()
    let date: String
    let likes: Int
    let reposts: Int
    let replies: Int
    let posts: Int
}

struct PostingTimeData {
    var hourCounts: [Int] = Array(repeating: 0, count: 24)
    var hourEngagement: [Int] = Array(repeating: 0, count: 24)
    var bestEngagementHour: Int = 0
    var mostActiveHour: Int = 0
}

struct TopPostData: Identifiable {
    let id: String
    let uri: String
    let authorHandle: String
    let authorDid: String
    let authorDisplayName: String
    let authorAvatar: String?
    let text: String
    let createdAt: String
    let likeCount: Int
    let repostCount: Int
    let replyCount: Int
}

// MARK: - View Model

class AnalyticsViewModel: ObservableObject {
    @Published var metrics = AnalyticsMetricsData()
    @Published var dailyEngagement: [DailyEngagementData] = []
    @Published var postingTimes = PostingTimeData()
    @Published var topPosts: [TopPostData] = []
    @Published var timeRange: String = "7d"
    @Published var isLoading: Bool = false
    @Published var isRefreshing: Bool = false

    func parseMetrics(json: String) {
        guard let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }

            self.metrics = AnalyticsMetricsData(
                likesReceived: dict["likesReceived"] as? Int ?? 0,
                repostsReceived: dict["repostsReceived"] as? Int ?? 0,
                repliesReceived: dict["repliesReceived"] as? Int ?? 0,
                followersCount: dict["followersCount"] as? Int ?? 0,
                followsCount: dict["followsCount"] as? Int ?? 0,
                postsCount: dict["postsCount"] as? Int ?? 0,
                engagementRate: dict["engagementRate"] as? Double ?? 0
            )

            // Parse daily engagement
            if let daily = dict["dailyEngagement"] as? [[String: Any]] {
                self.dailyEngagement = daily.map { d in
                    DailyEngagementData(
                        date: d["date"] as? String ?? "",
                        likes: d["likes"] as? Int ?? 0,
                        reposts: d["reposts"] as? Int ?? 0,
                        replies: d["replies"] as? Int ?? 0,
                        posts: d["posts"] as? Int ?? 0
                    )
                }
            }

            // Parse posting times
            if let times = dict["postingTimes"] as? [String: Any] {
                self.postingTimes = PostingTimeData(
                    hourCounts: times["hourCounts"] as? [Int] ?? Array(repeating: 0, count: 24),
                    hourEngagement: times["hourEngagement"] as? [Int] ?? Array(repeating: 0, count: 24),
                    bestEngagementHour: times["bestEngagementHour"] as? Int ?? 0,
                    mostActiveHour: times["mostActiveHour"] as? Int ?? 0
                )
            }
        }
    }

    func parseTopPosts(json: String) {
        guard let data = json.data(using: .utf8),
              let arr = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else { return }

        DispatchQueue.main.async { [weak self] in
            self?.topPosts = arr.compactMap { post in
                guard let postData = post["post"] as? [String: Any],
                      let author = postData["author"] as? [String: Any],
                      let record = postData["record"] as? [String: Any] else { return nil }

                return TopPostData(
                    id: postData["uri"] as? String ?? UUID().uuidString,
                    uri: postData["uri"] as? String ?? "",
                    authorHandle: author["handle"] as? String ?? "",
                    authorDid: author["did"] as? String ?? "",
                    authorDisplayName: author["displayName"] as? String ?? "",
                    authorAvatar: author["avatar"] as? String,
                    text: record["text"] as? String ?? "",
                    createdAt: postData["indexedAt"] as? String ?? "",
                    likeCount: postData["likeCount"] as? Int ?? 0,
                    repostCount: postData["repostCount"] as? Int ?? 0,
                    replyCount: postData["replyCount"] as? Int ?? 0
                )
            }
        }
    }
}
