/**
 * Mobile Onboarding Service
 *
 * MMKV-backed onboarding state management for the mobile app.
 * Mirrors the web onboarding-service.ts but uses MMKV instead of localStorage
 * and accesses the AT Protocol agent via the mobile client singleton.
 */

import { MMKV } from "react-native-mmkv";
import { getAgent } from "../atproto/client";
import { createLogger } from "../../utils/logger";

const logger = createLogger("OnboardingService");

const STORAGE_KEY = "shadowsky_onboarding_state";

let _mmkv: InstanceType<typeof MMKV> | null = null;
function getMMKV() {
  if (!_mmkv) {
    _mmkv = new MMKV({ id: "shadowsky-onboarding" });
  }
  return _mmkv;
}

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

export interface TopicCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  feedUri?: string;
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: "news",
    name: "News & Politics",
    icon: "newspaper",
    description: "Stay informed about current events",
  },
  {
    id: "tech",
    name: "Technology",
    icon: "laptop",
    description: "Tech news, programming, and innovation",
  },
  {
    id: "science",
    name: "Science",
    icon: "flask",
    description: "Scientific discoveries and research",
  },
  {
    id: "art",
    name: "Art & Design",
    icon: "palette",
    description: "Visual arts, design, and creativity",
  },
  {
    id: "gaming",
    name: "Gaming",
    icon: "gamepad",
    description: "Video games and gaming culture",
  },
  {
    id: "music",
    name: "Music",
    icon: "music",
    description: "Music, artists, and audio",
  },
  {
    id: "sports",
    name: "Sports",
    icon: "trophy",
    description: "Sports news and commentary",
  },
  {
    id: "food",
    name: "Food & Cooking",
    icon: "utensils",
    description: "Recipes, restaurants, and culinary arts",
  },
  {
    id: "books",
    name: "Books & Writing",
    icon: "book",
    description: "Literature, authors, and writing",
  },
  {
    id: "movies",
    name: "Movies & TV",
    icon: "film",
    description: "Film, television, and streaming",
  },
  {
    id: "nature",
    name: "Nature & Environment",
    icon: "leaf",
    description: "Environment, wildlife, and sustainability",
  },
  {
    id: "fashion",
    name: "Fashion & Style",
    icon: "shirt",
    description: "Fashion, style, and trends",
  },
];

const DEFAULT_STATE: OnboardingState = {
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

class MobileOnboardingService {
  getState(): OnboardingState {
    try {
      const stored = getMMKV().getString(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_STATE, ...JSON.parse(stored) };
      }
    } catch (error) {
      logger.error("Failed to load onboarding state:", error);
    }
    return { ...DEFAULT_STATE };
  }

  updateState(updates: Partial<OnboardingState>): void {
    try {
      const currentState = this.getState();
      const newState: OnboardingState = {
        ...currentState,
        ...updates,
        lastUpdated: new Date().toISOString(),
      };
      getMMKV().set(STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      logger.error("Failed to update onboarding state:", error);
    }
  }

  markCompleted(): void {
    this.updateState({ completed: true, currentStep: -1 });
  }

  isCompleted(): boolean {
    return this.getState().completed;
  }

  reset(): void {
    try {
      getMMKV().delete(STORAGE_KEY);
    } catch (error) {
      logger.error("Failed to reset onboarding state:", error);
    }
  }

  markStepSkipped(stepName: string): void {
    const state = this.getState();
    if (!state.skippedSteps.includes(stepName)) {
      this.updateState({
        skippedSteps: [...state.skippedSteps, stepName],
      });
    }
  }

  async getSuggestedUsers(limit: number = 20): Promise<any[]> {
    try {
      const agent = getAgent();
      const response = await agent.app.bsky.actor.getSuggestions({ limit });
      return response.data.actors || [];
    } catch (error) {
      logger.error("Failed to get suggested users:", error);
      return [];
    }
  }

  async getSuggestedFeeds(limit: number = 20): Promise<any[]> {
    try {
      const agent = getAgent();
      const response = await agent.app.bsky.feed.getSuggestedFeeds({ limit });
      return response.data.feeds || [];
    } catch (error) {
      logger.error("Failed to get suggested feeds:", error);
      return [];
    }
  }

  async followUser(did: string): Promise<boolean> {
    try {
      const agent = getAgent();
      await agent.follow(did);
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

  async saveFeed(feedUri: string): Promise<boolean> {
    try {
      const agent = getAgent();
      const newSavedFeed = {
        id: `feed-${Date.now()}`,
        type: "feed" as const,
        value: feedUri,
        pinned: false,
      };
      await agent.addSavedFeeds([newSavedFeed]);
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

export const onboardingService = new MobileOnboardingService();
