/**
 * React Native Type Declarations
 *
 * These type declarations provide TypeScript support for React Native primitives
 * when developing components that will be used in a React Native context.
 * This allows the web project to typecheck React Native components without
 * requiring the full react-native package.
 *
 * In a full React Native project, replace this with the actual react-native types:
 *   npm install @types/react-native
 *
 * Or when using the new architecture with the react-native package:
 *   Types are included in react-native@0.71+
 */

declare module "react-native" {
  import type { ComponentType, ReactNode, RefObject } from "react";

  // Style types
  export interface ViewStyle {
    flex?: number;
    flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
    flexWrap?: "wrap" | "nowrap" | "wrap-reverse";
    justifyContent?:
      | "flex-start"
      | "flex-end"
      | "center"
      | "space-between"
      | "space-around"
      | "space-evenly";
    alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
    alignSelf?:
      | "auto"
      | "flex-start"
      | "flex-end"
      | "center"
      | "stretch"
      | "baseline";
    position?: "absolute" | "relative";
    top?: number | string;
    right?: number | string;
    bottom?: number | string;
    left?: number | string;
    width?: number | string;
    height?: number | string;
    minWidth?: number | string;
    minHeight?: number | string;
    maxWidth?: number | string;
    maxHeight?: number | string;
    margin?: number | string;
    marginTop?: number | string;
    marginRight?: number | string;
    marginBottom?: number | string;
    marginLeft?: number | string;
    marginHorizontal?: number | string;
    marginVertical?: number | string;
    padding?: number | string;
    paddingTop?: number | string;
    paddingRight?: number | string;
    paddingBottom?: number | string;
    paddingLeft?: number | string;
    paddingHorizontal?: number | string;
    paddingVertical?: number | string;
    borderWidth?: number;
    borderTopWidth?: number;
    borderRightWidth?: number;
    borderBottomWidth?: number;
    borderLeftWidth?: number;
    borderColor?: string;
    borderTopColor?: string;
    borderRightColor?: string;
    borderBottomColor?: string;
    borderLeftColor?: string;
    borderRadius?: number;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    borderBottomLeftRadius?: number;
    borderBottomRightRadius?: number;
    backgroundColor?: string;
    opacity?: number;
    overflow?: "visible" | "hidden" | "scroll";
    aspectRatio?: number;
    gap?: number;
    rowGap?: number;
    columnGap?: number;
    flexGrow?: number;
    flexShrink?: number;
    flexBasis?: number | string;
  }

  export interface TextStyle extends ViewStyle {
    color?: string;
    fontFamily?: string;
    fontSize?: number;
    fontStyle?: "normal" | "italic";
    fontWeight?:
      | "normal"
      | "bold"
      | "100"
      | "200"
      | "300"
      | "400"
      | "500"
      | "600"
      | "700"
      | "800"
      | "900";
    letterSpacing?: number;
    lineHeight?: number;
    textAlign?: "auto" | "left" | "right" | "center" | "justify";
    textDecorationLine?:
      | "none"
      | "underline"
      | "line-through"
      | "underline line-through";
    textDecorationStyle?: "solid" | "double" | "dotted" | "dashed";
    textDecorationColor?: string;
    textShadowColor?: string;
    textShadowOffset?: { width: number; height: number };
    textShadowRadius?: number;
    textTransform?: "none" | "capitalize" | "uppercase" | "lowercase";
  }

  export interface ImageStyle extends ViewStyle {
    resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
    tintColor?: string;
    overlayColor?: string;
  }

  // StyleSheet
  export interface StyleSheetStatic {
    create<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(
      styles: T,
    ): T;
    flatten<T>(style: T | T[]): T extends (infer U)[] ? U : T;
    hairlineWidth: number;
  }

  export const StyleSheet: StyleSheetStatic;

  // View Component
  export interface ViewProps {
    style?: ViewStyle | (ViewStyle | false | undefined | null)[];
    children?: ReactNode;
    testID?: string;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    accessible?: boolean;
    hitSlop?:
      | number
      | { top?: number; left?: number; bottom?: number; right?: number };
    onLayout?: (event: LayoutChangeEvent) => void;
    pointerEvents?: "auto" | "none" | "box-none" | "box-only";
  }

  export const View: ComponentType<ViewProps>;

  // Text Component
  export interface TextProps {
    style?: TextStyle | (TextStyle | false | undefined | null)[];
    children?: ReactNode;
    numberOfLines?: number;
    ellipsizeMode?: "head" | "middle" | "tail" | "clip";
    onPress?: () => void;
    selectable?: boolean;
    testID?: string;
    accessibilityRole?: string;
    accessibilityLabel?: string;
  }

  export const Text: ComponentType<TextProps>;

  // Image Component
  export interface ImageSourcePropType {
    uri?: string;
    headers?: Record<string, string>;
    cache?: "default" | "reload" | "force-cache" | "only-if-cached";
  }

  export interface ImageProps {
    source: ImageSourcePropType | number;
    style?: ImageStyle | ImageStyle[];
    resizeMode?: "cover" | "contain" | "stretch" | "repeat" | "center";
    defaultSource?: ImageSourcePropType | number;
    onLoad?: () => void;
    onError?: (error: { nativeEvent: { error: string } }) => void;
    onLoadStart?: () => void;
    onLoadEnd?: () => void;
    testID?: string;
    accessibilityLabel?: string;
    fadeDuration?: number;
  }

  export const Image: ComponentType<ImageProps>;

