//
//  MessageThreadView.swift
//  NativeMessages
//
//  SwiftUI message thread view with inverted scroll (newest messages at bottom),
//  native keyboard handling, message bubbles, delivery status, reactions,
//  link previews, read receipts, and typing indicators.
//

import SwiftUI

// MARK: - Message Thread View

struct MessageThreadView: View {
    @ObservedObject var dataState: MessagesDataState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    let isLoading: Bool
    let currentUserDid: String

    // Events
    let onBack: (() -> Void)?
    let onToggleMute: ((String, Bool) -> Void)?
    let onDeleteMessage: ((String) -> Void)?
    let onProfilePress: ((String) -> Void)?
    let onReaction: ((String, String) -> Void)?

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
        .onTapGesture {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
    }

    // MARK: - Chat Header

    private var chatHeader: some View {
        VStack(spacing: 0) {
            // Top row with back button and mute
            HStack {
                Button(action: { onBack?() }) {
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.body.weight(.semibold))
                        Text("Back")
                            .font(.body)
                    }
                    .foregroundColor(MessagesThemeColors.primary)
                }

                Spacer()

                if let convo = dataState.currentConversation {
                    Button(action: {
                        onToggleMute?(convo.id, convo.muted)
                    }) {
                        Image(systemName: convo.muted ? "bell.slash.fill" : "bell.fill")
                            .font(.title3)
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
                        Text({
                            if let name = otherMember.displayName, !name.isEmpty { return name }
                            if let handle = otherMember.handle, !handle.isEmpty { return handle }
                            return "Unknown User"
                        }())
                            .font(.body.weight(.semibold))
                            .foregroundColor(Color(UIColor.label))
                            .lineLimit(1)

                        if let handle = otherMember.handle {
                            Text("@\(handle)")
                                .font(.subheadline)
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
                Text(String(({
                    if let name = otherMember.displayName, !name.isEmpty { return name }
                    if let handle = otherMember.handle, !handle.isEmpty { return handle }
                    return "U"
                }() as String).prefix(1)).uppercased())
                    .font(.title3.weight(.semibold))
                    .foregroundColor(Color(UIColor.label))
            )
    }

    // MARK: - Message Scroll View

    private var messageScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 4) {
                    ForEach(dataState.messages) { message in
                        let isLast = message.id == dataState.messages.last?.id
                        MessageBubbleView(
                            message: message,
                            isOwnMessage: message.senderDid == currentUserDid,
                            isLastMessage: isLast,
                            currentUserDid: currentUserDid,
                            onDeleteMessage: onDeleteMessage,
                            onReaction: onReaction
                        )
                        .id(message.id)
                    }

                    // Typing indicator
                    if dataState.isOtherTyping {
                        TypingIndicatorView()
                            .id("typing-indicator")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChangeCompat(of: dataState.messages.count) { _ in
                // Scroll to bottom when new messages arrive
                scrollToBottom(proxy: proxy)
            }
            .onChangeCompat(of: dataState.isOtherTyping) { _ in
                scrollToBottom(proxy: proxy)
            }
            .onAppear {
                // Scroll to bottom on initial load
                if let lastMessage = dataState.messages.last {
                    proxy.scrollTo(lastMessage.id, anchor: .bottom)
                }
            }
        }
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        let targetId: String = dataState.isOtherTyping ? "typing-indicator" : (dataState.messages.last?.id ?? "")
        guard !targetId.isEmpty else { return }
        if reduceMotion {
            proxy.scrollTo(targetId, anchor: .bottom)
        } else {
            withAnimation(.easeOut(duration: 0.2)) {
                proxy.scrollTo(targetId, anchor: .bottom)
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

// MARK: - Typing Indicator View

struct TypingIndicatorView: View {
    @State private var dotAnimation: Int = 0

    var body: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color(UIColor.tertiaryLabel))
                        .frame(width: 6, height: 6)
                        .opacity(dotAnimation == index ? 1.0 : 0.4)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(UIColor.secondarySystemBackground))
            .cornerRadius(16)

            Spacer(minLength: 60)
        }
        .padding(.vertical, 2)
        .onAppear {
            animateDots()
        }
    }

    private func animateDots() {
        Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { timer in
            withAnimation(.easeInOut(duration: 0.3)) {
                dotAnimation = (dotAnimation + 1) % 3
            }
        }
    }
}

// MARK: - Message Bubble View

struct MessageBubbleView: View {
    let message: Message
    let isOwnMessage: Bool
    let isLastMessage: Bool
    let currentUserDid: String
    let onDeleteMessage: ((String) -> Void)?
    let onReaction: ((String, String) -> Void)?

    @State private var showActionSheet = false

    private let quickReactions = ["\u{1F44D}", "\u{2764}\u{FE0F}", "\u{1F602}", "\u{1F62E}", "\u{1F64F}"]

