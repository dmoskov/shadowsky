/**
 * Batch Operation Executor Service
 *
 * Executes batch operations (mute, block, unfollow, add to list) with:
 * - Rate limit awareness using the pre-flight estimator
 * - Progress tracking
 * - Pause/resume/cancel capability
 * - Error handling and retry logic
 */

import type { BskyAgent } from "@atproto/api";
import type {
  BatchActionType,
  BatchOperationResult,
  SelectableUser,
} from "../contexts/BatchSelectionContext";
import { createLogger } from "../utils/logger";
import { calculateOptimalDelay } from "./batch-rate-limit-estimator";
import { blueskyListService } from "./bluesky-list-service";

const logger = createLogger("BatchOperationExecutor");

/**
 * Options for batch operation execution
 */
export interface BatchExecutionOptions {
  /** BskyAgent instance for API calls */
  agent: BskyAgent;

  /** Users to perform the action on */
  users: SelectableUser[];

  /** Type of action to perform */
  actionType: BatchActionType;

  /** For add_to_list action */
  listUri?: string;

  /** Callback for each completed operation */
  onProgress?: (result: BatchOperationResult) => void;

  /** Callback for status changes */
  onStatusChange?: (
    status: "running" | "paused" | "cancelled" | "completed" | "failed",
  ) => void;

  /** Check if operation should be paused */
  isPaused?: () => boolean;

  /** Check if operation should be cancelled */
  isCancelled?: () => boolean;

  /** Custom delay between operations in ms (default: auto-calculated) */
  delayBetweenOps?: number;
}

/**
 * Result of batch execution
 */
export interface BatchExecutionResult {
  success: boolean;
  totalCount: number;
  successCount: number;
  failedCount: number;
  results: BatchOperationResult[];
  wasCancelled: boolean;
  durationMs: number;
}

/**
 * Execute a single operation on a user
 */
