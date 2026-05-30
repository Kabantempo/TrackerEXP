import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppData, AllProfiles, Profile, Habit, DailyEntry, LaboSession, GroupTask, TaskStatus, getTodayKey, isChallengeActive, checkBadges, timeToMinutes } from '../types';
import { supabase, getTeamId } from './supabase';

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
    const teamId = await getTeamId();
    if (!teamId) return;
    await supabase.from('kaban_data').upsert(
      { device_id: teamId, data: all, updated_at: new Date().toISOString() },
      { onConflict: 'device_id' }
    );
  } catch {}
}

export async function loadFromSupabase(): Promise<AllProfiles | null> {
  try {
    const teamId = await getTeamId();
    if (!teamId) return null;
    const { data, error } = await supabase.from('kaban_data').select('data').eq('device_id', teamId).single();
    if (error || !data) return null;
    const parsed = data.data as AllProfiles;
    if (!parsed.profiles) return null;
    return parsed;
  } catch {
    return null;
  }
}

// Vérifie si un code d'équipe existe déjà dans Supabase
export async function teamExists(teamId: string): Promise<boolean> {
  try {
    const { data } = await supabase.from('kaban_data').select('device_id').eq('device_id', teamId.toUpperCase()).single();
    return !!data;
  } catch { return false; }
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

export function hashPassword(pwd: string): string {
  let h = 5381;
  for (let i = 0; i < pwd.length; i++) h = ((h << 5) + h) ^ pwd.charCodeAt(i);
  return (h >>> 0).toString(36);
}

export function createProfile(all: AllProfiles, name: string, emoji: string, password?: string): AllProfiles {
  if (all.profiles.length >= 6) return all; // max 6 profils
  const id = `profile_${Date.now()}`;
  const profile: Profile = {
    id, name, emoji, createdAt: getTodayKey(),
    ...(password ? { password: hashPassword(password) } : {}),
  };
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

// password: undefined = inchangé, null = supprimé, string = nouveau mdp
export function renameProfile(all: AllProfiles, id: string, name: string, emoji: string, password?: string | null): AllProfiles {
  return {
    ...all,
    profiles: all.profiles.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, name, emoji };
      if (password === null)           delete updated.password;
      else if (password !== undefined) updated.password = hashPassword(password);
      return updated;
    }),
  };
}

// Auto-valide les défis actifs du jour s'ils n'ont pas d'entrée "no"
export function autoCompleteChallengesToday(data: AppData): AppData {
  const today = getTodayKey();
  const active = data.habits.filter(h => h.type === 'challenge' && isChallengeActive(h, today));
  let result = data;
  for (const habit of active) {
    const existing = result.entries.find(e => e.date === today && e.habitId === habit.id);
    if (!existing) {
      // Pas d'entrée → auto "yes"
      result = setHabitStatus(result, habit.id, 'yes', habit.xpReward, today);
    }
    // Si l'entrée existe déjà (yes ou no), on ne touche à rien
  }
  return result;
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

export function addLaboSession(
  all: AllProfiles, profileId: string, date: string,
  startTime: string, endTime: string, note?: string,
): AllProfiles {
  const duration = timeToMinutes(endTime) - timeToMinutes(startTime);
  if (duration <= 0) return all;
  const session: LaboSession = {
    id: Date.now().toString(), profileId, date, startTime, endTime, duration,
    ...(note ? { note } : {}),
  };
  return { ...all, laboSessions: [...(all.laboSessions ?? []), session] };
}

export function deleteLaboSession(all: AllProfiles, id: string): AllProfiles {
  return { ...all, laboSessions: (all.laboSessions ?? []).filter(s => s.id !== id) };
}

export function addGroupTask(
  all: AllProfiles,
  assignedBy: string,
  assignedTo: string[],
  title: string,
  description: string,
  deadline?: string,
): AllProfiles {
  const task: GroupTask = {
    id: Date.now().toString(),
    title: title.trim(),
    description: description.trim(),
    assignedBy,
    assignedTo,
    deadline,
    status: 'todo',
    createdAt: getTodayKey(),
  };
  return { ...all, groupTasks: [...(all.groupTasks ?? []), task] };
}

export function toggleGroupTask(all: AllProfiles, id: string): AllProfiles {
  return {
    ...all,
    groupTasks: (all.groupTasks ?? []).map(t =>
      t.id === id ? { ...t, status: (t.status === 'done' ? 'todo' : 'done') as TaskStatus } : t
    ),
  };
}

export function deleteGroupTask(all: AllProfiles, id: string): AllProfiles {
  return { ...all, groupTasks: (all.groupTasks ?? []).filter(t => t.id !== id) };
}

export function editGroupTask(
  all: AllProfiles, id: string,
  title: string, description: string, assignedTo: string[], deadline?: string,
): AllProfiles {
  return {
    ...all,
    groupTasks: (all.groupTasks ?? []).map(t =>
      t.id === id ? { ...t, title: title.trim(), description: description.trim(), assignedTo, deadline } : t
    ),
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
