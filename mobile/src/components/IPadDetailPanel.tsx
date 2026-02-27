import React, { useMemo, useRef, createContext, useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationContainer, NavigationIndependentTree, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "../contexts/ThemeContext";
import { useIPadLayout, DetailPanelContent } from "../contexts/IPadLayoutContext";
import { ThreadScreenNative } from "../screens/shared/ThreadScreenNative";
import { ProfileScreenNative } from "../screens/profile/ProfileScreenNative";
import { ComposeScreenNative } from "../screens/compose/ComposeScreenNative";
import { SettingsScreen } from "../screens/settings/SettingsScreen";
import { ListDetailScreen } from "../screens/lists/ListDetailScreen";
import { AnalyticsScreen } from "../screens/analytics/AnalyticsScreen";
import { MessagesScreen } from "../screens/profile/MessagesScreen";

/** Maximum detail panel width on very wide screens */
const DETAIL_PANEL_MAX_WIDTH = 420;
/** Minimum detail panel width */
const DETAIL_PANEL_MIN_WIDTH = 320;
/** Default sidebar width — must stay in sync with IPadSidebar */
const DEFAULT_SIDEBAR_WIDTH = 260;

/**
 * Compute the detail panel width based on available window space.
 * The panel takes roughly 35% of the space after the sidebar, clamped between min/max.
 */
function computeDetailWidth(windowWidth: number, sidebarWidth: number): number {
  const available = windowWidth - sidebarWidth;
  const desired = Math.round(available * 0.35);
  return Math.max(DETAIL_PANEL_MIN_WIDTH, Math.min(DETAIL_PANEL_MAX_WIDTH, desired));
}

/**
 * Legacy constant for any code that previously imported a fixed width.
 * Prefer using `computeDetailWidth()` for responsive layouts.
 */
const DETAIL_PANEL_WIDTH = 380;

export { DETAIL_PANEL_WIDTH, computeDetailWidth };

// --- Detail Panel Stack Navigator ---

type DetailStackParamList = {
  DetailThread: { handle: string; postId: string };
  DetailProfile: { handle: string };
  DetailCompose: { replyTo?: string; quoteTo?: string };
  DetailSettings: undefined;
  DetailListDetail: { listUri: string };
  DetailAnalytics: undefined;
  DetailMessages: { conversationId?: string };
};

const DetailStack = createNativeStackNavigator<DetailStackParamList>();

/**
 * Context that provides navigation methods scoped to the detail panel.
 * Screens rendered inside the detail panel use this to navigate within the
 * panel's own stack, rather than affecting the main app navigation.
 */
interface DetailPanelNavigationContextValue {
  navigateToThread: (handle: string, postId: string) => void;
  navigateToProfile: (handle: string) => void;
  navigateToCompose: (params?: { replyTo?: any; quoteTo?: any }) => void;
  navigateToSettings: () => void;
  navigateToListDetail: (listUri: string) => void;
  navigateToAnalytics: () => void;
  navigateToMessages: (conversationId?: string) => void;
  goBack: () => void;
  canGoBack: () => boolean;
}

const DetailPanelNavigationContext = createContext<DetailPanelNavigationContextValue>({
  navigateToThread: () => {},
  navigateToProfile: () => {},
  navigateToCompose: () => {},
  navigateToSettings: () => {},
  navigateToListDetail: () => {},
  navigateToAnalytics: () => {},
  navigateToMessages: () => {},
  goBack: () => {},
  canGoBack: () => false,
});

export function useDetailPanelNavigation() {
  return useContext(DetailPanelNavigationContext);
}

// --- Screen wrappers ---
// Each wrapper renders the underlying screen component and provides callbacks
// that navigate within the detail panel stack instead of the main app navigation.

function DetailThreadScreen({ route }: { route: { params: { handle: string; postId: string } } }) {
  const { handle, postId } = route.params;
  return <ThreadScreenNative handle={handle} postId={postId} />;
}

function DetailProfileScreen({ route }: { route: { params: { handle: string } } }) {
  const { handle } = route.params;
  const detailNav = useDetailPanelNavigation();

  return (
    <ProfileScreenNative
      handle={handle}
      onNavigateToPost={(uri: string) => {
        const parts = uri.split("/");
        const postId = parts[parts.length - 1];
        // Extract handle from AT URI: at://did/collection/rkey
        // We use the current profile handle as a fallback
        detailNav.navigateToThread(handle, postId);
      }}
      onNavigateToProfile={(profileHandle: string) => {
        detailNav.navigateToProfile(profileHandle);
      }}
    />
  );
}

function DetailComposeScreen({ route }: { route: { params?: { replyTo?: string; quoteTo?: string } } }) {
  const replyTo = route.params?.replyTo ? JSON.parse(route.params.replyTo) : undefined;
  const quoteTo = route.params?.quoteTo ? JSON.parse(route.params.quoteTo) : undefined;
  return <ComposeScreenNative replyTo={replyTo} quoteTo={quoteTo} />;
}

function DetailSettingsScreen() {
  return <SettingsScreen />;
}

function DetailListDetailScreen({ route }: { route: { params: { listUri: string } } }) {
  return <ListDetailScreen listUri={route.params.listUri} />;
}

function DetailAnalyticsScreen() {
  return <AnalyticsScreen />;
}

function DetailMessagesScreen() {
  return <MessagesScreen />;
}

// --- Header ---

function DetailPanelHeader({
  title,
  onClose,
  onBack,
  showBack,
  colors,
}: {
  title: string;
  onClose: () => void;
  onBack: () => void;
  showBack: boolean;
  colors: any;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.background,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        {showBack && (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 8 }}
          >
            <Text style={{ color: colors.primary, fontSize: 16 }}>‹</Text>
          </TouchableOpacity>
        )}
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600", flex: 1 }} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

// --- Utility ---

/** Derive a display title from the current detail panel content */
function getTitleForContent(content: DetailPanelContent): string {
  if (!content) return "";
  switch (content.type) {
    case "thread": return "Thread";
    case "profile": return `@${content.handle}`;
    case "compose": return "Compose";
    case "settings": return "Settings";
    case "list-detail": return "List";
    case "analytics": return "Analytics";
    case "messages": return "Messages";
  }
}

/** Derive the initial route name and params from detail panel content */
function getInitialRoute(content: DetailPanelContent): {
  name: keyof DetailStackParamList;
  params: any;
} {
  if (!content) {
    return { name: "DetailThread", params: { handle: "", postId: "" } };
  }
  switch (content.type) {
    case "thread":
      return { name: "DetailThread", params: { handle: content.handle, postId: content.postId } };
    case "profile":
      return { name: "DetailProfile", params: { handle: content.handle } };
    case "compose":
      return {
        name: "DetailCompose",
        params: {
          replyTo: content.replyTo ? JSON.stringify(content.replyTo) : undefined,
          quoteTo: content.quoteTo ? JSON.stringify(content.quoteTo) : undefined,
        },
      };
    case "settings":
      return { name: "DetailSettings", params: undefined };
    case "list-detail":
      return { name: "DetailListDetail", params: { listUri: content.listUri } };
    case "analytics":
      return { name: "DetailAnalytics", params: undefined };
    case "messages":
      return { name: "DetailMessages", params: { conversationId: content.conversationId } };
  }
}

/**
 * Generate a stable key for the NavigationContainer based on the detail content.
 * When the external detailContent changes (e.g., sidebar tap), the key changes,
 * forcing the NavigationContainer to remount and reset its stack.
 */
function getContentKey(content: DetailPanelContent): string {
  if (!content) return "empty";
  switch (content.type) {
    case "thread": return `thread-${content.handle}-${content.postId}`;
    case "profile": return `profile-${content.handle}`;
    case "compose": return `compose-${Date.now()}`;
    case "settings": return "settings";
    case "list-detail": return `list-${content.listUri}`;
    case "analytics": return "analytics";
    case "messages": return `messages-${content.conversationId || "inbox"}`;
  }
}

// --- Main component ---

export function IPadDetailPanel() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { detailContent, closeDetail, canShowDetailPanel, windowWidth } = useIPadLayout();
  const navigationRef = useRef<NavigationContainerRef<DetailStackParamList>>(null);

  const panelWidth = computeDetailWidth(windowWidth, DEFAULT_SIDEBAR_WIDTH);
  const styles = useMemo(() => createStyles(colors, panelWidth), [colors, panelWidth]);

  // Don't render if there's no content or the window is too narrow
  if (!detailContent || !canShowDetailPanel) {
    return null;
  }

  const title = getTitleForContent(detailContent);
  const { name: initialRouteName, params: initialParams } = getInitialRoute(detailContent);
  const contentKey = getContentKey(detailContent);

  const handleBack = () => {
    if (navigationRef.current?.canGoBack()) {
      navigationRef.current.goBack();
    }
  };

  const canGoBack = () => {
    return navigationRef.current?.canGoBack() ?? false;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <DetailPanelHeader
        title={title}
        onClose={closeDetail}
        onBack={handleBack}
        showBack={false}
        colors={colors}
      />
      <View style={styles.content}>
        <DetailPanelNavigationProvider navigationRef={navigationRef} canGoBackFn={canGoBack}>
          <NavigationIndependentTree>
            <NavigationContainer
              key={contentKey}
              ref={navigationRef}
            >
            <DetailStack.Navigator
              initialRouteName={initialRouteName}
              screenOptions={{ headerShown: false, animation: "slide_from_right" }}
            >
              <DetailStack.Screen
                name="DetailThread"
                component={DetailThreadScreen}
                initialParams={initialRouteName === "DetailThread" ? initialParams : undefined}
              />
              <DetailStack.Screen
                name="DetailProfile"
                component={DetailProfileScreen}
                initialParams={initialRouteName === "DetailProfile" ? initialParams : undefined}
              />
              <DetailStack.Screen
                name="DetailCompose"
                component={DetailComposeScreen}
                initialParams={initialRouteName === "DetailCompose" ? initialParams : undefined}
              />
              <DetailStack.Screen
                name="DetailSettings"
                component={DetailSettingsScreen}
              />
              <DetailStack.Screen
                name="DetailListDetail"
                component={DetailListDetailScreen}
                initialParams={initialRouteName === "DetailListDetail" ? initialParams : undefined}
              />
              <DetailStack.Screen
                name="DetailAnalytics"
                component={DetailAnalyticsScreen}
              />
              <DetailStack.Screen
                name="DetailMessages"
                component={DetailMessagesScreen}
                initialParams={initialRouteName === "DetailMessages" ? initialParams : undefined}
              />
            </DetailStack.Navigator>
          </NavigationContainer>
          </NavigationIndependentTree>
        </DetailPanelNavigationProvider>
      </View>
    </View>
  );
}

