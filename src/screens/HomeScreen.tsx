import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Text, Alert, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import XPHeader from '../components/XPHeader';
import HabitCard from '../components/HabitCard';
import HabitModal from '../components/HabitModal';
import { AppData, Habit, Profile, getTodayKey } from '../types';
import { getEntryForHabit, setHabitStatus, autoCompleteChallengesToday, saveAllProfiles } from '../utils/storage';
import { T } from '../theme';

interface Props {
  onDataChange?: (data: AppData) => void;
  profileData?: AppData;
  profile?: Profile;
  onProfilePress?: () => void;
}

export default function HomeScreen({ onDataChange, profileData, profile, onProfilePress }: Props) {
  const [data, setData] = useState<AppData>(
    profileData ?? { habits: [], entries: [], totalXP: 0, earnedBadges: [] }
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>();

  useEffect(() => {
    if (profileData) {
      // Auto-valide les défis actifs dès l'ouverture
      const updated = autoCompleteChallengesToday(profileData);
      setData(updated);
      if (updated !== profileData) onDataChange?.(updated);
    }
  }, [profileData, profile?.id]);

  const today         = getTodayKey();
  const completedToday = data.entries.filter(e => e.date === today && e.status === 'yes').length;

  function handleToggle(habit: Habit, status: 'yes' | 'no') {
    const entry = getEntryForHabit(data, habit.id);
    const newStatus = entry?.status === status ? 'pending' : status;
    const newData = setHabitStatus(data, habit.id, newStatus, habit.xpReward);
    setData(newData);
    onDataChange?.(newData);
  }

  function handleSaveHabit(form: Omit<Habit, 'id' | 'createdAt'>) {
    let newData: AppData;
    if (editingHabit) {
      newData = { ...data, habits: data.habits.map(h => h.id === editingHabit.id ? { ...editingHabit, ...form } : h) };
    } else {
      const newHabit: Habit = { ...form, id: Date.now().toString(), createdAt: getTodayKey() };
      newData = { ...data, habits: [...data.habits, newHabit] };
    }
    setData(newData);
    onDataChange?.(newData);
    setModalVisible(false);
    setEditingHabit(undefined);
  }

  function handleDelete(habit: Habit) {
    Alert.alert('Supprimer', `Supprimer "${habit.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive',
        onPress: () => {
          const newData = {
            ...data,
            habits: data.habits.filter(h => h.id !== habit.id),
            entries: data.entries.filter(e => e.habitId !== habit.id),
          };
          setData(newData);
          onDataChange?.(newData);
        },
      },
    ]);
  }

  const renderItem = useCallback(({ item }: { item: Habit }) => (
    <HabitCard
      habit={item}
      entry={getEntryForHabit(data, item.id)}
      data={data}
      onYes={() => handleToggle(item, 'yes')}
      onNo={() => handleToggle(item, 'no')}
      onEdit={() => { setEditingHabit(item); setModalVisible(true); }}
      onDelete={() => handleDelete(item)}
    />
  ), [data]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.bg} />
      <FlatList
        data={data.habits}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        extraData={data}
        ListHeaderComponent={
          <XPHeader
            totalXP={data.totalXP}
            completedToday={completedToday}
            totalHabits={data.habits.length}
            profile={profile ?? { id: '', name: 'Moi', emoji: T.accent, createdAt: '' }}
            onProfilePress={onProfilePress ?? (() => {})}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconBg}>
              <Ionicons name="add-circle-outline" size={48} color={T.text3} />
            </View>
            <Text style={styles.emptyTitle}>Aucune habitude</Text>
            <Text style={styles.emptyDesc}>Ajoute ta première habitude pour commencer à gagner de l'XP !</Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 160 }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.fabWrapper}>
        <TouchableOpacity onPress={() => { setEditingHabit(undefined); setModalVisible(true); }} activeOpacity={0.85} style={styles.fab}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <HabitModal
        visible={modalVisible}
        habit={editingHabit}
        onSave={handleSaveHabit}
        onClose={() => { setModalVisible(false); setEditingHabit(undefined); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  list: { paddingTop: 0 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
  emptyIconBg: { marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: T.text2, textAlign: 'center', lineHeight: 20 },
  fabWrapper: { position: 'absolute', bottom: 90, left: 0, right: 0, alignItems: 'center' },
  fab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 28, paddingVertical: 14,
    borderRadius: 32, gap: 8,
    backgroundColor: T.accent,
    shadowColor: T.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
