import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, AllProfiles, Profile, Habit, DailyEntry, getTodayKey, isChallengeActive, checkBadges } from '../types';
import { supabase, getDeviceId } from './supabase';

const PROFILES_KEY = 'kaban_profiles_v1';
const LEGACY_KEY = 'xp_tracker_data_v2';

function makeDefaultAppData(): AppData {
  return {
    habits: [
      { id: '1', name: 'Faire du sport', description: '30 minutes minimum', xpReward: 80, color: '#111827', icon: '💪', createdAt: getTodayKey(), type: 'daily' },
      { id: '2', name: 'Lire', description: '20 pages par jour', xpReward: 50, color: '#111827', icon: '📚', createdAt: getTodayKey(), type: 'daily' },
    ],
    entries: [],
    totalXP: 0,
    earnedBadges: [],
  };
}

function makeDefaultProfiles(): AllProfiles {
  const profileId = 'profile_1';
  return {
    profiles: [{ id: profileId, name: 'Profil 1', emoji: '🦖', createdAt: getTodayKey() }],
    activeId: profileId,
    data: { [profileId]: makeDefaultAppData() },
  };
}

async function syncToSupabase(all: AllProfiles): Promise<void> {
  try {
    const deviceId = await getDeviceId();
    await supabase.from('kaban_data').upsert(
      { device_id: deviceId, data: all, updated_at: new Date().toISOString() },
      { onConflict: 'device_id' }
    );
  } catch {}
}

async function loadFromSupabase(): Promise<AllProfiles | null> {
  try {
    const deviceId = await getDeviceId();
    const { data, error } = await supabase.from('kaban_data').select('data').eq('device_id', deviceId).single();
    if (error || !data) return null;
    const parsed = data.data as AllProfiles;
    if (!parsed.profiles) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadAllProfiles(): Promise<AllProfiles> {
  const remote = await loadFromSupabase();
  if (remote) {
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(remote));
    return remote;
  }
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw) as AllProfiles;

    // Migration depuis l'ancien format
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as AppData;
      if (!old.earnedBadges) old.earnedBadges = [];
      const profileId = 'profile_1';
      const all: AllProfiles = {
        profiles: [{ id: profileId, name: 'Profil 1', emoji: '🦖', createdAt: getTodayKey() }],
        activeId: profileId,
        data: { [profileId]: old },
      };
      await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(all));
      return all;
    }
  } catch {}
  return makeDefaultProfiles();
}

export async function saveAllProfiles(all: AllProfiles): Promise<void> {
  await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(all));
  syncToSupabase(all);
}

export function getActiveData(all: AllProfiles): AppData {
  return all.data[all.activeId] ?? makeDefaultAppData();
}

export function setActiveData(all: AllProfiles, data: AppData): AllProfiles {
  return { ...all, data: { ...all.data, [all.activeId]: data } };
}

export function createProfile(all: AllProfiles, name: string, emoji: string): AllProfiles {
  const id = `profile_${Date.now()}`;
  const profile: Profile = { id, name, emoji, createdAt: getTodayKey() };
  const emptyData: AppData = { habits: [], entries: [], totalXP: 0, earnedBadges: [] };
  return {
    ...all,
    profiles: [...all.profiles, profile],
    activeId: id,
    data: { ...all.data, [id]: emptyData },
  };
}

export function switchProfile(all: AllProfiles, id: string): AllProfiles {
  return { ...all, activeId: id };
}

export function deleteProfile(all: AllProfiles, id: string): AllProfiles {
  if (all.profiles.length <= 1) return all;
  const profiles = all.profiles.filter(p => p.id !== id);
  const newData = { ...all.data };
  delete newData[id];
  const activeId = all.activeId === id ? profiles[0].id : all.activeId;
  return { ...all, profiles, activeId, data: newData };
}

export function renameProfile(all: AllProfiles, id: string, name: string, emoji: string): AllProfiles {
  return {
    ...all,
    profiles: all.profiles.map(p => p.id === id ? { ...p, name, emoji } : p),
  };
}

// Fonctions compatibilité (utilisées par HomeScreen)
export function getEntryForHabit(data: AppData, habitId: string, date?: string): DailyEntry | undefined {
  const d = date ?? getTodayKey();
  return data.entries.find(e => e.date === d && e.habitId === habitId);
}

export function getTodayActiveHabits(data: AppData): Habit[] {
  const today = getTodayKey();
  return data.habits.filter(h => isChallengeActive(h, today));
}

export function setHabitStatus(
  data: AppData, habitId: string, status: 'yes' | 'no' | 'pending', xpReward: number, date?: string,
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

// Legacy - gardé pour compatibilité
export async function loadData(): Promise<AppData> {
  const all = await loadAllProfiles();
  return getActiveData(all);
}

export async function saveData(data: AppData): Promise<void> {
  const raw = await AsyncStorage.getItem(PROFILES_KEY);
  if (!raw) return;
  const all = JSON.parse(raw) as AllProfiles;
  await saveAllProfiles(setActiveData(all, data));
}
