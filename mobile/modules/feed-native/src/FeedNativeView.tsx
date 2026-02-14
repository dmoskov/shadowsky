import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

export type { FeedNativeViewProps } from './FeedNativeView.types';
import type { FeedNativeViewProps } from './FeedNativeView.types';

const NativeView: React.ComponentType<FeedNativeViewProps> =
  requireNativeViewManager('FeedNative');

export default function FeedNativeView(props: FeedNativeViewProps) {
  return <NativeView {...props} />;
}
