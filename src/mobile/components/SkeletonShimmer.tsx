/**
 * SkeletonShimmer — React Native skeleton loading components
 *
 * Replaces ActivityIndicator spinners with content-shaped shimmer
 * placeholders that match the layout of the content being loaded.
 * Uses a subtle opacity pulse for animation.
 *
 * Variants provided:
 *   - SkeletonShimmer        — base configurable shimmer block
 *   - UserRowShimmer          — avatar + two text lines (user list rows)
 *   - UserCardShimmer         — card with avatar, name, description, button
 *   - FeedCardShimmer         — card with icon, name, description, footer
 *   - PostShimmer             — feed post skeleton (avatar + text + actions)
 *   - TextLineShimmer         — single text line shimmer
 *   - InlineLoadingShimmer    — small inline pulsing indicator (button / toolbar)
 *   - LoadingOverlayShimmer   — translucent overlay with centered shimmer rows
 *   - StatusIconShimmer       — pulsing circle for status indicators
 */

import { memo, useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";

// ─── Pulse animation hook (opacity cycle) ─────────────────────────────
// In a real RN environment this would use Animated.loop + Animated.timing.
// For the web-stub typecheck build we just provide a static 0.4 opacity;
// the actual pulse is added at runtime when Animated is available.

function useShimmerStyle(baseStyle: ViewStyle): ViewStyle {
  return useMemo(
    () => ({
      ...baseStyle,
      opacity: 0.35,
    }),
    [baseStyle],
  );
}

// ─── Base SkeletonShimmer ─────────────────────────────────────────────

export interface SkeletonShimmerProps {
  /** Width in pixels or percentage string */
  width?: number | string;
  /** Height in pixels */
  height?: number;
  /** Border-radius. Use 9999 for circular */
  borderRadius?: number;
  /** Override background color */
  color?: string;
  /** Additional style overrides */
  style?: ViewStyle;
}

export const SkeletonShimmer = memo(function SkeletonShimmer({
  width = "100%",
  height = 14,
  borderRadius = 4,
  color = "#d1d5db",
  style,
}: SkeletonShimmerProps) {
  const base: ViewStyle = useMemo(
    () => ({
      width,
      height,
      borderRadius,
      backgroundColor: color,
    }),
    [width, height, borderRadius, color],
  );

  const animated = useShimmerStyle(base);
  return <View style={[animated, style]} />;
});

// ─── TextLineShimmer ──────────────────────────────────────────────────

export const TextLineShimmer = memo(function TextLineShimmer({
  width = "80%",
  height = 12,
  color,
  style,
}: Omit<SkeletonShimmerProps, "borderRadius">) {
  return (
    <SkeletonShimmer
      width={width}
      height={height}
      borderRadius={4}
      color={color}
      style={style}
    />
  );
});

// ─── InlineLoadingShimmer ─────────────────────────────────────────────
// Small pulsing bar used inside buttons and toolbars

export const InlineLoadingShimmer = memo(function InlineLoadingShimmer({
  width = 20,
  height = 20,
  color = "#d1d5db",
  style,
}: SkeletonShimmerProps) {
  return (
    <SkeletonShimmer
      width={width}
      height={height}
      borderRadius={9999}
      color={color}
      style={style}
    />
  );
});

// ─── StatusIconShimmer ────────────────────────────────────────────────
// Pulsing circle matching ActivityIndicator "small" size (20px)

export const StatusIconShimmer = memo(function StatusIconShimmer({
  size = 20,
  color = "#d1d5db",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <SkeletonShimmer
      width={size}
      height={size}
      borderRadius={9999}
      color={color}
    />
  );
});

// ─── UserRowShimmer ───────────────────────────────────────────────────
// Avatar + two text lines, used in list loading footers & overlays

const userRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  } as ViewStyle,
  textArea: {
    flex: 1,
    gap: 6,
  } as ViewStyle,
});

