import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { handleOAuthCallback } from "../../services/auth/oauth";
import { signInWithOAuth } from "../../services/auth/auth-service";

interface OAuthCallbackScreenProps {
  code?: string;
  state?: string;
  error?: string;
  iss?: string;
}

export function OAuthCallbackScreen({
  code,
  state,
  error,
  iss,
}: OAuthCallbackScreenProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      if (error) {
        setErrorMessage(error);
        setTimeout(() => router.replace("/(auth)"), 2000);
        return;
      }

      if (code && state) {
        try {
          // Exchange code for tokens using PKCE
          const sessionData = await handleOAuthCallback({ code, state, iss });

          // Sign in with the OAuth session
          await signInWithOAuth(sessionData);

          // Navigate to home
          router.replace("/(app)/(tabs)/(home)");
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "OAuth sign in failed";
          setErrorMessage(message);
          setTimeout(() => router.replace("/(auth)"), 2000);
        }
      } else {
        setErrorMessage("Missing OAuth parameters");
        setTimeout(() => router.replace("/(auth)"), 2000);
      }
    };

    handleCallback();
  }, [code, state, error, iss, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={styles.text}>
        {errorMessage || "Completing sign in..."}
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
