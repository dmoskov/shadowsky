import React from 'react';
import {View, Text, ScrollView, TouchableOpacity, StyleSheet} from 'react-native';
import type {DrawerScreenPropsType} from '../../types/navigation';

type Props = DrawerScreenPropsType<'Settings'>;

const SETTINGS_SECTIONS = [
  {id: 'account', title: 'Account', description: 'Manage your account settings'},
  {id: 'appearance', title: 'Appearance', description: 'Theme, colors, and display'},
  {id: 'notifications', title: 'Notifications', description: 'Push and in-app notifications'},
  {id: 'privacy', title: 'Privacy', description: 'Control your data and visibility'},
  {id: 'accessibility', title: 'Accessibility', description: 'Screen reader and motion settings'},
  {id: 'storage', title: 'Storage', description: 'Data sync and local storage'},
  {id: 'about', title: 'About', description: 'App version and legal info'},
];

export function SettingsScreen({route}: Props) {
  const {section} = route.params ?? {};

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Settings</Text>
      {section && (
        <Text style={styles.activeSection}>Active section: {section}</Text>
      )}

      {SETTINGS_SECTIONS.map(item => (
        <TouchableOpacity key={item.id} style={styles.item}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemDescription}>{item.description}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    padding: 16,
    paddingTop: 24,
  },
  activeSection: {
    color: '#3b82f6',
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    minHeight: 44, // WCAG 2.1 touch target minimum
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  itemDescription: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
});
