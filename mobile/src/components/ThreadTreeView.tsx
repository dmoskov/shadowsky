import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { PostCard } from "./PostCard";
import { useTheme } from "../contexts/ThemeContext";
import { triggerHaptic } from "../utils/haptics";

interface ThreadNode {
  post: AppBskyFeedDefs.FeedViewPost;
  children: ThreadNode[];
  depth: number;
  uri: string;
  parentUri?: string;
}

interface ThreadTreeViewProps {
  rootPost: AppBskyFeedDefs.FeedViewPost;
  replies: AppBskyFeedDefs.FeedViewPost[];
  onPressProfile: (handle: string) => void;
  onLike: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onRepost: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onReply: (post: AppBskyFeedDefs.FeedViewPost) => void;
  onBookmark?: (post: AppBskyFeedDefs.FeedViewPost) => void;
  isBookmarked?: (postUri: string) => boolean;
  onMentionPress: (handle: string, did: string) => void;
  onHashtagPress: (tag: string) => void;
  onPressLikeCount?: (postUri: string) => void;
  onPressRepostCount?: (postUri: string) => void;
  onPressQuoteCount?: (postUri: string) => void;
}

// Build tree structure from flat replies
function buildThreadTree(
  rootPost: AppBskyFeedDefs.FeedViewPost,
  replies: AppBskyFeedDefs.FeedViewPost[]
): ThreadNode {
  const nodeMap: Map<string, ThreadNode> = new Map();

  // Create root node
  const rootNode: ThreadNode = {
    post: rootPost,
    children: [],
    depth: 0,
    uri: rootPost.post.uri,
  };
  nodeMap.set(rootPost.post.uri, rootNode);

  // Create nodes for all replies
  replies.forEach((reply) => {
    const node: ThreadNode = {
      post: reply,
      children: [],
      depth: 0,
      uri: reply.post.uri,
    };
    nodeMap.set(reply.post.uri, node);
  });

  // Build parent-child relationships
  replies.forEach((reply) => {
    const record = reply.post.record as any;
    const parentUri = record?.reply?.parent?.uri;

    if (parentUri) {
      const parentNode = nodeMap.get(parentUri);
      const childNode = nodeMap.get(reply.post.uri);

      if (parentNode && childNode) {
        parentNode.children.push(childNode);
        childNode.depth = parentNode.depth + 1;
        childNode.parentUri = parentUri;
      }
    }
  });

  return rootNode;
}

// Get color based on depth for visual hierarchy
function getDepthColor(depth: number, colors: any): string {
  const depthColors = [
    colors.info, // blue
    colors.mention, // purple
    colors.accent, // pink
    colors.warning, // amber
    colors.success, // emerald
    colors.quote, // cyan
  ];
  return depthColors[depth % depthColors.length];
}

// Count descendants in a branch
function countDescendants(node: ThreadNode): number {
  let count = node.children.length;
  node.children.forEach((child) => {
    count += countDescendants(child);
  });
  return count;
}

