//
//  ThreadSummaryView.swift
//  NativeThreadView
//
//  AI-generated thread summary card with expand/collapse animation
//

import SwiftUI

// MARK: - Thread Summary Data Types

/// Represents a highlighted sub-thread in comprehensive summaries
struct SubThreadHighlight: Identifiable {
    let id: String // uri
    let uri: String
    let authorHandle: String
    let snippet: String
    let engagement: Int
}

/// Metadata about the thread summary
struct ThreadSummaryMetadata {
    let postCount: Int?
    let analyzedPostCount: Int?
    let authors: [String]?
    let generatedAt: String?
    let cached: Bool
    let totalEngagement: Int?
    let highlightedSubThreads: [SubThreadHighlight]?
}

/// The result of a thread summary generation
struct ThreadSummaryData {
    let summary: String
    let format: String // "tldr", "brief", "moderate", "detailed", "comprehensive"
    let metadata: ThreadSummaryMetadata

    var isComprehensive: Bool {
        format == "comprehensive"
    }

    var isDetailed: Bool {
        format == "detailed" || format == "comprehensive"
    }
}

// MARK: - Parsing

extension ThreadSummaryData {
    /// Parse summary data from a dictionary (sent from JS via the bridge)
    static func parse(from dict: [String: Any]) -> ThreadSummaryData? {
        guard let summary = dict["summary"] as? String,
              let format = dict["format"] as? String else {
            return nil
        }

        let metaDict = dict["metadata"] as? [String: Any] ?? [:]

        var highlights: [SubThreadHighlight]? = nil
        if let hlArray = metaDict["highlightedSubThreads"] as? [[String: Any]] {
            highlights = hlArray.compactMap { hlDict in
                guard let uri = hlDict["uri"] as? String,
                      let authorHandle = hlDict["authorHandle"] as? String else {
                    return nil
                }
                return SubThreadHighlight(
                    id: uri,
                    uri: uri,
                    authorHandle: authorHandle,
                    snippet: hlDict["snippet"] as? String ?? "",
                    engagement: hlDict["engagement"] as? Int ?? 0
                )
            }
        }

        let metadata = ThreadSummaryMetadata(
            postCount: metaDict["postCount"] as? Int,
            analyzedPostCount: metaDict["analyzedPostCount"] as? Int,
            authors: metaDict["authors"] as? [String],
            generatedAt: metaDict["generatedAt"] as? String,
            cached: metaDict["cached"] as? Bool ?? false,
            totalEngagement: metaDict["totalEngagement"] as? Int,
            highlightedSubThreads: highlights
        )

        return ThreadSummaryData(summary: summary, format: format, metadata: metadata)
    }
}

// MARK: - Thread Summary View

/// Collapsible AI thread summary card displayed between root post and replies
struct ThreadSummaryView: View {
    let summaryData: ThreadSummaryData
    let summaryMode: String // "quick" or "full"
    let onToggleMode: ((String) -> Void)?

    @State private var isExpanded: Bool = true
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header row
            headerView

            // Expandable content
            if isExpanded {
                contentView
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(UIColor.separator).opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .accessibilityElement(children: .contain)
    }

    // MARK: - Header

