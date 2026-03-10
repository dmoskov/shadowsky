import SwiftUI

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

    /// Compatibility wrapper for `.scrollDismissesKeyboard(.interactively)`.
    /// Only available on iOS 16.0+; on earlier versions this is a no-op.
    @ViewBuilder
    func scrollDismissesKeyboardCompat() -> some View {
        if #available(iOS 16.0, *) {
            self.scrollDismissesKeyboard(.interactively)
        } else {
            self
        }
    }
}
