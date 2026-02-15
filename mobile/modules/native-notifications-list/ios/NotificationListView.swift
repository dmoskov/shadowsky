//
//  NotificationListView.swift
//  Asphodel
//
//  Created by Claude Code
//  Native SwiftUI notification list implementation
//

import SwiftUI
import ExpoModulesCore
import NotificationBridge

// MARK: - NotificationListView

/// SwiftUI view that displays a scrollable list of notifications
/// Uses data from the NotificationBridge module and NotificationCellView for rendering
struct NotificationListView: View {
    // MARK: - Properties

    // Notification data
    @StateObject private var notificationState = NotificationState()

    // Configuration
    let isLoading: Bool
    let isRefreshing: Bool
    let isLoadingMore: Bool
    let error: String?
    let emptyMessage: String

    // Event handlers (sent back to React Native)
    let onRefresh: (() -> Void)?
    let onLoadMore: (() -> Void)?
    let onNotificationPress: ((String) -> Void)? // uri
    let onProfilePress: ((String) -> Void)? // handle
    let onPostPress: ((String) -> Void)? // uri
    let onMentionPress: ((String, String) -> Void)? // (handle, did)
    let onHashtagPress: ((String) -> Void)? // tag

    // MARK: - Body

    var body: some View {
        ZStack {
            if isLoading && notificationState.notifications.isEmpty {
                // Initial loading state
                loadingView
            } else if let error = error, notificationState.notifications.isEmpty {
                // Error state
                errorView(error)
            } else if notificationState.notifications.isEmpty {
                // Empty state
                emptyView
            } else {
                // Notification content
                notificationScrollView
            }
        }
        .background(Color(UIColor.systemBackground))
        .onAppear {
            notificationState.startObserving()
        }
        .onDisappear {
            notificationState.stopObserving()
        }
    }

    // MARK: - Notification Scroll View

    private var notificationScrollView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Pull to refresh indicator
                if isRefreshing {
                    ProgressView()
                        .padding()
                }

                // Notification items
                ForEach(Array(notificationState.notifications.enumerated()), id: \.offset) { index, processedNotification in
                    switch processedNotification {
                    case .single(let singleNotification):
                        NotificationCellView(
                            notification: singleNotification.notification,
                            onNotificationPress: {
                                onNotificationPress?(singleNotification.notification.uri)
                            },
                            onProfilePress: { handle in
                                onProfilePress?(handle)
                            },
                            onPostPress: { uri in
                                onPostPress?(uri)
                            },
                            onMentionPress: { handle, did in
                                onMentionPress?(handle, did)
                            },
                            onHashtagPress: { tag in
                                onHashtagPress?(tag)
                            }
                        )

                    case .aggregated(let aggregatedNotification):
                        AggregatedNotificationCellView(
                            aggregatedNotification: aggregatedNotification,
                            onNotificationPress: {
                                // Press on the aggregated notification - navigate to post if available
                                if let targetPostUri = aggregatedNotification.targetPostUri {
                                    onPostPress?(targetPostUri)
                                }
                            },
                            onProfilePress: { handle in
                                onProfilePress?(handle)
                            }
                        )
                    }

                    // Load more trigger - fire when near end of list
                    if index == notificationState.notifications.count - min(3, notificationState.notifications.count) {
                        Color.clear
                            .frame(height: 1)
                            .onAppear {
                                if !isLoadingMore {
                                    onLoadMore?()
                                }
                            }
                    }
                }

                // Loading more indicator
                if isLoadingMore {
                    ProgressView()
                        .padding()
                }
            }
        }
        .refreshable {
            onRefresh?()
        }
    }

    // MARK: - State Views

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading notifications...")
                .foregroundColor(.secondary)
                .font(.subheadline)
        }
    }

    private func errorView(_ errorMessage: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text(errorMessage)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            if let onRefresh = onRefresh {
                Button("Try Again") {
                    onRefresh()
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private var emptyView: some View {
        VStack(spacing: 16) {
            Image(systemName: "bell.slash")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text(emptyMessage)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Notification State

/// ObservableObject that manages notification data from NotificationBridge
class NotificationState: ObservableObject {
    @Published var notifications: [ProcessedNotification] = []

    private var observer: NSObjectProtocol?

    func startObserving() {
        // Listen for notification data updates
        observer = NotificationCenter.default.addObserver(
            forName: NotificationBridgeModule.notificationDataUpdatedNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let notificationData = notification.userInfo?["notificationData"] as? SerializedNotificationData {
                self?.notifications = notificationData.notifications
            }
        }
    }

    func stopObserving() {
        if let observer = observer {
            NotificationCenter.default.removeObserver(observer)
            self.observer = nil
        }
    }

    deinit {
        stopObserving()
    }
}
