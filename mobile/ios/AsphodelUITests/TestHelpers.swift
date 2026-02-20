//
//  TestHelpers.swift
//  AsphodelUITests
//
//  Shared test utility functions and assertion helpers for ViewInspector tests.
//  Provides common patterns for inspecting SwiftUI view hierarchies.
//

import XCTest
import SwiftUI
import ViewInspector

// MARK: - View Inspection Helpers

enum TestHelpers {

    /// Assert that a text string exists somewhere in the view hierarchy.
    /// Throws a clear error message if not found.
    static func assertTextExists<V: View & Inspectable>(
        _ text: String,
        in view: V,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let inspected = try view.inspect()
        do {
            _ = try inspected.find(text: text)
        } catch {
            XCTFail("Expected to find text '\(text)' in view hierarchy, but it was not found.", file: file, line: line)
        }
    }

    /// Assert that a text string does NOT exist in the view hierarchy.
    static func assertTextAbsent<V: View & Inspectable>(
        _ text: String,
        in view: V,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let inspected = try view.inspect()
        let matches = try inspected.findAll(ViewType.Text.self)
            .filter { (try? $0.string()) == text }
        XCTAssertEqual(matches.count, 0,
            "Expected text '\(text)' to be absent, but found \(matches.count) occurrence(s).",
            file: file, line: line)
    }

    /// Count how many times a specific text appears in the view hierarchy.
    static func countText<V: View & Inspectable>(
        _ text: String,
        in view: V
    ) throws -> Int {
        let inspected = try view.inspect()
        let matches = try inspected.findAll(ViewType.Text.self)
            .filter { (try? $0.string()) == text }
        return matches.count
    }

    /// Find and tap a button whose label contains the given text.
    /// Returns true if the button was found and tapped.
    @discardableResult
    static func tapButton<V: View & Inspectable>(
        labeled text: String,
        in view: V,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws -> Bool {
        let inspected = try view.inspect()
        do {
            let button = try inspected.find(ViewType.Button.self, where: { button in
                (try? button.find(text: text)) != nil
            })
            try button.tap()
            return true
        } catch {
            XCTFail("Could not find tappable button with label '\(text)'.", file: file, line: line)
            return false
        }
    }

    /// Assert that a button with the given label is disabled.
    static func assertButtonDisabled<V: View & Inspectable>(
        labeled text: String,
        in view: V,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: text)) != nil
        })
        XCTAssertTrue(try button.isDisabled(),
            "Expected button '\(text)' to be disabled.", file: file, line: line)
    }

    /// Assert that a button with the given label is enabled (not disabled).
    static func assertButtonEnabled<V: View & Inspectable>(
        labeled text: String,
        in view: V,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let inspected = try view.inspect()
        let button = try inspected.find(ViewType.Button.self, where: { button in
            (try? button.find(text: text)) != nil
        })
        XCTAssertFalse(try button.isDisabled(),
            "Expected button '\(text)' to be enabled.", file: file, line: line)
    }

    /// Assert that a ProgressView exists in the view hierarchy.
    static func assertProgressViewExists<V: View & Inspectable>(
        in view: V,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let inspected = try view.inspect()
        do {
            _ = try inspected.find(ViewType.ProgressView.self)
        } catch {
            XCTFail("Expected to find ProgressView in view hierarchy.", file: file, line: line)
        }
    }

    /// Assert that a ProgressView does NOT exist in the view hierarchy.
    static func assertProgressViewAbsent<V: View & Inspectable>(
        in view: V,
        file: StaticString = #filePath,
        line: UInt = #line
    ) throws {
        let inspected = try view.inspect()
        let matches = try inspected.findAll(ViewType.ProgressView.self)
        XCTAssertEqual(matches.count, 0,
            "Expected no ProgressView, but found \(matches.count).", file: file, line: line)
    }

    /// Count the number of views of a specific custom type in the hierarchy.
    static func countViews<V: View & Inspectable, T: View & Inspectable>(
        ofType type: T.Type,
        in view: V
    ) throws -> Int {
        let inspected = try view.inspect()
        return try inspected.findAll(T.self).count
    }
}

// MARK: - XCTestCase Extensions

extension XCTestCase {

    /// Convenience to create an expectation, run a closure, and wait.
    func expectCallback(
        description: String = "callback",
        timeout: TimeInterval = 1.0,
        action: (@escaping () -> Void) -> Void
    ) {
        let exp = expectation(description: description)
        action { exp.fulfill() }
        waitForExpectations(timeout: timeout)
    }
}
