/**
 * Emergence Detection Service
 *
 * Detects forming conversations — threads that didn't exist recently but are
 * growing with high organic author diversity. This is the most valuable signal
 * Network Weather can give: showing what is *becoming* before it has become.
 *
 * Algorithm:
 * 1. Snapshot current trending topics every fetch cycle (5 min)
 * 2. Compare against previous snapshot
 * 3. Topics with no prior match + high growth + high author diversity = emergence
 * 4. Filter out coordinated amplification (low diversity) and slow-burn (low ratio)
 *
 * Emergence criteria:
 * - count_ratio > 3 (growing fast relative to baseline)
 * - author_diversity_ratio > 1.5 (organic, not coordinated)
 * - age < 2h (genuinely new)
 *
 * See: docs/vision/network-weather.md, Layer 4 (Emergence)
 */

// ─── Types ────────────────────────────────────────────────

export interface EmergentThread {
  /** The topic token */
  token: string;
  /** When this thread was first observed (ms) */
  firstSeen: number;
  /** Age in minutes */
  ageMinutes: number;
  /** Count ratio — how fast it's growing vs baseline */
  countRatio: number;
  /** Author diversity ratio — organic spread indicator */
  authorDiversityRatio: number;
  /** Whether this meets full emergence criteria */
  isEmergent: boolean;
  /** 0-1: pulse intensity. Higher = more clearly emergent */
  pulseIntensity: number;
}

export interface EmergenceState {
  /** Threads currently meeting emergence criteria */
  emergentThreads: EmergentThread[];
  /** When this state was computed */
  timestamp: number;
}

interface TopicSnapshot {
  token: string;
  countRatio: number;
  authorDiversityRatio: number;
  timestamp: number;
}

// ─── Emergence Criteria ──────────────────────────────────

const EMERGENCE_COUNT_RATIO_MIN = 3;
const EMERGENCE_DIVERSITY_RATIO_MIN = 1.5;
const EMERGENCE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Snapshot History ────────────────────────────────────

/** Previous snapshots, keyed by token. Kept in memory across fetches. */
const topicHistory: Map<string, TopicSnapshot> = new Map();

/** When we last updated the history */
let lastSnapshotTime = 0;

/** Minimum time between snapshot updates */
const SNAPSHOT_INTERVAL_MS = 4 * 60 * 1000; // 4 min (slightly less than fetch interval)

// ─── Public API ──────────────────────────────────────────

export interface TrendingTopicInput {
  token: string;
  metrics: {
    count_ratio: number;
    author_diversity_ratio: number;
  };
}

/**
 * Detect emergent threads by comparing current trending topics against
 * the previous snapshot. Call this each time trending data is fetched.
 */
export function detectEmergence(
  currentTopics: TrendingTopicInput[],
): EmergenceState {
  const now = Date.now();
  const emergentThreads: EmergentThread[] = [];

  for (const topic of currentTopics) {
    const existing = topicHistory.get(topic.token);

    if (!existing) {
      // New topic — never seen before. Record first sighting.
      // It's a candidate for emergence if it meets the criteria.
      const ageMinutes = 0;
      const countRatio = topic.metrics.count_ratio;
      const authorDiversityRatio = topic.metrics.author_diversity_ratio;

      const isEmergent =
        countRatio > EMERGENCE_COUNT_RATIO_MIN &&
        authorDiversityRatio > EMERGENCE_DIVERSITY_RATIO_MIN;

      if (isEmergent || countRatio > 2) {
        emergentThreads.push({
          token: topic.token,
          firstSeen: now,
          ageMinutes,
          countRatio,
          authorDiversityRatio,
          isEmergent,
          pulseIntensity: isEmergent
            ? computePulseIntensity(countRatio, authorDiversityRatio)
            : 0,
        });
      }
    } else {
      // Known topic — check if it's still young enough to be emergent
      const ageMs = now - existing.timestamp;
      const ageMinutes = Math.round(ageMs / 60000);

      if (ageMs > EMERGENCE_MAX_AGE_MS) {
        // Too old — no longer emergent
        continue;
      }

      const countRatio = topic.metrics.count_ratio;
      const authorDiversityRatio = topic.metrics.author_diversity_ratio;

      const isEmergent =
        countRatio > EMERGENCE_COUNT_RATIO_MIN &&
        authorDiversityRatio > EMERGENCE_DIVERSITY_RATIO_MIN;

      if (isEmergent) {
        emergentThreads.push({
          token: topic.token,
          firstSeen: existing.timestamp,
          ageMinutes,
          countRatio,
          authorDiversityRatio,
          isEmergent: true,
          pulseIntensity: computePulseIntensity(
            countRatio,
            authorDiversityRatio,
          ),
        });
      }
    }
  }

  // Update snapshot history (but not too frequently)
  if (now - lastSnapshotTime > SNAPSHOT_INTERVAL_MS) {
    updateSnapshot(currentTopics, now);
  }

  return {
    emergentThreads,
    timestamp: now,
  };
}

/**
 * Format emergence age for display in reveal view.
 * Returns strings like "forming · 5 min" or "forming · 1h 20 min"
 */
export function formatEmergenceAge(ageMinutes: number): string {
  if (ageMinutes < 1) return "forming · just now";
  if (ageMinutes < 60) return `forming · ${ageMinutes} min`;
  const hours = Math.floor(ageMinutes / 60);
  const mins = ageMinutes % 60;
  if (mins === 0) return `forming · ${hours}h`;
  return `forming · ${hours}h ${mins} min`;
}

/**
 * Clear snapshot history. Useful for testing or resetting state.
 */
export function clearEmergenceHistory(): void {
  topicHistory.clear();
  lastSnapshotTime = 0;
}

// ─── Internal ────────────────────────────────────────────

function updateSnapshot(
  topics: TrendingTopicInput[],
  now: number,
): void {
  // Add new topics, preserve firstSeen for existing ones
  const currentTokens = new Set(topics.map((t) => t.token));

  for (const topic of topics) {
    const existing = topicHistory.get(topic.token);
    topicHistory.set(topic.token, {
      token: topic.token,
      countRatio: topic.metrics.count_ratio,
      authorDiversityRatio: topic.metrics.author_diversity_ratio,
      timestamp: existing ? existing.timestamp : now,
    });
  }

  // Prune topics older than 3h that are no longer trending
  for (const [token, snapshot] of topicHistory) {
    if (!currentTokens.has(token) && now - snapshot.timestamp > 3 * 60 * 60 * 1000) {
      topicHistory.delete(token);
    }
  }

  lastSnapshotTime = now;
}

/**
 * Compute pulse intensity from 0-1 based on how strongly the topic
 * meets emergence criteria. Higher count_ratio and diversity = brighter pulse.
 */
function computePulseIntensity(
  countRatio: number,
  authorDiversityRatio: number,
): number {
  // Normalize: count_ratio 3-10 → 0-1, diversity 1.5-4 → 0-1
  const countNorm = Math.min(1, (countRatio - EMERGENCE_COUNT_RATIO_MIN) / 7);
  const diversityNorm = Math.min(
    1,
    (authorDiversityRatio - EMERGENCE_DIVERSITY_RATIO_MIN) / 2.5,
  );

  // Geometric mean gives balanced weighting
  return Math.sqrt(countNorm * diversityNorm);
}
