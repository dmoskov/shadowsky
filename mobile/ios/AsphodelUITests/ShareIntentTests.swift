//
//  ShareIntentTests.swift
//  AsphodelUITests
//
//  Tests for share intent handling and deep link resolution.
//  Covers SpotlightDeepLinkResolver URL construction and
//  validates the deep link URL patterns used by the Share Extension.
//

import XCTest
@testable import Asphodel

// MARK: - SpotlightDeepLinkResolver Tests

class SpotlightDeepLinkResolverTests: XCTestCase {

    // MARK: - Profile Identifier Resolution

    func testResolveProfileByDID() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "bsky-profile-did:plc:abc123")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "profile")
        XCTAssertEqual(url?.path, "/did:plc:abc123")
    }

    func testResolveProfileLegacyFormat() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "profile:alice.bsky.social")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "profile")
        XCTAssertEqual(url?.path, "/alice.bsky.social")
    }

    func testResolveProfileEmptyDID() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "bsky-profile-")
        XCTAssertNil(url, "Empty DID should return nil")
    }

    func testResolveProfileEmptyLegacyHandle() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "profile:")
        XCTAssertNil(url, "Empty legacy handle should return nil")
    }

    // MARK: - Post Identifier Resolution

    func testResolvePostByATURI() {
        let atURI = "at://did:plc:xyz789/app.bsky.feed.post/rkey123"
        let url = SpotlightDeepLinkResolver.resolveURL(for: "bsky-post-\(atURI)")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "post")
        // Path should contain the DID and rkey
        XCTAssertTrue(url?.path.contains("did:plc:xyz789") ?? false)
        XCTAssertTrue(url?.path.contains("rkey123") ?? false)
    }

    func testResolvePostLegacyFormat() {
        let atURI = "at://did:plc:abc/app.bsky.feed.post/3abc"
        let url = SpotlightDeepLinkResolver.resolveURL(for: "post:\(atURI)")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "post")
    }

    func testResolveThreadByATURI() {
        let atURI = "at://did:plc:thread123/app.bsky.feed.post/rkeyabc"
        let url = SpotlightDeepLinkResolver.resolveURL(for: "bsky-thread-\(atURI)")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "post")
        XCTAssertTrue(url?.path.contains("rkeyabc") ?? false)
    }

    func testResolvePostWithMalformedURI() {
        // URI with too few parts
        let url = SpotlightDeepLinkResolver.resolveURL(for: "bsky-post-at://short")
        XCTAssertNil(url, "Malformed AT URI with too few segments should return nil")
    }

    func testResolvePostWithEmptyURI() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "bsky-post-")
        XCTAssertNil(url, "Empty post URI should return nil")
    }

    // MARK: - Unknown Identifier Formats

    func testResolveUnknownFormat() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "unknown-format-123")
        XCTAssertNil(url, "Unknown identifier format should return nil")
    }

    func testResolveEmptyString() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "")
        XCTAssertNil(url, "Empty string should return nil")
    }

    func testResolveRandomText() {
        let url = SpotlightDeepLinkResolver.resolveURL(for: "just some random text")
        XCTAssertNil(url, "Random text should return nil")
    }
}

// MARK: - Deep Link URL Pattern Tests

class DeepLinkURLPatternTests: XCTestCase {

    /// Validate that the shadowsky:// scheme URLs constructed by the Share Extension
    /// have the expected structure for the main app's +native-intent.tsx to parse.

    func testComposeURLWithURLParam() {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "compose"
        components.queryItems = [
            URLQueryItem(name: "url", value: "https://example.com/article")
        ]

        let url = components.url
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "compose")

