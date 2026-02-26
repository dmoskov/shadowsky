//
//  NotificationListView.swift
//  NativeNotificationsList
//
//  Main SwiftUI notification list view with filtering, pagination,
//  skeleton loading, pull-to-refresh, and all notification states.
//  Matches the behavior of NotificationsScreen.tsx
//

import SwiftUI
import ExpoModulesCore
import FeedBridge
import NotificationBridge

// MARK: - Notification List Props

class NotificationListProps: ObservableObject {
    @Published var isLoading: Bool = false
    @Published var isRefreshing: Bool = false
    @Published var isLoadingMore: Bool = false
    @Published var error: String? = nil
    @Published var isOnline: Bool = true
}

// MARK: - Notification List State

class NotificationListState: ObservableObject {
    @Published var processedNotifications: [ProcessedNotificationUIModel] = []
    @Published var counts: [String: Int] = [:]
    @Published var decodeError: String? = nil

    private var notificationDataObserver: NSObjectProtocol?
    private var clearDataObserver: NSObjectProtocol?
    private var decodeErrorObserver: NSObjectProtocol?

    func startObserving() {
        notificationDataObserver = NotificationCenter.default.addObserver(
            forName: NotificationBridgeModule.notificationDataUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let data = notification.userInfo?["notificationData"] as? SerializedNotificationData {
                self?.decodeError = nil // Clear error on successful data
                self?.updateNotifications(data)
            }
        }

        clearDataObserver = NotificationCenter.default.addObserver(
            forName: NotificationBridgeModule.notificationDataClearedNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.processedNotifications = []
            self?.counts = [:]
        }

        // Observe decode errors from bridge
        decodeErrorObserver = NotificationCenter.default.addObserver(
            forName: NotificationBridgeModule.notificationDecodeErrorNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            let isPartial = notification.userInfo?["isPartial"] as? Bool ?? false
            let message = notification.userInfo?["message"] as? String ?? "Failed to load notifications"
            // Only set full error if it's a total failure (not partial skip)
            if !isPartial {
                self?.decodeError = message
            }
        }
    }

    deinit {
        stopObserving()
    }

    func stopObserving() {
        if let observer = notificationDataObserver {
            NotificationCenter.default.removeObserver(observer)
            notificationDataObserver = nil
        }
        if let observer = clearDataObserver {
            NotificationCenter.default.removeObserver(observer)
            clearDataObserver = nil
        }
        if let observer = decodeErrorObserver {
            NotificationCenter.default.removeObserver(observer)
            decodeErrorObserver = nil
        }
    }

    private func updateNotifications(_ data: SerializedNotificationData) {
        var newProcessed: [ProcessedNotificationUIModel] = []
        var newCounts: [String: Int] = ["all": 0, "likes": 0, "reposts": 0, "replies": 0, "follows": 0, "mentions": 0, "quotes": 0]
        var totalCount = 0

        for item in data.notifications {
            switch item {
            case .single(let single):
                let uiModel = NotificationUIModel.from(single.notification)
                newProcessed.append(.single(uiModel))
                incrementCount(&newCounts, for: single.notification.reason)
                totalCount += 1

            case .aggregated(let aggregated):
                let uiModel = AggregatedNotificationUIModel.from(aggregated)
                newProcessed.append(.aggregated(uiModel))
                for notif in aggregated.notifications {
                    incrementCount(&newCounts, for: notif.reason)
                }
                totalCount += aggregated.notifications.count
            }
        }

        newCounts["all"] = totalCount

        processedNotifications = newProcessed
        counts = newCounts
    }

    private func incrementCount(_ counts: inout [String: Int], for reason: String) {
        switch reason {
        case "like", "like-via-repost":
            counts["likes", default: 0] += 1
        case "repost", "repost-via-repost":
            counts["reposts", default: 0] += 1
        case "reply":
            counts["replies", default: 0] += 1
        case "follow", "starterpack-joined":
            counts["follows", default: 0] += 1
        case "mention":
            counts["mentions", default: 0] += 1
        case "quote":
            counts["quotes", default: 0] += 1
        default:
            break
        }
    }
}

// MARK: - Notification List View

struct NotificationListView: View {
    @ObservedObject var props: NotificationListProps
    @StateObject private var state = NotificationListState()
    @State private var activeFilter: NotificationListFilter = .all

    // Event handlers
    let onRefresh: (() -> Void)?
    let onLoadMore: (() -> Void)?
    let onNotificationPress: ((String, String, String, String?) -> Void)?  // (reason, uri, handle, reasonSubject)
    let onProfilePress: ((String) -> Void)?
    let onMentionPress: ((String, String) -> Void)?
    let onHashtagPress: ((String) -> Void)?
    let onLinkPress: ((String) -> Void)?
    let onAppear: (() -> Void)?
    let onAnalyticsPress: (() -> Void)?

