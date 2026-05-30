import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Modal, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AppData, AllProfiles, GroupTask, Habit, Profile, getTodayKey, HABIT_COLORS } from '../types';
import { toggleGroupTask, saveAllProfiles } from '../utils/storage';
import { T } from '../theme';

const { width } = Dimensions.get('window');
const DAY_SIZE  = Math.floor((width - 40) / 7);
const MONTHS    = ['Janvier','Février','Mars','Avril','Mai','Juin',
  'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAYS = ['L','M','M','J','V','S','D'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function ds(y: number, m: number, d: number) { return `${y}-${pad(m+1)}-${pad(d)}`; }

function avatarColor(emoji: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(emoji) ? emoji : HABIT_COLORS[0];
}

function getDailyCompletion(data: AppData, date: string) {
  const daily = data.habits.filter(h => h.type === 'daily');
  if (!daily.length) return { percent: 0 };
  const done = data.entries.filter(e => e.date === date && e.status === 'yes' && daily.some(h => h.id === e.habitId)).length;
  return { percent: done / daily.length };
}

function getChallengeHabits(data: AppData): Habit[] {
  return data.habits.filter(h => h.type === 'challenge' && h.startDate && h.endDate);
}

function isChallengeDay(habit: Habit, date: string) {
  return date >= (habit.startDate ?? '') && date <= (habit.endDate ?? '');
}

function isChallengeSuccess(data: AppData, habit: Habit, date: string) {
  return data.entries.some(e => e.habitId === habit.id && e.date === date && e.status === 'yes');
}

function getBarColor(percent: number): [string, string] {
  if (percent === 0)   return ['transparent', 'transparent'];
  if (percent < 0.34)  return ['#7F1D1D', '#991B1B'];
  if (percent < 0.67)  return ['#92400E', '#B45309'];
  if (percent < 1)     return ['#14532D', '#15803D'];
  return [T.accent, T.accentSoft];
}

type FilterKey = 'habits' | 'defis' | 'tasks';

interface Props {
  data: AppData;
  all: AllProfiles;
  onChange?: (all: AllProfiles) => void;
}

export default function CalendarScreen({ data, all, onChange }: Props) {
  const today = new Date();
  const [year,    setYear]    = useState(today.getFullYear());
  const [month,   setMonth]   = useState(today.getMonth());
  const [filters,      setFilters]      = useState<Set<FilterKey>>(new Set(['habits', 'defis', 'tasks']));
  const [selectedTask, setSelectedTask] = useState<GroupTask | null>(null);
  const todayStr = getTodayKey();

  function toggleFilter(f: FilterKey) {
    setFilters(prev => {
      const next = new Set(prev);
      if (next.has(f) && next.size > 1) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }

  const firstDay    = new Date(year, month, 1);
  const daysInMonth = new Date(year, month+1, 0).getDate();
  let startOffset   = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const dailyHabits     = data.habits.filter(h => h.type === 'daily');
  const challengeHabits = getChallengeHabits(data);

  // Tâches avec deadline dans ce mois
  const tasks = all.groupTasks ?? [];
  const tasksThisMonth = useMemo(() => {
    const map: Record<string, GroupTask[]> = {};
    for (const task of tasks) {
      if (task.deadline) {
        if (!map[task.deadline]) map[task.deadline] = [];
        map[task.deadline].push(task);
      }
    }
    return map;
  }, [tasks]);

  // Stats du mois
  let perfectDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = ds(year, month, d);
    if (date > todayStr) continue;
    const { percent } = getDailyCompletion(data, date);
    if (dailyHabits.length > 0 && percent === 1) perfectDays++;
  }

  const tasksDueCount = Object.entries(tasksThisMonth)
    .filter(([date]) => date.startsWith(`${year}-${pad(month+1)}`))
    .reduce((sum, [, t]) => sum + t.length, 0);

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const FILTER_PILLS: { id: FilterKey; label: string; icon: string; color: string }[] = [
    { id: 'habits', label: 'Habitudes', icon: 'checkmark-circle-outline', color: T.accent },
    { id: 'defis',  label: 'Défis',     icon: 'flag-outline',             color: '#F59E0B' },
    { id: 'tasks',  label: 'Tâches',    icon: 'checkbox-outline',         color: '#3B82F6' },
  ];

  function handleToggleTask(task: GroupTask) {
    const updated = toggleGroupTask(all, task.id);
    onChange?.(updated);
    saveAllProfiles(updated);
    // Mettre à jour la tâche sélectionnée localement
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    setSelectedTask({ ...task, status: newStatus as any });
  }

  const assignees = selectedTask
    ? all.profiles.filter(p => {
        const ids = Array.isArray(selectedTask.assignedTo) ? selectedTask.assignedTo : [selectedTask.assignedTo];
        return ids.includes(p.id);
      })
    : [];
  const assigner = selectedTask ? all.profiles.find(p => p.id === selectedTask.assignedBy) : null;

  function formatDate(iso?: string) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0C1F0E', '#0A150C']} style={styles.header}>
        <Text style={styles.title}>Calendrier</Text>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}><Text style={styles.statVal}>{perfectDays}</Text><Text style={styles.statLbl}>Jours parfaits</Text></View>
          <View style={styles.statDiv} />
          <View style={styles.stat}><Text style={styles.statVal}>{challengeHabits.length}</Text><Text style={styles.statLbl}>Défis actifs</Text></View>
          <View style={styles.statDiv} />
          <View style={styles.stat}><Text style={[styles.statVal, { color: '#3B82F6' }]}>{tasksDueCount}</Text><Text style={styles.statLbl}>Tâches dues</Text></View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Filtres ── */}
        <View style={styles.filters}>
          {FILTER_PILLS.map(f => {
            const active = filters.has(f.id);
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterPill, active && { backgroundColor: f.color + '22', borderColor: f.color + '77' }]}
                onPress={() => toggleFilter(f.id)}
              >
                <Ionicons name={f.icon as any} size={13} color={active ? f.color : T.text3} />
                <Text style={[styles.filterText, active && { color: f.color }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Labels jours ── */}
        <View style={styles.dayLabels}>
          {DAYS.map((d, i) => (
            <View key={i} style={[styles.dayLabelCell, { width: DAY_SIZE }]}>
              <Text style={styles.dayLabel}>{d}</Text>
            </View>
          ))}
        </View>

        {/* ── Semaines ── */}
        {Array.from({ length: cells.length / 7 }, (_, wi) => {
          const week = cells.slice(wi*7, wi*7+7);
          const weekDates = week.map(d => d ? ds(year, month, d) : null);

          return (
            <View key={wi}>
              <View style={styles.weekRow}>
                {week.map((day, di) => {
                  if (!day) return <View key={di} style={[styles.cell, { width: DAY_SIZE, height: DAY_SIZE }]} />;
                  const date    = ds(year, month, day);
                  const isFuture = date > todayStr;
                  const isToday  = date === todayStr;

                  // Habitudes
                  const { percent } = getDailyCompletion(data, date);
                  const hasHabitData = filters.has('habits') && dailyHabits.length > 0 && percent > 0 && !isFuture;
                  const [c1, c2]    = getBarColor(percent);
                  const isPerfect   = percent === 1 && !isFuture;

                  // Défis actifs ce jour
                  const activeChallenges = filters.has('defis')
                    ? challengeHabits.filter(h => isChallengeDay(h, date))
                    : [];

                  // Tâches dues ce jour
                  const dayTasks = filters.has('tasks') ? (tasksThisMonth[date] ?? []) : [];
                  const hasTasks = dayTasks.length > 0;

                  const pctInt = Math.round(percent * 100);
                  const barColor = percent === 1
                    ? T.accent
                    : percent >= 0.67 ? '#15803D'
                    : percent >= 0.34 ? '#B45309'
                    : '#991B1B';

                  const cellH = DAY_SIZE + dayTasks.length * 13;

                  return (
                    <View key={di} style={[styles.cell, { width: DAY_SIZE, height: cellH }]}>
                      <View style={[styles.dayInner, isToday && styles.todayBorder, { height: cellH }]}>
                        <View style={[StyleSheet.absoluteFill, styles.emptyDayBg]} />

                        {/* Numéro */}
                        <Text style={[
                          styles.dayNum,
                          isToday  && styles.dayNumToday,
                          isFuture && styles.dayNumFuture,
                          !isFuture && filters.has('habits') && percent > 0 && styles.dayNumActive,
                        ]}>{day}</Text>

                        {/* Titres des tâches — tappable */}
                        {dayTasks.map(task => {
                          const done   = task.status === 'done';
                          const tColor = done ? T.success : T.error;
                          return (
                            <TouchableOpacity key={task.id} onPress={() => setSelectedTask(task)} activeOpacity={0.7}>
                              <Text style={[styles.taskInCell, { color: tColor, textDecorationLine: done ? 'line-through' : 'none' }]} numberOfLines={1}>
                                {task.title}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}

                        {/* Dots défis */}
                        <View style={styles.indicators}>
                          {activeChallenges.slice(0, 2).map(h => (
                            <View key={h.id} style={[styles.dot, { backgroundColor: h.color }]} />
                          ))}
                        </View>

                        {/* Barre de progression habitudes */}
                        {filters.has('habits') && !isFuture && dailyHabits.length > 0 && (
                          <View style={styles.habitBarTrack}>
                            <View style={[styles.habitBarFill, {
                              width: `${pctInt}%` as any,
                              backgroundColor: barColor,
                            }]} />
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Barres défis */}
              {filters.has('defis') && challengeHabits.map(habit => {
                const firstInWeek = weekDates.findIndex(d => d && isChallengeDay(habit, d));
                const lastInWeek  = [...weekDates].reverse().findIndex(d => d && isChallengeDay(habit, d));
                if (firstInWeek === -1) return null;
                const lastIdx  = 6 - lastInWeek;
                const barLeft  = firstInWeek * DAY_SIZE + 4;
                const barWidth = (lastIdx - firstInWeek + 1) * DAY_SIZE - 8;
                const successes = weekDates.filter(d => d && isChallengeDay(habit, d) && isChallengeSuccess(data, habit, d!)).length;
                const active    = weekDates.filter(d => d && isChallengeDay(habit, d) && d! <= todayStr).length;
                const pct       = active > 0 ? successes / active : 0;
                const opacity   = active === 0 ? 0.3 : 0.9;

                return (
                  <View key={habit.id} style={styles.challengeBarRow}>
                    <View style={[styles.challengeBar, { left: barLeft, width: barWidth, backgroundColor: habit.color+'22', borderColor: habit.color+'55', opacity }]}>
                      <View style={[styles.challengeBarFill, { width: `${Math.round(pct*100)}%`, backgroundColor: habit.color }]} />
                      <Text style={[styles.challengeBarLabel, { color: habit.color }]} numberOfLines={1}>{habit.name}</Text>
                    </View>
                  </View>
                );
              })}

            </View>
          );
        })}

        {/* ── Légende ── */}
        <View style={styles.legend}>
          {filters.has('habits') && (
            <>
              <Text style={styles.legendTitle}>Habitudes quotidiennes</Text>
              <View style={styles.legendItems}>
                {[
                  { color: '#991B1B', label: '1–33%' },
                  { color: '#B45309', label: '34–66%' },
                  { color: '#15803D', label: '67–99%' },
                  { color: T.accent,  label: '100%' },
                ].map(item => (
                  <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
          {filters.has('defis') && challengeHabits.length > 0 && (
            <>
              <Text style={[styles.legendTitle, { marginTop: 12 }]}>Défis en cours</Text>
              {challengeHabits.map(h => (
                <View key={h.id} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: h.color }]} />
                  <Text style={styles.legendLabel}>{h.name} · jusqu'au {h.endDate}</Text>
                </View>
              ))}
            </>
          )}
          {filters.has('tasks') && (
            <>
              <Text style={[styles.legendTitle, { marginTop: 12 }]}>Tâches avec deadline</Text>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
                <Text style={styles.legendLabel}>Tâche à rendre</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: T.success }]} />
                <Text style={styles.legendLabel}>Tâche terminée</Text>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Bottom sheet détail tâche ── */}
      <Modal visible={!!selectedTask} animationType="slide" transparent onRequestClose={() => setSelectedTask(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedTask(null)} />
        {selectedTask && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {/* Statut + titre */}
            <View style={styles.sheetTitleRow}>
              <TouchableOpacity
                style={[styles.sheetCheckbox, selectedTask.status === 'done' && { backgroundColor: T.success, borderColor: T.success }]}
                onPress={() => handleToggleTask(selectedTask)}
              >
                {selectedTask.status === 'done' && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
              <Text style={[styles.sheetTitle, selectedTask.status === 'done' && styles.sheetTitleDone]}>
                {selectedTask.title}
              </Text>
            </View>

            {/* Statut pill */}
            <View style={[styles.sheetStatusPill, { backgroundColor: selectedTask.status === 'done' ? T.success + '22' : T.error + '22', borderColor: selectedTask.status === 'done' ? T.success + '66' : T.error + '66' }]}>
              <Ionicons name={selectedTask.status === 'done' ? 'checkmark-circle' : 'time-outline'} size={12} color={selectedTask.status === 'done' ? T.success : T.error} />
              <Text style={[styles.sheetStatusText, { color: selectedTask.status === 'done' ? T.success : T.error }]}>
                {selectedTask.status === 'done' ? 'Terminée' : 'À faire'}
              </Text>
            </View>

            {/* Description */}
            {!!selectedTask.description && (
              <>
                <Text style={styles.sheetSectionLabel}>Description</Text>
                <Text style={styles.sheetDesc}>{selectedTask.description}</Text>
              </>
            )}

            {/* Deadline */}
            {!!selectedTask.deadline && (
              <View style={styles.sheetRow}>
                <Ionicons name="calendar-outline" size={15} color={T.text2} />
                <Text style={styles.sheetRowText}>Deadline : {formatDate(selectedTask.deadline)}</Text>
              </View>
            )}

            {/* Assignés */}
            {assignees.length > 0 && (
              <>
                <Text style={styles.sheetSectionLabel}>Assigné à</Text>
                <View style={styles.sheetAssignees}>
                  {assignees.map(p => {
                    const color = /^#[0-9A-Fa-f]{6}$/.test(p.emoji) ? p.emoji : HABIT_COLORS[0];
                    return (
                      <View key={p.id} style={styles.sheetAssignee}>
                        <View style={[styles.sheetAvatar, { backgroundColor: color }]}>
                          <Text style={styles.sheetAvatarLetter}>{p.name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <Text style={styles.sheetAssigneeName}>{p.name}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* Par qui */}
            {assigner && (
              <View style={styles.sheetRow}>
                <Ionicons name="person-outline" size={15} color={T.text2} />
                <Text style={styles.sheetRowText}>Créée par {assigner.name}</Text>
              </View>
            )}

            {/* Bouton cocher */}
            <TouchableOpacity
              style={[styles.sheetToggleBtn, { backgroundColor: selectedTask.status === 'done' ? T.cardAlt : T.success }]}
              onPress={() => handleToggleTask(selectedTask)}
            >
              <Ionicons name={selectedTask.status === 'done' ? 'refresh-outline' : 'checkmark-circle'} size={18} color="#fff" />
              <Text style={styles.sheetToggleTxt}>
                {selectedTask.status === 'done' ? 'Marquer à faire' : 'Marquer terminée'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: T.bg },
  header: { paddingTop: 56, paddingHorizontal: 16, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  title:  { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 4, marginBottom: 16 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  navBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  statsRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, paddingVertical: 12 },
  stat:     { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLbl:  { fontSize: 10, color: '#64748B', marginTop: 2 },
  statDiv:  { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingVertical: 12 },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    backgroundColor: T.cardAlt, borderColor: T.border,
  },
  filterText: { fontSize: 12, color: T.text3, fontWeight: '600' },

  scroll:      { paddingHorizontal: 16, paddingTop: 4 },
  dayLabels:   { flexDirection: 'row', marginBottom: 2 },
  dayLabelCell:{ alignItems: 'center', paddingVertical: 4 },
  dayLabel:    { fontSize: 10, color: T.text3, fontWeight: '700' },
  weekRow:     { flexDirection: 'row' },
  cell:        { padding: 1.5 },
  dayInner: {
    flex: 1, borderRadius: 9, overflow: 'hidden',
    alignItems: 'center', paddingTop: 3, paddingBottom: 2,
  },
  emptyDayBg:   { backgroundColor: T.cardAlt, opacity: 0.6 },
  todayBorder:  { borderWidth: 1.5, borderColor: T.accent },
  dayNum:       { fontSize: 11, fontWeight: '600', color: T.text2, zIndex: 1 },
  dayNumActive: { color: T.text, fontWeight: '700' },
  dayNumToday:  { color: T.accentSoft, fontWeight: '800' },
  dayNumFuture: { color: T.text3 },
  habitBarTrack:{ width: '90%', height: 4, backgroundColor: T.border, borderRadius: 2, overflow: 'hidden', marginTop: 'auto' as any },
  habitBarFill: { height: '100%', borderRadius: 2 },

  indicators: { flexDirection: 'row', gap: 2, marginTop: 2, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 2 },
  dot:        { width: 5, height: 5, borderRadius: 2.5 },

  challengeBarRow: { height: 20, position: 'relative', marginBottom: 1 },
  challengeBar:    { position: 'absolute', top: 2, height: 16, borderRadius: 8, borderWidth: 1, overflow: 'hidden', justifyContent: 'center' },
  challengeBarFill:{ position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 8 },
  challengeBarLabel:{ fontSize: 8, fontWeight: '700', paddingHorizontal: 6, zIndex: 1, color: '#fff' },

  taskInCell: { fontSize: 7, fontWeight: '700', width: '100%', textAlign: 'center', paddingHorizontal: 2, lineHeight: 13 },

  sheetBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: T.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 40,
    borderTopWidth: 1, borderTopColor: T.border,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: T.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  sheetCheckbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: T.border,
    backgroundColor: T.cardAlt, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  sheetTitle:     { flex: 1, fontSize: 20, fontWeight: '800', color: T.text },
  sheetTitleDone: { textDecorationLine: 'line-through', color: T.text2 },
  sheetStatusPill:{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, marginBottom: 16 },
  sheetStatusText:{ fontSize: 12, fontWeight: '700' },
  sheetSectionLabel: { fontSize: 11, color: T.text2, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 12 },
  sheetDesc:      { fontSize: 14, color: T.text2, lineHeight: 20 },
  sheetRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  sheetRowText:   { fontSize: 14, color: T.text2, fontWeight: '600' },
  sheetAssignees: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sheetAssignee:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetAvatar:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sheetAvatarLetter: { color: '#fff', fontWeight: '800', fontSize: 13 },
  sheetAssigneeName: { fontSize: 14, color: T.text, fontWeight: '600' },
  sheetToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  sheetToggleTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },

  legend:      { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 16, padding: 14 },
  legendTitle: { fontSize: 10, color: T.accentSoft, fontWeight: '700', letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  legendItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:   { width: 9, height: 9, borderRadius: 4.5 },
  legendLabel: { fontSize: 10, color: T.text2 },
});
