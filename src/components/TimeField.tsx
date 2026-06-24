// Editable event time. Tapping the row opens the custom wheel picker (date,
// then time); "Now" snaps to the current time. Used by feed and diaper logs.
import { format } from 'date-fns';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WheelDateTimeModal } from '@/src/components/WheelPicker';
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
      <Pressable style={styles.timeRow} onPress={() => setStep('date')}>
        <Text style={styles.timeText}>{format(value, 'EEE d MMM · h:mm a')}</Text>
      </Pressable>
      <View style={styles.whenRow}>
        <Chip label="Now" onPress={() => applyPreset(0)} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <WheelDateTimeModal
        visible={step === 'date'}
        mode="date"
        value={value}
        maximumDate={new Date()}
        onCancel={() => setStep(null)}
        onConfirm={(d) => {
          const merged = new Date(value);
          merged.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
          onChange(merged);
          setStep('time');
        }}
      />
      <WheelDateTimeModal
        visible={step === 'time'}
        mode="time"
        value={value}
        maximumDate={new Date()}
        onCancel={() => setStep(null)}
        onConfirm={(d) => {
          const merged = new Date(value);
          merged.setHours(d.getHours(), d.getMinutes(), 0, 0);
          onChange(merged);
          setStep(null);
        }}
      />
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
