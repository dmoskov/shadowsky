// Cookie utilities for persistent storage

// Individual exports for backwards compatibility
export const setCookie = (
  name: string,
  value: string,
  options?:
    | { secure?: boolean; sameSite?: string; domain?: string; days?: number }
    | number,
) => {
  let days = 365;
  let secure = false;
  let sameSite = "Lax";
  let domain: string | undefined;

  if (typeof options === "number") {
    days = options;
  } else if (options) {
    days = options.days || 365;
    secure = options.secure || false;
    sameSite = options.sameSite || "Lax";
    domain = options.domain;
  }

  // Auto-detect production domain
  if (!domain && typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Don't set domain for localhost/development
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      domain = undefined;
    }
    // Handle shadowsky.io domains
    else if (hostname.includes("shadowsky.io")) {
      domain = ".shadowsky.io";
    }
    // Handle AWS Amplify domains
    else if (hostname.includes("amplifyapp.com")) {
      // For Amplify, use the full subdomain
      const parts = hostname.split(".");
      if (parts.length >= 3) {
        // Keep the app-specific subdomain
        domain = hostname;
      }
    }
    // For any other production domain, don't set domain attribute
    // This allows the cookie to work on the current domain
    else if (
      hostname !== "localhost" &&
      !hostname.startsWith("192.168") &&
      !hostname.startsWith("10.")
    ) {
      // Don't set domain - cookie will be available on current domain only
      domain = undefined;
    }
  }

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  let cookieString = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=${sameSite}`;

  if (domain) {
    cookieString += `;Domain=${domain}`;
  }

  if (secure) {
    cookieString += ";Secure";
  }

  document.cookie = cookieString;
};

export const getCookie = (name: string): string | null => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) {
      return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
  }
  return null;
};

export const deleteCookie = (name: string) => {
  // Delete cookie without domain (for local and current domain)
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;

  // Also delete with specific domains if applicable
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;

    // Delete for shadowsky.io
    if (hostname.includes("shadowsky.io")) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;Domain=.shadowsky.io;`;
    }
    // Delete for Amplify domains
    else if (hostname.includes("amplifyapp.com")) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;Domain=${hostname};`;
    }
  }
};

export const cookies = {
  set(name: string, value: string, days: number = 365) {
    setCookie(name, value, {
      secure:
        typeof window !== "undefined" && window.location.protocol === "https:",
      sameSite: "Lax",
    });
  },

  get(name: string): string | null {
    const nameEQ = name + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === " ") c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  },

  delete(name: string) {
    deleteCookie(name);
  },
};

// Specific functions for column feed preferences
export const columnFeedPrefs = {
  setFeedForColumn(columnId: string, feedUri: string) {
    const prefs = this.getAll();
    prefs[columnId] = feedUri;
    const prefsJson = JSON.stringify(prefs);

    // Debug logging in development
    if (process.env.NODE_ENV === "development") {
      console.log("Setting column feed preference:", {
        columnId,
        feedUri,
        allPrefs: prefs,
        cookieValue: prefsJson.length,
      });
    }

    cookies.set("columnFeedPrefs", prefsJson);
  },

  getFeedForColumn(columnId: string): string | null {
    const prefs = this.getAll();
    const result = prefs[columnId] || null;

    // Debug logging in development
    if (process.env.NODE_ENV === "development") {
      console.log("Getting column feed preference:", {
        columnId,
        result,
        allPrefs: prefs,
      });
    }

    return result;
  },

  getAll(): Record<string, string> {
    const stored = cookies.get("columnFeedPrefs");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    return {};
  },

  clear() {
    cookies.delete("columnFeedPrefs");
  },
};