    private var headerView: some View {
        Button(action: {
            if summaryData.isComprehensive {
                if reduceMotion {
                    isExpanded.toggle()
                } else {
                    withAnimation(.easeInOut(duration: 0.25)) {
                        isExpanded.toggle()
                    }
                }
            }
        }) {
            HStack(spacing: 8) {
                // Sparkle icon
                Text("\u{2728}")
                    .font(.subheadline)

                // Label + metadata
                HStack(spacing: 0) {
                    Text("AI Summary")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.secondary)

                    if summaryData.metadata.cached {
                        Text(" cached")
                            .font(.caption2)
                            .foregroundColor(Color(UIColor.tertiaryLabel))
                            .italic()
                    }

                    if let postCount = summaryData.metadata.postCount {
                        Text(" \u{2022} \(postCount) posts")
                            .font(.caption2)
                            .foregroundColor(Color(UIColor.tertiaryLabel))

                        if let authors = summaryData.metadata.authors {
                            Text(", \(authors.count) participants")
                                .font(.caption2)
                                .foregroundColor(Color(UIColor.tertiaryLabel))
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Quick / Full toggle
                HStack(spacing: 4) {
                    modeButton("Quick", mode: "quick")
                    modeButton("Full", mode: "full")
                }

                // Chevron for comprehensive
                if summaryData.isComprehensive {
                    Text(isExpanded ? "\u{25BC}" : "\u{25B6}")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(12)
        }
        .buttonStyle(.plain)
        .disabled(!summaryData.isComprehensive)
        .accessibilityLabel(accessibilityHeaderLabel)
        .accessibilityHint(summaryData.isComprehensive ? "Double tap to \(isExpanded ? "collapse" : "expand") summary" : "")
        .accessibilityAddTraits(summaryData.isComprehensive ? .isButton : .isStaticText)
    }

    private func modeButton(_ label: String, mode: String) -> some View {
        Button(action: {
            onToggleMode?(mode)
        }) {
            Text(label)
                .font(.caption.weight(.medium))
                .foregroundColor(summaryMode == mode ? .accentColor : Color(UIColor.tertiaryLabel))
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(label) summary mode")
        .accessibilityAddTraits(summaryMode == mode ? .isSelected : [])
    }

    // MARK: - Content

    private var contentView: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Summary text
            Text(summaryData.summary)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .lineSpacing(4)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
                .accessibilityLabel("Summary: \(summaryData.summary)")

            // Highlighted sub-threads for comprehensive summaries
            if summaryData.isComprehensive,
               let highlights = summaryData.metadata.highlightedSubThreads,
               !highlights.isEmpty {
                highlightsSection(highlights)
            }

            // Total engagement for detailed+ summaries
            if summaryData.isDetailed,
               let totalEngagement = summaryData.metadata.totalEngagement {
                Text("\(totalEngagement.formatted()) total interactions")
                    .font(.caption2)
                    .foregroundColor(Color(UIColor.tertiaryLabel))
                    .padding(.horizontal, 12)
                    .padding(.bottom, 12)
            }
        }
    }

    // MARK: - Highlights Section

    private func highlightsSection(_ highlights: [SubThreadHighlight]) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            // Divider
            Rectangle()
                .fill(Color(UIColor.separator).opacity(0.3))
                .frame(height: 1)
                .padding(.horizontal, 12)
                .padding(.bottom, 2)

            Text("NOTABLE DISCUSSIONS")
                .font(.caption2.weight(.semibold))
                .foregroundColor(.secondary)
                .padding(.horizontal, 12)

            ForEach(highlights) { highlight in
                HStack(spacing: 0) {
                    Text("@\(highlight.authorHandle)")
                        .font(.caption)
                        .foregroundColor(.accentColor)

                    Text(" (\(highlight.engagement) interactions)")
                        .font(.caption2)
                        .foregroundColor(Color(UIColor.tertiaryLabel))
                }
                .padding(.vertical, 4)
                .padding(.horizontal, 8)
                .background(Color(UIColor.systemBackground))
                .cornerRadius(4)
                .padding(.horizontal, 12)
                .accessibilityLabel("@\(highlight.authorHandle), \(highlight.engagement) interactions")
            }
        }
        .padding(.bottom, 12)
    }

    // MARK: - Accessibility

    private var accessibilityHeaderLabel: String {
        var label = "AI Summary"
        if summaryData.metadata.cached {
            label += ", cached"
        }
        if let postCount = summaryData.metadata.postCount {
            label += ", \(postCount) posts"
        }
        if let authors = summaryData.metadata.authors {
            label += ", \(authors.count) participants"
        }
        if summaryData.isComprehensive {
            label += ", \(isExpanded ? "expanded" : "collapsed")"
        }
        return label
    }
}

// MARK: - Loading View

/// Loading indicator shown while summary is being generated
struct ThreadSummaryLoadingView: View {
    var body: some View {
        HStack(spacing: 8) {
            ProgressView()
                .scaleEffect(0.8)
            Text("Generating summary...")
                .font(.footnote)
                .foregroundColor(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(UIColor.separator).opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .accessibilityLabel("Generating AI summary")
    }
}
