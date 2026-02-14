//
//  FeedListModule.swift
//  Asphodel
//
//  Created by Claude Code
//  Expo Module for native SwiftUI FeedList
//

import ExpoModulesCore
import SwiftUI

public class FeedListModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeFeedList")

        // View component that can be used in React Native
        View(FeedListViewWrapper.self) {
            // Props
            Prop("isLoading") { (view: FeedListViewWrapper, isLoading: Bool) in
                view.isLoading = isLoading
            }

            Prop("isRefreshing") { (view: FeedListViewWrapper, isRefreshing: Bool) in
                view.isRefreshing = isRefreshing
            }

            Prop("isLoadingMore") { (view: FeedListViewWrapper, isLoadingMore: Bool) in
                view.isLoadingMore = isLoadingMore
            }

            Prop("error") { (view: FeedListViewWrapper, error: String?) in
                view.error = error
            }

            Prop("emptyMessage") { (view: FeedListViewWrapper, emptyMessage: String) in
                view.emptyMessage = emptyMessage
            }

            // Events
            Events("onRefresh", "onLoadMore", "onPostPress", "onProfilePress",
                   "onLike", "onRepost", "onReply", "onBookmark",
                   "onMentionPress", "onHashtagPress", "onShare")
        }
    }
}

// MARK: - View Wrapper

/// UIKit wrapper for SwiftUI FeedListView
class FeedListViewWrapper: ExpoView {
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

    var emptyMessage: String = "No posts yet" {
        didSet { updateView() }
    }

    // Event handlers
    private let onRefresh = EventDispatcher()
    private let onLoadMore = EventDispatcher()
    private let onPostPress = EventDispatcher()
    private let onProfilePress = EventDispatcher()
    private let onLike = EventDispatcher()
    private let onRepost = EventDispatcher()
    private let onReply = EventDispatcher()
    private let onBookmark = EventDispatcher()
    private let onMentionPress = EventDispatcher()
    private let onHashtagPress = EventDispatcher()
    private let onShare = EventDispatcher()

    // SwiftUI hosting controller
    private var hostingController: UIHostingController<FeedListView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        let feedListView = createFeedListView()
        let hostingController = UIHostingController(rootView: feedListView)

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
        hostingController.rootView = createFeedListView()
    }

    private func createFeedListView() -> FeedListView {
        FeedListView(
            isLoading: isLoading,
            isRefreshing: isRefreshing,
            isLoadingMore: isLoadingMore,
            error: error,
            emptyMessage: emptyMessage,
            onRefresh: { [weak self] in
                self?.onRefresh([])
            },
            onLoadMore: { [weak self] in
                self?.onLoadMore([])
            },
            onPostPress: { [weak self] uri, handle in
                self?.onPostPress([
                    "uri": uri,
                    "handle": handle
                ])
            },
            onProfilePress: { [weak self] handle in
                self?.onProfilePress([
                    "handle": handle
                ])
            },
            onLike: { [weak self] uri, cid, likeUri in
                self?.onLike([
                    "uri": uri,
                    "cid": cid,
                    "likeUri": likeUri as Any
                ])
            },
            onRepost: { [weak self] uri, cid, repostUri in
                self?.onRepost([
                    "uri": uri,
                    "cid": cid,
                    "repostUri": repostUri as Any
                ])
            },
            onReply: { [weak self] uri, cid, handle in
                self?.onReply([
                    "uri": uri,
                    "cid": cid,
                    "handle": handle
                ])
            },
            onBookmark: { [weak self] uri in
                self?.onBookmark([
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
            },
            onShare: { [weak self] uri in
                self?.onShare([
                    "uri": uri
                ])
            }
        )
    }
}
