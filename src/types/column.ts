export type ColumnType =
  | "notifications"
  | "timeline"
  | "feed"
  | "messages"
  | "bookmarks"
  | "search";

export interface Column {
  id: string;
  type: ColumnType;
  title?: string;
  data?: string; // Can be threadUri, feedUri, profileHandle, listUri etc
}
