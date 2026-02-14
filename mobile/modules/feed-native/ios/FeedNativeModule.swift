import ExpoModulesCore

public class FeedNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FeedNative")

    View(FeedNativeView.self) {
      Prop("message") { (view: FeedNativeView, message: String?) in
        view.message = message ?? "Hello from SwiftUI"
      }
    }
  }
}
