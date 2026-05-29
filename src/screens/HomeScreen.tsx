import React, { useState, useEffect, useCallback } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, Text,
  Alert, StatusBar, SafeAreaView,
} from 'react-native';
import XPHeader from '../components/XPHeader';
import HabitCard from '../components/HabitCard';
import HabitModal from '../components/HabitModal';
import { AppData, Habit, getTodayKey } from '../types';
import { loadData, saveData, getEntryForHabit, setHabitStatus } from '../utils/storage';

interface Props {
  onDataChange?: (data: AppData) => void;
}

export default function HomeScreen({ onDataChange }: Props) {
  const [data, setData] = useState<AppData>({ habits: [], entries: [], totalXP: 0, earnedBadges: [] });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadData().then(d => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      saveData(data);
      onDataChange?.(data);
    }
  }, [data, loaded]);

  const today = getTodayKey();
  const todayEntries = data.entries.filter(e => e.date === today);
  const completedToday = todayEntries.filter(e => e.status === 'yes').length;

  function handleToggle(habit: Habit, status: 'yes' | 'no') {
    const entry = getEntryForHabit(data, habit.id);
    const newStatus = entry?.status === status ? 'pending' : status;
    setData(prev => setHabitStatus(prev, habit.id, newStatus, habit.xpReward));
  }

  function handleSaveHabit(form: Omit<Habit, 'id' | 'createdAt'>) {
    if (editingHabit) {
      setData(prev => ({
        ...prev,
        habits: prev.habits.map(h =>
          h.id === editingHabit.id ? { ...editingHabit, ...form } : h
        ),
      }));
    } else {
      const newHabit: Habit = {
        ...form,
        id: Date.now().toString(),
        createdAt: getTodayKey(),
      };
      setData(prev => ({ ...prev, habits: [...prev.habits, newHabit] }));
    }
    setModalVisible(false);
    setEditingHabit(undefined);
  }

  function handleEdit(habit: Habit) {
    setEditingHabit(habit);
    setModalVisible(true);
  }

  function handleDelete(habit: Habit) {
    Alert.alert(
      'Supprimer',
      `Supprimer "${habit.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () =>
            setData(prev => ({
              ...prev,
              habits: prev.habits.filter(h => h.id !== habit.id),
              entries: prev.entries.filter(e => e.habitId !== habit.id),
            })),
        },
      ]
    );
  }

  function openAddModal() {
    setEditingHabit(undefined);
    setModalVisible(true);
  }

  const renderItem = useCallback(({ item }: { item: Habit }) => {
    const entry = getEntryForHabit(data, item.id);
    return (
      <HabitCard
        habit={item}
        entry={entry}
        data={data}
        onYes={() => handleToggle(item, 'yes')}
        onNo={() => handleToggle(item, 'no')}
        onEdit={() => handleEdit(item)}
        onDelete={() => handleDelete(item)}
      />
    );
  }, [data]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A0533" />
      <FlatList
        data={data.habits}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <XPHeader
            totalXP={data.totalXP}
            completedToday={completedToday}
            totalHabits={data.habits.length}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>Aucune habitude</Text>
            <Text style={styles.emptyDesc}>Ajoute ta première habitude pour commencer à gagner de l'XP !</Text>

          </View>
        }
        ListFooterComponent={<View style={{ height: 160 }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.fabWrapper}>
        <TouchableOpacity onPress={openAddModal} activeOpacity={0.85} style={styles.fab}>
            <Text style={styles.fabIcon}>+</Text>
            <Text style={styles.fabText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <HabitModal
        visible={modalVisible}
        habit={editingHabit}
        onSave={handleSaveHabit}
        onClose={() => {
          setModalVisible(false);
          setEditingHabit(undefined);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  list: {
    paddingTop: 0,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 32,
    gap: 8,
    backgroundColor: '#111827',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '300',
    lineHeight: 24,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
