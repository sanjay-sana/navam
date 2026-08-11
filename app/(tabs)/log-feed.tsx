import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
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
const CONTENTS_OPTIONS = [
  { label: 'Breast milk', value: 'breast_milk' as const },
  { label: 'Formula', value: 'formula' as const },
  { label: 'Mixed', value: 'mixed' as const },
];
// 0–90 minutes, for tap-to-edit of a breast side's time.
const MINUTE_COLUMNS = [{ items: Array.from({ length: 91 }, (_, i) => ({ label: String(i) })), label: 'min' }];

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
  const [volume, setVolume] = useState<number | null>(null); // display unit (ml/oz)
  const [showVolume, setShowVolume] = useState(false);
  const [contents, setContents] = useState<Contents | null>(null);
  const [startTime, setStartTime] = useState<Date>(() => new Date());

  // Breast: two independent side timers (accumulated seconds each); side is
  // derived from which side(s) were timed. Manual minutes for backfill.
  const [leftSec, setLeftSec] = useState(0);
  const [rightSec, setRightSec] = useState(0);
  const [activeSide, setActiveSide] = useState<'left' | 'right' | null>(null);
  const activeStartRef = useRef<number | null>(null);
  const [showSidePicker, setShowSidePicker] = useState<'left' | 'right' | null>(null);
  const [showPumpPicker, setShowPumpPicker] = useState(false);
  const [lastBreastSide, setLastBreastSide] = useState<Side | null>(null);

  // Pump: single timer + manual minutes
  const [timing, setTiming] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const recordStartRef = useRef<number | null>(null);
  const [manualMinutes, setManualMinutes] = useState('');
  const [, setTick] = useState(0);

  function resetTimers() {
    setLeftSec(0);
    setRightSec(0);
    setActiveSide(null);
    activeStartRef.current = null;
    setShowSidePicker(null);
    setShowPumpPicker(false);
    setTiming(false);
    setTimerSeconds(null);
    recordStartRef.current = null;
    setManualMinutes('');
  }

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
          resetTimers();
          setVolume(null);
          setContents(null);
          setStartTime(new Date());
          setErrors({});
          setLastBreastSide(activeBaby ? await repo.getLastBreastSide(activeBaby.id) : null);
          return;
        }
        const f = await repo.getFeedEvent(editId);
        if (!active || !f) return;
        setType(f.type);
        setStartTime(new Date(f.start_time));
        resetTimers();
        if (f.type === 'breast') {
          setLeftSec(f.duration_left_s ?? 0);
          setRightSec(f.duration_right_s ?? 0);
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
    }, [editId, unit, pump, activeBaby])
  );

  const timerRunning = timing || activeSide != null;

  useEffect(() => {
    if (!timerRunning) return;
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [timerRunning]);

  // Keep the screen awake while a feed/pump timer is running.
  useEffect(() => {
    if (!timerRunning) return;
    const TAG = 'navam-feed-timer';
    activateKeepAwakeAsync(TAG);
    return () => {
      deactivateKeepAwake(TAG);
    };
  }, [timerRunning]);

  function switchType(next: FeedType) {
    setType(next);
    setErrors({});
    resetTimers();
    setVolume(null);
    setContents(null);
    setStartTime(new Date());
  }

  // Clear back to a fresh "new feed" form (called after a successful save).
  function resetForm() {
    setType('breast');
    setErrors({});
    resetTimers();
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

  // --- Breast side timers ---
  function foldActiveSide() {
    if (activeSide && activeStartRef.current != null) {
      const elapsed = Math.max(0, Math.round((Date.now() - activeStartRef.current) / 1000));
      if (activeSide === 'left') setLeftSec((s) => s + elapsed);
      else setRightSec((s) => s + elapsed);
    }
    activeStartRef.current = null;
  }
  function toggleSide(sideKey: 'left' | 'right') {
    if (errors.duration) setErrors((e) => ({ ...e, duration: undefined }));
    if (activeSide === sideKey) {
      foldActiveSide();
      setActiveSide(null);
    } else {
      if (activeSide === null && leftSec === 0 && rightSec === 0) setStartTime(new Date());
      foldActiveSide(); // stop the other side if it was running
      activeStartRef.current = Date.now();
      setActiveSide(sideKey);
    }
  }
  const runExtra = activeStartRef.current != null ? Math.floor((Date.now() - activeStartRef.current) / 1000) : 0;
  const liveLeft = leftSec + (activeSide === 'left' ? runExtra : 0);
  const liveRight = rightSec + (activeSide === 'right' ? runExtra : 0);
  /** Per-side seconds for saving (running side folded in). */
  function breastSeconds(): { l: number; r: number } {
    const extra = activeStartRef.current != null ? Math.floor((Date.now() - activeStartRef.current) / 1000) : 0;
    return {
      l: leftSec + (activeSide === 'left' ? extra : 0),
      r: rightSec + (activeSide === 'right' ? extra : 0),
    };
  }

  async function onSave() {
    if (!activeBaby) return;
    const breast = breastSeconds();
    const result = validateFeedDraft({
      type,
      startTime,
      side: null,
      durationSeconds: type === 'pump' ? effectiveDurationSeconds() : null,
      leftSeconds: type === 'breast' ? breast.l : null,
      rightSeconds: type === 'breast' ? breast.r : null,
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
            {editId == null &&
            lastBreastSide &&
            lastBreastSide !== 'both' &&
            activeSide === null &&
            leftSec === 0 &&
            rightSec === 0 ? (
              <View style={styles.hintPill}>
                <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                <Text style={styles.hintText}>
                  Start on {lastBreastSide === 'left' ? 'Right' : 'Left'} — last was{' '}
                  {lastBreastSide === 'left' ? 'Left' : 'Right'}
                </Text>
              </View>
            ) : null}

            <Label>SIDES</Label>
            <View style={styles.sideRow}>
              <SideTimer
                label="Left"
                seconds={liveLeft}
                active={activeSide === 'left'}
                editing={editId != null}
                onToggle={() => toggleSide('left')}
                onEdit={() => setShowSidePicker('left')}
                onReset={() => setLeftSec(0)}
              />
              <SideTimer
                label="Right"
                seconds={liveRight}
                active={activeSide === 'right'}
                editing={editId != null}
                onToggle={() => toggleSide('right')}
                onEdit={() => setShowSidePicker('right')}
                onReset={() => setRightSec(0)}
              />
            </View>
            <Text style={styles.sideHint}>
              {editId != null ? 'Tap a side’s time to adjust it' : 'Tap a side to start/stop · tap its time to set it manually'}
            </Text>
            {errors.duration ? <ErrorText>{errors.duration}</ErrorText> : null}

            <WheelCompoundModal
              visible={showSidePicker !== null}
              title={showSidePicker === 'right' ? 'Right minutes' : 'Left minutes'}
              columns={MINUTE_COLUMNS}
              initial={[Math.min(90, Math.round((showSidePicker === 'right' ? rightSec : leftSec) / 60))]}
              compose={(i) => i[0]}
              onCancel={() => setShowSidePicker(null)}
              onConfirm={(min) => {
                if (showSidePicker === 'left') setLeftSec(min * 60);
                else if (showSidePicker === 'right') setRightSec(min * 60);
                if (errors.duration) setErrors((e) => ({ ...e, duration: undefined }));
                setShowSidePicker(null);
              }}
            />
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

        {/* Pump duration. Editing → just an adjustable value; new → live timer. */}
        {type === 'pump' && editId != null ? (
          <>
            <Label>DURATION</Label>
            <Pressable style={styles.input} onPress={() => setShowPumpPicker(true)}>
              <View style={styles.rowBetween}>
                <Text style={styles.inputText}>{formatMMSS(timerSeconds ?? 0)}</Text>
                <Ionicons name="pencil" size={14} color={colors.dim} />
              </View>
            </Pressable>
            {errors.duration ? <ErrorText>{errors.duration}</ErrorText> : null}
            <WheelCompoundModal
              visible={showPumpPicker}
              title="Minutes"
              columns={MINUTE_COLUMNS}
              initial={[Math.min(90, Math.round((timerSeconds ?? 0) / 60))]}
              compose={(i) => i[0]}
              onCancel={() => setShowPumpPicker(false)}
              onConfirm={(min) => {
                setTimerSeconds(min * 60);
                if (errors.duration) setErrors((e) => ({ ...e, duration: undefined }));
                setShowPumpPicker(false);
              }}
            />
          </>
        ) : type === 'pump' ? (
          <>
            <Label>TIMER</Label>
            <View style={styles.timerCard}>
              {timing ? <Text style={styles.timerCaption}>RECORDING</Text> : null}
              <Text style={styles.timerClock}>{formatMMSS(timing ? liveSeconds : timerSeconds ?? 0)}</Text>
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

        {!timing && activeSide === null ? (
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

function SideTimer({
  label,
  seconds,
  active,
  editing,
  onToggle,
  onEdit,
  onReset,
}: {
  label: string;
  seconds: number;
  active: boolean;
  /** Editing an existing feed → no live timer, just the editable value. */
  editing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onReset: () => void;
}) {
  return (
    <View style={[styles.sideTimer, active && styles.sideTimerActive]}>
      {!active && seconds > 0 ? (
        <Pressable style={styles.sideReset} onPress={onReset} hitSlop={10}>
          <Ionicons name="refresh" size={15} color={colors.dim} />
        </Pressable>
      ) : null}
      <Text style={[styles.sideLabel, active && styles.sideLabelActive]}>{label}</Text>
      {/* When stopped, the time is an editable field (bordered + pencil). While
          running, it's just the live clock. */}
      {active ? (
        <View style={styles.sideClockPlain}>
          <Text style={styles.sideClock}>{formatMMSS(seconds)}</Text>
        </View>
      ) : (
        <Pressable style={styles.sideClockBox} onPress={onEdit} hitSlop={8}>
          <Text style={styles.sideClock}>{formatMMSS(seconds)}</Text>
          <Ionicons name="pencil" size={13} color={colors.dim} />
        </Pressable>
      )}
      {editing ? null : (
        <Pressable style={[styles.sideBtn, active && styles.sideBtnActive]} onPress={onToggle}>
          <Ionicons name={active ? 'stop' : 'play'} size={14} color={active ? colors.bg : colors.accent} />
          <Text style={[styles.sideBtnText, active && styles.sideBtnTextActive]}>{active ? 'Stop' : 'Start'}</Text>
        </Pressable>
      )}
    </View>
  );
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sideRow: { flexDirection: 'row', gap: spacing.md },
  sideHint: { fontFamily: fonts.ui, fontSize: 12, color: colors.dim, marginTop: spacing.sm, textAlign: 'center' },
  hintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  hintText: { fontFamily: fonts.ui, fontSize: 14, color: colors.accent, flexShrink: 1 },
  sideTimer: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
  },
  sideReset: { position: 'absolute', top: spacing.sm, right: spacing.sm, padding: spacing.xs, zIndex: 1 },
  sideTimerActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  sideLabel: { fontFamily: fonts.uiBold, fontSize: 13, letterSpacing: 1, color: colors.dim },
  sideLabelActive: { color: colors.accent },
  sideClock: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  sideClockBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  sideClockPlain: { paddingVertical: spacing.xs + 2 },
  sideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sideBtnActive: { backgroundColor: colors.accent },
  sideBtnText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.accent },
  sideBtnTextActive: { color: colors.bg },
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
