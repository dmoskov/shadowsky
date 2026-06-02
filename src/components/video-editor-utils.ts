/**
 * Pure helpers for VideoEditor — extracted so they're unit-testable and the
 * component stays focused on rendering/state.
 */

import type { CSSProperties } from "react";

export type TextPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/** Format a duration in seconds as "m:ss" (e.g. 75 -> "1:15"). */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/** Absolute-position style for a text overlay at the given anchor. */
export function getTextOverlayStyle(position: TextPosition): CSSProperties {
  const baseStyle: CSSProperties = {
    position: "absolute",
    padding: "8px 16px",
    maxWidth: "80%",
  };

  switch (position) {
    case "top-left":
      return { ...baseStyle, top: "10%", left: "5%" };
    case "top-center":
      return {
        ...baseStyle,
        top: "10%",
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "top-right":
      return { ...baseStyle, top: "10%", right: "5%" };
    case "center":
      return {
        ...baseStyle,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    case "bottom-left":
      return { ...baseStyle, bottom: "10%", left: "5%" };
    case "bottom-center":
      return {
        ...baseStyle,
        bottom: "10%",
        left: "50%",
        transform: "translateX(-50%)",
      };
    case "bottom-right":
      return { ...baseStyle, bottom: "10%", right: "5%" };
    default:
      return baseStyle;
  }
}
