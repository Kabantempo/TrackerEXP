import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Habit, HABIT_COLORS, HABIT_ICONS, getTodayKey, HabitType } from '../types';

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
  const [color, setColor] = useState(HABIT_COLORS[0]);
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [type, setType] = useState<HabitType>('daily');
  const [endDate, setEndDate] = useState<Date>(new Date(Date.now() + 30 * 86400000));
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDescription(habit.description);
      setXpReward(String(habit.xpReward));
      setColor(habit.color);
      setIcon(habit.icon);
      setType(habit.type ?? 'daily');
      if (habit.endDate) setEndDate(new Date(habit.endDate));
    } else {
      setName('');
      setDescription('');
      setXpReward('50');
      setColor(HABIT_COLORS[0]);
      setIcon(HABIT_ICONS[0]);
      setType('daily');
      setEndDate(new Date(Date.now() + 30 * 86400000));
    }
  }, [habit, visible]);

  function handleSave() {
    if (!name.trim()) return;
    const endStr = endDate.toISOString().split('T')[0];
    onSave({
      name: name.trim(),
      description: description.trim(),
      xpReward: Math.max(1, parseInt(xpReward) || 50),
      color,
      icon,
      type,
      startDate: type === 'challenge' ? getTodayKey() : undefined,
      endDate: type === 'challenge' ? endStr : undefined,
    });
  }

  const endDateStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <LinearGradient colors={['#130826', '#0A1535']} style={styles.sheetGrad}>
            <View style={styles.handle} />
            <Text style={styles.title}>{habit ? 'Modifier' : 'Nouvelle habitude'}</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type toggle */}
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

              {/* Icône */}
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
                placeholderTextColor="#334155"
                selectionColor="#A855F7"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Ex: Zéro sucre ajouté"
                placeholderTextColor="#334155"
                selectionColor="#A855F7"
              />

              <Text style={styles.label}>XP récompense / jour</Text>
              <TextInput
                style={styles.input}
                value={xpReward}
                onChangeText={setXpReward}
                keyboardType="numeric"
                placeholder="50"
                placeholderTextColor="#334155"
                selectionColor="#A855F7"
              />

              {/* Date fin pour défi */}
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
                      themeVariant="dark"
                    />
                  )}
                </>
              )}

              {/* Couleur */}
              <Text style={styles.label}>Couleur</Text>
              <View style={styles.colorRow}>
                {HABIT_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorBtn, { backgroundColor: c }, c === color && styles.colorBtnActive]}
                    onPress={() => setColor(c)}
                  >
                    {c === color && <Text style={styles.colorCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <LinearGradient colors={['#A855F7', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtnGrad}>
                    <Text style={styles.saveText}>{habit ? 'Enregistrer' : 'Créer'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', maxHeight: '92%' },
  sheetGrad: { padding: 20, paddingBottom: 40 },
  handle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginBottom: 20 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  typeBtnActive: { borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.15)' },
  typeIcon: { fontSize: 18 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  typeLabelActive: { color: '#A855F7' },
  label: { fontSize: 11, color: '#A855F7', fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 2, borderColor: 'transparent',
  },
  iconBtnActive: { borderColor: '#A855F7', backgroundColor: 'rgba(168,85,247,0.15)' },
  iconBtnText: { fontSize: 22 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 13, color: '#F1F5F9', fontSize: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(168,85,247,0.3)',
  },
  dateIcon: { fontSize: 18 },
  dateText: { fontSize: 15, color: '#E2E8F0', fontWeight: '600' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  colorBtnActive: { borderWidth: 3, borderColor: '#fff' },
  colorCheck: { color: '#fff', fontWeight: '900', fontSize: 14 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontWeight: '600', fontSize: 15 },
  saveBtn: { flex: 2, borderRadius: 14, overflow: 'hidden' },
  saveBtnGrad: { paddingVertical: 15, alignItems: 'center', borderRadius: 14 },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
});
