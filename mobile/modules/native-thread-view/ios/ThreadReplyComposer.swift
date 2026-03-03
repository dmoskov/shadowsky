//
//  ThreadReplyComposer.swift
//  NativeThreadView
//
//  Inline reply composer bar at the bottom of the thread view.
//  Single-row text input (scrolls horizontally). Character count (300 limit).
//  Sends bridge events back to JS for actual post creation and media picker modals.
//

import SwiftUI
import UIKit

// MARK: - Composer State

/// Observable state for the reply composer
class ComposerState: ObservableObject {
    @Published var text: String = ""
    @Published var isSending: Bool = false
    @Published var replyToHandle: String? = nil
    @Published var replyToUri: String? = nil
    @Published var replyToCid: String? = nil
    @Published var mentionQuery: String? = nil
    @Published var mentionStartIndex: Int = 0
    @Published var mentionSuggestions: [MentionSuggestion] = []
    @Published var isShowingMentions: Bool = false
    @Published var keyboardHeight: CGFloat = 0

    static let maxCharacters = 300

    var remainingCharacters: Int {
        Self.maxCharacters - text.count
    }

    var isOverLimit: Bool {
        text.count > Self.maxCharacters
    }

    var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && !isOverLimit
            && !isSending
    }

    /// Detect @mention as the user types
    func detectMention(in newText: String) {
        // Find the last @ that isn't preceded by a word character
        let nsText = newText as NSString
        let cursorPos = nsText.length

        // Walk backwards from cursor to find an @ sign
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

    /// Insert a selected mention into the text
    func insertMention(_ suggestion: MentionSuggestion) {
        let nsText = text as NSString
        let replaceRange = NSRange(location: mentionStartIndex, length: nsText.length - mentionStartIndex)
        let replacement = "@\(suggestion.handle) "
        text = nsText.replacingCharacters(in: replaceRange, with: replacement)
        mentionQuery = nil
        isShowingMentions = false
    }

    func reset() {
        text = ""
        isSending = false
        mentionQuery = nil
        isShowingMentions = false
        mentionSuggestions = []
    }
}

// MARK: - ThreadReplyComposer View

struct ThreadReplyComposer: View {
    @ObservedObject var state: ComposerState

    // Bridge event callbacks
    let onSendReply: ((String, String?, String?) -> Void)?  // (text, replyToUri, replyToCid)
    let onOpenImagePicker: (() -> Void)?
    let onOpenGifPicker: (() -> Void)?
    let onOpenEmojiPicker: (() -> Void)?
    let onMentionSearch: ((String) -> Void)?
    let onDismissKeyboard: (() -> Void)?

    @ScaledMetric(relativeTo: .body) private var sendButtonSize: CGFloat = 32
    @FocusState private var isTextFieldFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Mention suggestions overlay
            if state.isShowingMentions && !state.mentionSuggestions.isEmpty {
                MentionSuggestionsView(
                    suggestions: state.mentionSuggestions,
                    onSelect: { suggestion in
                        state.insertMention(suggestion)
                    }
                )
            }

            Divider()

