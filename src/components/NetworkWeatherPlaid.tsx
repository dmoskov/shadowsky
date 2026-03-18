/**
 * NetworkWeatherPlaid — Living textile visualization
 *
 * Renders narrative threads as a woven plaid pattern behind the feed.
 * Supports three view modes with smooth morph animations:
 *   - Global: all network activity
 *   - Personal: filtered to your follows
 *   - Gap: differential highlighting (missing / unique / amplified)
 *
 * Interaction:
 *   - Long-press or two-finger tap toggles global ↔ personal ↔ gap
 *   - Threads morph (widen, narrow, fade) between view transitions
 *
 * Ref: docs/vision/network-weather.md § Your World vs. The World
 */

import { Eye, Globe, Layers, Users } from "lucide-react";
import React, { useCallback, useEffect, useRef } from "react";
import type {
  GapAnalysis,
  TextileState,
  ThreadCharacter,
  WeatherViewMode,
} from "../types/network-weather";
import { THREAD_PALETTE } from "../types/network-weather";

// ─── Props ───────────────────────────────────────────────

interface NetworkWeatherPlaidProps {
  /** Current textile to render */
  textile: TextileState | null;

  /** Current view mode */
  viewMode: WeatherViewMode;

  /** Gap analysis (for gap view annotations) */
  gapAnalysis?: GapAnalysis | null;

  /** Toggle to next view mode */
  onCycleView: () => void;

  /** Set specific view mode */
  onSetView: (mode: WeatherViewMode) => void;

  /** Whether data is loading */
  isLoading?: boolean;

  /** Visibility level 0–1 (used for pull-to-reveal) */
  visibility?: number;
}

// ─── Color Helpers ───────────────────────────────────────

function threadColor(character: ThreadCharacter, opacity: number): string {
  const { h, s, l } = THREAD_PALETTE[character];
  return `hsla(${h}, ${s}%, ${l}%, ${opacity})`;
}

function gapColor(
  gapType: "missing" | "unique" | "amplified" | "diminished",
  opacity: number,
): string {
  switch (gapType) {
    case "missing":
      return `hsla(0, 60%, 55%, ${opacity})`; // warm red — what you're missing
    case "unique":
      return `hsla(160, 50%, 45%, ${opacity})`; // teal — what only you see
    case "amplified":
      return `hsla(45, 70%, 55%, ${opacity})`; // gold — amplified in your view
    case "diminished":
      return `hsla(220, 30%, 50%, ${opacity * 0.5})`; // muted blue — diminished
  }
}

// ─── View Mode Badge ─────────────────────────────────────

const VIEW_MODE_CONFIG: Record<
  WeatherViewMode,
  { label: string; icon: typeof Globe; description: string }
> = {
  global: {
    label: "Global",
    icon: Globe,
    description: "The whole network",
  },
  personal: {
    label: "Your World",
    icon: Users,
    description: "Your follows only",
  },
  gap: {
    label: "The Gap",
    icon: Layers,
    description: "What you're missing & what's unique to you",
  },
};

// ─── Main Component ──────────────────────────────────────

