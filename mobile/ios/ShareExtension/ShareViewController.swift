//
// ShareViewController.swift
// ShareExtension
//
// Handles incoming shared content from other apps and opens the main app
//

import UIKit
import Social
import UniformTypeIdentifiers
import MobileCoreServices

class ShareViewController: UIViewController {

    private let appGroupId = "group.io.asphodel.app"
    private let appScheme = "shadowsky"

    override func viewDidLoad() {
        super.viewDidLoad()
        handleSharedContent()
    }

    private func handleSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            close()
            return
        }

        // Collect all attachments from all items
        var allAttachments: [NSItemProvider] = []
        for item in extensionItems {
            if let attachments = item.attachments {
                allAttachments.append(contentsOf: attachments)
            }
        }

        if allAttachments.isEmpty {
            close()
            return
        }

        processAttachments(allAttachments)
    }

    private func processAttachments(_ attachments: [NSItemProvider]) {
        var sharedUrl: String?
        var sharedText: String?
        var sharedImages: [String] = []
        let group = DispatchGroup()

        for attachment in attachments {
            // Check for URL
            if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                group.enter()
                attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { item, error in
                    defer { group.leave() }
                    if let url = item as? URL {
                        // Check if it's a file URL (image) or a web URL
                        if url.isFileURL {
                            if let imagePath = self.saveImageFromFileURL(url) {
                                sharedImages.append(imagePath)
                            }
                        } else {
                            sharedUrl = url.absoluteString
                        }
                    }
                }
            }
            // Check for plain text
            else if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                group.enter()
                attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { item, error in
                    defer { group.leave() }
                    if let text = item as? String {
                        // If it looks like a URL, treat it as a URL
                        if let url = URL(string: text), url.scheme?.hasPrefix("http") == true {
                            if sharedUrl == nil {
                                sharedUrl = text
                            }
                        } else {
                            if sharedText == nil {
                                sharedText = text
                            } else {
                                sharedText = (sharedText ?? "") + "\n" + text
                            }
                        }
                    }
                }
            }
            // Check for images
            else if attachment.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                group.enter()
                attachment.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { item, error in
                    defer { group.leave() }
                    if let url = item as? URL {
                        if let imagePath = self.saveImageFromFileURL(url) {
                            sharedImages.append(imagePath)
                        }
                    } else if let image = item as? UIImage {
                        if let imagePath = self.saveImage(image) {
                            sharedImages.append(imagePath)
                        }
                    } else if let data = item as? Data {
                        if let image = UIImage(data: data) {
                            if let imagePath = self.saveImage(image) {
                                sharedImages.append(imagePath)
                            }
                        }
                    }
                }
            }
        }

        group.notify(queue: .main) {
            self.openMainApp(url: sharedUrl, text: sharedText, images: sharedImages)
        }
    }

    // MARK: - Image Handling

    private func saveImageFromFileURL(_ url: URL) -> String? {
        guard let data = try? Data(contentsOf: url),
              let image = UIImage(data: data) else {
            return nil
        }
        return saveImage(image)
    }

    private func saveImage(_ image: UIImage) -> String? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId
        ) else {
            return nil
        }

        let sharedDir = containerURL.appendingPathComponent("shared-images", isDirectory: true)
        try? FileManager.default.createDirectory(at: sharedDir, withIntermediateDirectories: true)

        let filename = UUID().uuidString + ".jpg"
        let fileURL = sharedDir.appendingPathComponent(filename)

        guard let data = image.jpegData(compressionQuality: 0.85) else {
            return nil
        }

        do {
            try data.write(to: fileURL)
            return filename
        } catch {
            return nil
        }
    }

    // MARK: - App Opening

    private func openMainApp(url: String?, text: String?, images: [String]) {
        // Save shared data to App Group UserDefaults for the main app to read
        if let userDefaults = UserDefaults(suiteName: appGroupId) {
            var sharedData: [String: Any] = [:]

            if let url = url {
                sharedData["url"] = url
            }
            if let text = text {
                sharedData["text"] = text
            }
            if !images.isEmpty {
                sharedData["images"] = images
            }
            sharedData["timestamp"] = Date().timeIntervalSince1970

            userDefaults.set(sharedData, forKey: "SharedContent")
            userDefaults.synchronize()
        }

        // Build the deep link URL
        var components = URLComponents()
        components.scheme = appScheme
        components.host = "compose"

        var queryItems: [URLQueryItem] = []
        if let url = url {
            queryItems.append(URLQueryItem(name: "url", value: url))
        }
        if let text = text {
            queryItems.append(URLQueryItem(name: "text", value: text))
        }
        if !images.isEmpty {
            queryItems.append(URLQueryItem(name: "hasImages", value: "true"))
        }
        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let deepLinkURL = components.url else {
            close()
            return
        }

        // Open the main app via URL scheme
        // Share Extensions can't use UIApplication.shared, so we use the responder chain
        openURL(deepLinkURL)

        // Close the extension
        close()
    }

    @objc
    private func openURL(_ url: URL) {
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = responder?.next
        }

        // Fallback: use the selector-based approach
        let selector = NSSelectorFromString("openURL:")
        var currentResponder: UIResponder? = self
        while currentResponder != nil {
            if currentResponder!.responds(to: selector) {
                currentResponder!.perform(selector, with: url)
                return
            }
            currentResponder = currentResponder?.next
        }
    }

    private func close() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
