//
//  PostTranslationManager.swift
//  NativeThreadView
//
//  Manages inline post translation state, language detection, and caching.
//  Translation API calls are delegated to JS via bridge events; this manager
//  handles display state and caches results so re-scrolling doesn't re-translate.
//

import Foundation
import SwiftUI

// MARK: - Translation State

/// Per-post translation state
enum TranslationState: Equatable {
    case idle
    case loading
    case translated(text: String, sourceLang: String)
    case error(message: String)
}

// MARK: - Language Utilities

enum LanguageUtils {
    /// Get the device's preferred language as a 2-letter ISO 639-1 code.
    static var deviceLanguage: String {
        let lang = Locale.preferredLanguages.first ?? "en"
        return String(lang.prefix(2)).lowercased()
    }

    /// Determine if a post needs translation based on its `langs` field.
    static func needsTranslation(postLangs: [String]?) -> Bool {
        guard let langs = postLangs, !langs.isEmpty else {
            return false
        }
        let deviceLang = deviceLanguage
        return !langs.contains { lang in
            let code = String(lang.split(separator: "-").first ?? "").lowercased()
            return code == deviceLang
        }
    }

    /// Get a human-readable language name from an ISO 639-1 code.
    static func languageName(for code: String) -> String {
        let langCode = String(code.split(separator: "-").first ?? "").lowercased()
        let names: [String: String] = [
            "af": "Afrikaans", "ar": "Arabic", "bg": "Bulgarian",
            "bn": "Bengali", "ca": "Catalan", "cs": "Czech",
            "da": "Danish", "de": "German", "el": "Greek",
            "en": "English", "es": "Spanish", "et": "Estonian",
            "fa": "Persian", "fi": "Finnish", "fr": "French",
            "gu": "Gujarati", "he": "Hebrew", "hi": "Hindi",
            "hr": "Croatian", "hu": "Hungarian", "id": "Indonesian",
            "it": "Italian", "ja": "Japanese", "kn": "Kannada",
            "ko": "Korean", "lt": "Lithuanian", "lv": "Latvian",
            "mk": "Macedonian", "ml": "Malayalam", "mr": "Marathi",
            "ms": "Malay", "nb": "Norwegian", "nl": "Dutch",
            "no": "Norwegian", "pl": "Polish", "pt": "Portuguese",
            "ro": "Romanian", "ru": "Russian", "sk": "Slovak",
            "sl": "Slovenian", "sq": "Albanian", "sr": "Serbian",
            "sv": "Swedish", "sw": "Swahili", "ta": "Tamil",
            "te": "Telugu", "th": "Thai", "tl": "Filipino",
            "tr": "Turkish", "uk": "Ukrainian", "ur": "Urdu",
            "vi": "Vietnamese", "zh": "Chinese",
        ]
        return names[langCode] ?? langCode.uppercased()
    }
}

// MARK: - Post Translation Manager

/// Singleton manager that caches translation results and manages per-post state.
/// Translation requests are sent to JS via bridge events; results arrive via
/// NotificationCenter and are cached here.
///
/// Note: This is NOT an ObservableObject. Views should use `PostTranslationObserver`
/// to subscribe to changes for a specific post URI, avoiding global re-renders.
class PostTranslationManager {
    static let shared = PostTranslationManager()

    /// Cached translations keyed by post URI
    private(set) var translations: [String: TranslationState] = [:]

    /// Whether the user is viewing translation (vs. original) per post URI
    private(set) var showingTranslation: [String: Bool] = [:]

    /// Posted when a specific post's translation state changes.
    /// `userInfo` contains `"postUri"` key.
    static let stateDidChangeNotification = NSNotification.Name("PostTranslationStateDidChange")

    private var translationObserver: NSObjectProtocol?

    private init() {
        startObserving()
    }

    deinit {
        if let observer = translationObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    // MARK: - Public API

    /// Get the translation state for a post.
    func state(for postUri: String) -> TranslationState {
        return translations[postUri] ?? .idle
    }

    /// Whether translation is currently being shown for a post.
    func isShowingTranslation(for postUri: String) -> Bool {
        return showingTranslation[postUri] ?? false
    }

    /// Mark a post as loading translation (user tapped Translate).
    func requestTranslation(for postUri: String) {
        translations[postUri] = .loading
        notifyChange(for: postUri)
    }

    /// Toggle between showing translated/original text.
    func toggleTranslation(for postUri: String) {
        let current = showingTranslation[postUri] ?? false
        showingTranslation[postUri] = !current
        notifyChange(for: postUri)
    }

    // MARK: - Internal

    private func notifyChange(for postUri: String) {
        NotificationCenter.default.post(
            name: Self.stateDidChangeNotification,
            object: nil,
            userInfo: ["postUri": postUri]
        )
    }

    // MARK: - Observation

    /// Listen for translation results from JS (via NotificationCenter).
    private func startObserving() {
        translationObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ThreadTranslationResult"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let info = notification.userInfo,
                  let postUri = info["postUri"] as? String else { return }

            if let translatedText = info["translatedText"] as? String,
               let sourceLang = info["sourceLang"] as? String {
                self?.translations[postUri] = .translated(text: translatedText, sourceLang: sourceLang)
                self?.showingTranslation[postUri] = true
            } else if let errorMessage = info["error"] as? String {
                self?.translations[postUri] = .error(message: errorMessage)
            }
            self?.notifyChange(for: postUri)
        }
    }
}

// MARK: - Per-Post Translation Observer

/// Lightweight per-post observer that only triggers SwiftUI re-renders when
/// the translation state for its specific post URI changes. This replaces
/// the previous pattern of using `@ObservedObject` on the shared singleton,
/// which caused every `PostTranslationView` in the thread to re-render
/// whenever *any* post's translation state changed.
class PostTranslationObserver: ObservableObject {
    let postUri: String
    @Published private(set) var translationState: TranslationState = .idle
    @Published private(set) var isShowing: Bool = false

    private var observer: NSObjectProtocol?

    init(postUri: String) {
        self.postUri = postUri
        // Read initial state
        let manager = PostTranslationManager.shared
        self.translationState = manager.state(for: postUri)
        self.isShowing = manager.isShowingTranslation(for: postUri)

        // Subscribe to changes for this post only
        observer = NotificationCenter.default.addObserver(
            forName: PostTranslationManager.stateDidChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let self = self,
                  let changedUri = notification.userInfo?["postUri"] as? String,
                  changedUri == self.postUri else { return }
            self.translationState = manager.state(for: self.postUri)
            self.isShowing = manager.isShowingTranslation(for: self.postUri)
        }
    }

    deinit {
        if let observer = observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }
}
