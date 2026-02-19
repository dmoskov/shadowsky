//
//  PostTranslationView.swift
//  NativeThreadView
//
//  SwiftUI view for inline post translation: translate button, loading state,
//  translated text display, and original/translated toggle.
//

import SwiftUI

// MARK: - Post Translation View

/// Inline translation UI shown below post text when the post language
/// differs from the device locale.
struct PostTranslationView: View {
    let postUri: String
    let postText: String
    let postLangs: [String]?
    let onTranslate: ((String, String, String) -> Void)? // (uri, text, sourceLang)

    @ObservedObject private var manager = PostTranslationManager.shared

    private var translationState: TranslationState {
        manager.state(for: postUri)
    }

    private var isShowing: Bool {
        manager.isShowingTranslation(for: postUri)
    }

    private var sourceLanguageName: String {
        guard let langs = postLangs, let first = langs.first else { return "" }
        return LanguageUtils.languageName(for: first)
    }

    private var sourceLangCode: String {
        guard let langs = postLangs, let first = langs.first else { return "auto" }
        return String(first.split(separator: "-").first ?? "auto").lowercased()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Translated text (shown inline below original)
            if isShowing, case .translated(let text, _) = translationState {
                translatedTextView(text)
            }

            // Error message
            if case .error(let message) = translationState {
                Text(message)
                    .font(.system(size: 12))
                    .foregroundColor(.red)
                    .accessibilityLabel("Translation error: \(message)")
            }

            // Translate / toggle button
            translateButton
        }
    }

    // MARK: - Translated Text

    private func translatedTextView(_ text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(text)
                .font(.system(size: 16))
                .foregroundColor(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)

            Text("Translated from \(sourceLanguageName)")
                .font(.system(size: 12))
                .foregroundColor(Color(UIColor.tertiaryLabel))
                .italic()
        }
        .padding(.leading, 12)
        .overlay(
            Rectangle()
                .fill(Color.accentColor)
                .frame(width: 2),
            alignment: .leading
        )
        .padding(.top, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Translated from \(sourceLanguageName): \(text)")
    }

    // MARK: - Translate Button

    @ViewBuilder
    private var translateButton: some View {
        switch translationState {
        case .loading:
            HStack(spacing: 6) {
                ProgressView()
                    .scaleEffect(0.7)
                Text("Translating...")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.accentColor)
            }
            .padding(.top, 2)
            .accessibilityLabel("Translating post")

        case .translated:
            Button(action: {
                manager.toggleTranslation(for: postUri)
            }) {
                HStack(spacing: 4) {
                    Image(systemName: "globe")
                        .font(.system(size: 13))
                    Text(isShowing ? "Show original" : "Show translation")
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundColor(.accentColor)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            .accessibilityLabel(isShowing ? "Show original text" : "Show translated text")
            .accessibilityHint("Double tap to toggle between original and translated text")

        case .error:
            Button(action: {
                requestTranslation()
            }) {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13))
                    Text("Retry translation")
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundColor(.accentColor)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            .accessibilityLabel("Retry translation")

        case .idle:
            Button(action: {
                requestTranslation()
            }) {
                HStack(spacing: 4) {
                    Image(systemName: "globe")
                        .font(.system(size: 13))
                    Text("Translate from \(sourceLanguageName)")
                        .font(.system(size: 13, weight: .medium))
                }
                .foregroundColor(.accentColor)
            }
            .buttonStyle(.plain)
            .padding(.top, 2)
            .accessibilityLabel("Translate from \(sourceLanguageName)")
            .accessibilityHint("Double tap to translate this post")
        }
    }

    // MARK: - Actions

    private func requestTranslation() {
        manager.requestTranslation(for: postUri)
        onTranslate?(postUri, postText, sourceLangCode)
    }
}
