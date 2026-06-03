import type { ComAtprotoLabelDefs } from "@atproto/api";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTENT_FILTER_PREFERENCES,
  getAuthorWarningText,
  getContentWarningIcon,
  getContentWarningText,
  getMostSevereLabel,
  hasAuthorLabels,
  parseLabelType,
  shouldBlurImages,
  shouldHideContent,
  shouldWarnContent,
  type LabelerLabelPreference,
} from "./labels";

const label = (val: string, src?: string): ComAtprotoLabelDefs.Label =>
  ({ val, src }) as unknown as ComAtprotoLabelDefs.Label;

describe("parseLabelType", () => {
  it("recognizes known label values case-insensitively", () => {
    expect(parseLabelType("porn")).toBe("porn");
    expect(parseLabelType("PORN")).toBe("porn");
    expect(parseLabelType("graphic-media")).toBe("graphic-media");
  });
  it("falls back to 'unknown' for unrecognized values", () => {
    expect(parseLabelType("whatever")).toBe("unknown");
  });
});

describe("getMostSevereLabel", () => {
  it("picks the highest-severity label (hide > warn)", () => {
    expect(getMostSevereLabel([label("sexual"), label("porn")])).toBe("porn");
  });
  it("returns null for empty or undefined", () => {
    expect(getMostSevereLabel([])).toBeNull();
    expect(getMostSevereLabel(undefined)).toBeNull();
  });
});

describe("shouldHideContent", () => {
  it("hides when a native preference is 'hide'", () => {
    // default: porn -> hide, sexual -> warn
    expect(
      shouldHideContent([label("porn")], DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(true);
    expect(
      shouldHideContent([label("sexual")], DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(false);
  });

  it("respects a labeler-specific 'hide' preference", () => {
    const labelerPrefs: LabelerLabelPreference[] = [
      { labelerDid: "did:plc:lab", label: "custom", visibility: "hide" },
    ];
    expect(
      shouldHideContent(
        [label("custom", "did:plc:lab")],
        DEFAULT_CONTENT_FILTER_PREFERENCES,
        labelerPrefs,
      ),
    ).toBe(true);
  });

  it("does not hide unknown labels or empty lists", () => {
    expect(
      shouldHideContent([label("xyz")], DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(false);
    expect(
      shouldHideContent(undefined, DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(false);
  });
});

describe("shouldWarnContent", () => {
  it("warns when a native preference is 'warn'", () => {
    expect(
      shouldWarnContent([label("sexual")], DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(true);
    expect(
      shouldWarnContent([label("porn")], DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(false);
  });
});

describe("shouldBlurImages", () => {
  it("blurs for both 'warn' and 'hide' preferences", () => {
    expect(
      shouldBlurImages([label("porn")], DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(true);
    expect(
      shouldBlurImages([label("sexual")], DEFAULT_CONTENT_FILTER_PREFERENCES),
    ).toBe(true);
  });
  it("does not blur with no labels", () => {
    expect(shouldBlurImages([], DEFAULT_CONTENT_FILTER_PREFERENCES)).toBe(
      false,
    );
  });
});

describe("content warning display", () => {
  it("uses the most severe label's metadata", () => {
    expect(getContentWarningText([label("porn")])).toBe("Adult Content");
    expect(getContentWarningIcon([label("porn")])).toBe("🔞");
  });
  it("falls back to defaults with no labels", () => {
    expect(getContentWarningText(undefined)).toBe("Sensitive Content");
    expect(getContentWarningIcon(undefined)).toBe("⚠️");
  });
});

describe("author labels", () => {
  it("hasAuthorLabels reflects presence", () => {
    expect(hasAuthorLabels([label("spam")])).toBe(true);
    expect(hasAuthorLabels([])).toBe(false);
    expect(hasAuthorLabels(undefined)).toBe(false);
  });
  it("getAuthorWarningText labels the account by type", () => {
    expect(getAuthorWarningText([label("impersonation")])).toBe(
      "Account: Impersonation",
    );
    expect(getAuthorWarningText(undefined)).toBe("Account Warning");
  });
});
