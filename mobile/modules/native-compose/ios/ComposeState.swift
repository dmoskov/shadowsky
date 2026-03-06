//
//  ComposeState.swift
//  NativeCompose
//
//  Observable state for the compose view — manages text, media, thread mode, etc.
//

import SwiftUI

// MARK: - Compose State

class NativeComposeState: ObservableObject {
    static let maxCharacters = 300

    // Text input
    @Published var text: String = ""

    // Media attachments (from JS bridge)
    @Published var mediaAttachments: [MediaAttachment] = []

    // Reply / Quote context (from JS bridge)
    @Published var replyContext: ReplyContext?
    @Published var quoteContext: QuoteContext?

    // Thread mode
    @Published var isThreadMode: Bool = false
    @Published var threadPosts: [ComposeThreadPost] = [ComposeThreadPost()]

    // Mention autocomplete
    @Published var mentionQuery: String?
    @Published var mentionStartIndex: Int = 0
    @Published var mentionSuggestions: [ComposeMentionSuggestion] = []
    @Published var isShowingMentions: Bool = false

    // Posting state
    @Published var isPosting: Bool = false
    @Published var isUploading: Bool = false

    // Connectivity state
    @Published var isOffline: Bool = false

    // Language
    @Published var selectedLanguages: [String] = ["en"]

    // Draft
    @Published var draftId: String?

    // Alt text editing
    @Published var editingAltTextIndex: Int?
    @Published var tempAltText: String = ""
    @Published var isGeneratingAltText: Bool = false

    // MARK: - Computed Properties

    var remainingCharacters: Int {
        Self.maxCharacters - text.count
    }

    var isOverLimit: Bool {
        text.count > Self.maxCharacters
    }

    var hasContent: Bool {
        if isThreadMode {
            return threadPosts.contains { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !$0.images.isEmpty }
        }
        return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !mediaAttachments.isEmpty
    }

    var canPost: Bool {
        if isPosting || isUploading || isOffline { return false }

        if isThreadMode {
            let hasAnyContent = threadPosts.contains {
                !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || !$0.images.isEmpty
            }
            let allWithinLimit = threadPosts.allSatisfy { $0.text.count <= Self.maxCharacters }
            return hasAnyContent && allWithinLimit
        }

        return hasContent && !isOverLimit
    }

    // MARK: - Mention Detection

    func detectMention(in newText: String) {
        let nsText = newText as NSString
        let cursorPos = nsText.length

        var atPos = -1
        for i in stride(from: cursorPos - 1, through: 0, by: -1) {
            let char = nsText.character(at: i)
            guard let scalar = Unicode.Scalar(char) else { break }

            if scalar == Unicode.Scalar("@") {
                if i == 0 {
                    atPos = i
                } else if let prevScalar = Unicode.Scalar(nsText.character(at: i - 1)),
                          CharacterSet.whitespacesAndNewlines.contains(prevScalar) {
                    atPos = i
                }
                break
            }
            if CharacterSet.whitespacesAndNewlines.contains(scalar) {
                break
            }
        }

        if atPos >= 0 {
            let queryStart = atPos + 1
            if queryStart <= cursorPos {
                let query = nsText.substring(with: NSRange(location: queryStart, length: cursorPos - queryStart))
                if !query.isEmpty {
                    mentionQuery = query
                    mentionStartIndex = atPos
                    isShowingMentions = true
                    return
                }
            }
        }

        mentionQuery = nil
        isShowingMentions = false
    }

    func insertMention(_ suggestion: ComposeMentionSuggestion) {
        let nsText = text as NSString
        let replaceRange = NSRange(location: mentionStartIndex, length: nsText.length - mentionStartIndex)
        let replacement = "@\(suggestion.handle) "
        text = nsText.replacingCharacters(in: replaceRange, with: replacement)
        mentionQuery = nil
        isShowingMentions = false
    }

    // MARK: - Thread Mode

    func toggleThreadMode() {
        if isThreadMode {
            // Switch to single-post mode: keep first post's text
            text = threadPosts.first?.text ?? ""
            isThreadMode = false
            threadPosts = [ComposeThreadPost()]
        } else {
            // Switch to thread mode: move current text to first post
            threadPosts = [ComposeThreadPost(text: text)]
            text = ""
            isThreadMode = true
        }
    }

    func addThreadPost() {
        threadPosts.append(ComposeThreadPost())
    }

    func removeThreadPost(at index: Int) {
        guard threadPosts.count > 1 else { return }
        threadPosts.remove(at: index)
    }

    func updateThreadPost(at index: Int, text: String) {
        guard index < threadPosts.count else { return }
        threadPosts[index].text = text
    }

    // MARK: - Media

    func removeMediaAttachment(at index: Int) {
        guard index < mediaAttachments.count else { return }
        mediaAttachments.remove(at: index)
    }

    func updateAltText(at index: Int, altText: String) {
        guard index < mediaAttachments.count else { return }
        mediaAttachments[index].altText = altText
    }

    // MARK: - Reset

    func reset() {
        text = ""
        mediaAttachments = []
        replyContext = nil
        quoteContext = nil
        isThreadMode = false
        threadPosts = [ComposeThreadPost()]
        mentionQuery = nil
        isShowingMentions = false
        mentionSuggestions = []
        isPosting = false
        isUploading = false
        isOffline = false
        draftId = nil
        editingAltTextIndex = nil
        tempAltText = ""
        isGeneratingAltText = false
    }
}

// MARK: - Mention Suggestion Model

struct ComposeMentionSuggestion: Identifiable, Equatable {
    let id: String  // DID
    let handle: String
    let displayName: String?
    let avatar: String?

    static func parse(from dict: [String: Any]) -> ComposeMentionSuggestion? {
        guard let did = dict["did"] as? String,
              let handle = dict["handle"] as? String else {
            return nil
        }
        return ComposeMentionSuggestion(
            id: did,
            handle: handle,
            displayName: dict["displayName"] as? String,
            avatar: dict["avatar"] as? String
        )
    }
}
