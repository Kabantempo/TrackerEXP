export type HabitType = 'daily' | 'challenge';

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  check: (data: AppData) => boolean;
}

export interface Habit {
  id: string;
  name: string;
  description: string;
  xpReward: number;
  color: string;
  icon: string;
  createdAt: string;
  type: HabitType;
  startDate?: string; // YYYY-MM-DD, pour les défis
  endDate?: string;   // YYYY-MM-DD, pour les défis
}

export interface DailyEntry {
  date: string; // YYYY-MM-DD
  habitId: string;
  status: 'yes' | 'no' | 'pending';
  xpEarned: number;
}

export interface AppData {
  habits: Habit[];
  entries: DailyEntry[];
  totalXP: number;
  earnedBadges: string[];
}

export const HABIT_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#D97706',
  '#DC2626', '#DB2777', '#0891B2', '#65A30D',
];

export const HABIT_ICONS = [
  '💪', '📚', '🏃', '🧘', '🎯', '💧', '🍎', '😴',
  '✍️', '🎨', '🎵', '🧠', '💊', '🌿', '🔥', '⭐',
  '🚭', '🍬', '🍷', '💻', '🧹', '💰', '📱', '🎮',
];

export function getLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 50));
}

export function getXPForLevel(level: number): number {
  return level * level * 50;
}

export function getXPProgress(xp: number): { level: number; current: number; required: number; percent: number } {
  const level = getLevel(xp);
  const current = xp - getXPForLevel(level);
  const required = getXPForLevel(level + 1) - getXPForLevel(level);
  return { level, current, required, percent: required > 0 ? current / required : 0 };
}

export function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function getCurrentStreak(data: AppData): number {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateKey = d.toISOString().split('T')[0];
    const hasYes = data.entries.some(e => e.date === dateKey && e.status === 'yes');
    if (!hasYes) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first_yes',
    name: 'Premier Oui !',
    description: 'Complète ta première habitude',
    icon: '🎯',
    rarity: 'common',
    check: d => d.entries.some(e => e.status === 'yes'),
  },
  {
    id: 'entries_5',
    name: 'Régulier',
    description: '5 habitudes complétées au total',
    icon: '💪',
    rarity: 'common',
    check: d => d.entries.filter(e => e.status === 'yes').length >= 5,
  },
  {
    id: 'entries_20',
    name: 'Assidu',
    description: '20 habitudes complétées au total',
    icon: '🏃',
    rarity: 'rare',
    check: d => d.entries.filter(e => e.status === 'yes').length >= 20,
  },
  {
    id: 'entries_50',
    name: 'Inarrêtable',
    description: '50 habitudes complétées au total',
    icon: '⚡',
    rarity: 'epic',
    check: d => d.entries.filter(e => e.status === 'yes').length >= 50,
  },
  {
    id: 'xp_100',
    name: 'Apprenti',
    description: 'Atteins 100 XP',
    icon: '⭐',
    rarity: 'common',
    check: d => d.totalXP >= 100,
  },
  {
    id: 'xp_500',
    name: 'Initié',
    description: 'Atteins 500 XP',
    icon: '💫',
    rarity: 'rare',
    check: d => d.totalXP >= 500,
  },
  {
    id: 'xp_1000',
    name: 'Expert',
    description: 'Atteins 1 000 XP',
    icon: '🏆',
    rarity: 'epic',
    check: d => d.totalXP >= 1000,
  },
  {
    id: 'xp_5000',
    name: 'Légende',
    description: 'Atteins 5 000 XP',
    icon: '👑',
    rarity: 'legendary',
    check: d => d.totalXP >= 5000,
  },
  {
    id: 'streak_3',
    name: 'En feu !',
    description: '3 jours consécutifs',
    icon: '🔥',
    rarity: 'common',
    check: d => getCurrentStreak(d) >= 3,
  },
  {
    id: 'streak_7',
    name: 'Semaine de feu',
    description: '7 jours consécutifs',
    icon: '🌟',
    rarity: 'rare',
    check: d => getCurrentStreak(d) >= 7,
  },
  {
    id: 'habits_5',
    name: 'Collectionneur',
    description: 'Crée 5 habitudes',
    icon: '📋',
    rarity: 'rare',
    check: d => d.habits.length >= 5,
  },
  {
    id: 'challenge_done',
    name: 'Relevé le défi',
    description: 'Complète un défi à 100%',
    icon: '🏅',
    rarity: 'epic',
    check: d => d.habits.some(h => {
      if (h.type !== 'challenge') return false;
      const { done, total } = getChallengeProgress(d, h);
      return total > 0 && done >= total;
    }),
  },
];

export function checkBadges(data: AppData): AppData {
  const earned = new Set(data.earnedBadges ?? []);
  let changed = false;
  for (const badge of BADGES) {
    if (!earned.has(badge.id) && badge.check(data)) {
      earned.add(badge.id);
      changed = true;
    }
  }
  if (!changed) return data;
  return { ...data, earnedBadges: Array.from(earned) };
}

export function isChallengeActive(habit: Habit, date: string): boolean {
  if (habit.type !== 'challenge') return true;
  const start = habit.startDate ?? habit.createdAt;
  const end = habit.endDate;
  if (date < start) return false;
  if (end && date > end) return false;
  return true;
}

export function getChallengeProgress(data: AppData, habit: Habit): { done: number; total: number; percent: number } {
  if (habit.type !== 'challenge') return { done: 0, total: 0, percent: 0 };
  const start = habit.startDate ?? habit.createdAt;
  const end = habit.endDate ?? getTodayKey();
  const startD = new Date(start);
  const endD = new Date(end);
  const total = Math.max(1, Math.floor((endD.getTime() - startD.getTime()) / 86400000) + 1);
  const done = data.entries.filter(e => e.habitId === habit.id && e.status === 'yes' && e.date >= start && e.date <= end).length;
  return { done, total, percent: done / total };
}
