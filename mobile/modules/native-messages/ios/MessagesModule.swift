//
//  MessagesModule.swift
//  NativeMessages
//
//  Expo Module for native SwiftUI Messages view.
//  Bridges React Native props/events to the SwiftUI MessagesView.
//

import ExpoModulesCore
import SwiftUI

public class MessagesModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeMessages")

        // View component that can be used in React Native
        View(MessagesViewWrapper.self) {
            Prop("isLoading") { (view: MessagesViewWrapper, isLoading: Bool) in
                view.isLoading = isLoading
            }

            Prop("isLoadingMessages") { (view: MessagesViewWrapper, isLoadingMessages: Bool) in
                view.isLoadingMessages = isLoadingMessages
            }

            Prop("error") { (view: MessagesViewWrapper, error: String?) in
                view.error = error
            }

            Prop("currentUserDid") { (view: MessagesViewWrapper, currentUserDid: String?) in
                view.currentUserDid = currentUserDid ?? ""
            }

            Prop("selectedConversationId") { (view: MessagesViewWrapper, selectedConversationId: String?) in
                view.selectedConversationId = selectedConversationId
            }

            Prop("searchText") { (view: MessagesViewWrapper, searchText: String?) in
                view.searchText = searchText ?? ""
            }

            Prop("isSearching") { (view: MessagesViewWrapper, isSearching: Bool) in
                view.isSearching = isSearching
            }

            Events(
                "onConversationPress",
                "onBack",
                "onRefresh",
                "onNewConversation",
                "onDeleteConversation",
                "onToggleMute",
                "onSendMessage",
                "onDeleteMessage",
                "onPickImage",
                "onMarkAsRead",
                "onProfilePress",
                "onSearchTextChange"
            )
        }

        // Functions callable from JS to push data to native

        Function("updateConversations") { (conversationsJson: String) in
            DispatchQueue.main.async {
                guard let data = conversationsJson.data(using: .utf8),
                      let conversations = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    return
                }
                NotificationCenter.default.post(
                    name: NSNotification.Name("MessagesBridgeConversationsUpdated"),
                    object: nil,
                    userInfo: ["conversations": conversations]
                )
            }
        }

        Function("updateMessages") { (messagesJson: String) in
            DispatchQueue.main.async {
                guard let data = messagesJson.data(using: .utf8),
                      let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                    return
                }
                NotificationCenter.default.post(
                    name: NSNotification.Name("MessagesBridgeMessagesUpdated"),
                    object: nil,
                    userInfo: parsed
                )
            }
        }

        Function("setMessageSent") { (success: Bool, errorMessage: String?) in
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("MessagesBridgeMessageSent"),
                    object: nil,
                    userInfo: [
                        "success": success,
                        "error": errorMessage as Any,
                    ]
                )
            }
        }

        Function("updateSearchResults") { (searchResultsJson: String) in
            DispatchQueue.main.async {
                guard let data = searchResultsJson.data(using: .utf8),
                      let results = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    return
                }
                NotificationCenter.default.post(
                    name: NSNotification.Name("MessagesBridgeSearchResultsUpdated"),
                    object: nil,
                    userInfo: ["results": results]
                )
            }
        }

        Function("clearData") {
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("MessagesBridgeDataCleared"),
                    object: nil,
                    userInfo: nil
                )
            }
        }
    }
}

// MARK: - View Wrapper

class MessagesViewWrapper: ExpoView {
    // Props
    var isLoading: Bool = false {
        didSet { updateView() }
    }

    var isLoadingMessages: Bool = false {
        didSet { updateView() }
    }

    var error: String? = nil {
        didSet { updateView() }
    }

    var currentUserDid: String = "" {
        didSet { updateView() }
    }

    var selectedConversationId: String? = nil {
        didSet { updateView() }
    }

    var searchText: String = "" {
        didSet { updateView() }
    }

    var isSearching: Bool = false {
        didSet { updateView() }
    }

    // Event dispatchers
    private let onConversationPress = EventDispatcher()
    private let onBack = EventDispatcher()
    private let onRefresh = EventDispatcher()
    private let onNewConversation = EventDispatcher()
    private let onDeleteConversation = EventDispatcher()
    private let onToggleMute = EventDispatcher()
    private let onSendMessage = EventDispatcher()
    private let onDeleteMessage = EventDispatcher()
    private let onPickImage = EventDispatcher()
    private let onMarkAsRead = EventDispatcher()
    private let onProfilePress = EventDispatcher()
    private let onSearchTextChange = EventDispatcher()

    // Hosting controller
    private var hostingController: UIHostingController<MessagesView>?

    // Message sent observer
    private var messageSentObserver: NSObjectProtocol?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    deinit {
        if let observer = messageSentObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func setupView() {
        let messagesView = createMessagesView()
        let hostingController = UIHostingController(rootView: messagesView)

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
        hostingController.rootView = createMessagesView()
    }

    private func createMessagesView() -> MessagesView {
        MessagesView(
            isLoading: isLoading,
            isLoadingMessages: isLoadingMessages,
            error: error,
            currentUserDid: currentUserDid,
            selectedConversationId: selectedConversationId,
            searchText: searchText,
            isSearching: isSearching,
            onConversationPress: { [weak self] conversationId in
                self?.onConversationPress([
                    "conversationId": conversationId
                ])
            },
            onBack: { [weak self] in
                self?.onBack([:])
            },
            onRefresh: { [weak self] in
                self?.onRefresh([:])
            },
            onNewConversation: { [weak self] in
                self?.onNewConversation([:])
            },
            onDeleteConversation: { [weak self] conversationId in
                self?.onDeleteConversation([
                    "conversationId": conversationId
                ])
            },
            onToggleMute: { [weak self] conversationId, isMuted in
                self?.onToggleMute([
                    "conversationId": conversationId,
                    "isMuted": isMuted
                ])
            },
            onSendMessage: { [weak self] text in
                self?.onSendMessage([
                    "text": text
                ])
            },
            onDeleteMessage: { [weak self] messageId in
                self?.onDeleteMessage([
                    "messageId": messageId
                ])
            },
            onPickImage: { [weak self] in
                self?.onPickImage([:])
            },
            onMarkAsRead: { [weak self] conversationId in
                self?.onMarkAsRead([
                    "conversationId": conversationId
                ])
            },
            onProfilePress: { [weak self] handle in
                self?.onProfilePress([
                    "handle": handle
                ])
            },
            onSearchTextChange: { [weak self] text in
                self?.onSearchTextChange([
                    "text": text
                ])
            }
        )
    }
}
