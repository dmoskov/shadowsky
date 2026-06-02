import { describe, expect, it } from "vitest";
import { formatCount, formatJoinDate, formatRelativeTime } from "./format";

describe("formatCount", () => {
  it("returns the plain number below 1000", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(42)).toBe("42");
    expect(formatCount(999)).toBe("999");
  });

  it("uses K for thousands (one decimal, uppercase)", () => {
    expect(formatCount(1000)).toBe("1.0K");
    expect(formatCount(1500)).toBe("1.5K");
    expect(formatCount(12345)).toBe("12.3K");
  });

  it("uses M for millions", () => {
    expect(formatCount(1000000)).toBe("1.0M");
    expect(formatCount(2500000)).toBe("2.5M");
  });
});

describe("formatJoinDate", () => {
  it('formats as "Month YYYY"', () => {
    // Mid-day, mid-month avoids timezone rollover affecting the month.
    expect(formatJoinDate("2026-06-15T12:00:00Z")).toBe("June 2026");
    expect(formatJoinDate("2024-01-10T12:00:00Z")).toBe("January 2024");
  });

  it("accepts a Date object", () => {
    expect(formatJoinDate(new Date("2026-12-15T12:00:00Z"))).toBe(
      "December 2026",
    );
  });
});

describe("formatRelativeTime", () => {
  it('returns "just now" for very recent times', () => {
    expect(formatRelativeTime(new Date())).toBe("just now");
    expect(formatRelativeTime(new Date(Date.now() - 30 * 1000))).toBe(
      "just now",
    );
  });

  it("returns minutes, hours, days for older times", () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000))).toBe("5m");
    expect(formatRelativeTime(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe(
      "3h",
    );
    expect(
      formatRelativeTime(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
    ).toBe("2d");
  });
});
