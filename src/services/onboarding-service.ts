import { BskyAgent } from "@atproto/api";
import { createLogger } from "../utils/logger";

const logger = createLogger("OnboardingService");

// Onboarding state stored in localStorage
export interface OnboardingState {
  completed: boolean;
  currentStep: number;
  selectedTopics: string[];
  selectedFeeds: string[];
  followedUsers: string[];
  contentPreferences: {
    hideReposts: boolean;
    hideReplies: boolean;
    showAdultContent: boolean;
  };
  skippedSteps: string[];
  lastUpdated: string;
}

// Topic categories for interest selection
export interface TopicCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  feedUri?: string; // Optional associated feed
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: "news",
    name: "News & Politics",
    icon: "📰",
    description: "Stay informed about current events",
  },
  {
    id: "tech",
    name: "Technology",
    icon: "💻",
    description: "Tech news, programming, and innovation",
  },
  {
    id: "science",
    name: "Science",
    icon: "🔬",
    description: "Scientific discoveries and research",
  },
  {
    id: "art",
    name: "Art & Design",
    icon: "🎨",
    description: "Visual arts, design, and creativity",
  },
  {
    id: "gaming",
    name: "Gaming",
    icon: "🎮",
    description: "Video games and gaming culture",
  },
  {
    id: "music",
    name: "Music",
    icon: "🎵",
    description: "Music, artists, and audio",
  },
  {
    id: "sports",
    name: "Sports",
    icon: "⚽",
    description: "Sports news and commentary",
  },
  {
    id: "food",
    name: "Food & Cooking",
    icon: "🍳",
    description: "Recipes, restaurants, and culinary arts",
  },
  {
    id: "books",
    name: "Books & Writing",
    icon: "📚",
    description: "Literature, authors, and writing",
  },
  {
    id: "movies",
    name: "Movies & TV",
    icon: "🎬",
    description: "Film, television, and streaming",
  },
  {
    id: "nature",
    name: "Nature & Environment",
    icon: "🌿",
    description: "Environment, wildlife, and sustainability",
  },
  {
    id: "fashion",
    name: "Fashion & Style",
    icon: "👗",
    description: "Fashion, style, and trends",
  },
];

export class OnboardingService {
  private readonly STORAGE_KEY = "shadowsky_onboarding_state";
  private agent: BskyAgent | null = null;

  setAgent(agent: BskyAgent | null) {
    this.agent = agent;
  }

  /**
   * Get the current onboarding state
   */
  getState(): OnboardingState {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as OnboardingState;
      }
    } catch (error) {
      logger.error("Failed to load onboarding state:", error);
    }

    // Return default state for new users
    return {
      completed: false,
      currentStep: 0,
      selectedTopics: [],
      selectedFeeds: [],
      followedUsers: [],
      contentPreferences: {
        hideReposts: false,
        hideReplies: false,
        showAdultContent: false,
      },
      skippedSteps: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Update onboarding state
   */
  updateState(updates: Partial<OnboardingState>): void {
    try {
      const currentState = this.getState();
      const newState: OnboardingState = {
        ...currentState,
        ...updates,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newState));
      logger.log("Updated onboarding state:", newState);
    } catch (error) {
      logger.error("Failed to update onboarding state:", error);
    }
  }

  /**
   * Mark onboarding as completed
   */
  markCompleted(): void {
    this.updateState({
      completed: true,
      currentStep: -1, // -1 indicates finished
    });
  }

  /**
   * Check if user has completed onboarding.
   * Always returns true — NUX is disabled until the bug causing it to
   * re-appear unexpectedly is resolved.
   */
  isCompleted(): boolean {
    return true;
  }

  /**
   * Reset onboarding state (for testing or re-onboarding)
   */
  reset(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      logger.log("Onboarding state reset");
    } catch (error) {
      logger.error("Failed to reset onboarding state:", error);
    }
  }

  /**
   * Skip to a specific step
   */
  skipToStep(step: number): void {
    this.updateState({ currentStep: step });
  }

  /**
   * Mark a step as skipped
   */
  markStepSkipped(stepName: string): void {
    const state = this.getState();
    if (!state.skippedSteps.includes(stepName)) {
      this.updateState({
        skippedSteps: [...state.skippedSteps, stepName],
      });
    }
  }

  /**
   * Get suggested users to follow based on selected topics
   */
  async getSuggestedUsers(limit: number = 10): Promise<any[]> {
    if (!this.agent) {
      logger.error("No agent available for getting suggestions");
      return [];
    }

    try {
      // Use AT Protocol's suggested follows endpoint
      const response = await this.agent.app.bsky.actor.getSuggestions({
        limit,
      });
      return response.data.actors || [];
    } catch (error) {
      logger.error("Failed to get suggested users:", error);
      return [];
    }
  }

  /**
   * Get suggested feeds based on selected topics
   */
  async getSuggestedFeeds(limit: number = 20): Promise<any[]> {
    if (!this.agent) {
      logger.error("No agent available for getting feed suggestions");
      return [];
    }

    try {
      const response = await this.agent.app.bsky.feed.getSuggestedFeeds({
        limit,
      });
      return response.data.feeds || [];
    } catch (error) {
      logger.error("Failed to get suggested feeds:", error);
      return [];
    }
  }

  /**
   * Follow a user
   */
  async followUser(did: string): Promise<boolean> {
    if (!this.agent) {
      logger.error("No agent available for following user");
      return false;
    }

    try {
      await this.agent.follow(did);
      const state = this.getState();
      this.updateState({
        followedUsers: [...state.followedUsers, did],
      });
      return true;
    } catch (error) {
      logger.error("Failed to follow user:", error);
      return false;
    }
  }

  /**
   * Save a feed to user preferences
   */
  async saveFeed(feedUri: string): Promise<boolean> {
    if (!this.agent) {
      logger.error("No agent available for saving feed");
      return false;
    }

    try {
      const newSavedFeed = {
        id: `feed-${Date.now()}`,
        type: "feed" as const,
        value: feedUri,
        pinned: false,
      };
      await this.agent.addSavedFeeds([newSavedFeed]);

      const state = this.getState();
      this.updateState({
        selectedFeeds: [...state.selectedFeeds, feedUri],
      });
      return true;
    } catch (error) {
      logger.error("Failed to save feed:", error);
      return false;
    }
  }
}

export const onboardingService = new OnboardingService();
