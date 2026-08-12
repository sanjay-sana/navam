import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/src/components/BrandMark';
import { colors, fonts } from '@/src/theme/theme';

// 4 tabs: Today / Log / Trends / Settings (per CLAUDE.md). Dark-only.
// Log is the prominent center action — a filled accent square with a plus,
// matching the approved mockups.
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dim,
        // Lift the bar off the Android gesture/nav area so taps don't trigger it.
        tabBarStyle: [
          styles.tabBar,
          { height: 64 + insets.bottom, paddingTop: 8, paddingBottom: 10 + insets.bottom },
        ],
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <BrandMark size={28} dimmed={!focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          tabBarIcon: () => (
            <View style={styles.logButton}>
              <Ionicons name="add" color={colors.bg} size={20} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-sharp" color={color} size={size} />
          ),
        }}
      />
      {/* Routes in the group but hidden from the tab bar (tab bar stays at 4). */}
      <Tabs.Screen name="log-feed" options={{ href: null }} />
      <Tabs.Screen name="log-sleep" options={{ href: null }} />
      <Tabs.Screen name="log-diaper" options={{ href: null }} />
      <Tabs.Screen name="flagged" options={{ href: null }} />
      <Tabs.Screen name="log-growth" options={{ href: null }} />
      <Tabs.Screen name="edit-profile" options={{ href: null }} />
      <Tabs.Screen name="history" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bg,
    borderTopColor: colors.border,
  },
  tabLabel: {
    fontFamily: fonts.ui,
    fontSize: 11,
  },
  logButton: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
