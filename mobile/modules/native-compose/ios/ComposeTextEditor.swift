//
//  ComposeTextEditor.swift
//  NativeCompose
//
//  Auto-growing text editor for compose screen with mention detection.
//  Uses native UITextView for performant keyboard handling.
//

import SwiftUI
import UIKit

// MARK: - ComposeTextEditor

struct ComposeTextEditor: View {
    @Binding var text: String
    let placeholder: String
    let isEnabled: Bool
    var onTextChange: ((String) -> Void)?

    @FocusState private var isFocused: Bool

    var body: some View {
        ZStack(alignment: .topLeading) {
            // Placeholder
            if text.isEmpty {
                Text(placeholder)
                    .foregroundColor(Color(.placeholderText))
                    .font(.title3)
                    .padding(.horizontal, 16)
                    .padding(.top, 16)
                    .allowsHitTesting(false)
            }

            // Text editor
            TextEditor(text: $text)
                .font(.title3)
                .padding(.horizontal, 12)
                .padding(.top, 8)
                .focused($isFocused)
                .disabled(!isEnabled)
                .modifier(HideScrollContentBackground())
                .onChangeCompat(of: text) { newValue in
                    onTextChange?(newValue)
                }
                .onAppear {
                    isFocused = true
                }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Thread Post Text Editor

/// Compact text editor for individual thread posts
struct ThreadPostEditor: View {
    let index: Int
    @Binding var text: String
    let isEnabled: Bool
    var onTextChange: ((String) -> Void)?

    @FocusState private var isFocused: Bool

    private let maxChars = 300

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Post number label
            HStack {
                Text("Post \(index + 1)")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
                Spacer()
                // Character count
                Text("\(text.count)/\(maxChars)")
                    .font(.caption2)
                    .foregroundColor(text.count > maxChars ? .red : .secondary)
            }
            .padding(.horizontal, 4)

            ZStack(alignment: .topLeading) {
                if text.isEmpty {
                    Text(index == 0 ? "Start your thread..." : "Continue thread...")
                        .foregroundColor(Color(.placeholderText))
                        .font(.body)
                        .padding(.horizontal, 8)
                        .padding(.top, 10)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $text)
                    .font(.body)
                    .frame(minHeight: 60, maxHeight: 120)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 2)
                    .disabled(!isEnabled)
                    .modifier(HideScrollContentBackground())
                    .onChangeCompat(of: text) { newValue in
                        onTextChange?(newValue)
                    }
            }
            .background(Color(UIColor.secondarySystemGroupedBackground))
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(text.count > maxChars ? Color.red.opacity(0.5) : Color(.systemGray4), lineWidth: 0.5)
            )
        }
    }
}

// MARK: - Compatibility Modifier

/// Hides the default TextEditor background on iOS 16+, no-op on iOS 15
struct HideScrollContentBackground: ViewModifier {
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
struct ComposeTextEditor_Previews: PreviewProvider {
    static var previews: some View {
        ComposeTextEditor(
            text: .constant(""),
            placeholder: "What's happening?",
            isEnabled: true
        )
        .frame(height: 200)
        .background(Color(UIColor.systemBackground))
    }
}
#endif
