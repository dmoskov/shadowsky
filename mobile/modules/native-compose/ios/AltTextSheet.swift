//
//  AltTextSheet.swift
//  NativeCompose
//
//  Modal sheet for editing alt text on image attachments.
//  Includes AI generation button that bridges to JS.
//

import SwiftUI

// MARK: - Alt Text Sheet

struct AltTextSheet: View {
    let imageUri: String
    @Binding var altText: String
    let isGenerating: Bool
    let onGenerateAltText: () -> Void
    let onSave: (String) -> Void
    let onDismiss: () -> Void

    @State private var editText: String = ""

    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                // Image preview
                AsyncImage(url: URL(string: imageUri)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fit)
                            .frame(maxHeight: 200)
                            .cornerRadius(8)
                    case .failure, .empty:
                        RoundedRectangle(cornerRadius: 8)
                            .fill(Color(UIColor.tertiarySystemGroupedBackground))
                            .frame(height: 150)
                            .overlay(
                                Image(systemName: "photo")
                                    .foregroundColor(.secondary)
                                    .font(.largeTitle)
                            )
                    @unknown default:
                        EmptyView()
                    }
                }
                .padding(.horizontal)

                // Description
                Text("Describe this image for people who are blind or have low vision.")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)

                // Generate with AI button
                Button(action: onGenerateAltText) {
                    HStack {
                        if isGenerating {
                            ProgressView()
                                .frame(width: 16, height: 16)
                        }
                        Text(isGenerating ? "Generating..." : "Generate with AI")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .cornerRadius(8)
                }
                .disabled(isGenerating)
                .padding(.horizontal)

                // Alt text input
                TextEditor(text: $editText)
                    .font(.body)
                    .frame(minHeight: 100)
                    .padding(8)
                    .background(Color(UIColor.secondarySystemGroupedBackground))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 0.5)
                    )
                    .padding(.horizontal)

                Spacer()
            }
            .padding(.top, 16)
            .navigationTitle("Add Alt Text")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        onDismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: { onSave(editText) }) {
                        Text("Save")
                            .fontWeight(.semibold)
                    }
                }
            }
        }
        .onAppear {
            editText = altText
        }
        .onChangeCompat(of: altText) { newValue in
            // Update from external source (e.g., AI generation)
            if newValue != editText {
                editText = newValue
            }
        }
    }
}

// MARK: - Preview

#if DEBUG
struct AltTextSheet_Previews: PreviewProvider {
    static var previews: some View {
        AltTextSheet(
            imageUri: "https://example.com/image.jpg",
            altText: .constant(""),
            isGenerating: false,
            onGenerateAltText: {},
            onSave: { _ in },
            onDismiss: {}
        )
    }
}
#endif