export const NetworkWeatherPlaid: React.FC<NetworkWeatherPlaidProps> = ({
  textile,
  viewMode,
  gapAnalysis,
  onCycleView,
  onSetView,
  isLoading = false,
  visibility = 0.15,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Revealed state: true when visibility > 0.5 (driven by parent pull-to-reveal)
  const isRevealed = visibility > 0.5;

  // ─── Long-press gesture to toggle view ─────────────

  const handlePointerDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      onCycleView();
    }, 500);
  }, [onCycleView]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // ─── Empty / Loading State ─────────────────────────

  if (!textile || textile.threads.length === 0) {
    if (isLoading) {
      return (
        <div
          className="pointer-events-none absolute inset-0 animate-pulse"
          style={{
            background:
              "linear-gradient(135deg, hsla(38,30%,50%,0.05), hsla(230,20%,40%,0.05))",
            opacity: visibility * 0.3,
          }}
        />
      );
    }
    return null;
  }

  const warpThreads = textile.threads.filter((t) => t.direction === "warp");
  const weftThreads = textile.threads.filter((t) => t.direction === "weft");

  // Build gap lookup for coloring
  const gapLookup = new Map<
    string,
    { gapType: "missing" | "unique" | "amplified" | "diminished" }
  >();
  if (viewMode === "gap" && gapAnalysis) {
    for (const g of [
      ...gapAnalysis.missing,
      ...gapAnalysis.unique,
      ...gapAnalysis.amplified,
      ...gapAnalysis.diminished,
    ]) {
      gapLookup.set(g.thread.id, { gapType: g.gapType });
    }
  }

  const modeConfig = VIEW_MODE_CONFIG[viewMode];
  const ModeIcon = modeConfig.icon;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 select-none overflow-hidden"
      style={{
        opacity: visibility,
        transition: "opacity 0.6s ease-in-out",
        pointerEvents: isRevealed ? "auto" : "none",
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Textile Canvas */}
      <div className="absolute inset-0">
        {/* Warp threads (vertical, enduring) */}
        {warpThreads.map((thread, i) => {
          const gap = gapLookup.get(thread.id);
          const color = gap
            ? gapColor(gap.gapType, thread.opacity * 0.4)
            : threadColor(thread.character, thread.opacity * 0.15);

          // Distribute vertically across the width
          const totalWidth = warpThreads.reduce((s, t) => s + t.width, 0);
          const offset =
            warpThreads.slice(0, i).reduce((s, t) => s + t.width, 0) /
            Math.max(totalWidth, 0.01);
          const widthPct = (thread.width / Math.max(totalWidth, 0.01)) * 100;

          return (
            <div
              key={`warp-${thread.id}`}
              className="plaid-thread-morph absolute bottom-0 top-0"
              style={{
                left: `${offset * 100}%`,
                width: `${widthPct}%`,
                background: `linear-gradient(180deg, ${color}, ${color.replace(/[\d.]+\)$/, `${thread.opacity * 0.08})`)})`,
                borderRight: `1px solid ${color.replace(/[\d.]+\)$/, "0.05)")}`,
              }}
              title={thread.label}
            />
          );
        })}

        {/* Weft threads (horizontal, emergent) */}
        {weftThreads.map((thread, i) => {
          const gap = gapLookup.get(thread.id);
          const color = gap
            ? gapColor(gap.gapType, thread.opacity * 0.4)
            : threadColor(thread.character, thread.opacity * 0.12);

          const totalHeight = weftThreads.reduce((s, t) => s + t.width, 0);
          const offset =
            weftThreads.slice(0, i).reduce((s, t) => s + t.width, 0) /
            Math.max(totalHeight, 0.01);
          const heightPct = (thread.width / Math.max(totalHeight, 0.01)) * 100;

          return (
            <div
              key={`weft-${thread.id}`}
              className="plaid-thread-morph absolute left-0 right-0"
              style={{
                top: `${offset * 100}%`,
                height: `${heightPct}%`,
                background: `linear-gradient(90deg, ${color}, ${color.replace(/[\d.]+\)$/, `${thread.opacity * 0.06})`)})`,
                borderBottom: `1px solid ${color.replace(/[\d.]+\)$/, "0.04)")}`,
                mixBlendMode: "multiply",
              }}
              title={thread.label}
            />
          );
        })}

        {/* Crossing highlights (where warp meets weft) */}
        {textile.crossings.map((crossing) => {
          const warpThread = warpThreads.find((t) => t.id === crossing.warpId);
          const weftThread = weftThreads.find((t) => t.id === crossing.weftId);
          if (!warpThread || !weftThread) return null;

          const warpTotal = warpThreads.reduce((s, t) => s + t.width, 0);
          const weftTotal = weftThreads.reduce((s, t) => s + t.width, 0);

          const warpIdx = warpThreads.indexOf(warpThread);
          const weftIdx = weftThreads.indexOf(weftThread);

          const x =
            warpThreads.slice(0, warpIdx).reduce((s, t) => s + t.width, 0) /
            Math.max(warpTotal, 0.01);
          const y =
            weftThreads.slice(0, weftIdx).reduce((s, t) => s + t.width, 0) /
            Math.max(weftTotal, 0.01);

          const w = (warpThread.width / Math.max(warpTotal, 0.01)) * 100;
          const h = (weftThread.width / Math.max(weftTotal, 0.01)) * 100;

          return (
            <div
              key={`cross-${crossing.warpId}-${crossing.weftId}`}
              className="plaid-thread-morph absolute"
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${w}%`,
                height: `${h}%`,
                backgroundColor: `hsla(48, 60%, 70%, ${crossing.brightness * 0.15})`,
                mixBlendMode: "screen",
                borderRadius: "2px",
              }}
            />
          );
        })}
      </div>

      {/* View Mode Badge + Toggle */}
      <div
        className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs backdrop-blur-sm"
        style={{
          backgroundColor: "hsla(0, 0%, 0%, 0.3)",
          borderColor: "hsla(0, 0%, 100%, 0.15)",
          color: "hsla(0, 0%, 100%, 0.8)",
          opacity: visibility > 0.5 ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: "auto",
        }}
      >
        <ModeIcon size={12} />
        <span>{modeConfig.label}</span>

        {/* View mode selector dots */}
        <div className="ml-1.5 flex gap-1">
          {VIEW_MODE_CONFIG &&
            (["global", "personal", "gap"] as WeatherViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetView(mode);
                }}
                className="rounded-full transition-all"
                style={{
                  width: viewMode === mode ? 8 : 5,
                  height: 5,
                  backgroundColor:
                    viewMode === mode
                      ? "hsla(0, 0%, 100%, 0.9)"
                      : "hsla(0, 0%, 100%, 0.3)",
                  borderRadius: viewMode === mode ? 3 : "50%",
                }}
                aria-label={`Switch to ${VIEW_MODE_CONFIG[mode].label} view`}
              />
            ))}
        </div>
      </div>

      {/* Weather Report */}
      <div
        className="absolute bottom-3 right-3 z-10 max-w-[280px] rounded-lg border px-3 py-2 text-xs italic backdrop-blur-sm"
        style={{
          backgroundColor: "hsla(0, 0%, 0%, 0.25)",
          borderColor: "hsla(0, 0%, 100%, 0.1)",
          color: "hsla(0, 0%, 100%, 0.7)",
          opacity: visibility > 0.7 ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        <Eye size={10} className="mb-0.5 mr-1 inline-block opacity-60" />
        {textile.weatherReport}
      </div>

      {/* Gap Analysis Annotations */}
      {viewMode === "gap" && gapAnalysis && (
        <div
          className="absolute left-3 top-3 z-10 space-y-1"
          style={{
            opacity: visibility > 0.5 ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          {gapAnalysis.missing.length > 0 && (
            <GapBadge
              color="hsla(0, 60%, 55%, 0.8)"
              count={gapAnalysis.missing.length}
              label="missing from your world"
            />
          )}
          {gapAnalysis.unique.length > 0 && (
            <GapBadge
              color="hsla(160, 50%, 45%, 0.8)"
              count={gapAnalysis.unique.length}
              label="unique to your network"
            />
          )}
          {gapAnalysis.amplified.length > 0 && (
            <GapBadge
              color="hsla(45, 70%, 55%, 0.8)"
              count={gapAnalysis.amplified.length}
              label="amplified in your view"
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Gap Badge Sub-component ─────────────────────────────

const GapBadge: React.FC<{
  color: string;
  count: number;
  label: string;
}> = ({ color, count, label }) => (
  <div
    className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs backdrop-blur-sm"
    style={{
      backgroundColor: "hsla(0, 0%, 0%, 0.3)",
      borderColor: color,
      color: "hsla(0, 0%, 100%, 0.8)",
    }}
  >
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: color }}
    />
    <span>
      {count} {label}
    </span>
  </div>
);

// ─── CSS for morph animation ─────────────────────────────

/**
 * Inject the morph animation styles. These use CSS transitions so
 * threads smoothly widen/narrow/fade when switching between views.
 *
 * Add to your global CSS or a <style> tag:
 *
 * .plaid-thread-morph {
 *   transition: left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
 *               top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
 *               width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
 *               height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
 *               opacity 0.6s ease-in-out,
 *               background 0.6s ease-in-out;
 * }
 */
export const PLAID_MORPH_CSS = `
.plaid-thread-morph {
  transition: left 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
              top 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
              width 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
              height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1),
              opacity 0.6s ease-in-out,
              background 0.6s ease-in-out;
}
`;
