//
//  ComposeView.swift
//  NativeCompose
//
//  Main SwiftUI compose view with text input, media grid, toolbar, and keyboard handling.
//  Bridges events to JS for posting, media picking, and draft management.
//

import SwiftUI
import Combine

// MARK: - Keyboard Height Observer

/// Tracks the current keyboard height so the compose UI can keep the toolbar
/// and mention suggestions visible above the software keyboard.
class KeyboardHeightObserver: ObservableObject {
    @Published var keyboardHeight: CGFloat = 0

    private var cancellables = Set<AnyCancellable>()

    init() {
        NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
            .compactMap { notification -> CGFloat? in
                (notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect)?.height
            }
            .sink { [weak self] height in
                withAnimation(.easeOut(duration: 0.25)) {
                    self?.keyboardHeight = height
                }
            }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)
            .sink { [weak self] _ in
                withAnimation(.easeOut(duration: 0.25)) {
                    self?.keyboardHeight = 0
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - ComposeView

struct ComposeView: View {
    @ObservedObject var composeState: NativeComposeState
    @StateObject private var mentionManager = ComposeMentionManager()
    @StateObject private var keyboardObserver = KeyboardHeightObserver()

    // Event callbacks (bridge to JS)
    let onClose: () -> Void
    let onPost: () -> Void
    let onSaveDraft: () -> Void
    let onOpenDrafts: () -> Void
    let onImagePicker: () -> Void
    let onVideoPicker: () -> Void
    let onGifPicker: () -> Void
    let onEmojiPicker: () -> Void
    let onLanguagePicker: () -> Void
    let onRemoveMedia: (Int) -> Void
    let onEditAltText: (Int) -> Void
    let onGenerateAltText: (Int) -> Void
    let onSaveAltText: (Int, String) -> Void
    let onToggleThreadMode: () -> Void
    let onAddThreadPost: () -> Void
    let onRemoveThreadPost: (Int) -> Void
    let onUpdateThreadPost: (Int, String) -> Void
    let onMentionSearch: (String) -> Void
    let onThreadImagePicker: (Int) -> Void
    var onNavigateToProfile: ((String) -> Void)?

    /// Bottom safe area inset read from the key window so keyboard offset
    /// calculations work correctly on devices with a home indicator.
    private var bottomSafeAreaInset: CGFloat {
        UIApplication.shared
            .connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }?
            .safeAreaInsets.bottom ?? 0
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            composeHeader

            // Reply context
            if let replyContext = composeState.replyContext {
                replyContextView(replyContext)
            }

            // Main content
            if composeState.isThreadMode {
                threadModeContent
            } else {
                singlePostContent
            }

            // Mention suggestions — placed above the toolbar so they sit
            // directly above the keyboard when visible
            if composeState.isShowingMentions && !composeState.mentionSuggestions.isEmpty {
                ComposeMentionSuggestionsView(
                    suggestions: composeState.mentionSuggestions,
                    onSelect: { suggestion in
                        composeState.insertMention(suggestion)
                    }
                )
            }

            // Toolbar
            ComposeToolbarView(
                charCount: composeState.text.count,
                maxLength: NativeComposeState.maxCharacters,
                isThreadMode: composeState.isThreadMode,
                hasImages: composeState.mediaAttachments.contains { !$0.isVideo },
                hasVideo: composeState.mediaAttachments.contains { $0.isVideo },
                imageCount: composeState.mediaAttachments.filter { !$0.isVideo }.count,
                selectedLanguages: composeState.selectedLanguages,
                isReply: composeState.replyContext != nil,
                isQuote: composeState.quoteContext != nil,
                onImagePicker: onImagePicker,
                onVideoPicker: onVideoPicker,
                onGifPicker: onGifPicker,
                onEmojiPicker: onEmojiPicker,
                onToggleThreadMode: onToggleThreadMode,
                onLanguagePicker: onLanguagePicker
            )
        }
        // Push the toolbar and mention suggestions above the keyboard
        .padding(.bottom, keyboardObserver.keyboardHeight > 0
            ? keyboardObserver.keyboardHeight - bottomSafeAreaInset
            : 0)
        .background(Color(UIColor.systemBackground))
        .ignoresSafeArea(.keyboard)
        .onAppear {
            mentionManager.startObserving()
        }
        .onDisappear {
            mentionManager.stopObserving()
        }
        .onChangeCompat(of: mentionManager.suggestions) { newSuggestions in
            composeState.mentionSuggestions = newSuggestions
        }
        // Alt text sheet
        .sheet(isPresented: Binding(
            get: { composeState.editingAltTextIndex != nil },
            set: { if !$0 { composeState.editingAltTextIndex = nil } }
        )) {
            if let index = composeState.editingAltTextIndex, index < composeState.mediaAttachments.count {
                AltTextSheet(
                    imageUri: composeState.mediaAttachments[index].uri,
                    altText: Binding(
                        get: { composeState.tempAltText },
                        set: { composeState.tempAltText = $0 }
                    ),
                    isGenerating: composeState.isGeneratingAltText,
                    onGenerateAltText: { onGenerateAltText(index) },
                    onSave: { text in
                        onSaveAltText(index, text)
                        composeState.editingAltTextIndex = nil
                    },
                    onDismiss: {
                        composeState.editingAltTextIndex = nil
                    }
                )
            }
        }
    }

    // MARK: - Header

    private var composeHeader: some View {
        HStack {
            // Cancel button
            Button(action: onClose) {
                Text("Cancel")
                    .foregroundColor(.secondary)
                    .font(.body)
            }
            .frame(minWidth: 44, minHeight: 44)
            .accessibilityLabel("Cancel")
            .accessibilityHint("Dismiss compose screen")

            Spacer()

            // Drafts button (not in thread mode)
            if !composeState.isThreadMode {
                Button(action: onOpenDrafts) {
                    Text("Drafts")
                        .foregroundColor(.accentColor)
                        .font(.subheadline.weight(.medium))
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }

            Spacer()

            // Post button
            Button(action: onPost) {
                if composeState.isPosting || composeState.isUploading {
                    ProgressView()
                        .frame(width: 20, height: 20)
                } else {
                    Text(composeState.isOffline ? "Offline" : "Post")
                        .font(.body.weight(.semibold))
                }
            }
            .frame(minWidth: 70, minHeight: 44)
            .background(composeState.canPost ? Color.accentColor : Color(UIColor.systemGray5))
            .foregroundColor(composeState.canPost ? .white : Color(UIColor.systemGray2))
            .cornerRadius(20)
            .disabled(!composeState.canPost)
            .accessibilityLabel(composeState.isOffline ? "Offline — cannot post" : "Post")
            .accessibilityHint(composeState.isOffline ? "You are offline. Connect to the internet to post." : composeState.canPost ? "Post your content" : "Cannot post: content is empty or over the character limit")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .overlay(
            Divider(), alignment: .bottom
        )
    }

    // MARK: - Reply Context

    private func replyContextView(_ context: ReplyContext) -> some View {
        Button(action: {
            // Navigate to replying-to author's profile via JS bridge
            onNavigateToProfile?(context.authorHandle)
        }) {
            HStack(spacing: 6) {
                Text("Replying to")
                    .foregroundColor(.secondary)
                Text("@\(context.authorHandle)")
                    .foregroundColor(.accentColor)
            }
            .font(.subheadline.weight(.medium))
            .lineLimit(1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .overlay(
            Divider(), alignment: .bottom
        )
    }

    // MARK: - Single Post Content

    private var singlePostContent: some View {
        ScrollView {
            VStack(spacing: 0) {
                // Text editor
                ComposeTextEditor(
                    text: $composeState.text,
                    placeholder: placeholderText,
                    isEnabled: !composeState.isPosting && !composeState.isUploading,
                    onTextChange: { newText in
                        composeState.detectMention(in: newText)
                        if let query = composeState.mentionQuery {
                            onMentionSearch(query)
                        }
                    }
                )
                .frame(minHeight: 200)

                // Media grid
                ComposeMediaGrid(
                    attachments: composeState.mediaAttachments,
                    isUploading: composeState.isUploading,
                    onRemove: { index in onRemoveMedia(index) },
                    onEditAltText: { index in
                        composeState.editingAltTextIndex = index
                        composeState.tempAltText = composeState.mediaAttachments[index].altText
                        onEditAltText(index)
                    }
                )

                // Quote preview
                if let quoteContext = composeState.quoteContext {
                    quotePreviewView(quoteContext)
                }
            }
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Thread Mode Content

    private var threadModeContent: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(Array(composeState.threadPosts.enumerated()), id: \.element.id) { index, post in
                    HStack(alignment: .top, spacing: 8) {
                        // Thread line
                        VStack(spacing: 0) {
                            Circle()
                                .fill(Color.accentColor)
                                .frame(width: 8, height: 8)
                            if index < composeState.threadPosts.count - 1 {
                                Rectangle()
                                    .fill(Color.accentColor.opacity(0.3))
                                    .frame(width: 2)
                            }
                        }
                        .padding(.top, 8)

                        VStack(spacing: 8) {
                            ThreadPostEditor(
                                index: index,
                                text: Binding(
                                    get: { composeState.threadPosts[safe: index]?.text ?? "" },
                                    set: { composeState.updateThreadPost(at: index, text: $0) }
                                ),
                                isEnabled: !composeState.isPosting,
                                onTextChange: { newText in
                                    onUpdateThreadPost(index, newText)
                                }
                            )

                            // Thread post actions
                            HStack {
                                // Add image to this thread post
                                Button(action: { onThreadImagePicker(index) }) {
                                    Image(systemName: "photo")
                                        .font(.body)
                                        .foregroundColor(.secondary)
                                }
                                .frame(width: 32, height: 32)

                                Spacer()

                                // Remove post (if more than 1)
                                if composeState.threadPosts.count > 1 {
                                    Button(action: { onRemoveThreadPost(index) }) {
                                        Image(systemName: "trash")
                                            .font(.subheadline)
                                            .foregroundColor(.red.opacity(0.7))
                                    }
                                    .frame(width: 32, height: 32)
                                }
                            }
                        }
                        .padding(.trailing, 8)
                    }
                    .padding(.horizontal, 16)
                }

                // Add post button
                Button(action: onAddThreadPost) {
                    HStack(spacing: 8) {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                        Text("Add to thread")
                            .font(.subheadline.weight(.medium))
                    }
                    .foregroundColor(.accentColor)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 16)
                }
            }
            .padding(.vertical, 8)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Quote Preview

    private func quotePreviewView(_ context: QuoteContext) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(context.authorDisplayName ?? context.authorHandle)
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("@\(context.authorHandle)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            Text(context.text)
                .font(.footnote)
                .foregroundColor(.secondary)
                .lineLimit(3)
        }
        .padding(12)
        .background(Color(UIColor.secondarySystemGroupedBackground))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color(.systemGray4), lineWidth: 0.5)
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
    }

    // MARK: - Helpers

    private var placeholderText: String {
        if composeState.replyContext != nil { return "Post your reply" }
        if composeState.quoteContext != nil { return "Add your thoughts" }
        return "What's happening?"
    }

}

// MARK: - Safe Array Access

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Preview

#if DEBUG
struct ComposeView_Previews: PreviewProvider {
    static var previews: some View {
        ComposeView(
            composeState: NativeComposeState(),
            onClose: {},
            onPost: {},
            onSaveDraft: {},
            onOpenDrafts: {},
            onImagePicker: {},
            onVideoPicker: {},
            onGifPicker: {},
            onEmojiPicker: {},
            onLanguagePicker: {},
            onRemoveMedia: { _ in },
            onEditAltText: { _ in },
            onGenerateAltText: { _ in },
            onSaveAltText: { _, _ in },
            onToggleThreadMode: {},
            onAddThreadPost: {},
            onRemoveThreadPost: { _ in },
            onUpdateThreadPost: { _, _ in },
            onMentionSearch: { _ in },
            onThreadImagePicker: { _ in }
        )
    }
}
#endif
