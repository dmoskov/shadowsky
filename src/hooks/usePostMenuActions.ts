import { AppBskyFeedDefs } from "@atproto/api";
import { useAuth } from "../contexts/AuthContext";
import { useHiddenPosts } from "../contexts/HiddenPostsContext";
import { useModal } from "../contexts/ModalContext";
import { useModeration } from "../contexts/ModerationContext";
import { useToast } from "../contexts/ToastContext";
import { generateShareablePostUrl } from "../hooks/usePostDeepLink";
import { moderationHistoryDB } from "../services/moderation-history-db";
import { isWebShareSupported, sharePost } from "../services/share-service";

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
  const { hidePost } = useHiddenPosts();
  const { muteUser, muteThread, blockUser } = useModeration();
  const { showDestructiveConfirm } = useModal();
  const { showToast } = useToast();

  const isOwnPost = session?.did === post.author.did;
  const postRecord = post.record as any;
  const isThread = postRecord?.reply !== undefined;

  const handleMute = async () => {
    onClose();
    // Add to local muted users immediately for instant UI update
    muteUser(post.author.did);

    if (onMute) {
      onMute();
    } else {
      // Default implementation
      try {
        if (agent) {
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

          showToast(`Muted @${post.author.handle}`, {
            type: "success",
            duration: 3000,
          });
        }
      } catch (error) {
        console.error("Failed to mute user:", error);
        showToast("Failed to mute user", { type: "error" });
      }
    }
  };

  const handleBlock = async () => {
    onClose();
    if (onBlock) {
      onBlock();
    } else {
      // Default implementation
      if (agent) {
        await showDestructiveConfirm(
          {
            title: "Block User",
            message: `Are you sure you want to block @${post.author.handle}? They won't be able to see your posts, reply to you, or interact with your content.`,
            confirmButtonLabel: "Block User",
            severity: "danger",
            canUndo: true,
            warningMessage:
              "You can unblock this user later from your settings.",
          },
          async () => {
            try {
              // Add to local blocked users immediately for instant UI update
              blockUser(post.author.did);

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

              showToast(`Blocked @${post.author.handle}`, {
                type: "success",
                duration: 3000,
              });
            } catch (error) {
              console.error("Failed to block user:", error);
              showToast("Failed to block user", { type: "error" });
            }
          },
        );
      }
    }
  };

  const handleDelete = async () => {
    onClose();
    if (onDelete) {
      onDelete();
    } else {
      // Default implementation
      await showDestructiveConfirm(
        {
          title: "Delete Post",
          message:
            "Are you sure you want to delete this post? This will remove it from your profile and timeline.",
          confirmButtonLabel: "Delete Post",
          severity: "danger",
          canUndo: false,
          warningMessage: "This action cannot be undone.",
        },
        async () => {
          try {
            if (agent) {
              await agent.deletePost(post.uri);
              showToast("Post deleted", {
                type: "success",
                duration: 3000,
              });
            }
          } catch (error) {
            console.error("Failed to delete post:", error);
            showToast("Failed to delete post", { type: "error" });
          }
        },
      );
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
    muteThread(post.uri);

    try {
      if (agent) {
        await agent.api.app.bsky.graph.muteThread({
          root: post.uri,
        });
        showToast("Thread muted", {
          type: "success",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to mute thread:", error);
      showToast("Failed to mute thread", { type: "error" });
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
    handleHidePost,
    // Helper functions
    isWebShareSupported,
    // Derived state
    isOwnPost,
    isThread,
  };
}
