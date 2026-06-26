import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { PumpIcon } from '@/src/components/PumpIcon';
import { format, isSameDay, subDays } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as repo from '@/src/db/repo';
import { localDayBoundsIso, localDayStart } from '@/src/logic/day';
import { buildTimeline, daySummary, type DaySummary, type TimelineEntry } from '@/src/logic/history';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, eventColors, fonts, radius, spacing } from '@/src/theme/theme';

function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function dayLabel(day: Date, now: Date): string {
  const datePart = format(day, 'EEE, MMM d');
  if (isSameDay(day, now)) return `Today · ${datePart}`;
  if (isSameDay(day, subDays(now, 1))) return `Yesterday · ${datePart}`;
  return datePart;
}

export default function HistoryScreen() {
  const router = useRouter();
  const { activeBaby, settings } = useAppData();
  const units = {
    volume: settings?.unit_volume ?? 'ml',
    mass: settings?.unit_mass ?? 'g',
    length: settings?.unit_length ?? 'cm',
  } as const;

  const [day, setDay] = useState<Date>(() => localDayStart(new Date()));
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [summary, setSummary] = useState<DaySummary>({ feeds: 0, diapers: 0, volume: null, weighIns: 0, sleep: null });

  const now = new Date();
  const isToday = isSameDay(day, now);

  const load = useCallback(async () => {
    if (!activeBaby) return;
    const { startIso, endIso } = localDayBoundsIso(day);
    const [feeds, diapers, allGrowth, sleeps] = await Promise.all([
      repo.getFeedEventsBetween(activeBaby.id, startIso, endIso),
      repo.getDiaperEventsBetween(activeBaby.id, startIso, endIso),
      repo.getGrowthMeasurements(activeBaby.id),
      repo.getSleepEventsBetween(activeBaby.id, startIso, endIso),
    ]);
    // Growth is date-only, so match on the local day key rather than ISO range.
    const growth = allGrowth.filter((m) => m.measured_at === dayKey(day));
    setEntries(buildTimeline(feeds, diapers, growth, sleeps, units));
    setSummary(daySummary(feeds, diapers, growth, sleeps, units.volume));
  }, [activeBaby, day, units.volume, units.mass, units.length]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openEntry(entry: TimelineEntry) {
    const path =
      entry.kind === 'feed'
        ? '/log-feed'
        : entry.kind === 'diaper'
          ? '/log-diaper'
          : entry.kind === 'sleep'
            ? '/log-sleep'
            : '/log-growth';
    router.push({ pathname: path, params: { id: String(entry.id) } });
  }

  const summaryParts = [
    `${summary.feeds} feeds`,
    `${summary.diapers} diapers`,
    ...(summary.volume ? [summary.volume] : []),
    ...(summary.sleep ? [`${summary.sleep} sleep`] : []),
    ...(summary.weighIns > 0 ? [`${summary.weighIns} weigh-in${summary.weighIns > 1 ? 's' : ''}`] : []),
  ];

  if (!activeBaby) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>History</Text>
      </View>

      <View style={styles.dayNav}>
        <Pressable onPress={() => setDay((d) => subDays(d, 1))} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </Pressable>
        <Text style={styles.dayLabel}>{dayLabel(day, now)}</Text>
        <Pressable onPress={() => !isToday && setDay((d) => subDays(d, -1))} hitSlop={12} disabled={isToday}>
          <Ionicons name="chevron-forward" size={22} color={isToday ? colors.border : colors.accent} />
        </Pressable>
      </View>

      <Text style={styles.summary}>{summaryParts.join(' · ')}</Text>

      <ScrollView contentContainerStyle={styles.list}>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No events logged this day.</Text>
        ) : (
          entries.map((entry) => <EntryRow key={entry.key} entry={entry} onPress={() => openEntry(entry)} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function EntryRow({ entry, onPress }: { entry: TimelineEntry; onPress: () => void }) {
  const color =
    entry.kind === 'sleep'
      ? eventColors.sleep
      : entry.kind === 'growth'
        ? eventColors.growth
        : entry.kind === 'diaper'
          ? eventColors.diaper
          : entry.feedType === 'pump'
            ? eventColors.pump
            : eventColors.feed;
  // Pump uses a custom SVG; bottle feed + diaper use MCI; the rest are Ionicons.
  const isPump = entry.kind === 'feed' && entry.feedType === 'pump';
  const mciName =
    entry.kind === 'feed' && entry.feedType !== 'pump'
      ? 'baby-bottle-outline'
      : entry.kind === 'diaper'
        ? 'diaper-outline'
        : null;
  const ionName = entry.kind === 'sleep' ? 'moon' : entry.kind === 'growth' ? 'trending-up' : 'cafe';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowTime}>{entry.hasClock ? format(new Date(entry.time), 'h:mm a') : ''}</Text>
      <View style={[styles.rowIcon, { backgroundColor: `${color}24` }]}>
        {isPump ? (
          <PumpIcon size={20} color={color} />
        ) : mciName ? (
          <MaterialCommunityIcons name={mciName} size={20} color={color} />
        ) : (
          <Ionicons name={ionName} size={20} color={color} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{entry.title}</Text>
        {entry.subtitle ? <Text style={styles.rowSubtitle}>{entry.subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.dim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  dayLabel: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.text },
  summary: {
    fontFamily: fonts.ui,
    fontSize: 14,
    color: colors.dim,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  empty: { fontFamily: fonts.ui, fontSize: 15, color: colors.dim, marginTop: spacing.xl, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowTime: { fontFamily: fonts.uiBold, fontSize: 13, color: colors.text, width: 64 },
  rowIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontFamily: fonts.uiBold, fontSize: 17, color: colors.text },
  rowSubtitle: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: 2 },
});