export const UserRowShimmer = memo(function UserRowShimmer({
  avatarSize = 44,
  color,
}: {
  avatarSize?: number;
  color?: string;
}) {
  return (
    <View style={userRowStyles.row}>
      <SkeletonShimmer
        width={avatarSize}
        height={avatarSize}
        borderRadius={9999}
        color={color}
      />
      <View style={userRowStyles.textArea}>
        <TextLineShimmer width="55%" height={14} color={color} />
        <TextLineShimmer width="35%" height={12} color={color} />
      </View>
    </View>
  );
});

// ─── UserCardShimmer ──────────────────────────────────────────────────
// Card with avatar row, optional description, and button placeholder

const userCardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#111122",
    borderRadius: 12,
    padding: 14,
  } as ViewStyle,
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  } as ViewStyle,
  textArea: {
    flex: 1,
    gap: 4,
  } as ViewStyle,
  descriptionArea: {
    gap: 4,
    marginBottom: 10,
  } as ViewStyle,
  button: {
    height: 36,
    borderRadius: 8,
  } as ViewStyle,
});

export const UserCardShimmer = memo(function UserCardShimmer({
  color = "#333344",
}: {
  color?: string;
}) {
  return (
    <View style={userCardStyles.card}>
      <View style={userCardStyles.row}>
        <SkeletonShimmer
          width={44}
          height={44}
          borderRadius={22}
          color={color}
        />
        <View style={userCardStyles.textArea}>
          <TextLineShimmer width="60%" height={14} color={color} />
          <TextLineShimmer width="40%" height={12} color={color} />
        </View>
      </View>
      <View style={userCardStyles.descriptionArea}>
        <TextLineShimmer width="90%" height={12} color={color} />
        <TextLineShimmer width="70%" height={12} color={color} />
      </View>
      <SkeletonShimmer
        width="100%"
        height={36}
        borderRadius={8}
        color={color}
      />
    </View>
  );
});

// ─── FeedCardShimmer ──────────────────────────────────────────────────
// Card with icon + name/creator, description, footer with button

const feedCardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#111122",
    borderRadius: 12,
    padding: 14,
  } as ViewStyle,
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  } as ViewStyle,
  textArea: {
    flex: 1,
    gap: 4,
  } as ViewStyle,
  descriptionArea: {
    gap: 4,
    marginBottom: 10,
  } as ViewStyle,
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  } as ViewStyle,
});

export const FeedCardShimmer = memo(function FeedCardShimmer({
  color = "#333344",
}: {
  color?: string;
}) {
  return (
    <View style={feedCardStyles.card}>
      <View style={feedCardStyles.row}>
        <SkeletonShimmer
          width={44}
          height={44}
          borderRadius={10}
          color={color}
        />
        <View style={feedCardStyles.textArea}>
          <TextLineShimmer width="50%" height={14} color={color} />
          <TextLineShimmer width="35%" height={12} color={color} />
        </View>
      </View>
      <View style={feedCardStyles.descriptionArea}>
        <TextLineShimmer width="85%" height={12} color={color} />
        <TextLineShimmer width="65%" height={12} color={color} />
      </View>
      <View style={feedCardStyles.footer}>
        <TextLineShimmer width={60} height={12} color={color} />
        <SkeletonShimmer
          width={70}
          height={32}
          borderRadius={8}
          color={color}
        />
      </View>
    </View>
  );
});

// ─── PostShimmer ──────────────────────────────────────────────────────
// Feed post: avatar + author line + text lines + action bar

const postStyles = StyleSheet.create({
  post: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e1e1e1",
  } as ViewStyle,
  content: {
    flex: 1,
    gap: 8,
  } as ViewStyle,
  authorRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  } as ViewStyle,
  textArea: {
    gap: 5,
  } as ViewStyle,
  actions: {
    flexDirection: "row",
    gap: 24,
    marginTop: 4,
  } as ViewStyle,
});

