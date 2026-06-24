import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WheelDateTimeModal, WheelNumberModal } from '@/src/components/WheelPicker';
import * as repo from '@/src/db/repo';
import { validateGrowthDraft, type GrowthErrors } from '@/src/logic/growth';
import { cmToUnit, gramsToUnit, lengthUnitLabel, massUnitLabel } from '@/src/logic/units';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

type Picker = 'weight' | 'length' | 'date' | null;

export default function LogGrowthScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editId = id ? Number(id) : null;
  const { activeBaby, settings } = useAppData();
  const unitMass = settings?.unit_mass ?? 'g';
  const unitLength = settings?.unit_length ?? 'cm';

  const [weight, setWeight] = useState<number | null>(null);
  const [length, setLength] = useState<number | null>(null);
  const [date, setDate] = useState<Date>(() => new Date());
  const [picker, setPicker] = useState<Picker>(null);
  const [errors, setErrors] = useState<GrowthErrors>({});
  const [saving, setSaving] = useState(false);

  // Wheel ranges + sensible starting points, per unit.
  const weightMax = unitMass === 'lb_oz' ? 66 : 30;
  const weightDefault = unitMass === 'lb_oz' ? 9 : 4;
  const lengthMin = unitLength === 'in' ? 8 : 20;
  const lengthMax = unitLength === 'in' ? 51 : 130;
  const lengthDefault = unitLength === 'in' ? 20 : 52;

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const m = await repo.getGrowthMeasurement(editId);
      if (!m) return;
      if (m.weight_g != null) setWeight(gramsToUnit(m.weight_g, unitMass));
      if (m.length_cm != null) setLength(cmToUnit(m.length_cm, unitLength));
      setDate(new Date(`${m.measured_at}T00:00:00`));
    })();
  }, [editId, unitMass, unitLength]);

  async function onSave() {
    if (!activeBaby) return;
    const result = validateGrowthDraft({
      measuredAt: date,
      weightText: weight != null ? String(weight) : '',
      lengthText: length != null ? String(length) : '',
      headText: '',
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
      setWeight(null);
      setLength(null);
      setDate(new Date());
      router.back();
    } finally {
      setSaving(false);
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>{editId != null ? 'Edit measurement' : 'Add measurement'}</Text>
        </View>
        <Text style={styles.hint}>Add at least one.</Text>

        <Text style={styles.label}>WEIGHT</Text>
        <Pressable style={styles.field} onPress={() => setPicker('weight')}>
          <Text style={weight != null ? styles.fieldText : styles.fieldPlaceholder}>
            {weight != null ? `${weight.toFixed(1)} ${massUnitLabel(unitMass)}` : 'Add weight'}
          </Text>
        </Pressable>
        {errors.weight ? <Text style={styles.error}>{errors.weight}</Text> : null}

        <Text style={styles.label}>LENGTH</Text>
        <Pressable style={styles.field} onPress={() => setPicker('length')}>
          <Text style={length != null ? styles.fieldText : styles.fieldPlaceholder}>
            {length != null ? `${length.toFixed(1)} ${lengthUnitLabel(unitLength)}` : 'Add length'}
          </Text>
        </Pressable>
        {errors.length ? <Text style={styles.error}>{errors.length}</Text> : null}

        <Text style={styles.label}>DATE</Text>
        <Pressable style={styles.field} onPress={() => setPicker('date')}>
          <Text style={styles.fieldText}>{format(date, 'd MMM yyyy')}</Text>
        </Pressable>
        {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}
        {errors.general ? <Text style={styles.error}>{errors.general}</Text> : null}

        <WheelNumberModal
          visible={picker === 'weight'}
          title="Weight"
          unit={massUnitLabel(unitMass)}
          min={0}
          max={weightMax}
          value={weight}
          defaultValue={weightDefault}
          onCancel={() => setPicker(null)}
          onConfirm={(n) => {
            setWeight(n);
            setPicker(null);
          }}
        />
        <WheelNumberModal
          visible={picker === 'length'}
          title="Length"
          unit={lengthUnitLabel(unitLength)}
          min={lengthMin}
          max={lengthMax}
          value={length}
          defaultValue={lengthDefault}
          onCancel={() => setPicker(null)}
          onConfirm={(n) => {
            setLength(n);
            setPicker(null);
          }}
        />
        <WheelDateTimeModal
          visible={picker === 'date'}
          mode="date"
          value={date}
          maximumDate={new Date()}
          onCancel={() => setPicker(null)}
          onConfirm={(d) => {
            setDate(d);
            setPicker(null);
          }}
        />

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
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  hint: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: spacing.xs, marginBottom: spacing.sm },
  label: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1, color: colors.dim, marginTop: spacing.lg, marginBottom: spacing.sm },
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  fieldText: { fontFamily: fonts.ui, fontSize: 17, color: colors.text },
  fieldPlaceholder: { fontFamily: fonts.ui, fontSize: 17, color: colors.dim },
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
