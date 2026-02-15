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
  const { signIn } = useAuth();
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
              placeholderTextColor={colors.textTertiary}
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
              placeholderTextColor={colors.textTertiary}
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
              <ActivityIndicator color={colors.text} />
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
    backgroundColor: colors.background,
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
    color: colors.text,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  formContainer: {
    width: "100%",
  },
  oauthButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
  },
  oauthButtonDisabled: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    opacity: 0.6,
  },
  oauthButtonText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  signUpButton: {
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  signUpButtonText: {
    color: colors.primary,
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
    backgroundColor: colors.borderLight,
  },
  dividerText: {
    color: colors.textTertiary,
    fontSize: 14,
    marginHorizontal: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  helpText: {
    color: colors.textTertiary,
    fontSize: 12,
    marginTop: 6,
  },
  loginButton: {
    backgroundColor: colors.primary,
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
    color: colors.text,
    fontSize: 18,
    fontWeight: "600",
  },
  infoContainer: {
    marginBottom: 20,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "600",
  },
  disclaimer: {
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: "center",
  },
  link: {
    color: colors.info,
    textDecorationLine: "underline",
  },
});
