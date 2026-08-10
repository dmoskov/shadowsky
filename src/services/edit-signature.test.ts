import { describe, expect, it } from "vitest";
import {
  differsOnlyBySignature,
  hasEditSignature,
  stripEditSignature,
} from "./edit-signature";

const NNBSP = " ";

describe("stripEditSignature", () => {
  it("strips Skeets' signature with its narrow no-break space", () => {
    // The space before the time is U+202F, not U+0020 — matching on a regular
    // space silently strips nothing.
    const text = `Look at this cat\n(Edited${NNBSP}9:55 PM via @skeetsapp.com)`;
    expect(stripEditSignature(text)).toBe("Look at this cat");
  });

  it("strips the bare 24-hour variant", () => {
    expect(stripEditSignature(`Fixed a typo\n(Edited${NNBSP}21:24)`)).toBe(
      "Fixed a typo",
    );
  });

  it("also handles a plain space, since not every client uses U+202F", () => {
    expect(
      stripEditSignature("Hello\n(Edited 9:55 PM via @skeetsapp.com)"),
    ).toBe("Hello");
  });

  it("leaves an author's own parenthetical alone", () => {
    // Only a trailing signature is stripped; mid-post text is the author's.
    const text =
      "I said (Edited 9:55 PM) in my post on purpose, then continued";
    expect(stripEditSignature(text)).toBe(text);
  });

  it("leaves unsigned text untouched", () => {
    expect(stripEditSignature("just a normal post")).toBe("just a normal post");
    expect(hasEditSignature("just a normal post")).toBe(false);
  });

  it("detects a signature", () => {
    expect(
      hasEditSignature(`x\n(Edited${NNBSP}9:55 PM via @skeetsapp.com)`),
    ).toBe(true);
  });
});

describe("differsOnlyBySignature", () => {
  it("spots versions that differ only by their own timestamp", () => {
    // This is the case that makes a naive diff useless: every revision changes
    // its signature, so every version looks changed.
    const v1 = `Same words\n(Edited${NNBSP}9:55 PM via @skeetsapp.com)`;
    const v2 = `Same words\n(Edited${NNBSP}10:02 PM via @skeetsapp.com)`;
    expect(differsOnlyBySignature(v1, v2)).toBe(true);
  });

  it("does not mask a real text change", () => {
    const v1 = `Original words\n(Edited${NNBSP}9:55 PM via @skeetsapp.com)`;
    const v2 = `Rewritten words\n(Edited${NNBSP}10:02 PM via @skeetsapp.com)`;
    expect(differsOnlyBySignature(v1, v2)).toBe(false);
  });

  it("reports identical text as not differing", () => {
    expect(differsOnlyBySignature("same", "same")).toBe(false);
  });
});
