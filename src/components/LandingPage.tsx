import {
  Activity,
  BarChart3,
  Bell,
  Database,
  ExternalLink,
  Key,
  Mail,
  MessageSquare,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { ATProtoError } from "../types/errors";
import butterflyIcon from "/butterfly-icon.svg";

type LoginMode = "oauth" | "app-password";

const AuthExplainer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="touch-target-sm flex w-full items-center gap-2 text-sm transition-opacity hover:opacity-80"
        style={{ color: "var(--asph-text-secondary)" }}
        aria-expanded={isOpen}
      >
        <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>
          ▶
        </span>
        Which sign-in method should I use?
      </button>

      {isOpen && (
        <div
          className="mt-3 space-y-3 rounded-lg p-4 text-sm"
          style={{ backgroundColor: "var(--asph-bg-secondary)" }}
        >
          <div>
            <p
              className="mb-1 font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              OAuth (Recommended)
            </p>
            <p style={{ color: "var(--asph-text-secondary)" }}>
              Redirects you to Bluesky to authorize access. More secure because
              you never share your password. However, OAuth does not currently
              support direct messages &mdash; granular permission scopes are
              still being developed by the AT Protocol team.
            </p>
          </div>
          <div>
            <p
              className="mb-1 font-semibold"
              style={{ color: "var(--asph-text-primary)" }}
            >
              App Password (Required for DMs)
            </p>
            <p style={{ color: "var(--asph-text-secondary)" }}>
              Use an{" "}
              <a
                href="https://bsky.app/settings/app-passwords"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:no-underline"
                style={{ color: "var(--asph-primary)" }}
              >
                app password
              </a>{" "}
              if you need access to direct messages. App passwords provide full
              account access but are separate from your main password, so you
              can revoke them anytime.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export const LandingPage: React.FC = () => {
  const { login, loginWithOAuth, isOAuthAvailable } = useAuth();
  // Default to app-password if OAuth isn't available yet
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

  // Switch to app-password mode if OAuth becomes unavailable
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
      // This will redirect, so we won't reach here
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
    } catch (err) {
      // Check if this is an email auth factor error
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
    <div
      className="asph-font min-h-screen"
      style={{ background: "var(--asph-bg-primary)" }}
    >
      {/* Skip to main content link for landing page */}
      <a href="#login-form" className="skip-link">
        Skip to login form
      </a>
      <main
        id="main-content"
        role="main"
        aria-label="Asphodel landing page"
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      >
        <div className="grid grid-cols-1 items-start gap-6 sm:gap-12 lg:grid-cols-2">
          {/* Left side - Login and info */}
          <section aria-labelledby="login-heading">
            <div className="mb-8 text-center lg:text-left">
              <div className="mb-4 flex items-center justify-center gap-3 lg:justify-start">
                <img
                  src={butterflyIcon}
                  alt="Asphodel Logo"
                  className="h-16 w-16 rounded-xl shadow-md"
                />
                <div>
                  <h1 className="asph-gradient-text text-3xl font-bold">
                    Asphodel
                  </h1>
                  <p
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Free Bluesky Analytics & Notifications
                  </p>
                </div>
              </div>
            </div>

            {/* Login Form */}
            <div
              id="login-form"
              className="asph-card mb-6 p-6 shadow-md"
              role="form"
              aria-labelledby="login-heading"
            >
              <h2
                id="login-heading"
                className="mb-4 text-xl font-semibold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                Sign in with your Bluesky account
              </h2>

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
                      className="w-full rounded-xl px-4 py-3 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
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
                      className="w-full rounded-xl px-4 py-3 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
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
                      className="w-full rounded-xl px-4 py-3 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
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
                        style={{ color: "var(--asph-text-secondary)" }}
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
                        className="w-full rounded-xl px-4 py-3 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
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
                      <div className="mt-3">
                        <label
                          htmlFor="pdsUrl"
                          className="mb-2 block text-sm font-medium"
                          style={{ color: "var(--asph-text-secondary)" }}
                        >
                          PDS Server URL
                        </label>
                        <input
                          type="url"
                          id="pdsUrl"
                          value={pdsUrl}
                          onChange={(e) => setPdsUrl(e.target.value)}
                          className="w-full rounded-xl px-4 py-3 text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-50"
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
                        <p
                          className="mt-1 text-xs"
                          style={{ color: "var(--asph-text-tertiary)" }}
                        >
                          Default is https://bsky.social. Only change if you use
                          a different PDS.
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="touch-target-sm asph-button-primary w-full px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoading
                      ? "Signing in..."
                      : showEmailCode
                        ? "Verify Code"
                        : "Sign In"}
                  </button>
                </form>
              )}
            </div>

            {/* Auth Explainer */}
            <AuthExplainer />

            {/* Security Info */}
            <aside className="space-y-3" aria-label="Security information">
              <div
                className="flex items-start gap-3 rounded-lg p-3"
                style={{ backgroundColor: "var(--asph-bg-secondary)" }}
              >
                <Shield
                  size={18}
                  style={{ color: "var(--asph-success)" }}
                  className="mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    Your credentials go directly to Bluesky. We never store
                    passwords.
                  </p>
                </div>
              </div>

              <div
                className="flex items-start gap-3 rounded-lg p-3"
                style={{ backgroundColor: "var(--asph-bg-secondary)" }}
              >
                <Database
                  size={18}
                  style={{ color: "var(--asph-primary)" }}
                  className="mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div>
                  <p
                    className="text-sm"
                    style={{ color: "var(--asph-text-secondary)" }}
                  >
                    All data stored locally on your device. Nothing sent to
                    external servers.
                  </p>
                </div>
              </div>
            </aside>
          </section>

          {/* Right side - Features */}
          <section aria-labelledby="features-heading">
            <header className="mb-6">
              <h2
                id="features-heading"
                className="mb-4 text-2xl font-bold"
                style={{ color: "var(--asph-text-primary)" }}
              >
                What you'll get
              </h2>
              <p
                className="mb-6 text-lg"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                Transform your Bluesky notifications into insights. Track
                conversations, analyze engagement, never miss what matters.
              </p>
            </header>

            <ul className="list-none space-y-4" aria-label="Features list">
              {/* Key Features */}
              <li className="asph-card p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <Bell
                    size={20}
                    style={{ color: "var(--asph-primary)" }}
                    className="mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3
                      className="mb-1 font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Smart Notifications Feed
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      All notifications organized with filters, aggregation, and
                      unread tracking. See likes, reposts, follows, mentions,
                      and replies in one place.
                    </p>
                  </div>
                </div>
              </li>

              <li className="asph-card p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <MessageSquare
                    size={20}
                    style={{ color: "var(--asph-success)" }}
                    className="mt-0.5 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <div>
                    <h3
                      className="mb-1 font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Conversation Tracking
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      Never lose track of replies. See all conversations in
                      threaded view with search and unread indicators.
                    </p>
                  </div>
                </div>
              </li>

              <li className="asph-card p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <BarChart3
                    size={20}
                    className="mt-0.5 flex-shrink-0 text-purple-500 dark:text-purple-400"
                    aria-hidden="true"
                  />
                  <div>
                    <h3
                      className="mb-1 font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Engagement Analytics
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      See trends, top engagers, and activity patterns.
                      Understand when and how people interact with your content.
                    </p>
                  </div>
                </div>
              </li>

              <li className="asph-card p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <Zap
                    size={20}
                    className="mt-0.5 flex-shrink-0 text-yellow-500 dark:text-yellow-400"
                    aria-hidden="true"
                  />
                  <div>
                    <h3
                      className="mb-1 font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Lightning Fast & Works Offline
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      Loads instantly with intelligent caching. Pre-fetches 4
                      weeks of data for offline access.
                    </p>
                  </div>
                </div>
              </li>

              <li className="asph-card p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <Activity
                    size={20}
                    className="mt-0.5 flex-shrink-0 text-orange-400 dark:text-orange-300"
                    aria-hidden="true"
                  />
                  <div>
                    <h3
                      className="mb-1 font-semibold"
                      style={{ color: "var(--asph-text-primary)" }}
                    >
                      Visual Timeline
                    </h3>
                    <p
                      className="text-sm"
                      style={{ color: "var(--asph-text-secondary)" }}
                    >
                      Beautiful chronological view of your notifications with
                      activity bursts and time gaps.
                    </p>
                  </div>
                </div>
              </li>
            </ul>

            <aside
              className="mt-6 rounded-lg p-4"
              style={{ backgroundColor: "var(--asph-bg-secondary)" }}
              aria-label="Additional information"
            >
              <div className="mb-2 flex items-center gap-2">
                <Sparkles
                  size={18}
                  style={{ color: "var(--asph-primary)" }}
                  aria-hidden="true"
                />
                <span
                  className="font-semibold"
                  style={{ color: "var(--asph-text-primary)" }}
                >
                  100% Free & Open
                </span>
              </div>
              <p
                className="text-sm"
                style={{ color: "var(--asph-text-secondary)" }}
              >
                No ads, no tracking, no premium tiers. Just a useful tool for
                the Bluesky community.
              </p>
            </aside>
          </section>
        </div>
      </main>
    </div>
  );
};
