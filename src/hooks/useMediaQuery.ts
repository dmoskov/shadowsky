/**
 * useMediaQuery
 *
 * Subscribes to a CSS media query and returns whether it currently matches.
 *
 * Unlike a `resize` listener that calls setState on every pixel of a drag,
 * `matchMedia(...).addEventListener("change", ...)` only fires when the query
 * result actually flips. This keeps the main thread free during the resize
 * gesture so the browser can repaint smoothly.
 *
 * @param query - A CSS media query string, e.g. "(max-width: 767px)"
 * @returns Whether the query currently matches
 *
 * @example
 * const isNarrow = useMediaQuery("(max-width: 767px)");
 */
import { useEffect, useState } from "react";

function getMatches(query: string): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => getMatches(query));

  useEffect(() => {
    const mql = window.matchMedia(query);

    // Sync immediately in case the query changed between render and effect.
    setMatches(mql.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}
