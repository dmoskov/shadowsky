import React, { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

interface OAuthCallbackScreenProps {
  code?: string;
  state?: string;
  error?: string;
}

export function OAuthCallbackScreen({
  code,
  state,
  error,
}: OAuthCallbackScreenProps) {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        router.replace("/(auth)");
        return;
      }

      if (code && state) {
        // TODO: Exchange code for tokens
        await new Promise((resolve) => setTimeout(resolve, 1500));
        router.replace("/(app)/(tabs)/(home)");
      } else {
        router.replace("/(auth)");
      }
    };

    handleCallback();
  }, [code, state, error, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.text}>
        {error ? "Authentication failed..." : "Completing sign in..."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    marginTop: 16,
    color: "#9ca3af",
    fontSize: 16,
  },
});
