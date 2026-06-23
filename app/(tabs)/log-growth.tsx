import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as repo from '@/src/db/repo';
import { validateGrowthDraft, type GrowthErrors } from '@/src/logic/growth';
import { cmToUnit, gramsToUnit, lengthUnitLabel, massUnitLabel } from '@/src/logic/units';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

export default function LogGrowthScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const { activeBaby, settings } = useAppData();
  const unitMass = settings?.unit_mass ?? 'g';
  const unitLength = settings?.unit_length ?? 'cm';

  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [head, setHead] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<GrowthErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const m = await repo.getGrowthMeasurement(editId);
      if (!m) return;
      if (m.weight_g != null) setWeight(String(gramsToUnit(m.weight_g, unitMass)));
      if (m.length_cm != null) setLength(String(cmToUnit(m.length_cm, unitLength)));
      if (m.head_circumference_cm != null) setHead(String(cmToUnit(m.head_circumference_cm, unitLength)));
      setDate(new Date(`${m.measured_at}T00:00:00`));
    })();
  }, [editId, unitMass, unitLength]);

  async function onSave() {
    if (!activeBaby) return;
    const result = validateGrowthDraft({
      measuredAt: date,
      weightText: weight,
      lengthText: length,
      headText: head,
      unitMass,
      unitLength,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (editId != null) {
        await repo.updateGrowthMeasurement(editId, result.value);
      } else {
        await repo.createGrowthMeasurement(activeBaby.id, result.value);
      }
      router.back();
    } catch (e) {
      setSaving(false);
      throw e;
    }
  }

  function onDelete() {
    if (editId == null) return;
    Alert.alert('Delete measurement?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await repo.deleteGrowthMeasurement(editId);
          router.back();
        },
      },
    ]);
  }

  if (!activeBaby) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{editId != null ? 'Edit measurement' : 'Add measurement'}</Text>
        <Text style={styles.hint}>Enter at least one. Leave the rest blank.</Text>

        <Text style={styles.label}>WEIGHT ({massUnitLabel(unitMass)})</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder={`e.g. 5.9`}
          placeholderTextColor={colors.dim}
          keyboardType="decimal-pad"
        />
        {errors.weight ? <Text style={styles.error}>{errors.weight}</Text> : null}

        <Text style={styles.label}>LENGTH ({lengthUnitLabel(unitLength)})</Text>
        <TextInput
          style={styles.input}
          value={length}
          onChangeText={setLength}
          placeholder="e.g. 58.4"
          placeholderTextColor={colors.dim}
          keyboardType="decimal-pad"
        />
        {errors.length ? <Text style={styles.error}>{errors.length}</Text> : null}

        <Text style={styles.label}>HEAD ({lengthUnitLabel(unitLength)})</Text>
        <TextInput
          style={styles.input}
          value={head}
          onChangeText={setHead}
          placeholder="e.g. 39.2"
          placeholderTextColor={colors.dim}
          keyboardType="decimal-pad"
        />
        {errors.head ? <Text style={styles.error}>{errors.head}</Text> : null}

        <Text style={styles.label}>DATE</Text>
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={styles.inputText}>{format(date, 'd MMM yyyy')}</Text>
        </Pressable>
        {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}
        {errors.general ? <Text style={styles.error}>{errors.general}</Text> : null}

        {showPicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            maximumDate={new Date()}
            onValueChange={(_event, selected) => {
              setShowPicker(false);
              setDate(selected);
            }}
            onDismiss={() => setShowPicker(false)}
          />
        ) : null}

        {editId != null ? (
          <Pressable style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete measurement</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : editId != null ? 'Save changes' : 'Save measurement'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text, marginTop: spacing.sm },
  hint: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: spacing.xs, marginBottom: spacing.sm },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1, color: colors.dim, marginTop: spacing.lg, marginBottom: spacing.sm },
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
  error: { fontFamily: fonts.ui, fontSize: 13, color: '#E8896B', marginTop: spacing.sm },
  deleteButton: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md },
  deleteText: { fontFamily: fonts.uiBold, fontSize: 16, color: '#E8896B' },
  saveButton: {
    backgroundColor: colors.growth,
    borderRadius: radius.lg,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.bg },
});
