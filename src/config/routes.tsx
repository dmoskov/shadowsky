import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { RouteSkeletonFallback } from "../components/ui/RouteSkeletonFallback";

// Static imports for core components (no lazy loading - more reliable)
import { Bookmarks } from "../components/Bookmarks";
import { Composer } from "../components/Composer";
import { DirectMessages } from "../components/DirectMessages";
import { Discover } from "../components/Discover";
import { Lists } from "../components/Lists";
import { ListTimeline } from "../components/ListTimeline";
import { Notifications } from "../components/Notifications";
import { NotificationsAnalytics } from "../components/NotificationsAnalytics";
import { ScheduledPosts } from "../components/ScheduledPosts";
import { SearchTabbed as Search } from "../components/SearchTabbed";
import { default as SkyDeck } from "../components/SkyDeck";
import { VisualTimeline } from "../components/VisualTimeline";
import { AddAccountPage } from "../pages/AddAccountPage";
import { default as ProfilePage } from "../pages/ProfilePage";
import { Settings } from "../pages/Settings";
import { default as ThreadPage } from "../pages/ThreadPage";
import { UserAnalytics } from "../pages/UserAnalytics";

// Lazy loaded dev tools
const CompressionTest = lazy(() =>
  import("../components/CompressionTest").then((m) => ({
    default: m.CompressionTest,
  })),
);

// Wrapper components that use route params as keys to force remount on navigation
// This ensures all component state resets when navigating between different items
function ProfilePageWithKey() {
  const { handle } = useParams<{ handle: string }>();
  return <ProfilePage key={handle} />;
}

function ThreadPageWithKey() {
  const { handle, postId } = useParams<{ handle: string; postId: string }>();
  return <ThreadPage key={`${handle}/${postId}`} />;
}

function ListTimelineWithKey() {
  const { listId } = useParams<{ listId: string }>();
  return <ListTimeline key={listId} />;
}

/**
 * Application routes configuration
 * Centralized route definitions for easier maintenance and overview
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<RouteSkeletonFallback />}>
      <Routes>
        <Route
          path="/home"
          element={
            <ErrorBoundary componentName="SkyDeck">
              <SkyDeck />
            </ErrorBoundary>
          }
        />
        <Route
          path="/"
          element={
            <ErrorBoundary componentName="SkyDeck">
              <SkyDeck />
            </ErrorBoundary>
          }
        />
        <Route
          path="/timeline"
          element={
            <ErrorBoundary componentName="Visual Timeline">
              <VisualTimeline />
            </ErrorBoundary>
          }
        />
        <Route
          path="/analytics"
          element={
            <ErrorBoundary componentName="User Analytics">
              <UserAnalytics />
            </ErrorBoundary>
          }
        />
        <Route
          path="/analytics/notifications"
          element={
            <ErrorBoundary componentName="Notifications Analytics">
              <NotificationsAnalytics />
            </ErrorBoundary>
          }
        />
        <Route
          path="/notifications"
          element={
            <ErrorBoundary componentName="Notifications">
              <Notifications />
            </ErrorBoundary>
          }
        />
        <Route
          path="/messages"
          element={
            <ErrorBoundary componentName="Direct Messages">
              <DirectMessages />
            </ErrorBoundary>
          }
        />
        <Route
          path="/bookmarks"
          element={
            <ErrorBoundary componentName="Bookmarks">
              <Bookmarks />
            </ErrorBoundary>
          }
        />
        <Route
          path="/discover"
          element={
            <ErrorBoundary componentName="Discover">
              <Discover />
            </ErrorBoundary>
          }
        />
        <Route
          path="/lists"
          element={
            <ErrorBoundary componentName="Lists">
              <Lists />
            </ErrorBoundary>
          }
        />
        <Route
          path="/lists/:listId"
          element={
            <ErrorBoundary componentName="List Timeline">
              <ListTimelineWithKey />
            </ErrorBoundary>
          }
        />
        <Route
          path="/compose"
          element={
            <ErrorBoundary componentName="Composer">
              <Composer />
            </ErrorBoundary>
          }
        />
        <Route
          path="/search"
          element={
            <ErrorBoundary componentName="Search">
              <Search />
            </ErrorBoundary>
          }
        />
        <Route
          path="/scheduled"
          element={
            <ErrorBoundary componentName="Scheduled Posts">
              <ScheduledPosts />
            </ErrorBoundary>
          }
        />
        <Route
          path="/profile/:handle"
          element={
            <ErrorBoundary componentName="Profile">
              <ProfilePageWithKey />
            </ErrorBoundary>
          }
        />
        <Route
          path="/thread/:handle/:postId"
          element={
            <ErrorBoundary componentName="Thread">
              <ThreadPageWithKey />
            </ErrorBoundary>
          }
        />
        <Route
          path="/settings"
          element={
            <ErrorBoundary componentName="Settings">
              <Settings />
            </ErrorBoundary>
          }
        />
        <Route
          path="/settings/:section"
          element={
            <ErrorBoundary componentName="Settings">
              <Settings />
            </ErrorBoundary>
          }
        />
        <Route
          path="/compression-test"
          element={
            <ErrorBoundary componentName="CompressionTest">
              <CompressionTest />
            </ErrorBoundary>
          }
        />
        <Route
          path="/add-account"
          element={
            <ErrorBoundary componentName="Add Account">
              <AddAccountPage />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </Suspense>
  );
}
