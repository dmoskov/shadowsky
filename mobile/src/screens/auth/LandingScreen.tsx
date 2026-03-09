import React, { useState, useMemo } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useTranslation } from "../../hooks/useTranslation";
import {fontSize} from '../../utils/typography';
import { openLink } from "../../utils/browser";

type LoginMode = "oauth" | "app-password";

function AuthExplainer({ styles }: { styles: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.explainerContainer}>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={styles.explainerToggle}
      >
        <Text style={styles.explainerToggleText}>
          {isOpen ? "\u25BC" : "\u25B6"} Which sign-in method should I use?
        </Text>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.explainerContent}>
          <View>
            <Text style={styles.explainerMethodTitle}>
              OAuth (Recommended)
            </Text>
            <Text style={styles.explainerMethodDescription}>
              Redirects you to Bluesky to authorize access. More secure because
              you never share your password. However, OAuth does not currently
              support direct messages — granular permission scopes are still
              being developed by the AT Protocol team.
            </Text>
          </View>
          <View>
            <Text style={styles.explainerMethodTitle}>
              App Password (Required for DMs)
            </Text>
            <Text style={styles.explainerMethodDescription}>
              Use an app password if you need access to direct messages. App
              passwords provide full account access but are separate from your
              main password, so you can revoke them anytime. Create one at
              bsky.app/settings/app-passwords.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

