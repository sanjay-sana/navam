import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WheelDateTimeModal } from '@/src/components/WheelPicker';
import * as repo from '@/src/db/repo';
import { validateBabyDraft, type BabyDraftErrors } from '@/src/logic/onboarding';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';
import type { Sex } from '@/src/db/types';

export default function OnboardingScreen() {
  const router = useRouter();
  const { refresh } = useAppData();

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<BabyDraftErrors>({});
  const [saving, setSaving] = useState(false);

  async function onSave() {
    const result = validateBabyDraft({ name, sex, dob });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await repo.createBaby(result.value);
      await refresh();
      router.replace('/');
    } catch (e) {
      setSaving(false);
      throw e;
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Lull</Text>
          <Text style={styles.subtitle}>Let&apos;s set up your baby.</Text>
        </View>

        {/* Name */}
        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Baby's name"
          placeholderTextColor={colors.dim}
          autoCapitalize="words"
          returnKeyType="done"
        />
        {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

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
      </View>

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
  container: { flex: 1, paddingHorizontal: spacing.lg },
  header: { marginTop: spacing.xl, marginBottom: spacing.xl },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  subtitle: {
    fontFamily: fonts.ui,
    fontSize: 16,
    color: colors.dim,
    marginTop: spacing.xs,
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
