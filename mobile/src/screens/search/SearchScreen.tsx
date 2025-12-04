import React from 'react';
import {View, Text, TextInput, StyleSheet} from 'react-native';
import type {SearchStackScreenProps} from '../../types/navigation';

type Props = SearchStackScreenProps<'Search'>;

export function SearchScreen({route}: Props) {
  const {query} = route.params ?? {};

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          placeholder="Search posts, users, feeds..."
          placeholderTextColor="#6b7280"
          defaultValue={query}
        />
      </View>
      <View style={styles.content}>
        <Text style={styles.text}>Search</Text>
        <Text style={styles.subtext}>Tabbed search interface coming soon</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  searchBar: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  content: {
    flex: 1,
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
