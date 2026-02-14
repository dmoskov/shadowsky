import { requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { ViewProps } from 'react-native';

// Type definitions for AT Protocol facets
export interface ATFacet {
  index: {
    byteStart: number;
    byteEnd: number;
  };
  features: FacetFeature[];
}

export type FacetFeature =
  | {
      $type: 'app.bsky.richtext.facet#mention';
      did: string;
    }
  | {
      $type: 'app.bsky.richtext.facet#link';
      uri: string;
    }
  | {
      $type: 'app.bsky.richtext.facet#tag';
      tag: string;
    };

// Event types
export interface MentionPressEvent {
  handle: string;
  did: string;
}

export interface HashtagPressEvent {
  tag: string;
}

export interface LinkPressEvent {
  uri: string;
}

// Props for the native view
export interface RichTextViewProps extends ViewProps {
  text: string;
  facets?: ATFacet[];
  onMentionPress?: (event: { nativeEvent: MentionPressEvent }) => void;
  onHashtagPress?: (event: { nativeEvent: HashtagPressEvent }) => void;
  onLinkPress?: (event: { nativeEvent: LinkPressEvent }) => void;
}

// Internal native view type
interface NativeRichTextViewProps extends ViewProps {
  text: string;
  facets?: string; // JSON string
  onMentionPress?: (event: { nativeEvent: MentionPressEvent }) => void;
  onHashtagPress?: (event: { nativeEvent: HashtagPressEvent }) => void;
  onLinkPress?: (event: { nativeEvent: LinkPressEvent }) => void;
}

// Get the native view manager
const NativeView: React.ComponentType<NativeRichTextViewProps> =
  requireNativeViewManager('RichTextView');

/**
 * SwiftUI-based rich text view for rendering AT Protocol facets
 * Supports mentions, hashtags, and links with proper UTF-8 byte offset handling
 */
export function RichTextView({
  text,
  facets,
  onMentionPress,
  onHashtagPress,
  onLinkPress,
  ...otherProps
}: RichTextViewProps) {
  // Convert facets array to JSON string for native side
  const facetsJson = facets && facets.length > 0 ? JSON.stringify(facets) : undefined;

  return React.createElement(NativeView, {
    ...otherProps,
    text,
    facets: facetsJson,
    onMentionPress,
    onHashtagPress,
    onLinkPress,
  });
}

export default RichTextView;
