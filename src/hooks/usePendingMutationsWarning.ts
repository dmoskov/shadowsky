/**
 * Hook that warns users before closing the tab/window when there are
 * pending offline mutations (posts, likes/follows, or DMs) that haven't synced.
 *
 * Uses the browser's native beforeunload dialog:
 * "Changes you made may not be saved."
 */

import { useEffect } from "react";
import { dmQueueDB } from "../services/dm-queue";
import { mutationQueueDB } from "../services/mutation-queue-db";
import { offlinePostQueueDB } from "../services/offline-post-queue-db";

/**
 * Check all three offline queues for any pending (unsynced) items.
 * Returns true if there are items still waiting to be synced.
 */
async function hasPendingMutations(): Promise<boolean> {
  try {
    const [postStats, mutationStats, dmStats] = await Promise.all([
      offlinePostQueueDB.getStats().catch(() => null),
      mutationQueueDB.getStats().catch(() => null),
      dmQueueDB.getStats().catch(() => null),
    ]);

    const pendingPosts = postStats?.pendingCount ?? 0;
    const pendingMutations = mutationStats?.pendingCount ?? 0;
    const pendingDMs = dmStats?.pendingCount ?? 0;

    return pendingPosts + pendingMutations + pendingDMs > 0;
  } catch {
    return false;
  }
}

export function usePendingMutationsWarning(): void {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // The beforeunload handler must be synchronous for the browser to show
      // the dialog. We can't await hasPendingMutations() here. Instead, we
      // check synchronous signals that indicate pending work:
      // - offlinePostQueueDB.isQueueProcessing() means items are actively syncing
      // - We also listen for queue update events to track pending counts

      // For the synchronous check, use the processing flag and a cached count
      if (pendingCount > 0) {
        event.preventDefault();
        // Modern browsers ignore custom messages but returnValue must be set
        // for the native dialog to appear.
        event.returnValue = "";
      }
    };

    let pendingCount = 0;

    // Listen for queue update events to maintain a synchronous pending count
    const handlePostQueueUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && typeof detail.pendingCount === "number") {
        updatePendingCount();
      }
    };

    const handleMutationQueueUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && typeof detail.pendingCount === "number") {
        updatePendingCount();
      }
    };

    const handleDMQueueUpdate = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && typeof detail.pendingCount === "number") {
        updatePendingCount();
      }
    };

    const updatePendingCount = () => {
      hasPendingMutations().then((hasPending) => {
        pendingCount = hasPending ? 1 : 0;
      });
    };

    // Get initial pending count
    updatePendingCount();

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("offline-post-queue-update", handlePostQueueUpdate);
    window.addEventListener("mutation-queue-update", handleMutationQueueUpdate);
    window.addEventListener("dm-queue-update", handleDMQueueUpdate);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(
        "offline-post-queue-update",
        handlePostQueueUpdate,
      );
      window.removeEventListener(
        "mutation-queue-update",
        handleMutationQueueUpdate,
      );
      window.removeEventListener("dm-queue-update", handleDMQueueUpdate);
    };
  }, []);
}
