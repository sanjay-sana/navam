import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as repo from '@/src/db/repo';
import { buildTimeline, type TimelineEntry } from '@/src/logic/history';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, spacing } from '@/src/theme/theme';
import { EntryRow } from './history';

export default function FlaggedScreen() {
  const router = useRouter();
  const { activeBaby, settings } = useAppData();
  const [entries, setEntries] = useState<TimelineEntry[]>([]);

  const load = useCallback(async () => {
    if (!activeBaby || !settings) return;
    const [diapers, sleeps] = await Promise.all([
      repo.getFlaggedDiapers(activeBaby.id),
      repo.getFlaggedSleeps(activeBaby.id),
    ]);
    const units = { volume: settings.unit_volume, mass: settings.unit_mass, length: settings.unit_length };
    setEntries(buildTimeline([], diapers, [], sleeps, units));
  }, [activeBaby, settings]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function openEntry(entry: TimelineEntry) {
    router.push({ pathname: entry.kind === 'sleep' ? '/log-sleep' : '/log-diaper', params: { id: String(entry.id) } });
  }

  if (!activeBaby) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Flagged</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="flag-outline" size={40} color={colors.dim} />
            <Text style={styles.empty}>Nothing flagged</Text>
            <Text style={styles.emptyHint}>
              Turn on “Flag for review” when logging a diaper or sleep to collect it here.
            </Text>
          </View>
        ) : (
          entries.map((entry) => <EntryRow key={entry.key} entry={entry} onPress={() => openEntry(entry)} />)
        )}
      </ScrollView>
    </SafeAreaView>
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  emptyWrap: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl * 2 },
  empty: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.dim },
  emptyHint: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, textAlign: 'center', paddingHorizontal: spacing.xl },
});
