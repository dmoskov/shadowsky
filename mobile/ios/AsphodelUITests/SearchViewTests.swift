//
//  SearchViewTests.swift
//  AsphodelUITests
//
//  ViewInspector interaction tests for the native-search SwiftUI module.
//  Tests cover SearchView rendering, search input, tab switching,
//  results display, trending section, and search history.
//
//  Depends on: ViewInspector infrastructure (Pod dependency in test target).
//

import XCTest
import SwiftUI
import ViewInspector
@testable import NativeSearch

// MARK: - ViewInspector Conformance

extension SearchView: Inspectable {}

// MARK: - SearchView Tests

class SearchViewTests: XCTestCase {

    private func makeState(
        query: String = "",
        activeTab: SearchTab = .posts,
        isLoading: Bool = false,
        actors: [SearchActorResult] = [],
        posts: [SearchPostResult] = [],
        trendingTopics: [TrendingTopic] = [],
        trends: [TrendItem] = [],
        searchHistory: [String] = [],
        showHistory: Bool = false,
        isLoadingTrending: Bool = false
    ) -> SearchState {
        let state = SearchState()
        state.query = query
        state.activeTab = activeTab
        state.isLoading = isLoading
        state.actors = actors
        state.posts = posts
        state.trendingTopics = trendingTopics
        state.trends = trends
        state.searchHistory = searchHistory
        state.showHistory = showHistory
        state.isLoadingTrending = isLoadingTrending
        return state
    }

    private func noopCallbacks() -> (
        onQueryChange: (String) -> Void,
        onTabChange: (String) -> Void,
        onRefresh: () -> Void,
        onLoadMore: () -> Void,
        onProfilePress: (String) -> Void,
        onPostPress: (String, String) -> Void,
        onTrendingTopicPress: (String) -> Void,
        onHistoryItemPress: (String) -> Void,
        onClearHistory: () -> Void,
        onFilterPress: () -> Void
    ) {
        return (
            onQueryChange: { _ in },
            onTabChange: { _ in },
            onRefresh: {},
            onLoadMore: {},
            onProfilePress: { _ in },
            onPostPress: { _, _ in },
            onTrendingTopicPress: { _ in },
            onHistoryItemPress: { _ in },
            onClearHistory: {},
            onFilterPress: {}
        )
    }

    // MARK: - Test: Search bar renders with placeholder text

    func testSearchBarRendersWithPlaceholder() throws {
        let state = makeState()
        let cb = noopCallbacks()

        let view = SearchView(
            state: state,
            onQueryChange: cb.onQueryChange,
            onTabChange: cb.onTabChange,
            onRefresh: cb.onRefresh,
            onLoadMore: cb.onLoadMore,
            onProfilePress: cb.onProfilePress,
            onPostPress: cb.onPostPress,
            onTrendingTopicPress: cb.onTrendingTopicPress,
            onHistoryItemPress: cb.onHistoryItemPress,
            onClearHistory: cb.onClearHistory,
            onFilterPress: cb.onFilterPress
        )

        let inspected = try view.inspect()

        // Search bar should contain a TextField
        let textField = try inspected.find(ViewType.TextField.self)
        XCTAssertNotNil(textField, "Search bar should render a TextField")
    }

    // MARK: - Test: People results render with display names and handles

    func testPeopleResultsRenderWithDisplayNamesAndHandles() throws {
        let state = makeState(
            query: "alice",
            activeTab: .people,
            actors: MockSearch.sampleActors
        )
        let cb = noopCallbacks()

        let view = SearchView(
            state: state,
            onQueryChange: cb.onQueryChange,
            onTabChange: cb.onTabChange,
            onRefresh: cb.onRefresh,
            onLoadMore: cb.onLoadMore,
            onProfilePress: cb.onProfilePress,
            onPostPress: cb.onPostPress,
            onTrendingTopicPress: cb.onTrendingTopicPress,
            onHistoryItemPress: cb.onHistoryItemPress,
            onClearHistory: cb.onClearHistory,
            onFilterPress: cb.onFilterPress
        )

        let inspected = try view.inspect()

        // Should render actor results - find display names
        let aliceName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(aliceName, "Should render Alice Johnson's display name")

        let aliceHandle = try inspected.find(text: "@alice.bsky.social")
        XCTAssertNotNil(aliceHandle, "Should render Alice's handle")

        let bobName = try inspected.find(text: "Bob Smith")
        XCTAssertNotNil(bobName, "Should render Bob Smith's display name")
    }

