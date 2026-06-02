/**
 * Pure notification filtering for NotificationsFeed. Extracted so the filter
 * logic is unit-testable and the component stays focused on rendering.
 */

import type {
  AppBskyFeedDefs,
  AppBskyNotificationListNotifications,
} from "@atproto/api";
import { postHasImages } from "../hooks/useNotificationPosts";

export type NotificationFilter =
  | "all"
  | "likes"
  | "reposts"
  | "follows"
  | "mentions"
  | "replies"
  | "quotes"
  | "images"
  | "top-accounts"
  | "from-following";

type Notification = AppBskyNotificationListNotifications.Notification;

/**
 * Apply the active filter to notifications.
 * - Hides notifications from muted threads (via injected `isThreadMuted`).
 * - "images" keeps only notifications whose post has images.
 * - "from-following" keeps only authors in `followingSet`.
 * - reason-based filters (likes/reposts/follows/...) keep matching reasons.
 * "all", "top-accounts", "from-following" are not reason-filtered here.
 */
export function filterNotifications(
  notifications: Notification[] | undefined,
  posts: AppBskyFeedDefs.PostView[] | undefined,
  filter: NotificationFilter,
  followingSet: Set<string> | undefined,
  isThreadMuted: (uri: string) => boolean,
): Notification[] {
  if (!notifications || notifications.length === 0) {
    return [];
  }

  let filtered = [...notifications];

  // Filter out notifications from muted threads (using fetched posts to find roots)
  if (posts && posts.length > 0) {
    const postUriToRoot = new Map<string, string>();
    posts.forEach((post) => {
      const record = post.record as
        | { reply?: { root: { uri: string } } }
        | undefined;
      const rootUri = record?.reply?.root?.uri || post.uri;
      postUriToRoot.set(post.uri, rootUri);
    });

    filtered = filtered.filter((n) => {
      let postUri: string | undefined;
      if (n.reason === "repost" || n.reason === "like") {
        postUri = n.reasonSubject;
      } else if (
        n.reason === "reply" ||
        n.reason === "mention" ||
        n.reason === "quote"
      ) {
        postUri = n.uri;
      }

      if (postUri && postUriToRoot.has(postUri)) {
        const rootUri = postUriToRoot.get(postUri)!;
        return !isThreadMuted(rootUri);
      }
      // Keep notifications whose post isn't loaded yet
      return true;
    });
  }

  if (filter === "images") {
    if (posts && posts.length > 0) {
      const postsWithImages = new Set(
        posts.filter(postHasImages).map((post) => post.uri),
      );
      filtered = filtered.filter((n) => {
        if (!["like", "repost", "reply", "quote"].includes(n.reason))
          return false;
        const postUri =
          (n.reason === "repost" || n.reason === "like") && n.reasonSubject
            ? n.reasonSubject
            : n.uri;
        return postsWithImages.has(postUri);
      });
    } else {
      // While posts are loading, show empty
      filtered = [];
    }
  } else if (
    filter !== "all" &&
    filter !== "top-accounts" &&
    filter !== "from-following"
  ) {
    const filterMap: Record<
      Exclude<
        NotificationFilter,
        "all" | "images" | "top-accounts" | "from-following"
      >,
      string[]
    > = {
      likes: ["like"],
      reposts: ["repost"],
      follows: ["follow"],
      mentions: ["mention"],
      replies: ["reply"],
      quotes: ["quote"],
    };
    filtered = filtered.filter((n) =>
      filterMap[
        filter as Exclude<
          NotificationFilter,
          "all" | "images" | "top-accounts" | "from-following"
        >
      ].includes(n.reason),
    );
  }

  if (filter === "from-following" && followingSet) {
    filtered = filtered.filter((n) => followingSet.has(n.author.did));
  }

  return filtered;
}
