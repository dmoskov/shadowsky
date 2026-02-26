//
//  SearchState.swift
//  NativeSearch
//
//  Observable state for the native search view.
//

import Foundation
import Combine

class SearchState: ObservableObject {
    @Published var query: String = "" {
        didSet {
            if query != oldValue {
                hasReceivedResults = false
            }
        }
    }
    @Published var activeTab: SearchTab = .posts
    @Published var isLoading: Bool = false
    @Published var isRefreshing: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String? = nil
    @Published var activeFilterCount: Int = 0

    // Results
    @Published var actors: [SearchActorResult] = []
    @Published var posts: [SearchPostResult] = []
    @Published var hasMore: Bool = false
    @Published var hasReceivedResults: Bool = false

    // Trending
    @Published var trendingTopics: [TrendingTopic] = []
    @Published var trends: [TrendItem] = []
    @Published var isLoadingTrending: Bool = false

    // History
    @Published var searchHistory: [String] = []
    @Published var showHistory: Bool = false

    // Typeahead (person suggestions while typing)
    @Published var typeaheadActors: [SearchActorResult] = []
    @Published var isLoadingTypeahead: Bool = false

    // Notifications for search results
    static let searchResultsNotification = NSNotification.Name("NativeSearchResultsUpdated")
    static let trendingDataNotification = NSNotification.Name("NativeSearchTrendingUpdated")
    static let searchHistoryNotification = NSNotification.Name("NativeSearchHistoryUpdated")
    static let typeaheadResultsNotification = NSNotification.Name("NativeSearchTypeaheadUpdated")

    private var resultsObserver: NSObjectProtocol?
    private var trendingObserver: NSObjectProtocol?
    private var historyObserver: NSObjectProtocol?
    private var typeaheadObserver: NSObjectProtocol?

    func startObserving() {
        resultsObserver = NotificationCenter.default.addObserver(
            forName: Self.searchResultsNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleSearchResults(notification)
        }

        trendingObserver = NotificationCenter.default.addObserver(
            forName: Self.trendingDataNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleTrendingData(notification)
        }

        historyObserver = NotificationCenter.default.addObserver(
            forName: Self.searchHistoryNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleHistoryData(notification)
        }

        typeaheadObserver = NotificationCenter.default.addObserver(
            forName: Self.typeaheadResultsNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleTypeaheadResults(notification)
        }
    }

    deinit {
        stopObserving()
    }

    func stopObserving() {
        if let observer = resultsObserver {
            NotificationCenter.default.removeObserver(observer)
            resultsObserver = nil
        }
        if let observer = trendingObserver {
            NotificationCenter.default.removeObserver(observer)
            trendingObserver = nil
        }
        if let observer = historyObserver {
            NotificationCenter.default.removeObserver(observer)
            historyObserver = nil
        }
        if let observer = typeaheadObserver {
            NotificationCenter.default.removeObserver(observer)
            typeaheadObserver = nil
        }
    }

    private func handleSearchResults(_ notification: Notification) {
        guard let data = notification.userInfo else { return }

        let tab = data["tab"] as? String ?? "posts"
        let hasMore = data["hasMore"] as? Bool ?? false

        if tab == "people" {
            if let actorsArray = data["actors"] as? [[String: Any]] {
                actors = actorsArray.map { SearchActorResult.fromDict($0) }
            }
        } else {
            if let postsArray = data["posts"] as? [[String: Any]] {
                let append = data["append"] as? Bool ?? false
                let newPosts = postsArray.map { SearchPostResult.fromDict($0) }
                if append {
                    posts.append(contentsOf: newPosts)
                } else {
                    posts = newPosts
                }
            }
        }

        self.hasMore = hasMore
        self.hasReceivedResults = true
    }

    private func handleTrendingData(_ notification: Notification) {
        guard let data = notification.userInfo else { return }

        if let topicsArray = data["topics"] as? [[String: Any]] {
            trendingTopics = topicsArray.map { TrendingTopic.fromDict($0) }
        }

        if let trendsArray = data["trends"] as? [[String: Any]] {
            trends = trendsArray.map { TrendItem.fromDict($0) }
        }

        isLoadingTrending = data["isLoading"] as? Bool ?? false
    }

    private func handleHistoryData(_ notification: Notification) {
        guard let data = notification.userInfo,
              let history = data["history"] as? [String] else { return }
        searchHistory = history
    }

    private func handleTypeaheadResults(_ notification: Notification) {
        guard let data = notification.userInfo else { return }

        if let actorsArray = data["actors"] as? [[String: Any]] {
            typeaheadActors = actorsArray.map { SearchActorResult.fromDict($0) }
        }

        isLoadingTypeahead = data["isLoading"] as? Bool ?? false
    }
}
