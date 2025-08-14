import { BskyAgent } from "@atproto/api";
import { debug, getProfileService } from "@bsky/shared";
import {
  getFollowerCacheDB,
  profileToCached,
  type CachedProfile,
  type InteractionStats,
} from "./follower-cache-db";
import { rateLimitedProfileFetch } from "./rate-limiter";

export class ProfileCacheService {
  private agent: BskyAgent;
  private profileService: ReturnType<typeof getProfileService>;

  constructor(agent: BskyAgent) {
    this.agent = agent;
    this.profileService = getProfileService(agent);
  }

  /**
   * Get profiles with caching logic
   * Only fetches from API if profile is stale (older than 1 week)
   */
  async getProfilesWithCache(
    handles: string[],
  ): Promise<Map<string, CachedProfile>> {
    const db = await getFollowerCacheDB();
    const profileMap = new Map<string, CachedProfile>();

    // First, check cache
    const cachedProfiles = await db.getProfilesByHandles(handles);
    const handlesToFetch: string[] = [];

    // Determine which profiles need fetching
    for (const handle of handles) {
      const cached = cachedProfiles.get(handle);
      if (cached) {
        // Check if cache is still valid
        const isStale = await db.isProfileStale(cached.did);
        if (!isStale) {
          // Mark as from cache
          profileMap.set(handle, { ...cached, fromCache: true });
        } else {
          handlesToFetch.push(handle);
        }
      } else {
        handlesToFetch.push(handle);
      }
    }

    // Fetch stale/missing profiles from API
    if (handlesToFetch.length > 0) {
      debug.log(
        `[PROFILE FETCH] Fetching ${handlesToFetch.length} profiles from API (${handles.length - handlesToFetch.length} from cache)`,
      );

      try {
        // Rate limit the profile fetching
        const freshProfiles = await rateLimitedProfileFetch(async () =>
          this.profileService.getProfiles(handlesToFetch),
        );

        // Convert and store fresh profiles
        if (freshProfiles && "profiles" in freshProfiles) {
          for (const profile of freshProfiles.profiles) {
            if (profile) {
              const cachedProfile = profileToCached(profile as any);
              // Mark as from API
              profileMap.set(profile.handle, {
                ...cachedProfile,
                fromCache: false,
              });

              // Save to cache immediately to prevent race conditions
              await db.saveProfile(cachedProfile);
            }
          }
        }
      } catch (error) {
        debug.error("Error fetching profiles from API:", error);
        // Fall back to stale cache if API fails
        for (const handle of handlesToFetch) {
          const stale = cachedProfiles.get(handle);
          if (stale) {
            profileMap.set(handle, { ...stale, fromCache: true });
          }
        }
      }
    }

    return profileMap;
  }

  /**
   * Get profiles by DIDs with caching
   */
  async getProfilesByDidsWithCache(
    dids: string[],
  ): Promise<Map<string, CachedProfile>> {
    const db = await getFollowerCacheDB();
    const profileMap = new Map<string, CachedProfile>();

    // Check cache first
    const cachedProfiles = await db.getProfiles(dids);
    const didsToFetch: string[] = [];

    // Determine which profiles need fetching
    for (const did of dids) {
      const cached = cachedProfiles.get(did);
      if (cached) {
        const isStale = await db.isProfileStale(did);
        if (!isStale) {
          profileMap.set(did, cached);
        } else {
          didsToFetch.push(did);
        }
      } else {
        didsToFetch.push(did);
      }
    }

    // Fetch stale/missing profiles
    if (didsToFetch.length > 0) {
      debug.log(
        `[PROFILE FETCH] Fetching ${didsToFetch.length} profiles by DID from API`,
      );

      try {
        // Note: This requires fetching profiles one by one since the API doesn't support batch by DID
        for (const did of didsToFetch) {
          try {
            // Rate limit individual profile fetches
            const response = await rateLimitedProfileFetch(async () =>
              this.agent.getProfile({ actor: did }),
            );
            if (response.data) {
              const cachedProfile = profileToCached(response.data);
              profileMap.set(did, { ...cachedProfile, fromCache: false });

              // Save to cache immediately to prevent race conditions
              await db.saveProfile(cachedProfile);
            }
          } catch (error) {
            debug.error(`Error fetching profile for ${did}:`, error);
          }
        }
      } catch (error) {
        debug.error("Error fetching profiles by DID:", error);
        // Fall back to stale cache
        for (const did of didsToFetch) {
          const stale = cachedProfiles.get(did);
          if (stale) {
            profileMap.set(did, { ...stale, fromCache: true });
          }
        }
      }
    }

    return profileMap;
  }

  /**
   * Get top accounts by follower count with interaction stats
   */
  async getTopAccountsWithStats(
    minFollowers: number,
    limit: number = 100,
  ): Promise<Array<CachedProfile & { interactionStats?: InteractionStats }>> {
    const db = await getFollowerCacheDB();

    // Get top profiles from cache
    const topProfiles = await db.getTopProfiles(minFollowers, limit);

    // Get interaction stats for these profiles
    const dids = topProfiles.map((p) => p.did);
    const interactionStats = await db.getInteractionStatsForMultiple(dids);

    // Combine data
    return topProfiles.map((profile) => ({
      ...profile,
      interactionStats: interactionStats.get(profile.did),
    }));
  }

  /**
   * Update interaction stats from notifications
   */
  async updateInteractionStats(
    notifications: Array<{
      author: { did: string; handle: string };
      reason: string;
      indexedAt: string;
    }>,
  ): Promise<void> {
    const db = await getFollowerCacheDB();
    const statsMap = new Map<string, InteractionStats>();

    // Aggregate notifications by author
    for (const notification of notifications) {
      const { did, handle } = notification.author;

      if (!statsMap.has(did)) {
        const existing = await db.getInteractionStats(did);
        statsMap.set(
          did,
          existing || {
            did,
            handle,
            totalInteractions: 0,
            likes: 0,
            reposts: 0,
            follows: 0,
            replies: 0,
            mentions: 0,
            quotes: 0,
            latestInteractionAt: new Date(notification.indexedAt),
            firstInteractionAt: new Date(notification.indexedAt),
            likedPosts: [],
            repostedPosts: [],
            repliedPosts: [],
            quotedPosts: [],
          },
        );
      }

      const stats = statsMap.get(did)!;
      stats.totalInteractions++;

      // Update latest interaction time
      const interactionDate = new Date(notification.indexedAt);
      if (interactionDate > stats.latestInteractionAt) {
        stats.latestInteractionAt = interactionDate;
      }

      // Count by type
      switch (notification.reason) {
        case "like":
          stats.likes++;
          break;
        case "repost":
          stats.reposts++;
          break;
        case "follow":
          stats.follows++;
          break;
        case "reply":
          stats.replies++;
          break;
        case "mention":
          stats.mentions++;
          break;
        case "quote":
          stats.quotes++;
          break;
      }
    }

    // Save all updated stats
    await db.saveMultipleInteractionStats(Array.from(statsMap.values()));
  }

  /**
   * Clear stale cache entries
   */
  async cleanupCache(): Promise<number> {
    const db = await getFollowerCacheDB();
    return await db.clearStaleProfiles();
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    const db = await getFollowerCacheDB();
    return await db.getStats();
  }
}

// Factory function
export function getProfileCacheService(agent: BskyAgent): ProfileCacheService {
  return new ProfileCacheService(agent);
}
