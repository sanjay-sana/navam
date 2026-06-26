// Editable event time. Tapping the row opens the time wheel directly (the common
// "happened a bit ago, today" case); the date is shown as a secondary label and
// only changes via "Change date" (for backfilling older days). "Now" snaps to
// the current time. Used by the feed and diaper log screens.
import { format, isToday } from 'date-fns';
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

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.timeRow} onPress={() => setStep('time')}>
        <Text style={styles.timeText}>{format(value, 'h:mm a')}</Text>
        <Text style={styles.dateText}>{isToday(value) ? 'Today' : format(value, 'EEE d MMM')}</Text>
      </Pressable>
      <View style={styles.whenRow}>
        <Chip label="Now" onPress={() => onChange(new Date())} />
        <Chip label="Change date" onPress={() => setStep('date')} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  timeText: { fontFamily: fonts.ui, fontSize: 17, color: colors.text },
  dateText: { fontFamily: fonts.ui, fontSize: 15, color: colors.dim },
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
