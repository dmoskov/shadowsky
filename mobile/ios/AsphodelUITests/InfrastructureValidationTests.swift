//
//  InfrastructureValidationTests.swift
//  AsphodelUITests
//
//  Validates that the ViewInspector test infrastructure is correctly set up.
//  These tests verify that ViewInspector can inspect SwiftUI views,
//  that module imports work, and that MockData factories produce valid objects.
//

import XCTest
import SwiftUI
import ViewInspector

// MARK: - Infrastructure Validation Tests

class InfrastructureValidationTests: XCTestCase {

    // MARK: - ViewInspector Basic Functionality

    func testViewInspectorCanInspectSimpleView() throws {
        // Verify ViewInspector is properly linked and can inspect a basic SwiftUI view
        let view = Text("Hello ViewInspector")
        let inspected = try view.inspect()
        let text = try inspected.text().string()
        XCTAssertEqual(text, "Hello ViewInspector",
            "ViewInspector should be able to inspect a simple Text view")
    }

    func testViewInspectorCanInspectVStack() throws {
        let view = VStack {
            Text("First")
            Text("Second")
            Text("Third")
        }
        let inspected = try view.inspect()
        let vStack = try inspected.vStack()
        XCTAssertEqual(vStack.count, 3, "VStack should contain 3 children")

        let first = try vStack.text(0).string()
        XCTAssertEqual(first, "First")

        let third = try vStack.text(2).string()
        XCTAssertEqual(third, "Third")
    }

    func testViewInspectorCanFindNestedText() throws {
        let view = ScrollView {
            VStack {
                HStack {
                    Text("Deeply Nested")
                }
            }
        }
        let inspected = try view.inspect()
        let found = try inspected.find(text: "Deeply Nested")
        XCTAssertNotNil(found, "Should find deeply nested text")
    }

    func testViewInspectorCanTapButton() throws {
        var tapped = false
        let view = Button("Tap Me") { tapped = true }
        let inspected = try view.inspect()
        try inspected.button().tap()
        XCTAssertTrue(tapped, "Button tap should trigger its action")
    }

    // MARK: - MockData Factory Validation

    func testMockMessagesConversationFactory() {
        let conversation = MockMessages.makeConversation()
        XCTAssertEqual(conversation.id, "convo-1")
        XCTAssertEqual(conversation.members.count, 2)
        XCTAssertFalse(conversation.muted)
        XCTAssertEqual(conversation.unreadCount, 0)
        XCTAssertNotNil(conversation.lastMessage)
    }

    func testMockMessagesMessageFactory() {
        let message = MockMessages.makeMessage()
        XCTAssertEqual(message.id, "msg-1")
        XCTAssertEqual(message.text, "Hello there!")
        XCTAssertEqual(message.senderDid, MockMessages.otherUserDid)
    }

    func testMockMessagesSampleConversations() {
        let conversations = MockMessages.sampleConversations
        XCTAssertEqual(conversations.count, 3, "Should have 3 sample conversations")
        XCTAssertTrue(conversations[0].unreadCount > 0, "First conversation should have unreads")
        XCTAssertTrue(conversations[1].muted, "Second conversation should be muted")
    }

    func testMockProfileFactory() {
        let profile = MockProfile.makeProfile()
        XCTAssertEqual(profile.did, "did:plc:alice123")
        XCTAssertEqual(profile.handle, "alice.bsky.social")
        XCTAssertEqual(profile.displayName, "Alice Example")
        XCTAssertNotNil(profile.description)
        XCTAssertEqual(profile.followersCount, 1234)
    }

    func testMockProfileOwnVsOther() {
        let ownProfile = MockProfile.ownProfile
        let otherProfile = MockProfile.otherUserProfile

        XCTAssertNotEqual(ownProfile.did, otherProfile.did,
            "Own and other profiles should have different DIDs")
        XCTAssertNotNil(otherProfile.viewer,
            "Other user profile should have a viewer")
    }

    func testMockSearchFactories() {
        let actors = MockSearch.sampleActors
        XCTAssertEqual(actors.count, 3, "Should have 3 sample actors")

        let posts = MockSearch.samplePosts
        XCTAssertEqual(posts.count, 2, "Should have 2 sample posts")

        let topics = MockSearch.sampleTrendingTopics
        XCTAssertEqual(topics.count, 3, "Should have 3 sample trending topics")
    }

    // MARK: - TestHelpers Validation

    func testTestHelpersCountText() throws {
        struct TestView: View, Inspectable {
            var body: some View {
                VStack {
                    Text("Hello")
                    Text("World")
                    Text("Hello")
                }
            }
        }

        let view = TestView()
        let count = try TestHelpers.countText("Hello", in: view)
        XCTAssertEqual(count, 2, "Should find 2 occurrences of 'Hello'")

        let worldCount = try TestHelpers.countText("World", in: view)
        XCTAssertEqual(worldCount, 1, "Should find 1 occurrence of 'World'")
    }

    func testTestHelpersAssertTextExists() throws {
        struct TestView: View, Inspectable {
            var body: some View {
                Text("Exists")
            }
        }

        let view = TestView()
        try TestHelpers.assertTextExists("Exists", in: view)
    }

    func testTestHelpersAssertTextAbsent() throws {
        struct TestView: View, Inspectable {
            var body: some View {
                Text("Present")
            }
        }

        let view = TestView()
        try TestHelpers.assertTextAbsent("Absent", in: view)
    }

    // MARK: - Module Import Validation

    func testNativeModuleTypesAreAccessible() {
        // Verify that types from NativeMessages are accessible
        let member = MockMessages.makeMember()
        XCTAssertEqual(member.did, MockMessages.otherUserDid)

        // Verify that types from NativeProfileView are accessible
        let profile = MockProfile.makeProfile()
        XCTAssertNotNil(profile.handle)

        // Verify that types from NativeSearch are accessible
        let actor = MockSearch.makeActorResult()
        XCTAssertEqual(actor.handle, "alice.bsky.social")
    }
}
