import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";

export function LandingScreen() {
  const { signIn, signInWithOAuth } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both handle and app password");
      return;
    }

    try {
      setIsLoading(true);
      await signIn(identifier.trim(), password);
    } catch {
      Alert.alert(
        "Sign In Failed",
        "Invalid credentials. Please check your handle and app password.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    try {
      setIsLoading(true);
      await signInWithOAuth();
    } catch {
      Alert.alert(
        "Sign In Failed",
        "Failed to start OAuth flow. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>ShadowSky</Text>
          <Text style={styles.subtitle}>
            A powerful Bluesky client with advanced features
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Handle or Email</Text>
            <TextInput
              style={styles.input}
              placeholder="yourhandle.bsky.social"
              placeholderTextColor="#6b7280"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>App Password</Text>
            <TextInput
              style={styles.input}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <Text style={styles.helpText}>
              Use an app password, not your account password
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.loginButton,
              isLoading && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.loginButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              Don't have an app password?{" "}
              <Text style={styles.linkText}>
                Create one in your Bluesky account settings
              </Text>
            </Text>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={[styles.oauthButton, styles.oauthButtonDisabled]}
            disabled={true}
          >
            <Text style={styles.oauthButtonText}>
              Sign in with Bluesky (Coming Soon)
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By signing in, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  content: {
    alignItems: "center",
    marginBottom: 48,
  },
  title: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#ffffff",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: "#9ca3af",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  formContainer: {
    width: "100%",
  },
  oauthButton: {
    backgroundColor: "#1185fe",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  oauthButtonDisabled: {
    backgroundColor: "#1a1a24",
    borderWidth: 1,
    borderColor: "#374151",
    opacity: 0.6,
  },
  oauthButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#374151",
  },
  dividerText: {
    color: "#6b7280",
    fontSize: 14,
    marginHorizontal: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#1a1a24",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#ffffff",
  },
  helpText: {
    color: "#6b7280",
    fontSize: 12,
    marginTop: 6,
  },
  loginButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: "#1e3a8a",
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  infoContainer: {
    marginBottom: 20,
  },
  infoText: {
    color: "#9ca3af",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  linkText: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  disclaimer: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
  },
});