    var body: some View {
        HStack {
            if isOwnMessage { Spacer(minLength: 60) }

            VStack(alignment: isOwnMessage ? .trailing : .leading, spacing: 0) {
                // Text bubble
                if !message.text.isEmpty {
                    messageBubble
                }

                // Link preview
                if let preview = message.linkPreview {
                    LinkPreviewBubble(preview: preview, isOwnMessage: isOwnMessage)
                        .padding(.top, message.text.isEmpty ? 0 : 4)
                }

                // Reactions display
                if !message.reactions.isEmpty {
                    ReactionsBar(
                        reactions: message.reactions,
                        currentUserDid: currentUserDid,
                        onTapReaction: { emoji in
                            onReaction?(message.id, emoji)
                        }
                    )
                    .padding(.top, 4)
                }

                // Time and read receipt
                HStack(spacing: 4) {
                    Text(MessageTimeFormatter.formatMessageTime(from: message.sentAt))
                        .font(.caption2)
                        .foregroundColor(Color(UIColor.tertiaryLabel))

                    if isOwnMessage {
                        ReadReceiptIcon(isLastMessage: isLastMessage)
                    }
                }
                .padding(.top, 2)
                .padding(.horizontal, 4)
            }

            if !isOwnMessage { Spacer(minLength: 60) }
        }
        .padding(.vertical, 2)
        .onLongPressGesture {
            showActionSheet = true
        }
        .confirmationDialog("Message", isPresented: $showActionSheet) {
            // Quick reactions
            ForEach(quickReactions, id: \.self) { emoji in
                Button("React \(emoji)") {
                    onReaction?(message.id, emoji)
                }
            }

            if isOwnMessage {
                Button("Delete", role: .destructive) {
                    onDeleteMessage?(message.id)
                }
            }

            Button("Cancel", role: .cancel) {}
        } message: {
            Text(isOwnMessage ? "React or delete this message" : "React to this message")
        }
    }

    private var messageBubble: some View {
        Text(message.text)
            .font(.body)
            .foregroundColor(isOwnMessage ? .white : Color(UIColor.label))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(
                isOwnMessage
                    ? MessagesThemeColors.primary
                    : Color(UIColor.secondarySystemBackground)
            )
            .cornerRadius(16)
    }
}

// MARK: - Read Receipt Icon

struct ReadReceiptIcon: View {
    let isLastMessage: Bool

    var body: some View {
        // Single check = sent, double check = delivered (always for non-empty IDs)
        // Blue double check on the last message to indicate "read"
        HStack(spacing: 0) {
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .bold))
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .bold))
                .offset(x: -3)
        }
        .foregroundColor(isLastMessage ? MessagesThemeColors.primary : Color(UIColor.tertiaryLabel))
        .accessibilityLabel(isLastMessage ? "Seen" : "Delivered")
    }
}

// MARK: - Reactions Bar

struct ReactionsBar: View {
    let reactions: [MessageReaction]
    let currentUserDid: String
    let onTapReaction: (String) -> Void

    var body: some View {
        HStack(spacing: 4) {
            ForEach(reactions) { reaction in
                let hasReacted = reaction.userDids.contains(currentUserDid)

                Button(action: {
                    onTapReaction(reaction.emoji)
                }) {
                    HStack(spacing: 2) {
                        Text(reaction.emoji)
                            .font(.caption)
                        if reaction.count > 1 {
                            Text("\(reaction.count)")
                                .font(.caption2)
                                .foregroundColor(hasReacted ? MessagesThemeColors.primary : Color(UIColor.secondaryLabel))
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 3)
                    .background(
                        hasReacted
                            ? MessagesThemeColors.primary.opacity(0.15)
                            : Color(UIColor.tertiarySystemBackground)
                    )
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(
                                hasReacted ? MessagesThemeColors.primary.opacity(0.3) : Color.clear,
                                lineWidth: 1
                            )
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Link Preview Bubble

struct LinkPreviewBubble: View {
    let preview: MessageLinkPreview
    let isOwnMessage: Bool

    private var domain: String {
        guard let urlObj = URL(string: preview.url),
              let host = urlObj.host else { return preview.url }
        return host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Thumbnail image
            if let imageUrl = preview.imageUrl, let url = URL(string: imageUrl) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(maxWidth: 220, maxHeight: 120)
                            .clipped()
                    default:
                        EmptyView()
                    }
                }
            }

            // Text content
            VStack(alignment: .leading, spacing: 2) {
                if let title = preview.title, !title.isEmpty {
                    Text(title)
                        .font(.caption.weight(.semibold))
                        .foregroundColor(isOwnMessage ? .white : Color(UIColor.label))
                        .lineLimit(2)
                }

                if let description = preview.description, !description.isEmpty {
                    Text(description)
                        .font(.caption2)
                        .foregroundColor(isOwnMessage ? Color.white.opacity(0.8) : Color(UIColor.secondaryLabel))
                        .lineLimit(2)
                }

                Text(domain)
                    .font(.caption2)
                    .foregroundColor(isOwnMessage ? Color.white.opacity(0.6) : Color(UIColor.tertiaryLabel))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
        }
        .frame(maxWidth: 220)
        .background(
            isOwnMessage
                ? MessagesThemeColors.primary.opacity(0.85)
                : Color(UIColor.secondarySystemBackground)
        )
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(UIColor.separator).opacity(0.3), lineWidth: 0.5)
        )
    }
}
