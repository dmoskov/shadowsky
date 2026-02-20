//
//  SearchModule.swift
//  NativeSearch
//
//  Expo Module definition for the native SwiftUI search screen.
//  Bridges props and events between React Native and SwiftUI.
//

import ExpoModulesCore
import SwiftUI

public class SearchModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeSearch")

        // View component
        View(SearchViewWrapper.self) {
            // Query from JS
            Prop("query") { (view: SearchViewWrapper, query: String?) in
                view.searchState.query = query ?? ""
            }

            // Active tab
            Prop("activeTab") { (view: SearchViewWrapper, tab: String?) in
                if let tab = tab, let searchTab = SearchTab(rawValue: tab) {
                    view.searchState.activeTab = searchTab
                }
            }

            // Loading states
            Prop("isLoading") { (view: SearchViewWrapper, isLoading: Bool) in
                view.searchState.isLoading = isLoading
            }

            Prop("isRefreshing") { (view: SearchViewWrapper, isRefreshing: Bool) in
                view.searchState.isRefreshing = isRefreshing
            }

            Prop("isLoadingMore") { (view: SearchViewWrapper, isLoadingMore: Bool) in
                view.searchState.isLoadingMore = isLoadingMore
            }

            Prop("isLoadingTrending") { (view: SearchViewWrapper, isLoading: Bool) in
                view.searchState.isLoadingTrending = isLoading
            }

            Prop("error") { (view: SearchViewWrapper, error: String?) in
                view.searchState.error = error
            }

            Prop("activeFilterCount") { (view: SearchViewWrapper, count: Int) in
                view.searchState.activeFilterCount = count
            }

            Prop("showHistory") { (view: SearchViewWrapper, show: Bool) in
                view.searchState.showHistory = show
            }

            // Events (native -> JS)
            Events(
                "onQueryChange",
                "onTabChange",
                "onRefresh",
                "onLoadMore",
                "onProfilePress",
                "onPostPress",
                "onTrendingTopicPress",
                "onHistoryItemPress",
                "onClearHistory",
                "onFilterPress"
            )
        }

        // Receive search results from JS
        Function("setSearchResults") { (resultsJson: String) in
            DispatchQueue.main.async {
                guard let data = resultsJson.data(using: .utf8),
                      let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    return
                }
                NotificationCenter.default.post(
                    name: SearchState.searchResultsNotification,
                    object: nil,
                    userInfo: dict
                )
            }
        }

        // Receive trending data from JS
        Function("setTrendingData") { (trendingJson: String) in
            DispatchQueue.main.async {
                guard let data = trendingJson.data(using: .utf8),
                      let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    return
                }
                NotificationCenter.default.post(
                    name: SearchState.trendingDataNotification,
                    object: nil,
                    userInfo: dict
                )
            }
        }

        // Receive search history from JS
        Function("setSearchHistory") { (historyJson: String) in
            DispatchQueue.main.async {
                guard let data = historyJson.data(using: .utf8),
                      let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    return
                }
                NotificationCenter.default.post(
                    name: SearchState.searchHistoryNotification,
                    object: nil,
                    userInfo: dict
                )
            }
        }
    }
}

// MARK: - View Wrapper

class SearchViewWrapper: ExpoView {
    let searchState = SearchState()

    // Event dispatchers
    private let onQueryChange = EventDispatcher()
    private let onTabChange = EventDispatcher()
    private let onRefresh = EventDispatcher()
    private let onLoadMore = EventDispatcher()
    private let onProfilePress = EventDispatcher()
    private let onPostPress = EventDispatcher()
    private let onTrendingTopicPress = EventDispatcher()
    private let onHistoryItemPress = EventDispatcher()
    private let onClearHistory = EventDispatcher()
    private let onFilterPress = EventDispatcher()

    private var hostingController: UIHostingController<SearchView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        let searchView = createSearchView()
        let hostingController = UIHostingController(rootView: searchView)

        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        hostingController.view.backgroundColor = .clear

        addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        self.hostingController = hostingController
    }

    private func createSearchView() -> SearchView {
        SearchView(
            state: searchState,
            onQueryChange: { [weak self] query in
                self?.onQueryChange(["query": query])
            },
            onTabChange: { [weak self] tab in
                self?.onTabChange(["tab": tab])
            },
            onRefresh: { [weak self] in
                self?.onRefresh([:])
            },
            onLoadMore: { [weak self] in
                self?.onLoadMore([:])
            },
            onProfilePress: { [weak self] handle in
                self?.onProfilePress(["handle": handle])
            },
            onPostPress: { [weak self] authorHandle, postId in
                self?.onPostPress(["authorHandle": authorHandle, "postId": postId])
            },
            onTrendingTopicPress: { [weak self] topic in
                self?.onTrendingTopicPress(["topic": topic])
            },
            onHistoryItemPress: { [weak self] query in
                self?.onHistoryItemPress(["query": query])
            },
            onClearHistory: { [weak self] in
                self?.onClearHistory([:])
            },
            onFilterPress: { [weak self] in
                self?.onFilterPress([:])
            }
        )
    }
}
