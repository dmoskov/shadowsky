/**
 * Bluesky Firehose Consumer
 *
 * Connects to the Bluesky Jetstream WebSocket endpoint to receive
 * real-time post events. Extracts hashtags and significant terms
 * for trending topic aggregation.
 *
 * Uses Jetstream (https://docs.bsky.app/blog/jetstream) which provides
 * a lightweight, filtered view of the AT Protocol firehose.
 */

const WebSocket = require("ws");
const { EventEmitter } = require("events");

// Jetstream public endpoints
const JETSTREAM_ENDPOINTS = [
  "wss://jetstream1.us-east.bsky.network/subscribe",
  "wss://jetstream2.us-east.bsky.network/subscribe",
  "wss://jetstream1.us-west.bsky.network/subscribe",
  "wss://jetstream2.us-west.bsky.network/subscribe",
];

// Common English stop words to filter from topic extraction
const STOP_WORDS = new Set([
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
  "was",
  "is",
  "are",
  "been",
  "has",
  "had",
  "did",
  "got",
  "am",
  "were",
  "being",
  "does",
  "done",
  "doing",
  "very",
  "much",
  "too",
  "really",
  "don't",
  "dont",
  "doesn't",
  "doesnt",
  "didn't",
  "didnt",
  "can't",
  "cant",
  "won't",
  "wont",
  "isn't",
  "isnt",
  "aren't",
  "arent",
  "wasn't",
  "wasnt",
  "weren't",
  "werent",
  "haven't",
  "havent",
  "hasn't",
  "hasnt",
  "hadn't",
  "hadnt",
  "wouldn't",
  "wouldnt",
  "shouldn't",
  "shouldnt",
  "couldn't",
  "couldnt",
  "gonna",
  "gotta",
  "wanna",
  "lol",
  "lmao",
  "omg",
  "yeah",
  "yes",
  "nah",
  "nope",
  "okay",
  "ok",
  "oh",
  "hey",
  "hi",
  "hello",
  "bye",
  "please",
  "thanks",
  "thank",
  "sorry",
  "right",
  "thing",
  "things",
  "say",
  "said",
  "im",
  "i'm",
  "it's",
  "that's",
  "thats",
  "here",
  "still",
  "already",
  "maybe",
  "never",
  "always",
  "every",
  "going",
  "been",
  "being",
  "let",
  "put",
  "own",
  "got",
  "go",
  "been",
  "having",
  "lot",
]);

