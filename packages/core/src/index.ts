/**
 * @bsky/core — platform-agnostic shared logic for the BSKY web + mobile apps.
 *
 * Phase 0 (toolchain spike): exposes pure formatting helpers. Subsequent phases
 * migrate AT Protocol services, types, errors, moderation, and rich-text here.
 * See docs/SHARED_PACKAGE_MIGRATION.md.
 */

export const CORE_PACKAGE_VERSION = "0.0.0";

export * from "./format";
export * from "./logger";
export * from "./atproto/services";
export * as profiles from "./atproto/profiles";
