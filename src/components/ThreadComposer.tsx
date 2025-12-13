import type { AppBskyFeedDefs } from "@atproto/api";
import { RichText } from "@atproto/api";
import {
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Eye,
  GripVertical,
  Link,
  Loader,
  MessageCircle,
  Plus,
  Save,
  Send,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { fetchLinkMetadata, type LinkMetadata } from "../services/anthropic";
import {
  deleteDraft,
  generateDraftId,
  getDrafts,
  saveDraft,
  type ThreadDraft,
} from "../services/drafts";
import { createLogger } from "../utils/logger";
import { parseBskyUrl } from "../utils/url-helpers";
import { extractFirstBskyPostUrl, extractFirstLinkUrl } from "./composer/utils";
import { ProfileHoverCard } from "./ui/ProfileHoverCard";

const logger = createLogger("ThreadComposer");

interface ThreadPost {
  id: string;
  text: string;
}

interface ThreadComposerProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraftId?: string;
  onThreadPosted?: () => void;
}

const MAX_POST_LENGTH = 280; // Task specifies 280 limit
const AUTOSAVE_DELAY = 5000; // 5-second debounce

export function ThreadComposer({
  isOpen,
  onClose,
  initialDraftId,
  onThreadPosted,
}: ThreadComposerProps) {
  const { agent, session } = useAuth();
  const containerRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Thread posts state
  const [posts, setPosts] = useState<ThreadPost[]>([
    { id: generatePostId(), text: "" },
  ]);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [draftTitle, setDraftTitle] = useState("");

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "saving" | "saved" | "posting" | "success" | "error";
    message?: string;
    postUrl?: string;
  }>({ type: "idle" });

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Autosave state
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>("");

  // Textarea refs for focusing
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Generate unique post ID
  function generatePostId(): string {
    return `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      setPosts(draft.posts.map((text) => ({ id: generatePostId(), text })));
    } else if (draft.content) {
      // Fall back to content field for legacy drafts
      const splitPosts = draft.content.split("\n---\n");
      setPosts(
        splitPosts.map((text) => ({ id: generatePostId(), text: text.trim() })),
      );
    }
  }, []);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Clear autosave timer
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

    // Check if there's actual content to save
    const hasContent = posts.some((p) => p.text.trim().length > 0);
    if (!hasContent) return;

    // Serialize current content for comparison
    const currentContent = JSON.stringify(posts.map((p) => p.text));
    if (currentContent === lastSavedContentRef.current) return;

    // Clear existing timer
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    // Set new timer
    autosaveTimerRef.current = setTimeout(() => {
      performAutosave();
    }, AUTOSAVE_DELAY);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [posts, isOpen]);

  // Perform autosave
  const performAutosave = useCallback(async () => {
    const hasContent = posts.some((p) => p.text.trim().length > 0);
    if (!hasContent) return;

    setIsSaving(true);
    setStatus({ type: "saving", message: "Autosaving..." });

    try {
      const id = draftId || generateDraftId();
      const title =
        draftTitle ||
        posts[0].text.substring(0, 50) +
          (posts[0].text.length > 50 ? "..." : "");

      const draft: ThreadDraft = {
        id,
        title,
        content: posts.map((p) => p.text).join("\n---\n"),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        posts: posts.map((p) => p.text),
      };

      saveDraft(draft);
      setDraftId(id);
      lastSavedContentRef.current = JSON.stringify(posts.map((p) => p.text));

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

  // Add new post
  const addPost = useCallback((afterIndex?: number) => {
    const newPost: ThreadPost = { id: generatePostId(), text: "" };
    setPosts((prev) => {
      if (afterIndex !== undefined) {
        const newPosts = [...prev];
        newPosts.splice(afterIndex + 1, 0, newPost);
        return newPosts;
      }
      return [...prev, newPost];
    });

    // Focus the new post after render
    setTimeout(() => {
      const ref = textareaRefs.current.get(newPost.id);
      ref?.focus();
    }, 0);
  }, []);

  // Remove post
  const removePost = useCallback((index: number) => {
    setPosts((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one post
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  // Update post text
  const updatePost = useCallback((index: number, text: string) => {
    setPosts((prev) =>
      prev.map((post, i) => (i === index ? { ...post, text } : post)),
    );
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
      if (e.key === "Backspace" && posts[index].text === "" && index > 0) {
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

  // Post the thread
  const handlePost = useCallback(async () => {
    if (!agent) {
      setStatus({ type: "error", message: "Not logged in" });
      return;
    }

    const validPosts = posts.filter((p) => p.text.trim().length > 0);
    if (validPosts.length === 0) {
      setStatus({ type: "error", message: "No content to post" });
      return;
    }

    // Check for posts exceeding limit
    const overLimitPosts = validPosts.filter(
      (p) => p.text.length > MAX_POST_LENGTH,
    );
    if (overLimitPosts.length > 0) {
      setStatus({
        type: "error",
        message: `Some posts exceed ${MAX_POST_LENGTH} characters`,
      });
      return;
    }

    setIsPosting(true);
    setStatus({ type: "posting", message: "Posting thread..." });

    try {
      let rootPost: { uri: string; cid: string } | undefined;
      let lastPost: { uri: string; cid: string } | undefined;

      for (let i = 0; i < validPosts.length; i++) {
        setStatus({
          type: "posting",
          message: `Posting ${i + 1}/${validPosts.length}...`,
        });

        // Create rich text with facet detection
        const rt = new RichText({ text: validPosts[i].text });
        await rt.detectFacets(agent);

        const postData: {
          text: string;
          facets?: typeof rt.facets;
          reply?: {
            root: { uri: string; cid: string };
            parent: { uri: string; cid: string };
          };
        } = {
          text: rt.text,
          facets: rt.facets,
        };

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

      // Construct the Bluesky URL for the thread
      const postUrl =
        rootPost && session?.handle
          ? `https://bsky.app/profile/${session.handle}/post/${rootPost.uri.split("/").pop()}`
          : undefined;

      setStatus({ type: "success", message: "Thread posted!", postUrl });

      // Delete the draft if it exists
      if (draftId) {
        deleteDraft(draftId);
      }

      // Notify parent and close
      setTimeout(() => {
        onThreadPosted?.();
        onClose();
        // Reset state
        setPosts([{ id: generatePostId(), text: "" }]);
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
  }, [agent, session, posts, draftId, onThreadPosted, onClose]);

  // Calculate total characters
  const totalChars = posts.reduce((sum, p) => sum + p.text.length, 0);
  const validPostCount = posts.filter((p) => p.text.trim().length > 0).length;

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
        aria-labelledby="thread-composer-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-xl shadow-xl"
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
              id="thread-composer-title"
              className="text-lg font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Create Thread
            </h2>
            {status.type !== "idle" &&
              (status.type === "success" && status.postUrl ? (
                <a
                  href={status.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm hover:underline"
                  style={{ color: "var(--bsky-success)" }}
                >
                  <CheckCircle size={14} />
                  {status.message}
                  <ExternalLink size={12} />
                </a>
              ) : (
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
                  {status.message}
                </span>
              ))}
          </div>
          <div className="flex items-center gap-2">
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
              <Eye size={14} />
              Preview
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

        {/* Content */}
        <div className="bsky-scrollbar max-h-[calc(100vh-200px)] overflow-y-auto p-4 md:p-6">
          {showPreview ? (
            // Preview mode
            <div className="space-y-4">
              <h3
                className="text-sm font-medium"
                style={{ color: "var(--bsky-text-secondary)" }}
              >
                Thread Preview ({validPostCount}{" "}
                {validPostCount === 1 ? "post" : "posts"})
              </h3>
              <div className="space-y-3">
                {posts
                  .filter((p) => p.text.trim().length > 0)
                  .map((post, index) => (
                    <div
                      key={post.id}
                      className="rounded-lg border p-4"
                      style={{
                        borderColor: "var(--bsky-border-primary)",
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
                            color:
                              post.text.length > MAX_POST_LENGTH
                                ? "var(--bsky-error)"
                                : "var(--bsky-text-tertiary)",
                          }}
                        >
                          {post.text.length}/{MAX_POST_LENGTH}
                        </span>
                      </div>
                      <p
                        className="whitespace-pre-wrap"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {post.text}
                      </p>
                      {/* Link preview */}
                      <ThreadPostLinkPreview postText={post.text} />
                      {/* Quote post preview */}
                      <ThreadPostQuotePreview postText={post.text} />
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            // Edit mode
            <div className="space-y-4">
              {posts.map((post, index) => (
                <div
                  key={post.id}
                  className={`relative rounded-lg border p-4 transition-all ${
                    dragOverIndex === index ? "border-t-4" : ""
                  }`}
                  style={{
                    borderColor:
                      dragOverIndex === index
                        ? "var(--bsky-primary)"
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
                  {/* Post header */}
                  <div className="mb-2 flex items-center justify-between">
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-xs"
                        style={{
                          color:
                            post.text.length > MAX_POST_LENGTH
                              ? "var(--bsky-error)"
                              : post.text.length > MAX_POST_LENGTH * 0.9
                                ? "var(--bsky-warning)"
                                : "var(--bsky-text-tertiary)",
                        }}
                      >
                        {post.text.length}/{MAX_POST_LENGTH}
                      </span>
                      {posts.length > 1 && (
                        <button
                          onClick={() => removePost(index)}
                          className="rounded p-1 transition-colors hover:opacity-80"
                          style={{ color: "var(--bsky-error)" }}
                          aria-label="Remove post"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Textarea */}
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
                    placeholder={
                      index === 0
                        ? "Start your thread..."
                        : "Continue your thread..."
                    }
                    className="min-h-[100px] w-full resize-none rounded-lg border-none bg-transparent p-0 focus-visible:outline-none focus-visible:ring-0"
                    style={{ color: "var(--bsky-text-primary)" }}
                    maxLength={MAX_POST_LENGTH + 50} // Allow slight overflow for editing
                  />

                  {/* Add post button between posts */}
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
                        aria-label="Add post here"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

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

              {/* Keyboard hints */}
              <p
                className="text-center text-xs"
                style={{ color: "var(--bsky-text-tertiary)" }}
              >
                Tip: Press Ctrl/Cmd + Enter to add a new post, or drag to
                reorder
              </p>
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
            className="text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {validPostCount} {validPostCount === 1 ? "post" : "posts"} &bull;{" "}
            {totalChars} characters total
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={
                isSaving || !posts.some((p) => p.text.trim().length > 0)
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
              disabled={isPosting || validPostCount === 0}
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

/**
 * Link preview component for thread posts containing URLs
 */
const ThreadPostLinkPreview: React.FC<{ postText: string }> = ({
  postText,
}) => {
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = extractFirstLinkUrl(postText);

  useEffect(() => {
    if (!url) {
      setMetadata(null);
      return;
    }

    let cancelled = false;
    const fetchMetadataAsync = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLinkMetadata(url);
        if (!cancelled) {
          setMetadata(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load preview");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchMetadataAsync, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url]);

  if (!url) return null;

  if (loading) {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-lg border p-3 text-sm"
        style={{
          borderColor: "var(--bsky-border-primary)",
          color: "var(--bsky-text-secondary)",
        }}
      >
        <Loader size={14} className="animate-spin" />
        <span>Loading link preview...</span>
      </div>
    );
  }

  if (error || !metadata) {
    if (error) {
      return (
        <div
          className="mt-2 flex items-center gap-2 rounded-lg border p-3 text-sm"
          style={{
            borderColor: "var(--bsky-border-primary)",
            color: "var(--bsky-text-tertiary)",
          }}
        >
          <Link size={14} />
          <span className="truncate">{url}</span>
        </div>
      );
    }
    return null;
  }

  let domain = "";
  try {
    domain = new URL(metadata.url).hostname.replace("www.", "");
  } catch {
    domain = metadata.url;
  }

  return (
    <div
      className="mt-2 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--bsky-border-primary)" }}
    >
      {metadata.imageUrl && (
        <div
          className="h-32 w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${metadata.imageUrl})` }}
        />
      )}
      <div className="p-3">
        <div
          className="mb-1 text-xs"
          style={{ color: "var(--bsky-text-tertiary)" }}
        >
          {domain}
        </div>
        <div
          className="line-clamp-2 text-sm font-medium"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {metadata.title}
        </div>
        {metadata.description && (
          <div
            className="mt-1 line-clamp-2 text-xs"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            {metadata.description}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Quote post preview component for thread posts containing Bluesky URLs
 */
const ThreadPostQuotePreview: React.FC<{ postText: string }> = ({
  postText,
}) => {
  const { agent } = useAuth();
  const [quotedPost, setQuotedPost] = useState<AppBskyFeedDefs.PostView | null>(
    null,
  );
  const [loading, setLoading] = useState(false);

  const bskyUrl = extractFirstBskyPostUrl(postText);

  useEffect(() => {
    if (!bskyUrl) {
      setQuotedPost(null);
      return;
    }

    let cancelled = false;
    const fetchQuotedPost = async () => {
      const parsed = parseBskyUrl(bskyUrl);
      if (!parsed || !parsed.postId) return;

      if (!agent) return;

      setLoading(true);
      try {
        let did = parsed.did;
        if (!did && parsed.handle) {
          try {
            const profileResponse = await agent.getProfile({
              actor: parsed.handle,
            });
            did = profileResponse.data.did;
          } catch {
            return;
          }
        }

        if (!did) return;

        const uri = `at://${did}/app.bsky.feed.post/${parsed.postId}`;
        const response = await agent.app.bsky.feed.getPosts({ uris: [uri] });

        if (!cancelled && response.data.posts.length > 0) {
          setQuotedPost(response.data.posts[0]);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    const timer = setTimeout(fetchQuotedPost, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bskyUrl, agent]);

  if (!bskyUrl) return null;

  if (loading) {
    return (
      <div
        className="mt-2 flex items-center gap-2 rounded-lg border p-3 text-sm"
        style={{
          borderColor: "var(--bsky-border-primary)",
          color: "var(--bsky-text-secondary)",
        }}
      >
        <Loader size={14} className="animate-spin" />
        <span>Loading quoted post...</span>
      </div>
    );
  }

  if (!quotedPost) return null;

  const record = quotedPost.record as { text?: string };
  return (
    <div
      className="mt-2 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--bsky-border-primary)" }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5 text-xs"
        style={{
          backgroundColor: "var(--bsky-bg-tertiary)",
          borderBottom: "1px solid var(--bsky-border-primary)",
          color: "var(--bsky-text-secondary)",
        }}
      >
        <MessageCircle size={12} />
        <span>Quoted post</span>
      </div>
      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <ProfileHoverCard handle={quotedPost.author.handle}>
            <img
              src={quotedPost.author.avatar || "/default-avatar.svg"}
              alt=""
              className="h-5 w-5 cursor-pointer rounded-full"
            />
          </ProfileHoverCard>
          <ProfileHoverCard handle={quotedPost.author.handle}>
            <span
              className="cursor-pointer text-sm font-semibold hover:underline"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              {quotedPost.author.displayName || quotedPost.author.handle}
            </span>
          </ProfileHoverCard>
          <span
            className="text-sm"
            style={{ color: "var(--bsky-text-secondary)" }}
          >
            @{quotedPost.author.handle}
          </span>
        </div>
        <p
          className="line-clamp-3 text-sm"
          style={{ color: "var(--bsky-text-primary)" }}
        >
          {record?.text || ""}
        </p>
      </div>
    </div>
  );
};
