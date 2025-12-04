import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {HomeStackScreenProps} from '../../types/navigation';

type Props = HomeStackScreenProps<'ListTimeline'>;

export function ListTimelineScreen({route}: Props) {
  const {listId} = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>List Timeline</Text>
      <Text style={styles.listId}>List: {listId}</Text>
      <Text style={styles.subtext}>Posts from this list will appear here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  listId: {
    color: '#3b82f6',
    fontSize: 14,
    marginTop: 8,
    fontFamily: 'monospace',
  },
  subtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
});
