import { RichText } from "@atproto/api";
import {
  AlertCircle,
  BookTemplate,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Hash,
  Image,
  Loader,
  Plus,
  Save,
  Send,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  deleteDraft,
  generateDraftId,
  getComposerSettings,
  getDrafts,
  saveComposerSettings,
  saveDraft,
  type ComposerSettings,
  type ThreadDraft,
} from "../services/drafts";
import { compressImage, isCompressibleImage } from "../utils/image-compression";
import { createLogger } from "../utils/logger";
import { safeCreateObjectURL, safeRevokeObjectURL } from "../utils/retry";

const logger = createLogger("ThreadPlannerComposer");

// Thread post with media support
interface ThreadPostMedia {
  id: string;
  file: File;
  preview: string;
  alt: string;
  type: "image" | "video";
}

interface ThreadPost {
  id: string;
  text: string;
  media: ThreadPostMedia[];
}

// Thread template definition
interface ThreadTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  posts: string[];
}

// Built-in templates for common thread patterns
const THREAD_TEMPLATES: ThreadTemplate[] = [
  {
    id: "story",
    name: "Story Thread",
    description: "Tell a narrative with beginning, middle, and end",
    icon: "📖",
    posts: [
      "🧵 Let me tell you about...",
      "It all started when...",
      "Then something unexpected happened...",
      "In the end...",
      "The lesson I learned: ...",
    ],
  },
  {
    id: "tutorial",
    name: "Tutorial Thread",
    description: "Step-by-step guide or how-to",
    icon: "📚",
    posts: [
      "🧵 How to [topic] - A thread",
      "Step 1: ...",
      "Step 2: ...",
      "Step 3: ...",
      "Pro tips and final thoughts:",
    ],
  },
  {
    id: "listicle",
    name: "Top 5 List",
    description: "Countdown or ranked list",
    icon: "📝",
    posts: [
      "🧵 Top 5 [topic]:",
      "5️⃣ ...",
      "4️⃣ ...",
      "3️⃣ ...",
      "2️⃣ ...",
      "1️⃣ And the top spot goes to...",
    ],
  },
  {
    id: "explainer",
    name: "Explainer Thread",
    description: "Break down a complex topic",
    icon: "💡",
    posts: [
      "🧵 Let me explain [topic] in simple terms:",
      "First, what is it?",
      "Why does it matter?",
      "How does it work?",
      "Key takeaways:",
    ],
  },
  {
    id: "hot-take",
    name: "Hot Take",
    description: "Controversial opinion with reasoning",
    icon: "🔥",
    posts: [
      "🔥 Hot take: [opinion]",
      "Here's why I think this:",
      "The evidence:",
      "What others miss:",
      "My conclusion:",
    ],
  },
  {
    id: "blank",
    name: "Blank Thread",
    description: "Start with a clean slate",
    icon: "✨",
    posts: [""],
  },
];

// Numbering format options
const NUMBERING_FORMATS = {
  none: { label: "None", format: () => "" },
  simple: {
    label: "1/5",
    format: (i: number, total: number) => `${i}/${total}`,
  },
  brackets: {
    label: "[1/5]",
    format: (i: number, total: number) => `[${i}/${total}]`,
  },
  thread: {
    label: "🧵 1/5",
    format: (i: number, total: number) => `🧵 ${i}/${total}`,
  },
  dots: {
    label: "• 1 of 5",
    format: (i: number, total: number) => `• ${i} of ${total}`,
  },
} as const;

interface ThreadPlannerComposerProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraftId?: string;
  onThreadPosted?: () => void;
}

const MAX_POST_LENGTH = 300;
const MAX_IMAGES_PER_POST = 4;
const MAX_IMAGE_SIZE = 1000000; // 1MB
const AUTOSAVE_DELAY = 5000;

