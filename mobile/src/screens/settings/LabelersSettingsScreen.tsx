import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { ChevronLeft } from "lucide-react-native";

interface LabelersSettingsScreenProps {
  navigation: {
    goBack: () => void;
  };
}

export function LabelersSettingsScreen({
  navigation,
}: LabelersSettingsScreenProps) {
  const { colors } = useTheme();
  const _auth = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [labelers, setLabelers] = useState<string[]>([]);
  const [didInput, setDidInput] = useState("");

  const handleAddLabeler = () => {
    const trimmedDid = didInput.trim();

    if (!trimmedDid.startsWith("did:")) {
      Alert.alert("Invalid DID", "Please enter a valid DID starting with 'did:'");
      return;
    }

    setLabelers((prev) => [...prev, trimmedDid]);
    setDidInput("");
    Alert.alert("Labeler Added", "Successfully subscribed to labeler");
  };

  const handleUnsubscribe = (did: string) => {
    Alert.alert(
      "Unsubscribe",
      `Are you sure you want to unsubscribe from ${did}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unsubscribe",
          style: "destructive",
          onPress: () => {
            setLabelers((prev) => prev.filter((d) => d !== did));
          },
        },
      ],
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
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Labelers</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Manage content labeling services that help moderate your feeds
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Labeler</Text>
          <TextInput
            style={styles.input}
            value={didInput}
            onChangeText={setDidInput}
            placeholder="Enter labeler DID (did:plc:...)"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddLabeler}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscribed Labelers</Text>
          {labelers.length === 0 ? (
            <Text style={styles.emptyText}>
              No labelers subscribed. Add one above to get started.
            </Text>
          ) : (
            labelers.map((did) => (
              <View key={did} style={styles.labelerItem}>
                <Text style={styles.labelerDid} numberOfLines={1}>
                  {did}
                </Text>
                <TouchableOpacity
                  style={styles.unsubscribeButton}
                  onPress={() => handleUnsubscribe(did)}
                >
                  <Text style={styles.unsubscribeButtonText}>Unsubscribe</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>About Labelers</Text>
          <Text style={styles.infoText}>
            Labelers are services that apply labels to content to help with
            moderation. You can subscribe to labelers to customize how content is
            filtered in your feeds.
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
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: 4,
      width: 40,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.text,
      flex: 1,
      textAlign: "center",
    },
    headerSpacer: {
      width: 40,
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
    input: {
      backgroundColor: colors.surface,
      color: colors.text,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    addButton: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
    },
    addButtonText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "600",
    },
    labelerItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    labelerDid: {
      flex: 1,
      fontSize: 14,
      color: colors.text,
      marginRight: 12,
    },
    unsubscribeButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.danger,
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 20,
    },
    unsubscribeButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "600",
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    infoBox: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });
}
