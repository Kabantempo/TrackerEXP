import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIF_TIME_KEY  = 'kaban_notif_time';   // "HH:MM"
const NOTIF_ENABLED_KEY = 'kaban_notif_on';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge:  false,
  }),
});

export async function sendTaskAssignedNotif(taskTitle: string, creatorName: string, assigneeNames: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;
  const who = assigneeNames.join(', ');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📋 Nouvelle tâche assignée',
      body: `"${taskTitle}" → ${who} (de ${creatorName})`,
    },
    trigger: null,
  });
}

export async function requestNotifPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotifSettings(): Promise<{ enabled: boolean; time: string }> {
  const [en, t] = await Promise.all([
    AsyncStorage.getItem(NOTIF_ENABLED_KEY),
    AsyncStorage.getItem(NOTIF_TIME_KEY),
  ]);
  return { enabled: en === 'true', time: t ?? '09:00' };
}

export async function saveNotifSettings(enabled: boolean, time: string): Promise<void> {
  await AsyncStorage.setItem(NOTIF_ENABLED_KEY, enabled ? 'true' : 'false');
  await AsyncStorage.setItem(NOTIF_TIME_KEY, time);
  await reschedule(enabled, time);
}

async function reschedule(enabled: boolean, time: string): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;
  const [h, m] = time.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'KABAN 🦖',
      body:  'N\'oublie pas tes habitudes du jour !',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: h,
      minute: m,
    },
  });
}