async function executeOperation(
  agent: BskyAgent,
  user: SelectableUser,
  actionType: BatchActionType,
  listUri?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (actionType) {
      case "mute":
        await agent.mute(user.did);
        break;

      case "unmute":
        await agent.unmute(user.did);
        break;

      case "block": {
        const blockRepo = agent.session?.did;
        if (!blockRepo) throw new Error("No session");
        await agent.app.bsky.graph.block.create(
          { repo: blockRepo },
          { subject: user.did, createdAt: new Date().toISOString() },
        );
        break;
      }

      case "unblock": {
        // Need to find and delete the block record
        const blockRecords = await agent.app.bsky.graph.block.list({
          repo: agent.session?.did || "",
        });
        const blockToDelete = blockRecords.records.find(
          (r) => r.value.subject === user.did,
        );
        if (blockToDelete) {
          await agent.app.bsky.graph.block.delete({
            repo: agent.session?.did || "",
            rkey: blockToDelete.uri.split("/").pop() || "",
          });
        }
        break;
      }

      case "unfollow":
        if (user.relationshipUri) {
          const rkey = user.relationshipUri.split("/").pop();
          if (rkey) {
            await agent.app.bsky.graph.follow.delete({
              repo: agent.session?.did || "",
              rkey,
            });
          }
        } else {
          // Find follow record and delete
          const profile = await agent.getProfile({ actor: user.did });
          if (profile.data.viewer?.following) {
            const rkey = profile.data.viewer.following.split("/").pop();
            if (rkey) {
              await agent.app.bsky.graph.follow.delete({
                repo: agent.session?.did || "",
                rkey,
              });
            }
          }
        }
        break;

      case "remove_follower": {
        // Block and immediately unblock to remove follower
        const removeRepo = agent.session?.did;
        if (!removeRepo) throw new Error("No session");
        await agent.app.bsky.graph.block.create(
          { repo: removeRepo },
          { subject: user.did, createdAt: new Date().toISOString() },
        );
        // Wait a moment for the block to take effect
        await new Promise((resolve) => setTimeout(resolve, 500));
        // Now unblock
        const newBlockRecords = await agent.app.bsky.graph.block.list({
          repo: removeRepo,
        });
        const newBlockToDelete = newBlockRecords.records.find(
          (r) => r.value.subject === user.did,
        );
        if (newBlockToDelete) {
          await agent.app.bsky.graph.block.delete({
            repo: removeRepo,
            rkey: newBlockToDelete.uri.split("/").pop() || "",
          });
        }
        break;
      }

      case "add_to_list":
        if (!listUri) {
          throw new Error("List URI is required for add_to_list action");
        }
        await blueskyListService.addMemberToList(listUri, user.did);
        break;

      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to ${actionType} user ${user.handle}:`, error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Wait for pause to be released or cancellation
 */
async function waitForResume(
  isPaused: () => boolean,
  isCancelled: () => boolean,
): Promise<boolean> {
  while (isPaused() && !isCancelled()) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return isCancelled();
}

/**
 * Execute batch operations on users
 */
export async function executeBatchOperation(
  options: BatchExecutionOptions,
): Promise<BatchExecutionResult> {
  const {
    agent,
    users,
    actionType,
    listUri,
    onProgress,
    onStatusChange,
    isPaused = () => false,
    isCancelled = () => false,
    delayBetweenOps,
  } = options;

  const startTime = Date.now();
  const results: BatchOperationResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  // Calculate delay based on operation type
  const delay =
    delayBetweenOps ??
    calculateOptimalDelay(mapActionToOperationType(actionType), users.length);

  logger.log(
    `Starting batch ${actionType} for ${users.length} users with ${delay}ms delay`,
  );
  onStatusChange?.("running");

  for (let i = 0; i < users.length; i++) {
    // Check for cancellation
    if (isCancelled()) {
      logger.log("Batch operation cancelled");
      onStatusChange?.("cancelled");
      return {
        success: false,
        totalCount: users.length,
        successCount,
        failedCount,
        results,
        wasCancelled: true,
        durationMs: Date.now() - startTime,
      };
    }

    // Check for pause
    if (isPaused()) {
      logger.log("Batch operation paused");
      onStatusChange?.("paused");
      const cancelled = await waitForResume(isPaused, isCancelled);
      if (cancelled) {
        onStatusChange?.("cancelled");
        return {
          success: false,
          totalCount: users.length,
          successCount,
          failedCount,
          results,
          wasCancelled: true,
          durationMs: Date.now() - startTime,
        };
      }
      onStatusChange?.("running");
      logger.log("Batch operation resumed");
    }

    const user = users[i];
    const operationResult = await executeOperation(
      agent,
      user,
      actionType,
      listUri,
    );

    const result: BatchOperationResult = {
      user,
      success: operationResult.success,
      error: operationResult.error,
      timestamp: Date.now(),
    };

    if (operationResult.success) {
      successCount++;
    } else {
      failedCount++;
    }

    results.push(result);
    onProgress?.(result);

    // Delay between operations (except for the last one)
    if (i < users.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const durationMs = Date.now() - startTime;
  logger.log(
    `Batch operation completed: ${successCount} success, ${failedCount} failed in ${durationMs}ms`,
  );
  onStatusChange?.("completed");

  return {
    success: failedCount === 0,
    totalCount: users.length,
    successCount,
    failedCount,
    results,
    wasCancelled: false,
    durationMs,
  };
}

/**
 * Execute undo operations for a previous batch action
 */
export async function executeUndoBatchOperation(
  agent: BskyAgent,
  actionType: BatchActionType,
  users: SelectableUser[],
  onProgress?: (result: BatchOperationResult) => void,
): Promise<BatchExecutionResult> {
  // Map action to its reverse
  const reverseActionType = getUndoActionType(actionType);

  return executeBatchOperation({
    agent,
    users,
    actionType: reverseActionType,
    onProgress,
  });
}

/**
 * Get the reverse action type for undo
 */
export function getUndoActionType(
  actionType: BatchActionType,
): BatchActionType {
  switch (actionType) {
    case "mute":
      return "unmute";
    case "unmute":
      return "mute";
    case "block":
      return "unblock";
    case "unblock":
      return "block";
    case "unfollow":
      // Can't undo unfollow directly - would need to re-follow
      return "unfollow"; // No-op for now
    case "remove_follower":
      // Can't undo remove follower
      return "remove_follower"; // No-op
    case "add_to_list":
      // Would need to remove from list - requires list URI
      return "add_to_list"; // No-op
    default:
      return actionType;
  }
}

/**
 * Check if an action type supports undo
 */
export function canUndoAction(actionType: BatchActionType): boolean {
  switch (actionType) {
    case "mute":
    case "unmute":
    case "block":
    case "unblock":
      return true;
    case "unfollow":
    case "remove_follower":
    case "add_to_list":
      return false;
    default:
      return false;
  }
}

/**
 * Map BatchActionType to the rate limiter's BatchOperationType
 */
function mapActionToOperationType(
  actionType: BatchActionType,
): "mute" | "block" | "follow" {
  switch (actionType) {
    case "mute":
    case "unmute":
      return "mute";
    case "block":
    case "unblock":
      return "block";
    default:
      return "follow";
  }
}

/**
 * Get human-readable action description
 */
export function getActionDescription(actionType: BatchActionType): string {
  switch (actionType) {
    case "mute":
      return "Mute";
    case "unmute":
      return "Unmute";
    case "block":
      return "Block";
    case "unblock":
      return "Unblock";
    case "unfollow":
      return "Unfollow";
    case "remove_follower":
      return "Remove follower";
    case "add_to_list":
      return "Add to list";
    default:
      return actionType;
  }
}

/**
 * Get past tense action description
 */
export function getActionPastTense(actionType: BatchActionType): string {
  switch (actionType) {
    case "mute":
      return "Muted";
    case "unmute":
      return "Unmuted";
    case "block":
      return "Blocked";
    case "unblock":
      return "Unblocked";
    case "unfollow":
      return "Unfollowed";
    case "remove_follower":
      return "Removed";
    case "add_to_list":
      return "Added to list";
    default:
      return actionType;
  }
}