    // MARK: - Test: Tap profile result calls onProfilePress

    func testTapProfileResultCallsOnProfilePress() throws {
        let state = makeState(
            query: "alice",
            activeTab: .people,
            actors: MockSearch.sampleActors
        )
        var pressedHandle: String?
        let expectation = expectation(description: "onProfilePress called")

        let view = SearchView(
            state: state,
            onQueryChange: { _ in },
            onTabChange: { _ in },
            onRefresh: {},
            onLoadMore: {},
            onProfilePress: { handle in
                pressedHandle = handle
                expectation.fulfill()
            },
            onPostPress: { _, _ in },
            onTrendingTopicPress: { _ in },
            onHistoryItemPress: { _ in },
            onClearHistory: {},
            onFilterPress: {}
        )

        let inspected = try view.inspect()

        // Find the first actor row button and tap it
        let firstButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Alice Johnson")) != nil
        })
        try firstButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedHandle, "alice.bsky.social", "Should pass Alice's handle to onProfilePress")
    }

    // MARK: - Test: Empty state shows when no results

    func testEmptyStateShowsWhenNoResults() throws {
        let state = makeState(
            query: "nonexistent",
            activeTab: .people,
            isLoading: false,
            actors: []
        )
        let cb = noopCallbacks()

        let view = SearchView(
            state: state,
            onQueryChange: cb.onQueryChange,
            onTabChange: cb.onTabChange,
            onRefresh: cb.onRefresh,
            onLoadMore: cb.onLoadMore,
            onProfilePress: cb.onProfilePress,
            onPostPress: cb.onPostPress,
            onTrendingTopicPress: cb.onTrendingTopicPress,
            onHistoryItemPress: cb.onHistoryItemPress,
            onClearHistory: cb.onClearHistory,
            onFilterPress: cb.onFilterPress
        )

        let inspected = try view.inspect()

        let noResults = try inspected.find(text: "No results found")
        XCTAssertNotNil(noResults, "Should show 'No results found' when actors list is empty")

        let suggestion = try inspected.find(text: "Try a different search term")
        XCTAssertNotNil(suggestion, "Should show suggestion text")
    }

    // MARK: - Test: Trending topics display when query is empty

    func testTrendingTopicsDisplayWhenQueryIsEmpty() throws {
        let state = makeState(
            query: "",
            trendingTopics: MockSearch.sampleTrendingTopics,
            trends: MockSearch.sampleTrends
        )
        let cb = noopCallbacks()

        let view = SearchView(
            state: state,
            onQueryChange: cb.onQueryChange,
            onTabChange: cb.onTabChange,
            onRefresh: cb.onRefresh,
            onLoadMore: cb.onLoadMore,
            onProfilePress: cb.onProfilePress,
            onPostPress: cb.onPostPress,
            onTrendingTopicPress: cb.onTrendingTopicPress,
            onHistoryItemPress: cb.onHistoryItemPress,
            onClearHistory: cb.onClearHistory,
            onFilterPress: cb.onFilterPress
        )

        let inspected = try view.inspect()

        // Should show trending topics header
        let trendingHeader = try inspected.find(text: "Trending Topics")
        XCTAssertNotNil(trendingHeader, "Should show 'Trending Topics' header")

        // Should show topic chips with # prefix
        let blueskyChip = try inspected.find(text: "#bluesky")
        XCTAssertNotNil(blueskyChip, "Should show #bluesky trending topic chip")

        // Should show trending section header
        let trendingSection = try inspected.find(text: "Trending")
        XCTAssertNotNil(trendingSection, "Should show 'Trending' section header")
    }

    // MARK: - Test: Tap trending topic calls onTrendingTopicPress

    func testTapTrendingTopicCallsOnTrendingTopicPress() throws {
        let state = makeState(
            query: "",
            trendingTopics: MockSearch.sampleTrendingTopics
        )
        var pressedTopic: String?
        let expectation = expectation(description: "onTrendingTopicPress called")

        let view = SearchView(
            state: state,
            onQueryChange: { _ in },
            onTabChange: { _ in },
            onRefresh: {},
            onLoadMore: {},
            onProfilePress: { _ in },
            onPostPress: { _, _ in },
            onTrendingTopicPress: { topic in
                pressedTopic = topic
                expectation.fulfill()
            },
            onHistoryItemPress: { _ in },
            onClearHistory: {},
            onFilterPress: {}
        )

        let inspected = try view.inspect()

        // Find and tap the #bluesky topic chip button
        let topicButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "#bluesky")) != nil
        })
        try topicButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertEqual(pressedTopic, "bluesky", "Should pass 'bluesky' tag to onTrendingTopicPress")
    }

    // MARK: - Test: Loading state shows progress indicator

    func testLoadingStateShowsProgressIndicator() throws {
        let state = makeState(
            query: "test",
            isLoading: true,
            actors: [],
            posts: []
        )
        let cb = noopCallbacks()

        let view = SearchView(
            state: state,
            onQueryChange: cb.onQueryChange,
            onTabChange: cb.onTabChange,
            onRefresh: cb.onRefresh,
            onLoadMore: cb.onLoadMore,
            onProfilePress: cb.onProfilePress,
            onPostPress: cb.onPostPress,
            onTrendingTopicPress: cb.onTrendingTopicPress,
            onHistoryItemPress: cb.onHistoryItemPress,
            onClearHistory: cb.onClearHistory,
            onFilterPress: cb.onFilterPress
        )

        let inspected = try view.inspect()

        // Should show "Searching..." text
        let searchingText = try inspected.find(text: "Searching...")
        XCTAssertNotNil(searchingText, "Should show 'Searching...' when loading with no results")

        // Should show ProgressView
        let progressView = try inspected.find(ViewType.ProgressView.self)
        XCTAssertNotNil(progressView, "Should show ProgressView during loading")
    }

    // MARK: - Test: Search history shows when showHistory is true

    func testSearchHistoryShowsWhenEnabled() throws {
        let state = makeState(
            searchHistory: ["bluesky", "swiftui", "ios development"],
            showHistory: true
        )
        let cb = noopCallbacks()

        let view = SearchView(
            state: state,
            onQueryChange: cb.onQueryChange,
            onTabChange: cb.onTabChange,
            onRefresh: cb.onRefresh,
            onLoadMore: cb.onLoadMore,
            onProfilePress: cb.onProfilePress,
            onPostPress: cb.onPostPress,
            onTrendingTopicPress: cb.onTrendingTopicPress,
            onHistoryItemPress: cb.onHistoryItemPress,
            onClearHistory: cb.onClearHistory,
            onFilterPress: cb.onFilterPress
        )

        let inspected = try view.inspect()

        // Should show "Recent Searches" header
        let recentHeader = try inspected.find(text: "Recent Searches")
        XCTAssertNotNil(recentHeader, "Should show 'Recent Searches' header")

        // Should show "Clear" button
        let clearButton = try inspected.find(text: "Clear")
        XCTAssertNotNil(clearButton, "Should show 'Clear' button for search history")

        // Should show history items
        let blueskyItem = try inspected.find(text: "bluesky")
        XCTAssertNotNil(blueskyItem, "Should show 'bluesky' history item")

        let swiftuiItem = try inspected.find(text: "swiftui")
        XCTAssertNotNil(swiftuiItem, "Should show 'swiftui' history item")
    }

    // MARK: - Test: Clear history button calls onClearHistory

    func testClearHistoryButtonCallsOnClearHistory() throws {
        let state = makeState(
            searchHistory: ["bluesky"],
            showHistory: true
        )
        var clearCalled = false
        let expectation = expectation(description: "onClearHistory called")

        let view = SearchView(
            state: state,
            onQueryChange: { _ in },
            onTabChange: { _ in },
            onRefresh: {},
            onLoadMore: {},
            onProfilePress: { _ in },
            onPostPress: { _, _ in },
            onTrendingTopicPress: { _ in },
            onHistoryItemPress: { _ in },
            onClearHistory: {
                clearCalled = true
                expectation.fulfill()
            },
            onFilterPress: {}
        )

        let inspected = try view.inspect()

        // Find and tap the "Clear" button
        let clearButton = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: "Clear")) != nil
        })
        try clearButton.tap()

        waitForExpectations(timeout: 1.0)
        XCTAssertTrue(clearCalled, "onClearHistory should be called when Clear button is tapped")
    }

    // MARK: - Test: Post results render with author info and text

    func testPostResultsRenderWithAuthorInfoAndText() throws {
        let state = makeState(
            query: "bluesky",
            activeTab: .posts,
            posts: MockSearch.samplePosts
        )
        let cb = noopCallbacks()

        let view = SearchView(
            state: state,
            onQueryChange: cb.onQueryChange,
            onTabChange: cb.onTabChange,
            onRefresh: cb.onRefresh,
            onLoadMore: cb.onLoadMore,
            onProfilePress: cb.onProfilePress,
            onPostPress: cb.onPostPress,
            onTrendingTopicPress: cb.onTrendingTopicPress,
            onHistoryItemPress: cb.onHistoryItemPress,
            onClearHistory: cb.onClearHistory,
            onFilterPress: cb.onFilterPress
        )

        let inspected = try view.inspect()

        // Should render post text
        let postText = try inspected.find(text: "Loving the new features on Bluesky!")
        XCTAssertNotNil(postText, "Should render the first post's text")

        // Should render author display name
        let authorName = try inspected.find(text: "Alice Johnson")
        XCTAssertNotNil(authorName, "Should render the post author's display name")

        // Should render author handle
        let authorHandle = try inspected.find(text: "@alice.bsky.social")
        XCTAssertNotNil(authorHandle, "Should render the post author's handle")
    }
}