    // Filtered notifications
    private var filteredNotifications: [ProcessedNotificationUIModel] {
        guard activeFilter != .all else { return state.processedNotifications }

        let reasons = activeFilter.matchingReasons
        return state.processedNotifications.filter { item in
            switch item {
            case .single(let model):
                return reasons.contains(model.reason.rawValue)
            case .aggregated(let model):
                return reasons.contains(model.reason.rawValue)
            }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header with analytics button
            HStack {
                Spacer()
                Button(action: {
                    onAnalyticsPress?()
                }) {
                    Image(systemName: "chart.bar.xaxis")
                        .font(.title3)
                        .foregroundColor(NotificationThemeColors.primary)
                }
                .accessibilityLabel("Notification Analytics")
                .padding(.trailing, 16)
                .padding(.vertical, 8)
            }

            // Filter tab bar
            NotificationFilterBar(
                activeFilter: $activeFilter,
                counts: state.counts,
                onFilterChange: { _ in }
            )

            // Offline banner
            if !props.isOnline {
                offlineBanner
            }

            // Main content
            ZStack {
                if props.isLoading && state.processedNotifications.isEmpty {
                    NotificationSkeletonListView()
                        .frame(maxHeight: .infinity, alignment: .top)
                } else if let error = props.error ?? state.decodeError, state.processedNotifications.isEmpty {
                    errorView(error)
                } else if state.processedNotifications.isEmpty {
                    emptyView
                } else {
                    notificationScrollView
                }
            }
        }
        .background(Color(UIColor.systemBackground))
        .onAppear {
            state.startObserving()
            onAppear?()
        }
        .onDisappear {
            state.stopObserving()
        }
    }

    // MARK: - Scroll View

    private var notificationScrollView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                if filteredNotifications.isEmpty && activeFilter != .all {
                    // Empty filtered results — auto-load more if possible
                    VStack(spacing: 12) {
                        if props.isLoadingMore {
                            ProgressView()
                            Text("Loading \(activeFilter.label.lowercased())...")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        } else {
                            Image(systemName: "bell.slash")
                                .font(.largeTitle)
                                .foregroundColor(.secondary)
                            Text("No \(activeFilter.label.lowercased()) yet")
                                .font(.headline)
                                .foregroundColor(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                    .onAppear {
                        if !props.isLoadingMore {
                            onLoadMore?()
                        }
                    }
                } else {
                    ForEach(filteredNotifications) { item in
                        notificationRow(for: item)
                        Divider()

                        // Load more trigger
                        if item.id == filteredNotifications.dropLast(min(3, filteredNotifications.count)).last?.id {
                            Color.clear
                                .frame(height: 1)
                                .onAppear {
                                    if !props.isLoadingMore {
                                        onLoadMore?()
                                    }
                                }
                        }
                    }
                }

                // Loading more indicator
                if props.isLoadingMore {
                    ProgressView()
                        .padding(20)
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
        .refreshable {
            onRefresh?()
        }
    }

    // MARK: - Notification Row

    @ViewBuilder
    private func notificationRow(for item: ProcessedNotificationUIModel) -> some View {
        switch item {
        case .single(let model):
            NotificationItemView(
                notification: model,
                onPress: { handleNotificationPress(model) },
                onProfilePress: { handle in onProfilePress?(handle) },
                onMentionPress: { handle, did in onMentionPress?(handle, did) },
                onHashtagPress: { tag in onHashtagPress?(tag) },
                onLinkPress: { uri in onLinkPress?(uri) }
            )

        case .aggregated(let model):
            AggregatedNotificationItemView(
                model: model,
                onPress: { handleAggregatedPress(model) },
                onProfilePress: { handle in onProfilePress?(handle) },
                onMentionPress: { handle, did in onMentionPress?(handle, did) },
                onHashtagPress: { tag in onHashtagPress?(tag) },
                onLinkPress: { uri in onLinkPress?(uri) }
            )
        }
    }

    // MARK: - Navigation Handling

    private func handleNotificationPress(_ model: NotificationUIModel) {
        onNotificationPress?(
            model.reason.rawValue,
            model.uri,
            model.authorHandle,
            model.reasonSubject
        )
    }

    private func handleAggregatedPress(_ model: AggregatedNotificationUIModel) {
        guard let first = model.notifications.first else { return }
        onNotificationPress?(
            model.reason.rawValue,
            first.uri,
            first.authorHandle,
            first.reasonSubject
        )
    }

    // MARK: - Error View

    private func errorView(_ errorMessage: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.secondary)

            Text(errorMessage)
                .foregroundColor(.secondary)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)

            Button("Try Again") {
                onRefresh?()
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "bell.slash")
                .font(.largeTitle)
                .foregroundColor(.secondary)

            Text("No notifications yet")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("When people interact with your posts, you'll see it here")
                .font(.subheadline)
                .foregroundColor(Color(UIColor.tertiaryLabel))
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Offline Banner

    private var offlineBanner: some View {
        HStack(spacing: 6) {
            Image(systemName: "wifi.slash")
                .font(.caption)
            Text("You're offline. Showing cached notifications.")
                .font(.footnote)
        }
        .foregroundColor(Color(UIColor.secondaryLabel))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(UIColor.secondarySystemBackground))
    }
}