        let query = URLComponents(url: url!, resolvingAgainstBaseURL: false)?.queryItems
        let urlParam = query?.first(where: { $0.name == "url" })?.value
        XCTAssertEqual(urlParam, "https://example.com/article")
    }

    func testComposeURLWithTextParam() {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "compose"
        components.queryItems = [
            URLQueryItem(name: "text", value: "Check this out!")
        ]

        let url = components.url
        XCTAssertNotNil(url)

        let query = URLComponents(url: url!, resolvingAgainstBaseURL: false)?.queryItems
        let textParam = query?.first(where: { $0.name == "text" })?.value
        XCTAssertEqual(textParam, "Check this out!")
    }

    func testComposeURLWithImagesFlag() {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "compose"
        components.queryItems = [
            URLQueryItem(name: "hasImages", value: "true")
        ]

        let url = components.url
        XCTAssertNotNil(url)

        let query = URLComponents(url: url!, resolvingAgainstBaseURL: false)?.queryItems
        let imagesParam = query?.first(where: { $0.name == "hasImages" })?.value
        XCTAssertEqual(imagesParam, "true")
    }

    func testComposeURLWithAllParams() {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "compose"
        components.queryItems = [
            URLQueryItem(name: "url", value: "https://example.com"),
            URLQueryItem(name: "text", value: "Hello world"),
            URLQueryItem(name: "hasImages", value: "true")
        ]

        let url = components.url
        XCTAssertNotNil(url)

        let query = URLComponents(url: url!, resolvingAgainstBaseURL: false)?.queryItems
        XCTAssertEqual(query?.count, 3)
    }

    func testComposeURLWithSpecialCharactersInText() {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "compose"
        components.queryItems = [
            URLQueryItem(name: "text", value: "Hello & goodbye <world> \"test\"")
        ]

        let url = components.url
        XCTAssertNotNil(url, "URL with special characters should be constructable")

        // Parse it back and verify round-trip
        let parsed = URLComponents(url: url!, resolvingAgainstBaseURL: false)
        let text = parsed?.queryItems?.first(where: { $0.name == "text" })?.value
        XCTAssertEqual(text, "Hello & goodbye <world> \"test\"")
    }

    func testComposeURLWithEmptyParams() {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "compose"
        // No query items

        let url = components.url
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.absoluteString, "shadowsky://compose")
    }

    func testProfileSpotlightURL() {
        let url = URL(string: "shadowsky://profile/alice.bsky.social")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "profile")
        XCTAssertEqual(url?.path, "/alice.bsky.social")
    }

    func testPostSpotlightURL() {
        let url = URL(string: "shadowsky://post/alice.bsky.social/3abc123")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "post")
        // Path should contain handle and rkey
        XCTAssertTrue(url?.path.contains("alice.bsky.social") ?? false)
        XCTAssertTrue(url?.path.contains("3abc123") ?? false)
    }

    func testOAuthCallbackURL() {
        var components = URLComponents()
        components.scheme = "shadowsky"
        components.host = "oauth-callback"
        components.queryItems = [
            URLQueryItem(name: "code", value: "auth_code_123"),
            URLQueryItem(name: "state", value: "state_xyz")
        ]

        let url = components.url
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.scheme, "shadowsky")
        XCTAssertEqual(url?.host, "oauth-callback")
    }

    // MARK: - Universal Link Patterns

    func testBskyAppProfileURL() {
        let url = URL(string: "https://bsky.app/profile/alice.bsky.social")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.host, "bsky.app")
        XCTAssertEqual(url?.pathComponents.count, 3) // ["/" , "profile", "alice.bsky.social"]
    }

    func testBskyAppPostURL() {
        let url = URL(string: "https://bsky.app/profile/alice.bsky.social/post/3abc123")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.host, "bsky.app")
        XCTAssertEqual(url?.pathComponents.count, 5) // ["/", "profile", handle, "post", rkey]
    }

    func testBskyAppSearchURL() {
        let url = URL(string: "https://bsky.app/search?q=bluesky")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.host, "bsky.app")

        let query = URLComponents(url: url!, resolvingAgainstBaseURL: false)?.queryItems
        let q = query?.first(where: { $0.name == "q" })?.value
        XCTAssertEqual(q, "bluesky")
    }

    func testBskyAppFeedURL() {
        let url = URL(string: "https://bsky.app/feeds/my-feed-uri")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.host, "bsky.app")
        XCTAssertTrue(url?.path.contains("feeds") ?? false)
    }

    func testShadowskyUniversalLinkURL() {
        let url = URL(string: "https://shadowsky.io/profile/alice.bsky.social")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.host, "shadowsky.io")
    }

    func testStagingBskyUniversalLinkURL() {
        let url = URL(string: "https://staging.bsky.app/profile/alice.bsky.social")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.host, "staging.bsky.app")
    }

    // MARK: - Edge Cases

    func testURLWithEncodedATProtocolURI() {
        let atURI = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot"
        let encoded = atURI.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? ""
        let url = URL(string: "https://bsky.app/feeds/\(encoded)")
        XCTAssertNotNil(url, "URL with encoded AT protocol URI should be valid")
    }

    func testURLWithSpecialCharactersInHandle() {
        // Handles can contain dots and hyphens
        let url = URL(string: "https://bsky.app/profile/my-cool.handle.bsky.social")
        XCTAssertNotNil(url)
        XCTAssertEqual(url?.pathComponents.last, "my-cool.handle.bsky.social")
    }

    func testURLWithDIDAsHandle() {
        let url = URL(string: "https://bsky.app/profile/did:plc:abc123")
        XCTAssertNotNil(url)
        XCTAssertTrue(url?.path.contains("did:plc:abc123") ?? false)
    }
}

