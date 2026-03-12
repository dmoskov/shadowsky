//
//  NotificationListModule.swift
//  NativeNotificationsList
//
//  Expo Module for native SwiftUI notification list.
//  Follows the same pattern as FeedListModule.swift
//

import ExpoModulesCore
import SwiftUI

public class NotificationListModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeNotificationsList")

        View(NotificationListViewWrapper.self) {
            Prop("isLoading") { (view: NotificationListViewWrapper, isLoading: Bool) in
                view.listProps.isLoading = isLoading
            }

            Prop("isRefreshing") { (view: NotificationListViewWrapper, isRefreshing: Bool) in
                view.listProps.isRefreshing = isRefreshing
            }

            Prop("isLoadingMore") { (view: NotificationListViewWrapper, isLoadingMore: Bool) in
                view.listProps.isLoadingMore = isLoadingMore
            }

            Prop("error") { (view: NotificationListViewWrapper, error: String?) in
                view.listProps.error = error
            }

            Prop("isOnline") { (view: NotificationListViewWrapper, isOnline: Bool) in
                view.listProps.isOnline = isOnline
            }

            Events(
                "onRefresh",
                "onLoadMore",
                "onNotificationPress",
                "onProfilePress",
                "onMentionPress",
                "onHashtagPress",
                "onLinkPress",
                "onAppear",
                "onAnalyticsPress"
            )
        }
    }
}

// MARK: - View Wrapper

class NotificationListViewWrapper: ExpoView {
    let listProps = NotificationListProps()

    private let onRefresh = EventDispatcher()
    private let onLoadMore = EventDispatcher()
    private let onNotificationPress = EventDispatcher()
    private let onProfilePress = EventDispatcher()
    private let onMentionPress = EventDispatcher()
    private let onHashtagPress = EventDispatcher()
    private let onLinkPress = EventDispatcher()
    private let onAppear = EventDispatcher()
    private let onAnalyticsPress = EventDispatcher()
    private let onScroll = EventDispatcher()

    private var hostingController: UIHostingController<NotificationListView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        let listView = createListView()
        let hostingController = UIHostingController(rootView: listView)

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

    private func createListView() -> NotificationListView {
        NotificationListView(
            props: listProps,
            onRefresh: { [weak self] in
                self?.onRefresh([:])
            },
            onLoadMore: { [weak self] in
                self?.onLoadMore([:])
            },
            onNotificationPress: { [weak self] reason, uri, handle, reasonSubject in
                self?.onNotificationPress([
                    "reason": reason,
                    "uri": uri,
                    "handle": handle,
                    "reasonSubject": reasonSubject as Any
                ])
            },
            onProfilePress: { [weak self] handle in
                self?.onProfilePress([
                    "handle": handle
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
            },
            onLinkPress: { [weak self] uri in
                self?.onLinkPress([
                    "uri": uri
                ])
            },
            onAppear: { [weak self] in
                self?.onAppear([:])
            },
            onAnalyticsPress: { [weak self] in
                self?.onAnalyticsPress([:])
            },
            onScroll: { [weak self] offset in
                self?.onScroll(["y": offset])
            }
        )
    }
}
