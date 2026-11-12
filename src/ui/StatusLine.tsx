import { Pressable, StyleSheet, Text } from 'react-native';
import type { Run } from '../state/chat';
import { useColors } from '../theme/theme';
import { type } from '../theme/tokens';
import { StatusDot, ThinkingDots } from './parts';

// Under the last message while a turn runs. Idle: hidden.
export function StatusLine({ run, onWaitingPress }: { run: Run | null; onWaitingPress: () => void }) {
  const c = useColors();
  if (!run) return null;
  if (run.approvals.length) {
    return (
      <Pressable onPress={onWaitingPress} accessibilityRole="button" style={styles.row}>
        <StatusDot kind="waiting" />
        <Text style={[type.small, { color: c.textWaiting }]}>Väntar på dig</Text>
      </Pressable>
    );
  }
  const active = [...run.steps].reverse().find((s) => s.state === 'active');
  return (
    <Pressable style={styles.row} accessibilityLabel="Arbetar">
      <StatusDot kind="busy" />
      <Text style={[type.small, { color: c.textPrimary }]}>Arbetar</Text>
      <Text style={[type.small, { color: c.textSecondary, flexShrink: 1 }]} numberOfLines={1}>
        · {active ? active.name : 'skriver svar'}
      </Text>
      <ThinkingDots />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
});
