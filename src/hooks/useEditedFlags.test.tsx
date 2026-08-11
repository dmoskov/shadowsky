import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditedFlags } from "./useEditedFlags";

const fetchEditedFlags = vi.fn();
vi.mock("../services/pan-api", () => ({
  fetchEditedFlags: (uris: string[]) => fetchEditedFlags(uris),
}));

function Probe({ uris }: { uris: string[] }) {
  const flags = useEditedFlags(uris);
  return <div data-testid="out">{JSON.stringify(flags)}</div>;
}

const flag = (n: number) => ({
  edit_count: n,
  last_edited_at: "2026-08-01T12:00:00.000Z",
  self_describing: false,
});

beforeEach(() => {
  fetchEditedFlags.mockReset();
  fetchEditedFlags.mockResolvedValue({});
});

describe("useEditedFlags", () => {
  it("asks once for a page of posts, not once per post", async () => {
    fetchEditedFlags.mockResolvedValue({ a: flag(2) });

    render(<Probe uris={["a", "b", "c"]} />);

    await waitFor(() => expect(fetchEditedFlags).toHaveBeenCalledTimes(1));
    expect(fetchEditedFlags).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("only asks about URIs it has not seen when a page is appended", async () => {
    fetchEditedFlags.mockResolvedValue({ a: flag(1) });
    const { rerender } = render(<Probe uris={["a", "b"]} />);
    await waitFor(() => expect(fetchEditedFlags).toHaveBeenCalledTimes(1));

    // Appending a page must not re-query the posts already asked about.
    fetchEditedFlags.mockResolvedValue({ c: flag(3) });
    rerender(<Probe uris={["a", "b", "c", "d"]} />);

    await waitFor(() => expect(fetchEditedFlags).toHaveBeenCalledTimes(2));
    expect(fetchEditedFlags).toHaveBeenLastCalledWith(["c", "d"]);
  });

  it("accumulates flags across pages rather than replacing them", async () => {
    fetchEditedFlags.mockResolvedValue({ a: flag(1) });
    const { rerender, getByTestId } = render(<Probe uris={["a"]} />);
    await waitFor(() =>
      expect(getByTestId("out").textContent).toContain('"a"'),
    );

    fetchEditedFlags.mockResolvedValue({ b: flag(5) });
    rerender(<Probe uris={["a", "b"]} />);

    await waitFor(() =>
      expect(getByTestId("out").textContent).toContain('"b"'),
    );
    // The earlier page's flag survives.
    expect(getByTestId("out").textContent).toContain('"a"');
  });

  it("makes no request for an empty feed", () => {
    render(<Probe uris={[]} />);
    expect(fetchEditedFlags).not.toHaveBeenCalled();
  });

  it("does not re-request on a re-render with the same posts", async () => {
    fetchEditedFlags.mockResolvedValue({ a: flag(1) });
    const { rerender } = render(<Probe uris={["a", "b"]} />);
    await waitFor(() => expect(fetchEditedFlags).toHaveBeenCalledTimes(1));

    rerender(<Probe uris={["a", "b"]} />);
    rerender(<Probe uris={["a", "b"]} />);

    expect(fetchEditedFlags).toHaveBeenCalledTimes(1);
  });

  it("leaves the timeline unbadged when Pan is unavailable", async () => {
    fetchEditedFlags.mockRejectedValue(new Error("down"));

    const { getByTestId } = render(<Probe uris={["a"]} />);

    await waitFor(() => expect(fetchEditedFlags).toHaveBeenCalled());
    expect(getByTestId("out").textContent).toBe("{}");
  });

  it("retries a failed page later rather than un-badging for the session", async () => {
    fetchEditedFlags.mockRejectedValueOnce(new Error("down"));
    const { rerender } = render(<Probe uris={["a"]} />);
    await waitFor(() => expect(fetchEditedFlags).toHaveBeenCalledTimes(1));

    // A transient failure must not permanently mark those URIs as asked.
    fetchEditedFlags.mockResolvedValue({ a: flag(4) });
    rerender(<Probe uris={["a", "b"]} />);

    await waitFor(() => expect(fetchEditedFlags).toHaveBeenCalledTimes(2));
    expect(fetchEditedFlags).toHaveBeenLastCalledWith(["a", "b"]);
  });
});
