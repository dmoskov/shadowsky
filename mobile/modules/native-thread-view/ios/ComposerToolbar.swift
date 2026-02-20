//
//  ComposerToolbar.swift
//  NativeThreadView
//
//  Toolbar row with photo picker, GIF picker, and emoji picker buttons.
//  Each button triggers a bridge event to open the corresponding JS modal.
//

import SwiftUI

// MARK: - ComposerToolbarView

struct ComposerToolbarView: View {
    let onImagePicker: () -> Void
    let onGifPicker: () -> Void
    let onEmojiPicker: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            toolbarButton(
                icon: "photo",
                label: "Add photo",
                hint: "Opens the photo picker",
                action: onImagePicker
            )

            toolbarButton(
                icon: "gift",  // closest SF Symbol for GIF
                label: "Add GIF",
                hint: "Opens the GIF picker",
                action: onGifPicker
            )

            toolbarButton(
                icon: "face.smiling",
                label: "Add emoji",
                hint: "Opens the emoji picker",
                action: onEmojiPicker
            )
        }
    }

    // MARK: - Toolbar Button

    private func toolbarButton(
        icon: String,
        label: String,
        hint: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundColor(.secondary)
                .frame(width: 36, height: 36)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(label)
        .accessibilityHint(hint)
    }
}

// MARK: - Preview

#if DEBUG
struct ComposerToolbarView_Previews: PreviewProvider {
    static var previews: some View {
        ComposerToolbarView(
            onImagePicker: {},
            onGifPicker: {},
            onEmojiPicker: {}
        )
        .padding()
        .previewLayout(.sizeThatFits)
    }
}
#endif
