import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { Segmented } from '@/src/components/Segmented';
import { TimeField } from '@/src/components/TimeField';
import { WheelCompoundModal } from '@/src/components/WheelPicker';
import * as repo from '@/src/db/repo';
import type { Contents, FeedEvent, FeedType, Side } from '@/src/db/types';
import { volumeColumns, volumeCompose, volumeInitial, volumeLabel } from '@/src/lib/measurementWheels';
import { validateFeedDraft, type FeedErrors } from '@/src/logic/feed';
import { mlToUnit } from '@/src/logic/units';
import { syncFeedReminder } from '@/src/notifications/feedReminder';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

// Pump is its own chooser entry, so the feed type selector is breast/bottle only.
const TYPE_OPTIONS = [
  { label: 'Breast', value: 'breast' as const },
  { label: 'Bottle', value: 'bottle' as const },
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

function feedTotalSeconds(f: FeedEvent): number | null {
  const perSide = (f.duration_left_s ?? 0) + (f.duration_right_s ?? 0);
  if (perSide > 0) return perSide;
  if (f.end_time) {
    return Math.round((new Date(f.end_time).getTime() - new Date(f.start_time).getTime()) / 1000);
  }
  return null;
}

export default function LogFeedScreen() {
  const router = useRouter();
  const { id, pump } = useLocalSearchParams<{ id?: string; pump?: string }>();
  const editId = id ? Number(id) : null;
  const { activeBaby, settings } = useAppData();
  const unit = settings?.unit_volume ?? 'ml';

  const [type, setType] = useState<FeedType>(pump === '1' ? 'pump' : 'breast');
  const [side, setSide] = useState<Side | null>('left');
  const [volume, setVolume] = useState<number | null>(null); // display unit (ml/oz)
  const [showVolume, setShowVolume] = useState(false);
  const [contents, setContents] = useState<Contents | null>(null);
  const [manualMinutes, setManualMinutes] = useState('');
  const [startTime, setStartTime] = useState<Date>(() => new Date());

  // Live timer (breast)
  const [timing, setTiming] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const recordStartRef = useRef<number | null>(null);
  const [, setTick] = useState(0);

  const [errors, setErrors] = useState<FeedErrors>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Load (edit) or reset (new) on focus. Persistent tab route won't remount per
  // editId, so an editId effect won't re-fire when re-opening the same id.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (editId == null) {
          const isPump = pump === '1';
          setType(isPump ? 'pump' : 'breast');
          setSide(isPump ? null : 'left');
          setTiming(false);
          setTimerSeconds(null);
          recordStartRef.current = null;
          setManualMinutes('');
          setVolume(null);
          setContents(null);
          setStartTime(new Date());
          setErrors({});
          return;
        }
        const f = await repo.getFeedEvent(editId);
        if (!active || !f) return;
        setType(f.type);
        setSide(f.side);
        setStartTime(new Date(f.start_time));
        setTiming(false);
        recordStartRef.current = null;
        setManualMinutes('');
        if (f.type === 'breast') {
          setTimerSeconds(feedTotalSeconds(f));
          setVolume(null);
          setContents(null);
        } else {
          setTimerSeconds(f.type === 'pump' ? feedTotalSeconds(f) : null);
          setVolume(f.volume_ml != null ? mlToUnit(f.volume_ml, unit) : null);
          setContents(f.contents);
        }
        setErrors({});
      })();
      return () => {
        active = false;
      };
    }, [editId, unit, pump])
  );

  useEffect(() => {
    if (!timing) return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [timing]);

  function switchType(next: FeedType) {
    setSide(next === 'breast' ? 'left' : null);
    setType(next);
    setErrors({});
    setTiming(false);
    setTimerSeconds(null);
    recordStartRef.current = null;
    setManualMinutes('');
    setVolume(null);
    setContents(null);
    setStartTime(new Date());
  }

  // Clear back to a fresh "new feed" form (called after a successful save).
  function resetForm() {
    setType('breast');
    setSide('left');
    setErrors({});
    setTiming(false);
    setTimerSeconds(null);
    recordStartRef.current = null;
    setManualMinutes('');
    setVolume(null);
    setContents(null);
    setStartTime(new Date());
  }

  function startTimer() {
    const start = new Date();
    recordStartRef.current = start.getTime();
    setStartTime(start);
    setTimerSeconds(null);
    setErrors({});
    setTiming(true);
  }

  function stopTimer() {
    if (recordStartRef.current != null) {
      setTimerSeconds(Math.round((Date.now() - recordStartRef.current) / 1000));
    }
    setTiming(false);
  }

  function effectiveDurationSeconds(): number | null {
    if (timerSeconds != null) return timerSeconds;
    const m = Number(manualMinutes.trim());
    return Number.isFinite(m) && m > 0 ? Math.round(m * 60) : null;
  }

  const liveSeconds =
    timing && recordStartRef.current != null
      ? Math.floor((Date.now() - recordStartRef.current) / 1000)
      : 0;

  async function onSave() {
    if (!activeBaby) return;
    const result = validateFeedDraft({
      type,
      startTime,
      side,
      durationSeconds: type === 'bottle' ? null : effectiveDurationSeconds(),
      volumeText: volume != null ? String(volume) : '',
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
      if (editId != null) {
        await repo.updateFeedEvent(editId, result.value);
      } else {
        await repo.createFeedEvent(activeBaby.id, result.value);
      }
      await syncFeedReminder(activeBaby.id);
      resetForm();
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (editId == null) return;
    setShowDelete(false);
    await repo.deleteFeedEvent(editId);
    if (activeBaby) await syncFeedReminder(activeBaby.id);
    router.back();
  }

  if (!activeBaby) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>
            {`${editId != null ? 'Edit' : 'Log'} ${type === 'pump' ? 'pump' : 'feed'}`}
          </Text>
        </View>

        {type !== 'pump' ? (
          <Segmented options={TYPE_OPTIONS} value={type} onChange={switchType} />
        ) : null}

        {type === 'breast' ? (
          <>
            <Label>SIDE</Label>
            <Segmented options={SIDE_OPTIONS} value={side} onChange={setSide} />
            {errors.side ? <ErrorText>{errors.side}</ErrorText> : null}
          </>
        ) : (
          <>
            <Label>VOLUME</Label>
            <Pressable style={styles.input} onPress={() => setShowVolume(true)}>
              <Text style={volume != null ? styles.inputText : styles.inputPlaceholder}>
                {volume != null ? volumeLabel(volume, unit) : 'Add volume'}
              </Text>
            </Pressable>
            {errors.volume ? <ErrorText>{errors.volume}</ErrorText> : null}

            <WheelCompoundModal
              visible={showVolume}
              title="Volume"
              columns={volumeColumns(unit)}
              initial={volumeInitial(unit, volume ?? (unit === 'oz' ? 3 : 90))}
              compose={(i) => volumeCompose(unit, i)}
              onCancel={() => setShowVolume(false)}
              onConfirm={(n) => {
                setVolume(n);
                setShowVolume(false);
              }}
            />

            {type === 'bottle' ? (
              <>
                <Label>CONTENTS</Label>
                <Segmented options={CONTENTS_OPTIONS} value={contents} onChange={setContents} />
                {errors.contents ? <ErrorText>{errors.contents}</ErrorText> : null}
              </>
            ) : null}
          </>
        )}

        {/* Duration — record with the timer OR enter minutes (one is enough). */}
        {type !== 'bottle' ? (
          <>
            <Label>TIMER</Label>
            <View style={styles.timerCard}>
              {timing ? (
                <Text style={styles.timerCaption}>
                  {side ? `RECORDING · ${side.toUpperCase()}` : 'RECORDING'}
                </Text>
              ) : null}
              <Text style={styles.timerClock}>
                {formatMMSS(timing ? liveSeconds : timerSeconds ?? 0)}
              </Text>
              <Pressable
                style={[styles.timerButton, timing && styles.timerButtonStop]}
                onPress={timing ? stopTimer : startTimer}
              >
                <Text style={styles.timerButtonText}>{timing ? 'Stop' : 'Record'}</Text>
              </Pressable>
            </View>

            {!timing && timerSeconds == null ? (
              <>
                <Text style={styles.orDivider}>or enter minutes</Text>
                <TextInput
                  style={styles.input}
                  value={manualMinutes}
                  onChangeText={(t) => {
                    setManualMinutes(t);
                    if (errors.duration) setErrors((e) => ({ ...e, duration: undefined }));
                  }}
                  placeholder="e.g. 12"
                  placeholderTextColor={colors.dim}
                  keyboardType="number-pad"
                />
              </>
            ) : null}
            {!timing && errors.duration ? <ErrorText>{errors.duration}</ErrorText> : null}
          </>
        ) : null}

        {!timing ? (
          <TimeField
            label={type === 'breast' ? 'STARTED' : 'TIME'}
            value={startTime}
            onChange={setStartTime}
            error={errors.time}
          />
        ) : null}

        {editId != null ? (
          <Pressable style={styles.deleteButton} onPress={() => setShowDelete(true)}>
            <Text style={styles.deleteText}>Delete feed</Text>
          </Pressable>
        ) : null}

        <ConfirmDialog
          visible={showDelete}
          title="Delete feed?"
          message="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setShowDelete(false)}
          onConfirm={doDelete}
        />
      </ScrollView>

      <Pressable
        style={[styles.saveButton, (saving || timing) && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving || timing}
      >
        <Text style={styles.saveText}>
          {saving ? 'Saving…' : editId != null ? 'Save changes' : type === 'pump' ? 'Save pump' : 'Save feed'}
        </Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
  },
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
    justifyContent: 'center',
  },
  inputText: { fontFamily: fonts.ui, fontSize: 17, color: colors.text },
  inputPlaceholder: { fontFamily: fonts.ui, fontSize: 17, color: colors.dim },
  timerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  timerCaption: { fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 1, color: colors.dim },
  orDivider: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.dim,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  timerClock: { fontFamily: fonts.display, fontSize: 56, color: colors.text },
  timerButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
  },
  timerButtonStop: { backgroundColor: colors.diaper },
  timerButtonText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.bg },

  error: { fontFamily: fonts.ui, fontSize: 13, color: '#E8896B', marginTop: spacing.sm },
  deleteButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  deleteText: { fontFamily: fonts.uiBold, fontSize: 16, color: '#E8896B' },
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
