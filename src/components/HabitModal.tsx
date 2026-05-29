import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Habit, HABIT_ICONS, getTodayKey, HabitType } from '../types';

interface Props {
  visible: boolean;
  habit?: Habit;
  onSave: (habit: Omit<Habit, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

export default function HabitModal({ visible, habit, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [xpReward, setXpReward] = useState('50');
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [type, setType] = useState<HabitType>('daily');
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 30 * 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDescription(habit.description);
      setXpReward(String(habit.xpReward));
      setIcon(habit.icon);
      setType(habit.type ?? 'daily');
      if (habit.endDate) setEndDate(new Date(habit.endDate));
    } else {
      setName('');
      setDescription('');
      setXpReward('50');
      setIcon(HABIT_ICONS[0]);
      setType('daily');
      setEndDate(new Date(Date.now() + 30 * 86400000));
    }
  }, [habit, visible]);

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      xpReward: Math.max(1, parseInt(xpReward) || 50),
      color: '#111827',
      icon,
      type,
      startDate: type === 'challenge' ? getTodayKey() : undefined,
      endDate: type === 'challenge' ? endDate.toISOString().split('T')[0] : undefined,
    });
  }

  const endDateStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{habit ? 'Modifier' : 'Nouvelle habitude'}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'daily' && styles.typeBtnActive]}
                onPress={() => setType('daily')}
              >
                <Text style={styles.typeIcon}>🔄</Text>
                <Text style={[styles.typeLabel, type === 'daily' && styles.typeLabelActive]}>Quotidienne</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'challenge' && styles.typeBtnActive]}
                onPress={() => setType('challenge')}
              >
                <Text style={styles.typeIcon}>🏆</Text>
                <Text style={[styles.typeLabel, type === 'challenge' && styles.typeLabelActive]}>Défi</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Icône</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {HABIT_ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBtn, ic === icon && styles.iconBtnActive]}
                  onPress={() => setIcon(ic)}
                >
                  <Text style={styles.iconBtnText}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Nom *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ex: Pause sucre"
              placeholderTextColor="#9CA3AF"
              selectionColor="#111827"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: Zéro sucre ajouté"
              placeholderTextColor="#9CA3AF"
              selectionColor="#111827"
            />

            <Text style={styles.label}>XP récompense / jour</Text>
            <TextInput
              style={styles.input}
              value={xpReward}
              onChangeText={setXpReward}
              keyboardType="numeric"
              placeholder="50"
              placeholderTextColor="#9CA3AF"
              selectionColor="#111827"
            />

            {type === 'challenge' && (
              <>
                <Text style={styles.label}>Date de fin du défi</Text>
                <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                  <Text style={styles.dateIcon}>📅</Text>
                  <Text style={styles.dateText}>{endDateStr}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={(_, d) => { setShowDatePicker(false); if (d) setEndDate(d); }}
                    themeVariant="light"
                  />
                )}
              </>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>{habit ? 'Enregistrer' : 'Créer'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '92%', paddingHorizontal: 20, paddingBottom: 40,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#E5E7EB',
    borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 20 },
  scroll: { flexGrow: 0 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 14,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
  },
  typeBtnActive: { borderColor: '#111827', backgroundColor: '#F3F4F6' },
  typeIcon: { fontSize: 18 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  typeLabelActive: { color: '#111827' },
  label: {
    fontSize: 11, color: '#6B7280', fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: '#F9FAFB',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
    borderWidth: 2, borderColor: 'transparent',
  },
  iconBtnActive: { borderColor: '#111827', backgroundColor: '#F3F4F6' },
  iconBtnText: { fontSize: 22 },
  input: {
    backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 13, color: '#111827', fontSize: 15,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9FAFB', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 13, borderWidth: 1, borderColor: '#E5E7EB',
  },
  dateIcon: { fontSize: 18 },
  dateText: { fontSize: 15, color: '#111827', fontWeight: '600' },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  cancelText: { color: '#6B7280', fontWeight: '600', fontSize: 15 },
  saveBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 14,
    backgroundColor: '#111827', alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
});
