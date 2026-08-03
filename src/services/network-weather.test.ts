import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Pan is stubbed per-test so these cover parsing and degeneracy handling
// without touching the network.
const fetchFromPan = vi.fn();
vi.mock("./pan-api", () => ({
  fetchFromPan: (path: string) => fetchFromPan(path),
}));

const SENTIMENT = "/api/sentiment/latest";
const TRENDING = "/api/trending/topics";
const NARRATIVES = "/api/narratives";

/** A Pan response envelope, as the real API returns it. */
function envelope(data: unknown) {
  return { success: true, data, meta: {} };
}

function topic(token: string, countRatio: number, diversity = 3, authors = 20) {
  return {
    token,
    trend_score: countRatio * 10,
    metrics: {
      hourly_count: authors,
      hourly_unique_authors: authors,
      hourly_engagement: 100,
      count_ratio: countRatio,
      engagement_ratio: 10,
      author_diversity_ratio: diversity,
    },
    sample_posts: [`at://did:plc:x/app.bsky.feed.post/${token}`],
  };
}

function routePan(overrides: Record<string, unknown> = {}) {
  fetchFromPan.mockImplementation((path: string) => {
    for (const [prefix, value] of Object.entries(overrides)) {
      if (path.startsWith(prefix)) return Promise.resolve(value);
    }
    return Promise.resolve(null);
  });
}

async function load() {
  vi.resetModules();
  return await import("./network-weather");
}

// The global test setup (src/tests/setup.ts) replaces localStorage with bare
// vi.fn() stubs that never store anything, so snapshot round-trips can't be
// observed through it. These tests need real read-back behaviour.
function installMemoryStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => Array.from(store.keys())[i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

beforeEach(() => {
  installMemoryStorage();
  fetchFromPan.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function panNarrative(
  id: string,
  label: string,
  authors: number,
  ageHours = 48,
) {
  return {
    id,
    label,
    author_count: authors,
    post_count: authors * 2,
    age_hours: ageHours,
    velocity_ratio: 1,
    author_diversity_ratio: 0.5,
    sentiment_variance: 0.2,
  };
}

describe("narrative sourcing", () => {
  it("reads narratives from the endpoint that carries them", async () => {
    // Regression: narratives were derived from /api/narratives/crossings, which
    // returns no crossings in practice, and were read off the envelope rather
    // than out of `data` — so narratives resolved to null for every user.
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0.1, volume_ratio: 1.2 }),
      [TRENDING]: envelope({ topics: [topic("a", 2), topic("b", 2)] }),
      [NARRATIVES]: envelope({
        narratives: [
          panNarrative("1", "Gaza Ceasefire", 100),
          panNarrative("2", "Election Results", 60),
          panNarrative("3", "New Album Drop", 30, 4), // recent -> weft
        ],
      }),
    });

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    expect(weather.narratives).not.toBeNull();
    expect(weather.narratives?.narratives.map((n) => n.name)).toEqual([
      "Gaza Ceasefire",
      "Election Results",
      "New Album Drop",
    ]);
  });

  it("classifies enduring narratives as warp and recent ones as weft", async () => {
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({ topics: [topic("a", 2)] }),
      [NARRATIVES]: envelope({
        narratives: [
          panNarrative("1", "Long Running Story", 100, 72),
          panNarrative("2", "Just Broke", 50, 2),
        ],
      }),
    });

    const { fetchNetworkWeather } = await load();
    const byName = Object.fromEntries(
      (await fetchNetworkWeather()).narratives!.narratives.map((n) => [
        n.name,
        n.threadType,
      ]),
    );

    expect(byName["Long Running Story"]).toBe("warp");
    expect(byName["Just Broke"]).toBe("weft");
  });

  it("collapses Pan's near-duplicate labels into one narrative", async () => {
    // Live data returns one story restated several times; drawing a band each
    // would invent conversations that don't exist.
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({ topics: [topic("a", 2)] }),
      [NARRATIVES]: envelope({
        narratives: [
          panNarrative("1", "Father's Plea for Areen", 168),
          panNarrative("2", "Father's Plea for Son Areen", 158),
          panNarrative("3", "Father's Plea for Areen's Survival", 149),
        ],
      }),
    });

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    expect(weather.narratives?.narratives).toHaveLength(1);
    expect(weather.narratives?.narratives[0].authorCount).toBe(168);
  });

  it("reports empty rather than pan when Pan has no narratives", async () => {
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({ topics: [topic("a", 2)] }),
      [NARRATIVES]: envelope({ narratives: [] }),
    });

    const { fetchNetworkWeather } = await load();
    expect((await fetchNetworkWeather()).narratives).toBeNull();
  });

  it("still reports pan sentiment and trending", async () => {
    routePan({
      [SENTIMENT]: envelope({
        overall_sentiment: 0.5,
        sentiment_variance: 0.2,
        volume_ratio: 1.1,
        dominant_category: "tech",
      }),
      [TRENDING]: envelope({ topics: [topic("a", 2)] }),
    });

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    expect(weather.source).toBe("pan");
    expect(weather.dominantHue).toBe("indigo"); // from dominant_category "tech"
    expect(weather.warmth).toBeCloseTo(0.75, 2); // (0.5 + 1) / 2
  });
});

