import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchGlobalTextile } from "./network-weather-service";

const fetchFromPan = vi.fn();
vi.mock("./pan-api", () => ({
  fetchFromPan: (path: string) => fetchFromPan(path),
}));

function narrative(id: string, label: string, authorCount: number) {
  return {
    id,
    label,
    keywords: [],
    post_count: authorCount * 2,
    author_count: authorCount,
    sentiment_mean: 0,
    sentiment_variance: 0.2,
    age_hours: 48, // warp / enduring
    velocity_ratio: 1,
    author_diversity_ratio: 0.5,
  };
}

function panNarratives(
  narratives: unknown[],
  networkEnergy = 0.6,
  networkConviction = 0.4,
) {
  return {
    success: true,
    data: {
      narratives,
      network_energy: networkEnergy,
      network_conviction: networkConviction,
      detection_time: "2026-08-03T00:00:00Z",
    },
    meta: {},
  };
}

beforeEach(() => {
  fetchFromPan.mockReset();
});

describe("fetchGlobalTextile", () => {
  it("requests the endpoint that actually carries narratives", async () => {
    // Regression: this requested /api/narratives/crossings, whose payload has
    // no `narratives` key, so the transform threw and every caller silently
    // received the empty fallback textile.
    fetchFromPan.mockResolvedValue(
      panNarratives([narrative("1", "Alpha", 10)]),
    );

    const textile = await fetchGlobalTextile();

    expect(fetchFromPan).toHaveBeenCalledWith("/api/narratives");
    expect(textile.source).toBe("pan");
    expect(textile.threads).toHaveLength(1);
  });

  it("collapses duplicate labels into distinct threads", async () => {
    // Pan returns heavy near-duplicates; drawing one band each would read as a
    // far busier network than exists.
    fetchFromPan.mockResolvedValue(
      panNarratives([
        narrative("1", "Same Story", 5),
        narrative("2", "Same Story", 40),
        narrative("3", " same story ", 12), // case/whitespace variant
        narrative("4", "Other Story", 8),
      ]),
    );

    const textile = await fetchGlobalTextile();

    expect(textile.threads).toHaveLength(2);
    // The widest instance of the duplicated label survives.
    const kept = textile.threads.find((t) => t.label === "Same Story");
    expect(kept?.authorCount).toBe(40);
  });

  // network_energy is a ratio against baseline activity, not a 0-1 fraction —
  // Pan reports the same number as the sentiment endpoint's volume_ratio, and
  // it sits above 1 routinely. An earlier guard treated >= 1 as a saturated
  // sensor and substituted neutral, discarding real readings once Pan started
  // reporting properly.
  const luminanceFor = async (energy: number) => {
    fetchFromPan.mockResolvedValue(
      panNarratives([narrative("1", "Alpha", 10)], energy),
    );
    return (await fetchGlobalTextile()).luminance;
  };

  it("puts baseline activity in the middle of the range", async () => {
    expect(await luminanceFor(1.0)).toBeCloseTo(0.5, 5);
  });

  it("brightens above baseline and dims below it", async () => {
    const quiet = await luminanceFor(0.5);
    const baseline = await luminanceFor(1.0);
    const busy = await luminanceFor(2.0);

    expect(quiet).toBeLessThan(baseline);
    expect(baseline).toBeLessThan(busy);
  });

  it("keeps a ratio above 1 as a real reading rather than neutralising it", async () => {
    // Regression: 1.049 is the live value, and used to collapse to 0.4.
    const luminance = await luminanceFor(1.049);

    expect(luminance).not.toBe(0.4);
    expect(luminance).toBeGreaterThan(0.5);
  });

  it("clamps extremes so the wash stays behind text", async () => {
    expect(await luminanceFor(1000)).toBeLessThanOrEqual(0.9);
    expect(await luminanceFor(0.001)).toBeGreaterThanOrEqual(0.15);
  });

  it("falls back to neutral for a nonsensical energy", async () => {
    expect(await luminanceFor(0)).toBe(0.4);
    expect(await luminanceFor(-5)).toBe(0.4);
  });

  it("falls back to an empty textile when Pan returns no narratives", async () => {
    fetchFromPan.mockResolvedValue(panNarratives([]));

    const textile = await fetchGlobalTextile();

    expect(textile.threads).toHaveLength(0);
    // Routes through the empty-textile fallback rather than rendering nothing
    // while claiming to have pan data.
    expect(textile.weatherReport).toBe("Waiting for network signals...");
  });

  it("falls back when Pan is unavailable", async () => {
    fetchFromPan.mockResolvedValue(null); // breaker open

    const textile = await fetchGlobalTextile();

    expect(textile.threads).toHaveLength(0);
  });
});
