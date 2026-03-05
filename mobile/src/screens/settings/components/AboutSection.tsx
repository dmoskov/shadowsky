import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../contexts/ThemeContext";
import { openLink } from "../../../utils/browser";
import { SettingRow } from "./SettingRow";
import { createSectionStyles } from "./settingsStyles";
import {fontSize} from '../../../utils/typography';

const APP_VERSION = "0.7.0";

export function AboutSection() {
  const { colors: themeColors } = useTheme();
  const sectionStyles = createSectionStyles(themeColors);
  const styles = createStyles(themeColors);

  const handleOpenBluesky = async () => {
    try {
      await openLink("https://bsky.app");
    } catch {
      Alert.alert("Error", "Cannot open Bluesky");
    }
  };

  const handleOpenGitHub = async () => {
    try {
      await openLink("https://github.com/yourusername/shadowsky");
    } catch {
      Alert.alert("Error", "Cannot open GitHub");
    }
  };

  return (
    <>
      <View style={sectionStyles.section}>
        <Text style={sectionStyles.sectionTitle}>ABOUT</Text>

        <SettingRow label="App Name" value="Asphodel" />
        <SettingRow label="Version" value={APP_VERSION} />

        <SettingRow
          label="View on Bluesky"
          onPress={handleOpenBluesky}
          showChevron
        />

        <SettingRow
          label="Report a Bug"
          onPress={handleOpenGitHub}
          showChevron
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Asphodel v{APP_VERSION}</Text>
        <Text style={styles.footerSubtext}>A third-party Bluesky client</Text>
      </View>
    </>
  );
}

const createStyles = (themeColors: Record<string, string>) =>
  StyleSheet.create({
    footer: {
      padding: 24,
      alignItems: "center",
    },
    footerText: {
      color: themeColors.textTertiary,
      fontSize: fontSize.subheadline,
      fontWeight: "600",
    },
    footerSubtext: {
      color: themeColors.textTertiary,
      fontSize: fontSize.caption1,
      marginTop: 4,
    },
  });
