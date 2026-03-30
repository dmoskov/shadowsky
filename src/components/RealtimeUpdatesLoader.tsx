import { useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFollowing } from "../hooks/useFollowing";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";

/**
 * Silently connects to Jetstream for real-time updates.
 * No UI — just wires up auth + following data to useRealtimeUpdates.
 */
export const RealtimeUpdatesLoader: React.FC = () => {
  const { session } = useAuth();
  const { data: followingSet } = useFollowing();

  const followedDids = useMemo(
    () => (followingSet ? Array.from(followingSet) : []),
    [followingSet],
  );

  useRealtimeUpdates({
    userDid: session?.did ?? "",
    followedDids,
    autoConnect: !!session?.did,
  });

  return null;
};
