import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { ChevronLeftIcon } from '../../../components/icons';

interface DataExportScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export function DataExportScreen({ navigation }: DataExportScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleExport = (_type: string) => {
    Alert.alert("Export Started", "Your data is being prepared for export...");
  };

  const handleImport = () => {
    Alert.alert(
      "Import",
      "Import functionality will be available in a future update.",
    );
  };

  const handleRequestAccountData = () => {
    Alert.alert(
      "Request Sent",
      "Bluesky will prepare your data. This may take up to 48 hours.",
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeftIcon size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data Export & Import</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.description}>
          Export your data or import from a backup
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export Data</Text>

          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Export Bookmarks</Text>
              <Text style={styles.cardDescription}>
                Download all your bookmarks as a JSON file
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleExport("bookmarks")}>
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Export Settings</Text>
              <Text style={styles.cardDescription}>
                Download your app settings and preferences
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleExport("settings")}>
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Export Muted Words</Text>
              <Text style={styles.cardDescription}>
                Download your muted words list
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleExport("mutedWords")}>
              <Text style={styles.exportButtonText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Import Data</Text>

          <TouchableOpacity style={styles.card} onPress={handleImport}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Import from Backup</Text>
              <Text style={styles.cardDescription}>
                Restore data from a previously exported file
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Data</Text>

          <TouchableOpacity
            style={styles.card}
            onPress={handleRequestAccountData}
          >
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>Request Account Data</Text>
              <Text style={styles.cardDescription}>
                Request a copy of all your data from Bluesky
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Exported data is saved in JSON format and can be used to restore
            your settings on another device or after reinstalling the app.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.surfaceElevated,
    },
    backButton: {
      padding: 4,
      width: 60,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    headerSpacer: {
      width: 60,
    },
    container: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 12,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardInfo: {
      flex: 1,
      marginRight: 12,
    },
    cardTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 4,
    },
    cardDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    exportButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.primary,
    },
    infoBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });
}
