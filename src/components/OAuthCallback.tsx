/**
 * OAuth Callback Handler
 * Handles the redirect back from the authorization server
 */

import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";

export const OAuthCallback: React.FC = () => {
  const navigate = useViewTransitionNavigate();
  const { handleOAuthCallback } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const success = await handleOAuthCallback();
        if (success) {
          // Redirect to home on success
          navigate("/", { replace: true });
        } else {
          setError("Authentication failed. Please try again.");
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Authentication failed";
        setError(message);
      }
    };

    processCallback();
  }, [handleOAuthCallback, navigate]);

  if (error) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--asph-bg-primary)" }}
      >
        <div className="asph-card max-w-md p-6 text-center">
          <div className="mb-4 text-4xl" style={{ color: "var(--asph-error)" }}>
            !
          </div>
          <h2
            className="mb-2 text-xl font-semibold"
            style={{ color: "var(--asph-text-primary)" }}
          >
            Authentication Error
          </h2>
          <p
            className="mb-4 text-sm"
            style={{ color: "var(--asph-text-secondary)" }}
          >
            {error}
          </p>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="asph-button-primary px-4 py-2 text-white"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      <div className="text-center">
        <Loader2
          className="mx-auto h-12 w-12 animate-spin"
          style={{ color: "var(--asph-primary)" }}
        />
        <p className="mt-4" style={{ color: "var(--asph-text-secondary)" }}>
          Completing sign in...
        </p>
      </div>
    </div>
  );
};
