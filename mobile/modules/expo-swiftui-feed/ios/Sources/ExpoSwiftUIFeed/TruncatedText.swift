import SwiftUI
import UIKit

/// A text view that shows a tappable "Show more" / "Show less" control when the
/// text exceeds `lineLimit`. Truncation is detected by comparing the capped
/// height against the full intrinsic height, so the control stays available even
/// after the text has been expanded.
public struct TruncatedText: View {
    let text: String
    let lineLimit: Int
    let font: Font
    let color: Color

    @State private var isTruncated = false
    @State private var isExpanded = false
    @State private var intrinsicHeight: CGFloat = 0
    @State private var truncatedHeight: CGFloat = 0

    public init(_ text: String, lineLimit: Int, font: Font = .subheadline, color: Color = .secondary) {
        self.text = text
        self.lineLimit = lineLimit
        self.font = font
        self.color = color
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(text)
                .font(font)
                .foregroundColor(color)
                .lineLimit(isExpanded ? nil : lineLimit)
                .multilineTextAlignment(.leading)
                // Measure the capped height (always at `lineLimit`, independent of
                // expansion) so the "Show more"/"Show less" control never vanishes.
                .background(
                    Text(text)
                        .font(font)
                        .lineLimit(lineLimit)
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .background(
                            GeometryReader { geo in
                                Color.clear.onAppear {
                                    truncatedHeight = geo.size.height
                                    checkTruncation()
                                }
                                .onChangeCompat(of: text) { _ in
                                    DispatchQueue.main.async {
                                        truncatedHeight = geo.size.height
                                        checkTruncation()
                                    }
                                }
                            }
                        )
                )
                // Measure the full intrinsic height.
                .background(
                    Text(text)
                        .font(font)
                        .lineLimit(nil)
                        .fixedSize(horizontal: false, vertical: true)
                        .hidden()
                        .background(
                            GeometryReader { geo in
                                Color.clear.onAppear {
                                    intrinsicHeight = geo.size.height
                                    checkTruncation()
                                }
                                .onChangeCompat(of: text) { _ in
                                    DispatchQueue.main.async {
                                        intrinsicHeight = geo.size.height
                                        checkTruncation()
                                    }
                                }
                            }
                        )
                )

            if isTruncated {
                Text(isExpanded ? "Show less" : "Show more")
                    .font(.caption)
                    .foregroundColor(Color(UIColor.tertiaryLabel))
                    .contentShape(Rectangle())
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            isExpanded.toggle()
                        }
                    }
            }
        }
    }

    private func checkTruncation() {
        isTruncated = intrinsicHeight > truncatedHeight + 1
    }
}
