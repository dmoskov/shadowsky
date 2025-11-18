import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { getModerationService } from "../services/moderation-service";

export function useModerationPreferences() {
  const { agent } = useAuth();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["moderationPreferences"],
    queryFn: async () => {
      if (!agent) return null;
      const service = getModerationService(agent);
      return await service.loadPreferences();
    },
    enabled: !!agent,
    staleTime: 1000 * 60 * 5,
  });

  const shouldFilterPost = (post: any) => {
    if (!agent) return { filtered: false };
    const service = getModerationService(agent);
    return service.shouldFilterPost(post);
  };

  const shouldFilterFeedItem = (feedItem: any) => {
    if (!agent) return { filtered: false };
    const service = getModerationService(agent);
    return service.shouldFilterFeedItem(feedItem);
  };

  const shouldBlurMedia = (labels?: Array<{ val: string }>) => {
    if (!agent) return false;
    const service = getModerationService(agent);
    return service.shouldBlurMedia(labels);
  };

  const shouldHideMedia = (labels?: Array<{ val: string }>) => {
    if (!agent) return false;
    const service = getModerationService(agent);
    return service.shouldHideMedia(labels);
  };

  const getSensitiveWarningText = (labels?: Array<{ val: string }>) => {
    if (!agent) return "Sensitive Content";
    const service = getModerationService(agent);
    return service.getSensitiveWarningText(labels);
  };

  return {
    preferences,
    isLoading,
    shouldFilterPost,
    shouldFilterFeedItem,
    shouldBlurMedia,
    shouldHideMedia,
    getSensitiveWarningText,
  };
}
