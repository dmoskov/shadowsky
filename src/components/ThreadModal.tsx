import { RichText, type AppBskyFeedDefs } from "@atproto/api";
import { debug } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { Loader, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useAuth } from "../contexts/AuthContext";
import { useModalSwipeBack } from "../hooks/useModalSwipeBack";
import { useVideoUploadManager } from "../hooks/useVideoUploadManager";
import { uploadBlobWithRetry } from "../utils/blob-upload";
import { EnhancedComposer } from "./EnhancedComposer";
import { ThreadViewer } from "./ThreadViewer";

interface ThreadModalProps {
  postUri: string;
  onClose: () => void;
  openToReply?: boolean; // When true, opens with the post ready to reply
  openToQuote?: boolean; // When true, opens with the post ready to quote
}

interface ReplyState {
  isReplying: boolean;
  replyToPost: AppBskyFeedDefs.PostView | null;
}

interface QuoteState {
  isQuoting: boolean;
  quotedPost: AppBskyFeedDefs.PostView | null;
}

type PostView = AppBskyFeedDefs.PostView;

export function ThreadModal({
  postUri,
  onClose,
  openToReply = false,
  openToQuote = false,
}: ThreadModalProps) {
  const { agent } = useAuth();
  const swipeHandlers = useModalSwipeBack({ onClose });
  const videoUploadManager = useVideoUploadManager(agent);
  const [replyState, setReplyState] = useState<ReplyState>({
    isReplying: openToReply,
    replyToPost: null,
  });
  const [quoteState, setQuoteState] = useState<QuoteState>({
    isQuoting: openToQuote,
    quotedPost: null,
  });

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEsc);
    // Store original overflow value
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("thread-modal-open");

    return () => {
      window.removeEventListener("keydown", handleEsc);
      // Restore original overflow value
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove("thread-modal-open");
    };
  }, [onClose]);

  const {
    data: threadData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["thread", postUri],
    queryFn: async () => {
      if (!agent) throw new Error("Not authenticated");

      try {
        const response = await agent.getPostThread({ uri: postUri, depth: 10 });
        debug.log("Thread response:", response);

        // Check the response type to provide better error messages
        const thread = response.data.thread;

        if (!thread) {
          throw new Error("Thread data is empty");
        }

        // Log the thread type for debugging
        debug.log("Thread type:", thread.$type);

        // Check for different thread view types based on official AT Protocol lexicons
        if (thread.$type === "app.bsky.feed.defs#notFoundPost") {
          throw new Error("POST_NOT_FOUND");
        }

        if (thread.$type === "app.bsky.feed.defs#blockedPost") {
          throw new Error("POST_BLOCKED");
        }

        if (thread.$type !== "app.bsky.feed.defs#threadViewPost") {
          // Log the full thread object to understand what we're getting
          debug.error("Unexpected thread type encountered:", {
            type: thread.$type,
            threadObject: thread,
            hasPost: !!(thread as any).post,
            postUri: postUri,
          });

          // Check if it might be a partial thread or have a post anyway
          if ((thread as any).post) {
            debug.log(
              "Thread has post despite unexpected type, attempting to use it",
            );
            return thread;
          }

          throw new Error(
            `INVALID_THREAD_TYPE: ${thread.$type || "undefined"}`,
          );
        }

        return thread;
      } catch (err: any) {
        debug.error("Failed to load thread:", err);

        // Re-throw with more context
        if (err.message) {
          throw err;
        }

        // Handle API errors
        if (err?.status === 400) {
          throw new Error("POST_NOT_FOUND");
        }

        throw new Error("NETWORK_ERROR");
      }
    },
    enabled: !!agent && !!postUri,
  });

  // Extract all posts from the thread structure
  const posts = React.useMemo(() => {
    if (!threadData) return [];

    const allPosts: PostView[] = [];
    const processThread = (thread: any) => {
      if (!thread) return;

      // Handle both typed and untyped thread objects
      const isThreadViewPost =
        thread.$type === "app.bsky.feed.defs#threadViewPost" ||
        (!thread.$type && thread.post); // Some responses might not have $type

      if (isThreadViewPost && thread.post) {
        allPosts.push(thread.post);

        // Process parent if exists
        if (thread.parent) {
          processThread(thread.parent);
        }

        // Process replies
        if (thread.replies && Array.isArray(thread.replies)) {
          thread.replies.forEach(processThread);
        }
      }
    };

    processThread(threadData);
    return allPosts;
  }, [threadData]);

  // Find the root post
  const rootPost = React.useMemo(() => {
    if (!threadData) return undefined;

    let current = threadData;
    while (current?.$type === "app.bsky.feed.defs#threadViewPost") {
      const threadViewPost = current as AppBskyFeedDefs.ThreadViewPost;
      if (
        threadViewPost.parent?.$type === "app.bsky.feed.defs#threadViewPost"
      ) {
        current = threadViewPost.parent;
      } else {
        break;
      }
    }

    if (current?.$type === "app.bsky.feed.defs#threadViewPost") {
      const threadViewPost = current as AppBskyFeedDefs.ThreadViewPost;
      return threadViewPost.post?.uri || postUri;
    }
    return postUri;
  }, [threadData, postUri]);

  // Set initial reply/quote state when we get the main post
  useEffect(() => {
    if (posts.length > 0) {
      const targetPost = posts.find((p) => p.uri === postUri) || posts[0];

      if (openToReply && targetPost) {
        setReplyState({
          isReplying: true,
          replyToPost: targetPost,
        });
      }

      if (openToQuote && targetPost) {
        setQuoteState({
          isQuoting: true,
          quotedPost: targetPost,
        });
      }
    }
  }, [openToReply, openToQuote, posts, postUri]);

  const handleQuotePost = async (
    text: string,
    media: any[] | undefined,
    quotedPost: AppBskyFeedDefs.PostView,
  ) => {
    if (!agent) throw new Error("Not authenticated");

    // Upload media if present
    let embed = undefined;
    if (media && media.length > 0) {
      const hasVideo = media.some((m) => m.type === "video");

      if (hasVideo) {
        // Handle video upload with proper state management
        const videoFile = media.find((m) => m.type === "video");
        if (videoFile) {
          // Convert File to Uint8Array
          const arrayBuffer = await videoFile.file.arrayBuffer();
          const videoData = new Uint8Array(arrayBuffer);

          const videoBlob = await videoUploadManager.startUpload(
            videoData,
            videoFile.file.type || "video/mp4",
            videoFile.file.name || "video.mp4",
          );

          // Check if upload was cancelled or failed
          if (!videoBlob) {
            const error = videoUploadManager.uploadState.error;
            if (error) {
              throw new Error(error.message);
            }
            throw new Error("Video upload was cancelled");
          }

          embed = {
            $type: "app.bsky.embed.video",
            video: videoBlob.blob,
            aspectRatio: videoBlob.aspectRatio,
          };
        }
      } else {
        // Handle image uploads
        const images = await Promise.all(
          media
            .filter((m) => m.type === "image")
            .map(async (img) => {
              const response = await uploadBlobWithRetry(agent, img.file, {
                encoding: "image/jpeg",
              });
              return {
                alt: img.alt || "",
                image: response.data.blob,
                aspectRatio: undefined, // Let Bluesky determine this
              };
            }),
        );

        if (images.length > 0) {
          embed = {
            $type: "app.bsky.embed.images",
            images,
          };
        }
      }
    }

    // Create quote post embed
    const quoteEmbed = embed
      ? {
          $type: "app.bsky.embed.recordWithMedia",
          record: {
            $type: "app.bsky.embed.record",
            record: {
              uri: quotedPost.uri,
              cid: quotedPost.cid,
            },
          },
          media: embed,
        }
      : {
          $type: "app.bsky.embed.record",
          record: {
            uri: quotedPost.uri,
            cid: quotedPost.cid,
          },
        };

    // Detect facets (mentions, links, hashtags) in the text
    const rt = new RichText({ text: text.trim() });
    await rt.detectFacets(agent);

    const record = {
      text: rt.text,
      facets: rt.facets,
      embed: quoteEmbed,
      createdAt: new Date().toISOString(),
    };

    await agent.post(record);

    // Close composer after successful post
    setQuoteState({
      isQuoting: false,
      quotedPost: null,
    });

    // Close the modal
    onClose();
  };

  const handleReply = async (text: string, media?: any[]) => {
    if (!agent) throw new Error("Not authenticated");

    // Handle quote post
    if (quoteState.isQuoting && quoteState.quotedPost) {
      return handleQuotePost(text, media, quoteState.quotedPost);
    }

    // Handle regular reply
    if (!replyState.replyToPost || !rootPost)
      throw new Error("Missing required context");

    const replyPost = replyState.replyToPost;
    const rootCid = posts.find((p) => p.uri === rootPost)?.cid || replyPost.cid;

    // Upload media if present
    let embed = undefined;
    if (media && media.length > 0) {
      const hasVideo = media.some((m) => m.type === "video");

      if (hasVideo) {
        // Handle video upload with proper state management
        const videoFile = media.find((m) => m.type === "video");
        if (videoFile) {
          // Convert File to Uint8Array
          const arrayBuffer = await videoFile.file.arrayBuffer();
          const videoData = new Uint8Array(arrayBuffer);

          const videoBlob = await videoUploadManager.startUpload(
            videoData,
            videoFile.file.type || "video/mp4",
            videoFile.file.name || "video.mp4",
          );

          // Check if upload was cancelled or failed
          if (!videoBlob) {
            const error = videoUploadManager.uploadState.error;
            if (error) {
              throw new Error(error.message);
            }
            throw new Error("Video upload was cancelled");
          }

          embed = {
            $type: "app.bsky.embed.video",
            video: videoBlob.blob,
            aspectRatio: videoBlob.aspectRatio,
          };
        }
      } else {
        // Handle image uploads
        const images = await Promise.all(
          media
            .filter((m) => m.type === "image")
            .map(async (img) => {
              const response = await uploadBlobWithRetry(agent, img.file, {
                encoding: "image/jpeg",
              });
              return {
                alt: img.alt || "",
                image: response.data.blob,
                aspectRatio: undefined, // Let Bluesky determine this
              };
            }),
        );

        if (images.length > 0) {
          embed = {
            $type: "app.bsky.embed.images",
            images,
          };
        }
      }
    }

    // Detect facets (mentions, links, hashtags) in the text
    const rt = new RichText({ text: text.trim() });
    await rt.detectFacets(agent);

    const record = {
      text: rt.text,
      facets: rt.facets,
      reply: {
        root: { uri: rootPost, cid: rootCid },
        parent: { uri: replyPost.uri, cid: replyPost.cid },
      },
      embed,
      createdAt: new Date().toISOString(),
    };

    await agent.post(record);
    refetch(); // Refresh the thread to show the new reply

    // Close reply composer after successful post
    setReplyState({
      isReplying: false,
      replyToPost: null,
    });
  };

  return ReactDOM.createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-black/70" onClick={onClose} />

      <div
        {...swipeHandlers}
        className="thread-modal-container fixed inset-0 z-[101] flex items-center justify-center p-4 md:p-8"
      >
        <div
          className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{ backgroundColor: "var(--bsky-bg-primary)" }}
        >
          {/* Header with close button */}
          <div
            className="flex flex-shrink-0 items-center justify-between border-b p-6"
            style={{
              backgroundColor: "var(--bsky-bg-primary)",
              borderColor: "var(--bsky-border-primary)",
            }}
          >
            <h2
              className="text-xl font-semibold"
              style={{ color: "var(--bsky-text-primary)" }}
            >
              Thread
            </h2>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="rounded-full p-2 transition-all hover:scale-110 hover:bg-gray-100 dark:hover:bg-gray-800"
              style={{ color: "var(--bsky-text-secondary)" }}
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          {/* Scrollable content */}
          <div
            className="bsky-scrollbar flex-1 overflow-y-auto"
            style={{ minHeight: 0 }}
          >
            <div className="mx-auto max-w-3xl p-4 md:p-8">
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader
                    className="animate-spin"
                    size={32}
                    style={{ color: "var(--bsky-primary)" }}
                  />
                </div>
              )}

              {error && (
                <div className="py-8 text-center">
                  <div className="mx-auto max-w-md space-y-4">
                    <div
                      className="rounded-lg p-6"
                      style={{ backgroundColor: "var(--bsky-bg-secondary)" }}
                    >
                      <p
                        className="mb-2 text-lg font-medium"
                        style={{ color: "var(--bsky-text-primary)" }}
                      >
                        {error.message === "POST_NOT_FOUND"
                          ? "Post Not Found"
                          : error.message === "POST_BLOCKED"
                            ? "Content Blocked"
                            : error.message.startsWith("INVALID_THREAD_TYPE")
                              ? "Unable to Display Thread"
                              : error.message === "NETWORK_ERROR"
                                ? "Connection Error"
                                : "Failed to Load Thread"}
                      </p>
                      <p
                        className="text-sm"
                        style={{ color: "var(--bsky-text-secondary)" }}
                      >
                        {error.message === "POST_NOT_FOUND"
                          ? "This post may have been deleted or is no longer available."
                          : error.message === "POST_BLOCKED"
                            ? "This content has been blocked and cannot be displayed."
                            : error.message.startsWith("INVALID_THREAD_TYPE")
                              ? "The thread format is not supported or may be corrupted."
                              : error.message === "NETWORK_ERROR"
                                ? "Please check your connection and try again."
                                : "An unexpected error occurred while loading the thread."}
                      </p>

                      {/* Debug info when debug mode is enabled */}
                      {localStorage.getItem("debug") === "true" && (
                        <details className="mt-4">
                          <summary
                            className="cursor-pointer text-xs"
                            style={{ color: "var(--bsky-text-tertiary)" }}
                          >
                            Debug Info
                          </summary>
                          <pre className="mt-2 overflow-x-auto rounded bg-black/10 p-2 text-xs">
                            {JSON.stringify(
                              {
                                error: error.message,
                                errorType: error.message.startsWith(
                                  "INVALID_THREAD_TYPE",
                                )
                                  ? error.message.split(": ")[1]
                                  : undefined,
                                postUri,
                                timestamp: new Date().toISOString(),
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      )}

                      {/* Retry button for network errors */}
                      {(error.message === "NETWORK_ERROR" ||
                        error.message === "Thread data is empty") && (
                        <button
                          onClick={() => refetch()}
                          className="mt-4 rounded-lg px-4 py-2 text-sm font-medium transition-colors hover:opacity-80"
                          style={{
                            backgroundColor: "var(--bsky-primary)",
                            color: "white",
                          }}
                        >
                          Try Again
                        </button>
                      )}
                    </div>

                    <button
                      onClick={onClose}
                      className="text-sm underline"
                      style={{ color: "var(--bsky-text-tertiary)" }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}

              {posts.length > 0 && (
                <ThreadViewer
                  posts={posts}
                  rootUri={rootPost}
                  highlightUri={postUri}
                  showUnreadIndicators={false}
                  className="w-full"
                  onPostClick={(clickedPost, action) => {
                    const post =
                      posts.find((p) => p.uri === clickedPost.uri) || null;

                    if (action === "reply") {
                      // When user clicks reply on a post in the thread
                      setReplyState({
                        isReplying: true,
                        replyToPost: post,
                      });
                      setQuoteState({
                        isQuoting: false,
                        quotedPost: null,
                      });
                    } else if (action === "quote") {
                      // When user clicks quote on a post in the thread
                      setQuoteState({
                        isQuoting: true,
                        quotedPost: post,
                      });
                      setReplyState({
                        isReplying: false,
                        replyToPost: null,
                      });
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Enhanced composer at the bottom - visible when replying or quoting */}
          {posts.length > 0 &&
            ((replyState.isReplying && replyState.replyToPost) ||
              (quoteState.isQuoting && quoteState.quotedPost)) && (
              <div
                className="flex-shrink-0 border-t"
                style={{
                  backgroundColor: "var(--bsky-bg-secondary)",
                  borderColor: "var(--bsky-border-primary)",
                }}
              >
                <div className="mx-auto max-w-3xl p-4 md:p-6">
                  <EnhancedComposer
                    onSubmit={handleReply}
                    placeholder={
                      quoteState.isQuoting
                        ? "Add your thoughts..."
                        : "Add your reply..."
                    }
                    autoFocus={true}
                    replyTo={
                      replyState.isReplying && replyState.replyToPost
                        ? {
                            uri: replyState.replyToPost.uri,
                            cid: replyState.replyToPost.cid,
                            author: {
                              handle: replyState.replyToPost.author.handle,
                              displayName:
                                replyState.replyToPost.author.displayName,
                            },
                            text: (replyState.replyToPost.record as any)?.text,
                          }
                        : undefined
                    }
                    parentPost={
                      replyState.isReplying && replyState.replyToPost
                        ? replyState.replyToPost
                        : undefined
                    }
                    quotedPost={
                      quoteState.isQuoting && quoteState.quotedPost
                        ? quoteState.quotedPost
                        : undefined
                    }
                    features={{
                      media: true,
                      emoji: true,
                      giphy: true,
                      altTextGeneration: true,
                      shortcuts: true,
                      hashtags: true,
                      threadOptimization: false,
                    }}
                    showReplyContext={replyState.isReplying}
                    submitLabel={quoteState.isQuoting ? "Quote" : "Reply"}
                    onCancel={() => {
                      setReplyState({
                        isReplying: false,
                        replyToPost: null,
                      });
                      setQuoteState({
                        isQuoting: false,
                        quotedPost: null,
                      });
                    }}
                  />
                </div>
              </div>
            )}
        </div>
      </div>
    </>,
    document.body,
  );
}
