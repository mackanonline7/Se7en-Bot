import * as Haptics from 'expo-haptics';
import { Check, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { Approval } from '../hermes/client';
import { useApp, type ChatKey } from '../state/AppState';
import type { Bot } from '../state/bots';
import type { Run, Step } from '../state/chat';
import { useColors, useReduceMotion } from '../theme/theme';
import { motion, radius, space, type } from '../theme/tokens';
import { BotAvatar } from './BotAvatar';
import { Button, Overline, StatusDot, ThinkingDots } from './parts';

const elapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Card({ children, waiting, onPress }: { children: ReactNode; waiting?: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.card, { backgroundColor: c.bgCard, borderColor: waiting ? c.statusWaiting : c.border }]}>
      {children}
    </Pressable>
  );
}

function StepRow({ step }: { step: Step }) {
  const c = useColors();
  const reduce = useReduceMotion();
  const color = step.state === 'failed' ? c.textError : step.state === 'active' ? c.textPrimary : c.textSecondary;
  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(motion.base)} style={styles.inline}>
      <View style={styles.stepIcon}>
        {step.state === 'done' && <Check size={16} strokeWidth={1.8} color={c.textSecondary} />}
        {step.state === 'active' && <ThinkingDots color={c.textPrimary} />}
        {step.state === 'failed' && <X size={16} strokeWidth={1.8} color={c.textError} />}
      </View>
      <Text numberOfLines={2} style={[type.body, { color, flex: 1 }]}>
        {step.label}
      </Text>
    </Animated.View>
  );
}

// "Pausa" is left out: Hermes runs can be stopped or steered, not paused.
export function TaskCard({ run, bot, onPress, onStop }: { run: Run; bot?: Bot; onPress: () => void; onStop: () => void }) {
  const c = useColors();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Card onPress={onPress}>
      <View style={styles.head}>
        {bot && <BotAvatar shape={bot.shape} color={bot.color} size={16} expression="working" />}
        <Overline>{`Nu · ${elapsed(now - run.startedAt)}`}</Overline>
      </View>
      <Text numberOfLines={2} style={[type.bodyStrong, { color: c.textPrimary }]}>
        {run.title}
      </Text>
      {run.steps.map((s, i) => (
        <StepRow key={i} step={s} />
      ))}
      <Button label="Stoppa" variant="destructive" fullWidth onPress={onStop} />
    </Card>
  );
}

export function ApprovalCard({
  chatKey,
  approval,
  bot,
  onPress,
  onShow,
}: {
  chatKey: ChatKey;
  approval: Approval;
  bot?: Bot;
  onPress: () => void;
  onShow: () => void;
}) {
  const c = useColors();
  const app = useApp();
  const [state, setState] = useState<'idle' | 'approving' | 'error'>('idle');
  const approve = async () => {
    setState('approving');
    try {
      await app.respondApproval(chatKey, approval, 'once');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setState('error');
    }
  };
  return (
    <Card waiting onPress={onPress}>
      <View style={styles.head}>
        {bot ? <BotAvatar shape={bot.shape} color={bot.color} size={16} expression="waiting" /> : <StatusDot kind="waiting" />}
        <Text style={[type.bodyStrong, { color: c.textWaiting }]}>Väntar på dig</Text>
      </View>
      <Text style={[type.body, { color: c.textPrimary }]}>{approval.description || approval.command}</Text>
      {state === 'error' && <Text style={[type.small, { color: c.textError }]}>Kunde inte skicka svaret</Text>}
      <View style={styles.inline}>
        <Button label="Godkänn" onPress={approve} loading={state === 'approving'} />
        <Button label="Visa utkast" variant="secondary" onPress={onShow} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepIcon: { width: 20, alignItems: 'center' },
});
