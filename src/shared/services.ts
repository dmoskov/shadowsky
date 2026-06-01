/**
 * AT Protocol service classes — now sourced from the shared @bsky/core package.
 *
 * This module remains the web entry point (`@bsky/shared`) for the services and
 * additionally wires the web `debug` logger into @bsky/core so service errors
 * respect the existing debug toggle.
 */

import { setLogger } from "@bsky/core";
import { debug } from "./debug";

// Route @bsky/core's internal logging through the web debug logger (gated by the
// localStorage "debug" flag), preserving prior behavior.
setLogger(debug);

export {
  type AgentLike,
  AnalyticsService,
  FeedService,
  getInteractionsService,
  getProfileService,
  getThreadService,
  InteractionsService,
  ProfileService,
  ThreadService,
} from "@bsky/core";
