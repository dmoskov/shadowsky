import { useState, useEffect, useRef, useCallback } from "react";
import { fetchLinkMetadata, type LinkMetadata } from "../services/ai-service";

const URL_REGEX = /https?:\/\/[^\s<>)"']+/i;
const BSKY_POST_REGEX = /bsky\.app\/profile\/[^/]+\/post\//;
const DEBOUNCE_MS = 500;

export function useLinkPreview(text: string) {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastFetchedUrl = useRef<string | null>(null);

  useEffect(() => {
    const match = text.match(URL_REGEX);
    const url = match?.[0] || null;

    // Skip bsky post URLs
    if (url && BSKY_POST_REGEX.test(url)) {
      setDetectedUrl(null);
      return;
    }

    if (url !== detectedUrl) {
      setDetectedUrl(url);
      setDismissed(false);
    }
  }, [text]);

  useEffect(() => {
    if (!detectedUrl || dismissed) {
      if (!detectedUrl) {
        setMetadata(null);
        lastFetchedUrl.current = null;
      }
      return;
    }

    // Don't re-fetch the same URL
    if (detectedUrl === lastFetchedUrl.current && metadata) return;

    const timer = setTimeout(async () => {
      // Cancel previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      try {
        const result = await fetchLinkMetadata(detectedUrl);
        if (!controller.signal.aborted) {
          setMetadata(result);
          lastFetchedUrl.current = detectedUrl;
        }
      } catch {
        if (!controller.signal.aborted) {
          setMetadata(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [detectedUrl, dismissed]);

  const clearPreview = useCallback(() => {
    setDismissed(true);
    setMetadata(null);
  }, []);

  return { isLoading, metadata, detectedUrl, clearPreview };
}
