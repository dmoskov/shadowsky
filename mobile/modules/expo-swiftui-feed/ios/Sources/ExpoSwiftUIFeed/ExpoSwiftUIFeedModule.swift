import ExpoModulesCore
import SwiftUI
import SDWebImage

public class ExpoSwiftUIFeedModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoSwiftUIFeed")

    OnCreate {
      // Clear SDWebImage memory cache when the app enters background.
      // This complements the 100MB memory cap in CachedAsyncImage and
      // mirrors the expo-image cleanup in useImageMemoryManagement.ts.
      // Disk cache remains intact for fast reload on foreground.
      NotificationCenter.default.addObserver(
        forName: UIApplication.didEnterBackgroundNotification,
        object: nil,
        queue: .main
      ) { _ in
        SDImageCache.shared.clearMemory()
      }

      // Also clear on memory warning to reduce OOM kill risk
      NotificationCenter.default.addObserver(
        forName: UIApplication.didReceiveMemoryWarningNotification,
        object: nil,
        queue: .main
      ) { _ in
        SDImageCache.shared.clearMemory()
      }
    }

    // Module functionality will be exposed through view components
    // The SwiftUI views will be used directly from React Native
  }
}
