// Cookie utilities for persistent storage

// Individual exports for backwards compatibility
export const setCookie = (
  name: string,
  value: string,
  options?: { secure?: boolean; sameSite?: string; domain?: string } | number,
) => {
  let days = 365;
  let secure = false;
  let sameSite = "Lax";
  let domain: string | undefined;

  if (typeof options === "number") {
    days = options;
  } else if (options) {
    secure = options.secure || false;
    sameSite = options.sameSite || "Lax";
    domain = options.domain;
  }

  // Auto-detect production domain
  if (!domain && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("shadowsky.io")) {
      // Set domain to work across all shadowsky.io subdomains
      domain = ".shadowsky.io";
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
  // Delete cookie without domain (for local)
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;

  // Also delete with production domain if applicable
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.includes("shadowsky.io")) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;Domain=.shadowsky.io;`;
    }
  }
};

export const cookies = {
  set(name: string, value: string, days: number = 365) {
    setCookie(name, value, days);
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
    cookies.set("columnFeedPrefs", JSON.stringify(prefs));
  },

  getFeedForColumn(columnId: string): string | null {
    const prefs = this.getAll();
    return prefs[columnId] || null;
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
