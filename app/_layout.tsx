import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { configureNotifications } from '@/src/notifications/feedReminder';
import { AppDataProvider, useAppData } from '@/src/state/AppDataProvider';
import { colors } from '@/src/theme/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before fonts + data are ready.
SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppDataProvider>
        <RootNavigator />
      </AppDataProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { ready, activeBaby } = useAppData();
  const segments = useSegments();
  const router = useRouter();

  // Hold the splash screen until both fonts and the initial data load finish.
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // Tapping a feed reminder deep-links to the Log feed screen (§5.4).
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data?.url;
      if (typeof url === 'string') router.navigate(url as never);
    });
    return () => sub.remove();
  }, [router]);

  // Route gate: no baby yet → onboarding; baby exists → keep out of onboarding.
  useEffect(() => {
    if (!ready) return;
    const inOnboarding = segments[0] === 'onboarding';
    if (!activeBaby && !inOnboarding) {
      router.replace('/onboarding');
    } else if (activeBaby && inOnboarding) {
      router.replace('/');
    }
  }, [ready, activeBaby, segments, router]);

  if (!ready) return null;

  return (
    <>
      {/* v1 is dark-only; keep the status bar light on the dark background. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
