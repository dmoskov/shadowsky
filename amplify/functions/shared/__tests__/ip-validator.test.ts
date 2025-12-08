/**
 * IP Validator Tests
 *
 * Tests for SSRF protection through IP validation
 */

import { describe, it, expect } from "vitest";
import { isIPBlocked, validateUrlForSSRF } from "../ip-validator";

describe("IP Validator", () => {
  describe("isIPBlocked", () => {
    describe("RFC 1918 Private Networks", () => {
      it("should block 10.0.0.0/8 (Class A)", () => {
        expect(isIPBlocked("10.0.0.0").blocked).toBe(true);
        expect(isIPBlocked("10.0.0.1").blocked).toBe(true);
        expect(isIPBlocked("10.255.255.255").blocked).toBe(true);
        expect(isIPBlocked("10.128.64.32").blocked).toBe(true);
      });

      it("should block 172.16.0.0/12 (Class B)", () => {
        expect(isIPBlocked("172.16.0.0").blocked).toBe(true);
        expect(isIPBlocked("172.16.0.1").blocked).toBe(true);
        expect(isIPBlocked("172.31.255.255").blocked).toBe(true);
        expect(isIPBlocked("172.24.128.64").blocked).toBe(true);
      });

      it("should not block 172.15.x.x or 172.32.x.x", () => {
        expect(isIPBlocked("172.15.255.255").blocked).toBe(false);
        expect(isIPBlocked("172.32.0.0").blocked).toBe(false);
      });

      it("should block 192.168.0.0/16 (Class C)", () => {
        expect(isIPBlocked("192.168.0.0").blocked).toBe(true);
        expect(isIPBlocked("192.168.0.1").blocked).toBe(true);
        expect(isIPBlocked("192.168.255.255").blocked).toBe(true);
        expect(isIPBlocked("192.168.100.50").blocked).toBe(true);
      });
    });

    describe("Loopback addresses", () => {
      it("should block 127.0.0.0/8", () => {
        expect(isIPBlocked("127.0.0.1").blocked).toBe(true);
        expect(isIPBlocked("127.0.0.0").blocked).toBe(true);
        expect(isIPBlocked("127.255.255.255").blocked).toBe(true);
        expect(isIPBlocked("127.1.2.3").blocked).toBe(true);
      });
    });

    describe("Link-local addresses", () => {
      it("should block 169.254.0.0/16", () => {
        expect(isIPBlocked("169.254.0.1").blocked).toBe(true);
        expect(isIPBlocked("169.254.255.255").blocked).toBe(true);
      });
    });

    describe("AWS Metadata Service", () => {
      it("should block 169.254.169.254 (AWS IMDS)", () => {
        const result = isIPBlocked("169.254.169.254");
        expect(result.blocked).toBe(true);
        // AWS metadata IP is within Link-local range, so it's blocked by that
        expect(result.reason).toContain("Link-local");
      });
    });

    describe("Broadcast address", () => {
      it("should block 255.255.255.255", () => {
        expect(isIPBlocked("255.255.255.255").blocked).toBe(true);
      });
    });

    describe("Current network", () => {
      it("should block 0.0.0.0/8", () => {
        expect(isIPBlocked("0.0.0.0").blocked).toBe(true);
        expect(isIPBlocked("0.1.2.3").blocked).toBe(true);
      });
    });

    describe("Carrier-grade NAT (RFC 6598)", () => {
      it("should block 100.64.0.0/10", () => {
        expect(isIPBlocked("100.64.0.0").blocked).toBe(true);
        expect(isIPBlocked("100.64.0.1").blocked).toBe(true);
        expect(isIPBlocked("100.127.255.255").blocked).toBe(true);
      });

      it("should not block 100.63.x.x or 100.128.x.x", () => {
        expect(isIPBlocked("100.63.255.255").blocked).toBe(false);
        expect(isIPBlocked("100.128.0.0").blocked).toBe(false);
      });
    });

    describe("Public IP addresses", () => {
      it("should allow common public IPs", () => {
        expect(isIPBlocked("8.8.8.8").blocked).toBe(false);
        expect(isIPBlocked("1.1.1.1").blocked).toBe(false);
        expect(isIPBlocked("142.250.185.46").blocked).toBe(false); // Google
        expect(isIPBlocked("151.101.1.69").blocked).toBe(false); // Reddit
      });
    });

    describe("IPv6 addresses", () => {
      it("should block IPv6 loopback", () => {
        expect(isIPBlocked("::1").blocked).toBe(true);
      });

      it("should block IPv4-mapped IPv6 loopback", () => {
        expect(isIPBlocked("::ffff:127.0.0.1").blocked).toBe(true);
      });

      it("should block IPv4-mapped IPv6 private addresses", () => {
        expect(isIPBlocked("::ffff:10.0.0.1").blocked).toBe(true);
        expect(isIPBlocked("::ffff:192.168.1.1").blocked).toBe(true);
        expect(isIPBlocked("::ffff:172.16.0.1").blocked).toBe(true);
      });

      it("should block unique local addresses (fc00::/7)", () => {
        expect(isIPBlocked("fc00::1").blocked).toBe(true);
        expect(isIPBlocked("fd00::1").blocked).toBe(true);
      });

      it("should block link-local addresses (fe80::/10)", () => {
        expect(isIPBlocked("fe80::1").blocked).toBe(true);
      });
    });

    describe("Invalid IP addresses", () => {
      it("should block invalid IPv4 addresses", () => {
        expect(isIPBlocked("256.0.0.1").blocked).toBe(true);
        expect(isIPBlocked("not-an-ip").blocked).toBe(true);
      });
    });
  });

  describe("validateUrlForSSRF", () => {
    it("should reject invalid URLs", async () => {
      const result = await validateUrlForSSRF("not-a-url");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid URL format");
    });

    it("should reject non-HTTP protocols", async () => {
      const fileResult = await validateUrlForSSRF("file:///etc/passwd");
      expect(fileResult.valid).toBe(false);
      expect(fileResult.error).toBe("Only HTTP and HTTPS protocols are allowed");

      const ftpResult = await validateUrlForSSRF("ftp://example.com/file");
      expect(ftpResult.valid).toBe(false);
      expect(ftpResult.error).toBe("Only HTTP and HTTPS protocols are allowed");

      const javascriptResult = await validateUrlForSSRF("javascript:alert(1)");
      expect(javascriptResult.valid).toBe(false);
    });

    it("should block URLs with private IP addresses directly", async () => {
      const result = await validateUrlForSSRF("http://192.168.1.1/api");
      expect(result.valid).toBe(false);
      expect(result.resolvedIP).toBe("192.168.1.1");
    });

    it("should block URLs with loopback addresses", async () => {
      const result = await validateUrlForSSRF("http://127.0.0.1:8080/admin");
      expect(result.valid).toBe(false);
      expect(result.resolvedIP).toBe("127.0.0.1");
    });

    it("should block URLs with AWS metadata IP", async () => {
      const result = await validateUrlForSSRF(
        "http://169.254.169.254/latest/meta-data/",
      );
      expect(result.valid).toBe(false);
      // AWS metadata IP is within Link-local range
      expect(result.error).toContain("Link-local");
    });

    // Note: DNS mocking in vitest with ESM modules is challenging.
    // The following tests validate URL-based IP detection without DNS resolution.
    // The actual DNS-based blocking is validated via integration tests.

    it("should handle DNS resolution failures", async () => {
      const result = await validateUrlForSSRF("http://nonexistent.invalid.domain.tld");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("DNS resolution failed");
    });

    it("should allow URLs with valid public IP addresses", async () => {
      const result = await validateUrlForSSRF("http://8.8.8.8/dns-query");
      expect(result.valid).toBe(true);
      expect(result.resolvedIP).toBe("8.8.8.8");
    });

    it("should block localhost when it resolves to loopback", async () => {
      // localhost typically resolves to 127.0.0.1
      const result = await validateUrlForSSRF("http://localhost/api");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("blocked IP");
    });
  });
});
