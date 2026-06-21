// A row of pill options (single-select). Used for feed type, side, contents.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, spacing } from '@/src/theme/theme';

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  color = colors.accent,
}: {
  options: SegmentOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  color?: string;
}) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[
              styles.segment,
              selected && { backgroundColor: `${color}24`, borderColor: color },
            ]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.text, selected && { color }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  segment: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  text: { fontFamily: fonts.uiBold, fontSize: 15, color: colors.dim },
});