export function LandingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithOAuth } = useAuth();
  const { t } = useTranslation();
  const [loginMode, setLoginMode] = useState<LoginMode>("oauth");
  const [handle, setHandle] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pdsUrl, setPdsUrl] = useState("https://bsky.social");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOAuthLogin = async () => {
    if (!handle.trim()) {
      Alert.alert(t("auth.error_title"), t("auth.error_missing_handle"));
      return;
    }

    try {
      setIsLoading(true);
      await signInWithOAuth(handle.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(
        t("auth.sign_in_failed_title"),
        message,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppPasswordLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      Alert.alert(t("auth.error_title"), t("auth.error_missing_credentials"));
      return;
    }

    try {
      setIsLoading(true);
      const effectivePdsUrl = pdsUrl.trim() || "https://bsky.social";
      await signIn(identifier.trim(), password, effectivePdsUrl);
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
      await openLink("https://bsky.app/signup");
    } catch {
      Alert.alert(
        t("auth.error_title"),
        "Failed to open sign-up page. Please visit bsky.app/signup in your browser.",
      );
    }
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

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
          <Text testID="auth-title" style={styles.title}>{t("auth.app_title")}</Text>
          <Text style={styles.subtitle}>
            {t("auth.app_subtitle")}
          </Text>
        </View>

        <View style={styles.formContainer}>
          {/* Login Mode Toggle */}
          <View testID="auth-mode-toggle" style={styles.toggleContainer}>
            <TouchableOpacity
              testID="oauth-tab"
              style={[
                styles.toggleButton,
                loginMode === "oauth" && styles.toggleButtonActive,
              ]}
              onPress={() => setLoginMode("oauth")}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  loginMode === "oauth" && styles.toggleButtonTextActive,
                ]}
              >
                {t("auth.oauth_tab")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="app-password-tab"
              style={[
                styles.toggleButton,
                loginMode === "app-password" && styles.toggleButtonActive,
              ]}
              onPress={() => setLoginMode("app-password")}
              disabled={isLoading}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  loginMode === "app-password" && styles.toggleButtonTextActive,
                ]}
              >
                {t("auth.app_password_tab")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auth Method Explainer */}
          <AuthExplainer styles={styles} />

          {/* OAuth Login Form */}
          {loginMode === "oauth" && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>{t("auth.handle_label")}</Text>
                <TextInput
                  testID="oauth-handle-input"
                  style={styles.input}
                  placeholder={t("auth.handle_placeholder")}
                  placeholderTextColor={colors.textTertiary}
                  value={handle}
                  onChangeText={setHandle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="username"
                  editable={!isLoading}
                />
                <Text style={styles.helpText}>
                  {t("auth.oauth_redirect_help")}
                </Text>
              </View>

              <TouchableOpacity
                testID="oauth-sign-in-button"
                style={[
                  styles.loginButton,
                  isLoading && styles.loginButtonDisabled,
                ]}
                onPress={handleOAuthLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.loginButtonText}>
                    {t("auth.sign_in_oauth_button")}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* App Password Login Form */}
          {loginMode === "app-password" && (
            <>
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
                  textContentType="username"
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
                  textContentType="password"
                  editable={!isLoading}
                />
                <Text style={styles.helpText}>
                  {t("auth.app_password_help")}
                </Text>
              </View>

              {/* Advanced: Custom PDS URL */}
              <TouchableOpacity
                style={styles.advancedToggle}
                onPress={() => setShowAdvanced(!showAdvanced)}
                disabled={isLoading}
              >
                <Text style={styles.advancedToggleText}>
                  {showAdvanced ? "\u25BC" : "\u25B6"}{" "}
                  {t("auth.advanced_pds_toggle")}
                </Text>
              </TouchableOpacity>

              {showAdvanced && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>{t("auth.pds_url_label")}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="https://bsky.social"
                    placeholderTextColor={colors.textTertiary}
                    value={pdsUrl}
                    onChangeText={setPdsUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    textContentType="URL"
                    editable={!isLoading}
                  />
                  <Text style={styles.helpText}>
                    {t("auth.pds_url_help")}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.loginButton,
                  isLoading && styles.loginButtonDisabled,
                ]}
                onPress={handleAppPasswordLogin}
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
                  <Text
                    style={styles.linkText}
                    onPress={() => openLink("https://bsky.app/settings/app-passwords")}
                  >
                    {t("auth.create_app_password_link")}
                  </Text>
                </Text>
              </View>
            </>
          )}

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>{t("auth.divider_or")}</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            testID="sign-up-button"
            style={styles.signUpButton}
            onPress={handleSignUp}
          >
            <Text style={styles.signUpButtonText}>
              {t("auth.sign_up_button")}
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            {t("auth.disclaimer")}{" "}
            <Text style={styles.link} onPress={() => openLink("https://shadowsky.io/terms")}>
              {t("auth.terms_of_service")}
            </Text>{" "}
            {t("auth.and")}{" "}
            <Text style={styles.link} onPress={() => openLink("https://shadowsky.io/privacy")}>
              {t("auth.privacy_policy")}
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
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
    fontSize: fontSize.largeTitle,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: fontSize.callout,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  formContainer: {
    width: "100%",
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
  },
  toggleButtonText: {
    fontSize: fontSize.subheadline,
    fontWeight: "600",
    color: colors.textTertiary,
  },
  toggleButtonTextActive: {
    color: colors.text,
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
    fontSize: fontSize.headline,
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
    fontSize: fontSize.subheadline,
    marginHorizontal: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: fontSize.subheadline,
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
    fontSize: fontSize.callout,
    color: colors.text,
  },
  helpText: {
    color: colors.textTertiary,
    fontSize: fontSize.caption1,
    marginTop: 6,
  },
  advancedToggle: {
    marginBottom: 16,
  },
  advancedToggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
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
    fontSize: fontSize.headline,
    fontWeight: "600",
  },
  infoContainer: {
    marginBottom: 20,
  },
  infoText: {
    color: colors.textSecondary,
    fontSize: fontSize.subheadline,
    textAlign: "center",
    lineHeight: 20,
  },
  linkText: {
    color: colors.primary,
    fontWeight: "600",
  },
  disclaimer: {
    color: colors.textTertiary,
    fontSize: fontSize.caption1,
    textAlign: "center",
  },
  link: {
    color: colors.info,
    textDecorationLine: "underline",
  },
  explainerContainer: {
    marginBottom: 20,
  },
  explainerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  explainerToggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.footnote,
  },
  explainerContent: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  explainerMethodTitle: {
    color: colors.text,
    fontSize: fontSize.footnote,
    fontWeight: "600",
    marginBottom: 4,
  },
  explainerMethodDescription: {
    color: colors.textSecondary,
    fontSize: fontSize.caption1,
    lineHeight: 18,
  },
  });
}
