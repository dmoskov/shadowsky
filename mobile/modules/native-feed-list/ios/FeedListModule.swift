//
//  FeedListModule.swift
//  Asphodel
//
//  Created by Claude Code
//  Expo Module for native SwiftUI FeedList
//

import ExpoModulesCore
import SwiftUI
import ExpoSwiftUIFeed

public class FeedListModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeFeedList")

        // View component that can be used in React Native
        View(FeedListViewWrapper.self) {
            // Props - update the shared FeedListProps object directly
            // instead of replacing the entire SwiftUI rootView
            Prop("isLoading") { (view: FeedListViewWrapper, isLoading: Bool) in
                view.feedListProps.isLoading = isLoading
            }

            Prop("isRefreshing") { (view: FeedListViewWrapper, isRefreshing: Bool) in
                view.feedListProps.isRefreshing = isRefreshing
            }

            Prop("isLoadingMore") { (view: FeedListViewWrapper, isLoadingMore: Bool) in
                view.feedListProps.isLoadingMore = isLoadingMore
            }

            Prop("error") { (view: FeedListViewWrapper, error: String?) in
                view.feedListProps.error = error
            }

            Prop("emptyMessage") { (view: FeedListViewWrapper, emptyMessage: String) in
                view.feedListProps.emptyMessage = emptyMessage
            }

            Prop("scrollToTopTrigger") { (view: FeedListViewWrapper, trigger: Int) in
                view.feedListProps.scrollToTopTrigger = trigger
            }

            // Events
            Events("onRefresh", "onLoadMore", "onPostPress", "onProfilePress",
                   "onLike", "onRepost", "onReply", "onBookmark",
                   "onMentionPress", "onHashtagPress", "onShare",
                   "onImagePress", "onLinkPress", "onQuotePress")
        }
    }
}

// MARK: - View Wrapper

/// UIKit wrapper for SwiftUI FeedListView.
/// Props are stored in a shared FeedListProps ObservableObject so that
/// SwiftUI can diff individual property changes without replacing the
/// entire rootView (which would destroy scroll state and re-render all cells).
class FeedListViewWrapper: ExpoView {
    // Shared props object - mutated by Expo prop setters, observed by SwiftUI
    let feedListProps = FeedListProps()

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
    private let onImagePress = EventDispatcher()
    private let onLinkPress = EventDispatcher()
    private let onQuotePress = EventDispatcher()

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

    private func createFeedListView() -> FeedListView {
        FeedListView(
            props: feedListProps,
            onRefresh: { [weak self] in
                self?.onRefresh([:])
            },
            onLoadMore: { [weak self] in
                self?.onLoadMore([:])
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
            },
            onImagePress: { [weak self] images, index in
                // Convert images to serializable format
                let imageData = images.map { image in
                    [
                        "thumb": image.thumb,
                        "fullsize": image.fullsize,
                        "alt": image.alt ?? "",
                        "aspectRatio": image.aspectRatio ?? 1.0
                    ] as [String: Any]
                }
                self?.onImagePress([
                    "images": imageData,
                    "index": index
                ])
            },
            onLinkPress: { [weak self] uri in
                self?.onLinkPress([
                    "uri": uri
                ])
            },
            onQuotePress: { [weak self] uri, handle in
                self?.onQuotePress([
                    "uri": uri,
                    "handle": handle
                ])
            }
        )
    }
}