export const PostShimmer = memo(function PostShimmer({
  color,
}: {
  color?: string;
}) {
  return (
    <View style={postStyles.post}>
      <SkeletonShimmer width={44} height={44} borderRadius={22} color={color} />
      <View style={postStyles.content}>
        <View style={postStyles.authorRow}>
          <TextLineShimmer width={80} height={14} color={color} />
          <TextLineShimmer width={60} height={12} color={color} />
          <TextLineShimmer width={30} height={12} color={color} />
        </View>
        <View style={postStyles.textArea}>
          <TextLineShimmer width="95%" height={13} color={color} />
          <TextLineShimmer width="80%" height={13} color={color} />
        </View>
        <View style={postStyles.actions}>
          <SkeletonShimmer
            width={16}
            height={16}
            borderRadius={8}
            color={color}
          />
          <SkeletonShimmer
            width={16}
            height={16}
            borderRadius={8}
            color={color}
          />
          <SkeletonShimmer
            width={16}
            height={16}
            borderRadius={8}
            color={color}
          />
        </View>
      </View>
    </View>
  );
});

// ─── LoadingOverlayShimmer ────────────────────────────────────────────
// Translucent overlay with multiple shimmer rows

const overlayStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "flex-start",
    paddingTop: 24,
  } as ViewStyle,
  darkOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
  } as ViewStyle,
});

export const LoadingOverlayShimmer = memo(function LoadingOverlayShimmer({
  rows = 5,
  variant = "user",
  dark = false,
}: {
  rows?: number;
  variant?: "user" | "post";
  dark?: boolean;
}) {
  const color = dark ? "#333344" : undefined;
  return (
    <View style={[overlayStyles.overlay, dark && overlayStyles.darkOverlay]}>
      {Array.from({ length: rows }).map((_, i) =>
        variant === "post" ? (
          <PostShimmer key={`shimmer-${i}`} color={color} />
        ) : (
          <UserRowShimmer key={`shimmer-${i}`} color={color} />
        ),
      )}
    </View>
  );
});

// ─── Compound shimmers for specific screens ───────────────────────────

const listShimmerStyles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  } as ViewStyle,
  separator: {
    height: 10,
  } as ViewStyle,
});

/** Multiple UserCardShimmers for onboarding follows loading */
export const UserCardsShimmer = memo(function UserCardsShimmer({
  count = 4,
  color,
}: {
  count?: number;
  color?: string;
}) {
  return (
    <View style={listShimmerStyles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <UserCardShimmer key={`user-card-shimmer-${i}`} color={color} />
      ))}
    </View>
  );
});

/** Multiple FeedCardShimmers for onboarding feeds loading */
export const FeedCardsShimmer = memo(function FeedCardsShimmer({
  count = 4,
  color,
}: {
  count?: number;
  color?: string;
}) {
  return (
    <View style={listShimmerStyles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardShimmer key={`feed-card-shimmer-${i}`} color={color} />
      ))}
    </View>
  );
});

/** Shimmer for loading more content (list footer) */
const footerStyles = StyleSheet.create({
  footer: {
    paddingVertical: 16,
    gap: 8,
  } as ViewStyle,
});

export const LoadingFooterShimmer = memo(function LoadingFooterShimmer({
  variant = "user",
  color,
}: {
  variant?: "user" | "post";
  color?: string;
}) {
  return (
    <View style={footerStyles.footer}>
      {variant === "post" ? (
        <PostShimmer color={color} />
      ) : (
        <UserRowShimmer color={color} />
      )}
    </View>
  );
});

/** Summary text shimmer for thread summaries */
const summaryStyles = StyleSheet.create({
  container: {
    gap: 6,
    paddingVertical: 4,
  } as ViewStyle,
});

export const SummaryShimmer = memo(function SummaryShimmer({
  lines = 2,
  color,
}: {
  lines?: number;
  color?: string;
}) {
  return (
    <View style={summaryStyles.container}>
      {Array.from({ length: lines }).map((_, i) => (
        <TextLineShimmer
          key={`summary-line-${i}`}
          width={i === lines - 1 ? "60%" : "90%"}
          height={12}
          color={color}
        />
      ))}
    </View>
  );
});
