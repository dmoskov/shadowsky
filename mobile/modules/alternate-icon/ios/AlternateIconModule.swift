//
//  AlternateIconModule.swift
//
//  Native Expo module for iOS alternate app icons.
//  Uses UIApplication.shared.setAlternateIconName(_:)
//

import ExpoModulesCore
import UIKit

public class AlternateIconModule: Module {
    public func definition() -> ModuleDefinition {
        Name("AlternateIconModule")

        Function("supportsAlternateIcons") { () -> Bool in
            return UIApplication.shared.supportsAlternateIcons
        }

        Function("getAlternateIconName") { () -> String? in
            return UIApplication.shared.alternateIconName
        }

        AsyncFunction("setAlternateIcon") { (iconName: String?) in
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                DispatchQueue.main.async {
                    UIApplication.shared.setAlternateIconName(iconName) { error in
                        if let error = error {
                            continuation.resume(throwing: error)
                        } else {
                            continuation.resume()
                        }
                    }
                }
            }
        }
    }
}