export function ThreadTreeView({
  rootPost,
  replies,
  onPressProfile,
  onLike,
  onRepost,
  onReply,
  onBookmark,
  isBookmarked,
  onMentionPress,
  onHashtagPress,
  onPressLikeCount,
  onPressRepostCount,
  onPressQuoteCount,
}: ThreadTreeViewProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(
    new Set()
  );

  // Build tree structure
  const threadTree = useMemo(
    () => buildThreadTree(rootPost, replies),
    [rootPost, replies]
  );

  const toggleBranch = (uri: string) => {
    triggerHaptic("light");
    setCollapsedBranches((prev) => {
      const next = new Set(prev);
      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }
      return next;
    });
  };

  const renderThreadNode = (node: ThreadNode, _isLast: boolean = false): React.ReactNode => {
    const isCollapsed = collapsedBranches.has(node.uri);
    const hasChildren = node.children.length > 0;
    const descendantCount = countDescendants(node);
    const depthColor = getDepthColor(node.depth, colors);

    return (
      <View key={node.uri} style={styles.nodeContainer}>
        {/* Depth indicator line */}
        {node.depth > 0 && (
          <View
            style={[
              styles.depthLine,
              {
                left: (node.depth - 1) * 20 + 8,
                backgroundColor: depthColor,
              },
            ]}
          />
        )}

        {/* Post container with indentation */}
        <View
          style={[
            styles.postContainer,
            { marginLeft: node.depth * 20 },
          ]}
        >
          {/* Collapse/Expand button for branches with children */}
          {hasChildren && node.depth > 0 && (
            <TouchableOpacity
              style={[
                styles.collapseButton,
                { backgroundColor: depthColor },
              ]}
              onPress={() => toggleBranch(node.uri)}
              activeOpacity={0.7}
            >
              <Text style={styles.collapseIcon}>
                {isCollapsed ? "+" : "\u2212"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Branch indicator for leaf nodes */}
          {node.depth > 0 && !hasChildren && (
            <View
              style={[
                styles.branchIndicator,
                { borderLeftColor: depthColor, borderTopColor: depthColor },
              ]}
            />
          )}

          {/* Post card */}
          <View style={styles.postCardWrapper}>
            <PostCard
              post={node.post}
              onPressProfile={onPressProfile}
              onLike={() => onLike(node.post)}
              onRepost={() => onRepost(node.post)}
              onReply={() => onReply(node.post)}
              onBookmark={onBookmark ? () => onBookmark(node.post) : undefined}
              isBookmarked={isBookmarked ? isBookmarked(node.post.post.uri) : false}
              onMentionPress={onMentionPress}
              onHashtagPress={onHashtagPress}
              onPressLikeCount={
                onPressLikeCount
                  ? () => onPressLikeCount(node.post.post.uri)
                  : undefined
              }
              onPressRepostCount={
                onPressRepostCount
                  ? () => onPressRepostCount(node.post.post.uri)
                  : undefined
              }
              onPressQuoteCount={
                onPressQuoteCount
                  ? () => onPressQuoteCount(node.post.post.uri)
                  : undefined
              }
            />
          </View>
        </View>

        {/* Collapsed indicator */}
        {isCollapsed && hasChildren && (
          <TouchableOpacity
            style={[
              styles.collapsedIndicator,
              { marginLeft: (node.depth + 1) * 20 },
            ]}
            onPress={() => toggleBranch(node.uri)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.collapsedBadge,
                { backgroundColor: depthColor },
              ]}
            >
              <Text style={styles.collapsedText}>
                {descendantCount} hidden {descendantCount === 1 ? "reply" : "replies"}
              </Text>
              <Text style={styles.expandIcon}>{"\u203A"}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Render children if not collapsed */}
        {!isCollapsed &&
          node.children.map((child, index) =>
            renderThreadNode(child, index === node.children.length - 1)
          )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderThreadNode(threadTree)}
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    nodeContainer: {
      position: "relative",
    },
    depthLine: {
      position: "absolute",
      top: 0,
      width: 2,
      height: "100%",
      opacity: 0.3,
    },
    postContainer: {
      flexDirection: "row",
      alignItems: "flex-start",
      position: "relative",
    },
    collapseButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 8,
      marginTop: 16,
      zIndex: 1,
    },
    collapseIcon: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "bold",
      lineHeight: 20,
    },
    branchIndicator: {
      width: 12,
      height: 12,
      borderLeftWidth: 2,
      borderTopWidth: 2,
      borderTopLeftRadius: 4,
      marginRight: 8,
      marginTop: 20,
      marginLeft: 4,
    },
    postCardWrapper: {
      flex: 1,
    },
    collapsedIndicator: {
      marginTop: 8,
      marginBottom: 8,
    },
    collapsedBadge: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      elevation: 2,
      shadowColor: colors.borderDark,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
    },
    collapsedText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "500",
    },
    expandIcon: {
      color: colors.text,
      fontSize: 18,
      fontWeight: "bold",
      marginLeft: 8,
    },
  });
}
