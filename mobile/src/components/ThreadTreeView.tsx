import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { AppBskyFeedDefs } from "@atproto/api";
import { PostCard } from "./PostCard";
import { colors } from "../constants/theme";
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
function getDepthColor(depth: number): string {
  const colors = [
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // emerald
    "#06b6d4", // cyan
  ];
  return colors[depth % colors.length];
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
  onMentionPress,
  onHashtagPress,
  onPressLikeCount,
  onPressRepostCount,
  onPressQuoteCount,
}: ThreadTreeViewProps) {
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

  const renderThreadNode = (node: ThreadNode, isLast: boolean = false): React.ReactNode => {
    const isCollapsed = collapsedBranches.has(node.uri);
    const hasChildren = node.children.length > 0;
    const descendantCount = countDescendants(node);
    const depthColor = getDepthColor(node.depth);

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
                {isCollapsed ? "+" : "−"}
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
                💬 {descendantCount} hidden {descendantCount === 1 ? "reply" : "replies"}
              </Text>
              <Text style={styles.expandIcon}>›</Text>
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

const styles = StyleSheet.create({
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
    color: "#ffffff",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  collapsedText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "500",
  },
  expandIcon: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 8,
  },
});
