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
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../constants/theme";
import { useTranslation } from "../../hooks/useTranslation";

export function LandingScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithOAuth } = useAuth();
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert(t("auth.error_title"), t("auth.error_missing_credentials"));
      return;
    }

    try {
      setIsLoading(true);
      await signIn(identifier.trim(), password);
    } catch {
      Alert.alert(
        t("auth.sign_in_failed_title"),
        t("auth.sign_in_failed_invalid_credentials"),
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
        t("auth.sign_in_failed_title"),
        t("auth.sign_in_failed_oauth"),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async () => {
    try {
      await Linking.openURL("https://bsky.app/signup");
    } catch (error) {
      Alert.alert(
        t("auth.error_title"),
        "Failed to open sign-up page. Please visit bsky.app/signup in your browser.",
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>{t("auth.app_title")}</Text>
          <Text style={styles.subtitle}>
            {t("auth.app_subtitle")}
          </Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t("auth.handle_or_email_label")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("auth.handle_placeholder")}
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
            <Text style={styles.label}>{t("auth.app_password_label")}</Text>
            <TextInput
              style={styles.input}
              placeholder={t("auth.app_password_placeholder")}
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
            <Text style={styles.helpText}>
              {t("auth.app_password_help")}
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
              <Text style={styles.loginButtonText}>{t("auth.sign_in_button")}</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>
              {t("auth.no_app_password_info")}{" "}
              <Text style={styles.linkText}>
                {t("auth.create_app_password_link")}
              </Text>
            </Text>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t("auth.divider_or")}</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.signUpButton}
            onPress={handleSignUp}
          >
            <Text style={styles.signUpButtonText}>
              {t("auth.sign_up_button")}
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            {t("auth.disclaimer")}{" "}
            <Text style={styles.link} onPress={() => Linking.openURL("https://shadowsky.io/terms")}>
              {t("auth.terms_of_service")}
            </Text>{" "}
            {t("auth.and")}{" "}
            <Text style={styles.link} onPress={() => Linking.openURL("https://shadowsky.io/privacy")}>
              {t("auth.privacy_policy")}
            </Text>
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
    backgroundColor: "#c9a84c",
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
  signUpButton: {
    backgroundColor: "#1a1a24",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#c9a84c",
  },
  signUpButtonText: {
    color: "#c9a84c",
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
    backgroundColor: "#c9a84c",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: colors.primaryDark,
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
    color: "#c9a84c",
    fontWeight: "600",
  },
  disclaimer: {
    color: "#6b7280",
    fontSize: 12,
    textAlign: "center",
  },
  link: {
    color: "#60a5fa",
    textDecorationLine: "underline",
  },
});
