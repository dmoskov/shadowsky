import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EditedPostMarker } from "./EditedPostMarker";

const CREATED = "2026-08-01T10:00:00.000Z";

describe("EditedPostMarker", () => {
  it("renders nothing for a post that was never edited", () => {
    const { container } = render(
      <EditedPostMarker record={{ text: "hello", createdAt: CREATED }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the marker for a Skeets post that has no updatedAt", () => {
    // Skeets records history without a timestamp field, so anything keying off
    // updatedAt alone treats these as unedited.
    render(
      <EditedPostMarker
        record={{
          text: "current",
          createdAt: CREATED,
          skeetsAppHistory: { data: [{ [CREATED]: "before" }] },
        }}
      />,
    );
    expect(screen.getByRole("button", { name: /edited/i })).toBeInTheDocument();
  });

  it("counts multiple revisions in the label", () => {
    render(
      <EditedPostMarker
        record={{
          text: "v3",
          createdAt: CREATED,
          skeetsAppHistory: {
            data: [
              { "2026-08-01T10:00:00.000Z": "v1" },
              { "2026-08-01T11:00:00.000Z": "v2" },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("Edited 2×")).toBeInTheDocument();
  });

  it("hides prior versions until asked, then labels them in order", () => {
    render(
      <EditedPostMarker
        record={{
          text: "v3",
          createdAt: CREATED,
          skeetsAppHistory: {
            data: [
              { "2026-08-01T10:00:00.000Z": "first draft" },
              { "2026-08-01T11:00:00.000Z": "second draft" },
            ],
          },
        }}
      />,
    );

    expect(screen.queryByText("first draft")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /edited/i }));

    expect(screen.getByText("first draft")).toBeInTheDocument();
    expect(screen.getByText("second draft")).toBeInTheDocument();
    expect(screen.getByText(/^Original ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Revision 2 ·/)).toBeInTheDocument();
  });

  it("reads the originalText convention from other clients", () => {
    render(
      <EditedPostMarker
        record={{
          text: "fixed",
          createdAt: CREATED,
          originalText: "typo",
          updatedAt: "2026-08-01T12:00:00.000Z",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /edited/i }));
    expect(screen.getByText("typo")).toBeInTheDocument();
  });

  it("shows a non-interactive marker when nothing was preserved", () => {
    // Edited by a client that stamps a timestamp but keeps no prior text.
    render(
      <EditedPostMarker
        record={{
          text: "current",
          createdAt: CREATED,
          updatedAt: "2026-08-01T12:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not treat a bridged post as edited", () => {
    // bridgyOriginalText is the pre-bridge ActivityPub text, and appears on
    // ~398k posts — far more than real edit history.
    const { container } = render(
      <EditedPostMarker
        record={{
          text: "bridged",
          createdAt: CREATED,
          bridgyOriginalText: "original fediverse text",
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("does not bubble clicks to an enclosing post handler", () => {
    // Thread nodes are clickable; expanding history must not also open the post.
    let parentClicks = 0;
    render(
      <div onClick={() => parentClicks++}>
        <EditedPostMarker
          record={{
            text: "v2",
            createdAt: CREATED,
            skeetsAppHistory: { data: [{ [CREATED]: "v1" }] },
          }}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /edited/i }));
    expect(parentClicks).toBe(0);
  });
});
