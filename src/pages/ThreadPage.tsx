import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ThreadModal } from "../components/ThreadModal";
import { useAuth } from "../contexts/AuthContext";
import { useViewTransitionNavigate } from "../hooks/useViewTransitionNavigate";
import { constructAtUri } from "../utils/url-helpers";

export default function ThreadPage() {
  const { handle, postId } = useParams<{ handle: string; postId: string }>();
  const navigate = useViewTransitionNavigate();
  const { agent } = useAuth();
  const [postUri, setPostUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveHandleAndConstructUri = async () => {
      if (!handle || !postId || !agent) {
        setLoading(false);
        return;
      }

      try {
        // Check if the handle is already a DID
        if (handle.startsWith("did:")) {
          setPostUri(constructAtUri(handle, postId));
        } else {
          // Resolve handle to DID
          const response = await agent.resolveHandle({ handle });
          const did = response.data.did;
          setPostUri(constructAtUri(did, postId));
        }
      } catch (error) {
        console.error("Failed to resolve handle:", error);
        // If resolution fails, try to construct URI with handle anyway
        // (might work if it's actually a DID)
        setPostUri(constructAtUri(handle, postId));
      } finally {
        setLoading(false);
      }
    };

    resolveHandleAndConstructUri();
  }, [handle, postId, agent]);

  const handleClose = () => {
    navigate(-1);
  };

  if (loading || !postUri) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  return (
    <div style={{ viewTransitionName: "vt-post-hero" }}>
      <ThreadModal
        postUri={postUri}
        openToReply={false}
        onClose={handleClose}
      />
    </div>
  );
}
