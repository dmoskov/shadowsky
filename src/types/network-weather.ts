/**
 * Network Weather Types
 *
 * Data model for the living textile plaid visualization.
 * Threads represent narrative currents; crossings represent
 * where communities meet. The plaid has three view modes:
 * global (whole network), personal (your follows), and gap
 * (differential highlighting).
 *
 * Ref: docs/vision/network-weather.md
 */

// ─── View Modes ──────────────────────────────────────────

export type WeatherViewMode = "global" | "personal" | "gap";

// ─── Thread Character → Palette ──────────────────────────

export type ThreadCharacter =
  | "communal" // ochre / amber
  | "creative" // warm rust
  | "analytical" // deep indigo
  | "educational" // sage green
  | "structural" // slate blue-grey
  | "personal" // sienna
  | "contested" // charcoal
  | "meta"; // ivory / cream

/**
 * HSL color values for each thread character.
 * Earthy, warm tones — "natural dyes on woven cloth."
 */
export const THREAD_PALETTE: Record<
  ThreadCharacter,
  { h: number; s: number; l: number }
> = {
  communal: { h: 38, s: 72, l: 52 }, // ochre/amber
  creative: { h: 16, s: 60, l: 45 }, // warm rust
  analytical: { h: 230, s: 45, l: 35 }, // deep indigo
  educational: { h: 140, s: 30, l: 48 }, // sage green
  structural: { h: 210, s: 25, l: 50 }, // slate blue-grey
  personal: { h: 20, s: 50, l: 42 }, // sienna
  contested: { h: 0, s: 5, l: 30 }, // charcoal
  meta: { h: 42, s: 20, l: 85 }, // ivory/cream
};

// ─── Narrative Thread ────────────────────────────────────

export interface NarrativeThread {
  /** Unique identifier for this narrative cluster */
  id: string;

  /** Short human-readable label (e.g. "decentralization debate") */
  label: string;

  /** Derived character for palette mapping */
  character: ThreadCharacter;

  /** Direction in the weave */
  direction: "warp" | "weft";

  /** Width 0–1, proportional to unique author participation */
  width: number;

  /** Opacity 0–1, from author diversity ratio (concentrated → opaque) */
  opacity: number;

  /** Texture 0–1, from sentiment variance (0 = smooth consensus, 1 = rough disagreement) */
  texture: number;

  /** Unique author count driving this thread */
  authorCount: number;

  /** Post count in this narrative cluster */
  postCount: number;

  /** How long the narrative has been active (hours) */
  ageHours: number;

  /** Velocity: ratio of current volume to baseline */
  velocityRatio: number;

  /** Author DIDs participating in this thread (for personal filtering) */
  authorDids?: string[];

  /** Sample post URIs for deep dive */
  samplePostUris?: string[];
}

// ─── Thread Crossing ─────────────────────────────────────

export interface ThreadCrossing {
  /** Warp thread ID */
  warpId: string;

  /** Weft thread ID */
  weftId: string;

  /** Brightness 0–1, engagement intensity between the two narratives */
  brightness: number;

  /** Number of authors active in both threads */
  sharedAuthorCount: number;
}

// ─── Textile State (full plaid snapshot) ─────────────────

export interface TextileState {
  /** All active narrative threads */
  threads: NarrativeThread[];

  /** Crossing interactions between threads */
  crossings: ThreadCrossing[];

  /** Overall network energy (luminance) 0–1 */
  luminance: number;

  /** Overall conviction (saturation) 0–1 */
  saturation: number;

  /** One-sentence poetic weather summary */
  weatherReport: string;

  /** Timestamp of this snapshot */
  timestamp: number;

  /** Data source */
  source: "pan" | "bluesky" | "synthetic";
}

// ─── Gap Analysis ────────────────────────────────────────

export interface GapThread {
  /** The thread data */
  thread: NarrativeThread;

  /** Gap type: what relationship does this thread have across views? */
  gapType:
    | "missing" // In global but absent from personal → "what am I missing?"
    | "unique" // In personal but not prominent globally → "what does my network uniquely care about?"
    | "amplified" // In both, but much wider in personal → my network over-indexes
    | "diminished"; // In both, but much narrower in personal → my network under-indexes

  /** Ratio of personal width to global width (0 = absent personally, >1 = amplified) */
  personalToGlobalRatio: number;
}

export interface GapAnalysis {
  /** Threads in global but absent/diminished in personal */
  missing: GapThread[];

  /** Threads in personal but absent/diminished globally */
  unique: GapThread[];

  /** Threads with significant width differences */
  amplified: GapThread[];
  diminished: GapThread[];

  /** Overall similarity score 0–1 (how much does your view match the world?) */
  overlapScore: number;
}

// ─── Network Weather State (consumed by components) ──────

export interface NetworkWeatherState {
  /** Current view mode */
  viewMode: WeatherViewMode;

  /** Global textile (all network) */
  globalTextile: TextileState | null;

  /** Personal textile (follows only) */
  personalTextile: TextileState | null;

  /** Gap analysis between global and personal */
  gapAnalysis: GapAnalysis | null;

  /** The textile currently being displayed (based on viewMode) */
  activeTextile: TextileState | null;

  /** Whether data is loading */
  isLoading: boolean;

  /** Error state */
  error: Error | null;

  /** Toggle to next view mode (global → personal → gap → global) */
  cycleViewMode: () => void;

  /** Set specific view mode */
  setViewMode: (mode: WeatherViewMode) => void;
}
