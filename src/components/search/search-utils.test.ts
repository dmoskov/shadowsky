import type { AppBskyFeedDefs } from "@atproto/api";
import { describe, expect, it } from "vitest";
import {
  defaultFilters,
  type SearchFilters as FacetedFilters,
} from "../../hooks/useSearch";
import {
  buildSearchQuery,
  filterByMediaType,
  getPostImages,
  parseFacetedFiltersFromParams,
  postHasImages,
  postHasLinks,
  postHasMedia,
  postHasVideo,
  postIsTextOnly,
  postMeetsEngagement,
  serializeFacetedFiltersToParams,
  type SearchFilters as QueryFilters,
} from "./search-utils";

const imagesEmbed = {
  $type: "app.bsky.embed.images#view",
  images: [{ thumb: "t", fullsize: "f", alt: "a" }],
};
const videoEmbed = {
  $type: "app.bsky.embed.video#view",
  cid: "c",
  playlist: "p",
};
const externalEmbed = {
  $type: "app.bsky.embed.external#view",
  external: { uri: "https://x.test", title: "t", description: "d" },
};
const recordWithImages = {
  $type: "app.bsky.embed.recordWithMedia#view",
  record: { $type: "app.bsky.embed.record#view", record: {} },
  media: imagesEmbed,
};
const recordWithExternal = {
  $type: "app.bsky.embed.recordWithMedia#view",
  record: { $type: "app.bsky.embed.record#view", record: {} },
  media: externalEmbed,
};

function post(
  embed?: unknown,
  counts: {
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
  } = {},
): AppBskyFeedDefs.PostView {
  return {
    uri: "at://did:plc:x/app.bsky.feed.post/1",
    cid: "cid",
    author: { did: "did:plc:x", handle: "h.test" },
    record: {},
    indexedAt: "2026-01-01T00:00:00Z",
    embed,
    ...counts,
  } as unknown as AppBskyFeedDefs.PostView;
}

describe("media predicates", () => {
  it("postHasMedia: images, video, recordWithMedia(images) -> true; external/none -> false", () => {
    expect(postHasMedia(post(imagesEmbed))).toBe(true);
    expect(postHasMedia(post(videoEmbed))).toBe(true);
    expect(postHasMedia(post(recordWithImages))).toBe(true);
    expect(postHasMedia(post(externalEmbed))).toBe(false);
    expect(postHasMedia(post())).toBe(false);
  });

  it("postHasImages distinguishes images from video", () => {
    expect(postHasImages(post(imagesEmbed))).toBe(true);
    expect(postHasImages(post(recordWithImages))).toBe(true);
    expect(postHasImages(post(videoEmbed))).toBe(false);
  });

  it("postHasVideo only matches video views", () => {
    expect(postHasVideo(post(videoEmbed))).toBe(true);
    expect(postHasVideo(post(imagesEmbed))).toBe(false);
  });

  it("postHasLinks matches external (incl. recordWithMedia)", () => {
    expect(postHasLinks(post(externalEmbed))).toBe(true);
    expect(postHasLinks(post(recordWithExternal))).toBe(true);
    expect(postHasLinks(post(imagesEmbed))).toBe(false);
  });

  it("postIsTextOnly is true only with no embed", () => {
    expect(postIsTextOnly(post())).toBe(true);
    expect(postIsTextOnly(post(imagesEmbed))).toBe(false);
  });
});

describe("postMeetsEngagement", () => {
  it("requires all thresholds to be met (missing counts treated as 0)", () => {
    const p = post(undefined, { likeCount: 10, repostCount: 5, replyCount: 2 });
    expect(
      postMeetsEngagement(p, { minLikes: 10, minReposts: 5, minReplies: 2 }),
    ).toBe(true);
    expect(
      postMeetsEngagement(p, { minLikes: 11, minReposts: 0, minReplies: 0 }),
    ).toBe(false);
    expect(
      postMeetsEngagement(post(), {
        minLikes: 1,
        minReposts: 0,
        minReplies: 0,
      }),
    ).toBe(false);
  });
});

