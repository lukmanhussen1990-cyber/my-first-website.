import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme as NavigationTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandSplashOverlay } from '@/components/brand/BrandSplashOverlay';
import { AchievementToast } from '@/components/ui/Toast';
import { useAchievementWatcher } from '@/hooks/useAchievementWatcher';
import { useNotificationNavigation } from '@/hooks/useNotificationNavigation';
import { useNotificationSync } from '@/hooks/useNotificationSync';
import { useStoresHydrated } from '@/hooks/useStoresHydrated';
import { useAppStore } from '@/store/app';
import { AppThemeProvider, fontAssets, useTheme } from '@/theme';

// Keep the native splash up until fonts and persisted state are ready.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const hydrated = useStoresHydrated();
  const themePreference = useAppStore((s) => s.settings.theme);
  // A font failure must never trap the user on the splash screen.
  const ready = (fontsLoaded || Boolean(fontError)) && hydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AppThemeProvider preference={themePreference}>
          <RootNavigator />
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { colors, isDark } = useTheme();
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const [showIntro, setShowIntro] = useState(true);
  const achievements = useAchievementWatcher();
  useNotificationSync();
  useNotificationNavigation();

  useEffect(() => {
    // Android paints the area behind the navigation bar with the root background.
    if (Platform.OS !== 'web') SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.primary,
        notification: colors.highlight,
      },
    };
  }, [isDark, colors]);

  const current = achievements.current;

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Protected guard={!hasOnboarded}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={hasOnboarded}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="exam" />
          <Stack.Screen name="subject/[id]" />
          <Stack.Screen name="subject/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="checklist" />
          <Stack.Screen name="memory/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="memory/[id]" />
          <Stack.Screen name="stress" />
          <Stack.Screen name="achievements" />
          <Stack.Screen name="settings" />
          <Stack.Screen
            name="celebration"
            options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false }}
          />
        </Stack.Protected>
      </Stack>
      <AchievementToast
        visible={current !== null}
        title={current?.title ?? ''}
        message={current?.description}
        icon={current?.icon}
        gradient={current?.gradient}
        onHide={achievements.dismiss}
      />
      {showIntro ? <BrandSplashOverlay onDone={() => setShowIntro(false)} /> : null}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
