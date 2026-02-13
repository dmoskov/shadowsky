export interface AggregatedEvent {
  time: Date;
  notifications: any[];
  types: Set<string>;
  actors: Set<string>;
  postUri?: string; // For post-specific aggregations
  aggregationType:
    | "post"
    | "follow"
    | "mixed"
    | "post-burst"
    | "user-activity"
    | "recent-comments"; // Type of aggregation
  earliestTime?: Date; // Track the earliest notification in the group
  latestTime?: Date; // Track the latest notification in the group
  burstIntensity?: "low" | "medium" | "high"; // For post bursts
  postText?: string; // Cache the post text for burst events
  primaryActor?: {
    // For user activity aggregation
    handle: string;
    displayName?: string;
    avatar?: string;
  };
  affectedPosts?: Array<{
    // Posts affected by user activity
    uri: string;
    text?: string;
    hasImages?: boolean;
    hasVideo?: boolean;
    hasExternal?: boolean;
  }>;
}

export interface DayGroup {
  label: string;
  events: AggregatedEvent[];
}

export interface VisualTimelineProps {
  hideTimeLabels?: boolean;
  isInSkyDeck?: boolean;
  isFocused?: boolean;
  onClose?: () => void;
}

// Helper function to generate internal app URL for a profile
export const getProfileUrl = (handle: string) => {
  // Remove @ if present
  const cleanHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  return `/profile/${cleanHandle}`;
};
