import SwiftUI

// MARK: - Optional String Helpers

public extension Optional where Wrapped == String {
    /// Returns the string if it's non-nil and non-empty, otherwise returns the fallback.
    /// Use instead of `??` when the upstream value could be an empty string `""`.
    ///
    ///     displayName.orIfEmpty(handle)   // "" → handle, nil → handle, "Alice" → "Alice"
    ///
    func orIfEmpty(_ fallback: String) -> String {
        if let value = self, !value.isEmpty {
            return value
        }
        return fallback
    }

    /// Returns the string if it's non-nil and non-empty, otherwise nil.
    var presence: String? {
        if let value = self, !value.isEmpty {
            return value
        }
        return nil
    }
}

// MARK: - View Compatibility

extension View {
    /// Compatibility wrapper for `.onChange(of:)` that works on both iOS 16 and iOS 17+.
    /// On iOS 17+, uses the new two-parameter closure to avoid deprecation warnings.
    /// On iOS 16, uses the single-parameter closure form.
    @ViewBuilder
    func onChangeCompat<V: Equatable>(of value: V, perform action: @escaping (V) -> Void) -> some View {
        if #available(iOS 17.0, *) {
            self.onChange(of: value) { _, newValue in action(newValue) }
        } else {
            self.onChange(of: value) { newValue in action(newValue) }
        }
    }
}