/**
 * Provider that gives detail panel screens access to navigation methods
 * scoped to the detail panel's own stack navigator.
 */
function DetailPanelNavigationProvider({
  children,
  navigationRef,
  canGoBackFn,
}: {
  children: React.ReactNode;
  navigationRef: React.RefObject<NavigationContainerRef<DetailStackParamList> | null>;
  canGoBackFn: () => boolean;
}) {
  const nav = useMemo((): DetailPanelNavigationContextValue => ({
    navigateToThread: (handle: string, postId: string) => {
      navigationRef.current?.navigate("DetailThread" as any, { handle, postId });
    },
    navigateToProfile: (handle: string) => {
      navigationRef.current?.navigate("DetailProfile" as any, { handle });
    },
    navigateToCompose: (params) => {
      navigationRef.current?.navigate("DetailCompose" as any, {
        replyTo: params?.replyTo ? JSON.stringify(params.replyTo) : undefined,
        quoteTo: params?.quoteTo ? JSON.stringify(params.quoteTo) : undefined,
      });
    },
    navigateToSettings: () => {
      navigationRef.current?.navigate("DetailSettings" as any);
    },
    navigateToListDetail: (listUri: string) => {
      navigationRef.current?.navigate("DetailListDetail" as any, { listUri });
    },
    navigateToAnalytics: () => {
      navigationRef.current?.navigate("DetailAnalytics" as any);
    },
    navigateToMessages: (conversationId) => {
      navigationRef.current?.navigate("DetailMessages" as any, { conversationId });
    },
    goBack: () => {
      if (navigationRef.current?.canGoBack()) {
        navigationRef.current.goBack();
      }
    },
    canGoBack: canGoBackFn,
  }), [navigationRef, canGoBackFn]);

  return (
    <DetailPanelNavigationContext.Provider value={nav}>
      {children}
    </DetailPanelNavigationContext.Provider>
  );
}

function createStyles(colors: any, panelWidth: number = DETAIL_PANEL_WIDTH) {
  return StyleSheet.create({
    container: {
      width: panelWidth,
      backgroundColor: colors.background,
      borderLeftWidth: 1,
      borderLeftColor: colors.border,
    },
    content: {
      flex: 1,
    },
  });
}
