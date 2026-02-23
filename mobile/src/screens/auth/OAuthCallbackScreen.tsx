import React, { useEffect, useMemo } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";

interface OAuthCallbackScreenProps {
  error?: string;
}

/**
 * OAuth callback screen — shown as a fallback route for deep-link
 * OAuth callbacks. With @atproto/oauth-client-expo the callback is
 * handled inline by expo-web-browser, so this screen just shows a
 * spinner or redirects on error.
 */
export function OAuthCallbackScreen({ error }: OAuthCallbackScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  useEffect(() => {
    if (error) {
      setTimeout(() => router.replace("/(auth)"), 2000);
    }
  }, [error, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>
        {error || "Completing sign in..."}
      </Text>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    text: {
      marginTop: 16,
      color: colors.textSecondary,
      fontSize: 16,
    },
  });
}
