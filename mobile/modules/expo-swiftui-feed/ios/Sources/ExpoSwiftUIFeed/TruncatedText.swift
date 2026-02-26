import SwiftUI
import UIKit

/// A text view that shows a "Show more" indicator when the text is truncated.
/// Uses a hidden full-height Text to detect whether the line limit actually truncates.
public struct TruncatedText: View {
    let text: String
    let lineLimit: Int
    let font: Font
    let color: Color

    @State private var isTruncated = false
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
                .lineLimit(lineLimit)
                .multilineTextAlignment(.leading)
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
                Text("Show more")
                    .font(.caption)
                    .foregroundColor(Color(UIColor.tertiaryLabel))
            }
        }
    }

    private func checkTruncation() {
        isTruncated = intrinsicHeight > truncatedHeight + 1
    }
}
