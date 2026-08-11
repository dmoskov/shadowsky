/**
 * Mock for `@atproto/api` used by the mobile Jest suite.
 *
 * Why: @atproto/api's real dependency tree (multiformats@13, uint8arrays@5)
 * uses modern `exports`/`imports` maps with `import`/`node`-only conditions and
 * `#`-internal specifiers that the React Native Jest resolver can't follow, so
 * importing the real module makes every suite fail to load.
 *
 * Strategy:
 *  - Namespaces with lexicon type guards (AppBskyEmbed*, AppBskyFeedDefs, …)
 *    get real `isX(v)` guards that check `v.$type` against the namespace NSID,
 *    so component/serializer logic that branches on embed/reason type works.
 *  - `RichText` is a minimal real implementation (segments() over facets) since
 *    rich-text rendering is exercised directly.
 *  - Everything else resolves to a callable/newable stub.
 */

// NSID for namespaces whose type guards (isX) we want to honor.
const NSID = {
  AppBskyActorDefs: "app.bsky.actor.defs",
  AppBskyDraftDefs: "app.bsky.draft.defs",
  AppBskyEmbedExternal: "app.bsky.embed.external",
  AppBskyEmbedImages: "app.bsky.embed.images",
  AppBskyEmbedRecord: "app.bsky.embed.record",
  AppBskyEmbedRecordWithMedia: "app.bsky.embed.recordWithMedia",
  AppBskyEmbedVideo: "app.bsky.embed.video",
  AppBskyFeedDefs: "app.bsky.feed.defs",
  AppBskyFeedGetLikes: "app.bsky.feed.getLikes",
  AppBskyFeedPost: "app.bsky.feed.post",
  AppBskyGraphDefs: "app.bsky.graph.defs",
  AppBskyNotificationListNotifications: "app.bsky.notification.listNotifications",
  AppBskyRichtextFacet: "app.bsky.richtext.facet",
  ComAtprotoLabelDefs: "com.atproto.label.defs",
};

function lowerFirst(s) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function createStub() {
  const target = function stub() {};
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === "prototype") return target.prototype;
      if (prop === "then" || typeof prop === "symbol") return undefined;
      if (typeof prop === "string" && (/^is[A-Z]/.test(prop) || /^validate/.test(prop))) {
        return () => false;
      }
      return createStub();
    },
    apply() {
      return undefined;
    },
    construct() {
      return new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then" || typeof prop === "symbol") return undefined;
            return createStub();
          },
        },
      );
    },
  });
}

// A namespace object whose `isX(v)` guards check v.$type === `${nsid}#x`.
function makeNamespace(nsid) {
  return new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== "string") return undefined;
        if (/^is[A-Z]/.test(prop)) {
          const frag = lowerFirst(prop.slice(2));
          return (v) => {
            if (!v || typeof v !== "object") return false;
            // Record / main object types are identified by the bare NSID
            // (e.g. app.bsky.feed.post) or its #main fragment, not "#record".
            if (frag === "record" || frag === "main") {
              return v.$type === nsid || v.$type === `${nsid}#main`;
            }
            return v.$type === `${nsid}#${frag}`;
          };
        }
        if (/^validate/.test(prop)) {
          return () => ({ success: true, value: undefined });
        }
        return createStub();
      },
    },
  );
}

// --- Minimal RichText with facet-aware segments() -------------------------
function featureOfType(facet, suffix) {
  return (facet?.features || []).find(
    (f) => typeof f?.$type === "string" && f.$type.endsWith(suffix),
  );
}

class RichTextSegment {
  constructor(text, facet) {
    this.text = text;
    this.facet = facet;
  }
  get mention() {
    return featureOfType(this.facet, "#mention");
  }
  get link() {
    return featureOfType(this.facet, "#link");
  }
  get tag() {
    return featureOfType(this.facet, "#tag");
  }
  isMention() {
    return !!this.mention;
  }
  isLink() {
    return !!this.link;
  }
  isTag() {
    return !!this.tag;
  }
}

class RichText {
  constructor({ text, facets } = {}) {
    this.text = text || "";
    this.facets = facets;
  }

  /**
   * Grapheme count, as the real RichText reports it. Post length limits are
   * counted in graphemes, not UTF-16 units, so tests around the 300-character
   * ceiling need this to treat an emoji as one character. Intl.Segmenter is
   * available in Node 16+; the spread fallback is close enough for the ASCII
   * cases and only loses on astral-plane clusters.
   */
  get graphemeLength() {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      const segmenter = new Intl.Segmenter(undefined, {
        granularity: "grapheme",
      });
      let count = 0;
      for (const _ of segmenter.segment(this.text)) count += 1;
      return count;
    }
    return [...this.text].length;
  }

  /**
   * Detect mention/link/tag facets from the text.
   *
   * The real implementation resolves mention handles to DIDs via the agent; the
   * mock leaves `did` empty since no test asserts on resolution. Previously a
   * no-op, which made "facets are recomputed before saving" untestable — the
   * assertion would pass against undefined either way.
   */
  async detectFacets(_agent) {
    const facets = [];
    const encoder = (s) => Buffer.byteLength(s, "utf8");

    const push = (match, feature) => {
      const byteStart = encoder(this.text.slice(0, match.index));
      const byteEnd = byteStart + encoder(match[0]);
      facets.push({ index: { byteStart, byteEnd }, features: [feature] });
    };

    for (const match of this.text.matchAll(/https?:\/\/[^\s]+/g)) {
      push(match, {
        $type: "app.bsky.richtext.facet#link",
        uri: match[0],
      });
    }
    for (const match of this.text.matchAll(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
      push(match, { $type: "app.bsky.richtext.facet#mention", did: "" });
    }
    for (const match of this.text.matchAll(/#([^\s#]+)/g)) {
      push(match, {
        $type: "app.bsky.richtext.facet#tag",
        tag: match[1],
      });
    }

    facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
    this.facets = facets.length > 0 ? facets : undefined;
    return this.facets;
  }
  *segments() {
    const bytes = Buffer.from(this.text, "utf8");
    const facets = (this.facets || [])
      .slice()
      .sort((a, b) => a.index.byteStart - b.index.byteStart);
    if (facets.length === 0) {
      if (this.text) yield new RichTextSegment(this.text);
      return;
    }
    let cursor = 0;
    for (const facet of facets) {
      const { byteStart, byteEnd } = facet.index;
      if (byteStart > cursor) {
        yield new RichTextSegment(
          bytes.slice(cursor, byteStart).toString("utf8"),
        );
      }
      yield new RichTextSegment(
        bytes.slice(byteStart, byteEnd).toString("utf8"),
        facet,
      );
      cursor = byteEnd;
    }
    if (cursor < bytes.length) {
      yield new RichTextSegment(bytes.slice(cursor).toString("utf8"));
    }
  }
}

class BlobRef {
  constructor(ref, mimeType, size) {
    this.ref = ref;
    this.mimeType = mimeType;
    this.size = size;
  }
}

const NAMED = { RichText, BlobRef };

module.exports = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === "__esModule") return true;
      if (prop === "default") return module.exports;
      if (typeof prop !== "string") return undefined;
      if (prop in NAMED) return NAMED[prop];
      if (NSID[prop]) return makeNamespace(NSID[prop]);
      return createStub();
    },
  },
);
