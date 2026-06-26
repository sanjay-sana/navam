// Wrapping single-select chip row for optional fields (tap selected to clear).
// Each option may carry a colour dot (used for diaper colour).
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/src/theme/theme';

export interface ChipOption {
  label: string;
  value: string;
  dot?: string;
}

export function ChipSelect({
  options,
  value,
  onChange,
  color = colors.accent,
}: {
  options: ChipOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={[styles.chip, selected && { backgroundColor: `${color}24`, borderColor: color }]}
            onPress={() => onChange(selected ? null : o.value)}
          >
            {o.dot ? <View style={[styles.dot, { backgroundColor: o.dot }]} /> : null}
            <Text style={[styles.chipText, selected && { color }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chipText: { fontFamily: fonts.uiBold, fontSize: 14, color: colors.dim },
});
