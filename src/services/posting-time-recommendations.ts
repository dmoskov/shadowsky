/**
 * Posting Time Recommendations Service
 *
 * Aggregates historical engagement data by hour and day-of-week to recommend
 * optimal posting times. Caches results in localStorage with weekly refresh.
 */

import type { OptimalPostingTimes } from "./anthropic";

const CACHE_KEY = "posting-time-recommendations";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface PostTimingData {
  createdAt: string;
  likes: number;
  reposts: number;
  replies: number;
}

export interface TimeSlotEngagement {
  hour: number;
  dayOfWeek: number;
  postCount: number;
  totalEngagement: number;
  avgEngagement: number;
  recentWeight: number;
}

export interface PostingTimeRecommendation {
  hour: number;
  dayOfWeek: number;
  avgEngagement: number;
  confidence: "high" | "medium" | "low";
  label: string;
}

export interface PostingTimeAnalysis {
  recommendations: PostingTimeRecommendation[];
  heatmapData: number[][]; // 7 rows (days) × 24 cols (hours), values = avg engagement
  hourlyEngagement: number[];
  weekdayEngagement: number[];
  lastCalculated: string;
  postCount: number;
}

interface CachedAnalysis {
  analysis: PostingTimeAnalysis;
  cachedAt: string;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

/**
 * Analyze posts to generate posting time recommendations.
 * Weighs recent data higher for more relevant recommendations.
 */
export function analyzePostingTimes(
  posts: PostTimingData[],
): PostingTimeAnalysis {
  // Initialize tracking structures
  const heatmap: {
    count: number;
    engagement: number;
    weightedEng: number;
  }[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({
      count: 0,
      engagement: 0,
      weightedEng: 0,
    })),
  );

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  for (const post of posts) {
    if (!post.createdAt) continue;

    const date = new Date(post.createdAt);
    const hour = date.getHours();
    const dayOfWeek = date.getDay();
    const engagement =
      (post.likes || 0) + (post.reposts || 0) + (post.replies || 0);

    // Recency weight: posts from the last 30 days get 2x weight, older posts get 1x
    const ageMs = now - date.getTime();
    const weight = ageMs < thirtyDaysMs ? 2 : 1;

    const cell = heatmap[dayOfWeek][hour];
    cell.count++;
    cell.engagement += engagement;
    cell.weightedEng += engagement * weight;
  }

  // Build heatmap data (avg engagement per slot)
  const heatmapData: number[][] = heatmap.map((day) =>
    day.map((cell) =>
      cell.count > 0 ? Math.round((cell.engagement / cell.count) * 10) / 10 : 0,
    ),
  );

  // Aggregate hourly engagement
  const hourlyEngagement = Array.from({ length: 24 }, (_, hour) => {
    let totalEng = 0;
    let totalCount = 0;
    for (let day = 0; day < 7; day++) {
      totalEng += heatmap[day][hour].engagement;
      totalCount += heatmap[day][hour].count;
    }
    return totalCount > 0 ? Math.round((totalEng / totalCount) * 10) / 10 : 0;
  });

  // Aggregate weekday engagement
  const weekdayEngagement = Array.from({ length: 7 }, (_, day) => {
    let totalEng = 0;
    let totalCount = 0;
    for (let hour = 0; hour < 24; hour++) {
      totalEng += heatmap[day][hour].engagement;
      totalCount += heatmap[day][hour].count;
    }
    return totalCount > 0 ? Math.round((totalEng / totalCount) * 10) / 10 : 0;
  });

  // Build time slot recommendations with recency weighting
  const slots: TimeSlotEngagement[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const cell = heatmap[day][hour];
      if (cell.count >= 2) {
        slots.push({
          hour,
          dayOfWeek: day,
          postCount: cell.count,
          totalEngagement: cell.engagement,
          avgEngagement: cell.weightedEng / cell.count,
          recentWeight: cell.weightedEng,
        });
      }
    }
  }

  // Sort by weighted engagement (recency-biased)
  slots.sort((a, b) => b.avgEngagement - a.avgEngagement);

  // Take top 5, deduplicating by hour (prefer specific day+hour over generic)
  const recommendations: PostingTimeRecommendation[] = [];
  const usedHours = new Set<string>();

  for (const slot of slots) {
    if (recommendations.length >= 5) break;
    const key = `${slot.dayOfWeek}-${slot.hour}`;
    if (usedHours.has(key)) continue;
    usedHours.add(key);

    const confidence: "high" | "medium" | "low" =
      slot.postCount >= 10 ? "high" : slot.postCount >= 5 ? "medium" : "low";

    recommendations.push({
      hour: slot.hour,
      dayOfWeek: slot.dayOfWeek,
      avgEngagement:
        Math.round((slot.totalEngagement / slot.postCount) * 10) / 10,
      confidence,
      label: `${DAY_NAMES[slot.dayOfWeek]} at ${formatHour(slot.hour)}`,
    });
  }

  // If we have fewer than 5 time-slot recommendations, fill with best hours (any day)
  if (recommendations.length < 5) {
    const hourSlots: { hour: number; count: number; avgEng: number }[] = [];
    for (let hour = 0; hour < 24; hour++) {
      let totalEng = 0;
      let totalCount = 0;
      for (let day = 0; day < 7; day++) {
        totalEng += heatmap[day][hour].weightedEng;
        totalCount += heatmap[day][hour].count;
      }
      if (totalCount >= 2) {
        hourSlots.push({
          hour,
          count: totalCount,
          avgEng: totalEng / totalCount,
        });
      }
    }
    hourSlots.sort((a, b) => b.avgEng - a.avgEng);

    for (const hs of hourSlots) {
      if (recommendations.length >= 5) break;
      // Check we haven't already recommended this hour
      const alreadyUsed = recommendations.some((r) => r.hour === hs.hour);
      if (alreadyUsed) continue;

      const confidence: "high" | "medium" | "low" =
        hs.count >= 10 ? "high" : hs.count >= 5 ? "medium" : "low";

      recommendations.push({
        hour: hs.hour,
        dayOfWeek: -1,
        avgEngagement: Math.round(hs.avgEng * 10) / 10,
        confidence,
        label: `${formatHour(hs.hour)} (any day)`,
      });
    }
  }

  return {
    recommendations,
    heatmapData,
    hourlyEngagement,
    weekdayEngagement,
    lastCalculated: new Date().toISOString(),
    postCount: posts.length,
  };
}

