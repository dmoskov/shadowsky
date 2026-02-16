/**
 * Bookmark Collection Types
 *
 * Collections allow users to organize bookmarks into folders with custom names and descriptions.
 * Collections are stored locally (AsyncStorage) with the bookmark-to-collection mappings.
 */

import { colors as defaultColors } from "../../constants/theme";

export interface BookmarkCollection {
  id: string;
  name: string;
  description?: string;
  color?: string; // Optional color for visual distinction
  icon?: string; // Optional icon name
  createdAt: string;
  updatedAt: string;
  bookmarkCount: number;
}

export interface BookmarkCollectionMapping {
  bookmarkUri: string;
  collectionId: string;
  addedAt: string;
}

// Default collection that contains all bookmarks not in any specific collection
export const DEFAULT_COLLECTION_ID = "__all__";
export const UNCATEGORIZED_COLLECTION_ID = "__uncategorized__";

// Collection color option IDs (for type safety)
export const COLLECTION_COLOR_IDS = [
  "blue", "green", "purple", "pink", "orange", "yellow", "red", "teal",
] as const;

// Function to get collection colors with dynamic theme colors
export function getCollectionColors(colors?: any) {
  const themeColors = colors || defaultColors;
  return [
    { id: "blue" as const, name: "Blue", value: themeColors.info },
    { id: "green" as const, name: "Green", value: themeColors.success },
    { id: "purple" as const, name: "Purple", value: "#a855f7" },
    { id: "pink" as const, name: "Pink", value: themeColors.accent },
    { id: "orange" as const, name: "Orange", value: "#f97316" },
    { id: "yellow" as const, name: "Yellow", value: "#eab308" },
    { id: "red" as const, name: "Red", value: themeColors.danger },
    { id: "teal" as const, name: "Teal", value: "#14b8a6" },
  ];
}

// Backward-compatible constant using default colors
export const COLLECTION_COLORS = getCollectionColors();

// Collection icon options
export const COLLECTION_ICONS = [
  "folder",
  "star",
  "heart",
  "bookmark",
  "tag",
  "flag",
  "lightbulb",
  "code",
  "image",
  "music",
  "film",
  "book",
  "briefcase",
  "coffee",
  "gamepad",
  "palette",
  "sparkles",
  "zap",
] as const;

export type CollectionColor = (typeof COLLECTION_COLOR_IDS)[number];
export type CollectionIcon = (typeof COLLECTION_ICONS)[number];
