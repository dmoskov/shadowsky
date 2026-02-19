//
//  SpotlightDeepLinkResolver.swift
//  Asphodel
//
//  Resolves CoreSpotlight item identifiers to deep link URLs.
//  Used by AppDelegate to route Spotlight search result taps
//  to the correct screen via the app's URL scheme.
//
//  Identifier formats:
//    bsky-profile-{did}  -> shadowsky://profile/{handle} (requires lookup)
//    bsky-post-{uri}     -> shadowsky://post/{handle}/{rkey}
//    profile:{handle}    -> shadowsky://profile/{handle} (legacy format)
//    post:{uri}          -> shadowsky://post/{handle}/{rkey} (legacy format)
//

import Foundation

enum SpotlightDeepLinkResolver {

    /// Resolve a Spotlight unique identifier to a deep link URL.
    /// Returns nil if the identifier format is unrecognized.
    static func resolveURL(for identifier: String) -> URL? {
        // Format: bsky-profile-{did}
        // Since we don't have the handle from just the DID, we use the DID directly.
        // The app's routing will resolve DID -> handle if needed.
        if identifier.hasPrefix("bsky-profile-") {
            let did = String(identifier.dropFirst("bsky-profile-".count))
            guard !did.isEmpty else { return nil }
            // Use DID as the profile identifier — the app router handles both DID and handle
            return URL(string: "shadowsky://profile/\(did)")
        }

        // Format: profile:{handle} (legacy from SpotlightSearch module)
        if identifier.hasPrefix("profile:") {
            let handle = String(identifier.dropFirst("profile:".count))
            guard !handle.isEmpty else { return nil }
            return URL(string: "shadowsky://profile/\(handle)")
        }

        // Format: bsky-post-{uri} or post:{uri}
        if identifier.hasPrefix("bsky-post-") || identifier.hasPrefix("post:") {
            let uri: String
            if identifier.hasPrefix("bsky-post-") {
                uri = String(identifier.dropFirst("bsky-post-".count))
            } else {
                uri = String(identifier.dropFirst("post:".count))
            }
            return resolvePostURI(uri)
        }

        return nil
    }

    private static func resolvePostURI(_ uri: String) -> URL? {
        // AT URI format: at://did:plc:xxx/app.bsky.feed.post/rkey
        let parts = uri.split(separator: "/")
        guard parts.count >= 4 else { return nil }
        // parts[0] = "at:", parts[1] = "", parts[2] = did, parts[3] = collection, parts[4] = rkey
        // Actually with split by "/" on "at://did/collection/rkey":
        // ["at:", "", "did", "collection", "rkey"]
        let rkey = String(parts.last ?? "")
        let did = String(parts[2])
        guard !rkey.isEmpty, !did.isEmpty else { return nil }
        return URL(string: "shadowsky://post/\(did)/\(rkey)")
    }
}
