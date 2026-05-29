import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export type TabName = 'home' | 'calendar' | 'badges';

interface Props {
  active: TabName;
  onChange: (tab: TabName) => void;
}

const TABS: { id: TabName; icon: string; label: string }[] = [
  { id: 'home',     icon: '🏠', label: 'Habitudes' },
  { id: 'calendar', icon: '📅', label: 'Calendrier' },
  { id: 'badges',   icon: '🏅', label: 'Badges' },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.bar}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => onChange(tab.id)}>
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, active === tab.id && styles.labelActive]}>
              {tab.label}
            </Text>
            {active === tab.id && <View style={styles.dot} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 20,
  },
  bar: {
    flexDirection: 'row',
    paddingBottom: 20,
    paddingTop: 10,
  },
  tab: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  icon: { fontSize: 22 },
  label: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  labelActive: { color: '#111827' },
  dot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#111827', marginTop: 2,
  },
});