// MARK: - SearchState Unit Tests

class SearchStateTests: XCTestCase {

    func testInitialState() {
        let state = SearchState()
        XCTAssertEqual(state.query, "")
        XCTAssertEqual(state.activeTab, .posts)
        XCTAssertFalse(state.isLoading)
        XCTAssertTrue(state.actors.isEmpty)
        XCTAssertTrue(state.posts.isEmpty)
        XCTAssertFalse(state.hasMore)
        XCTAssertTrue(state.trendingTopics.isEmpty)
        XCTAssertTrue(state.trends.isEmpty)
        XCTAssertTrue(state.searchHistory.isEmpty)
        XCTAssertFalse(state.showHistory)
    }

    func testSearchTabCasesAndLabels() {
        XCTAssertEqual(SearchTab.allCases.count, 3, "Should have 3 search tabs")
        XCTAssertEqual(SearchTab.people.label, "People")
        XCTAssertEqual(SearchTab.posts.label, "Posts")
        XCTAssertEqual(SearchTab.hashtags.label, "Hashtags")
    }

    func testSearchResultsNotificationUpdatesActors() {
        let state = SearchState()
        state.startObserving()

        let actorsData: [[String: Any]] = [
            ["did": "did:plc:a1", "handle": "alice.bsky.social", "displayName": "Alice"],
            ["did": "did:plc:a2", "handle": "bob.bsky.social", "displayName": "Bob"],
        ]

        NotificationCenter.default.post(
            name: SearchState.searchResultsNotification,
            object: nil,
            userInfo: [
                "tab": "people",
                "actors": actorsData,
                "hasMore": true
            ]
        )

        // Allow main queue to process
        let expectation = expectation(description: "actors updated")
        DispatchQueue.main.async {
            expectation.fulfill()
        }
        waitForExpectations(timeout: 1.0)

        XCTAssertEqual(state.actors.count, 2, "Should have 2 actors after notification")
        XCTAssertEqual(state.actors.first?.handle, "alice.bsky.social")
        XCTAssertTrue(state.hasMore)

        state.stopObserving()
    }
}
