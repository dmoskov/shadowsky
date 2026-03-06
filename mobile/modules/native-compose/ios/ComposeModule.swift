//
//  ComposeModule.swift
//  NativeCompose
//
//  Expo Module definition for the native SwiftUI compose screen.
//  Bridges props and events between React Native and SwiftUI.
//

import ExpoModulesCore
import SwiftUI

public class ComposeModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeCompose")

        // View component
        View(ComposeViewWrapper.self) {
            // Text content
            Prop("text") { (view: ComposeViewWrapper, text: String?) in
                view.composeState.text = text ?? ""
            }

            // Draft ID
            Prop("draftId") { (view: ComposeViewWrapper, draftId: String?) in
                view.composeState.draftId = draftId
            }

            // Selected languages (JSON array)
            Prop("selectedLanguages") { (view: ComposeViewWrapper, langs: String?) in
                if let langs = langs,
                   let data = langs.data(using: .utf8),
                   let parsed = try? JSONSerialization.jsonObject(with: data) as? [String] {
                    view.composeState.selectedLanguages = parsed
                }
            }

            // Media attachments (JSON array)
            Prop("mediaJson") { (view: ComposeViewWrapper, json: String?) in
                view.parseMediaJson(json)
            }

            // Reply context (JSON)
            Prop("replyToJson") { (view: ComposeViewWrapper, json: String?) in
                view.parseReplyJson(json)
            }

            // Quote context (JSON)
            Prop("quoteToJson") { (view: ComposeViewWrapper, json: String?) in
                view.parseQuoteJson(json)
            }

            // Thread mode
            Prop("isThreadMode") { (view: ComposeViewWrapper, isThread: Bool) in
                view.composeState.isThreadMode = isThread
            }

            // Thread posts (JSON array)
            Prop("threadPostsJson") { (view: ComposeViewWrapper, json: String?) in
                view.parseThreadPostsJson(json)
            }

            // Posting state
            Prop("isPosting") { (view: ComposeViewWrapper, isPosting: Bool) in
                view.composeState.isPosting = isPosting
            }

            Prop("isUploading") { (view: ComposeViewWrapper, isUploading: Bool) in
                view.composeState.isUploading = isUploading
            }

            Prop("isOffline") { (view: ComposeViewWrapper, isOffline: Bool) in
                view.composeState.isOffline = isOffline
            }

            // Events (native -> JS)
            Events(
                "onClose",
                "onPost",
                "onSaveDraft",
                "onOpenDrafts",
                "onTextChange",
                "onImagePicker",
                "onVideoPicker",
                "onGifPicker",
                "onEmojiPicker",
                "onLanguagePicker",
                "onRemoveMedia",
                "onEditAltText",
                "onGenerateAltText",
                "onSaveAltText",
                "onToggleThreadMode",
                "onAddThreadPost",
                "onRemoveThreadPost",
                "onUpdateThreadPost",
                "onMentionSearch",
                "onThreadImagePicker"
            )
        }

        // Receive mention search results from JS
        Function("setMentionSearchResults") { (resultsJson: String) in
            DispatchQueue.main.async {
                guard let data = resultsJson.data(using: .utf8),
                      let results = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
                    NotificationCenter.default.post(
                        name: ComposeMentionManager.mentionResultsNotification,
                        object: nil,
                        userInfo: ["results": [] as [[String: Any]]]
                    )
                    return
                }
                NotificationCenter.default.post(
                    name: ComposeMentionManager.mentionResultsNotification,
                    object: nil,
                    userInfo: ["results": results]
                )
            }
        }

        // Receive alt text generation result from JS
        Function("setGeneratedAltText") { (index: Int, altText: String) in
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("ComposeAltTextGenerated"),
                    object: nil,
                    userInfo: [
                        "index": index,
                        "altText": altText,
                    ]
                )
            }
        }

        // Notify that post was sent (or failed)
        Function("setPostResult") { (success: Bool, errorMessage: String?) in
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("ComposePostResult"),
                    object: nil,
                    userInfo: [
                        "success": success,
                        "error": errorMessage as Any,
                    ]
                )
            }
        }
    }
}

