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
    @State private var localSearchText: String = ""
    @State private var isSearchActive: Bool = false

    let isLoading: Bool
    let isRefreshing: Bool
    let searchText: String
    let isSearching: Bool
    let currentUserDid: String

    // Events
    let onConversationPress: ((String) -> Void)?
    let onRefresh: (() -> Void)?
    let onNewConversation: (() -> Void)?
    let onDeleteConversation: ((String) -> Void)?
    let onToggleMute: ((String, Bool) -> Void)?
    let onSearchTextChange: ((String) -> Void)?

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

    private var hasSearchQuery: Bool {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2
    }

    /// Deep message search results from the JS bridge (conversations that matched on message content)
    private var messageSearchResults: [SearchResult] {
        guard hasSearchQuery else { return [] }
        // Only show message-type results that aren't already in the filtered conversation list
        let conversationIds = Set(filteredConversations.map { $0.id })
        return dataState.searchResults.filter { result in
            result.matchType == "message" && !conversationIds.contains(result.conversationId)
        }
    }

    var body: some View {
        ZStack {
            if isLoading && dataState.conversations.isEmpty {
                loadingView
            } else if dataState.conversations.isEmpty && !isSearchActive {
                emptyView
            } else {
                conversationScrollView
            }
        }
        .background(Color(UIColor.systemBackground))
    }

    // MARK: - Search Bar

    private var searchBar: some View {
        HStack(spacing: 8) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.body)
                    .foregroundColor(.secondary)

                TextField("Search messages...", text: $localSearchText)
                    .font(.body)
                    .foregroundColor(Color(UIColor.label))
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .onChange(of: localSearchText) { newValue in
                        onSearchTextChange?(newValue)
                    }

                if !localSearchText.isEmpty {
                    Button(action: {
                        localSearchText = ""
                        onSearchTextChange?("")
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(20)

            if isSearchActive {
                Button("Cancel") {
                    localSearchText = ""
                    isSearchActive = false
                    onSearchTextChange?("")
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
                .font(.body)
                .foregroundColor(MessagesThemeColors.primary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .onTapGesture {
            isSearchActive = true
        }
    }

    // MARK: - Conversation Scroll View

    private var conversationScrollView: some View {
        ScrollView {
            LazyVStack(spacing: 0) {
                // Search bar
                searchBar

                // Searching indicator
                if isSearching && hasSearchQuery {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text("Searching messages...")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }

                // Conversation matches (by contact name/handle/last message)
                if hasSearchQuery && !filteredConversations.isEmpty {
                    HStack {
                        Text("Conversations")
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 4)
                }

                ForEach(filteredConversations) { conversation in
                    ConversationRowView(
                        conversation: conversation,
                        otherMember: getOtherMember(conversation),
                        searchText: hasSearchQuery ? searchText : nil,
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

                // Message content matches section
                if hasSearchQuery && !messageSearchResults.isEmpty {
                    HStack {
                        Text("Messages")
                            .font(.footnote.weight(.semibold))
                            .foregroundColor(.secondary)
                            .textCase(.uppercase)
                        Spacer()
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .padding(.bottom, 4)

                    ForEach(messageSearchResults) { result in
                        MessageSearchResultRow(
                            result: result,
                            searchText: searchText,
                            onPress: {
                                onConversationPress?(result.conversationId)
                            }
                        )
                    }
                }

                // No results state
                if hasSearchQuery && filteredConversations.isEmpty && messageSearchResults.isEmpty && !isSearching {
                    VStack(spacing: 12) {
                        Image(systemName: "magnifyingglass")
                            .font(.largeTitle)
                            .foregroundColor(.secondary)
                        Text("No results found")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.top, 60)
                }

                // Not searching — show all conversations without section header
                if !hasSearchQuery {
                    // Already shown above via ForEach(filteredConversations)
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
                .font(.largeTitle)
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
    var searchText: String? = nil
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
                            HighlightedText(
                                text: otherMember.displayName ?? otherMember.handle ?? "Unknown User",
                                highlight: searchText
                            )
                                .font(.body.weight(.semibold))
                                .lineLimit(1)

                            if conversation.muted {
                                Image(systemName: "bell.slash.fill")
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                            }
                        }

                        Spacer()

                        if conversation.unreadCount > 0 {
                            Text("\(conversation.unreadCount)")
                                .font(.caption.weight(.semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(MessagesThemeColors.primary)
                                .clipShape(Capsule())
                        }
                    }

                    // Handle
                    if let handle = otherMember.handle {
                        HighlightedText(
                            text: "@\(handle)",
                            highlight: searchText
                        )
                            .font(.subheadline)
                            .lineLimit(1)
                    }

                    // Last message with time
                    if let lastMessage = conversation.lastMessage {
                        HStack {
                            HighlightedText(
                                text: lastMessage.text,
                                highlight: searchText
                            )
                                .font(.subheadline)
                                .lineLimit(1)

                            Spacer(minLength: 4)

                            Text(MessageTimeFormatter.formatRelativeTime(from: lastMessage.sentAt))
                                .font(.caption)
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
                    .font(.title3.weight(.semibold))
                    .foregroundColor(Color(UIColor.label))
            )
    }
}

// MARK: - Message Search Result Row

struct MessageSearchResultRow: View {
    let result: SearchResult
    let searchText: String
    let onPress: () -> Void

    var body: some View {
        Button(action: onPress) {
            HStack(spacing: 12) {
                // Avatar
                searchResultAvatar

                // Details
                VStack(alignment: .leading, spacing: 2) {
                    Text(result.displayName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(Color(UIColor.label))
                        .lineLimit(1)

                    if !result.handle.isEmpty {
                        Text("@\(result.handle)")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }

                    if let messageText = result.matchedMessageText {
                        HStack {
                            HighlightedText(
                                text: messageText,
                                highlight: searchText
                            )
                                .font(.footnote)
                                .lineLimit(2)

                            Spacer(minLength: 4)

                            if let sentAt = result.matchedMessageSentAt {
                                Text(MessageTimeFormatter.formatRelativeTime(from: sentAt))
                                    .font(.caption2)
                                    .foregroundColor(Color(UIColor.tertiaryLabel))
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)

        Divider()
            .padding(.leading, 76)
    }

    @ViewBuilder
    private var searchResultAvatar: some View {
        if let avatarUrl = result.avatar, let url = URL(string: avatarUrl) {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 40, height: 40)
                        .clipShape(Circle())
                default:
                    searchResultAvatarPlaceholder
                }
            }
        } else {
            searchResultAvatarPlaceholder
        }
    }

    private var searchResultAvatarPlaceholder: some View {
        Circle()
            .fill(Color(UIColor.secondarySystemBackground))
            .frame(width: 40, height: 40)
            .overlay(
                Text(String(result.displayName.prefix(1)).uppercased())
                    .font(.body.weight(.semibold))
                    .foregroundColor(Color(UIColor.label))
            )
    }
}

// MARK: - Highlighted Text

struct HighlightedText: View {
    let text: String
    let highlight: String?

    var body: some View {
        if let highlight = highlight, !highlight.isEmpty {
            highlightedTextView(text: text, highlight: highlight)
        } else {
            Text(text)
                .foregroundColor(Color(UIColor.label))
        }
    }

    private func highlightedTextView(text: String, highlight: String) -> some View {
        let lowercaseText = text.lowercased()
        let lowercaseHighlight = highlight.lowercased()

        guard let range = lowercaseText.range(of: lowercaseHighlight) else {
            return Text(text)
                .foregroundColor(Color(UIColor.label))
        }

        let before = String(text[text.startIndex..<range.lowerBound])
        let match = String(text[range.lowerBound..<range.upperBound])
        let after = String(text[range.upperBound..<text.endIndex])

        return Text(before)
            .foregroundColor(Color(UIColor.label))
            + Text(match)
                .foregroundColor(MessagesThemeColors.primary)
                .bold()
            + Text(after)
                .foregroundColor(Color(UIColor.label))
    }
}
