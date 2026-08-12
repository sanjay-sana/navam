import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect, type ChipOption } from '@/src/components/ChipSelect';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { Segmented } from '@/src/components/Segmented';
import { TimeField } from '@/src/components/TimeField';
import * as repo from '@/src/db/repo';
import type { SleepKind } from '@/src/db/types';
import { classifyKind, validateSleepDraft, type SleepErrors } from '@/src/logic/sleep';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

const KIND_OPTIONS = [
  { label: 'Nap', value: 'nap' as const },
  { label: 'Night', value: 'night' as const },
];
const LOCATION_OPTIONS: ChipOption[] = [
  { label: 'Crib', value: 'crib' },
  { label: 'Bassinet', value: 'bassinet' },
  { label: 'Contact', value: 'contact' },
  { label: 'Stroller', value: 'stroller' },
  { label: 'Car', value: 'car' },
];
const HOW_OPTIONS: ChipOption[] = [
  { label: 'Nursed', value: 'nursed' },
  { label: 'Rocked', value: 'rocked' },
  { label: 'Independent', value: 'independent' },
];

export default function LogSleepScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const { activeBaby, settings } = useAppData();
  const nightStart = settings?.night_start_min;
  const nightEnd = settings?.night_end_min;

  const [start, setStart] = useState<Date>(() => new Date(Date.now() - 60 * 60_000));
  const [end, setEnd] = useState<Date>(() => new Date());
  const [kind, setKind] = useState<SleepKind>(() => classifyKind(new Date(Date.now() - 60 * 60_000)));
  const [kindTouched, setKindTouched] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [how, setHow] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [ongoing, setOngoing] = useState(false); // still asleep (end_time null)
  const [errors, setErrors] = useState<SleepErrors>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Load/reset on focus — persistent tab route won't remount per editId.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (editId == null) {
          const fresh = new Date(Date.now() - 60 * 60_000);
          setStart(fresh);
          setEnd(new Date());
          setKind(classifyKind(fresh, nightStart, nightEnd));
          setKindTouched(false);
          setLocation(null);
          setHow(null);
          setNotes('');
          setFlagged(false);
          setOngoing(false);
          setErrors({});
          return;
        }
        const s = await repo.getSleepEvent(editId);
        if (!active || !s) return;
        setStart(new Date(s.start_time));
        setEnd(s.end_time ? new Date(s.end_time) : new Date());
        setOngoing(s.end_time == null);
        setKind(s.kind);
        setKindTouched(true);
        setLocation(s.location);
        setHow(s.how);
        setNotes(s.notes ?? '');
        setFlagged(s.flagged === 1);
        setErrors({});
      })();
      return () => {
        active = false;
      };
    }, [editId, nightStart, nightEnd])
  );

  function onStartChange(d: Date) {
    setStart(d);
    if (!kindTouched) setKind(classifyKind(d, nightStart, nightEnd));
  }

  async function onSave() {
    if (!activeBaby) return;
    const result = validateSleepDraft({ startTime: start, endTime: ongoing ? null : end, kind, location, how, notes, flagged });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const savedId =
        editId != null
          ? (await repo.updateSleepEvent(editId, result.value), editId)
          : await repo.createSleepEvent(activeBaby.id, result.value);
      // An ongoing sleep must be the only open one.
      if (ongoing) await repo.closeOtherOpenSleeps(activeBaby.id, savedId, new Date().toISOString());
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (editId == null) return;
    setShowDelete(false);
    await repo.deleteSleepEvent(editId);
    router.back();
  }

  if (!activeBaby) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{editId != null ? 'Edit sleep' : 'Log sleep'}</Text>
        </View>

        <Text style={styles.label}>KIND</Text>
        <Segmented
          options={KIND_OPTIONS}
          value={kind}
          onChange={(k) => {
            setKind(k);
            setKindTouched(true);
          }}
          color={colors.sleep}
        />
        <Text style={styles.kindHint}>
          Night = the main overnight sleep. Nap = a daytime sleep. Auto-set from the start time — tap to change.
        </Text>

        <TimeField label="FELL ASLEEP" value={start} onChange={onStartChange} error={errors.time} />

        <View style={styles.ongoingRow}>
          <Text style={styles.ongoingLabel}>Still sleeping</Text>
          <Switch
            value={ongoing}
            onValueChange={setOngoing}
            trackColor={{ true: colors.sleep, false: colors.surface2 }}
            thumbColor={colors.white}
          />
        </View>

        {!ongoing ? (
          <TimeField label="WOKE UP" value={end} onChange={setEnd} error={errors.end} />
        ) : null}

        <Text style={styles.label}>WHERE (OPTIONAL)</Text>
        <ChipSelect options={LOCATION_OPTIONS} value={location} onChange={setLocation} color={colors.sleep} />

        <Text style={styles.label}>HOW (OPTIONAL)</Text>
        <ChipSelect options={HOW_OPTIONS} value={how} onChange={setHow} color={colors.sleep} />

        <Text style={styles.label}>NOTES (OPTIONAL)</Text>
        <TextInput
          style={styles.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything to note"
          placeholderTextColor={colors.dim}
          multiline
        />

        <Pressable style={styles.flagRow} onPress={() => setFlagged((f) => !f)}>
          <View style={styles.flagLabel}>
            <Ionicons name={flagged ? 'flag' : 'flag-outline'} size={18} color={flagged ? colors.accent : colors.dim} />
            <Text style={styles.flagText}>Flag for review</Text>
          </View>
          <Switch
            value={flagged}
            onValueChange={setFlagged}
            trackColor={{ true: colors.accent, false: colors.surface2 }}
            thumbColor={colors.white}
          />
        </Pressable>

        {editId != null ? (
          <Pressable style={styles.deleteButton} onPress={() => setShowDelete(true)}>
            <Text style={styles.deleteText}>Delete sleep</Text>
          </Pressable>
        ) : null}

        <ConfirmDialog
          visible={showDelete}
          title="Delete sleep?"
          message="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setShowDelete(false)}
          onConfirm={doDelete}
        />
      </ScrollView>

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : editId != null ? 'Save changes' : 'Save sleep'}</Text>
      </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1, color: colors.dim, marginTop: spacing.lg, marginBottom: spacing.sm },
  kindHint: { fontFamily: fonts.ui, fontSize: 13, color: colors.dim, marginTop: spacing.sm, lineHeight: 18 },
  ongoingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  ongoingLabel: { fontFamily: fonts.uiBold, fontSize: 17, color: colors.text },
  notes: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.ui,
    fontSize: 16,
    color: colors.text,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
  },
  flagLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flagText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.text },
  deleteButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  deleteText: { fontFamily: fonts.uiBold, fontSize: 16, color: '#E8896B' },
  saveButton: {
    backgroundColor: colors.sleep,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.bg },
});
