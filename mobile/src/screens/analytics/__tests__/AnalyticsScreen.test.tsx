import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { mockTheme } from "../../../components/__tests__/test-utils";

// ─── Module mocks ──────────────────────────────────────────

jest.mock("../../../contexts/ThemeContext", () => ({
  useTheme: () => mockTheme,
}));

jest.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => ({ account: { did: "did:plc:myself" } }),
}));

const mockRouterPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
  }),
}));

jest.mock("../../../hooks/useNavigation", () => ({
  useAppNavigation: () => ({ navigateToProfile: jest.fn() }),
}));

jest.mock("../../../components/PostCard", () => ({
  PostCard: (props: any) => {
    const { View, Text } = require("react-native");
    const text =
      props.post?.post?.record?.text || props.post?.record?.text || "Post";
    return (
      <View testID="post-card">
        <Text>{text}</Text>
      </View>
    );
  },
}));

jest.mock("../../../components/SkeletonShimmer", () => ({
  SkeletonShimmer: () => {
    const { View } = require("react-native");
    return <View testID="skeleton-shimmer" />;
  },
}));

jest.mock("date-fns", () => ({
  format: jest.fn((_date: any, _fmt: string) => "2025-01-01"),
}));

let mockAnalytics: any = null;
let mockIsLoading = true;
let mockError: any = null;
const mockRefetch = jest.fn();
let mockIsRefetching = false;

let mockAnalysisData: any = null;
let mockIsLoadingAnalysis = false;

jest.mock("../../../hooks/api/useAnalytics", () => ({
  useUserAnalytics: () => ({
    data: mockAnalytics,
    isLoading: mockIsLoading,
    error: mockError,
    refetch: mockRefetch,
    isRefetching: mockIsRefetching,
  }),
  usePostAnalysis: () => ({
    data: mockAnalysisData,
    isLoading: mockIsLoadingAnalysis,
  }),
}));

// ─── Import after mocks ────────────────────────────────────

import { AnalyticsScreen } from "../AnalyticsScreen";

// ─── Factory ───────────────────────────────────────────────

