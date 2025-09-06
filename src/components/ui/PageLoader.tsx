import React from "react";
import { Loader } from "lucide-react";

export const PageLoader: React.FC = () => {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader
          className="animate-spin"
          size={48}
          style={{ color: "var(--bsky-primary)" }}
        />
        <p
          className="text-sm animate-pulse"
          style={{ color: "var(--bsky-text-secondary)" }}
        >
          Loading...
        </p>
      </div>
    </div>
  );
};