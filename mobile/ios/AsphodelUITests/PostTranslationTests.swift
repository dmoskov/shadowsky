//
//  PostTranslationTests.swift
//  AsphodelUITests
//
//  Unit tests for LanguageUtils and PostTranslationManager state management.
//

import XCTest
@testable import NativeThreadView

// MARK: - LanguageUtils Parsing Tests

class LanguageUtilsParsingTests: XCTestCase {

    // MARK: - needsTranslation

    func testNeedsTranslationReturnsFalseForNilLangs() {
        let result = LanguageUtils.needsTranslation(postLangs: nil)
        XCTAssertFalse(result, "Should return false when postLangs is nil")
    }

    func testNeedsTranslationReturnsFalseForEmptyLangs() {
        let result = LanguageUtils.needsTranslation(postLangs: [])
        XCTAssertFalse(result, "Should return false when postLangs is empty")
    }

    func testNeedsTranslationReturnsFalseWhenLangsContainsDeviceLanguage() {
        let deviceLang = LanguageUtils.deviceLanguage
        let result = LanguageUtils.needsTranslation(postLangs: [deviceLang])
        XCTAssertFalse(result, "Should return false when postLangs contains the device language '\(deviceLang)'")
    }

    func testNeedsTranslationReturnsTrueWhenLangsDoesNotContainDeviceLanguage() {
        // Use "zh" which is guaranteed to differ from typical test environment ("en")
        let result = LanguageUtils.needsTranslation(postLangs: ["zh"])
        XCTAssertTrue(result, "Should return true when postLangs does not contain the device language")
    }

    func testNeedsTranslationHandlesRegionCodeFormat() {
        // The device language is a 2-letter code (e.g. "en").
        // A post tagged "en-US" should strip to "en" and match the device language.
        let deviceLang = LanguageUtils.deviceLanguage
        let regionCode = "\(deviceLang)-US"
        let result = LanguageUtils.needsTranslation(postLangs: [regionCode])
        XCTAssertFalse(result, "Should strip '\(regionCode)' to '\(deviceLang)' and return false")
    }

    // MARK: - languageName

    func testLanguageNameForKnownCodes() {
        XCTAssertEqual(LanguageUtils.languageName(for: "en"), "English")
        XCTAssertEqual(LanguageUtils.languageName(for: "ja"), "Japanese")
        XCTAssertEqual(LanguageUtils.languageName(for: "es"), "Spanish")
        XCTAssertEqual(LanguageUtils.languageName(for: "fr"), "French")
        XCTAssertEqual(LanguageUtils.languageName(for: "de"), "German")
        XCTAssertEqual(LanguageUtils.languageName(for: "zh"), "Chinese")
    }

    func testLanguageNameForUnknownCodeReturnsUppercased() {
        let result = LanguageUtils.languageName(for: "xx")
        XCTAssertEqual(result, "XX", "Unknown language code should be returned uppercased")
    }

    func testLanguageNameHandlesRegionCodeByStrippingToBase() {
        let result = LanguageUtils.languageName(for: "pt-BR")
        XCTAssertEqual(result, "Portuguese", "Should strip 'pt-BR' to 'pt' and return 'Portuguese'")
    }
}

// MARK: - TranslationState Equality Tests

class TranslationStateTests: XCTestCase {

    func testIdleEquality() {
        XCTAssertEqual(TranslationState.idle, TranslationState.idle,
                       ".idle should equal .idle")
    }

    func testTranslatedEquality() {
        let stateA = TranslationState.translated(text: "Hello", sourceLang: "fr")
        let stateB = TranslationState.translated(text: "Hello", sourceLang: "fr")
        XCTAssertEqual(stateA, stateB,
                       ".translated with identical values should be equal")

        let stateC = TranslationState.translated(text: "Goodbye", sourceLang: "fr")
        XCTAssertNotEqual(stateA, stateC,
                          ".translated with different text should not be equal")
    }

    func testErrorEquality() {
        let stateA = TranslationState.error(message: "Network failed")
        let stateB = TranslationState.error(message: "Network failed")
        XCTAssertEqual(stateA, stateB,
                       ".error with identical messages should be equal")

        let stateC = TranslationState.error(message: "Timeout")
        XCTAssertNotEqual(stateA, stateC,
                          ".error with different messages should not be equal")
    }

    func testDifferentCasesAreNotEqual() {
        XCTAssertNotEqual(TranslationState.idle, TranslationState.loading,
                          ".idle and .loading should not be equal")
        XCTAssertNotEqual(TranslationState.loading, TranslationState.error(message: "fail"),
                          ".loading and .error should not be equal")
        XCTAssertNotEqual(TranslationState.idle, TranslationState.translated(text: "Hi", sourceLang: "en"),
                          ".idle and .translated should not be equal")
    }
}

// MARK: - PostTranslationManager Tests

class PostTranslationManagerTests: XCTestCase {

    // NOTE: PostTranslationManager is a singleton — state persists across tests.
    // Each test uses a unique URI to avoid cross-test contamination.

    // MARK: - Default state

    func testStateReturnsIdleForUnknownURI() {
        let uri = "at://did:plc:test/app.bsky.feed.post/unknown-\(UUID().uuidString)"
        let state = PostTranslationManager.shared.state(for: uri)
        XCTAssertEqual(state, .idle,
                       "state(for:) should return .idle for a URI that has never been seen")
    }

    func testIsShowingTranslationReturnsFalseForUnknownURI() {
        let uri = "at://did:plc:test/app.bsky.feed.post/unseen-\(UUID().uuidString)"
        let result = PostTranslationManager.shared.isShowingTranslation(for: uri)
        XCTAssertFalse(result,
                       "isShowingTranslation should return false for a URI that has never been seen")
    }

    // MARK: - requestTranslation

    func testRequestTranslationSetsStateToLoading() {
        let uri = "at://did:plc:test/app.bsky.feed.post/req-\(UUID().uuidString)"
        let manager = PostTranslationManager.shared

        // Precondition: state is idle
        XCTAssertEqual(manager.state(for: uri), .idle)

        manager.requestTranslation(for: uri)

        XCTAssertEqual(manager.state(for: uri), .loading,
                       "requestTranslation should set state to .loading")
    }

    // MARK: - toggleTranslation

    func testToggleTranslationFlipsShowingFlag() {
        let uri = "at://did:plc:test/app.bsky.feed.post/toggle-\(UUID().uuidString)"
        let manager = PostTranslationManager.shared

        // Precondition: showing is false
        XCTAssertFalse(manager.isShowingTranslation(for: uri))

        // First toggle: false -> true
        manager.toggleTranslation(for: uri)
        XCTAssertTrue(manager.isShowingTranslation(for: uri),
                      "First toggle should flip showing from false to true")

        // Second toggle: true -> false
        manager.toggleTranslation(for: uri)
        XCTAssertFalse(manager.isShowingTranslation(for: uri),
                       "Second toggle should flip showing from true to false")
    }
}
