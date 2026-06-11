/**
 * NarrativePostsModal
 *
 * Shows the actual posts Pan classified into a trending narrative/topic —
 * the classifier's own cluster, not a keyword search. Falls back to a
 * search link for broader exploration.
 */

import type { AppBskyFeedDefs } from "@atproto/api";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "./ui/Modal";
import { PostRenderer } from "./PostRenderer";

interface Props {
  topic: string;
  postUris: string[];
  isOpen: boolean;
  onClose: () => void;
}

export function NarrativePostsModal({
  topic,
  postUris,
  isOpen,
  onClose,
}: Props) {
  const { agent } = useAuth();
  const navigate = useNavigate();

  const { data: posts, isLoading } = useQuery({
    queryKey: ["narrative-posts", postUris],
    enabled: isOpen && !!agent && postUris.length > 0,
    queryFn: async () => {
      const res = await agent!.app.bsky.feed.getPosts({
        uris: postUris.slice(0, 25),
      });
      return res.data.posts as AppBskyFeedDefs.PostView[];
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      {(close) => (
        <>
          <ModalHeader>
            <ModalTitle>Conversation: “{topic}”</ModalTitle>
          </ModalHeader>
          <ModalBody>
            <p className="mb-3 text-xs text-asph-text-tertiary">
              Posts the network-weather classifier grouped into this topic.
            </p>
            {isLoading && (
              <p className="py-8 text-center text-sm text-asph-text-secondary">
                Loading posts…
              </p>
            )}
            {!isLoading && (!posts || posts.length === 0) && (
              <p className="py-8 text-center text-sm text-asph-text-secondary">
                These posts are no longer available.
              </p>
            )}
            <div className="divide-y divide-asph-border-light">
              {posts?.map((post) => (
                <PostRenderer
                  key={post.uri}
                  post={post}
                  compact
                  showActions={false}
                />
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <button
              className="asph-button asph-button-ghost"
              onClick={() => {
                close();
                navigate(`/search?q=${encodeURIComponent(topic)}`);
              }}
            >
              Search “{topic}”
            </button>
            <button
              className="asph-button asph-button-secondary"
              onClick={close}
            >
              Close
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
