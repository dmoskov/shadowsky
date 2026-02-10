import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface ProfileScreenProps {
  handle: string;
}

export function ProfileScreen({ handle }: ProfileScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {handle.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.handle}>@{handle}</Text>
      </View>
      <Text style={styles.subtext}>Profile details coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    paddingTop: 48,
  },
  header: {
    alignItems: "center",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "bold",
  },
  handle: {
    color: "#3b82f6",
    fontSize: 20,
    fontWeight: "600",
  },
  subtext: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 24,
  },
});
