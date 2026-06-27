import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountdownRing } from '@/src/components/CountdownRing';
import { LullMark } from '@/src/components/LullMark';
import * as repo from '@/src/db/repo';
import type { SleepEvent } from '@/src/db/types';
import { localDayBoundsIso } from '@/src/logic/day';
import { computeFeedRing, formatElapsed, formatOverdue } from '@/src/logic/prediction';
import { classifyKind, formatDuration, sleepDayStats, sleepState } from '@/src/logic/sleep';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

interface TodayData {
  intervalMinutes: number;
  lastFeedStart: Date | null;
  feeds: number;
  diapers: number;
}

interface SleepData {
  open: SleepEvent | null;
  lastEnded: SleepEvent | null;
  naps: number;
  totalMin: number;
}

const DEFAULT_DATA: TodayData = {
  intervalMinutes: 180,
  lastFeedStart: null,
  feeds: 0,
  diapers: 0,
};

const DEFAULT_SLEEP: SleepData = { open: null, lastEnded: null, naps: 0, totalMin: 0 };

export default function TodayScreen() {
  const router = useRouter();
  const { activeBaby, settings } = useAppData();
  const trackSleep = (settings?.track_sleep ?? 1) === 1;
  const [data, setData] = useState<TodayData>(DEFAULT_DATA);
  const [sleep, setSleep] = useState<SleepData>(DEFAULT_SLEEP);
  const [now, setNow] = useState(() => new Date());

  // Tick once a second so the ring + elapsed counter stay live.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!activeBaby) return;
    const { startIso, endIso } = localDayBoundsIso(new Date());
    const [reminder, lastStart, feeds, diapers, open, lastEnded, todaySleeps] = await Promise.all([
      repo.getFeedReminder(activeBaby.id),
      repo.getLatestQualifyingFeedStart(activeBaby.id),
      repo.countFeedsBetween(activeBaby.id, startIso, endIso),
      repo.countDiapersBetween(activeBaby.id, startIso, endIso),
      repo.getOpenSleep(activeBaby.id),
      repo.getLastEndedSleep(activeBaby.id),
      repo.getSleepEventsBetween(activeBaby.id, startIso, endIso),
    ]);
    setData({
      intervalMinutes: reminder?.intervalMinutes ?? 180,
      lastFeedStart: lastStart ? new Date(lastStart) : null,
      feeds,
      diapers,
    });
    const stats = sleepDayStats(todaySleeps, new Date());
    setSleep({ open, lastEnded, naps: stats.naps, totalMin: stats.totalMin });
  }, [activeBaby]);

  // Reload whenever the tab regains focus (e.g. after logging an event).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleSleep() {
    if (!activeBaby) return;
    if (sleep.open) {
      await repo.endSleep(sleep.open.id, new Date().toISOString());
    } else {
      const start = new Date();
      await repo.startSleep(
        activeBaby.id,
        start.toISOString(),
        classifyKind(start, settings?.night_start_min, settings?.night_end_min)
      );
    }
    await load();
  }

  if (!activeBaby) return null; // route gate redirects to onboarding

  const ring = computeFeedRing({
    lastFeedStart: data.lastFeedStart,
    intervalMinutes: data.intervalMinutes,
    now,
  });

  const sState = sleepState({ openSleep: sleep.open, lastEndedSleep: sleep.lastEnded, now });
  const asleep = sState.kind === 'asleep';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <LullMark size={38} />
            <Text style={styles.brandText}>Lull</Text>
          </View>
          <View style={styles.headerRight}>
            {trackSleep && asleep ? (
              <View style={styles.asleepChip}>
                <Ionicons name="moon" size={13} color={colors.sleep} />
                <Text style={styles.asleepChipText}>Asleep · {formatDuration(sState.sinceMs)}</Text>
              </View>
            ) : null}
            <Pressable style={styles.historyButton} onPress={() => router.push('/history')}>
              <Ionicons name="time-outline" size={16} color={colors.accent} />
              <Text style={styles.historyButtonText}>History</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.ringWrap}>
          <CountdownRing progress={ring.kind === 'overdue' ? 1 : ring.kind === 'counting' ? ring.progress : 0}>
            {ring.kind === 'cold' ? (
              <Pressable onPress={() => router.push('/log-feed')} hitSlop={16}>
                <Text style={styles.coldPrompt}>Log your{'\n'}first feed</Text>
              </Pressable>
            ) : (
              <>
                <Text style={styles.bigTime}>{formatElapsed(ring.sinceLastMs)}</Text>
                <Text style={styles.ringLabel}>since last feed</Text>
              </>
            )}
          </CountdownRing>
        </View>

        {ring.kind === 'counting' ? (
          <View style={styles.pill}>
            <Ionicons name="notifications-outline" size={18} color={colors.accent} />
            <Text style={styles.pillText}>Next feed around {format(ring.nextFeedAt, 'h:mm a')}</Text>
          </View>
        ) : ring.kind === 'overdue' ? (
          <View style={styles.pill}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.accent} />
            <Text style={styles.pillText}>Feed overdue by {formatOverdue(ring.overdueMs)}</Text>
          </View>
        ) : null}

        <View style={styles.quickRow}>
          <Pressable
            style={[styles.quickButton, styles.feedButton]}
            onPress={() => router.push('/log-feed')}
          >
            <MaterialCommunityIcons name="baby-bottle-outline" size={22} color={colors.bg} />
            <Text style={styles.feedButtonText}>Feed</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, styles.diaperButton]}
            onPress={() => router.push('/log-diaper')}
          >
            <MaterialCommunityIcons name="diaper-outline" size={22} color={colors.bg} />
            <Text style={styles.diaperButtonText}>Diaper</Text>
          </Pressable>
        </View>

        <View style={styles.countRow}>
          <View style={styles.countCard}>
            <Text style={styles.countNumber}>{data.feeds}</Text>
            <Text style={styles.countLabel}>feeds today</Text>
          </View>
          <View style={styles.countCard}>
            <Text style={styles.countNumber}>{data.diapers}</Text>
            <Text style={styles.countLabel}>diapers today</Text>
          </View>
        </View>

        {/* Sleep */}
        {trackSleep ? (
        <View style={[styles.sleepCard, asleep && styles.sleepCardActive]}>
          <View style={styles.sleepInfo}>
            <Text style={styles.sleepState}>
              {asleep
                ? `Asleep · ${formatDuration(sState.sinceMs)}`
                : sState.sinceMs != null
                  ? `Awake · ${formatDuration(sState.sinceMs)}`
                  : 'Awake'}
            </Text>
            <Text style={styles.sleepStats}>
              {sleep.naps} {sleep.naps === 1 ? 'nap' : 'naps'} · {formatDuration(sleep.totalMin * 60_000)} slept today
            </Text>
          </View>
          <Pressable style={[styles.sleepButton, asleep && styles.sleepButtonActive]} onPress={toggleSleep}>
            <Ionicons name={asleep ? 'sunny' : 'moon'} size={18} color={colors.bg} />
            <Text style={styles.sleepButtonText}>{asleep ? 'Wake' : 'Sleep'}</Text>
          </Pressable>
        </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandText: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  asleepChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.sleepSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
  },
  asleepChipText: { fontFamily: fonts.uiBold, fontSize: 12, color: colors.sleep },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyButtonText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.accent },

  ringWrap: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  bigTime: { fontFamily: fonts.display, fontSize: 56, color: colors.text },
  ringLabel: { fontFamily: fonts.ui, fontSize: 15, color: colors.dim, marginTop: spacing.xs },
  coldPrompt: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.accent,
    textAlign: 'center',
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.lg,
  },
  pillText: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.accent },

  quickRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  quickButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
  },
  feedButton: { backgroundColor: colors.accent },
  feedButtonText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.bg },
  diaperButton: { backgroundColor: colors.diaper },
  diaperButtonText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.bg },

  countRow: { flexDirection: 'row', gap: spacing.md },
  countCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  countNumber: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  countLabel: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: spacing.xs },

  sleepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  sleepCardActive: { borderColor: colors.sleep, backgroundColor: colors.sleepSoft },
  sleepInfo: { flex: 1 },
  sleepState: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.text },
  sleepStats: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: 2 },
  sleepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.sleep,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  sleepButtonActive: { backgroundColor: colors.accent },
  sleepButtonText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.bg },
});
