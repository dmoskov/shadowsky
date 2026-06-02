import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSavedSearches } from "./useSavedSearches";
import { useSearchHistory } from "./useSearchHistory";

beforeEach(() => {
  localStorage.clear();
});

describe("useSearchHistory", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useSearchHistory());
    expect(result.current.searchHistory).toEqual([]);
  });

  it("adds queries most-recent-first and dedupes", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => result.current.addToSearchHistory("cats"));
    act(() => result.current.addToSearchHistory("dogs"));
    expect(result.current.searchHistory).toEqual(["dogs", "cats"]);

    // Re-adding moves it to the front without duplicating
    act(() => result.current.addToSearchHistory("cats"));
    expect(result.current.searchHistory).toEqual(["cats", "dogs"]);
  });

  it("ignores blank queries", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => result.current.addToSearchHistory("   "));
    expect(result.current.searchHistory).toEqual([]);

    act(() => result.current.addToSearchHistory("birds"));
    expect(result.current.searchHistory).toEqual(["birds"]);
  });

  it("clears history", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => result.current.addToSearchHistory("x"));
    act(() => result.current.clearSearchHistory());
    expect(result.current.searchHistory).toEqual([]);
  });

  it("caps history at 10 entries", () => {
    const { result } = renderHook(() => useSearchHistory());
    act(() => {
      for (let i = 0; i < 15; i++) result.current.addToSearchHistory(`q${i}`);
    });
    expect(result.current.searchHistory).toHaveLength(10);
    // Most recent first
    expect(result.current.searchHistory[0]).toBe("q14");
  });
});

describe("useSavedSearches", () => {
  it("saves, dedupes, and reflects isSearchSaved for the current query", () => {
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useSavedSearches(q),
      { initialProps: { q: "" } },
    );

    act(() => result.current.saveSearch("from:me cats"));
    expect(result.current.savedSearches).toHaveLength(1);
    expect(result.current.savedSearches[0].query).toBe("from:me cats");

    // Saving the same query again does not duplicate
    act(() => result.current.saveSearch("from:me cats"));
    expect(result.current.savedSearches).toHaveLength(1);

    // isSearchSaved tracks the current query prop
    expect(result.current.isSearchSaved).toBe(false);
    rerender({ q: "from:me cats" });
    expect(result.current.isSearchSaved).toBe(true);
  });

  it("removes a saved search by id", () => {
    const { result } = renderHook(() => useSavedSearches(""));
    act(() => result.current.saveSearch("dogs"));
    const id = result.current.savedSearches[0].id;
    act(() => result.current.removeSavedSearch(id));
    expect(result.current.savedSearches).toEqual([]);
  });
});
