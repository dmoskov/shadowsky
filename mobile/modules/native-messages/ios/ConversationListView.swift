//
//  ConversationListView.swift
//  NativeMessages
//
//  SwiftUI conversation list view for DM conversations.
//  Renders a scrollable list with avatars, names, last message previews,
//  unread badges, muted indicators, and swipe-to-delete.
//

import SwiftUI

// MARK: - Theme Colors

enum MessagesThemeColors {
    static let primary = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.33, green: 0.53, blue: 0.85, alpha: 1.0)
            : UIColor(red: 0.13, green: 0.39, blue: 0.78, alpha: 1.0)
    })

    static let danger = Color(UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.9, green: 0.3, blue: 0.3, alpha: 1.0)
            : UIColor(red: 0.85, green: 0.2, blue: 0.2, alpha: 1.0)
    })
}

// MARK: - Conversation List View

struct ConversationListView: View {
    @ObservedObject var dataState: MessagesDataState

    let isLoading: Bool
    let isRefreshing: Bool
    let searchText: String
    let currentUserDid: String

    // Events
    let onConversationPress: ((String) -> Void)?
    let onRefresh: (() -> Void)?
    let onNewConversation: (() -> Void)?
    let onDeleteConversation: ((String) -> Void)?
    let onToggleMute: ((String, Bool) -> Void)?

    private var filteredConversations: [Conversation] {
        let conversations = dataState.conversations
        guard !searchText.isEmpty else { return conversations }

        let search = searchText.lowercased()
        return conversations.filter { convo in
            let otherMember = getOtherMember(convo)
            let displayName = (otherMember.displayName ?? "").lowercased()
            let handle = (otherMember.handle ?? "").lowercased()
            let lastMessage = (convo.lastMessage?.text ?? "").lowercased()

            return displayName.contains(search) ||
                   handle.contains(search) ||
                   lastMessage.contains(search)
        }
    }

    var body: some View {
        ZStack {
            if isLoading && dataState.conversations.isEmpty {
                loadingView
            } else if dataState.conversations.isEmpty {
                emptyView
            } else {
                conversationScrollView
            }
        }
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Conversation Scroll View

    private var conversationScrollView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                ForEach(filteredConversations) { conversation in
                    ConversationRowView(
                        conversation: conversation,
                        otherMember: getOtherMember(conversation),
                        onPress: {
                            onConversationPress?(conversation.id)
                        },
                        onDelete: {
                            onDeleteConversation?(conversation.id)
                        },
                        onToggleMute: {
                            onToggleMute?(conversation.id, conversation.muted)
                        }
                    )
                }

                if filteredConversations.isEmpty && !searchText.isEmpty {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 48))
                            .foregroundColor(.secondary)
                        Text("No conversations found")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                }
            }
        }
        .refreshable {
            onRefresh?()
        }
    }

    // MARK: - Loading View

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading conversations...")
                .foregroundColor(.secondary)
                .font(.subheadline)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty View

    private var emptyView: some View {
        VStack(spacing: 12) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundColor(.secondary)
            Text("No conversations yet")
                .font(.headline)
                .foregroundColor(.secondary)
            Text("Tap + to start a new conversation!")
                .font(.subheadline)
                .foregroundColor(Color(UIColor.tertiaryLabel))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Helpers

    private func getOtherMember(_ conversation: Conversation) -> ConversationMember {
        conversation.members.first(where: { $0.did != currentUserDid }) ?? conversation.members.first ?? ConversationMember(did: "", handle: nil, displayName: nil, avatar: nil)
    }
}

// MARK: - Conversation Row View

struct ConversationRowView: View {
    let conversation: Conversation
    let otherMember: ConversationMember
    let onPress: () -> Void
    let onDelete: () -> Void
    let onToggleMute: () -> Void

    var body: some View {
        Button(action: onPress) {
            HStack(spacing: 12) {
                // Avatar
                avatarView

                // Details
                VStack(alignment: .leading, spacing: 2) {
                    // Name row
                    HStack {
                        HStack(spacing: 6) {
                            Text(otherMember.displayName ?? otherMember.handle ?? "Unknown User")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(Color(UIColor.label))
                                .lineLimit(1)

                            if conversation.muted {
                                Image(systemName: "bell.slash.fill")
                                    .font(.system(size: 14))
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()

                        if conversation.unreadCount > 0 {
                            Text("\(conversation.unreadCount)")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(MessagesThemeColors.primary)
                                .clipShape(Capsule())
                        }
                    }

                    // Handle
                    if let handle = otherMember.handle {
                        Text("@\(handle)")
                            .font(.system(size: 14))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }

                    // Last message with time
                    if let lastMessage = conversation.lastMessage {
                        HStack {
                            Text(lastMessage.text)
                                .font(.system(size: 14))
                                .foregroundColor(.secondary)
                                .lineLimit(1)

                            Spacer(minLength: 4)

                            Text(MessageTimeFormatter.formatRelativeTime(from: lastMessage.sentAt))
                                .font(.system(size: 12))
                                .foregroundColor(Color(UIColor.tertiaryLabel))
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive, action: onDelete) {
                Label("Delete", systemImage: "trash")
            }

            Button(action: onToggleMute) {
                Label(
                    conversation.muted ? "Unmute" : "Mute",
                    systemImage: conversation.muted ? "bell" : "bell.slash"
                )
            }
            .tint(.orange)
        }

        Divider()
            .padding(.leading, 76)
    }

    // MARK: - Avatar

    @ViewBuilder
    private var avatarView: some View {
        if let avatarUrl = otherMember.avatar, let url = URL(string: avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 48, height: 48)
                        .clipShape(Circle())
                default:
                    avatarPlaceholder
                }
            }
        } else {
            avatarPlaceholder
        }
    }

    private var avatarPlaceholder: some View {
        Circle()
            .fill(Color(UIColor.secondarySystemBackground))
            .frame(width: 48, height: 48)
            .overlay(
                Text(String((otherMember.displayName ?? otherMember.handle ?? "U").prefix(1)).uppercased())
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundColor(Color(UIColor.label))
            )
    }
}