class FirehoseConsumer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 50;
    this.reconnectBaseDelay = options.reconnectBaseDelay || 1000;
    this.maxReconnectDelay = options.maxReconnectDelay || 60000;
    this.endpointIndex = 0;
    this.running = false;
    this.cursor = null;
    this.reconnectTimer = null;

    // Sampling: process every Nth message if volume is too high
    this.sampleRate = options.sampleRate || 1; // 1 = process all
    this.messageCount = 0;

    // Metrics
    this.metrics = {
      messagesReceived: 0,
      messagesProcessed: 0,
      postsExtracted: 0,
      hashtagsFound: 0,
      errors: 0,
      lastMessageAt: null,
      connectedAt: null,
      reconnects: 0,
    };
  }

  /**
   * Start consuming the firehose
   */
  start() {
    if (this.running) return;
    this.running = true;
    this._connect();
  }

  /**
   * Stop consuming and close the connection
   */
  stop() {
    this.running = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Consumer shutting down");
      this.ws = null;
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this.metrics.connectedAt
        ? Date.now() - this.metrics.connectedAt
        : 0,
      sampleRate: this.sampleRate,
      running: this.running,
    };
  }

  /**
   * Adjust sample rate dynamically based on processing capacity
   */
  setSampleRate(rate) {
    this.sampleRate = Math.max(1, Math.floor(rate));
  }

  /**
   * Connect to a Jetstream endpoint
   * @private
   */
  _connect() {
    if (!this.running) return;

    const endpoint = JETSTREAM_ENDPOINTS[this.endpointIndex];
    // Subscribe only to app.bsky.feed.post create events
    const url = new URL(endpoint);
    url.searchParams.set("wantedCollections", "app.bsky.feed.post");
    if (this.cursor) {
      url.searchParams.set("cursor", this.cursor);
    }

    try {
      this.ws = new WebSocket(url.toString());
    } catch (err) {
      this.metrics.errors++;
      this._scheduleReconnect();
      return;
    }

    this.ws.on("open", () => {
      this.reconnectAttempts = 0;
      this.metrics.connectedAt = Date.now();
      this.emit("connected", { endpoint });
    });

    this.ws.on("message", (data) => {
      this.metrics.messagesReceived++;
      this.messageCount++;

      // Sampling: skip messages if sample rate > 1
      if (this.sampleRate > 1 && this.messageCount % this.sampleRate !== 0) {
        return;
      }

      try {
        const event = JSON.parse(data);
        this._processEvent(event);
        this.metrics.messagesProcessed++;
        this.metrics.lastMessageAt = Date.now();
      } catch (err) {
        this.metrics.errors++;
      }
    });

    this.ws.on("close", (code, reason) => {
      this.metrics.connectedAt = null;
      this.emit("disconnected", {
        code,
        reason: reason?.toString() || "unknown",
      });
      if (this.running) {
        this._scheduleReconnect();
      }
    });

    this.ws.on("error", (err) => {
      this.metrics.errors++;
      this.emit("error", err);
    });
  }

  /**
   * Schedule a reconnection with exponential backoff
   * @private
   */
  _scheduleReconnect() {
    if (!this.running) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit("maxReconnectsReached");
      // Reset and try again after a long delay
      this.reconnectAttempts = 0;
      this.reconnectTimer = setTimeout(() => {
        this._connect();
      }, this.maxReconnectDelay * 2);
      return;
    }

    this.reconnectAttempts++;
    this.metrics.reconnects++;
    // Rotate endpoints on reconnect
    this.endpointIndex = (this.endpointIndex + 1) % JETSTREAM_ENDPOINTS.length;

    const delay = Math.min(
      this.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    );

    const jitter = delay * 0.2 * Math.random();

    this.reconnectTimer = setTimeout(() => {
      this._connect();
    }, delay + jitter);
  }

  /**
   * Process a Jetstream event
   * @private
   */
  _processEvent(event) {
    // Update cursor for resumption
    if (event.time_us) {
      this.cursor = event.time_us;
    }

    // We only care about create events for posts
    if (
      event.kind !== "commit" ||
      event.commit?.operation !== "create" ||
      event.commit?.collection !== "app.bsky.feed.post"
    ) {
      return;
    }

    const record = event.commit?.record;
    if (!record || !record.text) return;

    const text = record.text;
    const langs = record.langs || [];
    const createdAt = record.createdAt || new Date().toISOString();

    // Extract hashtags from facets (structured data, most reliable)
    const hashtags = this._extractHashtagsFromFacets(record.facets);

    // Also extract hashtags from text as fallback
    const textHashtags = this._extractHashtagsFromText(text);

    // Merge, preferring facet hashtags
    const allHashtags = new Set([...hashtags, ...textHashtags]);

    // Extract significant terms/topics from text
    const topics = this._extractTopics(text);

    if (allHashtags.size > 0 || topics.length > 0) {
      this.metrics.postsExtracted++;
      this.metrics.hashtagsFound += allHashtags.size;

      this.emit("post", {
        hashtags: Array.from(allHashtags),
        topics,
        langs,
        createdAt,
        did: event.did,
      });
    }
  }

  /**
   * Extract hashtags from AT Protocol facets (structured metadata)
   * @private
   */
  _extractHashtagsFromFacets(facets) {
    const hashtags = [];
    if (!Array.isArray(facets)) return hashtags;

    for (const facet of facets) {
      if (!Array.isArray(facet.features)) continue;
      for (const feature of facet.features) {
        if (feature.$type === "app.bsky.richtext.facet#tag" && feature.tag) {
          const normalized = feature.tag.toLowerCase().trim();
          if (normalized.length >= 2 && normalized.length <= 100) {
            hashtags.push(normalized);
          }
        }
      }
    }
    return hashtags;
  }

  /**
   * Extract hashtags from post text using regex
   * @private
   */
  _extractHashtagsFromText(text) {
    const hashtags = [];
    // Match #hashtag patterns (Unicode-aware)
    const regex = /#([\p{L}\p{N}_]{2,50})/gu;
    let match;
    while ((match = regex.exec(text)) !== null) {
      hashtags.push(match[1].toLowerCase());
    }
    return hashtags;
  }

  /**
   * Extract significant topic terms from post text
   * @private
   */
  _extractTopics(text) {
    // Remove URLs
    const cleaned = text
      .replace(/https?:\/\/\S+/g, "")
      .replace(/#[\p{L}\p{N}_]+/gu, "") // Remove hashtags (handled separately)
      .replace(/@[\w.]+/g, "") // Remove mentions
      .replace(/[^\p{L}\p{N}\s'-]/gu, " ") // Keep letters, numbers, spaces
      .toLowerCase();

    const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);

    // Extract bigrams (two-word phrases) that might be topics
    const topics = [];
    for (let i = 0; i < words.length - 1; i++) {
      const w1 = words[i];
      const w2 = words[i + 1];
      if (!STOP_WORDS.has(w1) && !STOP_WORDS.has(w2)) {
        if (w1.length >= 3 && w2.length >= 3) {
          topics.push(`${w1} ${w2}`);
        }
      }
    }

    // Also include significant single words (4+ chars, not stop words)
    for (const word of words) {
      if (word.length >= 4 && !STOP_WORDS.has(word)) {
        topics.push(word);
      }
    }

    return topics.slice(0, 10); // Limit topics per post
  }
}

module.exports = { FirehoseConsumer };
