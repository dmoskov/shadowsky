import { describe, expect, it } from "vitest";
import { formatTime, getTextOverlayStyle } from "./video-editor-utils";

describe("formatTime", () => {
  it("formats seconds as m:ss with zero-padding", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(5)).toBe("0:05");
    expect(formatTime(60)).toBe("1:00");
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(3661)).toBe("61:01");
  });

  it("floors fractional seconds", () => {
    expect(formatTime(9.9)).toBe("0:09");
  });
});

describe("getTextOverlayStyle", () => {
  it("is always absolutely positioned", () => {
    expect(getTextOverlayStyle("top-left").position).toBe("absolute");
    expect(getTextOverlayStyle("center").position).toBe("absolute");
  });

  it("places corners without a transform", () => {
    expect(getTextOverlayStyle("top-left")).toMatchObject({
      top: "10%",
      left: "5%",
    });
    expect(getTextOverlayStyle("bottom-right")).toMatchObject({
      bottom: "10%",
      right: "5%",
    });
  });

  it("centers with a translate transform", () => {
    expect(getTextOverlayStyle("center")).toMatchObject({
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    });
    expect(getTextOverlayStyle("top-center").transform).toBe(
      "translateX(-50%)",
    );
  });
});
