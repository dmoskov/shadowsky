export const SKYSIGHT_DID = "did:plc:mp33qrwuvsxucbzoh7kykslu";

export interface CuratedFeed {
  uri: string;
  category: "popular" | "topic" | "cross-platform";
}

export const CURATED_FEEDS: CuratedFeed[] = [
  // Popular / general
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/popular`,
    category: "popular",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/joy`,
    category: "popular",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/pan-curated`,
    category: "popular",
  },

  // Topic feeds
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/ai-agents`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/ai-practitioner`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/science`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/smart-policy`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/policy-insiders`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/economics`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/pure-finance`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/finance-discussion`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/climate-tech`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/global-health`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/effective-altruism`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/girlies`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/maga-troll-detector`,
    category: "topic",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/after-dark`,
    category: "topic",
  },

  // Cross-platform feeds
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/cross-platform`,
    category: "cross-platform",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/arxiv-discussed`,
    category: "cross-platform",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/reddit-discussed`,
    category: "cross-platform",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/youtube-discussed`,
    category: "cross-platform",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/twitter-discussed`,
    category: "cross-platform",
  },
  {
    uri: `at://${SKYSIGHT_DID}/app.bsky.feed.generator/tiktok-discussed`,
    category: "cross-platform",
  },
];

export const CURATED_FEED_URIS = CURATED_FEEDS.map((f) => f.uri);
