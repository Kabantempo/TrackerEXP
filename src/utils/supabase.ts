import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TEAM_ID_KEY = 'kaban_team_id';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTeamCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export async function getTeamId(): Promise<string | null> {
  return AsyncStorage.getItem(TEAM_ID_KEY);
}

export async function setTeamId(id: string): Promise<void> {
  await AsyncStorage.setItem(TEAM_ID_KEY, id.toUpperCase().trim());
}

export async function clearTeamId(): Promise<void> {
  await AsyncStorage.removeItem(TEAM_ID_KEY);
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);
