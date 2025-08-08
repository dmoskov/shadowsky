// Cookie utilities for persistent storage

// Individual exports for backwards compatibility
export const setCookie = (
  name: string,
  value: string,
  options?: { secure?: boolean; sameSite?: string } | number,
) => {
  let days = 365;
  let secure = false;
  let sameSite = "Lax";

  if (typeof options === "number") {
    days = options;
  } else if (options) {
    secure = options.secure || false;
    sameSite = options.sameSite || "Lax";
  }

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  let cookieString = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=${sameSite}`;
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
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

export const cookies = {
  set(name: string, value: string, days: number = 365) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
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
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
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
