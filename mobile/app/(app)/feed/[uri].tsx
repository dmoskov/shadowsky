import { useRequiredParam } from "../../../src/hooks/useRequiredParam";
import { ErrorState } from "../../../src/components/ErrorState";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import {fontSize} from '../../../src/utils/typography';

/**
 * Feed route handler for deep linking
 * Handles URLs like: bsky.app/feeds/{feedUri}
 */
export default function FeedRoute() {
  const { value: uri, isValid } = useRequiredParam("uri");

  if (!isValid || !uri) {
    return <ErrorState message="Missing feed URI" />;
  }

  // Decode the URI in case it was URL encoded
  const decodedUri = decodeURIComponent(uri);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#1d9bf0" />
        <Text style={styles.text}>Loading feed...</Text>
        <Text style={styles.uri}>{decodedUri}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0f",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  text: {
    color: "#ffffff",
    fontSize: fontSize.callout,
    marginTop: 16,
  },
  uri: {
    color: "#8b8b8b",
    fontSize: fontSize.caption1,
    marginTop: 8,
    textAlign: "center",
  },
});
