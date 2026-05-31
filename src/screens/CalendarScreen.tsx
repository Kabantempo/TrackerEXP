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

type FilterKey = 'habits' | 'defis' | 'tasks' | 'commits';

interface Props {
  data: AppData;
  all: AllProfiles;
  onChange?: (all: AllProfiles) => void;
}

export default function CalendarScreen({ data, all, onChange }: Props) {
  const today = new Date();
  const [year,    setYear]    = useState(today.getFullYear());
  const [month,   setMonth]   = useState(today.getMonth());
  const [filters,      setFilters]      = useState<Set<FilterKey>>(new Set(['habits', 'defis', 'tasks', 'commits']));
  const [selectedTask, setSelectedTask] = useState<GroupTask | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
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

  // Commits GitHub par date
  const commits = all.githubCommits ?? [];
  const commitsThisMonth = useMemo(() => {
    const prefix = `${year}-${pad(month + 1)}`;
    const map: Record<string, typeof commits> = {};
    for (const c of commits) {
      if (c.date.startsWith(prefix)) {
        if (!map[c.date]) map[c.date] = [];
        map[c.date].push(c);
      }
    }
    return map;
  }, [commits, year, month]);

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
    { id: 'habits',  label: 'Habitudes', icon: 'checkmark-circle-outline', color: T.accent },
    { id: 'defis',   label: 'Défis',     icon: 'flag-outline',             color: '#F59E0B' },
    { id: 'tasks',   label: 'Tâches',    icon: 'checkbox-outline',         color: '#3B82F6' },
    { id: 'commits', label: 'GitHub',    icon: 'git-commit-outline',       color: '#8b949e' },
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

                  // Commits ce jour
                  const dayCommits = filters.has('commits') ? (commitsThisMonth[date] ?? []) : [];
                  const hasCommits = dayCommits.length > 0;

                  const pctInt = Math.round(percent * 100);
                  const barColor = percent === 1
                    ? T.accent
                    : percent >= 0.67 ? '#15803D'
                    : percent >= 0.34 ? '#B45309'
                    : '#991B1B';

                  return (
                    <View key={di} style={[styles.cell, { width: DAY_SIZE, height: DAY_SIZE }]}>
                      <TouchableOpacity
                        style={[styles.dayInner, isToday && styles.todayBorder]}
                        onPress={() => setSelectedDate(date)}
                        activeOpacity={0.7}
                      >
                        <View style={[StyleSheet.absoluteFill, styles.emptyDayBg]} />

                        {/* Numéro */}
                        <Text style={[
                          styles.dayNum,
                          isToday  && styles.dayNumToday,
                          isFuture && styles.dayNumFuture,
                          !isFuture && filters.has('habits') && percent > 0 && styles.dayNumActive,
                        ]}>{day}</Text>

                        {/* Tâches — rectangles colorés */}
                        {dayTasks.map(task => {
                          const done   = task.status === 'done';
                          const tColor = done ? T.success : T.error;
                          return (
                            <TouchableOpacity key={task.id} onPress={() => setSelectedTask(task)} activeOpacity={0.75} style={{ width: '100%' }}>
                              <View style={[styles.taskRect, { backgroundColor: tColor + '30', borderLeftColor: tColor }]}>
                                <Text style={[styles.taskRectText, { color: tColor, textDecorationLine: done ? 'line-through' : 'none' }]} numberOfLines={1}>
                                  {task.title}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}

                        {/* Point commit GitHub */}
                        {hasCommits && (
                          <View style={styles.commitDotRow}>
                            <View style={styles.commitDot} />
                            {dayCommits.length > 1 && <Text style={styles.commitDotCount}>{dayCommits.length}</Text>}
                          </View>
                        )}

                        {/* Barre de progression habitudes */}
                        {filters.has('habits') && !isFuture && dailyHabits.length > 0 && (
                          <View style={styles.habitBarTrack}>
                            <View style={[styles.habitBarFill, {
                              width: `${pctInt}%` as any,
                              backgroundColor: barColor,
                            }]} />
                          </View>
                        )}
                      </TouchableOpacity>
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
                      <Text style={styles.challengeBarLabel} numberOfLines={1}>{habit.name}</Text>
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
          {filters.has('commits') && Object.keys(commitsThisMonth).length > 0 && (
            <>
              <Text style={[styles.legendTitle, { marginTop: 12 }]}>Commits GitHub ce mois</Text>
              {Object.entries(commitsThisMonth)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, dayCommits]) => (
                  <View key={date} style={styles.commitGroup}>
                    <Text style={styles.commitGroupDate}>{date}</Text>
                    {dayCommits.map(c => (
                      <View key={`${c.repo}-${c.sha}`} style={styles.commitLegendRow}>
                        <Text style={styles.commitLegendSha}>{c.sha}</Text>
                        <Text style={styles.commitLegendMsg} numberOfLines={1}>{c.message}</Text>
                      </View>
                    ))}
                  </View>
                ))
              }
            </>
          )}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Bottom sheet détail du jour ── */}
      <Modal visible={!!selectedDate} animationType="slide" transparent onRequestClose={() => setSelectedDate(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setSelectedDate(null)} />
        {selectedDate && (() => {
          const dayTasks   = tasksThisMonth[selectedDate] ?? [];
          const dayCommits = commitsThisMonth[selectedDate] ?? [];
          const { percent } = getDailyCompletion(data, selectedDate);
          const [dd, mm, yyyy] = [selectedDate.slice(8,10), selectedDate.slice(5,7), selectedDate.slice(0,4)];
          const hasAnything = dayTasks.length > 0 || dayCommits.length > 0 || (dailyHabits.length > 0 && !isFutureFn(selectedDate));

          function isFutureFn(d: string) { return d > todayStr; }

          return (
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />

              {/* Date + stats */}
              <View style={styles.daySheetHeader}>
                <Text style={styles.daySheetDate}>{dd}/{mm}/{yyyy}</Text>
                {selectedDate === todayStr && (
                  <View style={styles.daySheetTodayBadge}>
                    <Text style={styles.daySheetTodayTxt}>Aujourd'hui</Text>
                  </View>
                )}
              </View>

              {!hasAnything ? (
                <View style={styles.daySheetEmpty}>
                  <Ionicons name="calendar-outline" size={32} color={T.text3} />
                  <Text style={styles.daySheetEmptyTxt}>Rien ce jour</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>

                  {/* Habitudes */}
                  {dailyHabits.length > 0 && !isFutureFn(selectedDate) && (
                    <View style={styles.daySheetSection}>
                      <Text style={styles.daySheetSectionTitle}>Habitudes</Text>
                      <View style={styles.daySheetHabitBar}>
                        <View style={[styles.daySheetHabitFill, { width: `${Math.round(percent * 100)}%` as any, backgroundColor: percent === 1 ? T.accent : percent >= 0.5 ? '#15803D' : '#B45309' }]} />
                        <Text style={styles.daySheetHabitPct}>{Math.round(percent * 100)}%</Text>
                      </View>
                    </View>
                  )}

                  {/* Commits GitHub */}
                  {dayCommits.length > 0 && (
                    <View style={styles.daySheetSection}>
                      <Text style={styles.daySheetSectionTitle}>
                        <Ionicons name="logo-github" size={11} color="#8b949e" /> Commits · {dayCommits.length}
                      </Text>
                      {dayCommits.map(c => {
                        const repoShort = c.repo.split('/')[1] ?? c.repo;
                        return (
                          <View key={`${c.repo}-${c.sha}`} style={styles.daySheetCommit}>
                            <View style={styles.daySheetCommitLeft}>
                              <View style={styles.daySheetCommitShaWrap}>
                                <Text style={styles.daySheetCommitSha}>{c.sha}</Text>
                              </View>
                              <View style={styles.daySheetRepoBadge}>
                                <Ionicons name="git-branch-outline" size={9} color="#8b949e" />
                                <Text style={styles.daySheetRepoName}>{repoShort}</Text>
                              </View>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.daySheetCommitMsg} numberOfLines={2}>{c.message}</Text>
                              <Text style={styles.daySheetCommitAuthor}>{c.author}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* Tâches */}
                  {dayTasks.length > 0 && (
                    <View style={styles.daySheetSection}>
                      <Text style={styles.daySheetSectionTitle}>Tâches · {dayTasks.length}</Text>
                      {dayTasks.map(task => {
                        const done = task.status === 'done';
                        return (
                          <TouchableOpacity
                            key={task.id}
                            style={styles.daySheetTask}
                            onPress={() => { setSelectedDate(null); setTimeout(() => setSelectedTask(task), 200); }}
                          >
                            <View style={[styles.daySheetTaskDot, { backgroundColor: done ? T.success : T.error }]} />
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.daySheetTaskTitle, done && { textDecorationLine: 'line-through', opacity: 0.5 }]} numberOfLines={1}>
                                {task.title}
                              </Text>
                              {task.description ? <Text style={styles.daySheetTaskDesc} numberOfLines={1}>{task.description}</Text> : null}
                            </View>
                            <View style={[styles.daySheetTaskStatus, { backgroundColor: done ? T.success + '22' : T.error + '22' }]}>
                              <Text style={[styles.daySheetTaskStatusTxt, { color: done ? T.success : T.error }]}>
                                {done ? 'Fait' : 'À faire'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <View style={{ height: 20 }} />
                </ScrollView>
              )}
            </View>
          );
        })()}
      </Modal>

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

  taskRect:     { borderLeftWidth: 2, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1.5, marginTop: 1.5, width: '100%' },
  taskRectText: { fontSize: 7, fontWeight: '700', textAlign: 'left' },

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

  daySheetHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  daySheetDate:        { fontSize: 22, fontWeight: '900', color: T.text },
  daySheetTodayBadge:  { backgroundColor: T.accentDim, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  daySheetTodayTxt:    { fontSize: 11, color: T.accentSoft, fontWeight: '700' },
  daySheetEmpty:       { alignItems: 'center', paddingVertical: 30, gap: 8 },
  daySheetEmptyTxt:    { fontSize: 14, color: T.text3 },
  daySheetSection:     { marginBottom: 18 },
  daySheetSectionTitle:{ fontSize: 11, color: T.text2, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  daySheetHabitBar:    { height: 10, backgroundColor: T.cardAlt, borderRadius: 5, overflow: 'hidden', position: 'relative' },
  daySheetHabitFill:   { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 5 },
  daySheetHabitPct:    { position: 'absolute', right: 6, top: -1, fontSize: 9, color: T.text2, fontWeight: '700' },
  daySheetCommit:      { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: T.border },
  daySheetCommitLeft:  { gap: 4, alignItems: 'flex-start', flexShrink: 0 },
  daySheetCommitShaWrap:{ backgroundColor: '#161b22', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  daySheetCommitSha:   { fontSize: 10, color: '#58a6ff', fontWeight: '700' },
  daySheetRepoBadge:   { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#30363d', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  daySheetRepoName:    { fontSize: 9, color: '#8b949e', fontWeight: '600' },
  daySheetCommitMsg:   { fontSize: 13, fontWeight: '600', color: T.text, lineHeight: 17 },
  daySheetCommitAuthor:{ fontSize: 11, color: T.text3, marginTop: 2 },
  daySheetTask:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: T.border },
  daySheetTaskDot:     { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  daySheetTaskTitle:   { fontSize: 14, fontWeight: '600', color: T.text },
  daySheetTaskDesc:    { fontSize: 11, color: T.text3, marginTop: 2 },
  daySheetTaskStatus:  { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  daySheetTaskStatusTxt:{ fontSize: 10, fontWeight: '700' },

  commitDotRow:   { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1.5 },
  commitDot:      { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#8b949e' },
  commitDotCount: { fontSize: 6, color: '#8b949e', fontWeight: '700' },

  commitGroup:        { marginBottom: 10 },
  commitGroupDate:    { fontSize: 10, color: T.text2, fontWeight: '700', marginBottom: 4 },
  commitLegendRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  commitLegendSha:    { fontSize: 9, color: '#58a6ff', fontWeight: '700', backgroundColor: '#161b22', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  commitLegendMsg:    { fontSize: 10, color: T.text2, flex: 1 },
});
