import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSelect, type ChipOption } from '@/src/components/ChipSelect';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { TimeField } from '@/src/components/TimeField';
import * as repo from '@/src/db/repo';
import type { DiaperType } from '@/src/db/types';
import { validateDiaperDraft, type DiaperErrors } from '@/src/logic/diaper';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

const TYPES: { label: string; value: DiaperType }[] = [
  { label: 'Wet', value: 'wet' },
  { label: 'Dirty', value: 'dirty' },
  { label: 'Mixed', value: 'both' },
];
const COLOR_OPTIONS: ChipOption[] = [
  { label: 'Yellow', value: 'yellow', dot: '#E3C567' },
  { label: 'Green', value: 'green', dot: '#7FB069' },
  { label: 'Brown', value: 'brown', dot: '#8B5E3C' },
  { label: 'Black', value: 'black', dot: '#3A3A3A' },
  { label: 'Red', value: 'red', dot: '#C75D55' },
];
const CONSISTENCY_OPTIONS: ChipOption[] = [
  { label: 'Runny', value: 'runny' },
  { label: 'Soft', value: 'soft' },
  { label: 'Seedy', value: 'seedy' },
  { label: 'Formed', value: 'formed' },
  { label: 'Hard', value: 'hard' },
];

export default function LogDiaperScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const { activeBaby } = useAppData();

  const [type, setType] = useState<DiaperType | null>(null);
  const [time, setTime] = useState<Date>(() => new Date());
  const [color, setColor] = useState<string | null>(null);
  const [consistency, setConsistency] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [errors, setErrors] = useState<DiaperErrors>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  // Load/reset on focus — persistent tab route won't remount per editId.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (editId == null) {
          setType(null);
          setTime(new Date());
          setColor(null);
          setConsistency(null);
          setNotes('');
          setFlagged(false);
          setErrors({});
          return;
        }
        const d = await repo.getDiaperEvent(editId);
        if (!active || !d) return;
        setType(d.type);
        setTime(new Date(d.time));
        setColor(d.color);
        setConsistency(d.consistency);
        setNotes(d.notes ?? '');
        setFlagged(d.flagged === 1);
        setErrors({});
      })();
      return () => {
        active = false;
      };
    }, [editId])
  );

  const showStoolDetails = type === 'dirty' || type === 'both';

  async function onSave() {
    if (!activeBaby) return;
    const result = validateDiaperDraft({ type, time, color, consistency, notes, flagged });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (editId != null) {
        await repo.updateDiaperEvent(editId, result.value);
      } else {
        await repo.createDiaperEvent(activeBaby.id, result.value);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (editId == null) return;
    setShowDelete(false);
    await repo.deleteDiaperEvent(editId);
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
          <Text style={styles.title}>{editId != null ? 'Edit diaper' : 'Log diaper'}</Text>
        </View>

        <Text style={styles.label}>WHAT KIND?</Text>
        {TYPES.map((t) => {
          const selected = type === t.value;
          return (
            <Pressable
              key={t.value}
              style={[styles.typeCard, selected && styles.typeCardSelected]}
              onPress={() => setType(t.value)}
            >
              <Ionicons
                name="water"
                size={22}
                color={selected ? colors.diaper : colors.dim}
              />
              <Text style={[styles.typeText, selected && styles.typeTextSelected]}>{t.label}</Text>
              {selected ? (
                <Ionicons name="checkmark" size={22} color={colors.diaper} style={styles.check} />
              ) : null}
            </Pressable>
          );
        })}
        {errors.type ? <Text style={styles.error}>{errors.type}</Text> : null}

        <TimeField label="TIME" value={time} onChange={setTime} error={errors.time} />

        {showStoolDetails ? (
          <>
            <Text style={styles.optLabel}>COLOR (OPTIONAL)</Text>
            <ChipSelect options={COLOR_OPTIONS} value={color} onChange={setColor} color={colors.diaper} />
            <Text style={styles.optLabel}>CONSISTENCY (OPTIONAL)</Text>
            <ChipSelect options={CONSISTENCY_OPTIONS} value={consistency} onChange={setConsistency} color={colors.diaper} />
          </>
        ) : null}

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

        <Text style={styles.optLabel}>NOTES (OPTIONAL)</Text>
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
            <Text style={styles.deleteText}>Delete diaper</Text>
          </Pressable>
        ) : null}

        <ConfirmDialog
          visible={showDelete}
          title="Delete diaper?"
          message="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setShowDelete(false)}
          onConfirm={doDelete}
        />
      </ScrollView>

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>
          {saving ? 'Saving…' : editId != null ? 'Save changes' : 'Save diaper'}
        </Text>
      </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
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
    marginBottom: spacing.sm,
  },
  optLabel: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.dim,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
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
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },
  typeCardSelected: { backgroundColor: colors.diaperSoft, borderColor: colors.diaper },
  typeText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.text },
  typeTextSelected: { color: colors.diaper },
  check: { marginLeft: 'auto' },
  error: { fontFamily: fonts.ui, fontSize: 13, color: '#E8896B', marginTop: spacing.sm },
  deleteButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  deleteText: { fontFamily: fonts.uiBold, fontSize: 16, color: '#E8896B' },
  saveButton: {
    backgroundColor: colors.diaper,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.bg },
});
