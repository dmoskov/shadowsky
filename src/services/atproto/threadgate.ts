import { AtpAgent } from "@atproto/api";
import { ReplyPermission } from "../../components/ReplyControls";

export interface ThreadgateSettings {
  permission: ReplyPermission;
  allowedLists?: string[]; // AT-URIs of lists for custom restrictions
}

export class ThreadgateService {
  constructor(private agent: AtpAgent) {}

  /**
   * Create a threadgate record for a post with reply restrictions
   */
  async createThreadgate(postUri: string, settings: ThreadgateSettings) {
    if (settings.permission === "everyone") {
      // No threadgate needed for everyone
      return null;
    }

    const allow = this.buildAllowRules(settings);
    if (allow.length === 0 && settings.permission !== "none") {
      return null; // No restrictions needed
    }

    try {
      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session!.did,
        collection: "app.bsky.feed.threadgate",
        record: {
          $type: "app.bsky.feed.threadgate",
          post: postUri,
          allow: settings.permission === "none" ? [] : allow,
          createdAt: new Date().toISOString(),
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to create threadgate:", error);
      throw error;
    }
  }

  /**
   * Update an existing threadgate record
   */
  async updateThreadgate(
    uri: string,
    rkey: string,
    settings: ThreadgateSettings,
  ) {
    if (settings.permission === "everyone") {
      // Delete the threadgate to allow everyone
      return this.deleteThreadgate(uri, rkey);
    }

    const allow = this.buildAllowRules(settings);

    try {
      const response = await this.agent.com.atproto.repo.putRecord({
        repo: this.agent.session!.did,
        collection: "app.bsky.feed.threadgate",
        rkey,
        record: {
          $type: "app.bsky.feed.threadgate",
          post: uri,
          allow: settings.permission === "none" ? [] : allow,
          createdAt: new Date().toISOString(),
        },
      });

      return response.data;
    } catch (error) {
      console.error("Failed to update threadgate:", error);
      throw error;
    }
  }

  /**
   * Delete a threadgate record (opens replies to everyone)
   */
  async deleteThreadgate(_uri: string, rkey: string) {
    try {
      await this.agent.com.atproto.repo.deleteRecord({
        repo: this.agent.session!.did,
        collection: "app.bsky.feed.threadgate",
        rkey,
      });
      return true;
    } catch (error) {
      console.error("Failed to delete threadgate:", error);
      return false;
    }
  }

  /**
   * Get threadgate settings for a post
   */
  async getThreadgate(postUri: string): Promise<ThreadgateSettings | null> {
    try {
      // Extract DID and rkey from the post URI
      const uriParts = postUri.split("/");
      const did = uriParts[2];
      // const rkey = uriParts[4]; // Not currently used

      const response = await this.agent.com.atproto.repo.listRecords({
        repo: did,
        collection: "app.bsky.feed.threadgate",
        limit: 100,
      });

      // Find the threadgate for this specific post
      const threadgate = response.data.records.find(
        (record: any) => record.value.post === postUri,
      );

      if (!threadgate) {
        return null;
      }

      return this.parseThreadgateRecord(threadgate.value);
    } catch (error) {
      console.error("Failed to fetch threadgate:", error);
      return null;
    }
  }

  /**
   * Check if a user can reply to a post based on threadgate settings
   */
  async canUserReply(
    postUri: string,
    _userDid: string,
    _postAuthorDid: string,
  ): Promise<boolean> {
    const settings = await this.getThreadgate(postUri);

    if (!settings || settings.permission === "everyone") {
      return true;
    }

    if (settings.permission === "none") {
      return false;
    }

    // For other permissions, we'd need to check:
    // - "following": Check if post author follows the user
    // - "mentioned": Check if user is mentioned in the post
    // - Custom lists: Check if user is in the allowed lists

    // This would require additional API calls to check relationships
    // For now, we'll return true and let the server handle the validation
    return true;
  }

  /**
   * Build allow rules based on permission settings
   */
  private buildAllowRules(settings: ThreadgateSettings) {
    const allow: any[] = [];

    switch (settings.permission) {
      case "following":
        allow.push({ $type: "app.bsky.feed.threadgate#followingRule" });
        break;
      case "mentioned":
        allow.push({ $type: "app.bsky.feed.threadgate#mentionRule" });
        break;
      case "none":
        // Empty allow array means no one can reply
        break;
      default:
        // For custom lists or other future options
        if (settings.allowedLists) {
          settings.allowedLists.forEach((list) => {
            allow.push({
              $type: "app.bsky.feed.threadgate#listRule",
              list,
            });
          });
        }
    }

    return allow;
  }

  /**
   * Parse a threadgate record into settings
   */
  private parseThreadgateRecord(record: any): ThreadgateSettings {
    if (!record.allow || record.allow.length === 0) {
      return { permission: "none" };
    }

    const firstRule = record.allow[0];

    switch (firstRule.$type) {
      case "app.bsky.feed.threadgate#followingRule":
        return { permission: "following" };
      case "app.bsky.feed.threadgate#mentionRule":
        return { permission: "mentioned" };
      case "app.bsky.feed.threadgate#listRule":
        return {
          permission: "everyone", // We'll treat custom lists as a special case
          allowedLists: record.allow
            .filter(
              (rule: any) => rule.$type === "app.bsky.feed.threadgate#listRule",
            )
            .map((rule: any) => rule.list),
        };
      default:
        return { permission: "everyone" };
    }
  }
}
