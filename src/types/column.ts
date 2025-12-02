export type ColumnType =
  | "notifications"
  | "timeline"
  | "feed"
  | "messages"
  | "bookmarks";

export interface Column {
  id: string;
  type: ColumnType;
  title?: string;
  data?: string; // Can be threadUri, feedUri, profileHandle, listUri etc
}