export function ThreadPlannerComposer({
  isOpen,
  onClose,
  initialDraftId,
  onThreadPosted,
}: ThreadPlannerComposerProps) {
  const { agent } = useAuth();
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Thread posts state
  const [posts, setPosts] = useState<ThreadPost[]>([
    { id: generatePostId(), text: "", media: [] },
  ]);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [draftTitle, setDraftTitle] = useState("");

  // Settings state
  const [settings, setSettings] = useState<ComposerSettings>(
    getComposerSettings(),
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<{
    type: "idle" | "saving" | "saved" | "posting" | "success" | "error";
    message?: string;
  }>({ type: "idle" });

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Autosave state
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>("");

  // Textarea refs for focusing
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // File input refs per post
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Generate unique post ID
  function generatePostId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate media ID
  function generateMediaId(): string {
    return `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Load draft on mount if initialDraftId is provided
  useEffect(() => {
    if (initialDraftId && isOpen) {
      const drafts = getDrafts();
      const draft = drafts.find((d) => d.id === initialDraftId);
      if (draft) {
        loadDraft(draft);
      }
    }
  }, [initialDraftId, isOpen]);

  // Load draft content
  const loadDraft = useCallback((draft: ThreadDraft) => {
    setDraftId(draft.id);
    setDraftTitle(draft.title);

    if (draft.posts && draft.posts.length > 0) {
      const loadedPosts: ThreadPost[] = draft.posts.map((text, index) => {
        // Find media for this post
        const postMedia: ThreadPostMedia[] = (draft.media || [])
          .filter((m) => m.postIndex === index)
          .map((m) => ({
            id: generateMediaId(),
            file: new File([], "restored"), // Placeholder - media restoration would need base64 decoding
            preview: m.file,
            alt: m.alt,
            type: m.type,
          }));

        return {
          id: generatePostId(),
          text,
          media: postMedia,
        };
      });
      setPosts(loadedPosts);
    } else if (draft.content) {
      // Fall back to content field for legacy drafts
      const splitPosts = draft.content.split("\n---\n");
      setPosts(
        splitPosts.map((text) => ({
          id: generatePostId(),
          text: text.trim(),
          media: [],
        })),
      );
    }
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    }
  }, [isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Autosave effect
  useEffect(() => {
    if (!isOpen) return;

    const hasContent = posts.some(
      (p) => p.text.trim().length > 0 || p.media.length > 0,
    );
    if (!hasContent) return;

    const currentContent = JSON.stringify(
      posts.map((p) => ({ text: p.text, mediaCount: p.media.length })),
    );
    if (currentContent === lastSavedContentRef.current) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, AUTOSAVE_DELAY);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [posts, isOpen]);

  // Cleanup media URLs on unmount
  useEffect(() => {
    return () => {
      posts.forEach((post) => {
        post.media.forEach((m) => {
          if (m.preview && !m.preview.startsWith("data:")) {
            safeRevokeObjectURL(m.preview);
          }
        });
      });
    };
  }, []);

  // Perform autosave
  const performAutosave = useCallback(async () => {
    const hasContent = posts.some(
      (p) => p.text.trim().length > 0 || p.media.length > 0,
    );
    if (!hasContent) return;

    setIsSaving(true);
    setStatus({ type: "saving", message: "Autosaving..." });

    try {
      const id = draftId || generateDraftId();
      const title =
        draftTitle ||
        posts[0].text.substring(0, 50) +
          (posts[0].text.length > 50 ? "..." : "") ||
        "Untitled Thread";

      // Convert media to storable format
      const allMedia: ThreadDraft["media"] = [];
      posts.forEach((post, postIndex) => {
        post.media.forEach((m) => {
          allMedia.push({
            file: m.preview, // In a real implementation, this would be base64
            alt: m.alt,
            type: m.type,
            postIndex,
          });
        });
      });

      const draft: ThreadDraft = {
        id,
        title,
        content: posts.map((p) => p.text).join("\n---\n"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        posts: posts.map((p) => p.text),
        media: allMedia,
      };

      saveDraft(draft);
      setDraftId(id);
      lastSavedContentRef.current = JSON.stringify(
        posts.map((p) => ({ text: p.text, mediaCount: p.media.length })),
      );

      setStatus({ type: "saved", message: "Draft saved" });
      setTimeout(() => {
        setStatus({ type: "idle" });
      }, 2000);
    } catch (error) {
      logger.error("Autosave failed:", error);
      setStatus({ type: "error", message: "Failed to save draft" });
    } finally {
      setIsSaving(false);
    }
  }, [posts, draftId, draftTitle]);

  // Manual save
  const handleSave = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    performAutosave();
  }, [performAutosave]);

  // Save settings
  const handleSaveSettings = useCallback(
    (newSettings: Partial<ComposerSettings>) => {
      const updated = { ...settings, ...newSettings };
      setSettings(updated);
      saveComposerSettings(updated);
    },
    [settings],
  );

  // Apply template
  const applyTemplate = useCallback((template: ThreadTemplate) => {
    const newPosts = template.posts.map((text) => ({
      id: generatePostId(),
      text,
      media: [],
    }));
    setPosts(newPosts);
    setShowTemplates(false);

    // Expand all posts initially
    setExpandedPosts(new Set(newPosts.map((p) => p.id)));

    // Focus first post
    setTimeout(() => {
      const firstPost = newPosts[0];
      if (firstPost) {
        const ref = textareaRefs.current.get(firstPost.id);
        ref?.focus();
      }
    }, 0);
  }, []);

  // Add new post
  const addPost = useCallback((afterIndex?: number) => {
    const newPost: ThreadPost = { id: generatePostId(), text: "", media: [] };
    setPosts((prev) => {
      if (afterIndex !== undefined) {
        const newPosts = [...prev];
        newPosts.splice(afterIndex + 1, 0, newPost);
        return newPosts;
      }
      return [...prev, newPost];
    });

    // Expand new post
    setExpandedPosts((prev) => new Set([...prev, newPost.id]));

    // Focus the new post after render
    setTimeout(() => {
      const ref = textareaRefs.current.get(newPost.id);
      ref?.focus();
    }, 0);
  }, []);

  // Remove post
  const removePost = useCallback((index: number) => {
    setPosts((prev) => {
      if (prev.length <= 1) return prev;
      const post = prev[index];
      // Cleanup media URLs
      post.media.forEach((m) => safeRevokeObjectURL(m.preview));
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Duplicate post
  const duplicatePost = useCallback((index: number) => {
    setPosts((prev) => {
      const postToDupe = prev[index];
      const newPost: ThreadPost = {
        id: generatePostId(),
        text: postToDupe.text,
        media: [], // Don't duplicate media
      };
      const newPosts = [...prev];
      newPosts.splice(index + 1, 0, newPost);
      return newPosts;
    });
  }, []);

  // Update post text
  const updatePost = useCallback((index: number, text: string) => {
    setPosts((prev) =>
      prev.map((post, i) => (i === index ? { ...post, text } : post)),
    );
  }, []);

  // Toggle post expansion
  const togglePostExpanded = useCallback((postId: string) => {
    setExpandedPosts((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) {
        next.delete(postId);
      } else {
        next.add(postId);
      }
      return next;
    });
  }, []);

  // Move post up/down
  const movePost = useCallback((index: number, direction: "up" | "down") => {
    setPosts((prev) => {
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const newPosts = [...prev];
      [newPosts[index], newPosts[newIndex]] = [
        newPosts[newIndex],
        newPosts[index],
      ];
      return newPosts;
    });
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      // Ctrl/Cmd + Enter to add new post
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        addPost(index);
        return;
      }

      // Backspace on empty post to delete and focus previous
      if (
        e.key === "Backspace" &&
        posts[index].text === "" &&
        posts[index].media.length === 0 &&
        index > 0
      ) {
        e.preventDefault();
        removePost(index);
        // Focus previous post
        setTimeout(() => {
          const prevPost = posts[index - 1];
          if (prevPost) {
            const ref = textareaRefs.current.get(prevPost.id);
            if (ref) {
              ref.focus();
              ref.selectionStart = ref.value.length;
              ref.selectionEnd = ref.value.length;
            }
          }
        }, 0);
      }
    },
    [posts, addPost, removePost],
  );

  // Media handling
  const handleFileSelect = useCallback(
    async (postIndex: number, files: FileList | null) => {
      if (!files) return;

      const post = posts[postIndex];
      const currentImageCount = post.media.filter(
        (m) => m.type === "image",
      ).length;

      for (const file of Array.from(files)) {
        if (currentImageCount >= MAX_IMAGES_PER_POST) {
          setStatus({
            type: "error",
            message: `Maximum ${MAX_IMAGES_PER_POST} images per post`,
          });
          break;
        }

        try {
          let processedFile = file;

          // Compress image if needed
          if (isCompressibleImage(file) && file.size > MAX_IMAGE_SIZE) {
            try {
              processedFile = await compressImage(file);
            } catch (compressionError) {
              logger.error("Failed to compress image:", compressionError);
            }
          }

          if (processedFile.size > MAX_IMAGE_SIZE) {
            setStatus({
              type: "error",
              message: "Image must be less than 1MB",
            });
            continue;
          }

          const preview = safeCreateObjectURL(processedFile);
          if (!preview) {
            setStatus({ type: "error", message: "Failed to create preview" });
            continue;
          }

          const newMedia: ThreadPostMedia = {
            id: generateMediaId(),
            file: processedFile,
            preview,
            alt: "",
            type: "image",
          };

          setPosts((prev) =>
            prev.map((p, i) =>
              i === postIndex ? { ...p, media: [...p.media, newMedia] } : p,
            ),
          );
        } catch (error) {
          logger.error("Failed to add media:", error);
          setStatus({ type: "error", message: "Failed to add media" });
        }
      }

      // Reset file input
      const fileInput = fileInputRefs.current.get(post.id);
      if (fileInput) {
        fileInput.value = "";
      }
    },
    [posts],
  );

  const removeMedia = useCallback((postIndex: number, mediaId: string) => {
    setPosts((prev) =>
      prev.map((post, i) => {
        if (i !== postIndex) return post;
        const mediaItem = post.media.find((m) => m.id === mediaId);
        if (mediaItem) {
          safeRevokeObjectURL(mediaItem.preview);
        }
        return {
          ...post,
          media: post.media.filter((m) => m.id !== mediaId),
        };
      }),
    );
  }, []);

  const updateMediaAlt = useCallback(
    (postIndex: number, mediaId: string, alt: string) => {
      setPosts((prev) =>
        prev.map((post, i) => {
          if (i !== postIndex) return post;
          return {
            ...post,
            media: post.media.map((m) =>
              m.id === mediaId ? { ...m, alt } : m,
            ),
          };
        }),
      );
    },
    [],
  );

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedIndex !== index) {
        setDragOverIndex(index);
      }
    },
    [draggedIndex],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();

      if (draggedIndex === null || draggedIndex === targetIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      setPosts((prev) => {
        const newPosts = [...prev];
        const [removed] = newPosts.splice(draggedIndex, 1);
        newPosts.splice(targetIndex, 0, removed);
        return newPosts;
      });

      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex],
  );

  // Format post with numbering
  const formatPostWithNumbering = useCallback(
    (text: string, index: number, total: number): string => {
      if (settings.numberingFormat === "none") return text;

      const formatFn = NUMBERING_FORMATS[settings.numberingFormat].format;
      const numbering = formatFn(index + 1, total);

      if (settings.numberingPosition === "beginning") {
        return `${numbering} ${text}`;
      } else {
        return `${text} ${numbering}`;
      }
    },
    [settings.numberingFormat, settings.numberingPosition],
  );

  // Post the thread
  const handlePost = useCallback(async () => {
    if (!agent) {
      setStatus({ type: "error", message: "Not logged in" });
      return;
    }

    const validPosts = posts.filter(
      (p) => p.text.trim().length > 0 || p.media.length > 0,
    );
    if (validPosts.length === 0) {
      setStatus({ type: "error", message: "No content to post" });
      return;
    }

    // Check for posts exceeding limit
    const overLimitPosts = validPosts.filter((p) => {
      const formattedText = formatPostWithNumbering(
        p.text,
        posts.indexOf(p),
        validPosts.length,
      );
      return formattedText.length > MAX_POST_LENGTH;
    });
    if (overLimitPosts.length > 0) {
      setStatus({
        type: "error",
        message: `Some posts exceed ${MAX_POST_LENGTH} characters (including numbering)`,
      });
      return;
    }

    setIsPosting(true);
    setStatus({ type: "posting", message: "Posting thread..." });

    try {
      let rootPost: { uri: string; cid: string } | undefined;
      let lastPost: { uri: string; cid: string } | undefined;

      for (let i = 0; i < validPosts.length; i++) {
        const post = validPosts[i];
        setStatus({
          type: "posting",
          message: `Posting ${i + 1}/${validPosts.length}...`,
        });

        // Format text with numbering
        const formattedText = formatPostWithNumbering(
          post.text,
          i,
          validPosts.length,
        );

        // Create rich text with facet detection
        const rt = new RichText({ text: formattedText });
        await rt.detectFacets(agent);

        // Upload images if any
        const images: Array<{ alt: string; image: unknown }> = [];
        for (const media of post.media) {
          if (media.type === "image") {
            const response = await agent.uploadBlob(media.file, {
              encoding: media.file.type,
            });
            images.push({
              alt: media.alt || "",
              image: response.data.blob,
            });
          }
        }

        const postData: {
          text: string;
          facets?: typeof rt.facets;
          embed?: {
            $type: string;
            images: Array<{ alt: string; image: unknown }>;
          };
          reply?: {
            root: { uri: string; cid: string };
            parent: { uri: string; cid: string };
          };
        } = {
          text: rt.text,
          facets: rt.facets,
        };

        // Add images embed if any
        if (images.length > 0) {
          postData.embed = {
            $type: "app.bsky.embed.images",
            images,
          };
        }

        // Add reply info for subsequent posts
        // root = first post in thread (stays constant)
        // parent = previous post in thread (changes each iteration)
        if (i > 0 && rootPost && lastPost) {
          postData.reply = {
            root: rootPost,
            parent: lastPost,
          };
        }

        const result = await agent.post(postData);
        const currentPost = {
          uri: result.uri,
          cid: result.cid,
        };

        // First post becomes the root for all subsequent posts
        if (i === 0) {
          rootPost = currentPost;
        }
        lastPost = currentPost;

        // Small delay between posts to avoid rate limiting
        if (i < validPosts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setStatus({ type: "success", message: "Thread posted!" });

      // Delete the draft if it exists
      if (draftId) {
        deleteDraft(draftId);
      }

      // Cleanup media URLs
      posts.forEach((post) => {
        post.media.forEach((m) => safeRevokeObjectURL(m.preview));
      });

      // Notify parent and close
      setTimeout(() => {
        onThreadPosted?.();
        onClose();
        // Reset state
        setPosts([{ id: generatePostId(), text: "", media: [] }]);
        setDraftId(null);
        setDraftTitle("");
        setStatus({ type: "idle" });
      }, 1500);
    } catch (error) {
      logger.error("Failed to post thread:", error);
      setStatus({
        type: "error",
        message:
          error instanceof Error ? error.message : "Failed to post thread",
      });
    } finally {
      setIsPosting(false);
    }
  }, [agent, posts, draftId, formatPostWithNumbering, onThreadPosted, onClose]);

  // Calculate stats
  const validPosts = posts.filter(
    (p) => p.text.trim().length > 0 || p.media.length > 0,
  );
  const totalChars = posts.reduce((sum, p) => sum + p.text.length, 0);
  const totalMedia = posts.reduce((sum, p) => sum + p.media.length, 0);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 pt-8 md:pt-16"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="thread-planner-title"
        className="relative w-full max-w-3xl overflow-hidden rounded-xl shadow-xl"
        style={{ background: "var(--bsky-bg-primary)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 md:px-6"
          style={{
            borderColor: "var(--bsky-border-primary)",
            background: "var(--bsky-bg-primary)",
          }}
        >
          <div className="flex items-center gap-3">
            <h2
              id="thread-planner-title"
              className="text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Thread Planner
            </h2>
            {status.type !== "idle" && (
              <span
                className="flex items-center gap-1 text-sm"
                style={{
                  color:
                    status.type === "error"
                      ? "var(--bsky-error)"
                      : status.type === "success"
                        ? "var(--bsky-success)"
                        : "var(--bsky-text-secondary)",
                }}
              >
                {status.type === "saving" && (
                  <Loader size={14} className="animate-spin" />
                )}
                {status.type === "saved" && <CheckCircle size={14} />}
                {status.type === "error" && <AlertCircle size={14} />}
                {status.type === "success" && <Check size={14} />}
                {status.message}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Templates button */}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors"
              style={{
                background: showTemplates
                  ? "var(--bsky-primary)"
                  : "var(--bsky-bg-secondary)",
                color: showTemplates ? "white" : "var(--bsky-text-secondary)",
              }}
              title="Thread templates"
            >
              <BookTemplate size={14} />
              Templates
            </button>
            {/* Settings button */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors"
              style={{
                background: showSettings
                  ? "var(--bsky-primary)"
                  : "var(--bsky-bg-secondary)",
                color: showSettings ? "white" : "var(--bsky-text-secondary)",
              }}
              title="Numbering settings"
            >
              <Settings size={14} />
            </button>
            {/* Preview toggle */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors"
              style={{
                background: showPreview
                  ? "var(--bsky-primary)"
                  : "var(--bsky-bg-secondary)",
                color: showPreview ? "white" : "var(--bsky-text-secondary)",
              }}
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? "Edit" : "Preview"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:opacity-80"
              style={{ color: "var(--bsky-text-secondary)" }}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Templates dropdown */}
        {showTemplates && (
          <div
            className="border-b px-4 py-3 md:px-6"
            style={{
              borderColor: "var(--bsky-border-primary)",
              background: "var(--bsky-bg-secondary)",
            }}
          >
            <h3
              className="mb-3 text-sm font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Choose a template to get started
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {THREAD_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => applyTemplate(template)}
                  className="flex flex-col items-start rounded-lg border p-3 text-left transition-colors hover:border-blue-400"
                  style={{
                    borderColor: "var(--bsky-border-primary)",
                    background: "var(--bsky-bg-primary)",
                  }}
                >
                  <span className="mb-1 text-lg">{template.icon}</span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--bsky-text-primary)" }}
                  >
                    {template.name}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    {template.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Settings dropdown */}
        {showSettings && (
          <div
            className="border-b px-4 py-3 md:px-6"
            style={{
              borderColor: "var(--bsky-border-primary)",
              background: "var(--bsky-bg-secondary)",
            }}
          >
            <h3
              className="mb-3 text-sm font-medium"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Numbering Settings
            </h3>
            <div className="flex flex-wrap gap-4">
              {/* Format selection */}
              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Format
                </label>
                <select
                  value={settings.numberingFormat}
                  onChange={(e) =>
                    handleSaveSettings({
                      numberingFormat: e.target
                        .value as ComposerSettings["numberingFormat"],
                    })
                  }
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  style={{
                    background: "var(--bsky-bg-primary)",
                    borderColor: "var(--bsky-border-primary)",
                    color: "var(--bsky-text-primary)",
                  }}
                >
                  {Object.entries(NUMBERING_FORMATS).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {/* Position selection */}
              <div>
                <label
                  className="mb-1 block text-xs"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Position
                </label>
                <select
                  value={settings.numberingPosition}
                  onChange={(e) =>
                    handleSaveSettings({
                      numberingPosition: e.target.value as "beginning" | "end",
                    })
                  }
                  className="rounded-lg border px-3 py-1.5 text-sm"
                  style={{
                    background: "var(--bsky-bg-primary)",
                    borderColor: "var(--bsky-border-primary)",
                    color: "var(--bsky-text-primary)",
                  }}
                  disabled={settings.numberingFormat === "none"}
                >
                  <option value="beginning">Beginning</option>
                  <option value="end">End</option>
                </select>
              </div>
              {/* Preview */}
              {settings.numberingFormat !== "none" && (
                <div>
                  <label
                    className="mb-1 block text-xs"
                    style={{ color: "var(--bsky-text-secondary)" }}
                  >
                    Example
                  </label>
                  <div
                    className="rounded-lg border px-3 py-1.5 text-sm"
                    style={{
                      background: "var(--bsky-bg-primary)",
                      borderColor: "var(--bsky-border-primary)",
                      color: "var(--bsky-text-primary)",
                    }}
                  >
                    {formatPostWithNumbering(
                      "Your post text here",
                      0,
                      validPosts.length || 1,
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-h-[calc(100vh-280px)] overflow-y-auto p-4 md:p-6">
          {showPreview ? (
            // Preview mode
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3
                  className="text-sm font-medium"
                  style={{ color: "var(--bsky-text-secondary)" }}
                >
                  Thread Preview ({validPosts.length}{" "}
                  {validPosts.length === 1 ? "post" : "posts"})
                </h3>
                {settings.numberingFormat !== "none" && (
                  <span
                    className="text-xs"
                    style={{ color: "var(--bsky-text-tertiary)" }}
                  >
                    <Hash size={12} className="mr-1 inline" />
                    Auto-numbering:{" "}
                    {NUMBERING_FORMATS[settings.numberingFormat].label}
                  </span>
                )}
              </div>
              <div className="space-y-3">
                {posts
                  .filter((p) => p.text.trim().length > 0 || p.media.length > 0)
                  .map((post, index, filteredPosts) => {
                    const formattedText = formatPostWithNumbering(
                      post.text,
                      index,
                      filteredPosts.length,
                    );
                    const isOverLimit = formattedText.length > MAX_POST_LENGTH;

                    return (
                      <div
                        key={post.id}
                        className="rounded-lg border p-4"
                        style={{
                          borderColor: isOverLimit
                            ? "var(--bsky-error)"
                            : "var(--bsky-border-primary)",
                          background: "var(--bsky-bg-secondary)",
                        }}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className="text-sm font-medium"
                            style={{ color: "var(--bsky-primary)" }}
                          >
                            Post {index + 1}
                          </span>
                          <span
                            className="font-mono text-xs"
                            style={{
                              color: isOverLimit
                                ? "var(--bsky-error)"
                                : "var(--bsky-text-tertiary)",
                            }}
                          >
                            {formattedText.length}/{MAX_POST_LENGTH}
                          </span>
                        </div>
                        <p
                          className="whitespace-pre-wrap"
                          style={{ color: "var(--bsky-text-primary)" }}
                        >
                          {formattedText}
                        </p>
                        {/* Media preview */}
                        {post.media.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto">
                            {post.media.map((media) => (
                              <div key={media.id} className="flex-shrink-0">
                                <img
                                  src={media.preview}
                                  alt={media.alt || "Attached image"}
                                  className="h-20 w-20 rounded object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {isOverLimit && (
                          <p
                            className="mt-2 text-xs"
                            style={{ color: "var(--bsky-error)" }}
                          >
                            This post exceeds the character limit
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            // Edit mode - Card-based editor
            <div className="space-y-4">
              {posts.map((post, index) => {
                const isExpanded = expandedPosts.has(post.id);
                const charCount = post.text.length;
                const formattedLength = formatPostWithNumbering(
                  post.text,
                  index,
                  validPosts.length,
                ).length;
                const isNearLimit = formattedLength > MAX_POST_LENGTH * 0.9;
                const isOverLimit = formattedLength > MAX_POST_LENGTH;

                return (
                  <div
                    key={post.id}
                    className={`relative rounded-lg border transition-all ${
                      dragOverIndex === index ? "border-t-4" : ""
                    }`}
                    style={{
                      borderColor:
                        dragOverIndex === index
                          ? "var(--bsky-primary)"
                          : isOverLimit
                            ? "var(--bsky-error)"
                            : "var(--bsky-border-primary)",
                      background: "var(--bsky-bg-secondary)",
                      opacity: draggedIndex === index ? 0.5 : 1,
                    }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                  >
                    {/* Post card header */}
                    <div
                      className="flex items-center justify-between border-b px-3 py-2"
                      style={{ borderColor: "var(--bsky-border-primary)" }}
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical
                          size={16}
                          className="cursor-grab"
                          style={{ color: "var(--bsky-text-tertiary)" }}
                        />
                        <span
                          className="text-sm font-medium"
                          style={{ color: "var(--bsky-primary)" }}
                        >
                          Post {index + 1}
                        </span>
                        {post.media.length > 0 && (
                          <span
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: "var(--bsky-bg-tertiary)",
                              color: "var(--bsky-text-secondary)",
                            }}
                          >
                            <Image size={10} />
                            {post.media.length}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Character count */}
                        <span
                          className="mr-2 font-mono text-xs"
                          style={{
                            color: isOverLimit
                              ? "var(--bsky-error)"
                              : isNearLimit
                                ? "var(--bsky-warning)"
                                : "var(--bsky-text-tertiary)",
                          }}
                        >
                          {charCount}/{MAX_POST_LENGTH}
                          {settings.numberingFormat !== "none" && (
                            <span className="ml-1 opacity-60">
                              (+{formattedLength - charCount})
                            </span>
                          )}
                        </span>
                        {/* Move buttons */}
                        <button
                          onClick={() => movePost(index, "up")}
                          disabled={index === 0}
                          className="rounded p-1 transition-colors hover:bg-black/10 disabled:opacity-30"
                          style={{ color: "var(--bsky-text-secondary)" }}
                          title="Move up"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => movePost(index, "down")}
                          disabled={index === posts.length - 1}
                          className="rounded p-1 transition-colors hover:bg-black/10 disabled:opacity-30"
                          style={{ color: "var(--bsky-text-secondary)" }}
                          title="Move down"
                        >
                          <ChevronDown size={14} />
                        </button>
                        {/* Duplicate button */}
                        <button
                          onClick={() => duplicatePost(index)}
                          className="rounded p-1 transition-colors hover:bg-black/10"
                          style={{ color: "var(--bsky-text-secondary)" }}
                          title="Duplicate post"
                        >
                          <Copy size={14} />
                        </button>
                        {/* Expand/collapse button */}
                        <button
                          onClick={() => togglePostExpanded(post.id)}
                          className="rounded p-1 transition-colors hover:bg-black/10"
                          style={{ color: "var(--bsky-text-secondary)" }}
                          title={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                        {/* Delete button */}
                        {posts.length > 1 && (
                          <button
                            onClick={() => removePost(index)}
                            className="rounded p-1 transition-colors hover:opacity-80"
                            style={{ color: "var(--bsky-error)" }}
                            title="Remove post"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Post card body */}
                    <div
                      className={`p-3 ${!isExpanded && post.text ? "max-h-20 overflow-hidden" : ""}`}
                    >
                      <textarea
                        ref={(el) => {
                          if (el) {
                            textareaRefs.current.set(post.id, el);
                          } else {
                            textareaRefs.current.delete(post.id);
                          }
                        }}
                        value={post.text}
                        onChange={(e) => updatePost(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        onFocus={() =>
                          setExpandedPosts(
                            (prev) => new Set([...prev, post.id]),
                          )
                        }
                        placeholder={
                          index === 0
                            ? "Start your thread..."
                            : `Continue with post ${index + 1}...`
                        }
                        className={`w-full resize-none rounded-lg border-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-0 ${
                          isExpanded ? "min-h-[100px]" : "min-h-[40px]"
                        }`}
                        style={{ color: "var(--bsky-text-primary)" }}
                      />

                      {/* Media preview */}
                      {post.media.length > 0 && isExpanded && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {post.media.map((media) => (
                            <div key={media.id} className="group relative">
                              <img
                                src={media.preview}
                                alt={media.alt || ""}
                                className="h-24 w-24 rounded object-cover"
                              />
                              <button
                                onClick={() => removeMedia(index, media.id)}
                                className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                              >
                                <X size={12} />
                              </button>
                              <input
                                type="text"
                                value={media.alt}
                                onChange={(e) =>
                                  updateMediaAlt(
                                    index,
                                    media.id,
                                    e.target.value,
                                  )
                                }
                                placeholder="Alt text"
                                className="absolute bottom-0 left-0 right-0 rounded-b bg-black/70 px-1 py-0.5 text-xs text-white placeholder-white/60 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Action bar (visible when expanded) */}
                      {isExpanded && (
                        <div
                          className="mt-3 flex items-center gap-2 border-t pt-3"
                          style={{ borderColor: "var(--bsky-border-primary)" }}
                        >
                          {/* Add image button */}
                          <input
                            ref={(el) => {
                              if (el) {
                                fileInputRefs.current.set(post.id, el);
                              } else {
                                fileInputRefs.current.delete(post.id);
                              }
                            }}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) =>
                              handleFileSelect(index, e.target.files)
                            }
                            className="hidden"
                          />
                          <button
                            onClick={() =>
                              fileInputRefs.current.get(post.id)?.click()
                            }
                            disabled={post.media.length >= MAX_IMAGES_PER_POST}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-black/10 disabled:opacity-50"
                            style={{ color: "var(--bsky-text-secondary)" }}
                            title={`Add image (${post.media.length}/${MAX_IMAGES_PER_POST})`}
                          >
                            <Image size={14} />
                            Add Image
                          </button>
                          <span
                            className="text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            Ctrl/Cmd + Enter to add post
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Collapsed indicator */}
                    {!isExpanded && post.text && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-8 rounded-b-lg"
                        style={{
                          background:
                            "linear-gradient(to bottom, transparent, var(--bsky-bg-secondary))",
                        }}
                      />
                    )}

                    {/* Add post button between cards */}
                    {index < posts.length - 1 && (
                      <div className="absolute -bottom-6 left-1/2 z-10 -translate-x-1/2">
                        <button
                          onClick={() => addPost(index)}
                          className="rounded-full p-1 shadow transition-colors hover:opacity-80"
                          style={{
                            background: "var(--bsky-bg-primary)",
                            border: "1px solid var(--bsky-border-primary)",
                            color: "var(--bsky-text-secondary)",
                          }}
                          title="Add post here"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add post button at bottom */}
              <button
                onClick={() => addPost()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-4 transition-colors hover:opacity-80"
                style={{
                  borderColor: "var(--bsky-border-primary)",
                  color: "var(--bsky-text-secondary)",
                }}
              >
                <Plus size={18} />
                Add another post
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex items-center justify-between border-t px-4 py-3 md:px-6"
          style={{
            borderColor: "var(--bsky-border-primary)",
            background: "var(--bsky-bg-primary)",
          }}
        >
          <div
            className="flex items-center gap-4 text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            <span>
              {validPosts.length} {validPosts.length === 1 ? "post" : "posts"}
            </span>
            <span>{totalChars} chars</span>
            {totalMedia > 0 && (
              <span className="flex items-center gap-1">
                <Image size={14} />
                {totalMedia}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={
                isSaving ||
                !posts.some(
                  (p) => p.text.trim().length > 0 || p.media.length > 0,
                )
              }
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: "var(--bsky-bg-secondary)",
                color: "var(--bsky-text-primary)",
              }}
            >
              <Save size={16} />
              Save Draft
            </button>
            <button
              onClick={handlePost}
              disabled={isPosting || validPosts.length === 0}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: "var(--bsky-primary)" }}
            >
              {isPosting ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Post Thread
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
