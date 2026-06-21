// Editable event time with quick "when" presets (Now / 15m / 30m / 1h / Pick).
// Pick does date→time sequentially so Android can express a full datetime for
// backfilling older events. Used by the feed and diaper log screens.
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/src/theme/theme';

export function TimeField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: Date;
  onChange: (next: Date) => void;
  error?: string;
}) {
  const [step, setStep] = useState<'date' | 'time' | null>(null);

  const applyPreset = (minutesAgo: number) => onChange(new Date(Date.now() - minutesAgo * 60_000));

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{format(value, 'EEE d MMM · h:mm a')}</Text>
      </View>
      <View style={styles.whenRow}>
        <Chip label="Now" onPress={() => applyPreset(0)} />
        <Chip label="15m" onPress={() => applyPreset(15)} />
        <Chip label="30m" onPress={() => applyPreset(30)} />
        <Chip label="1h" onPress={() => applyPreset(60)} />
        <Chip label="Pick" onPress={() => setStep('date')} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {step ? (
        <DateTimePicker
          value={value}
          mode={step}
          maximumDate={step === 'date' ? new Date() : undefined}
          onChange={(event, selected) => {
            if (event.type !== 'set' || !selected) {
              setStep(null);
              return;
            }
            if (step === 'date') {
              const merged = new Date(value);
              merged.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
              onChange(merged);
              setStep(Platform.OS === 'ios' ? null : 'time');
            } else {
              const merged = new Date(value);
              merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
              onChange(merged);
              setStep(null);
            }
          }}
        />
      ) : null}
    </View>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg },
  label: {
    fontFamily: fonts.uiBold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.dim,
    marginBottom: spacing.sm,
  },
  timeRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  timeText: { fontFamily: fonts.ui, fontSize: 17, color: colors.text },
  whenRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.text },
  error: { fontFamily: fonts.ui, fontSize: 13, color: '#E8896B', marginTop: spacing.sm },
});
