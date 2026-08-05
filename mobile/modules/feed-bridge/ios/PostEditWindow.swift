//
// PostEditWindow.swift
// Feed Bridge Module
//
// Shared edit-window arithmetic for the native post surfaces.
//
// Lives in FeedBridge rather than in NativeFeedList or NativeThreadView because
// both import this module and both gate an "Edit post" menu item on the same
// window. Two copies of the constant would eventually disagree, and the failure
// mode is a menu item that appears in the feed but not the thread (or one that
// offers an edit the PDS write will be refused for).
//
// Must stay in sync with EDIT_WINDOW_MS in packages/core/src/atproto/post-edit.ts,
// which is the authority — the TS side re-checks eligibility before writing, so
// this only decides whether to *offer* the action.
//

import Foundation

public enum PostEditWindow {
    /// How long after posting an edit stays available. Mirrors EDIT_WINDOW_MS.
    public static let duration: TimeInterval = 15 * 60

    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Standard: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    private static func parse(_ isoString: String) -> Date? {
        iso8601WithFractional.date(from: isoString)
            ?? iso8601Standard.date(from: isoString)
    }

    /// Whether a post created at `createdAt` is still inside its edit window.
    ///
    /// Measured from `createdAt` (not `indexedAt`) so repeated edits cannot
    /// extend the window — `createdAt` is preserved across edits by design.
    /// An unparseable timestamp returns false: refusing to offer an edit is the
    /// safe direction, since the write would be rejected anyway.
    public static func isOpen(createdAt: String, now: Date = Date()) -> Bool {
        guard let created = parse(createdAt) else { return false }
        return now.timeIntervalSince(created) < duration
    }

    /// Whether `viewerDid` may edit a post authored by `authorDid` right now.
    public static func canEdit(
        authorDid: String,
        viewerDid: String?,
        createdAt: String,
        now: Date = Date()
    ) -> Bool {
        guard let viewerDid = viewerDid, viewerDid == authorDid else { return false }
        return isOpen(createdAt: createdAt, now: now)
    }
}
