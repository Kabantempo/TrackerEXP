import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, Habit, DailyEntry, getTodayKey, isChallengeActive, checkBadges } from '../types';
import { supabase, getDeviceId } from './supabase';

const STORAGE_KEY = 'xp_tracker_data_v2';

const DEFAULT_DATA: AppData = {
  habits: [
    {
      id: '1',
      name: 'Faire du sport',
      description: '30 minutes minimum',
      xpReward: 80,
      color: '#7C3AED',
      icon: '💪',
      createdAt: getTodayKey(),
      type: 'daily',
    },
    {
      id: '2',
      name: 'Lire',
      description: '20 pages par jour',
      xpReward: 50,
      color: '#2563EB',
      icon: '📚',
      createdAt: getTodayKey(),
      type: 'daily',
    },
    {
      id: '3',
      name: 'Pause sucre',
      description: 'Zéro sucre ajouté',
      xpReward: 100,
      color: '#059669',
      icon: '🍬',
      createdAt: getTodayKey(),
      type: 'challenge',
      startDate: getTodayKey(),
      endDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
      })(),
    },
  ],
  entries: [],
  totalXP: 0,
  earnedBadges: [],
};

async function loadFromSupabase(): Promise<AppData | null> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase
      .from('kaban_data')
      .select('data')
      .eq('device_id', deviceId)
      .single();
    if (error || !data) return null;
    const parsed = data.data as AppData;
    if (!parsed.earnedBadges) parsed.earnedBadges = [];
    return parsed;
  } catch {
    return null;
  }
}

async function syncToSupabase(appData: AppData): Promise<void> {
  const deviceId = await getDeviceId();
  await supabase.from('kaban_data').upsert(
    { device_id: deviceId, data: appData, updated_at: new Date().toISOString() },
    { onConflict: 'device_id' }
  );
}

export async function loadData(): Promise<AppData> {
  const remoteData = await loadFromSupabase();
  if (remoteData) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remoteData));
    return remoteData;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed.earnedBadges) parsed.earnedBadges = [];
    return parsed;
  } catch {
    return DEFAULT_DATA;
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  syncToSupabase(data).catch(() => {});
}

export function getEntryForHabit(data: AppData, habitId: string, date?: string): DailyEntry | undefined {
  const d = date ?? getTodayKey();
  return data.entries.find(e => e.date === d && e.habitId === habitId);
}

export function getTodayActiveHabits(data: AppData): Habit[] {
  const today = getTodayKey();
  return data.habits.filter(h => isChallengeActive(h, today));
}

export function setHabitStatus(
  data: AppData,
  habitId: string,
  status: 'yes' | 'no' | 'pending',
  xpReward: number,
  date?: string,
): AppData {
  const today = date ?? getTodayKey();
  const existing = data.entries.find(e => e.date === today && e.habitId === habitId);
  let xpDelta = 0;

  if (existing) {
    xpDelta -= existing.xpEarned;
    const newEntries = data.entries.filter(e => !(e.date === today && e.habitId === habitId));
    if (status !== 'pending') {
      const newXP = status === 'yes' ? xpReward : 0;
      xpDelta += newXP;
      newEntries.push({ date: today, habitId, status, xpEarned: newXP });
    }
    return { ...data, entries: newEntries, totalXP: Math.max(0, data.totalXP + xpDelta) };
  }

  if (status === 'pending') return data;
  const newXP = status === 'yes' ? xpReward : 0;
  return {
    ...data,
    entries: [...data.entries, { date: today, habitId, status, xpEarned: newXP }],
    totalXP: Math.max(0, data.totalXP + newXP),
  };
}
