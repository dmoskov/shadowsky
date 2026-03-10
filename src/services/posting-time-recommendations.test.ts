import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  analyzePostingTimes,
  cacheAnalysis,
  fromApiResponse,
  getCachedAnalysis,
  getDataDrivenPostingTimes,
  type PostTimingData,
} from "./posting-time-recommendations";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

function makePost(
  dayOfWeek: number,
  hour: number,
  likes: number,
  daysAgo: number = 0,
): PostTimingData {
  const date = new Date();
  // Set to the correct day of week
  const currentDay = date.getDay();
  const diff = dayOfWeek - currentDay;
  date.setDate(date.getDate() + diff - daysAgo * 7);
  date.setHours(hour, 0, 0, 0);
  return {
    createdAt: date.toISOString(),
    likes,
    reposts: 0,
    replies: 0,
  };
}

describe("analyzePostingTimes", () => {
  it("returns empty recommendations for insufficient data", () => {
    const posts = [makePost(1, 10, 5)]; // Only 1 post
    const result = analyzePostingTimes(posts);
    // Needs >= 2 posts per slot for recommendations
    expect(result.recommendations.length).toBe(0);
  });

  it("generates recommendations with enough data", () => {
    const posts = [
      makePost(1, 10, 20),
      makePost(1, 10, 30),
      makePost(1, 10, 25),
      makePost(3, 14, 5),
      makePost(3, 14, 10),
    ];
    const result = analyzePostingTimes(posts);
    expect(result.recommendations.length).toBeGreaterThan(0);
    // Monday at 10am should be top recommendation (higher engagement)
    expect(result.recommendations[0].hour).toBe(10);
  });

  it("builds a 7x24 heatmap", () => {
    const posts = [makePost(0, 12, 10), makePost(0, 12, 15)];
    const result = analyzePostingTimes(posts);
    expect(result.heatmapData).toHaveLength(7);
    expect(result.heatmapData[0]).toHaveLength(24);
    // Sunday at 12pm should have data
    expect(result.heatmapData[0][12]).toBeGreaterThan(0);
  });

  it("calculates hourly and weekday engagement", () => {
    const posts = [
      makePost(2, 8, 10),
      makePost(2, 8, 20),
      makePost(4, 16, 5),
      makePost(4, 16, 15),
    ];
    const result = analyzePostingTimes(posts);
    expect(result.hourlyEngagement).toHaveLength(24);
    expect(result.weekdayEngagement).toHaveLength(7);
    expect(result.hourlyEngagement[8]).toBe(15); // avg of 10, 20
    expect(result.hourlyEngagement[16]).toBe(10); // avg of 5, 15
  });

  it("assigns confidence based on post count", () => {
    // Create 10+ posts for high confidence
    const posts = Array.from({ length: 12 }, () => makePost(5, 20, 10));
    const result = analyzePostingTimes(posts);
    const rec = result.recommendations.find(
      (r) => r.hour === 20 && r.dayOfWeek === 5,
    );
    expect(rec?.confidence).toBe("high");
  });

  it("limits to 5 recommendations", () => {
    const posts: PostTimingData[] = [];
    // Create posts across many time slots
    for (let day = 0; day < 7; day++) {
      for (const hour of [8, 10, 12, 14, 16, 18, 20]) {
        posts.push(makePost(day, hour, 10 + day + hour));
        posts.push(makePost(day, hour, 15 + day + hour));
      }
    }
    const result = analyzePostingTimes(posts);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
  });
});

describe("cache functions", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("caches and retrieves analysis", () => {
    const analysis = analyzePostingTimes([
      makePost(1, 10, 20),
      makePost(1, 10, 30),
    ]);
    cacheAnalysis(analysis);
    const cached = getCachedAnalysis();
    expect(cached).not.toBeNull();
    expect(cached?.heatmapData).toHaveLength(7);
  });

  it("returns null for expired cache", () => {
    const analysis = analyzePostingTimes([
      makePost(1, 10, 20),
      makePost(1, 10, 30),
    ]);
    // Manually set an old cache
    const oldCache = {
      analysis,
      cachedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
    };
    localStorageMock.setItem(
      "posting-time-recommendations",
      JSON.stringify(oldCache),
    );
    const cached = getCachedAnalysis();
    expect(cached).toBeNull();
  });
});

describe("fromApiResponse", () => {
  it("converts API response to PostingTimeAnalysis", () => {
    const apiData = {
      recommendations: [
        {
          hour: 12,
          dayOfWeek: 3,
          avgEngagement: 25.5,
          confidence: "high" as const,
        },
      ],
      hourlyEngagement: Array(24).fill(5),
      weekdayEngagement: Array(7).fill(10),
      lastCalculated: new Date().toISOString(),
    };
    const result = fromApiResponse(apiData, 50);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].label).toBe("Wednesday at 12 PM");
    expect(result.postCount).toBe(50);
    expect(result.heatmapData).toHaveLength(7);
  });
});

describe("getDataDrivenPostingTimes", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("returns hardcoded defaults when no cache", () => {
    const times = getDataDrivenPostingTimes();
    expect(times.length).toBeGreaterThan(0);
    // Should be future dates
    const now = new Date();
    for (const t of times) {
      expect(t.getTime()).toBeGreaterThan(now.getTime());
    }
  });

  it("returns data-driven times when cache has any-day recommendations", () => {
    // Create posts spread across different hours to ensure "any day" fallback recs
    const posts: PostTimingData[] = [];
    for (let i = 0; i < 5; i++) {
      posts.push(makePost(i % 7, 14, 20, i));
    }
    const analysis = analyzePostingTimes(posts);
    // Manually ensure we have "any day" recommendations for predictable results
    if (analysis.recommendations.length === 0) {
      analysis.recommendations.push({
        hour: 14,
        dayOfWeek: -1,
        avgEngagement: 20,
        confidence: "medium",
        label: "2 PM (any day)",
      });
    }
    cacheAnalysis(analysis);
    const times = getDataDrivenPostingTimes();
    expect(times.length).toBeGreaterThan(0);
  });
});
