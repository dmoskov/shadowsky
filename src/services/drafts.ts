export interface ThreadDraft {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  scheduledFor?: string; // ISO date string for delayed send
  // Legacy field for backward compatibility
  images?: Array<{
    file: string; // base64 or blob URL
    alt: string;
  }>;
  // New structure for multi-post threads
  posts?: string[]; // Individual post texts
  postOrder?: number[]; // Order of posts if reordered
  media?: Array<{
    file: string; // base64 or blob URL
    alt: string;
    type: "image" | "video";
    postIndex?: number; // Which post this media belongs to
  }>;
}

const DRAFTS_KEY = "bsky_thread_drafts";
const SETTINGS_KEY = "bsky_composer_settings";

export interface ComposerSettings {
  numberingFormat: "none" | "simple" | "brackets" | "thread" | "dots";
  defaultDelaySeconds: number;
  showSettingsPanel: boolean;
  numberingPosition: "beginning" | "end";
  autoGenerateAltText: boolean;
}

const DEFAULT_SETTINGS: ComposerSettings = {
  numberingFormat: "simple",
  defaultDelaySeconds: 3,
  showSettingsPanel: false,
  numberingPosition: "end",
  autoGenerateAltText: false,
};

// Draft management
export const saveDraft = (draft: ThreadDraft): void => {
  const drafts = getDrafts();
  const existingIndex = drafts.findIndex((d) => d.id === draft.id);

  if (existingIndex >= 0) {
    drafts[existingIndex] = { ...draft, updatedAt: new Date().toISOString() };
  } else {
    drafts.push({
      ...draft,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

export const getDrafts = (): ThreadDraft[] => {
  try {
    const drafts = localStorage.getItem(DRAFTS_KEY);
    return drafts ? JSON.parse(drafts) : [];
  } catch {
    return [];
  }
};

export const getDraft = (id: string): ThreadDraft | null => {
  const drafts = getDrafts();
  return drafts.find((d) => d.id === id) || null;
};

export const deleteDraft = (id: string): void => {
  const drafts = getDrafts();
  const filtered = drafts.filter((d) => d.id !== id);
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
};

// Settings management
export const getComposerSettings = (): ComposerSettings => {
  try {
    const settings = localStorage.getItem(SETTINGS_KEY);
    return settings
      ? { ...DEFAULT_SETTINGS, ...JSON.parse(settings) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveComposerSettings = (
  settings: Partial<ComposerSettings>,
): void => {
  const current = getComposerSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
};

// Utility function to generate draft ID
export const generateDraftId = (): string => {
  return `draft_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
