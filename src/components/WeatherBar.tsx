/**
 * WeatherBar (Web)
 *
 * A subtle bar at the top of the feed listing the top trending narratives as
 * links, with the full set available as thread chips. The weather metaphor
 * lives entirely in color (bar tint, hue dots, ambient background) — the text
 * stays factual.
 *
 * See: docs/vision/network-weather.md (Layers 2-3)
 */

import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type {
  NetworkWeatherState,
  WeatherHue,
} from "../services/network-weather";
import {
  weatherColor,
  weatherColorWithAlpha,
} from "../services/network-weather";
import { describeEmergent } from "../services/weather-report";
import { NarrativePostsModal } from "./NarrativePostsModal";

interface Props {
  weather: NetworkWeatherState | null | undefined;
}

const HUE_POOL: WeatherHue[] = [
  "indigo",
  "rust",
  "ochre",
  "sage",
  "slate",
  "sienna",
  "charcoal",
  "ivory",
];

/** How many topics the headline lists before deferring to the chips. */
const HEADLINE_TOPICS = 3;

function assignHue(name: string, index: number): WeatherHue {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return HUE_POOL[Math.abs(hash + index) % HUE_POOL.length];
}

function getColor(hue: WeatherHue): string {
  return weatherColor(hue, document.documentElement.classList.contains("dark"));
}

export function WeatherBar({ weather }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Which topic's posts are open. Was a bare boolean with the modal wired to
  // the emergent thread, so a chip could never show its own posts.
  const [openPosts, setOpenPosts] = useState<{
    topic: string;
    uris: string[];
  } | null>(null);
  const navigate = useNavigate();

  // The bar's wash carries the dominant hue rather than a fixed brand tint, so
  // the weather is legible as colour before you read a word of the report.
  const barTint = useMemo(() => {
    if (!weather) return "transparent";
    const isDark = document.documentElement.classList.contains("dark");
    return weatherColorWithAlpha(weather.dominantHue, isDark, 0.14);
  }, [weather]);

  // Hide entirely when running on fallback data (Pan API not connected)
  if (!weather || weather.source === "fallback") return null;

  const narratives = weather.narratives?.narratives ?? [];
  const emergent = weather.emergence?.emergentThreads?.find(
    (t) => t.isEmergent,
  );

  // With nothing factual to report, the bar has no job — the ambient color
  // layers still carry the mood on their own.
  if (!emergent && narratives.length === 0) return null;

  const chips = narratives.slice(0, 8);
  const headline = chips.slice(0, HEADLINE_TOPICS);
  const moreCount = chips.length - headline.length;

  const searchTopic = (topic: string) =>
    navigate(`/search?q=${encodeURIComponent(topic)}`);

  // Prefer the classifier's own posts; search is the fallback when Pan didn't
  // ship sample URIs. Narrative labels are generated cluster summaries, so a
  // text search for one returns nothing — the URIs are the real destination.
  const openTopic = (topic: string, sampleUris?: string[]) => {
    if (sampleUris?.length) setOpenPosts({ topic, uris: sampleUris });
    else searchTopic(topic);
  };

  // With chips available, the bar toggles them; otherwise clicking the bar
  // opens the emergent topic it's describing.
  const handleBarClick = () => {
    if (narratives.length > 0) setExpanded(!expanded);
    else if (emergent) openTopic(emergent.token, emergent.samplePostUris);
  };

  return (
    <div
      className="cursor-pointer select-none border-b border-asph-border-primary px-4 py-3 text-asph-text-primary motion-safe:transition-colors motion-safe:duration-[3s]"
      style={{ backgroundColor: barTint }}
      title="Trending topics across Bluesky right now. Click a topic to see its posts."
      onClick={handleBarClick}
    >
      {/* Report line — an emergent topic headline, or the top topics as links */}
      <p className="text-sm leading-relaxed font-medium">
        {emergent ? (
          <>
            {describeEmergent(emergent)}
            <button
              className="ml-2 text-xs font-semibold text-asph-text-link underline-offset-2 hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                openTopic(emergent.token, emergent.samplePostUris);
              }}
            >
              See posts
            </button>
          </>
        ) : (
          <>
            <span className="text-asph-text-secondary">Trending: </span>
            {headline.map((n, i) => {
              const color = getColor(assignHue(n.name, i));
              return (
                <Fragment key={n.id}>
                  {i > 0 && (
                    <span className="text-asph-text-tertiary"> · </span>
                  )}
                  <button
                    className="underline-offset-2 hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openTopic(n.name, n.samplePostUris);
                    }}
                  >
                    <span
                      className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                      style={{ backgroundColor: color }}
                    />
                    {n.name}
                  </button>
                </Fragment>
              );
            })}
            {moreCount > 0 && (
              <button
                className="ml-2 text-xs font-semibold text-asph-text-link underline-offset-2 hover:underline"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
              >
                {expanded ? "less" : `+${moreCount} more`}
              </button>
            )}
          </>
        )}
      </p>

      {openPosts && (
        <NarrativePostsModal
          topic={openPosts.topic}
          postUris={openPosts.uris}
          isOpen={true}
          onClose={() => setOpenPosts(null)}
        />
      )}

      {/* Expandable thread chips — click to open that narrative's posts */}
      {expanded && chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chips.map((n, i) => {
            const hue = assignHue(n.name, i);
            const color = getColor(hue);
            return (
              <button
                key={n.id}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors hover:opacity-80"
                style={{ borderColor: color }}
                onClick={(e) => {
                  e.stopPropagation();
                  openTopic(n.name, n.samplePostUris);
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-asph-text-primary">{n.name}</span>
                {n.threadType === "weft" && (
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-asph-text-tertiary">
                    emergent
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
