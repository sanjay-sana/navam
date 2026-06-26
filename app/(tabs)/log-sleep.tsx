import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
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
  const { activeBaby } = useAppData();

  const [start, setStart] = useState<Date>(() => new Date(Date.now() - 60 * 60_000));
  const [end, setEnd] = useState<Date>(() => new Date());
  const [kind, setKind] = useState<SleepKind>(() => classifyKind(new Date(Date.now() - 60 * 60_000)));
  const [kindTouched, setKindTouched] = useState(false);
  const [location, setLocation] = useState<string | null>(null);
  const [how, setHow] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [ongoing, setOngoing] = useState(false); // still asleep (end_time null)
  const [originallyOpen, setOriginallyOpen] = useState(false);
  const [errors, setErrors] = useState<SleepErrors>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const s = await repo.getSleepEvent(editId);
      if (!s) return;
      const open = s.end_time == null;
      setStart(new Date(s.start_time));
      setEnd(s.end_time ? new Date(s.end_time) : new Date());
      setOngoing(open);
      setOriginallyOpen(open);
      setKind(s.kind);
      setKindTouched(true);
      setLocation(s.location);
      setHow(s.how);
      setNotes(s.notes ?? '');
    })();
  }, [editId]);

  function onStartChange(d: Date) {
    setStart(d);
    if (!kindTouched) setKind(classifyKind(d));
  }

  async function onSave() {
    if (!activeBaby) return;
    const result = validateSleepDraft({ startTime: start, endTime: ongoing ? null : end, kind, location, how, notes });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (editId != null) {
        await repo.updateSleepEvent(editId, result.value);
      } else {
        await repo.createSleepEvent(activeBaby.id, result.value);
      }
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
      <ScrollView contentContainerStyle={styles.content}>
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

        <TimeField label="FELL ASLEEP" value={start} onChange={onStartChange} error={errors.time} />

        {originallyOpen ? (
          <View style={styles.ongoingRow}>
            <Text style={styles.ongoingLabel}>Still sleeping</Text>
            <Switch
              value={ongoing}
              onValueChange={setOngoing}
              trackColor={{ true: colors.sleep, false: colors.surface2 }}
              thumbColor={colors.white}
            />
          </View>
        ) : null}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.lg },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1, color: colors.dim, marginTop: spacing.lg, marginBottom: spacing.sm },
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
