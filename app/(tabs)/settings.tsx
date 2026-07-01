import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/BrandMark';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { Segmented } from '@/src/components/Segmented';
import { WheelCompoundModal } from '@/src/components/WheelPicker';
import * as repo from '@/src/db/repo';
import type { UnitLength, UnitMass, UnitVolume } from '@/src/db/types';
import { exportCsv } from '@/src/lib/exportCsv';
import { ensureNotificationPermission, syncFeedReminder } from '@/src/notifications/feedReminder';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

const INTERVALS = [
  { label: '2h', value: 120 },
  { label: '2.5h', value: 150 },
  { label: '3h', value: 180 },
  { label: '3.5h', value: 210 },
  { label: '4h', value: 240 },
];

// Night window is stored as minutes-since-midnight; the picker steps every 30 min.
const STEP_MIN = 30;
function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
const TIME_COLUMNS = [
  { items: Array.from({ length: (24 * 60) / STEP_MIN }, (_, i) => ({ label: formatTime(i * STEP_MIN) })) },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { activeBaby, settings, refresh } = useAppData();

  const [reminderOn, setReminderOn] = useState(false);
  const [intervalMin, setIntervalMin] = useState(180);
  const [exporting, setExporting] = useState(false);
  const [nightPicker, setNightPicker] = useState<'start' | 'end' | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const loadReminder = useCallback(async () => {
    if (!activeBaby) return;
    const r = await repo.getFeedReminder(activeBaby.id);
    if (r) {
      setReminderOn(r.enabled);
      setIntervalMin(r.intervalMinutes);
    }
  }, [activeBaby]);

  useFocusEffect(useCallback(() => { loadReminder(); }, [loadReminder]));

  if (!activeBaby || !settings) return null;

  async function setUnit(
    patch: { unit_volume?: UnitVolume; unit_mass?: UnitMass; unit_length?: UnitLength }
  ) {
    await repo.updateSettings(patch);
    await refresh();
  }

  async function toggleReminder(next: boolean) {
    if (!activeBaby) return;
    if (next) {
      const granted = await ensureNotificationPermission();
      if (!granted) {
        setNotice({
          title: 'Notifications disabled',
          message: 'Enable notifications in system settings to get feed reminders.',
        });
        return;
      }
    }
    await repo.updateReminder(activeBaby.id, { enabled: next });
    setReminderOn(next);
    await syncFeedReminder(activeBaby.id);
  }

  async function pickInterval(min: number) {
    if (!activeBaby) return;
    await repo.updateReminder(activeBaby.id, { intervalMinutes: min });
    setIntervalMin(min);
    await syncFeedReminder(activeBaby.id);
  }

  async function onExport() {
    if (!activeBaby) return;
    setExporting(true);
    try {
      await exportCsv(activeBaby.id, activeBaby.name);
    } catch (e) {
      setNotice({ title: 'Export failed', message: String(e) });
    } finally {
      setExporting(false);
    }
  }

  async function doStartOver() {
    setShowReset(false);
    await repo.resetApp();
    await refresh(); // active baby now null → route gate sends you to onboarding
  }

  const dob = new Date(`${activeBaby.date_of_birth}T00:00:00`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        <Pressable style={styles.profile} onPress={() => router.push('/edit-profile')}>
          <View style={styles.avatar}>
            <BrandMark size={42} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{activeBaby.name}</Text>
            <Text style={styles.profileSub}>
              Born {format(dob, 'd MMM yyyy')} · {activeBaby.sex === 'male' ? 'Boy' : 'Girl'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.dim} />
        </Pressable>

        {/* Units */}
        <Text style={styles.section}>UNITS</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Volume</Text>
          <View style={styles.rowControl}>
            <Segmented
              options={[{ label: 'ml', value: 'ml' }, { label: 'oz', value: 'oz' }]}
              value={settings.unit_volume}
              onChange={(v) => setUnit({ unit_volume: v as UnitVolume })}
            />
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Weight</Text>
          <View style={styles.rowControl}>
            <Segmented
              options={[{ label: 'kg', value: 'g' }, { label: 'lb', value: 'lb_oz' }]}
              value={settings.unit_mass}
              onChange={(v) => setUnit({ unit_mass: v as UnitMass })}
            />
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Length</Text>
          <View style={styles.rowControl}>
            <Segmented
              options={[{ label: 'cm', value: 'cm' }, { label: 'in', value: 'in' }]}
              value={settings.unit_length}
              onChange={(v) => setUnit({ unit_length: v as UnitLength })}
            />
          </View>
        </View>

        {/* Tracking toggles */}
        <Text style={styles.section}>TRACKING</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>Sleep</Text>
            <Switch
              value={settings.track_sleep === 1}
              onValueChange={async (on) => {
                await repo.updateSettings({ track_sleep: on ? 1 : 0 });
                await refresh();
              }}
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Night-sleep window — only relevant when sleep tracking is on. */}
        {settings.track_sleep === 1 ? (
          <>
            <Text style={styles.section}>NIGHT TIME</Text>
            <View style={styles.card}>
              <Text style={styles.everyLabel}>Sleeps that start in this window are logged as night sleep</Text>
              <View style={styles.cardRow}>
                <Text style={styles.rowLabel}>Starts</Text>
                <Pressable style={styles.hourField} onPress={() => setNightPicker('start')}>
                  <Text style={styles.hourText}>{formatTime(settings.night_start_min)}</Text>
                </Pressable>
              </View>
              <View style={[styles.cardRow, { marginTop: spacing.md }]}>
                <Text style={styles.rowLabel}>Ends</Text>
                <Pressable style={styles.hourField} onPress={() => setNightPicker('end')}>
                  <Text style={styles.hourText}>{formatTime(settings.night_end_min)}</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        {/* Feed interval — always editable; drives the Today countdown + reminder. */}
        <Text style={styles.section}>FEED INTERVAL</Text>
        <View style={styles.card}>
          <Text style={styles.everyLabel}>Time between feeds · used for the Today countdown</Text>
          <View style={styles.intervals}>
            {INTERVALS.map((iv) => {
              const sel = iv.value === intervalMin;
              return (
                <Pressable
                  key={iv.value}
                  style={[styles.chip, sel && styles.chipSel]}
                  onPress={() => pickInterval(iv.value)}
                >
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{iv.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Reminders */}
        <Text style={styles.section}>REMINDERS</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>Feed reminder</Text>
            <Switch
              value={reminderOn}
              onValueChange={toggleReminder}
              trackColor={{ true: colors.accent, false: colors.surface2 }}
              thumbColor={colors.white}
            />
          </View>
        </View>

        {/* Export */}
        <Pressable style={styles.exportRow} onPress={onExport} disabled={exporting}>
          <Text style={styles.rowLabel}>Export data</Text>
          <View style={styles.exportRight}>
            <Text style={styles.exportHint}>{exporting ? 'Preparing…' : 'CSV'}</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.dim} />
          </View>
        </Pressable>

        <Pressable style={styles.startOver} onPress={() => setShowReset(true)}>
          <Text style={styles.startOverText}>Start over</Text>
        </Pressable>

        <ConfirmDialog
          visible={showReset}
          title="Start over?"
          message="This deletes the baby profile and all logged data. Unit settings are kept. This cannot be undone."
          confirmLabel="Delete everything"
          destructive
          onCancel={() => setShowReset(false)}
          onConfirm={doStartOver}
        />

        <ConfirmDialog
          visible={notice != null}
          title={notice?.title ?? ''}
          message={notice?.message}
          confirmLabel="OK"
          showCancel={false}
          onCancel={() => setNotice(null)}
          onConfirm={() => setNotice(null)}
        />

        <WheelCompoundModal
          visible={nightPicker === 'start'}
          title="Night starts"
          columns={TIME_COLUMNS}
          initial={[Math.round(settings.night_start_min / STEP_MIN)]}
          compose={(i) => i[0] * STEP_MIN}
          onCancel={() => setNightPicker(null)}
          onConfirm={async (min) => {
            await repo.updateSettings({ night_start_min: min });
            await refresh();
            setNightPicker(null);
          }}
        />
        <WheelCompoundModal
          visible={nightPicker === 'end'}
          title="Night ends"
          columns={TIME_COLUMNS}
          initial={[Math.round(settings.night_end_min / STEP_MIN)]}
          compose={(i) => i[0] * STEP_MIN}
          onCancel={() => setNightPicker(null)}
          onConfirm={async (min) => {
            await repo.updateSettings({ night_end_min: min });
            await refresh();
            setNightPicker(null);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.lg },

  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  profileSub: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: 2 },

  section: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1, color: colors.dim, marginTop: spacing.xl, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  rowLabel: { fontFamily: fonts.uiBold, fontSize: 17, color: colors.text },
  rowControl: { width: 140 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hourField: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  hourText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  everyLabel: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginBottom: spacing.sm },
  intervals: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: { backgroundColor: colors.surface2, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipSel: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  chipText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.text },
  chipTextSel: { color: colors.accent },

  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    marginTop: spacing.xl,
  },
  exportRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  exportHint: { fontFamily: fonts.ui, fontSize: 15, color: colors.dim },
  startOver: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.xl },
  startOverText: { fontFamily: fonts.uiBold, fontSize: 16, color: '#E8896B' },
});
