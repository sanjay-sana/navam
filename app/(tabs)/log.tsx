import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, eventColors, fonts, radius, spacing } from '@/src/theme/theme';

const OPTIONS: {
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: Href;
}[] = [
  { label: 'Feed', hint: 'Breast · bottle', icon: 'cafe', color: eventColors.feed, href: '/log-feed' },
  { label: 'Pump', hint: 'Milk expressed', icon: 'arrow-down', color: eventColors.pump, href: { pathname: '/log-feed', params: { pump: '1' } } },
  { label: 'Sleep', hint: 'Nap · night', icon: 'moon', color: eventColors.sleep, href: '/log-sleep' },
  { label: 'Diaper', hint: 'Wet · dirty · mixed', icon: 'water', color: eventColors.diaper, href: '/log-diaper' },
  { label: 'Growth', hint: 'Weight · height', icon: 'trending-up', color: eventColors.growth, href: '/log-growth' },
];

export default function LogScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>Log</Text>
        {OPTIONS.map((o) => (
          <Pressable key={o.label} style={styles.row} onPress={() => router.push(o.href)}>
            <View style={[styles.icon, { backgroundColor: `${o.color}24` }]}>
              <Ionicons name={o.icon} size={24} color={o.color} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>{o.label}</Text>
              <Text style={styles.rowHint}>{o.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.dim} />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontFamily: fonts.uiBold, fontSize: 19, color: colors.text },
  rowHint: { fontFamily: fonts.ui, fontSize: 14, color: colors.dim, marginTop: 2 },
});
