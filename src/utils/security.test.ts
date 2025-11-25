import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  extractDomain,
  getSafeLinkAttributes,
  isTrustedMediaUrl,
  isValidUrl,
  sanitizeHtml,
  sanitizeRichHtml,
  sanitizeUrl,
  TRUSTED_MEDIA_DOMAINS,
} from "./security";

describe("security utilities", () => {
  describe("isValidUrl", () => {
    describe("valid URLs", () => {
      it("should accept https URLs", () => {
        expect(isValidUrl("https://example.com")).toBe(true);
        expect(isValidUrl("https://sub.example.com/path")).toBe(true);
        expect(isValidUrl("https://example.com:8080/path?query=1")).toBe(true);
      });

      it("should accept http URLs", () => {
        expect(isValidUrl("http://example.com")).toBe(true);
        expect(isValidUrl("http://localhost:3000")).toBe(true);
      });

      it("should accept mailto URLs", () => {
        expect(isValidUrl("mailto:test@example.com")).toBe(true);
        expect(isValidUrl("mailto:user@domain.org?subject=Test")).toBe(true);
      });

      it("should accept relative URLs", () => {
        expect(isValidUrl("/path/to/page")).toBe(true);
        expect(isValidUrl("/profile/user.bsky.social")).toBe(true);
        expect(isValidUrl("/search?q=test")).toBe(true);
      });
    });

    describe("XSS attack vectors - javascript: protocol", () => {
      it("should reject javascript: URLs", () => {
        expect(isValidUrl("javascript:alert(1)")).toBe(false);
        expect(isValidUrl("javascript:void(0)")).toBe(false);
        expect(isValidUrl("javascript:document.cookie")).toBe(false);
      });

      it("should reject javascript: with various encodings", () => {
        expect(isValidUrl("JAVASCRIPT:alert(1)")).toBe(false);
        expect(isValidUrl("JavaScript:alert(1)")).toBe(false);
        expect(isValidUrl("  javascript:alert(1)")).toBe(false);
      });

      it("should reject javascript: with newlines and whitespace", () => {
        expect(isValidUrl("java\nscript:alert(1)")).toBe(false);
        expect(isValidUrl("java\tscript:alert(1)")).toBe(false);
      });
    });

    describe("XSS attack vectors - other dangerous protocols", () => {
      it("should reject vbscript: URLs", () => {
        expect(isValidUrl("vbscript:msgbox(1)")).toBe(false);
        expect(isValidUrl("VBSCRIPT:alert(1)")).toBe(false);
      });

      it("should reject data: URLs", () => {
        expect(isValidUrl("data:text/html,<script>alert(1)</script>")).toBe(
          false,
        );
        expect(
          isValidUrl(
            "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
          ),
        ).toBe(false);
      });

      it("should reject file: URLs", () => {
        expect(isValidUrl("file:///etc/passwd")).toBe(false);
        expect(isValidUrl("file://localhost/etc/passwd")).toBe(false);
      });

      it("should reject about: URLs", () => {
        expect(isValidUrl("about:blank")).toBe(false);
        expect(isValidUrl("about:config")).toBe(false);
      });

      it("should reject blob: URLs", () => {
        expect(isValidUrl("blob:https://example.com/uuid")).toBe(false);
      });
    });

    describe("edge cases", () => {
      it("should reject empty and null values", () => {
        expect(isValidUrl("")).toBe(false);
        expect(isValidUrl(null as unknown as string)).toBe(false);
        expect(isValidUrl(undefined as unknown as string)).toBe(false);
      });

      it("should reject protocol-relative URLs", () => {
        expect(isValidUrl("//example.com")).toBe(false);
      });

      it("should reject malformed URLs without protocol", () => {
        expect(isValidUrl("example.com")).toBe(false);
        expect(isValidUrl("www.example.com")).toBe(false);
      });
    });
  });

  describe("sanitizeUrl", () => {
    it("should return valid URLs unchanged", () => {
      expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
      expect(sanitizeUrl("/path/to/page")).toBe("/path/to/page");
    });

    it("should return fallback for invalid URLs", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
      expect(sanitizeUrl("javascript:alert(1)", "/")).toBe("/");
    });
  });

  describe("isTrustedMediaUrl", () => {
    it("should accept trusted Bluesky domains", () => {
      expect(isTrustedMediaUrl("https://cdn.bsky.app/img/avatar")).toBe(true);
      expect(isTrustedMediaUrl("https://cdn.bsky.social/image.jpg")).toBe(true);
      expect(isTrustedMediaUrl("https://av.bsky.app/video.mp4")).toBe(true);
      expect(isTrustedMediaUrl("https://video.bsky.app/clip.webm")).toBe(true);
    });

    it("should accept trusted third-party media domains", () => {
      expect(
        isTrustedMediaUrl("https://media.giphy.com/media/abc/giphy.gif"),
      ).toBe(true);
      expect(isTrustedMediaUrl("https://media.tenor.com/images/abc.gif")).toBe(
        true,
      );
      expect(isTrustedMediaUrl("https://www.youtube.com/watch?v=abc")).toBe(
        true,
      );
    });

    it("should accept subdomains of trusted domains", () => {
      expect(isTrustedMediaUrl("https://sub.cdn.bsky.app/image.jpg")).toBe(
        true,
      );
    });

    it("should reject untrusted domains", () => {
      expect(isTrustedMediaUrl("https://malicious-site.com/image.jpg")).toBe(
        false,
      );
      expect(isTrustedMediaUrl("https://evil.com")).toBe(false);
    });

    it("should reject non-http(s) protocols", () => {
      expect(isTrustedMediaUrl("javascript:alert(1)")).toBe(false);
      expect(isTrustedMediaUrl("data:image/png;base64,abc")).toBe(false);
    });

    it("should reject invalid inputs", () => {
      expect(isTrustedMediaUrl("")).toBe(false);
      expect(isTrustedMediaUrl(null as unknown as string)).toBe(false);
      expect(isTrustedMediaUrl("not-a-url")).toBe(false);
    });
  });

  describe("sanitizeHtml", () => {
    it("should strip all HTML tags", () => {
      expect(sanitizeHtml("<script>alert(1)</script>")).toBe("");
      expect(sanitizeHtml("<b>bold</b>")).toBe("bold");
      expect(sanitizeHtml("<a href='http://evil.com'>click</a>")).toBe("click");
    });

    it("should handle XSS attack payloads", () => {
      expect(sanitizeHtml("<img src=x onerror=alert(1)>")).toBe("");
      expect(sanitizeHtml("<svg onload=alert(1)>")).toBe("");
      expect(sanitizeHtml('<iframe src="javascript:alert(1)"></iframe>')).toBe(
        "",
      );
    });

    it("should preserve text content", () => {
      expect(sanitizeHtml("Hello World")).toBe("Hello World");
      expect(sanitizeHtml("Hello <b>World</b>!")).toBe("Hello World!");
    });

    it("should handle empty and invalid inputs", () => {
      expect(sanitizeHtml("")).toBe("");
      expect(sanitizeHtml(null as unknown as string)).toBe("");
      expect(sanitizeHtml(undefined as unknown as string)).toBe("");
    });
  });

  describe("sanitizeRichHtml", () => {
    it("should allow safe formatting tags", () => {
      expect(sanitizeRichHtml("<b>bold</b>")).toBe("<b>bold</b>");
      expect(sanitizeRichHtml("<i>italic</i>")).toBe("<i>italic</i>");
      expect(sanitizeRichHtml("<em>emphasis</em>")).toBe("<em>emphasis</em>");
      expect(sanitizeRichHtml("<strong>strong</strong>")).toBe(
        "<strong>strong</strong>",
      );
    });

    it("should allow links with safe attributes", () => {
      const result = sanitizeRichHtml('<a href="https://example.com">link</a>');
      expect(result).toContain("href");
      expect(result).toContain("example.com");
    });

    it("should strip dangerous tags", () => {
      expect(sanitizeRichHtml("<script>alert(1)</script>")).toBe("");
      expect(sanitizeRichHtml('<img src="x" onerror="alert(1)">')).toBe("");
    });

    it("should strip event handlers", () => {
      const result = sanitizeRichHtml(
        '<a href="#" onclick="alert(1)">click</a>',
      );
      expect(result).not.toContain("onclick");
    });
  });

  describe("getSafeLinkAttributes", () => {
    it("should return correct attributes for external URLs", () => {
      const attrs = getSafeLinkAttributes("https://example.com");
      expect(attrs).toEqual({
        href: "https://example.com",
        target: "_blank",
        rel: "noopener noreferrer",
      });
    });

    it("should return _self target for relative URLs", () => {
      const attrs = getSafeLinkAttributes("/profile/user");
      expect(attrs).toEqual({
        href: "/profile/user",
        target: "_self",
        rel: "",
      });
    });

    it("should return null for invalid URLs", () => {
      expect(getSafeLinkAttributes("javascript:alert(1)")).toBe(null);
      expect(getSafeLinkAttributes("")).toBe(null);
    });
  });

  describe("extractDomain", () => {
    it("should extract domain from valid URLs", () => {
      expect(extractDomain("https://example.com/path")).toBe("example.com");
      expect(extractDomain("https://sub.example.com:8080/path")).toBe(
        "sub.example.com",
      );
    });

    it("should return empty string for invalid inputs", () => {
      expect(extractDomain("")).toBe("");
      expect(extractDomain("not-a-url")).toBe("");
      expect(extractDomain(null as unknown as string)).toBe("");
    });
  });

  describe("escapeHtml", () => {
    it("should escape HTML special characters", () => {
      expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
      expect(escapeHtml('alert("xss")')).toBe("alert(&quot;xss&quot;)");
      expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
      expect(escapeHtml("It's fine")).toBe("It&#39;s fine");
    });

    it("should handle empty and invalid inputs", () => {
      expect(escapeHtml("")).toBe("");
      expect(escapeHtml(null as unknown as string)).toBe("");
    });

    it("should leave safe text unchanged", () => {
      expect(escapeHtml("Hello World")).toBe("Hello World");
      expect(escapeHtml("123-456-7890")).toBe("123-456-7890");
    });
  });

  describe("TRUSTED_MEDIA_DOMAINS", () => {
    it("should include Bluesky CDN domains", () => {
      expect(TRUSTED_MEDIA_DOMAINS).toContain("cdn.bsky.app");
      expect(TRUSTED_MEDIA_DOMAINS).toContain("cdn.bsky.social");
      expect(TRUSTED_MEDIA_DOMAINS).toContain("av.bsky.app");
      expect(TRUSTED_MEDIA_DOMAINS).toContain("video.bsky.app");
    });

    it("should include common media platforms", () => {
      expect(TRUSTED_MEDIA_DOMAINS).toContain("youtube.com");
      expect(TRUSTED_MEDIA_DOMAINS).toContain("vimeo.com");
      expect(TRUSTED_MEDIA_DOMAINS).toContain("giphy.com");
    });
  });
});
