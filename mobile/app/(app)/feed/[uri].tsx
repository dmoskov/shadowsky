import { useMemo } from "react";
import { useRequiredParam } from "../../../src/hooks/useRequiredParam";
import { ErrorState } from "../../../src/components/ErrorState";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { useTheme } from "../../../src/contexts/ThemeContext";
import {fontSize} from '../../../src/utils/typography';

/**
 * Feed route handler for deep linking
 * Handles URLs like: bsky.app/feeds/{feedUri}
 */
export default function FeedRoute() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { value: uri, isValid } = useRequiredParam("uri");

  if (!isValid || !uri) {
    return <ErrorState message="Missing feed URI" />;
  }

  // Decode the URI in case it was URL encoded
  const decodedUri = decodeURIComponent(uri);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.text}>Loading feed...</Text>
        <Text style={styles.uri}>{decodedUri}</Text>
      </View>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    text: {
      color: colors.text,
      fontSize: fontSize.callout,
      marginTop: 16,
    },
    uri: {
      color: colors.textSecondary,
      fontSize: fontSize.caption1,
      marginTop: 8,
      textAlign: "center",
    },
  });
}
