import { AppBskyFeedDefs } from "@atproto/api";
import { queryClient } from "@bsky/shared";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModal } from "../contexts/ModalContext";
import { useModeration } from "../contexts/ModerationContext";
import { useToast } from "../contexts/ToastContext";
import { generateShareablePostUrl } from "../hooks/usePostDeepLink";
import { moderationHistoryDB } from "../services/moderation-history-db";
import { isWebShareSupported, sharePost } from "../services/share-service";

/**
 * Helper to get the root URI of a thread.
 * For reply posts, returns the root URI from the reply record.
 * For top-level posts, returns the post URI itself.
 */
function getThreadRootUri(post: AppBskyFeedDefs.PostView): string {
  const record = post.record as
    | { reply?: { root: { uri: string } } }
    | undefined;
  return record?.reply?.root?.uri || post.uri;
}

interface PostMenuActionsProps {
  post: AppBskyFeedDefs.PostView;
  onMute?: () => void;
  onBlock?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}

/**
 * Hook that provides all action handlers for the post menu.
 * Encapsulates moderation, sharing, and content management logic.
 */
export function usePostMenuActions({
  post,
  onMute,
  onBlock,
  onDelete,
  onClose,
}: PostMenuActionsProps) {
  const { session, agent } = useAuth();
  const { hidePost, unhidePost } = useHiddenPosts();
  const {
    muteUser,
    unmuteUser,
    muteThread,
    unmuteThread,
    blockUser,
    unblockUser,
    isThreadMuted,
  } = useModeration();
  const { showDestructiveConfirm } = useModal();
  const { showToast, showUndoToast } = useToast();

  const isOwnPost = session?.did === post.author.did;
  const postRecord = post.record as { reply?: unknown } | undefined;
  const isThread = postRecord?.reply !== undefined;
  const rootUri = getThreadRootUri(post);
  const isThreadCurrentlyMuted = isThreadMuted(rootUri);

  // Fetch the current user's pinned post URI (cached, only enabled for own posts)
  const { data: ownPinnedPostUri } = useQuery({
    queryKey: ["own-pinned-post", session?.did],
    queryFn: async () => {
      if (!agent || !session?.did) return null;
      const { data } = await agent.getProfile({ actor: session.did });
      return data.pinnedPost?.uri || null;
    },
    staleTime: 60 * 1000,
    enabled: isOwnPost && !!agent && !!session?.did,
  });

  const isCurrentlyPinned = isOwnPost && ownPinnedPostUri === post.uri;

  const handleMute = async () => {
    onClose();

    if (onMute) {
      onMute();
    } else {
      if (!agent) return;

      // Optimistic update — apply mute locally
      muteUser(post.author.did);

      let resolved = false;

      const commit = async () => {
        if (resolved) return;
        resolved = true;
        try {
          await agent.mute(post.author.did);

          // Record mute to history
          try {
            await moderationHistoryDB.init();
            await moderationHistoryDB.recordMute({
              subjectDid: post.author.did,
              subjectHandle: post.author.handle,
              subjectDisplayName: post.author.displayName,
              subjectAvatar: post.author.avatar,
              createdAt: Date.now(),
            });
          } catch (historyErr) {
            console.warn("Failed to record mute to history:", historyErr);
          }
        } catch (error) {
          console.error("Failed to mute user:", error);
          unmuteUser(post.author.did);
          showToast("Failed to mute user", { type: "error" });
        }
      };

      const undo = () => {
        if (resolved) return;
        resolved = true;
        unmuteUser(post.author.did);
      };

      showUndoToast(`Muted @${post.author.handle}`, undo, commit, 5000);
    }
  };

  const handleBlock = async () => {
    onClose();
    if (onBlock) {
      onBlock();
    } else {
      if (!agent) return;

      // Block still shows confirm dialog because it's a severe action
      await showDestructiveConfirm(
        {
          title: "Block User",
          message: `Are you sure you want to block @${post.author.handle}? They won't be able to see your posts, reply to you, or interact with your content.`,
          confirmButtonLabel: "Block User",
          severity: "danger",
          canUndo: true,
          warningMessage:
            "You can undo within 5 seconds, or unblock later from settings.",
        },
        async () => {
          // Optimistic update — apply block locally
          blockUser(post.author.did);

          let resolved = false;

          const commit = async () => {
            if (resolved) return;
            resolved = true;
            try {
              if (!agent.session?.did) {
                throw new Error("No session available");
              }
              const { uri } = await agent.app.bsky.graph.block.create(
                { repo: agent.session.did },
                {
                  subject: post.author.did,
                  createdAt: new Date().toISOString(),
                },
              );

              // Record block to history
              try {
                await moderationHistoryDB.init();
                await moderationHistoryDB.recordBlock({
                  id: uri,
                  subjectDid: post.author.did,
                  subjectHandle: post.author.handle,
                  subjectDisplayName: post.author.displayName,
                  subjectAvatar: post.author.avatar,
                  createdAt: Date.now(),
                });
              } catch (historyErr) {
                console.warn("Failed to record block to history:", historyErr);
              }
            } catch (error) {
              console.error("Failed to block user:", error);
              unblockUser(post.author.did);
              showToast("Failed to block user", { type: "error" });
            }
          };

          const undo = () => {
            if (resolved) return;
            resolved = true;
            unblockUser(post.author.did);
          };

          showUndoToast(`Blocked @${post.author.handle}`, undo, commit, 5000);
        },
      );
    }
  };

  const handleDelete = async () => {
    onClose();
    if (onDelete) {
      onDelete();
    } else {
      if (!agent) return;

      // Optimistic update — hide the post immediately
      hidePost(post.uri);

      let resolved = false;

      const commit = async () => {
        if (resolved) return;
        resolved = true;
        try {
          await agent.deletePost(post.uri);
        } catch (error) {
          console.error("Failed to delete post:", error);
          unhidePost(post.uri);
          showToast("Failed to delete post", { type: "error" });
        }
      };

      const undo = () => {
        if (resolved) return;
        resolved = true;
        unhidePost(post.uri);
      };

      showUndoToast("Post deleted", undo, commit, 5000);
    }
  };

  const handleCopyLink = async () => {
    onClose();
    const postId = post.uri.split("/").pop();
    const link = `${window.location.origin}/thread/${post.author.handle}/${postId}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Link copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy link", { type: "error" });
    }
  };

  const handleCopyDeepLink = async () => {
    onClose();
    // Generate a link with fragment that scrolls to the post on the current page
    const deepLink = generateShareablePostUrl(window.location.href, post.uri);
    try {
      await navigator.clipboard.writeText(deepLink);
      showToast("Deep link copied (scrolls to post)", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy link", { type: "error" });
    }
  };

  const handleCopyBlueskyLink = async () => {
    onClose();
    const postId = post.uri.split("/").pop();
    const link = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Bluesky link copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy link", { type: "error" });
    }
  };

  const handleNativeShare = async () => {
    onClose();
    const postId = post.uri.split("/").pop();
    if (!postId) return;

    const postText = (post.record as { text?: string })?.text;
    const result = await sharePost(post.author.handle, postId, postText);

    if (result.success) {
      if (result.method === "clipboard") {
        showToast("Link copied to clipboard", {
          type: "success",
          duration: 2000,
        });
      }
      // Native share doesn't need a toast - the OS handles feedback
    } else if (result.error !== "Share cancelled") {
      showToast("Failed to share", { type: "error" });
    }
  };

  const handleEmbed = async () => {
    onClose();
    const postId = post.uri.split("/").pop();
    const embedCode = `<iframe src="https://bsky.app/profile/${post.author.handle}/post/${postId}/embed" width="500" height="350" frameborder="0"></iframe>`;
    try {
      await navigator.clipboard.writeText(embedCode);
      showToast("Embed code copied to clipboard", {
        type: "success",
        duration: 2000,
      });
    } catch {
      showToast("Failed to copy embed code", { type: "error" });
    }
  };

  const handleOpenInBluesky = () => {
    onClose();
    const postId = post.uri.split("/").pop();
    const link = `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
    window.open(link, "_blank", "noopener,noreferrer");
  };

  const handleMuteThread = async () => {
    onClose();
    // Add to local muted threads immediately for instant UI update
    muteThread(rootUri);

    try {
      if (agent) {
        await agent.api.app.bsky.graph.muteThread({
          root: rootUri,
        });
        showToast("Thread muted", {
          type: "success",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to mute thread:", error);
      showToast("Failed to mute thread", { type: "error" });
      // Revert local state on error
      unmuteThread(rootUri);
    }
  };

  const handleUnmuteThread = async () => {
    onClose();
    // Remove from local muted threads immediately for instant UI update
    unmuteThread(rootUri);

    try {
      if (agent) {
        await agent.api.app.bsky.graph.unmuteThread({
          root: rootUri,
        });
        showToast("Thread unmuted", {
          type: "success",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to unmute thread:", error);
      showToast("Failed to unmute thread", { type: "error" });
      // Revert local state on error
      muteThread(rootUri);
    }
  };

  const handleHidePost = () => {
    onClose();
    hidePost(post.uri);
    showToast("Post hidden", {
      type: "success",
      duration: 3000,
    });
  };

  const handlePinToProfile = async () => {
    onClose();
    try {
      if (!agent) return;
      await agent.upsertProfile((existing) => ({
        ...existing,
        pinnedPost: {
          uri: post.uri,
          cid: post.cid,
        },
      }));
      // Invalidate profile and pinned post queries so UI refreshes
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["pinned-post"] });
      queryClient.invalidateQueries({ queryKey: ["own-pinned-post"] });
      showToast("Post pinned to profile", {
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to pin post:", error);
      showToast("Failed to pin post", { type: "error" });
    }
  };

  const handleUnpinFromProfile = async () => {
    onClose();
    try {
      if (!agent) return;
      await agent.upsertProfile((existing) => {
        const updated = { ...existing };
        delete updated.pinnedPost;
        return updated;
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["pinned-post"] });
      queryClient.invalidateQueries({ queryKey: ["own-pinned-post"] });
      showToast("Post unpinned from profile", {
        type: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Failed to unpin post:", error);
      showToast("Failed to unpin post", { type: "error" });
    }
  };

  return {
    // Action handlers
    handleMute,
    handleBlock,
    handleDelete,
    handleCopyLink,
    handleCopyDeepLink,
    handleCopyBlueskyLink,
    handleNativeShare,
    handleEmbed,
    handleOpenInBluesky,
    handleMuteThread,
    handleUnmuteThread,
    handleHidePost,
    handlePinToProfile,
    handleUnpinFromProfile,
    // Helper functions
    isWebShareSupported,
    // Derived state
    isOwnPost,
    isThread,
    isThreadCurrentlyMuted,
    isCurrentlyPinned,
  };
}
