//
//  SearchView.swift
//  NativeSearch
//
//  Main SwiftUI search view with native search bar, tab switching,
//  results list, trending topics, and search history.
//

import SwiftUI

// MARK: - Search View

struct SearchView: View {
    @ObservedObject var state: SearchState

    // Event callbacks (bridge to JS)
    let onQueryChange: (String) -> Void
    let onTabChange: (String) -> Void
    let onRefresh: () -> Void
    let onLoadMore: () -> Void
    let onProfilePress: (String) -> Void
    let onPostPress: (String, String) -> Void  // (authorHandle, postId)
    let onTrendingTopicPress: (String) -> Void
    let onHistoryItemPress: (String) -> Void
    let onClearHistory: () -> Void
    let onFilterPress: () -> Void

    @State private var searchText: String = ""
    @FocusState private var isSearchFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Search bar
            searchBar

            // Content
            if state.showHistory && !state.searchHistory.isEmpty {
                historyList
            } else if state.query.isEmpty {
                trendingSection
            } else {
                // Tab bar + results
                tabBar
                if state.activeTab != .people {
                    filterBar
                }
                resultsList
            }
        }
        .background(Color(UIColor.systemBackground))
        .onTapGesture {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
        .onAppear {
            state.startObserving()
            searchText = state.query
        }
        .onDisappear {
            state.stopObserving()
        }
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(Color(UIColor.secondaryLabel))
                        .font(.body)

                    TextField("Search posts, users, hashtags...", text: $searchText)
                        .font(.body)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .focused($isSearchFocused)
                        .submitLabel(.search)
                        .onSubmit {
                            onQueryChange(searchText)
                        }
                        .onChange(of: searchText) { newValue in
                            onQueryChange(newValue)
                        }

                    if !searchText.isEmpty {
                        Button(action: {
                            searchText = ""
                            onQueryChange("")
                        }) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(Color(UIColor.tertiaryLabel))
                                .font(.body)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Color(UIColor.secondarySystemGroupedBackground))
                .cornerRadius(10)

                if isSearchFocused {
                    Button("Cancel") {
                        isSearchFocused = false
                        searchText = ""
                        onQueryChange("")
                    }
                    .font(.body)
                    .foregroundColor(.accentColor)
                    .transition(.move(edge: .trailing).combined(with: .opacity))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .animation(.easeInOut(duration: 0.2), value: isSearchFocused)

            Divider()
        }
    }

    // MARK: - Tab Bar

    private var tabBar: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(SearchTab.allCases, id: \.self) { tab in
                    tabButton(for: tab)
                }
            }
            Divider()
        }
    }

    private func tabButton(for tab: SearchTab) -> some View {
        Button(action: {
            state.activeTab = tab
            onTabChange(tab.rawValue)
        }) {
            VStack(spacing: 8) {
                Text(tab.label)
                    .font(.body.weight(.semibold))
                    .foregroundColor(state.activeTab == tab ? .accentColor : Color(UIColor.tertiaryLabel))

                Rectangle()
                    .fill(state.activeTab == tab ? Color.accentColor : Color.clear)
                    .frame(height: 2)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 12)
    }

    // MARK: - Filter Bar

    private var filterBar: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: {
                    onFilterPress()
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "line.3.horizontal.decrease")
                            .font(.footnote)

                        Text(state.activeFilterCount > 0
                            ? "Filters (\(state.activeFilterCount))"
                            : "Filters")
                            .font(.subheadline.weight(.medium))
                    }
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(
                        state.activeFilterCount > 0
                            ? Color.accentColor.opacity(0.1)
                            : Color(UIColor.secondarySystemGroupedBackground)
                    )
                    .foregroundColor(
                        state.activeFilterCount > 0
                            ? .accentColor
                            : Color(UIColor.secondaryLabel)
                    )
                    .cornerRadius(18)
                    .overlay(
                        RoundedRectangle(cornerRadius: 18)
                            .stroke(
                                state.activeFilterCount > 0
                                    ? Color.accentColor.opacity(0.3)
                                    : Color.clear,
                                lineWidth: 1
                            )
                    )
                }

                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()
        }
    }

    // MARK: - Results List

    private var resultsList: some View {
        Group {
            if state.isLoading && state.actors.isEmpty && state.posts.isEmpty {
                loadingView
            } else if state.activeTab == .people {
                peopleResultsList
            } else {
                postsResultsList
            }
        }
    }

    // MARK: - People Results

    private var peopleResultsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if state.actors.isEmpty && !state.isLoading {
                    emptyResultsView
                } else {
                    ForEach(state.actors) { actor in
                        actorRow(actor)
                        Divider()
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .refreshable {
            onRefresh()
        }
    }

    private func actorRow(_ actor: SearchActorResult) -> some View {
        Button(action: {
            onProfilePress(actor.handle)
        }) {
            HStack(alignment: .top, spacing: 12) {
                // Avatar
                avatarView(url: actor.avatar, size: 48)

                VStack(alignment: .leading, spacing: 2) {
                    Text(actor.displayName ?? actor.handle)
                        .font(.body.weight(.semibold))
                        .foregroundColor(Color(UIColor.label))
                        .lineLimit(1)

                    Text("@\(actor.handle)")
                        .font(.subheadline)
                        .foregroundColor(Color(UIColor.secondaryLabel))
                        .lineLimit(1)

                    if let description = actor.description, !description.isEmpty {
                        Text(description)
                            .font(.subheadline)
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                            .lineLimit(2)
                            .padding(.top, 2)
                    }
                }

                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    // MARK: - Posts Results

    private var postsResultsList: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if state.posts.isEmpty && !state.isLoading {
                    emptyResultsView
                } else {
                    ForEach(state.posts) { post in
                        postRow(post)
                        Divider()

                        // Load more trigger
                        if post.id == state.posts.dropLast(min(3, state.posts.count)).last?.id {
                            Color.clear
                                .frame(height: 1)
                                .onAppear {
                                    if state.hasMore && !state.isLoadingMore {
                                        onLoadMore()
                                    }
                                }
                        }
                    }

                    if state.isLoadingMore {
                        ProgressView()
                            .padding(20)
                    }
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .refreshable {
            onRefresh()
        }
    }

    private func postRow(_ post: SearchPostResult) -> some View {
        Button(action: {
            let postId = post.uri.split(separator: "/").last.map(String.init) ?? ""
            onPostPress(post.authorHandle, postId)
        }) {
            VStack(alignment: .leading, spacing: 8) {
                // Author row
                HStack(spacing: 8) {
                    avatarView(url: post.authorAvatar, size: 36)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(post.authorDisplayName ?? post.authorHandle)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(Color(UIColor.label))
                            .lineLimit(1)

                        Text("@\(post.authorHandle)")
                            .font(.footnote)
                            .foregroundColor(Color(UIColor.secondaryLabel))
                            .lineLimit(1)
                    }

                    Spacer()

                    if !post.indexedAt.isEmpty {
                        Text(formatRelativeTime(post.indexedAt))
                            .font(.footnote)
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    }
                }

                // Post text
                Text(post.text)
                    .font(.subheadline)
                    .foregroundColor(Color(UIColor.label))
                    .lineLimit(4)
                    .multilineTextAlignment(.leading)

                // Engagement metrics
                HStack(spacing: 16) {
                    metricLabel(systemImage: "arrowshape.turn.up.left", count: post.replyCount)
                    metricLabel(systemImage: "arrow.2.squarepath", count: post.repostCount)
                    metricLabel(systemImage: "heart", count: post.likeCount)
                    Spacer()
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    private func metricLabel(systemImage: String, count: Int) -> some View {
        HStack(spacing: 4) {
            Image(systemName: systemImage)
                .font(.subheadline)
            if count > 0 {
                Text(formatCount(count))
                    .font(.footnote)
            }
        }
        .foregroundColor(Color(UIColor.tertiaryLabel))
    }

    // MARK: - Trending Section

    private var trendingSection: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if state.isLoadingTrending {
                    trendingSkeletonView
                } else {
                    // Trending Topics
                    if !state.trendingTopics.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Trending Topics")
                                .font(.title3.weight(.bold))
                                .foregroundColor(Color(UIColor.label))
                                .padding(.horizontal, 16)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(state.trendingTopics) { topic in
                                        Button(action: {
                                            onTrendingTopicPress(topic.tag)
                                        }) {
                                            Text("#\(topic.tag)")
                                                .font(.subheadline.weight(.medium))
                                                .foregroundColor(.accentColor)
                                                .padding(.horizontal, 14)
                                                .padding(.vertical, 8)
                                                .background(Color.accentColor.opacity(0.1))
                                                .cornerRadius(18)
                                        }
                                    }
                                }
                                .padding(.horizontal, 16)
                            }
                        }
                    }

                    // Trends
                    if !state.trends.isEmpty {
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Trending")
                                .font(.title3.weight(.bold))
                                .foregroundColor(Color(UIColor.label))
                                .padding(.horizontal, 16)
                                .padding(.bottom, 8)

                            ForEach(state.trends) { trend in
                                Button(action: {
                                    onTrendingTopicPress(trend.topic)
                                }) {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(trend.displayName)
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundColor(Color(UIColor.label))

                                            if trend.postCount > 0 {
                                                Text("\(formatCount(trend.postCount)) posts")
                                                    .font(.footnote)
                                                    .foregroundColor(Color(UIColor.secondaryLabel))
                                            }
                                        }
                                        Spacer()

                                        Image(systemName: "chevron.right")
                                            .font(.subheadline)
                                            .foregroundColor(Color(UIColor.tertiaryLabel))
                                    }
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                }

                                if trend.id != state.trends.last?.id {
                                    Divider()
                                        .padding(.leading, 16)
                                }
                            }
                        }
                        .padding(.top, 8)
                    }

                    if state.trendingTopics.isEmpty && state.trends.isEmpty {
                        emptyTrendingView
                    }
                }
            }
            .padding(.top, 16)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    private var trendingSkeletonView: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Topic chips skeleton
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(0..<5, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 18)
                            .fill(Color(UIColor.secondarySystemGroupedBackground))
                            .frame(width: 90, height: 36)
                    }
                }
                .padding(.horizontal, 16)
            }

            // Trend rows skeleton
            VStack(spacing: 0) {
                ForEach(0..<5, id: \.self) { _ in
                    HStack {
                        VStack(alignment: .leading, spacing: 6) {
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color(UIColor.secondarySystemGroupedBackground))
                                .frame(width: 120, height: 16)
                            RoundedRectangle(cornerRadius: 4)
                                .fill(Color(UIColor.secondarySystemGroupedBackground))
                                .frame(width: 70, height: 12)
                        }
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    Divider().padding(.leading, 16)
                }
            }
        }
        .redacted(reason: .placeholder)
    }

    private var emptyTrendingView: some View {
        VStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.largeTitle)
                .foregroundColor(Color(UIColor.tertiaryLabel))

            Text("Search for posts, people, and hashtags")
                .font(.body)
                .foregroundColor(Color(UIColor.secondaryLabel))
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    // MARK: - History List

    private var historyList: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Recent Searches")
                    .font(.body.weight(.semibold))
                    .foregroundColor(Color(UIColor.label))

                Spacer()

                Button(action: onClearHistory) {
                    Text("Clear")
                        .font(.subheadline)
                        .foregroundColor(.accentColor)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(state.searchHistory, id: \.self) { item in
                        Button(action: {
                            searchText = item
                            onHistoryItemPress(item)
                        }) {
                            HStack(spacing: 12) {
                                Image(systemName: "clock.arrow.circlepath")
                                    .font(.body)
                                    .foregroundColor(Color(UIColor.tertiaryLabel))

                                Text(item)
                                    .font(.body)
                                    .foregroundColor(Color(UIColor.secondaryLabel))
                                    .lineLimit(1)

                                Spacer()
                            }
                            .padding(.horizontal, 16)
                            .padding(.vertical, 12)
                        }

                        Divider().padding(.leading, 44)
                    }
                }
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    // MARK: - Shared Views

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Searching...")
                .font(.body)
                .foregroundColor(Color(UIColor.secondaryLabel))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var emptyResultsView: some View {
        VStack(spacing: 8) {
            Text("No results found")
                .font(.title3)
                .foregroundColor(Color(UIColor.secondaryLabel))

            Text("Try a different search term")
                .font(.subheadline)
                .foregroundColor(Color(UIColor.tertiaryLabel))
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    // MARK: - Avatar Helper

    private func avatarView(url: String?, size: CGFloat) -> some View {
        Group {
            if let urlStr = url, let imageURL = URL(string: urlStr) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: size, height: size)
                            .clipShape(Circle())
                    default:
                        defaultAvatar(size: size)
                    }
                }
                .frame(width: size, height: size)
            } else {
                defaultAvatar(size: size)
            }
        }
    }

    private func defaultAvatar(size: CGFloat) -> some View {
        Image(systemName: "person.circle.fill")
            .resizable()
            .frame(width: size, height: size)
            .foregroundColor(Color(UIColor.secondaryLabel))
    }

    // MARK: - Formatting Helpers

    private func formatRelativeTime(_ isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: isoString) else { return "" }
        let interval = Date().timeIntervalSince(date)

        if interval < 60 { return "now" }
        if interval < 3600 { return "\(Int(interval / 60))m" }
        if interval < 86400 { return "\(Int(interval / 3600))h" }
        if interval < 604800 { return "\(Int(interval / 86400))d" }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MMM d"
        return dateFormatter.string(from: date)
    }

    private func formatCount(_ count: Int) -> String {
        if count >= 1_000_000 {
            return String(format: "%.1fM", Double(count) / 1_000_000)
        } else if count >= 1_000 {
            return String(format: "%.1fK", Double(count) / 1_000)
        }
        return "\(count)"
    }
}
