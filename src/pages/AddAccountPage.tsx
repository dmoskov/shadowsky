import { ArrowLeft, ExternalLink, Key, Mail } from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { ATProtoError } from "../types/errors";

type LoginMode = "oauth" | "app-password";

export const AddAccountPage: React.FC = () => {
  const navigate = useViewTransitionNavigate();
  const { login, loginWithOAuth, isOAuthAvailable } = useAuth();
  const [loginMode, setLoginMode] = useState<LoginMode>(
    isOAuthAvailable ? "oauth" : "app-password",
  );
  const [handle, setHandle] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pdsUrl, setPdsUrl] = useState("https://bsky.social");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showEmailCode, setShowEmailCode] = useState(false);
  const [emailCode, setEmailCode] = useState("");

  useEffect(() => {
    if (!isOAuthAvailable && loginMode === "oauth") {
      setLoginMode("app-password");
    }
  }, [isOAuthAvailable, loginMode]);

  const handleOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await loginWithOAuth(handle);
    } catch (err) {
      const error = err as Error;
      setError(error.message || "Failed to start OAuth login");
      setIsLoading(false);
    }
  };

  const handleAppPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(
        identifier,
        password,
        pdsUrl,
        showEmailCode ? emailCode : undefined,
      );
      // Full page reload to ensure clean state with new session
      window.location.href = "/home";
    } catch (err) {
      const error = err as ATProtoError;
      if (
        error.message?.includes("sign in code has been sent") ||
        error.message?.includes("AuthFactorTokenRequired") ||
        error.status === "AuthFactorTokenRequired"
      ) {
        setShowEmailCode(true);
        setError(
          "A sign in code has been sent to your email address. Please check your email and enter the code below.",
        );
      } else {
        setError(error.message || "Failed to login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md p-4">
      <button
        onClick={() => navigate(-1)}
        className="touch-target-sm mb-6 flex items-center gap-2 text-sm transition-opacity hover:opacity-80"
        style={{ color: "var(--asph-text-secondary)" }}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <div
        className="asph-glass rounded-lg p-6"
        style={{ border: "1px solid var(--asph-border-primary)" }}
      >
        <h1
          className="mb-2 text-xl font-semibold"
          style={{ color: "var(--asph-text-primary)" }}
        >
          Sign into another account
        </h1>
        <p
          className="mb-6 text-sm"
          style={{ color: "var(--asph-text-secondary)" }}
        >
          Add another Bluesky account to switch between
        </p>

        {/* Login Mode Toggle */}
        <div
          className="mb-4 flex rounded-lg p-1"
          style={{ backgroundColor: "var(--asph-bg-tertiary)" }}
        >
          <button
            type="button"
            onClick={() => {
              if (isOAuthAvailable) {
                setLoginMode("oauth");
                setError("");
              }
            }}
            disabled={!isOAuthAvailable}
            className={`touch-target flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              loginMode === "oauth" ? "shadow-sm" : ""
            } ${!isOAuthAvailable ? "cursor-not-allowed opacity-50" : ""}`}
            style={{
              backgroundColor:
                loginMode === "oauth"
                  ? "var(--asph-bg-secondary)"
                  : "transparent",
              color:
                loginMode === "oauth"
                  ? "var(--asph-text-primary)"
                  : "var(--asph-text-tertiary)",
            }}
            title={!isOAuthAvailable ? "OAuth not available yet" : ""}
          >
            <ExternalLink size={16} />
            OAuth
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("app-password");
              setError("");
            }}
            className={`touch-target flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              loginMode === "app-password" ? "shadow-sm" : ""
            }`}
            style={{
              backgroundColor:
                loginMode === "app-password"
                  ? "var(--asph-bg-secondary)"
                  : "transparent",
              color:
                loginMode === "app-password"
                  ? "var(--asph-text-primary)"
                  : "var(--asph-text-tertiary)",
            }}
          >
            <Key size={16} />
            App Password
          </button>
        </div>

        {error && (
          <div
            className="mb-4 flex items-start gap-2 rounded-lg p-3 text-sm"
            style={{
              backgroundColor: showEmailCode
                ? "rgba(59, 130, 246, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
              border: showEmailCode
                ? "1px solid var(--asph-primary)"
                : "1px solid var(--asph-error)",
              color: showEmailCode
                ? "var(--asph-primary)"
                : "var(--asph-error)",
            }}
          >
            {showEmailCode && (
              <Mail size={16} className="mt-0.5 flex-shrink-0" />
            )}
            <span>{error}</span>
          </div>
        )}

        {/* OAuth Login Form */}
        {loginMode === "oauth" && (
          <form onSubmit={handleOAuthSubmit}>
            <div className="mb-4">
              <label
                htmlFor="handle"
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Handle
              </label>
              <input
                type="text"
                id="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full rounded-xl px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  border: "1px solid var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--asph-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--asph-border-primary)")
                }
                placeholder="@handle.bsky.social"
                required
              />
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                You'll be redirected to Bluesky to authorize
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="touch-target-sm asph-button-primary flex w-full items-center justify-center gap-2 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                "Redirecting..."
              ) : (
                <>
                  <ExternalLink size={18} />
                  Sign in with Bluesky
                </>
              )}
            </button>
          </form>
        )}

        {/* App Password Login Form */}
        {loginMode === "app-password" && (
          <form onSubmit={handleAppPasswordSubmit}>
            <div className="mb-4">
              <label
                htmlFor="identifier"
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Handle or Email
              </label>
              <input
                type="text"
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-xl px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  border: "1px solid var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--asph-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--asph-border-primary)")
                }
                placeholder="@handle.bsky.social"
                required
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                App Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
                style={{
                  backgroundColor: "var(--asph-bg-tertiary)",
                  border: "1px solid var(--asph-border-primary)",
                  color: "var(--asph-text-primary)",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "var(--asph-primary)")
                }
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--asph-border-primary)")
                }
                placeholder="xxxx-xxxx-xxxx-xxxx"
                required
              />
              <p
                className="mt-1 text-xs"
                style={{ color: "var(--asph-text-tertiary)" }}
              >
                Create an app password at{" "}
                <a
                  href="https://bsky.app/settings/app-passwords"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                  style={{ color: "var(--asph-primary-dark)" }}
                >
                  bsky.app/settings/app-passwords
                </a>
              </p>
            </div>

            {showEmailCode && (
              <div className="mb-4">
                <label
                  htmlFor="emailCode"
                  className="mb-2 block text-sm font-medium"
                  style={{ color: "var(--asph-text-secondary)" }}
                >
                  Email Verification Code
                </label>
                <input
                  type="text"
                  id="emailCode"
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
                  style={{
                    backgroundColor: "var(--asph-bg-tertiary)",
                    border: "1px solid var(--asph-border-primary)",
                    color: "var(--asph-text-primary)",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = "var(--asph-primary)")
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = "var(--asph-border-primary)")
                  }
                  placeholder="Enter the code from your email"
                  required
                  autoFocus
                />
                <div className="mt-1 flex items-center justify-between">
                  <p
                    className="text-xs"
                    style={{ color: "var(--asph-text-tertiary)" }}
                  >
                    Check your email for the verification code
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailCode("");
                      setShowEmailCode(false);
                      setError("");
                    }}
                    className="touch-target-sm text-xs hover:underline"
                    style={{ color: "var(--asph-primary)" }}
                  >
                    Try different credentials
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="touch-target-sm flex items-center gap-1 text-sm transition-opacity hover:opacity-80"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                <span
                  className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                >
                  ▶
                </span>
                Advanced: Use a different PDS
              </button>

              {showAdvanced && (
                <div className="mt-2">
                  <input
                    type="url"
                    value={pdsUrl}
                    onChange={(e) => setPdsUrl(e.target.value)}
                    className="w-full rounded-xl px-4 py-3 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
                    style={{
                      backgroundColor: "var(--asph-bg-tertiary)",
                      border: "1px solid var(--asph-border-primary)",
                      color: "var(--asph-text-primary)",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--asph-primary)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor =
                        "var(--asph-border-primary)")
                    }
                    placeholder="https://bsky.social"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="touch-target-sm asph-button-primary w-full px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
