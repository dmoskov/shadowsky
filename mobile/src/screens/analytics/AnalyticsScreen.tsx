import React from "react";
import { View, Text, StyleSheet } from "react-native";

export function AnalyticsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>User Analytics</Text>
      <Text style={styles.subtext}>
        Engagement metrics and insights coming soon
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
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
  },
  subtext: {
    color: "#9ca3af",
    fontSize: 14,
    marginTop: 8,
  },
});
