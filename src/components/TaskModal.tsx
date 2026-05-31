import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Profile, GroupTask, Subtask, HABIT_COLORS, TaskPriority } from '../types';
import { T } from '../theme';

const AVATAR_COLORS = HABIT_COLORS;
function avatarColor(p: Profile) { return /^#[0-9A-Fa-f]{6}$/.test(p.emoji) ? p.emoji : AVATAR_COLORS[0]; }

// Auto-format DD/MM/YYYY pendant la frappe
function formatDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

function parseDate(val: string): string | undefined {
  const m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}`);
  if (isNaN(d.getTime())) return undefined;
  return `${yyyy}-${mm}-${dd}`;
}

function isoToDisplay(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

interface Props {
  visible: boolean;
  profiles: Profile[];
  activeId: string;
  task?: GroupTask;
  onSave: (title: string, description: string, assignedTo: string[], deadline?: string, priority?: TaskPriority, subtasks?: Subtask[]) => void;
  onClose: () => void;
}

export default function TaskModal({ visible, profiles, activeId, task, onSave, onClose }: Props) {
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [assignedTo,   setAssignedTo]   = useState<string[]>([activeId]);
  const [priority,     setPriority]     = useState<TaskPriority>('medium');
  const [dateRaw,      setDateRaw]      = useState('');
  const [dateError,    setDateError]    = useState(false);
  const [error,        setError]        = useState('');
  const [subtasks,     setSubtasks]     = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setAssignedTo(Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo]);
      setPriority(task.priority ?? 'medium');
      setDateRaw(isoToDisplay(task.deadline));
      setSubtasks(task.subtasks ?? []);
    } else {
      setTitle(''); setDescription('');
      setAssignedTo([activeId]); setPriority('medium'); setDateRaw('');
      setSubtasks([]);
    }
    setError(''); setDateError(false); setSubtaskInput('');
  }, [task, visible, activeId]);

  function addSubtask() {
    const t = subtaskInput.trim();
    if (!t) return;
    setSubtasks(prev => [...prev, { id: Date.now().toString(), title: t, done: false }]);
    setSubtaskInput('');
  }

  function removeSubtask(id: string) {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  }

  function toggleAssign(id: string) {
    setAssignedTo(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(x => x !== id) : prev) : [...prev, id]
    );
  }

  function handleSave() {
    if (!title.trim())         { setError('Le titre est obligatoire.'); return; }
    if (assignedTo.length === 0) { setError('Assigne la tâche à au moins une personne.'); return; }
    let deadline: string | undefined;
    if (dateRaw) {
      deadline = parseDate(dateRaw);
      if (!deadline) { setDateError(true); setError('Date invalide (format JJ/MM/AAAA).'); return; }
    }
    onSave(title.trim(), description.trim(), assignedTo, deadline, priority, subtasks);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>{task ? 'Modifier la tâche' : 'Nouvelle tâche'}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Titre */}
            <Text style={styles.label}>Titre *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={t => { setTitle(t); setError(''); }}
              placeholder="Titre de la tâche"
              placeholderTextColor={T.text3}
              selectionColor={T.accent}
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="Description"
              placeholderTextColor={T.text3}
              selectionColor={T.accent}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Assigner à */}
            <Text style={styles.label}>Assigner à</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.profileScroll}>
              {profiles.map(p => {
                const color    = avatarColor(p);
                const selected = assignedTo.includes(p.id);
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.profileChip, selected && { borderColor: color, backgroundColor: color + '22' }]}
                    onPress={() => toggleAssign(p.id)}
                  >
                    <View style={[styles.chipAvatar, { backgroundColor: color }]}>
                      <Text style={styles.chipAvatarLetter}>{p.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.chipName, selected && { color: T.text }]}>{p.name}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={14} color={color} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Priorité */}
            <Text style={styles.label}>Priorité</Text>
            <View style={styles.priorityRow}>
              {([
                { id: 'high',   label: '🔴 Haute',   color: '#EF4444' },
                { id: 'medium', label: '🟡 Moyenne',  color: '#F59E0B' },
                { id: 'low',    label: '🟢 Basse',    color: T.success },
              ] as { id: TaskPriority; label: string; color: string }[]).map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.priorityBtn, priority === p.id && { borderColor: p.color, backgroundColor: p.color + '20' }]}
                  onPress={() => setPriority(p.id)}
                >
                  <Text style={[styles.priorityTxt, priority === p.id && { color: p.color }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Deadline */}
            <Text style={styles.label}>
              Deadline <Text style={styles.optional}>(optionnel)</Text>
            </Text>
            <View style={[styles.dateRow, dateError && styles.dateRowError]}>
              <Ionicons name="calendar-outline" size={16} color={T.text2} />
              <TextInput
                style={styles.dateInput}
                value={dateRaw}
                onChangeText={t => { setDateRaw(formatDateInput(t)); setDateError(false); setError(''); }}
                placeholder="JJ/MM/AAAA"
                placeholderTextColor={T.text3}
                keyboardType={Platform.OS === 'web' ? 'default' : 'numeric'}
                maxLength={10}
                selectionColor={T.accent}
              />
            </View>
            {dateError && <Text style={styles.fieldError}>Format attendu : JJ/MM/AAAA</Text>}

            {/* Sous-tâches */}
            <Text style={styles.label}>
              Sous-tâches <Text style={styles.optional}>(optionnel)</Text>
            </Text>
            <View style={styles.subtaskInputRow}>
              <TextInput
                style={styles.subtaskInput}
                value={subtaskInput}
                onChangeText={setSubtaskInput}
                placeholder="Ajouter une sous-tâche…"
                placeholderTextColor={T.text3}
                selectionColor={T.accent}
                onSubmitEditing={addSubtask}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.subtaskAddBtn} onPress={addSubtask}>
                <Ionicons name="add" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            {subtasks.map(s => (
              <View key={s.id} style={styles.subtaskRow}>
                <Ionicons name="ellipse-outline" size={14} color={T.text3} />
                <Text style={styles.subtaskRowTitle} numberOfLines={1}>{s.title}</Text>
                <TouchableOpacity onPress={() => removeSubtask(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle-outline" size={16} color={T.error} />
                </TouchableOpacity>
              </View>
            ))}

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            {/* Boutons */}
            <View style={styles.btnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Ionicons name={task ? 'save-outline' : 'add'} size={16} color="#fff" />
                <Text style={styles.saveText}>{task ? 'Enregistrer' : 'Créer'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    maxHeight: '90%', paddingHorizontal: 20, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: T.border,
  },
  handle: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 20 },
  title:  { fontSize: 20, fontWeight: '800', color: T.text, marginBottom: 20 },
  label:  { fontSize: 11, color: T.text2, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  optional: { color: T.text3, fontWeight: '500', letterSpacing: 0, textTransform: 'none' },

  input: {
    backgroundColor: T.input, borderRadius: 14, paddingHorizontal: 16,
    paddingVertical: 13, color: T.text, fontSize: 15,
    borderWidth: 1, borderColor: T.border,
  },
  inputMulti: { minHeight: 80, paddingTop: 12 },

  profileScroll: { marginBottom: 4 },
  profileChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: T.cardAlt, borderRadius: 24,
    paddingHorizontal: 12, paddingVertical: 8,
    marginRight: 8, borderWidth: 1.5, borderColor: T.border,
  },
  chipAvatar:       { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  chipAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 12 },
  chipName:         { fontSize: 13, fontWeight: '600', color: T.text2 },

  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.input, borderRadius: 14,
    paddingHorizontal: 16, borderWidth: 1, borderColor: T.border,
  },
  dateRowError: { borderColor: T.error + '88' },
  dateInput: { flex: 1, paddingVertical: 13, color: T.text, fontSize: 15 },
  fieldError: { fontSize: 11, color: T.error, fontWeight: '600', marginTop: 4 },
  errorText:  { color: T.error, fontSize: 12, fontWeight: '600', marginTop: 10, textAlign: 'center' },

  btnRow:    { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: T.border, alignItems: 'center', backgroundColor: T.input },
  cancelText:{ color: T.text2, fontWeight: '600', fontSize: 15 },
  saveBtn:   { flex: 2, flexDirection: 'row', paddingVertical: 15, borderRadius: 14, backgroundColor: T.accent, alignItems: 'center', justifyContent: 'center', gap: 6 },
  saveText:  { color: '#fff', fontWeight: '800', fontSize: 15 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.input, alignItems: 'center' },
  priorityTxt: { fontSize: 12, fontWeight: '700', color: T.text2 },

  subtaskInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  subtaskInput: {
    flex: 1, backgroundColor: T.input, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 11, color: T.text, fontSize: 14,
    borderWidth: 1, borderColor: T.border,
  },
  subtaskAddBtn: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: T.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  subtaskRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border,
  },
  subtaskRowTitle: { flex: 1, fontSize: 13, color: T.text2 },
});
