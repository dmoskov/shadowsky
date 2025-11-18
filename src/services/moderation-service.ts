import type { BskyAgent } from "@atproto/api";

export interface ModerationPreferences {
  keywordFilters: string[];
  hideReplies: boolean;
  hideReposts: boolean;
  hideQuotePosts: boolean;
  sensitiveMediaBehavior: "blur" | "hide" | "show";
  adultContentEnabled: boolean;
  autoModeration: boolean;
}

export class ModerationService {
  private agent: BskyAgent;
  private preferences: ModerationPreferences | null = null;

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async loadPreferences(): Promise<ModerationPreferences> {
    try {
      const response = await this.agent.api.com.atproto.repo.getRecord({
        repo: this.agent.session?.did || "",
        collection: "com.shadowsky.moderation",
        rkey: "self",
      });
      this.preferences = response.data.value as any;
      return this.preferences;
    } catch (error: any) {
      if (error?.status === 400) {
        this.preferences = this.getDefaultPreferences();
        return this.preferences;
      }
      throw error;
    }
  }

  getDefaultPreferences(): ModerationPreferences {
    return {
      keywordFilters: [],
      hideReplies: false,
      hideReposts: false,
      hideQuotePosts: false,
      sensitiveMediaBehavior: "blur",
      adultContentEnabled: false,
      autoModeration: true,
    };
  }

  getPreferences(): ModerationPreferences {
    return this.preferences || this.getDefaultPreferences();
  }

  shouldFilterPost(post: any): { filtered: boolean; reason?: string } {
    const prefs = this.getPreferences();

    const postText = post.record?.text?.toLowerCase() || "";

    for (const keyword of prefs.keywordFilters) {
      if (postText.includes(keyword.toLowerCase())) {
        return { filtered: true, reason: `Keyword filter: "${keyword}"` };
      }
    }

    if (prefs.hideReplies && post.record?.reply) {
      return { filtered: true, reason: "Reply posts hidden" };
    }

    return { filtered: false };
  }

  shouldFilterFeedItem(feedItem: any): { filtered: boolean; reason?: string } {
    const prefs = this.getPreferences();

    if (prefs.hideReposts && feedItem.reason?.$type === "app.bsky.feed.defs#reasonRepost") {
      return { filtered: true, reason: "Reposts hidden" };
    }

    if (feedItem.post) {
      return this.shouldFilterPost(feedItem.post);
    }

    return { filtered: false };
  }

  shouldBlurMedia(labels?: Array<{ val: string }>): boolean {
    const prefs = this.getPreferences();

    if (prefs.sensitiveMediaBehavior === "show") {
      return false;
    }

    if (!labels || labels.length === 0) {
      return false;
    }

    const sensitiveLabels = ["porn", "sexual", "nudity", "graphic-media"];
    const hasSensitiveLabel = labels.some((label) =>
      sensitiveLabels.includes(label.val)
    );

    if (hasSensitiveLabel) {
      if (!prefs.adultContentEnabled) {
        return true;
      }

      return prefs.sensitiveMediaBehavior === "blur";
    }

    return false;
  }

  shouldHideMedia(labels?: Array<{ val: string }>): boolean {
    const prefs = this.getPreferences();

    if (prefs.sensitiveMediaBehavior === "show") {
      return false;
    }

    if (!labels || labels.length === 0) {
      return false;
    }

    const sensitiveLabels = ["porn", "sexual", "nudity", "graphic-media"];
    const hasSensitiveLabel = labels.some((label) =>
      sensitiveLabels.includes(label.val)
    );

    if (hasSensitiveLabel) {
      if (!prefs.adultContentEnabled) {
        return prefs.sensitiveMediaBehavior === "hide";
      }

      return prefs.sensitiveMediaBehavior === "hide";
    }

    return false;
  }

  getSensitiveWarningText(labels?: Array<{ val: string }>): string {
    if (!labels || labels.length === 0) {
      return "Sensitive Content";
    }

    const labelMap: Record<string, string> = {
      porn: "Adult Content",
      sexual: "Sexual Content",
      nudity: "Nudity",
      "graphic-media": "Graphic Content",
      gore: "Graphic Violence",
      violence: "Violence",
    };

    for (const label of labels) {
      if (labelMap[label.val]) {
        return labelMap[label.val];
      }
    }

    return "Sensitive Content";
  }
}

let moderationServiceInstance: ModerationService | null = null;

export function getModerationService(agent: BskyAgent): ModerationService {
  if (!moderationServiceInstance || moderationServiceInstance["agent"] !== agent) {
    moderationServiceInstance = new ModerationService(agent);
  }
  return moderationServiceInstance;
}

export function clearModerationService() {
  moderationServiceInstance = null;
}
