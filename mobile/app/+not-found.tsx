import { View, Text, StyleSheet } from "react-native";
import { Link } from "expo-router";
import {fontSize} from '../src/utils/typography';

export default function NotFoundScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>This screen doesn't exist.</Text>
      <Link href="/" style={styles.link}>
        <Text style={styles.linkText}>Go to home screen</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  text: {
    color: "#ffffff",
    fontSize: fontSize.title3,
    fontWeight: "600",
  },
  link: {
    marginTop: 16,
    paddingVertical: 12,
  },
  linkText: {
    color: "#3b82f6",
    fontSize: fontSize.callout,
  },
});
