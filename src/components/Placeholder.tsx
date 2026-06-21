// Temporary empty-tab scaffold for Phase 0. Each tab replaces this with its real
// screen in later phases (Today P2, Log P3/P4, Trends P5, Settings P5/P6).
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, spacing } from '@/src/theme/theme';

export function Placeholder({ title }: { title: string }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text },
  subtitle: {
    fontFamily: fonts.ui,
    fontSize: 15,
    color: colors.dim,
    marginTop: spacing.xs,
  },
});
