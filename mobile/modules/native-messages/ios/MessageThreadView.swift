//
//  MessageThreadView.swift
//  NativeMessages
//
//  SwiftUI message thread view with inverted scroll (newest messages at bottom),
//  native keyboard handling, message bubbles, delivery status, and image embeds.
//

import SwiftUI

// MARK: - Message Thread View

struct MessageThreadView: View {
    @ObservedObject var dataState: MessagesDataState

    let isLoading: Bool
    let currentUserDid: String

    // Events
    let onBack: (() -> Void)?
    let onToggleMute: ((String, Bool) -> Void)?
    let onDeleteMessage: ((String) -> Void)?
    let onProfilePress: ((String) -> Void)?

    private var otherMember: ConversationMember {
        guard let convo = dataState.currentConversation else {
            return ConversationMember(did: "", handle: nil, displayName: nil, avatar: nil)
        }
        return convo.members.first(where: { $0.did != currentUserDid }) ?? convo.members.first ?? ConversationMember(did: "", handle: nil, displayName: nil, avatar: nil)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            chatHeader

            // Messages
            if isLoading && dataState.messages.isEmpty {
                loadingView
            } else {
                messageScrollView
            }
        }
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Chat Header

    private var chatHeader: some View {
        VStack(spacing: 0) {
            // Top row with back button and mute
            HStack {
                Button(action: { onBack?() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 16, weight: .semibold))
                        Text("Back")
                            .font(.system(size: 16))
                    }
                    .foregroundColor(MessagesThemeColors.primary)
                }

                Spacer()

                if let convo = dataState.currentConversation {
                    Button(action: {
                        onToggleMute?(convo.id, convo.muted)
                    }) {
                        Image(systemName: convo.muted ? "bell.slash.fill" : "bell.fill")
                            .font(.system(size: 20))
                            .foregroundColor(MessagesThemeColors.primary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            // Profile info row
            Button(action: {
                if let handle = otherMember.handle {
                    onProfilePress?(handle)
                }
            }) {
                HStack(spacing: 12) {
                    headerAvatarView

                    VStack(alignment: .leading, spacing: 2) {
                        Text(otherMember.displayName ?? otherMember.handle ?? "Unknown User")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundColor(Color(UIColor.label))
                            .lineLimit(1)

                        if let handle = otherMember.handle {
                            Text("@\(handle)")
                                .font(.system(size: 14))
                                .foregroundColor(.secondary)
                        }
                    }

                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 8)
            }
            .buttonStyle(.plain)

            Divider()
        }
    }

    // MARK: - Header Avatar

    @ViewBuilder
    private var headerAvatarView: some View {
        if let avatarUrl = otherMember.avatar, let url = URL(string: avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                default:
                    headerAvatarPlaceholder
                }
            }
        } else {
            headerAvatarPlaceholder
        }
    }

    private var headerAvatarPlaceholder: some View {
        Circle()
            .fill(Color(UIColor.secondarySystemBackground))
            .frame(width: 40, height: 40)
            .overlay(
                Text(String((otherMember.displayName ?? otherMember.handle ?? "U").prefix(1)).uppercased())
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(Color(UIColor.label))
            )
    }

    // MARK: - Message Scroll View

    private var messageScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(dataState.messages) { message in
                        MessageBubbleView(
                            message: message,
                            isOwnMessage: message.senderDid == currentUserDid,
                            currentUserDid: currentUserDid,
                            onDeleteMessage: onDeleteMessage
                        )
                        .id(message.id)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .onChange(of: dataState.messages.count) { _ in
                // Scroll to bottom when new messages arrive
                if let lastMessage = dataState.messages.last {
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo(lastMessage.id, anchor: .bottom)
                    }
                }
            }
            .onAppear {
                // Scroll to bottom on initial load
                if let lastMessage = dataState.messages.last {
                    proxy.scrollTo(lastMessage.id, anchor: .bottom)
                }
            }
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading messages...")
                .foregroundColor(.secondary)
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Message Bubble View

struct MessageBubbleView: View {
    let message: Message
    let isOwnMessage: Bool
    let currentUserDid: String
    let onDeleteMessage: ((String) -> Void)?

    @State private var showDeleteConfirmation = false

    var body: some View {
        HStack {
            if isOwnMessage { Spacer(minLength: 60) }

            VStack(alignment: isOwnMessage ? .trailing : .leading, spacing: 0) {
                // Text bubble
                if !message.text.isEmpty {
                    Text(message.text)
                        .font(.system(size: 16))
                        .foregroundColor(Color(UIColor.label))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            isOwnMessage
                                ? MessagesThemeColors.primary
                                : Color(UIColor.secondarySystemBackground)
                        )
                        .foregroundColor(isOwnMessage ? .white : Color(UIColor.label))
                        .cornerRadius(16)
                }

                // Time and delivery status
                HStack(spacing: 4) {
                    Text(MessageTimeFormatter.formatMessageTime(from: message.sentAt))
                        .font(.system(size: 11))
                        .foregroundColor(Color(UIColor.tertiaryLabel))

                    if isOwnMessage {
                        Text(message.id.isEmpty ? "\u{2713}" : "\u{2713}\u{2713}")
                            .font(.system(size: 11))
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                    }
                }
                .padding(.top, 2)
                .padding(.horizontal, 4)
            }

            if !isOwnMessage { Spacer(minLength: 60) }
        }
        .padding(.vertical, 2)
        .onLongPressGesture {
            if isOwnMessage {
                showDeleteConfirmation = true
            }
        }
        .confirmationDialog("Delete Message", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                onDeleteMessage?(message.id)
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to delete this message? This cannot be undone.")
        }
    }
}
