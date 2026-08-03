import { describe, expect, it } from "vitest";
import { dedupeNarratives, isSameNarrative } from "./narrative-dedupe";

describe("isSameNarrative", () => {
  it("collapses the real near-duplicates Pan emits", () => {
    // Observed live: one story, three rows, 168/158/149 authors.
    expect(
      isSameNarrative("Father's Plea for Areen", "Father's Plea for Son Areen"),
    ).toBe(true);
    expect(
      isSameNarrative(
        "Father's Plea for Areen",
        "Father's Plea for Areen's Survival",
      ),
    ).toBe(true);
  });

  it("ignores case, punctuation, and possessives", () => {
    expect(isSameNarrative("Gaza Ceasefire", "gaza  ceasefire!")).toBe(true);
    expect(isSameNarrative("Areen's Survival", "Areen Survival")).toBe(true);
  });

  it("keeps genuinely different narratives apart", () => {
    expect(isSameNarrative("Gaza Ceasefire", "Election Results")).toBe(false);
    expect(isSameNarrative("Apple Earnings", "Apple Orchard Harvest")).toBe(
      false,
    );
    expect(isSameNarrative("Same Story", "Other Story")).toBe(false);
  });

  it("does not let stopword-only labels swallow real topics", () => {
    // Labels that reduce to nothing must not match everything.
    expect(isSameNarrative("the and of", "Gaza Ceasefire")).toBe(false);
    expect(isSameNarrative("the and of", "a for to")).toBe(true);
  });

  it("treats a shared single word as insufficient on its own", () => {
    // "Trump" alone appearing in both is not enough to merge two stories when
    // the shorter label has other distinguishing words.
    expect(isSameNarrative("Trump Verdict", "Trump Rally Crowd")).toBe(false);
  });
});

describe("dedupeNarratives", () => {
  const rows = [
    { label: "Father's Plea for Areen", authors: 168 },
    { label: "Father's Plea for Son Areen", authors: 158 },
    { label: "Father's Plea for Areen's Survival", authors: 149 },
    { label: "Gaza Ceasefire Talks", authors: 90 },
    { label: "Election Results", authors: 40 },
  ];

  const dedupe = (items: typeof rows) =>
    dedupeNarratives(
      items,
      (r) => r.label,
      (r) => r.authors,
    );

  it("keeps one row per distinct narrative", () => {
    expect(dedupe(rows).map((r) => r.label)).toEqual([
      "Father's Plea for Areen",
      "Gaza Ceasefire Talks",
      "Election Results",
    ]);
  });

  it("keeps the strongest member of each group regardless of input order", () => {
    const shuffled = [rows[2], rows[1], rows[0], rows[4], rows[3]];
    const kept = dedupe(shuffled);
    const areen = kept.find((r) => r.label.includes("Areen"));
    expect(areen?.authors).toBe(168);
  });

  it("drops blank labels rather than grouping them together", () => {
    const kept = dedupe([
      { label: "  ", authors: 10 },
      { label: "Real Topic", authors: 5 },
    ]);
    expect(kept.map((r) => r.label)).toEqual(["Real Topic"]);
  });

  it("returns an empty list for empty input", () => {
    expect(dedupe([])).toEqual([]);
  });
});
