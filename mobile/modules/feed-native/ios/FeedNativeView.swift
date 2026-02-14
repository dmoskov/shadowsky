import ExpoModulesCore
import SwiftUI

class FeedNativeView: ExpoView {
  var message: String = "Hello from SwiftUI" {
    didSet {
      updateHostingController()
    }
  }

  private var hostingController: UIHostingController<FeedSwiftUIView>?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    setupSwiftUIView()
  }

  private func setupSwiftUIView() {
    let swiftUIView = FeedSwiftUIView(message: message)
    let hostingController = UIHostingController(rootView: swiftUIView)
    self.hostingController = hostingController

    // Add the hosting controller's view as a subview
    if let hostedView = hostingController.view {
      hostedView.backgroundColor = .clear
      hostedView.translatesAutoresizingMaskIntoConstraints = false
      addSubview(hostedView)

      NSLayoutConstraint.activate([
        hostedView.topAnchor.constraint(equalTo: topAnchor),
        hostedView.bottomAnchor.constraint(equalTo: bottomAnchor),
        hostedView.leadingAnchor.constraint(equalTo: leadingAnchor),
        hostedView.trailingAnchor.constraint(equalTo: trailingAnchor)
      ])
    }
  }

  private func updateHostingController() {
    hostingController?.rootView = FeedSwiftUIView(message: message)
  }
}

// The actual SwiftUI view
struct FeedSwiftUIView: View {
  let message: String

  var body: some View {
    VStack(spacing: 16) {
      Text(message)
        .font(.title)
        .fontWeight(.bold)
        .foregroundColor(.blue)

      Text("This is a native SwiftUI view")
        .font(.body)
        .foregroundColor(.secondary)

      HStack(spacing: 12) {
        Image(systemName: "swift")
          .font(.system(size: 40))
          .foregroundColor(.orange)

        Image(systemName: "arrow.right")
          .font(.system(size: 24))
          .foregroundColor(.gray)

        Image(systemName: "apps.iphone")
          .font(.system(size: 40))
          .foregroundColor(.blue)
      }
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(
      LinearGradient(
        gradient: Gradient(colors: [
          Color.blue.opacity(0.1),
          Color.purple.opacity(0.1)
        ]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    )
    .cornerRadius(12)
  }
}
