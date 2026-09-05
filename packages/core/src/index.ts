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
export * from "./api-auth";
export * from "./errors";
export * from "./moderation/labels";
export * from "./notifications/aggregator";
export * from "./atproto/services";
export * as profiles from "./atproto/profiles";
export * as feeds from "./atproto/feeds";
export * as notifications from "./atproto/notifications";
export * as starterPacks from "./atproto/starter-packs";
export * as lists from "./atproto/lists";
export * as interactions from "./atproto/interactions";
export * as labelers from "./atproto/labelers";
export * as postgate from "./atproto/postgate";
export * as postEdit from "./atproto/post-edit";
export * as threadgate from "./atproto/threadgate";
