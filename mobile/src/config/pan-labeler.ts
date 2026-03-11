/**
 * Pan Engagement Labeler Configuration (Mobile)
 *
 * Pan analyzes Bluesky engagement patterns via the firehose and publishes
 * AT Protocol labels categorizing user behavior patterns.
 */

export const PAN_LABELER_DID = "did:web:labeler.pan.shadowsky.io";

export interface PanLabelConfig {
  displayName: string;
  description: string;
  category: "constructive" | "disruptive";
  color: string;
  bgColor: string;
  borderColor: string;
}

export const PAN_ENGAGEMENT_LABELS: Record<string, PanLabelConfig> = {
  // Constructive (green/blue tones)
  "good-faith": {
    displayName: "Good Faith",
    description: "Engages in honest, productive discourse",
    category: "constructive",
    color: "#059669",
    bgColor: "rgba(5, 150, 105, 0.1)",
    borderColor: "rgba(5, 150, 105, 0.3)",
  },
  "community-builder": {
    displayName: "Community Builder",
    description: "Actively fosters community connections and growth",
    category: "constructive",
    color: "#0891b2",
    bgColor: "rgba(8, 145, 178, 0.1)",
    borderColor: "rgba(8, 145, 178, 0.3)",
  },
  "expert-contributor": {
    displayName: "Expert Contributor",
    description: "Provides knowledgeable, high-quality contributions",
    category: "constructive",
    color: "#2563eb",
    bgColor: "rgba(37, 99, 235, 0.1)",
    borderColor: "rgba(37, 99, 235, 0.3)",
  },
  "bridge-builder": {
    displayName: "Bridge Builder",
    description: "Connects different communities and viewpoints constructively",
    category: "constructive",
    color: "#7c3aed",
    bgColor: "rgba(124, 58, 237, 0.1)",
    borderColor: "rgba(124, 58, 237, 0.3)",
  },
  "active-contributor": {
    displayName: "Active Contributor",
    description: "Consistently contributes meaningful content",
    category: "constructive",
    color: "#16a34a",
    bgColor: "rgba(22, 163, 74, 0.1)",
    borderColor: "rgba(22, 163, 74, 0.3)",
  },

  // Disruptive (amber/red tones)
  "bot-like": {
    displayName: "Bot-Like",
    description: "Exhibits automated or bot-like engagement patterns",
    category: "disruptive",
    color: "#d97706",
    bgColor: "rgba(217, 119, 6, 0.1)",
    borderColor: "rgba(217, 119, 6, 0.3)",
  },
  trolling: {
    displayName: "Trolling",
    description: "Engagement patterns suggest deliberate provocation",
    category: "disruptive",
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  sealioning: {
    displayName: "Sealioning",
    description: "Persistent bad-faith questioning disguised as civility",
    category: "disruptive",
    color: "#ea580c",
    bgColor: "rgba(234, 88, 12, 0.1)",
    borderColor: "rgba(234, 88, 12, 0.3)",
  },
  "concern-trolling": {
    displayName: "Concern Trolling",
    description: "Feigns concern to undermine or disrupt conversations",
    category: "disruptive",
    color: "#e11d48",
    bgColor: "rgba(225, 29, 72, 0.1)",
    borderColor: "rgba(225, 29, 72, 0.3)",
  },
  flaming: {
    displayName: "Flaming",
    description: "Hostile or inflammatory engagement patterns",
    category: "disruptive",
    color: "#dc2626",
    bgColor: "rgba(220, 38, 38, 0.1)",
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  derailer: {
    displayName: "Derailer",
    description: "Consistently diverts conversations off-topic",
    category: "disruptive",
    color: "#b45309",
    bgColor: "rgba(180, 83, 9, 0.1)",
    borderColor: "rgba(180, 83, 9, 0.3)",
  },
  brigading: {
    displayName: "Brigading",
    description: "Participates in coordinated targeting of users or content",
    category: "disruptive",
    color: "#be123c",
    bgColor: "rgba(190, 18, 60, 0.1)",
    borderColor: "rgba(190, 18, 60, 0.3)",
  },
  harassment: {
    displayName: "Harassment",
    description: "Engagement patterns indicate targeted harassment",
    category: "disruptive",
    color: "#991b1b",
    bgColor: "rgba(153, 27, 27, 0.1)",
    borderColor: "rgba(153, 27, 27, 0.3)",
  },
};

export function isPanLabel(label: { val: string; src?: string }): boolean {
  return label.src === PAN_LABELER_DID;
}

export function partitionPanLabels<T extends { val: string; src?: string }>(
  labels: T[],
): { panLabels: T[]; otherLabels: T[] } {
  const panLabels: T[] = [];
  const otherLabels: T[] = [];
  for (const label of labels) {
    if (isPanLabel(label)) {
      panLabels.push(label);
    } else {
      otherLabels.push(label);
    }
  }
  return { panLabels, otherLabels };
}
