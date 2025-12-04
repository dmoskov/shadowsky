import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {HomeStackScreenProps} from '../../types/navigation';

type Props = HomeStackScreenProps<'Thread'>;

export function ThreadScreen({route}: Props) {
  const {handle, postId} = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Thread View</Text>
      <Text style={styles.subtext}>@{handle}</Text>
      <Text style={styles.postId}>Post: {postId}</Text>
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
  subtext: {
    color: '#3b82f6',
    fontSize: 16,
    marginTop: 8,
  },
  postId: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'monospace',
  },
});