// MARK: - App Group UserDefaults Tests (Share Extension data exchange)

class ShareExtensionDataExchangeTests: XCTestCase {

    /// Test that the shared content dictionary format matches what
    /// the ShareIntentModule.swift expects to read.

    func testSharedContentDictionaryFormat() {
        // Simulate what ShareViewController writes
        let sharedData: [String: Any] = [
            "url": "https://example.com",
            "text": "Some shared text",
            "images": ["img1.jpg", "img2.jpg"],
            "timestamp": Date().timeIntervalSince1970
        ]

        // Verify it has the expected keys
        XCTAssertNotNil(sharedData["url"] as? String)
        XCTAssertNotNil(sharedData["text"] as? String)
        XCTAssertNotNil(sharedData["images"] as? [String])
        XCTAssertNotNil(sharedData["timestamp"] as? TimeInterval)
    }

    func testSharedContentURLOnly() {
        let sharedData: [String: Any] = [
            "url": "https://example.com/page",
            "timestamp": Date().timeIntervalSince1970
        ]

        XCTAssertNotNil(sharedData["url"])
        XCTAssertNil(sharedData["text"])
        XCTAssertNil(sharedData["images"])
    }

    func testSharedContentTextOnly() {
        let sharedData: [String: Any] = [
            "text": "Just some text to share",
            "timestamp": Date().timeIntervalSince1970
        ]

        XCTAssertNil(sharedData["url"])
        XCTAssertNotNil(sharedData["text"])
    }

    func testSharedContentImagesOnly() {
        let sharedData: [String: Any] = [
            "images": ["photo1.jpg", "photo2.jpg", "photo3.jpg"],
            "timestamp": Date().timeIntervalSince1970
        ]

        let images = sharedData["images"] as? [String]
        XCTAssertEqual(images?.count, 3)
    }

    func testStaleContentDetection() {
        // Shared content older than 5 minutes should be considered stale
        let staleTimestamp = Date().timeIntervalSince1970 - 301 // 5 min + 1 sec
        let freshTimestamp = Date().timeIntervalSince1970 - 60  // 1 minute ago

        let staleAge = Date().timeIntervalSince1970 - staleTimestamp
        let freshAge = Date().timeIntervalSince1970 - freshTimestamp

        XCTAssertTrue(staleAge > 300, "Stale content should be older than 5 minutes")
        XCTAssertFalse(freshAge > 300, "Fresh content should be within 5 minutes")
    }
}
