/**
 * useResponsiveCollapseThresholds
 *
 * A hook that provides responsive collapse thresholds based on browser width.
 * Uses window.matchMedia to sync CSS breakpoints with JS collapse logic.
 *
 * Breakpoints:
 * - Desktop (>1200px): More permissive - collapse at deeper depths, tolerate more posts
 * - Tablet (768-1200px): Medium thresholds
 * - Mobile (<768px): More aggressive collapse - shallower depth threshold, fewer posts before collapse
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export interface CollapseThresholds {
  /** Depth at which branches automatically collapse */
  depthThreshold: number;
  /** Number of replies in a branch before it gets collapsed */
  branchPostCountThreshold: number;
  /** Minimum depth before considering collapse (safety threshold) */
  minDepthForCollapse: number;
}

export type ScreenSize = "mobile" | "tablet" | "desktop";

const THRESHOLDS: Record<ScreenSize, CollapseThresholds> = {
  mobile: {
    depthThreshold: 2,
    branchPostCountThreshold: 3,
    minDepthForCollapse: 1,
  },
  tablet: {
    depthThreshold: 3,
    branchPostCountThreshold: 5,
    minDepthForCollapse: 2,
  },
  desktop: {
    depthThreshold: 4,
    branchPostCountThreshold: 8,
    minDepthForCollapse: 2,
  },
};

// Media query strings matching CSS breakpoints
const MEDIA_QUERIES = {
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1200px)",
  desktop: "(min-width: 1201px)",
};

/**
 * Determines the current screen size based on window width
 */
function getScreenSize(): ScreenSize {
  if (typeof window === "undefined") return "desktop";

  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width <= 1200) return "tablet";
  return "desktop";
}

export interface UseResponsiveCollapseThresholdsReturn {
  /** Current collapse thresholds based on screen size */
  thresholds: CollapseThresholds;
  /** Current screen size classification */
  screenSize: ScreenSize;
  /** Check if a node should be auto-collapsed based on adaptive criteria */
  shouldAutoCollapse: (
    depth: number,
    branchPostCount: number,
    hasChildren: boolean,
  ) => boolean;
  /** Get HSL border color based on depth */
  getBranchBorderColor: (depth: number) => string;
  /** Get HSL background color based on depth (subtle) */
  getBranchBackgroundColor: (depth: number) => string;
}

/**
 * Hook that provides responsive collapse thresholds for thread views.
 * Automatically updates when the browser is resized across breakpoints.
 */
export function useResponsiveCollapseThresholds(): UseResponsiveCollapseThresholdsReturn {
  const [screenSize, setScreenSize] = useState<ScreenSize>(getScreenSize);

  useEffect(() => {
    // Set up media query listeners for each breakpoint
    const mobileQuery = window.matchMedia(MEDIA_QUERIES.mobile);
    const tabletQuery = window.matchMedia(MEDIA_QUERIES.tablet);
    const desktopQuery = window.matchMedia(MEDIA_QUERIES.desktop);

    const handleChange = () => {
      if (mobileQuery.matches) {
        setScreenSize("mobile");
      } else if (tabletQuery.matches) {
        setScreenSize("tablet");
      } else if (desktopQuery.matches) {
        setScreenSize("desktop");
      }
    };

    // Initial check
    handleChange();

    // Add listeners - using addEventListener for modern browsers
    mobileQuery.addEventListener("change", handleChange);
    tabletQuery.addEventListener("change", handleChange);
    desktopQuery.addEventListener("change", handleChange);

    return () => {
      mobileQuery.removeEventListener("change", handleChange);
      tabletQuery.removeEventListener("change", handleChange);
      desktopQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const thresholds = useMemo(() => THRESHOLDS[screenSize], [screenSize]);

  /**
   * Determines if a node should be auto-collapsed based on adaptive criteria.
   * Considers both depth and branch post count.
   */
  const shouldAutoCollapse = useCallback(
    (depth: number, branchPostCount: number, hasChildren: boolean): boolean => {
      if (!hasChildren) return false;
      if (depth < thresholds.minDepthForCollapse) return false;

      // Collapse if depth exceeds threshold
      const depthExceeded = depth >= thresholds.depthThreshold;

      // Collapse if branch has too many posts (regardless of depth, but above min)
      const branchTooLarge =
        branchPostCount >= thresholds.branchPostCountThreshold;

      return depthExceeded || branchTooLarge;
    },
    [thresholds],
  );

  /**
   * Generates HSL border color based on depth.
   * Creates a spectrum shift through the color wheel.
   * Base hue starts at 210 (blue) and shifts through the spectrum.
   */
  const getBranchBorderColor = useCallback((depth: number): string => {
    // Start at blue (210) and shift 30 degrees per depth level
    const baseHue = 210;
    const hueShift = 30;
    const hue = (baseHue + depth * hueShift) % 360;
    const saturation = 70;
    const lightness = 50;

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }, []);

  /**
   * Generates subtle HSL background color based on depth.
   * Uses very low opacity for minimal visual intrusion.
   */
  const getBranchBackgroundColor = useCallback((depth: number): string => {
    // Same hue calculation as border
    const baseHue = 210;
    const hueShift = 30;
    const hue = (baseHue + depth * hueShift) % 360;
    // Very subtle: high lightness, low saturation
    const saturation = 30;
    const lightness = 97; // Very light, nearly white

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }, []);

  return {
    thresholds,
    screenSize,
    shouldAutoCollapse,
    getBranchBorderColor,
    getBranchBackgroundColor,
  };
}

/**
 * Calculate the total descendant count for a node.
 * Used by the collapse logic to determine branch size.
 */
export function countDescendants<T extends { children: T[] }>(node: T): number {
  return node.children.reduce(
    (sum, child) => sum + 1 + countDescendants(child),
    0,
  );
}
