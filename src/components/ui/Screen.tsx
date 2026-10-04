import type { ReactElement, ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MAX_CONTENT_WIDTH,
  SCREEN_GUTTER,
  spacing,
  TAB_BAR_CLEARANCE,
  useTheme,
} from '@/theme';

import { AuroraBackground, type AuroraVariant } from './AuroraBackground';

export type ScreenEdge = 'top' | 'bottom';

export interface ScreenProps {
  children?: ReactNode;
  /** Wrap content in a ScrollView. Turn off for screens that manage their own list. */
  scroll?: boolean;
  /** Adds bottom clearance for the floating tab bar. */
  tabBar?: boolean;
  /** Pinned above the scroll area (doesn't scroll). Gets the page gutter. */
  header?: ReactNode;
  /** Applied to the centred content column. */
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Wrap in a KeyboardAvoidingView (padding on iOS). */
  keyboard?: boolean;
  /** Safe-area edges to pad. The scroll content always clears the bottom inset. */
  edges?: ScreenEdge[];
  /** Replaces the aurora canvas (e.g. a full-bleed image). */
  background?: ReactNode;
  /** Aurora variant when no custom `background` is given. */
  aurora?: AuroraVariant;
}

const DEFAULT_EDGES: ScreenEdge[] = ['top'];

/**
 * Root container for every screen: aurora canvas, safe-area padding, page
 * gutter and a centred, max-width content column. The status bar is handled
 * by the root layout.
 */
export function Screen({
  children,
  scroll = true,
  tabBar = false,
  header,
  contentStyle,
  refreshControl,
  keyboard = false,
  edges = DEFAULT_EDGES,
  background,
  aurora = 'default',
}: ScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padTop = edges.includes('top') ? insets.top : 0;

  const scrollBottom = insets.bottom + (tabBar ? TAB_BAR_CLEARANCE : spacing.xxxl);
  const staticBottom = tabBar
    ? insets.bottom + TAB_BAR_CLEARANCE
    : edges.includes('bottom')
      ? insets.bottom
      : 0;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottom }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      refreshControl={refreshControl}
    >
      <View style={[styles.column, contentStyle]}>{children}</View>
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.gutter, { paddingBottom: staticBottom }]}>
      <View style={[styles.column, styles.flex, contentStyle]}>{children}</View>
    </View>
  );

  const content = (
    <View style={[styles.flex, { paddingTop: padTop }]}>
      {header ? (
        <View style={styles.gutter}>
          <View style={styles.column}>{header}</View>
        </View>
      ) : null}
      {body}
    </View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {background ?? <AuroraBackground variant={aurora} />}
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { paddingHorizontal: SCREEN_GUTTER },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_GUTTER,
    paddingTop: spacing.sm,
  },
  column: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});
