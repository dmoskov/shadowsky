//
//  NotificationListModule.swift
//  Asphodel
//
//  Created by Claude Code
//  Expo Module for native SwiftUI NotificationList
//

import ExpoModulesCore
import SwiftUI

public class NotificationListModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeNotificationsList")

        // View component that can be used in React Native
        View(NotificationListViewWrapper.self) {
            // Props
            Prop("isLoading") { (view: NotificationListViewWrapper, isLoading: Bool) in
                view.isLoading = isLoading
            }

            Prop("isRefreshing") { (view: NotificationListViewWrapper, isRefreshing: Bool) in
                view.isRefreshing = isRefreshing
            }

            Prop("isLoadingMore") { (view: NotificationListViewWrapper, isLoadingMore: Bool) in
                view.isLoadingMore = isLoadingMore
            }

            Prop("error") { (view: NotificationListViewWrapper, error: String?) in
                view.error = error
            }

            Prop("emptyMessage") { (view: NotificationListViewWrapper, emptyMessage: String) in
                view.emptyMessage = emptyMessage
            }

            // Events
            Events("onRefresh", "onLoadMore", "onNotificationPress", "onProfilePress",
                   "onPostPress", "onMentionPress", "onHashtagPress")
        }
    }
}

// MARK: - View Wrapper

/// UIKit wrapper for SwiftUI NotificationListView
class NotificationListViewWrapper: ExpoView {
    // Props
    var isLoading: Bool = false {
        didSet { updateView() }
    }

    var isRefreshing: Bool = false {
        didSet { updateView() }
    }

    var isLoadingMore: Bool = false {
        didSet { updateView() }
    }

    var error: String? = nil {
        didSet { updateView() }
    }

    var emptyMessage: String = "No notifications yet" {
        didSet { updateView() }
    }

    // Event handlers
    private let onRefresh = EventDispatcher()
    private let onLoadMore = EventDispatcher()
    private let onNotificationPress = EventDispatcher()
    private let onProfilePress = EventDispatcher()
    private let onPostPress = EventDispatcher()
    private let onMentionPress = EventDispatcher()
    private let onHashtagPress = EventDispatcher()

    // SwiftUI hosting controller
    private var hostingController: UIHostingController<NotificationListView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        let notificationListView = createNotificationListView()
        let hostingController = UIHostingController(rootView: notificationListView)

        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        hostingController.view.backgroundColor = .clear

        addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        self.hostingController = hostingController
    }

    private func updateView() {
        guard let hostingController = hostingController else { return }
        hostingController.rootView = createNotificationListView()
    }

    private func createNotificationListView() -> NotificationListView {
        NotificationListView(
            isLoading: isLoading,
            isRefreshing: isRefreshing,
            isLoadingMore: isLoadingMore,
            error: error,
            emptyMessage: emptyMessage,
            onRefresh: { [weak self] in
                self?.onRefresh([:])
            },
            onLoadMore: { [weak self] in
                self?.onLoadMore([:])
            },
            onNotificationPress: { [weak self] uri in
                self?.onNotificationPress([
                    "uri": uri
                ])
            },
            onProfilePress: { [weak self] handle in
                self?.onProfilePress([
                    "handle": handle
                ])
            },
            onPostPress: { [weak self] uri in
                self?.onPostPress([
                    "uri": uri
                ])
            },
            onMentionPress: { [weak self] handle, did in
                self?.onMentionPress([
                    "handle": handle,
                    "did": did
                ])
            },
            onHashtagPress: { [weak self] tag in
                self?.onHashtagPress([
                    "tag": tag
                ])
            }
        )
    }
}
