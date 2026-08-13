import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/BrandMark';
import { Segmented } from '@/src/components/Segmented';
import { WheelCompoundModal, WheelDateTimeModal } from '@/src/components/WheelPicker';
import * as repo from '@/src/db/repo';
import {
  lengthColumns,
  lengthCompose,
  lengthInitial,
  lengthLabel,
  weightColumns,
  weightCompose,
  weightInitial,
  weightLabel,
} from '@/src/lib/measurementWheels';
import { unitToCm, unitToGrams } from '@/src/logic/units';
import { validateBabyDraft, type BabyDraftErrors } from '@/src/logic/onboarding';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';
import type { Sex, UnitLength, UnitMass } from '@/src/db/types';

export default function OnboardingScreen() {
  const router = useRouter();
  const { settings, refresh } = useAppData();
  const unitMass = settings?.unit_mass ?? 'g';
  const unitLength = settings?.unit_length ?? 'cm';

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [dob, setDob] = useState<Date | null>(null);
  const [birthWeight, setBirthWeight] = useState<number | null>(null);
  const [birthLength, setBirthLength] = useState<number | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showWeight, setShowWeight] = useState(false);
  const [showLength, setShowLength] = useState(false);
  const [errors, setErrors] = useState<BabyDraftErrors>({});
  const [saving, setSaving] = useState(false);

  async function changeMassUnit(u: UnitMass) {
    if (u === unitMass) return;
    await repo.updateSettings({ unit_mass: u });
    await refresh();
    setBirthWeight(null); // value's unit changed; re-enter
  }

  async function changeLengthUnit(u: UnitLength) {
    if (u === unitLength) return;
    await repo.updateSettings({ unit_length: u });
    await refresh();
    setBirthLength(null); // value's unit changed; re-enter
  }

  async function onSave() {
    const result = validateBabyDraft({ firstName, middleName, lastName, sex, dob });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const baby = await repo.createBaby(result.value);
      // Optional birth weight/length → seed an initial growth measurement at the DOB.
      if (birthWeight != null || birthLength != null) {
        await repo.createGrowthMeasurement(baby.id, {
          measured_at: result.value.date_of_birth,
          weight_g: birthWeight != null ? unitToGrams(birthWeight, unitMass) : null,
          length_cm: birthLength != null ? unitToCm(birthLength, unitLength) : null,
        });
      }
      await refresh();
      router.replace('/');
    } catch (e) {
      setSaving(false);
      throw e;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <BrandMark size={84} animate />
          <Text style={styles.title}>Welcome to Navam</Text>
          <Text style={styles.subtitle}>Let&apos;s set up your baby.</Text>
          <Text style={styles.privacyLine}>Private by design — everything stays on this device.</Text>
        </View>

        {/* Name */}
        <Text style={styles.label}>FIRST NAME</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="First name"
          placeholderTextColor={colors.dim}
          autoCapitalize="words"
        />
        {errors.firstName ? <Text style={styles.error}>{errors.firstName}</Text> : null}

        <Text style={styles.label}>MIDDLE NAME (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={middleName}
          onChangeText={setMiddleName}
          placeholder="Middle name"
          placeholderTextColor={colors.dim}
          autoCapitalize="words"
        />

        <Text style={styles.label}>LAST NAME (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={lastName}
          onChangeText={setLastName}
          placeholder="Last name"
          placeholderTextColor={colors.dim}
          autoCapitalize="words"
        />

        {/* Sex */}
        <Text style={styles.label}>SEX</Text>
        <View style={styles.segmented}>
          <SexOption label="Boy" selected={sex === 'male'} onPress={() => setSex('male')} />
          <SexOption label="Girl" selected={sex === 'female'} onPress={() => setSex('female')} />
        </View>
        {errors.sex ? <Text style={styles.error}>{errors.sex}</Text> : null}

        {/* Date of birth */}
        <Text style={styles.label}>DATE OF BIRTH</Text>
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={dob ? styles.inputText : styles.inputPlaceholder}>
            {dob ? format(dob, 'd MMM yyyy') : 'Pick a date'}
          </Text>
        </Pressable>
        {errors.dob ? <Text style={styles.error}>{errors.dob}</Text> : null}

        <WheelDateTimeModal
          visible={showPicker}
          mode="date"
          value={dob ?? new Date()}
          maximumDate={new Date()}
          onCancel={() => setShowPicker(false)}
          onConfirm={(d) => {
            setDob(d);
            setShowPicker(false);
          }}
        />

        {/* Birth weight (optional) → seeds the growth chart */}
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldHeaderLabel}>BIRTH WEIGHT (OPTIONAL)</Text>
          <View style={styles.unitToggle}>
            <Segmented
              options={[
                { label: 'kg', value: 'g' },
                { label: 'lb', value: 'lb_oz' },
              ]}
              value={unitMass}
              onChange={(u) => changeMassUnit(u as UnitMass)}
            />
          </View>
        </View>
        <Pressable style={styles.input} onPress={() => setShowWeight(true)}>
          <Text style={birthWeight != null ? styles.inputText : styles.inputPlaceholder}>
            {birthWeight != null ? weightLabel(birthWeight, unitMass) : 'Add birth weight'}
          </Text>
        </Pressable>

        <WheelCompoundModal
          visible={showWeight}
          title="Birth weight"
          columns={weightColumns(unitMass)}
          initial={weightInitial(unitMass, birthWeight ?? (unitMass === 'lb_oz' ? 7 : 3))}
          compose={(i) => weightCompose(unitMass, i)}
          onCancel={() => setShowWeight(false)}
          onConfirm={(n) => {
            setBirthWeight(n);
            setShowWeight(false);
          }}
        />

        {/* Birth length (optional) → seeds the growth chart */}
        <View style={styles.fieldHeader}>
          <Text style={styles.fieldHeaderLabel}>BIRTH LENGTH (OPTIONAL)</Text>
          <View style={styles.unitToggle}>
            <Segmented
              options={[
                { label: 'cm', value: 'cm' },
                { label: 'in', value: 'in' },
              ]}
              value={unitLength}
              onChange={(u) => changeLengthUnit(u as UnitLength)}
            />
          </View>
        </View>
        <Pressable style={styles.input} onPress={() => setShowLength(true)}>
          <Text style={birthLength != null ? styles.inputText : styles.inputPlaceholder}>
            {birthLength != null ? lengthLabel(birthLength, unitLength) : 'Add birth length'}
          </Text>
        </Pressable>

        <WheelCompoundModal
          visible={showLength}
          title="Birth length"
          columns={lengthColumns(unitLength)}
          initial={lengthInitial(unitLength, birthLength ?? (unitLength === 'in' ? 20 : 50))}
          compose={(i) => lengthCompose(unitLength, i)}
          onCancel={() => setShowLength(false)}
          onConfirm={(n) => {
            setBirthLength(n);
            setShowLength(false);
          }}
        />
      </ScrollView>

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Get started'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function SexOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.segment, selected && styles.segmentSelected]}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.sm },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  subtitle: {
    fontFamily: fonts.ui,
    fontSize: 16,
    color: colors.dim,
  },
  privacyLine: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.dim,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.dim,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldHeaderLabel: { fontFamily: fonts.uiBold, fontSize: 12, letterSpacing: 1, color: colors.dim },
  unitToggle: { width: 96 },
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
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  segmentText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.dim },
  segmentTextSelected: { color: colors.accent },
  error: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: '#E8896B',
    marginTop: spacing.sm,
  },
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
