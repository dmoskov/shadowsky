import { AtpAgent } from "@atproto/api";

/**
 * Service for managing postgate records (quote/embedding controls).
 * Postgate records control who can quote or embed a post.
 * The record key (rkey) must match the post's record key.
 */
export class PostgateService {
  constructor(private agent: AtpAgent) {}

  /**
   * Create a postgate record that disables embedding/quoting for a post.
   * @param postUri - The AT-URI of the post to gate
   */
  async createPostgate(postUri: string): Promise<{ uri: string; cid: string }> {
    const rkey = postUri.split("/").pop();
    if (!rkey) {
      throw new Error("Invalid post URI: cannot extract rkey");
    }

    const response = await this.agent.com.atproto.repo.createRecord({
      repo: this.agent.session!.did,
      collection: "app.bsky.feed.postgate",
      rkey,
      record: {
        $type: "app.bsky.feed.postgate",
        post: postUri,
        createdAt: new Date().toISOString(),
        embeddingRules: [{ $type: "app.bsky.feed.postgate#disableRule" }],
      },
    });

    return response.data;
  }

  /**
   * Delete a postgate record (re-enables embedding/quoting).
   * @param postUri - The AT-URI of the post whose postgate to delete
   */
  async deletePostgate(postUri: string): Promise<boolean> {
    const rkey = postUri.split("/").pop();
    if (!rkey) return false;

    try {
      await this.agent.com.atproto.repo.deleteRecord({
        repo: this.agent.session!.did,
        collection: "app.bsky.feed.postgate",
        rkey,
      });
      return true;
    } catch {
      return false;
    }
  }
}
