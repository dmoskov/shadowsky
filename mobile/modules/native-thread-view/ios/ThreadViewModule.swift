//
//  ThreadViewModule.swift
//  NativeThreadView
//
//  Created by Claude Code
//  Expo Module for native SwiftUI ThreadView with inline reply composer
//

import ExpoModulesCore
import SwiftUI
import ExpoSwiftUIFeed

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

            Prop("focusedReplyUri") { (view: ThreadViewWrapper, focusedReplyUri: String?) in
                view.focusedReplyUri = focusedReplyUri
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

            // Composer props
            Prop("replyToHandle") { (view: ThreadViewWrapper, replyToHandle: String?) in
                view.replyToHandle = replyToHandle
            }

            Prop("replyToUri") { (view: ThreadViewWrapper, replyToUri: String?) in
                view.replyToUri = replyToUri
            }

            Prop("replyToCid") { (view: ThreadViewWrapper, replyToCid: String?) in
                view.replyToCid = replyToCid
            }

            // Events (original + composer events)
            Events("onRefresh", "onPostPress", "onProfilePress",
                   "onLike", "onRepost", "onReply", "onBookmark",
                   "onMentionPress", "onHashtagPress", "onShare",
                   "onNavigateToParent", "onNavigateToRoot",
                   "onPressLikeCount", "onPressRepostCount", "onPressQuoteCount",
                   "onSummaryModeChange", "onTranslate",
                   "onLinkPress", "onImagePress", "onQuotePress", "onQuotePost",
                   // Composer events
                   "onSendReply", "onOpenImagePicker", "onOpenGifPicker",
                   "onOpenEmojiPicker", "onMentionSearchQuery")
        }

        // Receive serialized thread data from JS and forward to native ThreadView
        Function("setThreadData") { (jsonString: String) in
            DispatchQueue.main.async {
                guard let data = jsonString.data(using: .utf8),
                      let threadData = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    #if DEBUG
                    print("[ThreadViewModule] Failed to decode thread data JSON")
                    #endif
                    return
                }
                NotificationCenter.default.post(
                    name: NSNotification.Name("ThreadBridgeDataUpdated"),
                    object: nil,
                    userInfo: ["threadData": threadData]
                )
            }
        }

        // Clear thread data from native ThreadView
        Function("clearThreadData") {
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("ThreadBridgeDataCleared"),
                    object: nil
                )
            }
        }

        // Receive translation results from JS and forward to native views
        Function("setTranslationResult") { (postUri: String, translatedText: String, sourceLang: String) in
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("ThreadTranslationResult"),
                    object: nil,
                    userInfo: [
                        "postUri": postUri,
                        "translatedText": translatedText,
                        "sourceLang": sourceLang,
                    ]
                )
            }
        }

        // Receive translation errors from JS
        Function("setTranslationError") { (postUri: String, errorMessage: String) in
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("ThreadTranslationResult"),
                    object: nil,
                    userInfo: [
                        "postUri": postUri,
                        "error": errorMessage,
                    ]
                )
            }
        }

        // Receive mention search results from JS
        Function("setMentionSearchResults") { (resultsJson: String) in
            DispatchQueue.main.async {
                guard let data = resultsJson.data(using: .utf8),
                      let results = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    NotificationCenter.default.post(
                        name: MentionManager.mentionResultsNotification,
                        object: nil,
                        userInfo: ["results": [] as [[String: Any]]]
                    )
                    return
                }
                NotificationCenter.default.post(
                    name: MentionManager.mentionResultsNotification,
                    object: nil,
                    userInfo: ["results": results]
                )
            }
        }

        // Notify composer that reply was sent successfully (or failed)
        Function("setReplySent") { (success: Bool, errorMessage: String?) in
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("ThreadReplySentResult"),
                    object: nil,
                    userInfo: [
                        "success": success,
                        "error": errorMessage as Any,
                    ]
                )
            }
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

    var focusedReplyUri: String? = nil {
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

    // Composer props (optional override from JS)
    var replyToHandle: String? = nil {
        didSet {
            composerState.replyToHandle = replyToHandle
        }
    }

    var replyToUri: String? = nil {
        didSet {
            composerState.replyToUri = replyToUri
        }
    }

    var replyToCid: String? = nil {
        didSet {
            composerState.replyToCid = replyToCid
        }
    }

    // Parsed summary data (cached to avoid repeated parsing)
    private var parsedSummaryData: ThreadSummaryData? = nil

    // Composer state (shared with SwiftUI view)
    private let composerState = ComposerState()

    // Reply sent result observer
    private var replySentObserver: NSObjectProtocol?

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
    private let onTranslate = EventDispatcher()
    private let onLinkPress = EventDispatcher()
    private let onImagePress = EventDispatcher()
    private let onQuotePress = EventDispatcher()
    private let onQuotePost = EventDispatcher()

    // Composer event dispatchers
    private let onSendReply = EventDispatcher()
    private let onOpenImagePicker = EventDispatcher()
    private let onOpenGifPicker = EventDispatcher()
    private let onOpenEmojiPicker = EventDispatcher()
    private let onMentionSearchQuery = EventDispatcher()

    // SwiftUI hosting controller
    private var hostingController: UIHostingController<ThreadView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
        setupReplySentObserver()
    }

    deinit {
        if let observer = replySentObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func setupReplySentObserver() {
        replySentObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ThreadReplySentResult"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let success = notification.userInfo?["success"] as? Bool else { return }
            if success {
                self?.composerState.reset()
            } else {
                self?.composerState.isSending = false
            }
        }
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
            composerState: composerState,
            isLoading: isLoading,
            isRefreshing: isRefreshing,
            error: error,
            threadUri: threadUri,
            focusedReplyUri: focusedReplyUri,
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
            },
            onTranslate: { [weak self] uri, text, sourceLang in
                self?.onTranslate([
                    "uri": uri,
                    "text": text,
                    "sourceLang": sourceLang,
                ])
            },
            onLinkPress: { [weak self] uri in
                self?.onLinkPress([
                    "uri": uri
                ])
            },
            onImagePress: { [weak self] images, index in
                let imageData = images.map { img -> [String: Any] in
                    var dict: [String: Any] = [
                        "thumb": img.thumb,
                        "fullsize": img.fullsize
                    ]
                    if let alt = img.alt { dict["alt"] = alt }
                    if let aspectRatio = img.aspectRatio { dict["aspectRatio"] = aspectRatio }
                    return dict
                }
                if let jsonData = try? JSONSerialization.data(withJSONObject: imageData),
                   let jsonString = String(data: jsonData, encoding: .utf8) {
                    self?.onImagePress([
                        "images": jsonString,
                        "index": index
                    ])
                }
            },
            onQuotePress: { [weak self] uri, handle in
                self?.onQuotePress([
                    "uri": uri,
                    "handle": handle
                ])
            },
            onQuotePost: { [weak self] uri, cid, handle, displayName, avatar, text in
                self?.onQuotePost([
                    "uri": uri,
                    "cid": cid,
                    "authorHandle": handle,
                    "authorDisplayName": displayName as Any,
                    "authorAvatar": avatar as Any,
                    "text": text,
                ])
            },
            // Composer event handlers
            onSendReply: { [weak self] text, replyToUri, replyToCid in
                self?.onSendReply([
                    "text": text,
                    "replyToUri": replyToUri as Any,
                    "replyToCid": replyToCid as Any,
                ])
            },
            onOpenImagePicker: { [weak self] in
                self?.onOpenImagePicker([:])
            },
            onOpenGifPicker: { [weak self] in
                self?.onOpenGifPicker([:])
            },
            onOpenEmojiPicker: { [weak self] in
                self?.onOpenEmojiPicker([:])
            },
            onMentionSearch: { [weak self] query in
                self?.onMentionSearchQuery([
                    "query": query
                ])
            }
        )
    }
}
