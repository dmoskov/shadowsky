import { Link, Loader2, X } from "lucide-react";
import { LinkMetadata } from "../services/anthropic";

interface LinkPreviewProps {
  metadata: LinkMetadata | null;
  isLoading: boolean;
  error: string | null;
  onRemove: () => void;
}

export function LinkPreview({
  metadata,
  isLoading,
  error,
  onRemove,
}: LinkPreviewProps) {
  if (isLoading) {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-lg border p-3"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <Loader2
          size={16}
          className="animate-spin"
          style={{ color: "var(--asph-text-secondary)" }}
        />
        <span
          className="text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Loading link preview...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mt-2 flex items-center justify-between gap-2 rounded-lg border p-3"
        style={{ borderColor: "var(--asph-border-primary)" }}
      >
        <div className="flex items-center gap-2">
          <Link size={16} style={{ color: "var(--asph-text-secondary)" }} />
          <span
            className="text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            Could not load preview
          </span>
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="touch-target-icon rounded p-1 transition-colors hover:bg-asph-bg-hover"
          title="Remove link preview"
        >
          <X size={16} style={{ color: "var(--asph-text-secondary)" }} />
        </button>
      </div>
    );
  }

  if (!metadata) {
    return null;
  }

  return (
    <div
      className="group relative mt-2 rounded-lg border"
      style={{ borderColor: "var(--asph-border-primary)" }}
    >
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="touch-target-icon absolute right-2 top-2 z-10 rounded-full bg-black/50 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
        title="Remove link preview"
      >
        <X size={14} />
      </button>

      {metadata.imageUrl && (
        <img
          src={metadata.imageUrl}
          alt=""
          className="h-auto w-full rounded-t-lg object-cover"
          style={{
            maxHeight: "200px",
            backgroundColor: "var(--asph-bg-tertiary)",
          }}
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <div className="p-3">
        <div
          className="line-clamp-2 text-sm font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          {metadata.title}
        </div>
        {metadata.description && (
          <div
            className="mt-1 line-clamp-2 text-xs"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            {metadata.description}
          </div>
        )}
        <div
          className="mt-1 flex items-center gap-1 text-xs"
          style={{ color: "var(--asph-text-tertiary)" }}
        >
          <Link size={12} />
          <span className="truncate">{new URL(metadata.url).hostname}</span>
        </div>
      </div>
    </div>
  );
}