  // Pressable Component
  export interface PressableProps {
    children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
    style?:
      | ViewStyle
      | (ViewStyle | false | undefined | null)[]
      | ((state: {
          pressed: boolean;
        }) => ViewStyle | (ViewStyle | false | undefined | null)[]);
    onPress?: () => void;
    onPressIn?: () => void;
    onPressOut?: () => void;
    onLongPress?: () => void;
    disabled?: boolean;
    hitSlop?:
      | number
      | { top?: number; left?: number; bottom?: number; right?: number };
    testID?: string;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    android_ripple?: {
      color?: string;
      borderless?: boolean;
      radius?: number;
    };
  }

  export const Pressable: ComponentType<PressableProps>;

  // FlatList Component
  export interface ListRenderItemInfo<T> {
    item: T;
    index: number;
    separators: {
      highlight: () => void;
      unhighlight: () => void;
      updateProps: (
        select: "leading" | "trailing",
        newProps: Record<string, unknown>,
      ) => void;
    };
  }

  export interface ViewToken<T = unknown> {
    item: T;
    key: string;
    index: number | null;
    isViewable: boolean;
    section?: unknown;
  }

  export interface ViewabilityConfig {
    minimumViewTime?: number;
    viewAreaCoveragePercentThreshold?: number;
    itemVisiblePercentThreshold?: number;
    waitForInteraction?: boolean;
  }

  export interface FlatListProps<T> {
    data: readonly T[] | null | undefined;
    renderItem: (info: ListRenderItemInfo<T>) => ReactNode;
    keyExtractor: (item: T, index: number) => string;
    getItemLayout?: (
      data: ArrayLike<T> | null | undefined,
      index: number,
    ) => { length: number; offset: number; index: number };
    ItemSeparatorComponent?: ComponentType<object> | null;
    ListEmptyComponent?: ReactNode | ComponentType<unknown> | null;
    ListHeaderComponent?: ReactNode | ComponentType<unknown> | null;
    ListFooterComponent?: ReactNode | ComponentType<unknown> | null;
    onEndReached?: () => void;
    onEndReachedThreshold?: number;
    onRefresh?: () => void;
    refreshing?: boolean;
    refreshControl?: ReactNode;
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    scrollEventThrottle?: number;
    onViewableItemsChanged?: (info: {
      viewableItems: ViewToken<T>[];
      changed: ViewToken<T>[];
    }) => void;
    viewabilityConfig?: ViewabilityConfig;
    windowSize?: number;
    maxToRenderPerBatch?: number;
    updateCellsBatchingPeriod?: number;
    initialNumToRender?: number;
    removeClippedSubviews?: boolean;
    style?: ViewStyle | ViewStyle[];
    contentContainerStyle?: ViewStyle | ViewStyle[];
    horizontal?: boolean;
    inverted?: boolean;
    numColumns?: number;
    initialScrollIndex?: number;
    extraData?: unknown;
    testID?: string;
    accessibilityRole?: string;
    accessibilityLabel?: string;
    maintainVisibleContentPosition?: {
      minIndexForVisible: number;
      autoscrollToTopThreshold?: number;
    };
  }

  export interface FlatListInstance<T> {
    scrollToIndex: (params: {
      index: number;
      animated?: boolean;
      viewOffset?: number;
      viewPosition?: number;
    }) => void;
    scrollToItem: (params: {
      item: T;
      animated?: boolean;
      viewPosition?: number;
    }) => void;
    scrollToOffset: (params: { offset: number; animated?: boolean }) => void;
    scrollToEnd: (params?: { animated?: boolean }) => void;
    recordInteraction: () => void;
    flashScrollIndicators: () => void;
    getNativeScrollRef: () => unknown;
  }

  export function FlatList<T>(
    props: FlatListProps<T> & { ref?: RefObject<FlatListInstance<T>> },
  ): JSX.Element;

  // RefreshControl Component
  export interface RefreshControlProps {
    refreshing: boolean;
    onRefresh?: () => void;
    colors?: string[];
    tintColor?: string;
    title?: string;
    titleColor?: string;
    progressViewOffset?: number;
    progressBackgroundColor?: string;
  }

  export const RefreshControl: ComponentType<RefreshControlProps>;

  // ActivityIndicator Component
  export interface ActivityIndicatorProps {
    animating?: boolean;
    color?: string;
    size?: "small" | "large" | number;
    hidesWhenStopped?: boolean;
    testID?: string;
  }

  export const ActivityIndicator: ComponentType<ActivityIndicatorProps>;

  // Events
  export interface LayoutChangeEvent {
    nativeEvent: {
      layout: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    };
  }

  export interface NativeScrollEvent {
    contentOffset: { x: number; y: number };
    contentSize: { width: number; height: number };
    layoutMeasurement: { width: number; height: number };
    zoomScale?: number;
  }

  export interface NativeSyntheticEvent<T> {
    nativeEvent: T;
    currentTarget: unknown;
    target: unknown;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    eventPhase: number;
    isTrusted: boolean;
    preventDefault(): void;
    isDefaultPrevented(): boolean;
    stopPropagation(): void;
    isPropagationStopped(): boolean;
    persist(): void;
    timeStamp: number;
    type: string;
  }

  // Platform
  export interface PlatformStatic {
    OS: "ios" | "android" | "web" | "windows" | "macos";
    Version: number | string;
    select<T>(specifics: { ios?: T; android?: T; web?: T; default?: T }): T;
    isTV: boolean;
  }

  export const Platform: PlatformStatic;

  // Dimensions
  export interface ScaledSize {
    width: number;
    height: number;
    scale: number;
    fontScale: number;
  }

  export interface DimensionsStatic {
    get(dim: "window" | "screen"): ScaledSize;
    addEventListener(
      type: "change",
      handler: (dimensions: { window: ScaledSize; screen: ScaledSize }) => void,
    ): { remove: () => void };
  }

  export const Dimensions: DimensionsStatic;
}
