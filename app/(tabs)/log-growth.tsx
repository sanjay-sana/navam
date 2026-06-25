import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  WheelCompoundModal,
  WheelDateTimeModal,
  type WheelColumnSpec,
} from '@/src/components/WheelPicker';
import * as repo from '@/src/db/repo';
import type { UnitLength, UnitMass } from '@/src/db/types';
import { validateGrowthDraft, type GrowthErrors } from '@/src/logic/growth';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

const G_PER_LB = 453.592;
const CM_PER_IN = 2.54;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const nums = (a: number, b: number, step = 1): WheelColumnSpec['items'] =>
  Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => ({ label: String(a + i * step) }));

// --- weight (display value: kg or lb decimal) -------------------------------
function weightColumns(unit: UnitMass): WheelColumnSpec[] {
  return unit === 'lb_oz'
    ? [{ items: nums(0, 66), label: 'lb' }, { items: nums(0, 15), label: 'oz' }]
    : [{ items: nums(0, 30), label: 'kg' }, { items: nums(0, 990, 10), label: 'g' }];
}
function weightInitial(unit: UnitMass, v: number): number[] {
  const whole = Math.floor(v);
  return unit === 'lb_oz'
    ? [clamp(whole, 0, 66), clamp(Math.round((v - whole) * 16), 0, 15)]
    : [clamp(whole, 0, 30), clamp(Math.round((v - whole) * 100), 0, 99)];
}
const weightCompose = (unit: UnitMass, i: number[]) =>
  unit === 'lb_oz' ? i[0] + i[1] / 16 : i[0] + (i[1] * 10) / 1000;
function weightLabel(v: number, unit: UnitMass): string {
  const whole = Math.floor(v);
  if (unit === 'lb_oz') return `${whole} lb ${Math.round((v - whole) * 16)} oz`;
  const g = Math.round((v - whole) * 1000);
  return g > 0 ? `${whole} kg ${g} g` : `${whole} kg`;
}

// --- length (display value: cm, or total inches) ----------------------------
function lengthColumns(unit: UnitLength): WheelColumnSpec[] {
  return unit === 'in'
    ? [{ items: nums(0, 8), label: 'ft' }, { items: nums(0, 11), label: 'in' }]
    : [{ items: nums(20, 130), label: 'cm' }];
}
function lengthInitial(unit: UnitLength, v: number): number[] {
  if (unit === 'in') {
    const ft = clamp(Math.floor(v / 12), 0, 8);
    return [ft, clamp(Math.round(v - ft * 12), 0, 11)];
  }
  return [clamp(Math.round(v) - 20, 0, 110)];
}
const lengthCompose = (unit: UnitLength, i: number[]) => (unit === 'in' ? i[0] * 12 + i[1] : 20 + i[0]);
function lengthLabel(v: number, unit: UnitLength): string {
  if (unit === 'in') {
    const ft = Math.floor(v / 12);
    return `${ft} ft ${Math.round(v - ft * 12)} in`;
  }
  return `${Math.round(v)} cm`;
}

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
  const [showDelete, setShowDelete] = useState(false);

  const weightDefault = unitMass === 'lb_oz' ? 9 : 4;
  const lengthDefault = unitLength === 'in' ? 20 : 52;

  useEffect(() => {
    if (editId == null) return;
    (async () => {
      const m = await repo.getGrowthMeasurement(editId);
      if (!m) return;
      // Full precision (gramsToUnit/cmToUnit round to 1 dp, losing g/oz/in).
      if (m.weight_g != null) setWeight(unitMass === 'lb_oz' ? m.weight_g / G_PER_LB : m.weight_g / 1000);
      if (m.length_cm != null) setLength(unitLength === 'in' ? m.length_cm / CM_PER_IN : m.length_cm);
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

  async function doDelete() {
    if (editId == null) return;
    setShowDelete(false);
    await repo.deleteGrowthMeasurement(editId);
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
          <Text style={styles.title}>{editId != null ? 'Edit measurement' : 'Add measurement'}</Text>
        </View>
        <Text style={styles.hint}>Add at least one.</Text>

        <Text style={styles.label}>WEIGHT</Text>
        <Pressable style={styles.field} onPress={() => setPicker('weight')}>
          <Text style={weight != null ? styles.fieldText : styles.fieldPlaceholder}>
            {weight != null ? weightLabel(weight, unitMass) : 'Add weight'}
          </Text>
        </Pressable>
        {errors.weight ? <Text style={styles.error}>{errors.weight}</Text> : null}

        <Text style={styles.label}>HEIGHT</Text>
        <Pressable style={styles.field} onPress={() => setPicker('length')}>
          <Text style={length != null ? styles.fieldText : styles.fieldPlaceholder}>
            {length != null ? lengthLabel(length, unitLength) : 'Add height'}
          </Text>
        </Pressable>
        {errors.length ? <Text style={styles.error}>{errors.length}</Text> : null}

        <Text style={styles.label}>DATE</Text>
        <Pressable style={styles.field} onPress={() => setPicker('date')}>
          <Text style={styles.fieldText}>{format(date, 'd MMM yyyy')}</Text>
        </Pressable>
        {errors.date ? <Text style={styles.error}>{errors.date}</Text> : null}
        {errors.general ? <Text style={styles.error}>{errors.general}</Text> : null}

        <WheelCompoundModal
          visible={picker === 'weight'}
          title="Weight"
          columns={weightColumns(unitMass)}
          initial={weightInitial(unitMass, weight ?? weightDefault)}
          compose={(i) => weightCompose(unitMass, i)}
          onCancel={() => setPicker(null)}
          onConfirm={(n) => {
            setWeight(n);
            setPicker(null);
          }}
        />
        <WheelCompoundModal
          visible={picker === 'length'}
          title="Height"
          columns={lengthColumns(unitLength)}
          initial={lengthInitial(unitLength, length ?? lengthDefault)}
          compose={(i) => lengthCompose(unitLength, i)}
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
          <Pressable style={styles.deleteButton} onPress={() => setShowDelete(true)}>
            <Text style={styles.deleteText}>Delete measurement</Text>
          </Pressable>
        ) : null}

        <ConfirmDialog
          visible={showDelete}
          title="Delete measurement?"
          message="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onCancel={() => setShowDelete(false)}
          onConfirm={doDelete}
        />
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
