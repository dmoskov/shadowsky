import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

async function load() {
  return await import("./pan-api");
}

function ok(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ success: true, data, meta: {} }),
  };
}

const URI = "at://did:plc:someone/app.bsky.feed.post/abc123";

describe("fetchPostEdits", () => {
  it("returns the history for an edited post", async () => {
    fetchMock.mockResolvedValue(
      ok({
        uri: URI,
        author_did: "did:plc:someone",
        edit_count: 2,
        last_edited_at: "2026-08-01T12:00:00.000Z",
        original_created_at: "2026-08-01T10:00:00.000Z",
        sources: ["recreate"],
        self_describing: false,
        versions: [],
      }),
    );

    const { fetchPostEdits } = await load();
    const history = await fetchPostEdits(URI);

    expect(history?.edit_count).toBe(2);
    expect(history?.self_describing).toBe(false);
  });

  it("returns null when the post was never edited", async () => {
    fetchMock.mockResolvedValue(ok({ uri: URI, edit_count: 0, versions: [] }));

    const { fetchPostEdits } = await load();
    expect(await fetchPostEdits(URI)).toBeNull();
  });

  it("sends the URI encoded exactly once", async () => {
    // The client builds query params with URLSearchParams, which encodes. An
    // extra encodeURIComponent here would double-encode the at:// URI and match
    // nothing, silently — no error, just zero results.
    fetchMock.mockResolvedValue(ok({ uri: URI, edit_count: 0, versions: [] }));

    const { fetchPostEdits } = await load();
    await fetchPostEdits(URI);

    const requested = String(fetchMock.mock.calls[0][0]);
    expect(requested).toContain("uri=at%3A%2F%2Fdid%3Aplc%3Asomeone");
    expect(requested).not.toContain("%253A"); // %3A re-encoded
    expect(
      decodeURIComponent(new URL(requested).searchParams.get("uri")!),
    ).toBe(URI);
  });

  it("returns null rather than throwing when Pan is unavailable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const { fetchPostEdits } = await load();
    expect(await fetchPostEdits(URI)).toBeNull();
  });
});

describe("fetchEditedFlags", () => {
  it("returns flags keyed by URI", async () => {
    fetchMock.mockResolvedValue(
      ok({
        edited: {
          [URI]: {
            edit_count: 5,
            last_edited_at: "2026-08-01T12:00:00.000Z",
            self_describing: false,
          },
        },
        queried: 2,
      }),
    );

    const { fetchEditedFlags } = await load();
    const flags = await fetchEditedFlags([URI, "at://other/x/y"]);

    expect(flags[URI].edit_count).toBe(5);
    // Unedited posts are simply absent rather than present-and-zero.
    expect(flags["at://other/x/y"]).toBeUndefined();
  });

  it("makes no request for an empty list", async () => {
    const { fetchEditedFlags } = await load();
    expect(await fetchEditedFlags([])).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("chunks above the batch limit and merges the results", async () => {
    const uris = Array.from({ length: 250 }, (_, i) => `at://did:plc:a/p/${i}`);
    fetchMock.mockImplementation((url: string) => {
      const sent = new URL(String(url)).searchParams.get("uris")!.split(",");
      return Promise.resolve(
        ok({
          edited: Object.fromEntries(
            sent.map((u) => [
              u,
              { edit_count: 1, last_edited_at: "x", self_describing: true },
            ]),
          ),
        }),
      );
    });

    const { fetchEditedFlags, EDITED_FLAGS_BATCH_LIMIT } = await load();
    const flags = await fetchEditedFlags(uris);

    expect(EDITED_FLAGS_BATCH_LIMIT).toBe(100);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Every URI survives the chunk-and-merge.
    expect(Object.keys(flags)).toHaveLength(250);
  });

  it("returns an empty object when Pan is down, so timelines still render", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const { fetchEditedFlags } = await load();
    expect(await fetchEditedFlags([URI])).toEqual({});
  });
});
