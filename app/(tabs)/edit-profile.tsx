import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import * as repo from '@/src/db/repo';
import type { Sex } from '@/src/db/types';
import { validateBabyDraft, type BabyDraftErrors } from '@/src/logic/onboarding';
import { useAppData } from '@/src/state/AppDataProvider';
import { colors, fonts, radius, spacing } from '@/src/theme/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const { activeBaby, refresh } = useAppData();

  const [name, setName] = useState(activeBaby?.name ?? '');
  const [sex, setSex] = useState<Sex | null>(activeBaby?.sex ?? null);
  const [dob, setDob] = useState<Date | null>(
    activeBaby ? new Date(`${activeBaby.date_of_birth}T00:00:00`) : null
  );
  const [showPicker, setShowPicker] = useState(false);
  const [errors, setErrors] = useState<BabyDraftErrors>({});
  const [saving, setSaving] = useState(false);

  if (!activeBaby) return null;

  async function onSave() {
    if (!activeBaby) return;
    const result = validateBabyDraft({ name, sex, dob });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await repo.updateBaby(activeBaby.id, result.value);
      await refresh();
      router.back();
    } catch (e) {
      setSaving(false);
      throw e;
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Edit profile</Text>
        </View>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Baby's name"
          placeholderTextColor={colors.dim}
          autoCapitalize="words"
        />
        {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}

        <Text style={styles.label}>SEX</Text>
        <View style={styles.segmented}>
          <SexOption label="Boy" selected={sex === 'male'} onPress={() => setSex('male')} />
          <SexOption label="Girl" selected={sex === 'female'} onPress={() => setSex('female')} />
        </View>
        {errors.sex ? <Text style={styles.error}>{errors.sex}</Text> : null}

        <Text style={styles.label}>DATE OF BIRTH</Text>
        <Pressable style={styles.input} onPress={() => setShowPicker(true)}>
          <Text style={dob ? styles.inputText : styles.inputPlaceholder}>
            {dob ? format(dob, 'd MMM yyyy') : 'Pick a date'}
          </Text>
        </Pressable>
        {errors.dob ? <Text style={styles.error}>{errors.dob}</Text> : null}

        {showPicker ? (
          <DateTimePicker
            value={dob ?? new Date()}
            mode="date"
            display="spinner"
            maximumDate={new Date()}
            positiveButton={{ textColor: colors.accent }}
            negativeButton={{ textColor: colors.dim }}
            onValueChange={(_event, selected) => {
              setShowPicker(Platform.OS === 'ios'); // iOS keeps the inline spinner open
              setDob(selected);
            }}
            onDismiss={() => setShowPicker(false)}
          />
        ) : null}
      </ScrollView>

      <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={onSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function SexOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segment, selected && styles.segmentSelected]} onPress={onPress}>
      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
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
  inputPlaceholder: { fontFamily: fonts.ui, fontSize: 17, color: colors.dim },
  segmented: { flexDirection: 'row', gap: spacing.sm },
  segment: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.md, alignItems: 'center' },
  segmentSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  segmentText: { fontFamily: fonts.uiBold, fontSize: 16, color: colors.dim },
  segmentTextSelected: { color: colors.accent },
  error: { fontFamily: fonts.ui, fontSize: 13, color: '#E8896B', marginTop: spacing.sm },
  saveButton: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: spacing.md + 2, alignItems: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  saveButtonDisabled: { opacity: 0.6 },
  saveText: { fontFamily: fonts.uiBold, fontSize: 18, color: colors.bg },
});
