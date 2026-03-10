//
//  ComposeToolbarView.swift
//  NativeCompose
//
//  Bottom toolbar with media buttons, language picker, and character count.
//

import SwiftUI

// MARK: - Compose Toolbar

struct ComposeToolbarView: View {
    let charCount: Int
    let maxLength: Int
    let isThreadMode: Bool
    let hasImages: Bool
    let hasVideo: Bool
    let imageCount: Int
    let selectedLanguages: [String]
    let isReply: Bool
    let isQuote: Bool

    let onImagePicker: () -> Void
    let onVideoPicker: () -> Void
    let onGifPicker: () -> Void
    let onEmojiPicker: () -> Void
    let onToggleThreadMode: () -> Void
    let onLanguagePicker: () -> Void

    private var isOverLimit: Bool { charCount > maxLength }

    var body: some View {
        if isThreadMode {
            threadModeToolbar
        } else {
            standardToolbar
        }
    }

    // MARK: - Standard Toolbar

    private var standardToolbar: some View {
        HStack {
            // Media buttons
            HStack(spacing: 16) {
                toolbarButton(
                    icon: "photo",
                    label: "Add photo",
                    disabled: imageCount >= 4 || hasVideo,
                    action: onImagePicker
                )

                toolbarButton(
                    icon: "video",
                    label: "Add video",
                    disabled: hasImages || hasVideo,
                    action: onVideoPicker
                )

                gifButton(
                    disabled: hasImages || hasVideo,
                    action: onGifPicker
                )

                toolbarButton(
                    icon: "face.smiling",
                    label: "Add emoji",
                    disabled: false,
                    action: onEmojiPicker
                )

                // Thread mode toggle (not available for replies/quotes)
                if !isReply && !isQuote {
                    toolbarButton(
                        icon: "text.line.first.and.arrowtriangle.forward",
                        label: "Thread mode",
                        disabled: false,
                        action: onToggleThreadMode
                    )
                }

                // Language picker
                Button(action: onLanguagePicker) {
                    HStack(spacing: 4) {
                        Image(systemName: "globe")
                            .font(.body)
                        Text(languageLabel)
                            .font(.caption.weight(.semibold))
                    }
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .cornerRadius(12)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(.systemGray4), lineWidth: 0.5)
                    )
                }
                .accessibilityLabel("Language: \(languageLabel)")
            }

            Spacer()

            // Character count
            Text("\(charCount)/\(maxLength)")
                .font(.subheadline.weight(.medium))
                .foregroundColor(isOverLimit ? .red : .secondary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(UIColor.systemBackground))
        .overlay(
            Divider(), alignment: .top
        )
    }

    // MARK: - Thread Mode Toolbar

    private var threadModeToolbar: some View {
        HStack {
            Button(action: onToggleThreadMode) {
                HStack(spacing: 8) {
                    Image(systemName: "text.line.first.and.arrowtriangle.forward")
                        .font(.title3)
                    Text("Exit Thread Mode")
                        .font(.subheadline.weight(.semibold))
                }
                .foregroundColor(.accentColor)
            }
            .padding(8)

            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(UIColor.systemBackground))
        .overlay(
            Divider(), alignment: .top
        )
    }

    // MARK: - Helpers

    private var languageLabel: String {
        if selectedLanguages.isEmpty { return "EN" }
        return selectedLanguages.map { $0.uppercased().prefix(2) }.joined(separator: ", ")
    }

    @ViewBuilder
    private func gifButton(disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text("GIF")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(disabled ? Color(.systemGray4) : .secondary)
                .frame(width: 30, height: 30)
                .contentShape(Rectangle())
        }
        .disabled(disabled)
        .accessibilityLabel("Add GIF")
    }

    @ViewBuilder
    private func toolbarButton(icon: String, label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(disabled ? Color(.systemGray4) : .secondary)
                .frame(width: 30, height: 30)
                .contentShape(Rectangle())
        }
        .disabled(disabled)
        .accessibilityLabel(label)
    }
}

// MARK: - Preview

#if DEBUG
struct ComposeToolbarView_Previews: PreviewProvider {
    static var previews: some View {
        VStack {
            Spacer()
            ComposeToolbarView(
                charCount: 42,
                maxLength: 300,
                isThreadMode: false,
                hasImages: false,
                hasVideo: false,
                imageCount: 0,
                selectedLanguages: ["en"],
                isReply: false,
                isQuote: false,
                onImagePicker: {},
                onVideoPicker: {},
                onGifPicker: {},
                onEmojiPicker: {},
                onToggleThreadMode: {},
                onLanguagePicker: {}
            )
        }
    }
}
#endif
