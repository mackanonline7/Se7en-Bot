import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useColors, useReduceMotion } from '../theme/theme';
import { radius, space, type } from '../theme/tokens';
import { PresenceDots } from './PresenceDots';
import { Tap } from './Tap';

function Breath({ delay, size, color }: { delay: number; size: number; color: string }) {
  const t = useSharedValue(0);
  const reduce = useReduceMotion();
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 600 }), -1, true));
    return () => cancelAnimation(t);
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + 0.55 * t.value,
    transform: [{ scale: reduce ? 1 : 0.7 + 0.3 * t.value }],
  }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

// "Tänker-prickar": 3 × 5 px, breathe 1200 ms, 200 ms stagger.
export function ThinkingDots({ color }: { color?: string }) {
  const c = useColors();
  return (
    <View accessibilityLabel="Tänker" style={{ flexDirection: 'row', gap: 4, alignItems: 'center', height: 16 }}>
      {[0, 200, 400].map((d) => (
        <Breath key={d} delay={d} size={5} color={color ?? c.textSecondary} />
      ))}
    </View>
  );
}

// Skeleton: bg-muted block breathing 0.5↔1 over 1200 ms (Reduce Motion: static 0.7).
export function Skeleton({ width, height, style }: { width: DimensionValue; height: number; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const reduce = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 600 }), -1, true);
    return () => cancelAnimation(t);
  }, [reduce, t]);
  const anim = useAnimatedStyle(() => ({ opacity: reduce ? 0.7 : 0.5 + 0.5 * t.value }));
  return <Animated.View style={[{ width, height, borderRadius: radius.sm, backgroundColor: c.bgMuted }, anim, style]} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  fullWidth,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}) {
  const c = useColors();
  const fg = variant === 'primary' ? c.textOnPrimary : variant === 'destructive' ? c.textError : c.textPrimary;
  return (
    <Tap
      feedback="button"
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      style={[
        styles.button,
        fullWidth && { alignSelf: 'stretch' },
        variant === 'primary' ? { backgroundColor: c.primary } : { borderWidth: 1, borderColor: c.border },
        loading && { opacity: 1 },
      ]}
    >
      {/* Loading keeps the width: the label stays laid out but invisible. */}
      <Text style={[type.button, { color: fg, opacity: loading ? 0 : 1 }]}>{label}</Text>
      {loading && (
        <View style={StyleSheet.absoluteFill}>
          <View style={styles.center}>
            <ThinkingDots color={fg} />
          </View>
        </View>
      )}
    </Tap>
  );
}

export type StatusKind = 'busy' | 'waiting' | 'error' | 'idle';
export const STATUS_LABEL: Record<StatusKind, string> = {
  busy: 'Arbetar',
  waiting: 'Väntar på dig',
  error: 'Fel',
  idle: 'Vilar',
};

export function StatusDot({ kind, size = 8 }: { kind: StatusKind; size?: number }) {
  const c = useColors();
  const color = kind === 'busy' ? c.statusBusy : kind === 'waiting' ? c.statusWaiting : kind === 'error' ? c.errorFill : c.iconMuted;
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function StatusChip({ kind, label }: { kind: StatusKind; label?: string }) {
  const c = useColors();
  const color = kind === 'waiting' ? c.textWaiting : kind === 'error' ? c.textError : c.textPrimary;
  return (
    <View style={[styles.chip, { borderColor: c.border }]}>
      <StatusDot kind={kind} />
      <Text style={[type.small, { color }]}>{label ?? STATUS_LABEL[kind]}</Text>
    </View>
  );
}

export function EmptyState({ title, line, action }: { title: string; line?: string; action?: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.empty}>
      <PresenceDots size="md" />
      <Text style={[type.bodyStrong, { color: c.textPrimary, textAlign: 'center' }]}>{title}</Text>
      {line ? <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>{line}</Text> : null}
      {action}
    </View>
  );
}

export function ErrorBanner({ text, onRetry }: { text: string; onRetry: () => void }) {
  const c = useColors();
  return (
    <View style={[styles.banner, { backgroundColor: c.bgMuted, borderLeftColor: c.errorFill }]}>
      <Text style={[type.small, { color: c.textPrimary, flex: 1 }]}>
        {text} ·{' '}
        <Text accessibilityRole="link" onPress={onRetry} style={{ color: c.link, textDecorationLine: 'underline' }}>
          Försök igen
        </Text>
      </Text>
    </View>
  );
}

export function Overline({ children }: { children: string }) {
  const c = useColors();
  return <Text style={[type.overline, { color: c.textSecondary }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    height: 36,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  empty: { alignItems: 'center', gap: space[2], paddingHorizontal: space[8] },
  banner: { borderLeftWidth: 3, paddingVertical: space[2], paddingHorizontal: space[3] },
});
