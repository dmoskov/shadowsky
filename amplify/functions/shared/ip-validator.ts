/**
 * IP Validator for SSRF Protection
 *
 * Validates that URLs don't resolve to private/internal IP addresses,
 * preventing Server-Side Request Forgery (SSRF) attacks.
 */

import { lookup } from "dns/promises";

/**
 * Blocked IP ranges for SSRF protection
 */
const BLOCKED_IP_RANGES = [
  // RFC 1918 Private Networks
  { start: parseIPv4("10.0.0.0"), end: parseIPv4("10.255.255.255"), name: "RFC 1918 Class A" },
  { start: parseIPv4("172.16.0.0"), end: parseIPv4("172.31.255.255"), name: "RFC 1918 Class B" },
  { start: parseIPv4("192.168.0.0"), end: parseIPv4("192.168.255.255"), name: "RFC 1918 Class C" },
  // Loopback
  { start: parseIPv4("127.0.0.0"), end: parseIPv4("127.255.255.255"), name: "Loopback" },
  // Link-local
  { start: parseIPv4("169.254.0.0"), end: parseIPv4("169.254.255.255"), name: "Link-local" },
  // AWS Instance Metadata Service (IMDS)
  { start: parseIPv4("169.254.169.254"), end: parseIPv4("169.254.169.254"), name: "AWS Metadata" },
  // Broadcast
  { start: parseIPv4("255.255.255.255"), end: parseIPv4("255.255.255.255"), name: "Broadcast" },
  // Current network (only valid as source)
  { start: parseIPv4("0.0.0.0"), end: parseIPv4("0.255.255.255"), name: "Current Network" },
  // Carrier-grade NAT (RFC 6598)
  { start: parseIPv4("100.64.0.0"), end: parseIPv4("100.127.255.255"), name: "Carrier-grade NAT" },
];

/**
 * Blocked IPv6 ranges
 */
const BLOCKED_IPV6_PREFIXES = [
  "::1",           // Loopback
  "::ffff:127.",   // IPv4-mapped loopback
  "::ffff:10.",    // IPv4-mapped private
  "::ffff:172.16.", "::ffff:172.17.", "::ffff:172.18.", "::ffff:172.19.",
  "::ffff:172.20.", "::ffff:172.21.", "::ffff:172.22.", "::ffff:172.23.",
  "::ffff:172.24.", "::ffff:172.25.", "::ffff:172.26.", "::ffff:172.27.",
  "::ffff:172.28.", "::ffff:172.29.", "::ffff:172.30.", "::ffff:172.31.",
  "::ffff:192.168.",
  "::ffff:169.254.",
  "fc00:",         // Unique local address
  "fd00:",         // Unique local address
  "fe80:",         // Link-local
];

/**
 * Parse an IPv4 address string to a numeric value for range comparison
 */
function parseIPv4(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return 0;
  }
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Check if an IPv4 address is in any blocked range
 */
function isIPv4Blocked(ip: string): { blocked: boolean; reason?: string } {
  const ipNum = parseIPv4(ip);
  if (ipNum === 0 && ip !== "0.0.0.0") {
    return { blocked: true, reason: "Invalid IPv4 address format" };
  }

  for (const range of BLOCKED_IP_RANGES) {
    if (ipNum >= range.start && ipNum <= range.end) {
      return { blocked: true, reason: `IP in blocked range: ${range.name}` };
    }
  }

  return { blocked: false };
}

/**
 * Check if an IPv6 address is in any blocked range
 */
function isIPv6Blocked(ip: string): { blocked: boolean; reason?: string } {
  const normalizedIp = ip.toLowerCase();

  for (const prefix of BLOCKED_IPV6_PREFIXES) {
    if (normalizedIp.startsWith(prefix.toLowerCase())) {
      return { blocked: true, reason: `IPv6 in blocked range: ${prefix}` };
    }
  }

  return { blocked: false };
}

/**
 * Check if an IP address (IPv4 or IPv6) is blocked
 */
export function isIPBlocked(ip: string): { blocked: boolean; reason?: string } {
  // Detect IPv6
  if (ip.includes(":")) {
    return isIPv6Blocked(ip);
  }

  // Assume IPv4
  return isIPv4Blocked(ip);
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  resolvedIP?: string;
}

/**
 * Validate a URL by resolving its hostname and checking the IP against blocked ranges.
 * This prevents SSRF attacks by ensuring outbound requests don't target internal resources.
 *
 * @param urlString - The URL to validate
 * @returns ValidationResult indicating if the URL is safe to fetch
 */
export async function validateUrlForSSRF(urlString: string): Promise<ValidationResult> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }

  // Only allow http and https protocols
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { valid: false, error: "Only HTTP and HTTPS protocols are allowed" };
  }

  const hostname = url.hostname;

  // Check if hostname is an IP address directly
  if (isIPAddress(hostname)) {
    const ipCheck = isIPBlocked(hostname);
    if (ipCheck.blocked) {
      return { valid: false, error: ipCheck.reason, resolvedIP: hostname };
    }
    return { valid: true, resolvedIP: hostname };
  }

  // Resolve hostname to IP address
  try {
    const addresses = await lookup(hostname, { all: true });

    if (addresses.length === 0) {
      return { valid: false, error: "Could not resolve hostname" };
    }

    // Check all resolved IPs - block if any are in blocked ranges
    for (const addr of addresses) {
      const ipCheck = isIPBlocked(addr.address);
      if (ipCheck.blocked) {
        return {
          valid: false,
          error: `Hostname resolves to blocked IP: ${ipCheck.reason}`,
          resolvedIP: addr.address,
        };
      }
    }

    return { valid: true, resolvedIP: addresses[0].address };
  } catch (error) {
    return {
      valid: false,
      error: `DNS resolution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Check if a string is an IP address (IPv4 or IPv6)
 */
function isIPAddress(str: string): boolean {
  // IPv6 check - contains colons
  if (str.includes(":")) {
    return true;
  }

  // IPv4 check - four dot-separated numbers
  const parts = str.split(".");
  if (parts.length !== 4) {
    return false;
  }

  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255 && String(num) === part;
  });
}

/**
 * Create an error response for SSRF validation failures
 */
export function createSSRFBlockedError(
  validationResult: ValidationResult,
): { statusCode: number; message: string } {
  return {
    statusCode: 403,
    message: `Request blocked: ${validationResult.error || "SSRF protection triggered"}`,
  };
}
