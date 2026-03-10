//
//  NotificationListTypesTests.swift
//  AsphodelUITests
//
//  Unit tests for notification reason enum and filter behavior.
//

import XCTest
@testable import NativeNotificationsList

// MARK: - NotificationReasonTests

class NotificationReasonTests: XCTestCase {

    // MARK: - init(rawValue:) Known Values

    func testInitWithLikeRawValue() {
        let reason = NotificationReason(rawValue: "like")
        XCTAssertEqual(reason, .like)
    }

    func testInitWithRepostRawValue() {
        let reason = NotificationReason(rawValue: "repost")
        XCTAssertEqual(reason, .repost)
    }

    func testInitWithFollowRawValue() {
        let reason = NotificationReason(rawValue: "follow")
        XCTAssertEqual(reason, .follow)
    }

    func testInitWithMentionRawValue() {
        let reason = NotificationReason(rawValue: "mention")
        XCTAssertEqual(reason, .mention)
    }

    func testInitWithReplyRawValue() {
        let reason = NotificationReason(rawValue: "reply")
        XCTAssertEqual(reason, .reply)
    }

    func testInitWithQuoteRawValue() {
        let reason = NotificationReason(rawValue: "quote")
        XCTAssertEqual(reason, .quote)
    }

    func testInitWithLikeViaRepostRawValue() {
        let reason = NotificationReason(rawValue: "like-via-repost")
        XCTAssertEqual(reason, .likeViaRepost)
    }

    func testInitWithRepostViaRepostRawValue() {
        let reason = NotificationReason(rawValue: "repost-via-repost")
        XCTAssertEqual(reason, .repostViaRepost)
    }

    func testInitWithStarterpackJoinedRawValue() {
        let reason = NotificationReason(rawValue: "starterpack-joined")
        XCTAssertEqual(reason, .starterpackJoined)
    }

    // MARK: - init(rawValue:) Unknown Values

    func testInitWithUnknownStringReturnsUnknown() {
        let reason = NotificationReason(rawValue: "some-future-reason")
        XCTAssertEqual(reason, .unknown)
    }

    func testInitWithEmptyStringReturnsUnknown() {
        let reason = NotificationReason(rawValue: "")
        XCTAssertEqual(reason, .unknown)
    }

    func testInitWithGarbageStringReturnsUnknown() {
        let reason = NotificationReason(rawValue: "!!!not-a-reason!!!")
        XCTAssertEqual(reason, .unknown)
    }

    // MARK: - rawValue Round-Trip

    func testRawValueRoundTripForLike() {
        let reason = NotificationReason(rawValue: "like")
        XCTAssertEqual(reason.rawValue, "like")
    }

    func testRawValueRoundTripForRepost() {
        let reason = NotificationReason(rawValue: "repost")
        XCTAssertEqual(reason.rawValue, "repost")
    }

    func testRawValueRoundTripForFollow() {
        let reason = NotificationReason(rawValue: "follow")
        XCTAssertEqual(reason.rawValue, "follow")
    }

    func testRawValueRoundTripForMention() {
        let reason = NotificationReason(rawValue: "mention")
        XCTAssertEqual(reason.rawValue, "mention")
    }

    func testRawValueRoundTripForReply() {
        let reason = NotificationReason(rawValue: "reply")
        XCTAssertEqual(reason.rawValue, "reply")
    }

    func testRawValueRoundTripForQuote() {
        let reason = NotificationReason(rawValue: "quote")
        XCTAssertEqual(reason.rawValue, "quote")
    }

    func testRawValueRoundTripForLikeViaRepost() {
        let reason = NotificationReason(rawValue: "like-via-repost")
        XCTAssertEqual(reason.rawValue, "like-via-repost")
    }

    func testRawValueRoundTripForRepostViaRepost() {
        let reason = NotificationReason(rawValue: "repost-via-repost")
        XCTAssertEqual(reason.rawValue, "repost-via-repost")
    }

    func testRawValueRoundTripForStarterpackJoined() {
        let reason = NotificationReason(rawValue: "starterpack-joined")
        XCTAssertEqual(reason.rawValue, "starterpack-joined")
    }

    func testRawValueForUnknown() {
        XCTAssertEqual(NotificationReason.unknown.rawValue, "unknown")
    }

    // MARK: - actionText

    func testActionTextForLike() {
        XCTAssertEqual(NotificationReason.like.actionText, "liked your post")
    }

    func testActionTextForRepost() {
        XCTAssertEqual(NotificationReason.repost.actionText, "reposted your post")
    }

    func testActionTextForFollow() {
        XCTAssertEqual(NotificationReason.follow.actionText, "followed you")
    }

    func testActionTextForMention() {
        XCTAssertEqual(NotificationReason.mention.actionText, "mentioned you")
    }

    func testActionTextForReply() {
        XCTAssertEqual(NotificationReason.reply.actionText, "replied to your post")
    }

    func testActionTextForQuote() {
        XCTAssertEqual(NotificationReason.quote.actionText, "quoted your post")
    }

    func testActionTextForLikeViaRepost() {
        XCTAssertEqual(NotificationReason.likeViaRepost.actionText, "liked your repost")
    }

    func testActionTextForRepostViaRepost() {
        XCTAssertEqual(NotificationReason.repostViaRepost.actionText, "reposted your repost")
    }

    func testActionTextForStarterpackJoined() {
        XCTAssertEqual(NotificationReason.starterpackJoined.actionText, "joined from your starter pack")
    }

    func testActionTextForUnknown() {
        XCTAssertEqual(NotificationReason.unknown.actionText, "sent a notification")
    }

    // MARK: - sfSymbolName

    func testSfSymbolNameForLike() {
        XCTAssertEqual(NotificationReason.like.sfSymbolName, "heart.fill")
    }