describe("degenerate signals fall back instead of being shown", () => {
  it("marks energy unreliable when the formula saturates", async () => {
    // Live data routinely averages count_ratio >= 8, which pins the old
    // formula at 1.0 and makes "energy" meaningless.
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0 }), // no volume_ratio
      [TRENDING]: envelope({ topics: [topic("a", 16), topic("b", 12)] }),
    });

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    expect(weather.energyReliable).toBe(false);
    expect(weather.energy).toBe(0.5);
  });

  it("marks energy unreliable when Pan omits volume_ratio", async () => {
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0 }),
      [TRENDING]: envelope({ topics: [topic("a", 2)] }),
    });

    const { fetchNetworkWeather } = await load();
    expect((await fetchNetworkWeather()).energyReliable).toBe(false);
  });

  it("reports energy when the inputs are actually in range", async () => {
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({ topics: [topic("a", 1.5), topic("b", 1.5)] }),
    });

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    expect(weather.energyReliable).toBe(true);
    expect(weather.energy).toBeGreaterThan(0);
    expect(weather.energy).toBeLessThan(1);
  });

  it("suppresses emergence when it flags most of the board", async () => {
    // Every topic growing fast on a cold start is not a signal.
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({
        topics: ["a", "b", "c", "d"].map((t) => topic(t, 10)),
      }),
    });

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    const flagged = (weather.emergence?.emergentThreads ?? []).filter(
      (t) => t.isEmergent,
    );
    expect(flagged).toHaveLength(0);
  });

  it("keeps emergence when only a minority of topics qualify", async () => {
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({
        // One genuine breakout among four quiet topics.
        topics: [
          topic("breakout", 10),
          topic("calm1", 1),
          topic("calm2", 1),
          topic("calm3", 1),
        ],
      }),
    });

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    const flagged = (weather.emergence?.emergentThreads ?? []).filter(
      (t) => t.isEmergent,
    );
    expect(flagged.map((t) => t.token)).toEqual(["breakout"]);
  });
});

describe("emergence memory across loads", () => {
  it("persists first-seen times so topics stop looking new", async () => {
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({
        topics: [
          topic("breakout", 10),
          topic("calm1", 1),
          topic("calm2", 1),
          topic("calm3", 1),
        ],
      }),
    });

    const first = await load();
    const firstWeather = await first.fetchNetworkWeather();

    // On a cold start the breakout genuinely is new.
    expect(
      firstWeather.emergence?.emergentThreads
        .filter((t) => t.isEmergent)
        .map((t) => t.token),
    ).toEqual(["breakout"]);

    // Snapshots survive the module being torn down, as on a page reload.
    const stored = localStorage.getItem("shadowsky_weather_topic_snapshots");
    expect(stored).toBeTruthy();
    expect(Object.keys(JSON.parse(stored!))).toContain("breakout");

    const second = await load();
    const secondWeather = await second.fetchNetworkWeather();

    // After a reload the topic is remembered, so it is no longer "new" and
    // stops being announced as emerging. Previously the in-memory Map reset on
    // every load, so the same topics were reported as brand new forever.
    expect(
      secondWeather.emergence?.emergentThreads.filter((t) => t.isEmergent),
    ).toHaveLength(0);
  });

  it("ignores snapshots older than a day", async () => {
    localStorage.setItem(
      "shadowsky_weather_topic_snapshots",
      JSON.stringify({
        stale: { timestamp: Date.now() - 48 * 60 * 60 * 1000, countRatio: 5 },
      }),
    );

    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({ topics: [topic("fresh", 1)] }),
    });

    const { fetchNetworkWeather } = await load();
    await fetchNetworkWeather();

    const stored = JSON.parse(
      localStorage.getItem("shadowsky_weather_topic_snapshots")!,
    );
    expect(Object.keys(stored)).not.toContain("stale");
  });

  it("survives corrupt stored snapshots", async () => {
    localStorage.setItem("shadowsky_weather_topic_snapshots", "not json{");
    routePan({
      [SENTIMENT]: envelope({ overall_sentiment: 0, volume_ratio: 1 }),
      [TRENDING]: envelope({ topics: [topic("a", 1)] }),
    });

    const { fetchNetworkWeather } = await load();
    await expect(fetchNetworkWeather()).resolves.toBeTruthy();
  });
});

describe("when Pan is unavailable", () => {
  it("falls back without claiming an energy reading", async () => {
    routePan(); // every path resolves null

    const { fetchNetworkWeather } = await load();
    const weather = await fetchNetworkWeather();

    expect(weather.source).toBe("fallback");
    expect(weather.energyReliable).toBe(false);
    expect(weather.narratives).toBeNull();
  });
});
