import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CountdownRing } from '@/src/components/CountdownRing';
import * as repo from '@/src/db/repo';
import { localDayBoundsIso } from '@/src/logic/day';
import { computeFeedRing, formatElapsed, formatOverdue } from '@/src/logic/prediction';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

interface TodayData {
  intervalMinutes: number;
  lastFeedStart: Date | null;
  feeds: number;
  diapers: number;
}

const DEFAULT_DATA: TodayData = {
  intervalMinutes: 180,
  lastFeedStart: null,
  feeds: 0,
  diapers: 0,
};

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 5 || h >= 21) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TodayScreen() {
  const router = useRouter();
  const { activeBaby } = useAppData();
  const [data, setData] = useState<TodayData>(DEFAULT_DATA);
  const [now, setNow] = useState(() => new Date());

  // Tick once a second so the ring + elapsed counter stay live.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!activeBaby) return;
    const { startIso, endIso } = localDayBoundsIso(new Date());
    const [reminder, lastStart, feeds, diapers] = await Promise.all([
      repo.getFeedReminder(activeBaby.id),
      repo.getLatestQualifyingFeedStart(activeBaby.id),
      repo.countFeedsBetween(activeBaby.id, startIso, endIso),
      repo.countDiapersBetween(activeBaby.id, startIso, endIso),
    ]);
    setData({
      intervalMinutes: reminder?.intervalMinutes ?? 180,
      lastFeedStart: lastStart ? new Date(lastStart) : null,
      feeds,
      diapers,
    });
  }, [activeBaby]);

  // Reload whenever the tab regains focus (e.g. after logging an event).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!activeBaby) return null; // route gate redirects to onboarding

  const ring = computeFeedRing({
    lastFeedStart: data.lastFeedStart,
    intervalMinutes: data.intervalMinutes,
    now,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Ionicons name="moon" size={22} color={colors.accent} />
            <Text style={styles.brandText}>Lull</Text>
          </View>
          <Text style={styles.greeting}>{greeting(now)}</Text>
        </View>

        <View style={styles.ringWrap}>
          <CountdownRing progress={ring.kind === 'overdue' ? 1 : ring.kind === 'counting' ? ring.progress : 0}>
            {ring.kind === 'cold' ? (
              <Text style={styles.coldPrompt}>Log your{'\n'}first feed</Text>
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
            onPress={() => router.navigate('/log')}
          >
            <Ionicons name="cafe" size={22} color={colors.bg} />
            <Text style={styles.feedButtonText}>Feed</Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, styles.diaperButton]}
            onPress={() => router.navigate('/log')}
          >
            <Ionicons name="water" size={22} color={colors.diaper} />
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
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandText: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  greeting: { fontFamily: fonts.ui, fontSize: 16, color: colors.dim },

  ringWrap: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  bigTime: { fontFamily: fonts.display, fontSize: 56, color: colors.text },
  ringLabel: { fontFamily: fonts.ui, fontSize: 15, color: colors.dim, marginTop: spacing.xs },
  coldPrompt: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
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
  diaperButton: {
    backgroundColor: colors.diaperSoft,
    borderWidth: 1,
    borderColor: colors.diaper,
  },
  diaperButtonText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.diaper },

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
});