    func testSfSymbolNameForRepost() {
        XCTAssertEqual(NotificationReason.repost.sfSymbolName, "arrow.2.squarepath")
    }

    func testSfSymbolNameForFollow() {
        XCTAssertEqual(NotificationReason.follow.sfSymbolName, "person.badge.plus")
    }

    func testSfSymbolNameForMention() {
        XCTAssertEqual(NotificationReason.mention.sfSymbolName, "at")
    }

    func testSfSymbolNameForReply() {
        XCTAssertEqual(NotificationReason.reply.sfSymbolName, "arrowshape.turn.up.left.fill")
    }

    func testSfSymbolNameForQuote() {
        XCTAssertEqual(NotificationReason.quote.sfSymbolName, "quote.opening")
    }

    func testSfSymbolNameForUnknown() {
        XCTAssertEqual(NotificationReason.unknown.sfSymbolName, "bell.fill")
    }

    // MARK: - sfSymbolName Shared Symbols

    func testLikeViaRepostSharesSymbolWithLike() {
        XCTAssertEqual(
            NotificationReason.likeViaRepost.sfSymbolName,
            NotificationReason.like.sfSymbolName,
            "likeViaRepost should share the same SF Symbol as like"
        )
        XCTAssertEqual(NotificationReason.likeViaRepost.sfSymbolName, "heart.fill")
    }

    func testRepostViaRepostSharesSymbolWithRepost() {
        XCTAssertEqual(
            NotificationReason.repostViaRepost.sfSymbolName,
            NotificationReason.repost.sfSymbolName,
            "repostViaRepost should share the same SF Symbol as repost"
        )
        XCTAssertEqual(NotificationReason.repostViaRepost.sfSymbolName, "arrow.2.squarepath")
    }

    func testStarterpackJoinedSharesSymbolWithFollow() {
        XCTAssertEqual(
            NotificationReason.starterpackJoined.sfSymbolName,
            NotificationReason.follow.sfSymbolName,
            "starterpackJoined should share the same SF Symbol as follow"
        )
        XCTAssertEqual(NotificationReason.starterpackJoined.sfSymbolName, "person.badge.plus")
    }
}

// MARK: - NotificationListFilterMatchingTests

class NotificationListFilterMatchingTests: XCTestCase {

    // MARK: - CaseIterable

    func testFilterHasSevenCases() {
        XCTAssertEqual(
            NotificationListFilter.allCases.count,
            7,
            "NotificationListFilter should have exactly 7 cases"
        )
    }

    func testAllCasesContainsExpectedFilters() {
        let allCases = NotificationListFilter.allCases
        XCTAssertTrue(allCases.contains(.all))
        XCTAssertTrue(allCases.contains(.likes))
        XCTAssertTrue(allCases.contains(.reposts))
        XCTAssertTrue(allCases.contains(.replies))
        XCTAssertTrue(allCases.contains(.mentions))
        XCTAssertTrue(allCases.contains(.follows))
        XCTAssertTrue(allCases.contains(.quotes))
    }

    // MARK: - Labels

    func testFilterLabelsAreCapitalized() {
        XCTAssertEqual(NotificationListFilter.all.label, "All")
        XCTAssertEqual(NotificationListFilter.likes.label, "Likes")
        XCTAssertEqual(NotificationListFilter.reposts.label, "Reposts")
        XCTAssertEqual(NotificationListFilter.replies.label, "Replies")
        XCTAssertEqual(NotificationListFilter.mentions.label, "Mentions")
        XCTAssertEqual(NotificationListFilter.follows.label, "Follows")
        XCTAssertEqual(NotificationListFilter.quotes.label, "Quotes")
    }

    // MARK: - matchingReasons

    func testAllFilterMatchingReasonsIsEmpty() {
        XCTAssertTrue(
            NotificationListFilter.all.matchingReasons.isEmpty,
            ".all filter should return an empty matchingReasons array"
        )
    }

    func testLikesFilterMatchingReasonsIncludesLikeAndLikeViaRepost() {
        let reasons = NotificationListFilter.likes.matchingReasons
        XCTAssertEqual(reasons.count, 2)
        XCTAssertTrue(reasons.contains("like"), "likes filter should include 'like'")
        XCTAssertTrue(reasons.contains("like-via-repost"), "likes filter should include 'like-via-repost'")
    }

    func testRepostsFilterMatchingReasonsIncludesRepostAndRepostViaRepost() {
        let reasons = NotificationListFilter.reposts.matchingReasons
        XCTAssertEqual(reasons.count, 2)
        XCTAssertTrue(reasons.contains("repost"), "reposts filter should include 'repost'")
        XCTAssertTrue(reasons.contains("repost-via-repost"), "reposts filter should include 'repost-via-repost'")
    }

    func testRepliesFilterMatchingReasonsIsReplyOnly() {
        let reasons = NotificationListFilter.replies.matchingReasons
        XCTAssertEqual(reasons, ["reply"])
    }

    func testFollowsFilterMatchingReasonsIncludesFollowAndStarterpackJoined() {
        let reasons = NotificationListFilter.follows.matchingReasons
        XCTAssertEqual(reasons.count, 2)
        XCTAssertTrue(reasons.contains("follow"), "follows filter should include 'follow'")
        XCTAssertTrue(reasons.contains("starterpack-joined"), "follows filter should include 'starterpack-joined'")
    }

    func testMentionsFilterMatchingReasonsIsMentionOnly() {
        let reasons = NotificationListFilter.mentions.matchingReasons
        XCTAssertEqual(reasons, ["mention"])
    }

    func testQuotesFilterMatchingReasonsIsQuoteOnly() {
        let reasons = NotificationListFilter.quotes.matchingReasons
        XCTAssertEqual(reasons, ["quote"])
    }
}
