//
//  ComposeView.swift
//  NativeCompose
//
//  Main SwiftUI compose view with text input, media grid, toolbar, and keyboard handling.
//  Bridges events to JS for posting, media picking, and draft management.
//

import SwiftUI

// MARK: - ComposeView

struct ComposeView: View {
    @ObservedObject var composeState: NativeComposeState
    @StateObject private var mentionManager = ComposeMentionManager()

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

    @Environment(\.safeAreaInsets) private var safeAreaInsets

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

            // Mention suggestions
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
        .background(Color(UIColor.systemBackground))
        .onAppear {
            mentionManager.startObserving()
        }
        .onDisappear {
            mentionManager.stopObserving()
        }
        .onChange(of: mentionManager.suggestions) { newSuggestions in
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
                    .font(.system(size: 16))
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
                        .font(.system(size: 14, weight: .medium))
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
                    Text("Post")
                        .font(.system(size: 16, weight: .semibold))
                }
            }
            .frame(minWidth: 70, minHeight: 44)
            .background(composeState.canPost ? Color.accentColor : Color(UIColor.systemGray5))
            .foregroundColor(composeState.canPost ? .white : Color(UIColor.systemGray2))
            .cornerRadius(20)
            .disabled(!composeState.canPost)
            .accessibilityLabel("Post")
            .accessibilityHint(composeState.canPost ? "Post your content" : "Cannot post: content is empty or over the character limit")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .overlay(
            Divider(), alignment: .bottom
        )
    }

    // MARK: - Reply Context

    private func replyContextView(_ context: ReplyContext) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Replying to @\(context.authorHandle)")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.secondary)

            HStack(alignment: .top, spacing: 8) {
                // Avatar
                if let avatarUrl = context.authorAvatar, let url = URL(string: avatarUrl) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image.resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 36, height: 36)
                                .clipShape(Circle())
                        default:
                            defaultAvatarSmall
                        }
                    }
                    .frame(width: 36, height: 36)
                } else {
                    defaultAvatarSmall
                }

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(context.authorDisplayName ?? context.authorHandle)
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.primary)
                            .lineLimit(1)
                        Text("@\(context.authorHandle)")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                            .lineLimit(1)
                    }
                    Text(context.text)
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .overlay(
            Divider(), alignment: .bottom
        )
    }

    // MARK: - Single Post Content

    private var singlePostContent: some View {
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
                                        .font(.system(size: 16))
                                        .foregroundColor(.secondary)
                                }
                                .frame(width: 32, height: 32)

                                Spacer()

                                // Remove post (if more than 1)
                                if composeState.threadPosts.count > 1 {
                                    Button(action: { onRemoveThreadPost(index) }) {
                                        Image(systemName: "trash")
                                            .font(.system(size: 14))
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
                            .font(.system(size: 20))
                        Text("Add to thread")
                            .font(.system(size: 14, weight: .medium))
                    }
                    .foregroundColor(.accentColor)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 16)
                }
            }
            .padding(.vertical, 8)
        }
    }

    // MARK: - Quote Preview

    private func quotePreviewView(_ context: QuoteContext) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Text(context.authorDisplayName ?? context.authorHandle)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text("@\(context.authorHandle)")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            Text(context.text)
                .font(.system(size: 13))
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

    private var defaultAvatarSmall: some View {
        Image(systemName: "person.circle.fill")
            .resizable()
            .frame(width: 36, height: 36)
            .foregroundColor(.secondary)
    }
}

// MARK: - Safe Array Access

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - SafeAreaInsets Environment Key

private struct SafeAreaInsetsKey: EnvironmentKey {
    static let defaultValue: EdgeInsets = EdgeInsets()
}

extension EnvironmentValues {
    var safeAreaInsets: EdgeInsets {
        get { self[SafeAreaInsetsKey.self] }
        set { self[SafeAreaInsetsKey.self] = newValue }
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
