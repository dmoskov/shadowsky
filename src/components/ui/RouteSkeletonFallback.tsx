import React from "react";
import { useLocation } from "react-router";
import {
  AnalyticsSkeleton,
  BookmarksSkeleton,
  ComposerSkeleton,
  HomeSkeleton,
  ListsSkeleton,
  MessagesSkeleton,
  NotificationsSkeleton,
  ProfileSkeleton,
  SearchSkeleton,
  SettingsSkeleton,
  ThreadSkeleton,
} from "./RouteSkeleton";

/**
 * Route-aware skeleton fallback for Suspense boundaries.
 * Detects the current route and renders the appropriate skeleton.
 */
export const RouteSkeletonFallback: React.FC = () => {
  const location = useLocation();
  const pathname = location.pathname;

  // Match route patterns and return appropriate skeleton
  if (pathname === "/" || pathname === "/home") {
    return <HomeSkeleton />;
  }

  if (pathname === "/timeline") {
    return <HomeSkeleton />;
  }

  if (pathname === "/notifications") {
    return <NotificationsSkeleton />;
  }

  if (pathname === "/analytics" || pathname === "/analytics/notifications") {
    return <AnalyticsSkeleton />;
  }

  if (pathname === "/messages") {
    return <MessagesSkeleton />;
  }

  if (pathname === "/bookmarks") {
    return <BookmarksSkeleton />;
  }

  if (pathname === "/lists" || pathname.startsWith("/lists/")) {
    return <ListsSkeleton />;
  }

  if (pathname === "/search") {
    return <SearchSkeleton />;
  }

  if (pathname === "/compose") {
    return <ComposerSkeleton />;
  }

  if (pathname === "/scheduled") {
    return <BookmarksSkeleton />;
  }

  if (pathname.startsWith("/profile/")) {
    return <ProfileSkeleton showBanner={true} />;
  }

  if (pathname.startsWith("/thread/")) {
    return <ThreadSkeleton />;
  }

  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return <SettingsSkeleton />;
  }

  // Default fallback for unknown routes - use home skeleton
  return <HomeSkeleton />;
};
