// Local feed-reminder scheduling (§5.4). We keep at most ONE pending one-shot:
// on every relevant change we cancel and (if due in the future) reschedule for
// the latest qualifying feed's start + interval. Fully offline.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import * as repo from '@/src/db/repo';

const CHANNEL_ID = 'feed-reminders';

/** Call once at app start. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/** Android channel — guarded so it no-ops on iOS (§10.1). */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Feed reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Request permission (call when the user first enables a reminder). */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/**
 * Recompute next-feed and reschedule the single pending reminder. Call after any
 * insert/edit/delete of a qualifying feed, and when the reminder config changes.
 */
export async function syncFeedReminder(babyId: number): Promise<void> {
  // Always clear the existing pending one-shot first (we only ever keep one).
  await Notifications.cancelAllScheduledNotificationsAsync();

  const reminder = await repo.getFeedReminder(babyId);
  if (!reminder || !reminder.enabled) return;

  const lastStart = await repo.getLatestQualifyingFeedStart(babyId);
  if (!lastStart) return; // nothing to predict from yet

  const nextFeed = new Date(new Date(lastStart).getTime() + reminder.intervalMinutes * 60_000);
  if (nextFeed.getTime() <= Date.now()) return; // already overdue — Today shows it

  await ensureAndroidChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time for a feed',
      body: 'It’s been a while since the last feed.',
      data: { url: '/log' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextFeed,
      channelId: CHANNEL_ID,
    },
  });
}
