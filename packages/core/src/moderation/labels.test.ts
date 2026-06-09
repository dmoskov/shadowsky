import { describe, expect, it } from "vitest";
import type { ComAtprotoLabelDefs } from "@atproto/api";
import {
  DEFAULT_CONTENT_FILTER_PREFERENCES,
  getAuthorWarningText,
  getContentWarningText,
  getMostSevereLabel,
  parseLabelType,
  shouldBlurImages,
  shouldHideContent,
  shouldWarnContent,
} from "./labels";

function label(
  val: string,
  src = "did:plc:moderator",
): ComAtprotoLabelDefs.Label {
  return {
    val,
    src,
    uri: "at://did:plc:author/app.bsky.feed.post/abc",
    cts: "2026-01-01T00:00:00.000Z",
  };
}

describe("parseLabelType", () => {
  it("recognizes known labels case-insensitively", () => {
    expect(parseLabelType("porn")).toBe("porn");
    expect(parseLabelType("PORN")).toBe("porn");
    expect(parseLabelType("graphic-media")).toBe("graphic-media");
  });

  it("falls back to unknown", () => {
    expect(parseLabelType("something-custom")).toBe("unknown");
  });
});

describe("getMostSevereLabel", () => {
  it("returns null for empty input", () => {
    expect(getMostSevereLabel(undefined)).toBeNull();
    expect(getMostSevereLabel([])).toBeNull();
  });

  it("prefers hide-severity labels over warn-severity", () => {
    expect(getMostSevereLabel([label("nudity"), label("porn")])).toBe("porn");
    expect(getMostSevereLabel([label("spam"), label("sexual")])).toBe("spam");
  });
});

describe("shouldHideContent / shouldWarnContent / shouldBlurImages", () => {
  const prefs = DEFAULT_CONTENT_FILTER_PREFERENCES;

  it("hides content the user prefers hidden (default: porn, spam)", () => {
    expect(shouldHideContent([label("porn")], prefs)).toBe(true);
    expect(shouldHideContent([label("spam")], prefs)).toBe(true);
    expect(shouldHideContent([label("nudity")], prefs)).toBe(false);
    expect(shouldHideContent(undefined, prefs)).toBe(false);
  });

  it("warns on warn-preference labels", () => {
    expect(shouldWarnContent([label("sexual")], prefs)).toBe(true);
    expect(shouldWarnContent([label("porn")], prefs)).toBe(false); // hide, not warn
  });

  it("blurs images for both warn and hide preferences", () => {
    expect(shouldBlurImages([label("porn")], prefs)).toBe(true);
    expect(shouldBlurImages([label("nudity")], prefs)).toBe(true);
  });

  it("ignores unknown labels for native preferences", () => {
    expect(shouldHideContent([label("custom-label")], prefs)).toBe(false);
    expect(shouldWarnContent([label("custom-label")], prefs)).toBe(false);
  });

  it("honors third-party labeler preferences before native ones", () => {
    const labelerPrefs = [
      {
        labelerDid: "did:plc:labeler",
        label: "custom-label",
        visibility: "hide" as const,
      },
    ];
    const l = label("custom-label", "did:plc:labeler");
    expect(shouldHideContent([l], prefs, labelerPrefs)).toBe(true);
    expect(shouldBlurImages([l], prefs, labelerPrefs)).toBe(true);
    // Same label from a different labeler is not matched
    const other = label("custom-label", "did:plc:other");
    expect(shouldHideContent([other], prefs, labelerPrefs)).toBe(false);
  });
});

describe("warning display text", () => {
  it("describes the most severe label", () => {
    expect(getContentWarningText([label("porn")])).toBe("Adult Content");
    expect(getContentWarningText(undefined)).toBe("Sensitive Content");
  });

  it("describes author labels", () => {
    expect(getAuthorWarningText([label("impersonation")])).toBe(
      "Account: Impersonation",
    );
    expect(getAuthorWarningText([])).toBe("Account Warning");
  });
});