// MARK: - View Wrapper

class ComposeViewWrapper: ExpoView {
    let composeState = NativeComposeState()

    // Event dispatchers
    private let onClose = EventDispatcher()
    private let onPost = EventDispatcher()
    private let onSaveDraft = EventDispatcher()
    private let onOpenDrafts = EventDispatcher()
    private let onTextChange = EventDispatcher()
    private let onImagePicker = EventDispatcher()
    private let onVideoPicker = EventDispatcher()
    private let onGifPicker = EventDispatcher()
    private let onEmojiPicker = EventDispatcher()
    private let onLanguagePicker = EventDispatcher()
    private let onRemoveMedia = EventDispatcher()
    private let onEditAltText = EventDispatcher()
    private let onGenerateAltText = EventDispatcher()
    private let onSaveAltText = EventDispatcher()
    private let onToggleThreadMode = EventDispatcher()
    private let onAddThreadPost = EventDispatcher()
    private let onRemoveThreadPost = EventDispatcher()
    private let onUpdateThreadPost = EventDispatcher()
    private let onMentionSearch = EventDispatcher()
    private let onThreadImagePicker = EventDispatcher()

    // Observers
    private var postResultObserver: NSObjectProtocol?
    private var altTextObserver: NSObjectProtocol?
    private var textChangeObserver: AnyCancellable?

