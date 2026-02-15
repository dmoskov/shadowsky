import ExpoModulesCore
import FeedBridge
import SwiftUI

// MARK: - Module Definition

public class RichTextViewModule: Module {
    public func definition() -> ModuleDefinition {
        Name("RichTextView")

        // View component
        View(RichTextViewWrapper.self) {
            // Props
            Prop("text") { (view: RichTextViewWrapper, text: String) in
                view.text = text
            }

            Prop("facets") { (view: RichTextViewWrapper, facetsJson: String?) in
                view.setFacets(facetsJson)
            }

            // Events
            Events("onMentionPress", "onHashtagPress", "onLinkPress")
        }
    }
}

// MARK: - UIView Wrapper

/// UIView wrapper that hosts the SwiftUI RichTextView
class RichTextViewWrapper: ExpoView {
    var text: String = "" {
        didSet {
            updateView()
        }
    }

    private var facets: [Facet] = []

    // Event dispatchers
    private let onMentionPress = EventDispatcher()
    private let onHashtagPress = EventDispatcher()
    private let onLinkPress = EventDispatcher()

    private var hostingController: UIHostingController<RichTextView>?

    required init(appContext: AppContext? = nil) {
        super.init(appContext: appContext)
        setupView()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setupView() {
        updateView()
    }

    func setFacets(_ facetsJson: String?) {
        guard let facetsJson = facetsJson,
              let data = facetsJson.data(using: .utf8) else {
            self.facets = []
            updateView()
            return
        }

        do {
            let decoder = JSONDecoder()
            self.facets = try decoder.decode([Facet].self, from: data)
            updateView()
        } catch {
            print("[RichTextView] Failed to decode facets: \(error)")
            self.facets = []
            updateView()
        }
    }

    private func updateView() {
        // Remove old hosting controller
        if let oldController = hostingController {
            oldController.view.removeFromSuperview()
            oldController.willMove(toParent: nil)
            oldController.removeFromParent()
        }

        // Create SwiftUI view
        let richTextView = RichTextView(
            text: text,
            facets: facets,
            onMentionTap: { [weak self] handle, did in
                self?.onMentionPress([
                    "handle": handle,
                    "did": did
                ])
            },
            onHashtagTap: { [weak self] tag in
                self?.onHashtagPress([
                    "tag": tag
                ])
            },
            onLinkTap: { [weak self] uri in
                self?.onLinkPress([
                    "uri": uri
                ])
            }
        )

        // Create hosting controller
        let controller = UIHostingController(rootView: richTextView)
        controller.view.backgroundColor = UIColor.clear
        self.hostingController = controller

        // Add to view hierarchy
        addSubview(controller.view)
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            controller.view.topAnchor.constraint(equalTo: topAnchor),
            controller.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            controller.view.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }
}
