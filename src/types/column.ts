export type ColumnType =
  | "notifications"
  | "timeline"
  | "feed"
  | "messages"
  | "bookmarks"
  | "search"
  | "trending";

export interface Column {
  id: string;
  type: ColumnType;
  title?: string;
  data?: string; // Can be threadUri, feedUri, profileHandle, listUri etc
  /**
   * Feed columns are derived from the user's Bluesky saved feeds rather than
   * stored, so they carry the id of the saved-feed entry they came from. Absent
   * on the extra columns (notifications, search, ...) the user adds by hand.
   */
  savedFeedId?: string;
  /** Derived feed column whose feed or list no longer resolves. */
  unavailable?: boolean;
}
