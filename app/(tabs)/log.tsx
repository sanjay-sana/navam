import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Segmented } from '@/src/components/Segmented';
import * as repo from '@/src/db/repo';
import type { Contents, FeedType, Side } from '@/src/db/types';
import { validateFeedDraft, type FeedErrors } from '@/src/logic/feed';
import { volumeUnitLabel } from '@/src/logic/units';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

const TYPE_OPTIONS = [
  { label: 'Breast', value: 'breast' as const },
  { label: 'Bottle', value: 'bottle' as const },
  { label: 'Pump', value: 'pump' as const },
];
const SIDE_OPTIONS = [
  { label: 'Left', value: 'left' as const },
  { label: 'Both', value: 'both' as const },
  { label: 'Right', value: 'right' as const },
];
const CONTENTS_OPTIONS = [
  { label: 'Breast milk', value: 'breast_milk' as const },
  { label: 'Formula', value: 'formula' as const },
  { label: 'Mixed', value: 'mixed' as const },
];

function formatMMSS(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LogFeedScreen() {
  const router = useRouter();
  const { activeBaby, settings } = useAppData();
  const unit = settings?.unit_volume ?? 'ml';

  const [type, setType] = useState<FeedType>('breast');
  const [side, setSide] = useState<Side | null>('left');
  const [volumeText, setVolumeText] = useState('');
  const [contents, setContents] = useState<Contents | null>(null);
  const [manualMinutes, setManualMinutes] = useState('');

  // Time / backfill
  const [startTime, setStartTime] = useState<Date>(() => new Date());
  const [pickStep, setPickStep] = useState<'date' | 'time' | null>(null);

  // Live timer (breast)
  const [timing, setTiming] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null); // captured on stop
  const recordStartRef = useRef<number | null>(null);
  const [tick, setTick] = useState(0);

  const [errors, setErrors] = useState<FeedErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!timing) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [timing]);

  function switchType(next: FeedType) {
    setType(next);
    setSide(next === 'breast' ? 'left' : null);
    setErrors({});
    setTiming(false);
    setTimerSeconds(null);
    recordStartRef.current = null;
    setManualMinutes('');
    setVolumeText('');
    setContents(null);
    setStartTime(new Date());
  }

  function startTimer() {
    const start = new Date();
    recordStartRef.current = start.getTime();
    setStartTime(start);
    setTimerSeconds(null);
    setTiming(true);
  }

  function stopTimer() {
    if (recordStartRef.current != null) {
      setTimerSeconds(Math.round((Date.now() - recordStartRef.current) / 1000));
    }
    setTiming(false);
  }

  function applyPreset(minutesAgo: number) {
    setStartTime(new Date(Date.now() - minutesAgo * 60_000));
  }

  const liveSeconds =
    timing && recordStartRef.current != null
      ? Math.floor((Date.now() - recordStartRef.current) / 1000)
      : 0;

  // Effective breast duration: timer result, else manual minutes.
  function effectiveDurationSeconds(): number | null {
    if (timerSeconds != null) return timerSeconds;
    const m = Number(manualMinutes.trim());
    return Number.isFinite(m) && m > 0 ? Math.round(m * 60) : null;
  }

  async function onSave() {
    if (!activeBaby) return;
    const result = validateFeedDraft({
      type,
      startTime,
      side,
      durationSeconds: type === 'breast' ? effectiveDurationSeconds() : null,
      volumeText,
      contents,
      unitVolume: unit,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await repo.createFeedEvent(activeBaby.id, result.value);
      // TODO(P6): trigger next-feed reminder recompute + reschedule here.
      router.navigate('/');
    } catch (e) {
      setSaving(false);
      throw e;
    }
  }

  if (!activeBaby) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Log feed</Text>

        <View style={styles.block}>
          <Segmented options={TYPE_OPTIONS} value={type} onChange={switchType} />
        </View>

        {type === 'breast' ? (
          <>
            <Label>SIDE</Label>
            <Segmented options={SIDE_OPTIONS} value={side} onChange={setSide} />
            {errors.side ? <ErrorText>{errors.side}</ErrorText> : null}

            <View style={styles.timerCard}>
              <Text style={styles.timerCaption}>
                {timing ? `RECORDING · ${side?.toUpperCase()}` : 'TIMER'}
              </Text>
              <Text style={styles.timerClock}>
                {formatMMSS(timing ? liveSeconds : (timerSeconds ?? 0))}
              </Text>
              <Pressable
                style={[styles.timerButton, timing && styles.timerButtonStop]}
                onPress={timing ? stopTimer : startTimer}
              >
                <Text style={styles.timerButtonText}>{timing ? 'Stop' : 'Record'}</Text>
              </Pressable>
            </View>

            {!timing && timerSeconds == null ? (
              <View style={styles.block}>
                <Label>OR ENTER MINUTES</Label>
                <TextInput
                  style={styles.input}
                  value={manualMinutes}
                  onChangeText={setManualMinutes}
                  placeholder="e.g. 12"
                  placeholderTextColor={colors.dim}
                  keyboardType="number-pad"
                />
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Label>VOLUME ({volumeUnitLabel(unit)})</Label>
            <TextInput
              style={styles.input}
              value={volumeText}
              onChangeText={setVolumeText}
              placeholder={`Volume in ${volumeUnitLabel(unit)}`}
              placeholderTextColor={colors.dim}
              keyboardType="decimal-pad"
            />
            {errors.volume ? <ErrorText>{errors.volume}</ErrorText> : null}

            {type === 'bottle' ? (
              <>
                <Label>CONTENTS</Label>
                <Segmented options={CONTENTS_OPTIONS} value={contents} onChange={setContents} />
                {errors.contents ? <ErrorText>{errors.contents}</ErrorText> : null}
              </>
            ) : (
              <>
                <Label>SIDE (OPTIONAL)</Label>
                <Segmented
                  options={SIDE_OPTIONS}
                  value={side}
                  onChange={(v) => setSide(side === v ? null : v)}
                />
              </>
            )}
          </>
        )}

        {/* Time / backfill — hidden while the timer owns the start time. */}
        {!timing ? (
          <View style={styles.block}>
            <Label>{type === 'breast' ? 'STARTED' : 'TIME'}</Label>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{format(startTime, 'EEE d MMM · h:mm a')}</Text>
            </View>
            <View style={styles.whenRow}>
              <WhenChip label="Now" onPress={() => applyPreset(0)} />
              <WhenChip label="15m" onPress={() => applyPreset(15)} />
              <WhenChip label="30m" onPress={() => applyPreset(30)} />
              <WhenChip label="1h" onPress={() => applyPreset(60)} />
              <WhenChip label="Pick" onPress={() => setPickStep('date')} />
            </View>
            {errors.time ? <ErrorText>{errors.time}</ErrorText> : null}
          </View>
        ) : null}

        {pickStep ? (
          <DateTimePicker
            value={startTime}
            mode={pickStep}
            maximumDate={pickStep === 'date' ? new Date() : undefined}
            onChange={(event, selected) => {
              if (event.type !== 'set' || !selected) {
                setPickStep(null);
                return;
              }
              if (pickStep === 'date') {
                // Keep the existing time-of-day, swap the date, then ask for time.
                const merged = new Date(startTime);
                merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
                setStartTime(merged);
                setPickStep(Platform.OS === 'ios' ? null : 'time');
              } else {
                const merged = new Date(startTime);
                merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
                setStartTime(merged);
                setPickStep(null);
              }
            }}
          />
        ) : null}
      </ScrollView>

      <Pressable
        style={[styles.saveButton, (saving || timing) && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving || timing}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save feed'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}
function WhenChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  block: { marginTop: spacing.lg },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.dim,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.ui,
    fontSize: 17,
    color: colors.text,
  },
  timerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  timerCaption: { fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 1, color: colors.dim },
  timerClock: { fontFamily: fonts.display, fontSize: 56, color: colors.text },
  timerButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  timerButtonStop: { backgroundColor: colors.diaper },
  timerButtonText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.bg },

  timeRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  timeText: { fontFamily: fonts.ui, fontSize: 17, color: colors.text },
  whenRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.text },

  error: { fontFamily: fonts.ui, fontSize: 13, color: '#E8896B', marginTop: spacing.sm },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.bg },
});
