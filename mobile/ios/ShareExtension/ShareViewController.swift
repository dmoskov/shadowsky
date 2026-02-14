import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        handleSharedContent()
    }

    private func handleSharedContent() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let itemProvider = extensionItem.attachments?.first else {
            self.dismiss()
            return
        }

        // Check for URL first (most common case from Safari)
        if itemProvider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (item, error) in
                if let url = item as? URL {
                    self?.openAppWithContent(url: url.absoluteString, text: nil)
                } else if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
                    self?.openAppWithContent(url: url.absoluteString, text: nil)
                } else {
                    self?.dismiss()
                }
            }
        }
        // Check for plain text
        else if itemProvider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
            itemProvider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (item, error) in
                if let text = item as? String {
                    self?.openAppWithContent(url: nil, text: text)
                } else {
                    self?.dismiss()
                }
            }
        }
        // Fallback: try to get text from extension item
        else if let text = extensionItem.attributedContentText?.string {
            self.openAppWithContent(url: nil, text: text)
        }
        else {
            self.dismiss()
        }
    }

    private func openAppWithContent(url: String?, text: String?) {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "compose"

        var queryItems: [URLQueryItem] = []

        if let url = url {
            queryItems.append(URLQueryItem(name: "url", value: url))
        }

        if let text = text {
            queryItems.append(URLQueryItem(name: "text", value: text))
        }

        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let deepLinkURL = components.url else {
            self.dismiss()
            return
        }

        // Open the main app with the deep link
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(deepLinkURL, options: [:]) { [weak self] success in
                    self?.dismiss()
                }
                return
            }
            responder = responder?.next
        }

        // Fallback: use openURL on UIApplication
        self.extensionContext?.open(deepLinkURL, completionHandler: { [weak self] success in
            self?.dismiss()
        })
    }

    private func dismiss() {
        DispatchQueue.main.async { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
    }
}
