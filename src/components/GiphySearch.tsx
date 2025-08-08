import { Loader, Search, X } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      width: string;
      height: string;
      size?: string;
    };
    fixed_height_small: {
      url: string;
      width: string;
      height: string;
      size?: string;
    };
    downsized: {
      url: string;
      size: string;
    };
    downsized_small: {
      mp4: string;
      height: string;
      width: string;
      mp4_size: string;
    };
    preview_gif: {
      url: string;
      size: string;
    };
    original: {
      url: string;
      mp4?: string;
      size?: string;
    };
  };
}

interface GiphySearchProps {
  onSelectGif: (gifUrl: string) => void;
  onClose: () => void;
}

// You'll need to get a Giphy API key from https://developers.giphy.com/
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || "";

export function GiphySearch({ onSelectGif, onClose }: GiphySearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [trending, setTrending] = useState<GiphyGif[]>([]);
  const [selectedGifId, setSelectedGifId] = useState<string | null>(null);

  // Load trending GIFs on mount
  useEffect(() => {
    loadTrending();
  }, []);

  const loadTrending = async () => {
    if (!GIPHY_API_KEY) {
      setError("Giphy API key not configured");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=pg-13`,
      );
      const data = await response.json();
      setTrending(data.data);
    } catch (err) {
      console.error("Error loading trending GIFs:", err);
      setError("Failed to load trending GIFs");
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!GIPHY_API_KEY) {
      setError("Giphy API key not configured");
      return;
    }

    if (!query.trim()) {
      setGifs([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=pg-13`,
      );
      const data = await response.json();
      setGifs(data.data);
    } catch (err) {
      console.error("Error searching GIFs:", err);
      setError("Failed to search GIFs");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    // Debounce search
    const timeoutId = setTimeout(() => {
      searchGifs(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, []);

  const handleSelectGif = (gif: GiphyGif) => {
    // Choose the best size for Bluesky's 1MB limit
    // Priority order: preview_gif (smallest), fixed_height_small, fixed_height, downsized
    const MAX_SIZE = 1024 * 1024; // 1MB in bytes

    // Check if we have size information and pick the best option
    if (gif.images.preview_gif && gif.images.preview_gif.size) {
      const size = parseInt(gif.images.preview_gif.size);
      if (size < MAX_SIZE) {
        onSelectGif(gif.images.preview_gif.url);
        return;
      }
    }

    // Try fixed_height_small next (usually around 100px height)
    if (gif.images.fixed_height_small) {
      onSelectGif(gif.images.fixed_height_small.url);
      return;
    }

    // Fall back to fixed_height (usually around 200px height)
    if (gif.images.fixed_height) {
      onSelectGif(gif.images.fixed_height.url);
      return;
    }

    // Last resort: downsized version
    onSelectGif(gif.images.downsized.url);
  };

  const displayGifs = searchTerm ? gifs : trending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg"
        style={{ background: "var(--bsky-bg-primary)" }}
      >
        <div
          className="border-b p-4"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3
              className="text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Search GIFs
            </h3>
            <button
              onClick={onClose}
              className="rounded p-1 hover:bg-gray-100"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 transform"
              size={20}
              style={{ color: "var(--bsky-text-tertiary)" }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search GIFs..."
              value={searchTerm}
              onChange={handleSearch}
              className="w-full rounded-lg py-2 pl-10 pr-4"
              style={{
                background: "var(--bsky-bg-secondary)",
                border: "1px solid var(--bsky-border-primary)",
                color: "var(--bsky-text-primary)",
                outline: "none",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "var(--bsky-primary)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "var(--bsky-border-primary)")
              }
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!GIPHY_API_KEY && (
            <div className="py-8 text-center">
              <p style={{ color: "var(--bsky-text-secondary)" }}>
                Giphy API key not configured. Add VITE_GIPHY_API_KEY to your
                .env file.
              </p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center">
              <p style={{ color: "var(--bsky-error)" }}>{error}</p>
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <Loader
                className="animate-spin"
                size={32}
                style={{ color: "var(--bsky-primary)" }}
              />
            </div>
          )}

          {!loading && !error && displayGifs.length === 0 && searchTerm && (
            <div className="py-8 text-center">
              <p style={{ color: "var(--bsky-text-secondary)" }}>
                No GIFs found
              </p>
            </div>
          )}

          {!loading && !error && displayGifs.length > 0 && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {displayGifs.map((gif) => (
                <button
                  key={gif.id}
                  onClick={() => {
                    setSelectedGifId(gif.id);
                    handleSelectGif(gif);
                    onClose(); // Close the modal after selecting
                  }}
                  className="relative cursor-pointer overflow-hidden rounded-lg transition-opacity hover:opacity-80"
                  style={{
                    background: "var(--bsky-bg-secondary)",
                    opacity: selectedGifId === gif.id ? 0.5 : 1,
                  }}
                  disabled={selectedGifId !== null}
                >
                  <img
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    className="h-auto w-full"
                    loading="lazy"
                  />
                  {selectedGifId === gif.id && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <Loader className="animate-spin text-white" size={32} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {!loading && !searchTerm && (
            <div className="mb-3 text-center">
              <p
                className="text-sm"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Trending GIFs
              </p>
            </div>
          )}
        </div>

        <div
          className="border-t p-3 text-center"
          style={{ borderColor: "var(--bsky-border-primary)" }}
        >
          <p
            className="mb-1 text-xs"
            style={{ color: "var(--bsky-text-tertiary)" }}
          >
            Powered by GIPHY
          </p>
          <p className="text-xs" style={{ color: "var(--bsky-text-tertiary)" }}>
            GIFs will be converted to videos for animation support
          </p>
        </div>
      </div>
    </div>
  );
}
