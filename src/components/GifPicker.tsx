/**
 * GifPicker - GIF search and selection UI using Tenor
 *
 * Bottom sheet modal with search bar and masonry grid of GIF previews
 * Uses Tenor API for GIF search and trending GIFs
 */

import { Loader, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { TenorGif } from "../services/tenor";
import { getBestGifUrl } from "../services/tenor";

interface GifPickerProps {
  onSelectGif: (gif: TenorGif) => void;
  onClose: () => void;
  gifs: TenorGif[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearch: (query: string) => void;
}

export function GifPicker({
  onSelectGif,
  onClose,
  gifs,
  loading,
  error,
  searchQuery,
  onSearch,
}: GifPickerProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedGifId, setSelectedGifId] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Cleanup debounce timer
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Debounce search by 500ms
      debounceTimerRef.current = setTimeout(() => {
        onSearch(value);
      }, 500);
    },
    [onSearch],
  );

  const handleSelectGif = useCallback(
    (gif: TenorGif) => {
      setSelectedGifId(gif.id);
      onSelectGif(gif);
      // Don't close immediately - let parent handle it
      setTimeout(() => {
        onClose();
      }, 300);
    },
    [onSelectGif, onClose],
  );

  const hasApiKey = !!import.meta.env.VITE_TENOR_API_KEY;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-auto-height modal-2xl bg-asph-bg-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with search */}
        <div
          className="border-b p-4"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              Search GIFs
            </h3>
            <button
              onClick={onClose}
              className="touch-target-icon rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 transform"
              size={20}
              style={{ color: "var(--asph-text-tertiary)" }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search GIFs..."
              defaultValue={searchQuery}
              onChange={handleSearchChange}
              className="w-full rounded-lg py-2 pl-10 pr-4"
              style={{
                background: "var(--asph-bg-secondary)",
                border: "1px solid var(--asph-border-primary)",
                color: "var(--asph-text-primary)",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "var(--asph-primary)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "var(--asph-border-primary)")
              }
              autoFocus
            />
          </div>
        </div>

        {/* GIF grid content */}
        <div
          className="asph-scrollbar flex-1 overflow-y-auto p-4"
          style={{ maxHeight: "60vh" }}
        >
          {!hasApiKey && (
            <div className="py-8 text-center">
              <p style={{ color: "var(--asph-text-secondary)" }}>
                Tenor API key not configured. Add VITE_TENOR_API_KEY to your
                .env file.
              </p>
              <p
                className="mt-2 text-sm"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                Get a free API key at{" "}
                <a
                  href="https://developers.google.com/tenor/guides/quickstart"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "var(--asph-primary)" }}
                >
                  developers.google.com/tenor
                </a>
              </p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center">
              <p style={{ color: "var(--asph-error)" }}>{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <Loader
                className="animate-spin"
                size={32}
                style={{ color: "var(--asph-primary)" }}
              />
            </div>
          )}

          {!loading && !error && gifs.length === 0 && searchQuery && (
            <div className="py-8 text-center">
              <p style={{ color: "var(--asph-text-secondary)" }}>
                No GIFs found for "{searchQuery}"
              </p>
            </div>
          )}

          {!loading && !error && gifs.length > 0 && (
            <>
              {!searchQuery && (
                <div className="mb-3 text-center">
                  <p
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Trending GIFs
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {gifs.map((gif) => {
                  const gifUrl = getBestGifUrl(gif);
                  return (
                    <button
                      key={gif.id}
                      onClick={() => handleSelectGif(gif)}
                      className="relative cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-80"
                      style={{
                        background: "var(--asph-bg-secondary)",
                        opacity: selectedGifId === gif.id ? 0.5 : 1,
                      }}
                      disabled={selectedGifId !== null}
                      aria-label={gif.title || gif.content_description}
                    >
                      <img
                        src={gifUrl}
                        alt={gif.title || gif.content_description}
                        className="h-auto w-full"
                        loading="lazy"
                      />
                      {selectedGifId === gif.id && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                          <Loader
                            className="animate-spin text-white"
                            size={32}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="border-t p-3 text-center"
          style={{ borderColor: "var(--asph-border-primary)" }}
        >
          <p
            className="mb-1 text-xs"
            style={{ color: "var(--asph-text-tertiary)" }}
          >
            Powered by Tenor
          </p>
          <p className="text-xs" style={{ color: "var(--asph-text-tertiary)" }}>
            GIFs will be attached as animated images
          </p>
        </div>
      </div>
    </div>
  );
}