describe("filterByMediaType", () => {
  const posts = [
    post(imagesEmbed),
    post(videoEmbed),
    post(externalEmbed),
    post(),
  ];

  it("returns everything for 'all'", () => {
    expect(filterByMediaType(posts, "all")).toHaveLength(4);
  });
  it("filters to images / videos / links / text-only", () => {
    expect(filterByMediaType(posts, "images")).toHaveLength(1);
    expect(filterByMediaType(posts, "videos")).toHaveLength(1);
    expect(filterByMediaType(posts, "links")).toHaveLength(1);
    expect(filterByMediaType(posts, "text-only")).toHaveLength(1);
  });
});

describe("getPostImages", () => {
  it("extracts images from image and recordWithMedia embeds", () => {
    expect(getPostImages(post(imagesEmbed))).toHaveLength(1);
    expect(getPostImages(post(recordWithImages))).toHaveLength(1);
    expect(getPostImages(post(videoEmbed))).toEqual([]);
    expect(getPostImages(post())).toEqual([]);
  });
});

describe("buildSearchQuery", () => {
  const base: QueryFilters = {
    query: "",
    phrases: [],
    hashtags: [],
    from: [],
    mentions: [],
    domains: [],
    language: "",
    sinceDate: "",
    untilDate: "",
    hasMedia: false,
  };

  it("composes operators from filter fields", () => {
    const q = buildSearchQuery({
      ...base,
      query: "cats",
      phrases: ["fluffy tail"],
      hashtags: ["#pets", "cute"],
      from: ["@alice"],
      mentions: ["me", "@bob"],
      domains: ["example.com"],
      language: "en",
      sinceDate: "2026-01-01",
      untilDate: "2026-02-01",
    });
    expect(q).toContain("cats");
    expect(q).toContain('"fluffy tail"');
    expect(q).toContain("#pets");
    expect(q).toContain("#cute");
    expect(q).toContain("from:alice");
    expect(q).toContain("mentions:me");
    expect(q).toContain("@bob");
    expect(q).toContain("domain:example.com");
    expect(q).toContain("lang:en");
    expect(q).toContain("since:2026-01-01");
    expect(q).toContain("until:2026-02-01");
  });

  it("returns an empty string for empty filters", () => {
    expect(buildSearchQuery(base)).toBe("");
  });
});

describe("faceted filter serialize/parse", () => {
  it("serialize omits defaults and includes set values", () => {
    const params = serializeFacetedFiltersToParams({
      ...defaultFilters,
      mediaType: "images",
      language: "en",
      fromUsers: ["alice", "bob"],
      engagement: { minLikes: 5, minReposts: 0, minReplies: 0 },
    });
    expect(params).toMatchObject({
      mediaType: "images",
      lang: "en",
      from: "alice,bob",
      minLikes: "5",
    });
    expect(params.minReposts).toBeUndefined();
  });

  it("default filters serialize to an empty param set", () => {
    expect(serializeFacetedFiltersToParams(defaultFilters)).toEqual({});
  });

  it("parse reads values back from URL params", () => {
    const parsed = parseFacetedFiltersFromParams(
      new URLSearchParams({
        mediaType: "videos",
        minLikes: "3",
        from: "alice,bob",
        lang: "en",
      }),
    );
    expect(parsed.mediaType).toBe("videos");
    expect(parsed.engagement).toEqual({
      minLikes: 3,
      minReposts: 0,
      minReplies: 0,
    });
    expect(parsed.fromUsers).toEqual(["alice", "bob"]);
    expect(parsed.language).toBe("en");
  });

  it("serialize -> parse round-trips media/engagement/from", () => {
    const filters: FacetedFilters = {
      ...defaultFilters,
      mediaType: "links",
      fromUsers: ["x"],
      engagement: { minLikes: 2, minReposts: 1, minReplies: 0 },
    };
    const params = serializeFacetedFiltersToParams(filters);
    const parsed = parseFacetedFiltersFromParams(new URLSearchParams(params));
    expect(parsed.mediaType).toBe("links");
    expect(parsed.fromUsers).toEqual(["x"]);
    expect(parsed.engagement).toEqual({
      minLikes: 2,
      minReposts: 1,
      minReplies: 0,
    });
  });
});
