//
//  ComposeTypes.swift
//  NativeCompose
//
//  Data models for the native compose screen
//

import SwiftUI

// MARK: - Media Attachment

/// Represents an image or video attachment in the compose view
struct MediaAttachment: Identifiable {
    let id: String
    let uri: String
    let mimeType: String
    var altText: String
    let width: Int
    let height: Int
    let isVideo: Bool
    var thumbnail: String?
    var duration: Double?

    static func fromDict(_ dict: [String: Any]) -> MediaAttachment? {
        guard let uri = dict["uri"] as? String else { return nil }
        return MediaAttachment(
            id: dict["id"] as? String ?? UUID().uuidString,
            uri: uri,
            mimeType: dict["mimeType"] as? String ?? "image/jpeg",
            altText: dict["altText"] as? String ?? "",
            width: dict["width"] as? Int ?? 0,
            height: dict["height"] as? Int ?? 0,
            isVideo: dict["isVideo"] as? Bool ?? false,
            thumbnail: dict["thumbnail"] as? String,
            duration: dict["duration"] as? Double
        )
    }

    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "id": id,
            "uri": uri,
            "mimeType": mimeType,
            "altText": altText,
            "width": width,
            "height": height,
            "isVideo": isVideo,
        ]
        if let thumbnail = thumbnail { dict["thumbnail"] = thumbnail }
        if let duration = duration { dict["duration"] = duration }
        return dict
    }
}

// MARK: - Reply Context

/// Represents the post being replied to
struct ReplyContext {
    let uri: String
    let cid: String
    let authorHandle: String
    let authorDisplayName: String?
    let authorAvatar: String?
    let text: String

    static func fromDict(_ dict: [String: Any]) -> ReplyContext? {
        guard let uri = dict["uri"] as? String,
              let cid = dict["cid"] as? String,
              let authorHandle = dict["authorHandle"] as? String else {
            return nil
        }
        return ReplyContext(
            uri: uri,
            cid: cid,
            authorHandle: authorHandle,
            authorDisplayName: dict["authorDisplayName"] as? String,
            authorAvatar: dict["authorAvatar"] as? String,
            text: dict["text"] as? String ?? ""
        )
    }
}

// MARK: - Quote Context

/// Represents the post being quoted
struct QuoteContext {
    let uri: String
    let cid: String
    let authorHandle: String
    let authorDisplayName: String?
    let authorAvatar: String?
    let text: String

    static func fromDict(_ dict: [String: Any]) -> QuoteContext? {
        guard let uri = dict["uri"] as? String,
              let cid = dict["cid"] as? String,
              let authorHandle = dict["authorHandle"] as? String else {
            return nil
        }
        return QuoteContext(
            uri: uri,
            cid: cid,
            authorHandle: authorHandle,
            authorDisplayName: dict["authorDisplayName"] as? String,
            authorAvatar: dict["authorAvatar"] as? String,
            text: dict["text"] as? String ?? ""
        )
    }
}

// MARK: - Thread Post

/// A single post in thread composition mode
struct ComposeThreadPost: Identifiable {
    let id: String
    var text: String
    var images: [MediaAttachment]

    init(id: String = UUID().uuidString, text: String = "", images: [MediaAttachment] = []) {
        self.id = id
        self.text = text
        self.images = images
    }
}

// MARK: - Draft Data

/// Data for saving/restoring a draft
struct DraftData {
    let id: String?
    let text: String
    let images: [MediaAttachment]

    func toDict() -> [String: Any] {
        var dict: [String: Any] = [
            "text": text,
            "images": images.map { $0.toDict() },
        ]
        if let id = id { dict["id"] = id }
        return dict
    }
}
