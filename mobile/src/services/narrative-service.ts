/**
 * Narrative Service
 *
 * Fetches narrative clusters and their crossings from Pan's API.
 * Drives the full textile rendering (v0.3+).
 *
 * See: docs/vision/network-weather.md
 */

import { fetchWithTimeout } from "../utils/with-timeout";
import { createLogger } from "../utils/logger";

const logger = createLogger("NarrativeService");

const PAN_API_URLS = [
  "https://api.asphodel.is",
  "https://api.shadowsky.io",
];

// ─── Types ────────────────────────────────────────────────

export interface Narrative {
  id: string;
  name: string;
  /** Number of unique authors in this narrative */
  authorCount: number;
  /** Normalized 0-1: how many authors vs the largest narrative */
  authorWeight: number;
  /** Hours since this narrative first appeared */
  ageHours: number;
  /** "warp" (enduring, >24h) or "weft" (emergent, <6h). Between = warp. */
  threadType: "warp" | "weft";
}

export interface NarrativeCrossing {
  narrativeA: string; // id
  narrativeB: string; // id
  sharedAuthors: number;
  overlapRatio: number; // 0-1
}

export interface NarrativeState {
  narratives: Narrative[];
  crossings: NarrativeCrossing[];
  timestamp: number;
  source: "pan" | "empty";
}

// ─── Pan API Types ────────────────────────────────────────

interface PanCrossing {
  narrative_a: { id: string; name: string };
  narrative_b: { id: string; name: string };
  shared_authors: number;
  overlap_ratio: number;
}

interface PanCrossingsResponse {
  crossings: PanCrossing[];
  computed_at?: string;
  count?: number;
}

// ─── Fetch ────────────────────────────────────────────────

async function fetchPan(path: string): Promise<any> {
  for (const baseUrl of PAN_API_URLS) {
    try {
      const resp = await fetchWithTimeout(
        `${baseUrl}${path}`,
        { headers: { Accept: "application/json" } },
        5000
      );
      if (!resp.ok) continue;
      return await resp.json();
    } catch {
      continue;
    }
  }
  return null;
}

// ─── Main Fetch ──────────────────────────────────────────

export async function fetchNarratives(): Promise<NarrativeState> {
  try {
    const crossingsResp: PanCrossingsResponse | null = await fetchPan(
      "/api/narratives/crossings?min_overlap=0.05&min_shared=1&limit=50"
    );

    if (!crossingsResp || !crossingsResp.crossings || crossingsResp.crossings.length === 0) {
      return { narratives: [], crossings: [], timestamp: Date.now(), source: "empty" };
    }

    // Extract unique narratives from crossings response
    const narrativeMap = new Map<string, { id: string; name: string; sharedTotal: number }>();

    for (const c of crossingsResp.crossings) {
      for (const n of [c.narrative_a, c.narrative_b]) {
        const existing = narrativeMap.get(n.id);
        if (existing) {
          existing.sharedTotal += c.shared_authors;
        } else {
          narrativeMap.set(n.id, { id: n.id, name: n.name, sharedTotal: c.shared_authors });
        }
      }
    }

    // Compute max shared for normalization
    const maxShared = Math.max(...Array.from(narrativeMap.values()).map(n => n.sharedTotal), 1);

    const narratives: Narrative[] = Array.from(narrativeMap.values()).map(n => ({
      id: n.id,
      name: n.name,
      authorCount: n.sharedTotal,
      authorWeight: n.sharedTotal / maxShared,
      ageHours: 12, // Default — Pan doesn't provide age in crossings response yet
      threadType: "warp" as const, // Default to warp; will refine when Pan provides age data
    }));

    // Classify: top half by weight as warp (vertical), bottom half as weft (horizontal)
    narratives.sort((a, b) => b.authorWeight - a.authorWeight);
    const midpoint = Math.ceil(narratives.length / 2);
    narratives.forEach((n, i) => {
      n.threadType = i < midpoint ? "warp" : "weft";
    });

    const crossings: NarrativeCrossing[] = crossingsResp.crossings.map(c => ({
      narrativeA: c.narrative_a.id,
      narrativeB: c.narrative_b.id,
      sharedAuthors: c.shared_authors,
      overlapRatio: c.overlap_ratio,
    }));

    return {
      narratives,
      crossings,
      timestamp: Date.now(),
      source: "pan",
    };
  } catch (error) {
    logger.warn("Failed to fetch narratives:", error);
    return { narratives: [], crossings: [], timestamp: Date.now(), source: "empty" };
  }
}
