import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { hermes, type Approval, type Job } from '../../hermes/client';
import { useApp } from '../../state/AppState';
import type { Run, Step } from '../../state/chat';
import { clock } from '../../state/history';
import { useColors, useReduceMotion } from '../../theme/theme';
import { motion, radius, space, type } from '../../theme/tokens';
import { PresenceDots } from '../../ui/PresenceDots';
import { Button, ErrorBanner, Overline, Skeleton, StatusChip, StatusDot, ThinkingDots } from '../../ui/parts';
import { SubTopBar } from '../../ui/TopBar';

type Info = { jobs: Job[]; at: number };

const elapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function Card({ children, waiting }: { children: ReactNode; waiting?: boolean }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.bgCard, borderColor: waiting ? c.statusWaiting : c.border }]}>{children}</View>;
}

function StepRow({ step }: { step: Step }) {
  const c = useColors();
  const reduce = useReduceMotion();
  const color = step.state === 'failed' ? c.textError : step.state === 'active' ? c.textPrimary : c.textSecondary;
  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(motion.base)} style={styles.step}>
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
function TaskCard({ run, onStop }: { run: Run; onStop: () => void }) {
  const c = useColors();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Card>
      <Overline>{`Nu · ${elapsed(now - run.startedAt)}`}</Overline>
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

function ApprovalCard({ approval, onShow }: { approval: Approval; onShow: () => void }) {
  const c = useColors();
  const app = useApp();
  const [state, setState] = useState<'idle' | 'approving' | 'error'>('idle');
  const approve = async () => {
    setState('approving');
    try {
      await app.respondApproval(approval, 'once');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setState('error');
    }
  };
  return (
    <Card waiting>
      <View style={styles.inline}>
        <StatusDot kind="waiting" />
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

export default function AgentScreen() {
  const c = useColors();
  const router = useRouter();
  const app = useApp();
  const { run } = app.chat;
  const [info, setInfo] = useState<Info | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'failed'>('loading');

  const load = useCallback(() => {
    if (!app.conn) return;
    const conn = app.conn;
    setStatus((s) => (s === 'failed' ? 'loading' : s));
    hermes.jobs(conn).then(
      (jobs) => {
        setInfo({ jobs, at: Date.now() });
        setStatus('ok');
      },
      () => setStatus('failed'),
    );
  }, [app.conn]);

  useEffect(load, [load]);

  const stop = () =>
    Alert.alert('Stoppa uppgiften?', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Stoppa', style: 'destructive', onPress: app.stop },
    ]);

  const chipKind = run ? (run.approvals.length ? 'waiting' : 'busy') : status === 'failed' ? 'error' : 'idle';

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <SubTopBar title="Agent" onBack={() => router.back()} right={<StatusChip kind={chipKind} />} />
      {status === 'failed' && <ErrorBanner text="Kunde inte nå Hermes" onRetry={load} />}
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {run ? (
          <TaskCard run={run} onStop={stop} />
        ) : (
          <Card>
            <View style={styles.idle}>
              <PresenceDots size="md" />
              <Text style={[type.bodyStrong, { color: c.textPrimary }]}>Hermes vilar</Text>
              <Text style={[type.small, { color: c.textSecondary }]}>Inga uppgifter startade från appen just nu.</Text>
            </View>
          </Card>
        )}

        {run?.approvals.map((a, i) => (
          <Animated.View key={`${a.requestId}-${i}`} exiting={FadeOut.duration(motion.base)}>
            <ApprovalCard approval={a} onShow={() => router.push({ pathname: '/draft', params: { i } })} />
          </Animated.View>
        ))}

        {status === 'loading' && !info ? (
          <>
            <Skeleton width="100%" height={140} />
            <Skeleton width="70%" height={20} />
            <Skeleton width="55%" height={20} />
          </>
        ) : info ? (
          <View style={[styles.sections, status === 'failed' && { opacity: 0.6 }]}>
            {status === 'failed' && (
              <Text style={[type.caption, { color: c.textSecondary }]}>Senast uppdaterad {clock(info.at)}</Text>
            )}
            <Overline>Schemalagt</Overline>
            {info.jobs.length ? (
              info.jobs.map((j) => (
                <View key={j.id}>
                  <Text style={[type.body, { color: c.textPrimary }]}>{j.name}</Text>
                  <Text style={[type.caption, { color: c.textSecondary }]}>{j.paused ? `${j.schedule} · pausad` : j.schedule}</Text>
                </View>
              ))
            ) : (
              <Text style={[type.small, { color: c.textSecondary }]}>Inget schemalagt.</Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: space[3], gap: space[3] },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 7 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  step: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  stepIcon: { width: 20, alignItems: 'center' },
  idle: { alignItems: 'center', gap: 6, paddingVertical: space[2] },
  sections: { gap: space[2] },
});