    private var hostingController: UIHostingController<ComposeView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
        setupObservers()
        setupTextChangeForwarding()
    }

    deinit {
        if let observer = postResultObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        if let observer = altTextObserver {
            NotificationCenter.default.removeObserver(observer)
        }
        textChangeObserver?.cancel()
    }

    // MARK: - Setup

    private func setupObservers() {
        postResultObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ComposePostResult"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let success = notification.userInfo?["success"] as? Bool else { return }
            if success {
                self?.composeState.isPosting = false
            } else {
                self?.composeState.isPosting = false
            }
        }

        altTextObserver = NotificationCenter.default.addObserver(
            forName: NSNotification.Name("ComposeAltTextGenerated"),
            object: nil,
            queue: .main
        ) { [weak self] notification in
            guard let index = notification.userInfo?["index"] as? Int,
                  let altText = notification.userInfo?["altText"] as? String else { return }
            self?.composeState.isGeneratingAltText = false
            self?.composeState.tempAltText = altText
            self?.composeState.updateAltText(at: index, altText: altText)
        }
    }

    private func setupTextChangeForwarding() {
        textChangeObserver = composeState.$text
            .dropFirst()
            .removeDuplicates()
            .sink { [weak self] newText in
                self?.onTextChange(["text": newText])
            }
    }

    private func setupView() {
        let composeView = createComposeView()
        let hostingController = UIHostingController(rootView: composeView)

        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        hostingController.view.backgroundColor = .clear

        addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        self.hostingController = hostingController
    }

    private func createComposeView() -> ComposeView {
        ComposeView(
            composeState: composeState,
            onClose: { [weak self] in
                self?.onClose([:])
            },
            onPost: { [weak self] in
                guard let self = self else { return }
                self.composeState.isPosting = true
                let postData = self.buildPostData()
                self.onPost(postData)
            },
            onSaveDraft: { [weak self] in
                guard let self = self else { return }
                let draftData = self.buildDraftData()
                self.onSaveDraft(draftData)
            },
            onOpenDrafts: { [weak self] in
                self?.onOpenDrafts([:])
            },
            onImagePicker: { [weak self] in
                self?.onImagePicker([:])
            },
            onVideoPicker: { [weak self] in
                self?.onVideoPicker([:])
            },
            onGifPicker: { [weak self] in
                self?.onGifPicker([:])
            },
            onEmojiPicker: { [weak self] in
                self?.onEmojiPicker([:])
            },
            onLanguagePicker: { [weak self] in
                self?.onLanguagePicker([:])
            },
            onRemoveMedia: { [weak self] index in
                self?.onRemoveMedia(["index": index])
            },
            onEditAltText: { [weak self] index in
                self?.onEditAltText(["index": index])
            },
            onGenerateAltText: { [weak self] index in
                self?.composeState.isGeneratingAltText = true
                self?.onGenerateAltText(["index": index])
            },
            onSaveAltText: { [weak self] index, text in
                self?.composeState.updateAltText(at: index, altText: text)
                self?.onSaveAltText(["index": index, "altText": text])
            },
            onToggleThreadMode: { [weak self] in
                self?.composeState.toggleThreadMode()
                self?.onToggleThreadMode([
                    "isThreadMode": self?.composeState.isThreadMode ?? false,
                ])
            },
            onAddThreadPost: { [weak self] in
                self?.composeState.addThreadPost()
                self?.onAddThreadPost([:])
            },
            onRemoveThreadPost: { [weak self] index in
                self?.composeState.removeThreadPost(at: index)
                self?.onRemoveThreadPost(["index": index])
            },
            onUpdateThreadPost: { [weak self] index, text in
                self?.onUpdateThreadPost(["index": index, "text": text])
            },
            onMentionSearch: { [weak self] query in
                self?.onMentionSearch(["query": query])
            },
            onThreadImagePicker: { [weak self] index in
                self?.onThreadImagePicker(["index": index])
            }
        )
    }

    // MARK: - JSON Parsing

    func parseMediaJson(_ json: String?) {
        guard let json = json,
              let data = json.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            composeState.mediaAttachments = []
            return
        }
        composeState.mediaAttachments = array.compactMap { MediaAttachment.fromDict($0) }
    }

    func parseReplyJson(_ json: String?) {
        guard let json = json,
              let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            composeState.replyContext = nil
            return
        }
        composeState.replyContext = ReplyContext.fromDict(dict)
    }

    func parseQuoteJson(_ json: String?) {
        guard let json = json,
              let data = json.data(using: .utf8),
              let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            composeState.quoteContext = nil
            return
        }
        composeState.quoteContext = QuoteContext.fromDict(dict)
    }

    func parseThreadPostsJson(_ json: String?) {
        guard let json = json,
              let data = json.data(using: .utf8),
              let array = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return
        }
        composeState.threadPosts = array.map { dict in
            ComposeThreadPost(
                id: dict["id"] as? String ?? UUID().uuidString,
                text: dict["text"] as? String ?? "",
                images: (dict["images"] as? [[String: Any]] ?? []).compactMap { MediaAttachment.fromDict($0) }
            )
        }
    }

    // MARK: - Data Building

    private func buildPostData() -> [String: Any] {
        var data: [String: Any] = [
            "text": composeState.text.trimmingCharacters(in: .whitespacesAndNewlines),
            "isThreadMode": composeState.isThreadMode,
        ]

        if !composeState.selectedLanguages.isEmpty {
            data["languages"] = composeState.selectedLanguages
        }

        if composeState.isThreadMode {
            let posts = composeState.threadPosts.map { post -> [String: Any] in
                [
                    "text": post.text.trimmingCharacters(in: .whitespacesAndNewlines),
                    "images": post.images.map { $0.toDict() },
                ]
            }
            data["threadPosts"] = posts
        }

        return data
    }

    private func buildDraftData() -> [String: Any] {
        var data: [String: Any] = [
            "text": composeState.text.trimmingCharacters(in: .whitespacesAndNewlines),
        ]
        if let draftId = composeState.draftId {
            data["draftId"] = draftId
        }
        return data
    }
}

// MARK: - Combine import

import Combine

// MARK: - AnyCancellable alias for the text observer
// (Combine is imported above for the $text publisher sink)