/**
 * Get cached posting time analysis from localStorage
 */
export function getCachedAnalysis(): PostingTimeAnalysis | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cached: CachedAnalysis = JSON.parse(raw);
    const age = Date.now() - new Date(cached.cachedAt).getTime();

    if (age > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cached.analysis;
  } catch {
    return null;
  }
}

/**
 * Cache posting time analysis to localStorage
 */
export function cacheAnalysis(analysis: PostingTimeAnalysis): void {
  try {
    const cached: CachedAnalysis = {
      analysis,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  } catch {
    // localStorage full or unavailable - silently fail
  }
}

/**
 * Convert API OptimalPostingTimes response to our PostingTimeAnalysis format
 */
export function fromApiResponse(
  apiData: OptimalPostingTimes,
  postCount: number,
): PostingTimeAnalysis {
  const recommendations: PostingTimeRecommendation[] =
    apiData.recommendations.map((rec) => ({
      hour: rec.hour,
      dayOfWeek: rec.dayOfWeek,
      avgEngagement: rec.avgEngagement,
      confidence: rec.confidence,
      label:
        rec.dayOfWeek === -1
          ? `${formatHour(rec.hour)} (any day)`
          : `${DAY_NAMES[rec.dayOfWeek]} at ${formatHour(rec.hour)}`,
    }));

  // Build heatmap from hourly + weekday data (approximate since we don't get full slot data from API)
  const heatmapData: number[][] = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const hourAvg = apiData.hourlyEngagement[hour] || 0;
      const dayAvg = apiData.weekdayEngagement[day] || 0;
      // Approximate slot engagement as geometric mean of hour and day averages
      return hourAvg > 0 && dayAvg > 0
        ? Math.round(Math.sqrt(hourAvg * dayAvg) * 10) / 10
        : 0;
    }),
  );

  return {
    recommendations,
    heatmapData,
    hourlyEngagement: apiData.hourlyEngagement,
    weekdayEngagement: apiData.weekdayEngagement,
    lastCalculated: apiData.lastCalculated,
    postCount,
  };
}

/**
 * Get suggested posting times as Date objects (for use by scheduler).
 * Uses cached analysis if available, falls back to hardcoded defaults.
 */
export function getDataDrivenPostingTimes(): Date[] {
  const cached = getCachedAnalysis();
  const now = new Date();
  const suggestions: Date[] = [];

  if (cached && cached.recommendations.length > 0) {
    // Use real recommendations
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      for (const rec of cached.recommendations) {
        const suggestedTime = new Date(now);
        suggestedTime.setDate(suggestedTime.getDate() + dayOffset);

        if (rec.dayOfWeek === -1) {
          // "Any day" recommendation
          suggestedTime.setHours(rec.hour, 0, 0, 0);
        } else {
          // Specific day recommendation - find next occurrence of that day
          const currentDay = suggestedTime.getDay();
          const daysUntil = (rec.dayOfWeek - currentDay + 7) % 7 || 7;
          if (
            dayOffset === 0 &&
            daysUntil === 7 &&
            currentDay === rec.dayOfWeek
          ) {
            suggestedTime.setHours(rec.hour, 0, 0, 0);
          } else {
            continue; // Skip non-matching days for specific day recommendations
          }
        }

        if (suggestedTime > now) {
          suggestions.push(suggestedTime);
        }
      }
    }

    // Sort by date and limit
    suggestions.sort((a, b) => a.getTime() - b.getTime());
    return suggestions.slice(0, 10);
  }

  // Fallback to hardcoded times
  const goodHours = [8, 12, 17, 20];
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    for (const hour of goodHours) {
      const suggestedTime = new Date(now);
      suggestedTime.setDate(suggestedTime.getDate() + dayOffset);
      suggestedTime.setHours(hour, 0, 0, 0);
      if (suggestedTime > now) {
        suggestions.push(suggestedTime);
      }
    }
  }

  return suggestions.slice(0, 10);
}
