//
//  MessageTypes.swift
//  NativeMessages
//
//  Types for DM conversations and messages in the native SwiftUI messages view.
//

import Foundation

// MARK: - Conversation Member

struct ConversationMember: Identifiable {
    let id: String // did
    let did: String
    let handle: String?
    let displayName: String?
    let avatar: String?

    init(did: String, handle: String?, displayName: String?, avatar: String?) {
        self.id = did
        self.did = did
        self.handle = handle
        self.displayName = displayName
        self.avatar = avatar
    }
}

// MARK: - Last Message Preview

struct LastMessagePreview {
    let id: String
    let text: String
    let sentAt: String
    let senderDid: String
}

// MARK: - Conversation

struct Conversation: Identifiable {
    let id: String
    let rev: String
    let members: [ConversationMember]
    let muted: Bool
    let unreadCount: Int
    let lastMessage: LastMessagePreview?
}

// MARK: - Message Embed Image

struct MessageEmbedImage {
    let refLink: String
    let mimeType: String
    let size: Int
    let alt: String
}

// MARK: - Message

struct Message: Identifiable {
    let id: String
    let rev: String
    let text: String
    let sentAt: String
    let senderDid: String
    let embedImages: [MessageEmbedImage]?
}

// MARK: - Messages State

class MessagesDataState: ObservableObject {
    @Published var conversations: [Conversation] = []
    @Published var currentConversation: Conversation?
    @Published var messages: [Message] = []

    private var conversationsObserver: NSObjectProtocol?
    private var messagesObserver: NSObjectProtocol?
    private var clearObserver: NSObjectProtocol?

    func startObserving() {
        conversationsObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("MessagesBridgeConversationsUpdated"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let data = notification.userInfo?["conversations"] as? [[String: Any]] {
                self?.conversations = data.compactMap { Self.parseConversation(from: $0) }
            }
        }

        messagesObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("MessagesBridgeMessagesUpdated"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            if let convoData = notification.userInfo?["conversation"] as? [String: Any] {
                self?.currentConversation = Self.parseConversation(from: convoData)
            }
            if let msgsData = notification.userInfo?["messages"] as? [[String: Any]] {
                self?.messages = msgsData.compactMap { Self.parseMessage(from: $0) }
            }
        }

        clearObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("MessagesBridgeDataCleared"),
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.conversations = []
            self?.currentConversation = nil
            self?.messages = []
        }
    }

    func stopObserving() {
        if let observer = conversationsObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = messagesObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = clearObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Parsing

    static func parseConversation(from data: [String: Any]) -> Conversation? {
        guard let id = data["id"] as? String else { return nil }

        let membersData = data["members"] as? [[String: Any]] ?? []
        let members = membersData.map { memberData in
            ConversationMember(
                did: memberData["did"] as? String ?? "",
                handle: memberData["handle"] as? String,
                displayName: memberData["displayName"] as? String,
                avatar: memberData["avatar"] as? String
            )
        }

        var lastMessage: LastMessagePreview?
        if let lmData = data["lastMessage"] as? [String: Any] {
            lastMessage = LastMessagePreview(
                id: lmData["id"] as? String ?? "",
                text: lmData["text"] as? String ?? "",
                sentAt: lmData["sentAt"] as? String ?? "",
                senderDid: lmData["senderDid"] as? String ?? ""
            )
        }

        return Conversation(
            id: id,
            rev: data["rev"] as? String ?? "",
            members: members,
            muted: data["muted"] as? Bool ?? false,
            unreadCount: data["unreadCount"] as? Int ?? 0,
            lastMessage: lastMessage
        )
    }

    static func parseMessage(from data: [String: Any]) -> Message? {
        guard let id = data["id"] as? String else { return nil }

        var embedImages: [MessageEmbedImage]?
        if let embedData = data["embed"] as? [String: Any],
           let imagesData = embedData["images"] as? [[String: Any]] {
            embedImages = imagesData.compactMap { imgData in
                guard let refLink = imgData["refLink"] as? String else { return nil }
                return MessageEmbedImage(
                    refLink: refLink,
                    mimeType: imgData["mimeType"] as? String ?? "image/jpeg",
                    size: imgData["size"] as? Int ?? 0,
                    alt: imgData["alt"] as? String ?? ""
                )
            }
        }

        return Message(
            id: id,
            rev: data["rev"] as? String ?? "",
            text: data["text"] as? String ?? "",
            sentAt: data["sentAt"] as? String ?? "",
            senderDid: data["senderDid"] as? String ?? "",
            embedImages: embedImages
        )
    }
}

// MARK: - Time Formatting

enum MessageTimeFormatter {
    static func formatRelativeTime(from isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: isoString) ?? ISO8601DateFormatter().date(from: isoString) else {
            return ""
        }

        let interval = Date().timeIntervalSince(date)

        if interval < 60 { return "just now" }
        if interval < 3600 { return "\(Int(interval / 60))m ago" }
        if interval < 86400 { return "\(Int(interval / 3600))h ago" }
        if interval < 604800 { return "\(Int(interval / 86400))d ago" }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "MMM d"
        return dateFormatter.string(from: date)
    }

    static func formatMessageTime(from isoString: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        guard let date = formatter.date(from: isoString) ?? ISO8601DateFormatter().date(from: isoString) else {
            return ""
        }

        let dateFormatter = DateFormatter()
        let calendar = Calendar.current

        if calendar.isDateInToday(date) {
            dateFormatter.dateFormat = "h:mm a"
        } else if calendar.isDateInYesterday(date) {
            dateFormatter.dateFormat = "'Yesterday' h:mm a"
        } else {
            dateFormatter.dateFormat = "MMM d, h:mm a"
        }

        return dateFormatter.string(from: date)
    }
}
