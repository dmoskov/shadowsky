import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import type {DrawerScreenPropsType} from '../../types/navigation';

type Props = DrawerScreenPropsType<'ScheduledPosts'>;

export function ScheduledPostsScreen({}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Scheduled Posts</Text>
      <Text style={styles.subtext}>Your queued posts will appear here</Text>
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
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 8,
  },
});
