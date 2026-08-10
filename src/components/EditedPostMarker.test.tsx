import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditedPostMarker } from "./EditedPostMarker";

const fetchPostEdits = vi.fn();
vi.mock("../services/pan-api", () => ({
  fetchPostEdits: (uri: string) => fetchPostEdits(uri),
}));

const CREATED = "2026-08-01T10:00:00.000Z";
const URI = "at://did:plc:someone/app.bsky.feed.post/abc";
const NNBSP = " ";

function renderMarker(props: Partial<Parameters<typeof EditedPostMarker>[0]>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <EditedPostMarker record={{ text: "x", createdAt: CREATED }} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchPostEdits.mockReset();
  fetchPostEdits.mockResolvedValue(null);
});

describe("EditedPostMarker", () => {
  it("renders nothing for a post nothing knows to be edited", () => {
    const { container } = renderMarker({
      record: { text: "hello", createdAt: CREATED },
      uri: URI,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("badges from a batch flag even when the record says nothing", () => {
    // Most edited posts are not self-describing: the repo keeps only the
    // current version, so the record alone cannot reveal the edit.
    renderMarker({
      record: { text: "current", createdAt: CREATED },
      uri: URI,
      knownEditCount: 5,
    });
    expect(screen.getByText("Edited 5×")).toBeInTheDocument();
  });

  it("shows the marker for a Skeets post that has no updatedAt", () => {
    renderMarker({
      record: {
        text: "current",
        createdAt: CREATED,
        skeetsAppHistory: { data: [{ [CREATED]: "before" }] },
      },
      uri: URI,
    });
    expect(screen.getByRole("button", { name: /edited/i })).toBeInTheDocument();
  });

  it("does not fetch until the reader opens the history", () => {
    renderMarker({
      record: { text: "c", createdAt: CREATED },
      uri: URI,
      knownEditCount: 2,
    });
    expect(fetchPostEdits).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /edited/i }));
    expect(fetchPostEdits).toHaveBeenCalledWith(URI);
  });

  it("drops Pan's last version, which is the current text already on screen", async () => {
    fetchPostEdits.mockResolvedValue({
      uri: URI,
      author_did: "did:plc:someone",
      edit_count: 3,
      last_edited_at: "2026-08-01T12:00:00.000Z",
      original_created_at: CREATED,
      sources: ["recreate"],
      self_describing: false,
      versions: [
        {
          seq: 0,
          text: "state one",
          at: "2026-08-01T11:00:00.000Z",
          origin: "edit",
          delay_seconds: 1,
          text_changed: true,
        },
        {
          seq: 1,
          text: "state two",
          at: "2026-08-01T11:30:00.000Z",
          origin: "edit",
          delay_seconds: 1,
          text_changed: true,
        },
        {
          seq: 2,
          text: "current text",
          at: "2026-08-01T12:00:00.000Z",
          origin: "edit",
          delay_seconds: 1,
          text_changed: true,
        },
      ],
    });

    renderMarker({
      record: { text: "current text", createdAt: CREATED },
      uri: URI,
      knownEditCount: 3,
    });
    fireEvent.click(screen.getByRole("button", { name: /edited/i }));

    await waitFor(() =>
      expect(screen.getByText("state one")).toBeInTheDocument(),
    );
    expect(screen.getByText("state two")).toBeInTheDocument();
    expect(screen.queryByText("current text")).not.toBeInTheDocument();
  });

  it("marks an edit that changed something other than the text", async () => {
    // text_changed: false is a real edit — alt text or an embed — so it must
    // appear as an event rather than be dropped for having no diff.
    fetchPostEdits.mockResolvedValue({
      uri: URI,
      author_did: "did:plc:someone",
      edit_count: 2,
      last_edited_at: "2026-08-01T12:00:00.000Z",
      original_created_at: CREATED,
      sources: ["recreate"],
      self_describing: false,
      versions: [
        {
          seq: 0,
          text: "same words",
          at: "2026-08-01T11:00:00.000Z",
          origin: "edit",
          delay_seconds: 1,
          text_changed: false,
        },
        {
          seq: 1,
          text: "same words",
          at: "2026-08-01T12:00:00.000Z",
          origin: "edit",
          delay_seconds: 1,
          text_changed: false,
        },
      ],
    });

    renderMarker({
      record: { text: "same words", createdAt: CREATED },
      uri: URI,
      knownEditCount: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: /edited/i }));

    await waitFor(() =>
      expect(screen.getByText(/no text change/)).toBeInTheDocument(),
    );
  });

  it("strips Skeets' signature so the timestamp is not the visible diff", async () => {
    fetchPostEdits.mockResolvedValue({
      uri: URI,
      author_did: "did:plc:someone",
      edit_count: 2,
      last_edited_at: "2026-08-01T12:00:00.000Z",
      original_created_at: CREATED,
      sources: ["recreate"],
      self_describing: false,
      versions: [
        {
          seq: 0,
          text: `Look at this\n(Edited${NNBSP}9:55 PM via @skeetsapp.com)`,
          at: "2026-08-01T11:00:00.000Z",
          origin: "skeetsAppHistory",
          delay_seconds: 1,
          text_changed: true,
        },
        {
          seq: 1,
          text: "Look at this now",
          at: "2026-08-01T12:00:00.000Z",
          origin: "edit",
          delay_seconds: 1,
          text_changed: true,
        },
      ],
    });

    renderMarker({
      record: { text: "Look at this now", createdAt: CREATED },
      uri: URI,
      knownEditCount: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: /edited/i }));

    await waitFor(() =>
      expect(screen.getByText("Look at this")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/skeetsapp/)).not.toBeInTheDocument();
  });

  it("falls back to the record when Pan has nothing", async () => {
    fetchPostEdits.mockResolvedValue(null);

    renderMarker({
      record: {
        text: "fixed",
        createdAt: CREATED,
        originalText: "typo",
        updatedAt: "2026-08-01T12:00:00.000Z",
      },
      uri: URI,
    });
    fireEvent.click(screen.getByRole("button", { name: /edited/i }));

    await waitFor(() => expect(screen.getByText("typo")).toBeInTheDocument());
  });

  it("says so plainly when no earlier text survives anywhere", async () => {
    fetchPostEdits.mockResolvedValue(null);

    renderMarker({
      record: {
        text: "current",
        createdAt: CREATED,
        updatedAt: "2026-08-01T12:00:00.000Z",
      },
      uri: URI,
    });
    fireEvent.click(screen.getByRole("button", { name: /edited/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/No earlier text was preserved/),
      ).toBeInTheDocument(),
    );
  });

  it("does not treat a bridged post as edited", () => {
    // bridgyOriginalText is pre-bridge ActivityPub text, on ~398k posts.
    const { container } = renderMarker({
      record: {
        text: "bridged",
        createdAt: CREATED,
        bridgyOriginalText: "original fediverse text",
      },
      uri: URI,
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("does not bubble clicks to an enclosing post handler", () => {
    let parentClicks = 0;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <div onClick={() => parentClicks++}>
          <EditedPostMarker
            record={{
              text: "v2",
              createdAt: CREATED,
              skeetsAppHistory: { data: [{ [CREATED]: "v1" }] },
            }}
            uri={URI}
          />
        </div>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /edited/i }));
    expect(parentClicks).toBe(0);
  });
});
