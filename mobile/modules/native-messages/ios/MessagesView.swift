//
//  MessagesView.swift
//  NativeMessages
//
//  Main SwiftUI view that combines the conversation list and message thread views.
//  Manages the navigation state between list and thread views.
//

import SwiftUI
import ExpoModulesCore

// MARK: - Messages View

struct MessagesView: View {
    @StateObject private var dataState = MessagesDataState()
    @StateObject private var composerState = MessageComposerState()

    // Props from React Native
    let isLoading: Bool
    let isLoadingMessages: Bool
    let error: String?
    let currentUserDid: String
    let selectedConversationId: String?
    let searchText: String

    // Events (sent back to React Native)
    let onConversationPress: ((String) -> Void)?
    let onBack: (() -> Void)?
    let onRefresh: (() -> Void)?
    let onNewConversation: (() -> Void)?
    let onDeleteConversation: ((String) -> Void)?
    let onToggleMute: ((String, Bool) -> Void)?
    let onSendMessage: ((String) -> Void)?
    let onDeleteMessage: ((String) -> Void)?
    let onPickImage: (() -> Void)?
    let onMarkAsRead: ((String) -> Void)?
    let onProfilePress: ((String) -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            if let errorMessage = error, dataState.conversations.isEmpty && selectedConversationId == nil {
                errorView(errorMessage)
            } else if selectedConversationId != nil {
                // Thread view
                VStack(spacing: 0) {
                    MessageThreadView(
                        dataState: dataState,
                        isLoading: isLoadingMessages,
                        currentUserDid: currentUserDid,
                        onBack: onBack,
                        onToggleMute: onToggleMute,
                        onDeleteMessage: onDeleteMessage,
                        onProfilePress: onProfilePress
                    )

                    MessageComposerView(
                        composerState: composerState,
                        onSendMessage: { text in
                            onSendMessage?(text)
                        },
                        onPickImage: onPickImage
                    )
                }
            } else {
                // Conversation list
                ConversationListView(
                    dataState: dataState,
                    isLoading: isLoading,
                    isRefreshing: false,
                    searchText: searchText,
                    currentUserDid: currentUserDid,
                    onConversationPress: { conversationId in
                        onConversationPress?(conversationId)
                    },
                    onRefresh: onRefresh,
                    onNewConversation: onNewConversation,
                    onDeleteConversation: onDeleteConversation,
                    onToggleMute: onToggleMute
                )
            }
        }
        .background(Color(UIColor.systemBackground))
        .onAppear {
            dataState.startObserving()
        }
        .onDisappear {
            dataState.stopObserving()
        }
    }

    // MARK: - Error View

    private func errorView(_ errorMessage: String) -> some View {
        VStack(spacing: 16) {
            if errorMessage.contains("permission") || errorMessage.contains("403") {
                permissionErrorView
            } else {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 48))
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
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Permission Error View

    private var permissionErrorView: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.system(size: 64))
                .foregroundColor(.secondary)

            Text("App Password Required")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(Color(UIColor.label))

            Text("Direct Messages require an app password with chat permissions.")
                .font(.system(size: 16))
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            VStack(alignment: .leading, spacing: 4) {
                Text("To enable DMs:")
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
                Text("1. Go to Settings \u{2192} App Passwords on Bluesky")
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
                Text("2. Create a new app password with \"Direct Messages\" enabled")
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
                Text("3. Log out and log back in with the new app password")
                    .font(.system(size: 14))
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 24)
        }
    }
}

// MARK: - Message Sent Result Observer

/// Listens for message send results from JS and resets composer state
class MessageSentObserver: ObservableObject {
    private var observer: NSObjectProtocol?

    func start(composerState: MessageComposerState) {
        observer = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("MessagesBridgeMessageSent"),
            object: nil,
            queue: .main
        ) { notification in
            let success = notification.userInfo?["success"] as? Bool ?? false
            if success {
                composerState.reset()
            } else {
                composerState.isSending = false
            }
        }
    }

    func stop() {
        if let observer = observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}
