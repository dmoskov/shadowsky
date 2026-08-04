import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHasBeenVisible } from "./useHasBeenVisible";

// Drives the observer manually so we can assert the latch, rather than relying
// on real intersection behaviour that jsdom doesn't implement.
let triggers: Array<(entries: { isIntersecting: boolean }[]) => void>;
let disconnectCount: number;

function Probe() {
  const { ref, hasBeenVisible } = useHasBeenVisible<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="probe">
      {hasBeenVisible ? "loaded" : "waiting"}
    </div>
  );
}

beforeEach(() => {
  triggers = [];
  disconnectCount = 0;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        triggers.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {
        disconnectCount++;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useHasBeenVisible", () => {
  it("starts false so offscreen content does not load", () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("probe").textContent).toBe("waiting");
  });

  it("flips true once the element intersects", () => {
    const { getByTestId } = render(<Probe />);
    act(() => triggers[0]([{ isIntersecting: true }]));
    expect(getByTestId("probe").textContent).toBe("loaded");
  });

  it("ignores non-intersecting callbacks", () => {
    const { getByTestId } = render(<Probe />);
    act(() => triggers[0]([{ isIntersecting: false }]));
    expect(getByTestId("probe").textContent).toBe("waiting");
  });

  it("latches — scrolling back out does not unload", () => {
    const { getByTestId } = render(<Probe />);
    act(() => triggers[0]([{ isIntersecting: true }]));
    // A later "left the viewport" callback must not reset it, or a column
    // would tear down and refetch every time it scrolled off the edge.
    act(() => triggers[0]([{ isIntersecting: false }]));
    expect(getByTestId("probe").textContent).toBe("loaded");
    expect(disconnectCount).toBeGreaterThan(0);
  });

  it("defaults to visible where IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("probe").textContent).toBe("loaded");
  });
});
