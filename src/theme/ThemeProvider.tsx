import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from './colors';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ColorScheme = 'dark' | 'light';

export interface Theme {
  /** Resolved scheme after applying the user's preference. */
  scheme: ColorScheme;
  isDark: boolean;
  colors: ThemeColors;
  /** The user's stored preference (system / dark / light). */
  preference: ThemePreference;
}

const ThemeContext = createContext<Theme>({
  scheme: 'dark',
  isDark: true,
  colors: darkColors,
  preference: 'dark',
});

export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference === 'system') return system === 'light' ? 'light' : 'dark';
  return preference;
}

/**
 * Provides the resolved theme. The preference comes from the app store
 * (wired in the root layout) so this module stays independent of state.
 * Dark is the default whenever the system has no preference.
 */
export function AppThemeProvider({
  preference,
  children,
}: {
  preference: ThemePreference;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const value = useMemo<Theme>(() => {
    const scheme = resolveScheme(preference, system);
    return {
      scheme,
      isDark: scheme === 'dark',
      colors: scheme === 'dark' ? darkColors : lightColors,
      preference,
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
