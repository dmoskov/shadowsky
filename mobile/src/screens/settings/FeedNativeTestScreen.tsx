import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { FeedNativeView } from "../../../modules/feed-native";

export function FeedNativeTestScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Feed Native Module Test</Text>
        <Text style={styles.description}>
          Testing the SwiftUI native view integration
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Default Message</Text>
        <View style={styles.viewContainer}>
          <FeedNativeView style={styles.nativeView} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Message</Text>
        <View style={styles.viewContainer}>
          <FeedNativeView
            message="SwiftUI + React Native = 🚀"
            style={styles.nativeView}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Another Example</Text>
        <View style={styles.viewContainer}>
          <FeedNativeView
            message="Native Performance!"
            style={styles.nativeView}
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    padding: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#666",
  },
  section: {
    marginTop: 20,
    backgroundColor: "#fff",
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  viewContainer: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    overflow: "hidden",
  },
  nativeView: {
    width: "100%",
    height: 250,
  },
});
