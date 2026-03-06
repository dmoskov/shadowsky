//
//  VerifiedBadge.swift
//  ExpoSwiftUIFeed
//
//  Verification badge component matching Bluesky's visual language.
//  Shows a blue checkmark circle next to verified account names.
//

import SwiftUI

/// A blue verification checkmark badge matching Bluesky's visual language
public struct VerifiedBadge: View {
    public enum Size {
        case small   // For compact rows (notifications, search)
        case medium  // For post cards
        case large   // For profile headers

        var iconSize: CGFloat {
            switch self {
            case .small: return 14
            case .medium: return 16
            case .large: return 20
            }
        }
    }

    let size: Size

    public init(size: Size = .medium) {
        self.size = size
    }

    public var body: some View {
        Image(systemName: "checkmark.seal.fill")
            .font(.system(size: size.iconSize))
            .foregroundColor(Color(red: 0.11, green: 0.63, blue: 0.95)) // Bluesky blue
            .accessibilityLabel("Verified account")
    }
}
