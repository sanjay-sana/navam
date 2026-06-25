import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

export default function LogDiaperScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const { activeBaby } = useAppData();

  const [type, setType] = useState<DiaperType | null>(null);
  const [time, setTime] = useState<Date>(() => new Date());
  const [errors, setErrors] = useState<DiaperErrors>({});
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const d = await repo.getDiaperEvent(editId);
      if (!d) return;
      setType(d.type);
      setTime(new Date(d.time));
    })();
  }, [editId]);

  async function onSave() {
    if (!activeBaby) return;
    const result = validateDiaperDraft({ type, time });
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
      setType(null);
      setTime(new Date());
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
      <ScrollView contentContainerStyle={styles.content}>
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
    </SafeAreaView>
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
    marginBottom: spacing.sm,
  },
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
