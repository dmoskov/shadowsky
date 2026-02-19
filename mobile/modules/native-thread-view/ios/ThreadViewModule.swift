//
//  ThreadViewModule.swift
//  NativeThreadView
//
//  Created by Claude Code
//  Expo Module for native SwiftUI ThreadView
//

import ExpoModulesCore
import SwiftUI

public class ThreadViewModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeThreadView")

        // View component that can be used in React Native
        View(ThreadViewWrapper.self) {
            // Props
            Prop("isLoading") { (view: ThreadViewWrapper, isLoading: Bool) in
                view.isLoading = isLoading
            }

            Prop("isRefreshing") { (view: ThreadViewWrapper, isRefreshing: Bool) in
                view.isRefreshing = isRefreshing
            }

            Prop("error") { (view: ThreadViewWrapper, error: String?) in
                view.error = error
            }

            Prop("threadUri") { (view: ThreadViewWrapper, threadUri: String?) in
                view.threadUri = threadUri
            }

            // Summary props
            Prop("summaryJson") { (view: ThreadViewWrapper, summaryJson: String?) in
                view.summaryJson = summaryJson
            }

            Prop("isSummaryLoading") { (view: ThreadViewWrapper, isSummaryLoading: Bool) in
                view.isSummaryLoading = isSummaryLoading
            }

            Prop("summaryMode") { (view: ThreadViewWrapper, summaryMode: String?) in
                view.summaryMode = summaryMode ?? "quick"
            }

            // Events
            Events("onRefresh", "onPostPress", "onProfilePress",
                   "onLike", "onRepost", "onReply", "onBookmark",
                   "onMentionPress", "onHashtagPress", "onShare",
                   "onNavigateToParent", "onNavigateToRoot",
                   "onPressLikeCount", "onPressRepostCount", "onPressQuoteCount",
                   "onSummaryModeChange")
        }
    }
}

// MARK: - View Wrapper

/// UIKit wrapper for SwiftUI ThreadView
class ThreadViewWrapper: ExpoView {
    // Props
    var isLoading: Bool = false {
        didSet { updateView() }
    }

    var isRefreshing: Bool = false {
        didSet { updateView() }
    }

    var error: String? = nil {
        didSet { updateView() }
    }

    var threadUri: String? = nil {
        didSet { updateView() }
    }

    // Summary props
    var summaryJson: String? = nil {
        didSet {
            parsedSummaryData = parseSummaryJson(summaryJson)
            updateView()
        }
    }

    var isSummaryLoading: Bool = false {
        didSet { updateView() }
    }

    var summaryMode: String = "quick" {
        didSet { updateView() }
    }

    // Parsed summary data (cached to avoid repeated parsing)
    private var parsedSummaryData: ThreadSummaryData? = nil

    // Event handlers
    private let onRefresh = EventDispatcher()
    private let onPostPress = EventDispatcher()
    private let onProfilePress = EventDispatcher()
    private let onLike = EventDispatcher()
    private let onRepost = EventDispatcher()
    private let onReply = EventDispatcher()
    private let onBookmark = EventDispatcher()
    private let onMentionPress = EventDispatcher()
    private let onHashtagPress = EventDispatcher()
    private let onShare = EventDispatcher()
    private let onNavigateToParent = EventDispatcher()
    private let onNavigateToRoot = EventDispatcher()
    private let onPressLikeCount = EventDispatcher()
    private let onPressRepostCount = EventDispatcher()
    private let onPressQuoteCount = EventDispatcher()
    private let onSummaryModeChange = EventDispatcher()

    // SwiftUI hosting controller
    private var hostingController: UIHostingController<ThreadView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    private func setupView() {
        let threadView = createThreadView()
        let hostingController = UIHostingController(rootView: threadView)

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
        hostingController.rootView = createThreadView()
    }

    /// Parse summary JSON string into ThreadSummaryData
    private func parseSummaryJson(_ json: String?) -> ThreadSummaryData? {
        guard let json = json,
              let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return ThreadSummaryData.parse(from: dict)
    }

    private func createThreadView() -> ThreadView {
        ThreadView(
            isLoading: isLoading,
            isRefreshing: isRefreshing,
            error: error,
            threadUri: threadUri,
            summaryData: parsedSummaryData,
            isSummaryLoading: isSummaryLoading,
            summaryMode: summaryMode,
            onRefresh: { [weak self] in
                self?.onRefresh([:])
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
            onNavigateToParent: { [weak self] uri in
                self?.onNavigateToParent([
                    "uri": uri
                ])
            },
            onNavigateToRoot: { [weak self] uri in
                self?.onNavigateToRoot([
                    "uri": uri
                ])
            },
            onPressLikeCount: { [weak self] uri in
                self?.onPressLikeCount([
                    "uri": uri
                ])
            },
            onPressRepostCount: { [weak self] uri in
                self?.onPressRepostCount([
                    "uri": uri
                ])
            },
            onPressQuoteCount: { [weak self] uri in
                self?.onPressQuoteCount([
                    "uri": uri
                ])
            },
            onSummaryModeChange: { [weak self] mode in
                self?.onSummaryModeChange([
                    "mode": mode
                ])
            }
        )
    }
}