function makeAnalytics(overrides: Record<string, any> = {}) {
  return {
    followersCount: 1234,
    followsCount: 567,
    newFollowers: 56,
    likesReceived: 789,
    repostsReceived: 234,
    repliesReceived: 123,
    engagementRate: 4.56,
    impressions: 1146,
    postsCount: 5,
    topPosts: [
      {
        post: {
          uri: "at://did:plc:myself/app.bsky.feed.post/post1",
          cid: "cid-1",
          author: {
            did: "did:plc:myself",
            handle: "myself.bsky.social",
            displayName: "Me",
          },
          record: {
            text: "My top post",
            createdAt: "2025-01-01T12:00:00Z",
          },
          replyCount: 25,
          repostCount: 50,
          likeCount: 100,
          indexedAt: "2025-01-01T12:00:00Z",
          labels: [],
          viewer: {},
        },
      },
    ],
    dailyEngagement: [
      {
        date: "2025-01-01",
        likes: 10,
        reposts: 5,
        replies: 3,
        posts: 2,
        originalPosts: 1,
        replyPosts: 1,
      },
      {
        date: "2025-01-02",
        likes: 15,
        reposts: 8,
        replies: 5,
        posts: 3,
        originalPosts: 2,
        replyPosts: 1,
      },
    ],
    postingTimes: {
      hourEngagement: Array(24)
        .fill(0)
        .map((_, i) => (i < 12 ? i * 10 : (24 - i) * 8)),
      bestHours: [10, 14, 18],
      bestEngagementHour: 10,
      mostActiveHour: 14,
      hourCounts: Array(24)
        .fill(0)
        .map((_, i) => (i === 14 ? 5 : i === 10 ? 3 : 1)),
    },
    postsForAnalysis: [
      {
        text: "Test post",
        createdAt: "2025-01-01T12:00:00Z",
        likes: 10,
        reposts: 5,
        replies: 3,
      },
    ],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────

describe("AnalyticsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAnalytics = null;
    mockIsLoading = true;
    mockError = null;
    mockIsRefetching = false;
    mockAnalysisData = null;
    mockIsLoadingAnalysis = false;
  });

  // ─── Loading state ─────────────────────────────────────
  describe("loading state", () => {
    it("renders skeleton shimmer cards while loading", () => {
      mockIsLoading = true;
      mockAnalytics = null;

      const { getAllByTestId } = render(<AnalyticsScreen />);
      const skeletons = getAllByTestId("skeleton-shimmer");
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render metric cards while loading", () => {
      mockIsLoading = true;
      mockAnalytics = null;

      const { queryByText } = render(<AnalyticsScreen />);
      expect(queryByText("Followers")).toBeNull();
      expect(queryByText("Likes")).toBeNull();
    });
  });

  // ─── Error state ───────────────────────────────────────
  describe("error state", () => {
    it("renders error message when analytics fail to load", () => {
      mockIsLoading = false;
      mockError = new Error("Network error");
      mockAnalytics = null;

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Failed to load analytics")).toBeTruthy();
    });

    it("renders the specific error message from the Error object", () => {
      mockIsLoading = false;
      mockError = new Error("Server returned 500");
      mockAnalytics = null;

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Server returned 500")).toBeTruthy();
    });

    it('renders "Unknown error" when error is not an Error instance', () => {
      mockIsLoading = false;
      mockError = "some string error";
      mockAnalytics = null;

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Failed to load analytics")).toBeTruthy();
      expect(getByText("Unknown error")).toBeTruthy();
    });
  });

  // ─── Time range buttons ────────────────────────────────
  describe("time range selector", () => {
    it("renders all four time range buttons", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("24h")).toBeTruthy();
      expect(getByText("7 Days")).toBeTruthy();
      expect(getByText("30 Days")).toBeTruthy();
      expect(getByText("90 Days")).toBeTruthy();
    });

    it("changes selection when a time range button is tapped", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);

      // The default timeRange is "week" which corresponds to "7 Days".
      // Tapping "24h" should change the selection (no crash, re-renders).
      fireEvent.press(getByText("24h"));

      // The button should still be visible after pressing
      expect(getByText("24h")).toBeTruthy();
    });

    it("can cycle through all time range options", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);

      fireEvent.press(getByText("24h"));
      fireEvent.press(getByText("30 Days"));
      fireEvent.press(getByText("90 Days"));
      fireEvent.press(getByText("7 Days"));

      // All buttons remain rendered after cycling
      expect(getByText("24h")).toBeTruthy();
      expect(getByText("7 Days")).toBeTruthy();
      expect(getByText("30 Days")).toBeTruthy();
      expect(getByText("90 Days")).toBeTruthy();
    });
  });

  // ─── Metric display ────────────────────────────────────
  describe("metric display", () => {
    it("renders followers count", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({ followersCount: 1234 });

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Followers")).toBeTruthy();
      expect(getByText("1,234")).toBeTruthy();
    });

    it("renders following count", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({ followsCount: 567 });

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Following")).toBeTruthy();
      expect(getByText("567")).toBeTruthy();
    });

    it("renders likes count", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({ likesReceived: 789 });

      const { getAllByText, getByText } = render(<AnalyticsScreen />);
      // "Likes" appears in the metric card and also in chart legend / top post stats
      const likesLabels = getAllByText("Likes");
      expect(likesLabels.length).toBeGreaterThanOrEqual(1);
      expect(getByText("789")).toBeTruthy();
    });

    it("renders reposts count", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({ repostsReceived: 234 });

      const { getAllByText, getByText } = render(<AnalyticsScreen />);
      // "Reposts" appears in metric card and in chart legend / top post stats
      const repostsLabels = getAllByText("Reposts");
      expect(repostsLabels.length).toBeGreaterThanOrEqual(1);
      expect(getByText("234")).toBeTruthy();
    });

    it("renders replies count", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({ repliesReceived: 123 });

      const { getAllByText, getByText } = render(<AnalyticsScreen />);
      // "Replies" appears in metric card and in chart legend / top post stats
      const repliesLabels = getAllByText("Replies");
      expect(repliesLabels.length).toBeGreaterThanOrEqual(1);
      expect(getByText("123")).toBeTruthy();
    });

    it("renders engagement rate with one decimal place", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({ engagementRate: 4.56 });

      const { getByText, getAllByText } = render(<AnalyticsScreen />);
      expect(getByText("Engagement Rate")).toBeTruthy();
      // "4.6" appears in the metric card and in the summary bar
      const engagementValues = getAllByText("4.6");
      expect(engagementValues.length).toBeGreaterThanOrEqual(1);
      expect(getAllByText("avg per post").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Top posts ─────────────────────────────────────────
  describe("top posts", () => {
    it("renders the top performing posts section", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText, getAllByTestId } = render(<AnalyticsScreen />);
      expect(getByText("Top Performing Posts")).toBeTruthy();
      expect(getAllByTestId("post-card").length).toBe(1);
    });

    it("renders post card with correct text", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("My top post")).toBeTruthy();
    });

    it("renders post stats (likes, reposts, replies) for top posts", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      // The top post stats section shows likeCount/repostCount/replyCount
      expect(getByText("100")).toBeTruthy();
      expect(getByText("50")).toBeTruthy();
      expect(getByText("25")).toBeTruthy();
    });
  });

  // ─── Empty posts state ─────────────────────────────────
  describe("empty posts state", () => {
    it('renders "No posts in this time period" when topPosts is empty', () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({
        topPosts: [],
        postsCount: 0,
        dailyEngagement: [],
      });

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("No posts in this time period")).toBeTruthy();
      expect(getByText("Try selecting a different time range")).toBeTruthy();
    });

    it("does not render Top Performing Posts section when topPosts is empty", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({
        topPosts: [],
        postsCount: 0,
        dailyEngagement: [],
      });

      const { queryByText } = render(<AnalyticsScreen />);
      expect(queryByText("Top Performing Posts")).toBeNull();
    });
  });

  // ─── No analytics data ────────────────────────────────
  describe("no analytics data", () => {
    it('renders "No analytics data available" when analytics is null after loading', () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = null;

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("No analytics data available")).toBeTruthy();
    });
  });

  // ─── Charts and sections ──────────────────────────────
  describe("charts and sections", () => {
    it("renders Engagement Over Time section when dailyEngagement has data", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Engagement Over Time")).toBeTruthy();
    });

    it("renders Posting Frequency section when dailyEngagement has data", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Posting Frequency")).toBeTruthy();
    });

    it("does not render chart sections when dailyEngagement has only one entry", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({
        dailyEngagement: [
          {
            date: "2025-01-01",
            likes: 10,
            reposts: 5,
            replies: 3,
            posts: 2,
          },
        ],
      });

      const { queryByText } = render(<AnalyticsScreen />);
      expect(queryByText("Engagement Over Time")).toBeNull();
      expect(queryByText("Posting Frequency")).toBeNull();
    });
  });

  // ─── AI Analysis section ──────────────────────────────
  describe("AI analysis section", () => {
    it("renders the AI Content Analysis section with Analyze button", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("AI Content Analysis")).toBeTruthy();
      expect(getByText("Analyze")).toBeTruthy();
      expect(getByText("Get AI-Powered Insights")).toBeTruthy();
    });

    it("hides the Analyze button after it is pressed", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText, queryByText } = render(<AnalyticsScreen />);
      fireEvent.press(getByText("Analyze"));
      expect(queryByText("Analyze")).toBeNull();
    });
  });

  // ─── Render stability ─────────────────────────────────
  describe("render stability", () => {
    it("renders without crashing in loading state", () => {
      mockIsLoading = true;
      mockAnalytics = null;

      expect(() => render(<AnalyticsScreen />)).not.toThrow();
    });

    it("renders without crashing in error state", () => {
      mockIsLoading = false;
      mockError = new Error("test");
      mockAnalytics = null;

      expect(() => render(<AnalyticsScreen />)).not.toThrow();
    });

    it("renders without crashing with full analytics data", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      expect(() => render(<AnalyticsScreen />)).not.toThrow();
    });

    it("renders without crashing when analytics data has empty top posts", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({
        topPosts: [],
        postsCount: 0,
        dailyEngagement: [],
      });

      expect(() => render(<AnalyticsScreen />)).not.toThrow();
    });

    it("renders without crashing with zero engagement rate", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({
        engagementRate: 0,
        followersCount: 0,
        likesReceived: 0,
        repostsReceived: 0,
        repliesReceived: 0,
      });

      expect(() => render(<AnalyticsScreen />)).not.toThrow();
    });
  });

  // ─── Summary bar ──────────────────────────────────────
  describe("summary bar", () => {
    it("renders summary bar with post count and date range", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      // The summary bar shows "Showing X posts from <start> to <end>"
      // date-fns format is mocked to return "2025-01-01"
      expect(
        getByText(/Showing 5 posts from 2025-01-01 to 2025-01-01/),
      ).toBeTruthy();
    });

    it("renders total engagement in summary bar", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics({ impressions: 1146 });

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("1,146")).toBeTruthy();
      expect(getByText(" total engagement")).toBeTruthy();
    });
  });

  // ─── Best posting times ────────────────────────────────
  describe("best posting times", () => {
    it("renders Best Posting Times section when postsCount > 0", () => {
      mockIsLoading = false;
      mockError = null;
      mockAnalytics = makeAnalytics();

      const { getByText } = render(<AnalyticsScreen />);
      expect(getByText("Best Posting Times")).toBeTruthy();
      expect(getByText("Highest Engagement")).toBeTruthy();
      expect(getByText("Most Active Hour")).toBeTruthy();
    });
  });
});