            // Composer bar
            HStack(alignment: .bottom, spacing: 8) {
                // Text input
                AutoGrowingTextEditor(
                    text: $state.text,
                    placeholder: state.replyToHandle != nil
                        ? "Reply to @\(state.replyToHandle!)..."
                        : "Write a reply...",
                    maxLines: 1,
                    isFocused: $isTextFieldFocused,
                    onTextChange: { newText in
                        state.detectMention(in: newText)
                        if let query = state.mentionQuery {
                            onMentionSearch?(query)
                        }
                    }
                )
                .accessibilityLabel("Reply text input")
                .accessibilityHint("Type your reply here")

                // Character count + Send
                HStack(spacing: 6) {
                    // Character count
                    if !state.text.isEmpty {
                        Text("\(state.text.count)/\(ComposerState.maxCharacters)")
                            .font(.caption2)
                            .foregroundColor(state.isOverLimit ? .red : .secondary)
                            .accessibilityLabel("\(state.text.count) of \(ComposerState.maxCharacters) characters")
                    }

                    // Send button
                    Button(action: handleSend) {
                        if state.isSending {
                            ProgressView()
                                .frame(width: sendButtonSize, height: sendButtonSize)
                        } else {
                            Image(systemName: "arrow.up.circle.fill")
                                .font(.title)
                                .foregroundColor(state.canSend ? .accentColor : Color(.systemGray3))
                        }
                    }
                    .disabled(!state.canSend)
                    .accessibilityLabel("Send reply")
                    .accessibilityHint(state.canSend ? "Double tap to send your reply" : "Cannot send: text is empty or over the character limit")
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(UIColor.systemBackground))
        }
    }

    // MARK: - Actions

    private func handleSend() {
        guard state.canSend else { return }

        // Haptic feedback
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()

        let text = state.text.trimmingCharacters(in: .whitespacesAndNewlines)
        state.isSending = true

        onSendReply?(text, state.replyToUri, state.replyToCid)
    }
}

// MARK: - Auto-Growing Text Editor

/// A TextEditor that auto-grows in height up to a maximum number of lines
struct AutoGrowingTextEditor: View {
    @Binding var text: String
    let placeholder: String
    let maxLines: Int
    var isFocused: FocusState<Bool>.Binding
    var onTextChange: ((String) -> Void)?

    @State private var textHeight: CGFloat = 36

    private var lineHeight: CGFloat { 20 }
    private var maxHeight: CGFloat { lineHeight * CGFloat(maxLines) + 16 }
    private var minHeight: CGFloat { 36 }

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Placeholder
            if text.isEmpty {
                Text(placeholder)
                    .foregroundColor(Color(.placeholderText))
                    .font(.body)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 10)
                    .allowsHitTesting(false)
            }

            // Invisible text for height calculation
            Text(text.isEmpty ? " " : text)
                .font(.body)
                .padding(.horizontal, 8)
                .padding(.vertical, 8)
                .opacity(0)
                .background(GeometryReader { geometry in
                    Color.clear
                        .onAppear {
                            textHeight = min(geometry.size.height, maxHeight)
                        }
                        .onChangeCompat(of: text) { _ in
                            textHeight = min(geometry.size.height, maxHeight)
                        }
                })

            // Actual text editor
            TextEditor(text: $text)
                .font(.body)
                .padding(.horizontal, 4)
                .padding(.vertical, 2)
                .frame(minHeight: minHeight, maxHeight: max(minHeight, textHeight))
                .focused(isFocused)
                .onChangeCompat(of: text) { newValue in
                    onTextChange?(newValue)
                }
                .modifier(HideScrollContentBackgroundModifier())
                .accessibilityLabel("Reply text")
        }
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(18)
        .overlay(
            RoundedRectangle(cornerRadius: 18)
                .stroke(Color(.systemGray4), lineWidth: 0.5)
        )
    }
}

// MARK: - Compatibility Modifier

struct HideScrollContentBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 16.0, *) {
            content.scrollContentBackground(.hidden)
        } else {
            content
        }
    }
}

// MARK: - Preview

#if DEBUG
struct ThreadReplyComposer_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            Spacer()
            ThreadReplyComposer(
                state: {
                    let state = ComposerState()
                    state.replyToHandle = "alice.bsky.social"
                    return state
                }(),
                onSendReply: { text, uri, cid in print("Send: \(text)") },
                onOpenImagePicker: { print("Image picker") },
                onOpenGifPicker: { print("GIF picker") },
                onOpenEmojiPicker: { print("Emoji picker") },
                onMentionSearch: { query in print("Mention search: \(query)") },
                onDismissKeyboard: { print("Dismiss keyboard") }
            )
        }
    }
}
#endif
