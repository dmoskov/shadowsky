/**
 * Multi-account posting service
 * Handles posting the same content to multiple Bluesky accounts
 */

import type { BskyAgent } from "@atproto/api";
import { RichText } from "@atproto/api";
import { uploadBlobWithRetry } from "../utils/blob-upload";
import { createLogger } from "../utils/logger";
import { AccountManager, type StoredAccount } from "./account-manager";
import { ATProtoClient } from "./atproto";

const logger = createLogger("MultiAccountPostingService");

export interface PostContent {
  text: string;
  media?: Array<{
    data: Uint8Array;
    mimeType: string;
    alt?: string;
    type: "image" | "video";
  }>;
  embed?: {
    type: "external";
    uri: string;
    title: string;
    description: string;
    thumbData?: Uint8Array;
    thumbMimeType?: string;
  };
  reply?: {
    root: { uri: string; cid: string };
    parent: { uri: string; cid: string };
  };
}

export interface MultiPostResult {
  did: string;
  handle: string;
  success: boolean;
  postUrl?: string;
  postUri?: string;
  postCid?: string;
  error?: string;
}

export interface MultiPostProgress {
  did: string;
  handle: string;
  status: "pending" | "posting" | "success" | "error";
  error?: string;
  postUrl?: string;
}

export type ProgressCallback = (progress: MultiPostProgress[]) => void;

/**
 * Creates a temporary agent for a specific account using stored session
 */
async function createAgentForAccount(
  account: StoredAccount,
): Promise<BskyAgent | null> {
  try {
    // Create a new ATProtoClient instance for this account
    const tempClient = new ATProtoClient({
      service: "https://bsky.social",
      persistSession: false, // Don't persist - we're using stored session
    });
    const session = await tempClient.resumeSession(account.session);

    if (session) {
      return tempClient.agent;
    }
    return null;
  } catch (error) {
    logger.error(
      `Failed to create agent for account ${account.handle}:`,
      error,
    );
    return null;
  }
}

/**
 * Posts content to a single account
 */
async function postToAccount(
  agent: BskyAgent,
  account: StoredAccount,
  content: PostContent,
): Promise<MultiPostResult> {
  try {
    // Create RichText and detect facets
    const rt = new RichText({ text: content.text });
    await rt.detectFacets(agent);

    const postData: Record<string, unknown> = {
      text: rt.text,
      facets: rt.facets,
    };

    // Add reply info if present
    if (content.reply) {
      postData.reply = content.reply;
    }

    // Add media if present
    if (content.media && content.media.length > 0) {
      const videoMedia = content.media.find((m) => m.type === "video");

      if (videoMedia) {
        // For videos, we need to upload through the video service
        // This is more complex and would need the video upload manager
        // For now, skip video for multi-account posting
        throw new Error(
          "Video posting to multiple accounts is not yet supported",
        );
      } else {
        // Upload images
        const images = await Promise.all(
          content.media.map(async (img) => {
            const uploadResult = await uploadBlobWithRetry(agent, img.data, {
              encoding: img.mimeType,
            });
            return {
              alt: img.alt || "",
              image: uploadResult.data.blob,
            };
          }),
        );

        postData.embed = {
          $type: "app.bsky.embed.images",
          images,
        };
      }
    }

    // Add external embed if present (and no media embed)
    if (content.embed && !postData.embed) {
      const externalEmbed: Record<string, unknown> = {
        $type: "app.bsky.embed.external",
        external: {
          uri: content.embed.uri,
          title: content.embed.title,
          description: content.embed.description,
        },
      };

      // Upload thumbnail if available
      if (content.embed.thumbData && content.embed.thumbMimeType) {
        try {
          const uploadResult = await uploadBlobWithRetry(
            agent,
            content.embed.thumbData,
            { encoding: content.embed.thumbMimeType },
          );
          (externalEmbed.external as Record<string, unknown>).thumb =
            uploadResult.data.blob;
        } catch (error) {
          logger.error("Failed to upload embed thumbnail:", error);
          // Continue without thumbnail
        }
      }

      postData.embed = externalEmbed;
    }

    // Post
    const result = await agent.post(postData);

    // Construct post URL
    const postUrl = `https://bsky.app/profile/${account.handle}/post/${result.uri.split("/").pop()}`;

    return {
      did: account.did,
      handle: account.handle,
      success: true,
      postUrl,
      postUri: result.uri,
      postCid: result.cid,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Failed to post to ${account.handle}:`, error);
    return {
      did: account.did,
      handle: account.handle,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Posts content to multiple accounts with progress reporting
 */
export async function postToMultipleAccounts(
  targetDids: string[],
  content: PostContent,
  currentAgent: BskyAgent,
  currentDid: string,
  onProgress?: ProgressCallback,
): Promise<MultiPostResult[]> {
  const accounts = AccountManager.getAllAccounts();
  const targetAccounts = accounts.filter((acc) => targetDids.includes(acc.did));

  if (targetAccounts.length === 0) {
    throw new Error("No valid target accounts found");
  }

  // Initialize progress
  const progress: MultiPostProgress[] = targetAccounts.map((acc) => ({
    did: acc.did,
    handle: acc.handle,
    status: "pending",
  }));

  onProgress?.(progress);

  const results: MultiPostResult[] = [];

  // Post to each account sequentially to avoid rate limiting
  for (const account of targetAccounts) {
    // Update progress to posting
    const progressIndex = progress.findIndex((p) => p.did === account.did);
    if (progressIndex >= 0) {
      progress[progressIndex].status = "posting";
      onProgress?.([...progress]);
    }

    let result: MultiPostResult;

    // Use current agent for current account, create new agent for others
    if (account.did === currentDid) {
      result = await postToAccount(currentAgent, account, content);
    } else {
      const tempAgent = await createAgentForAccount(account);
      if (tempAgent) {
        result = await postToAccount(tempAgent, account, content);
      } else {
        result = {
          did: account.did,
          handle: account.handle,
          success: false,
          error: "Failed to authenticate with this account",
        };
      }
    }

    results.push(result);

    // Update progress
    if (progressIndex >= 0) {
      progress[progressIndex].status = result.success ? "success" : "error";
      progress[progressIndex].error = result.error;
      progress[progressIndex].postUrl = result.postUrl;
      onProgress?.([...progress]);
    }

    // Small delay between posts to avoid rate limiting
    if (targetAccounts.indexOf(account) < targetAccounts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}

/**
 * Retries posting to a specific account
 */
export async function retryPostToAccount(
  did: string,
  content: PostContent,
  currentAgent: BskyAgent,
  currentDid: string,
): Promise<MultiPostResult> {
  const accounts = AccountManager.getAllAccounts();
  const account = accounts.find((acc) => acc.did === did);

  if (!account) {
    return {
      did,
      handle: "unknown",
      success: false,
      error: "Account not found",
    };
  }

  if (did === currentDid) {
    return postToAccount(currentAgent, account, content);
  }

  const tempAgent = await createAgentForAccount(account);
  if (!tempAgent) {
    return {
      did,
      handle: account.handle,
      success: false,
      error: "Failed to authenticate with this account",
    };
  }

  return postToAccount(tempAgent, account, content);
}
