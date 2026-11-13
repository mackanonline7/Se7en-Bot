import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import { ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOut, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';
import { hermes, type Job } from '../../hermes/client';
import { NO_BOT, useApp, type ChatKey } from '../../state/AppState';
import { botStatus, latestSession, sortBots, STATUS_EXPRESSION, type Bot } from '../../state/bots';
import { clock } from '../../state/history';
import { useColors } from '../../theme/theme';
import { motion, space, type } from '../../theme/tokens';
import { BotAvatar } from '../../ui/BotAvatar';
import { ApprovalCard, TaskCard } from '../../ui/cards';
import { Button, ErrorBanner, Overline, Skeleton, StatusDot } from '../../ui/parts';
import { Tap } from '../../ui/Tap';
import { BotsTopBar } from '../../ui/TopBar';

const FRESH_MS = 1500;

function BotRow({ bot, last, onPress, onLongPress }: { bot: Bot; last: boolean; onPress: () => void; onLongPress: () => void }) {
  const c = useColors();
  const app = useApp();
  const status = botStatus(app.chats[bot.id]);
  const session = latestSession(app.sessions.list, app.store, bot.id);
  // A bot that was just created looks happy for 1.5 s.
  const [fresh, setFresh] = useState(() => Date.now() - bot.createdAt < FRESH_MS);
  useEffect(() => {
    if (!fresh) return;
    const timer = setTimeout(() => setFresh(false), FRESH_MS);
    return () => clearTimeout(timer);
  }, [fresh]);

  let subline;
  if (status === 'waiting') {
    subline = (
      <>
        <StatusDot kind="waiting" />
        <Text style={[type.small, { color: c.textWaiting }]}>Väntar på dig</Text>
      </>
    );
  } else if (status === 'error') {
    subline = (
      <>
        <StatusDot kind="error" />
        <Text style={[type.small, { color: c.textError }]}>Fel</Text>
      </>
    );
  } else if (status !== 'idle') {
    subline = (
      <>
        <StatusDot kind="busy" />
        <Text style={[type.small, { color: c.textPrimary }]}>Arbetar</Text>
      </>
    );
  } else {
    subline = (
      <Text numberOfLines={1} style={[type.small, { color: c.textSecondary, flexShrink: 1 }]}>
        {session ? `${session.preview?.trim() || session.title?.trim() || 'Samtal'} · ${clock(session.updatedAt)}` : 'Ingen chatt än'}
      </Text>
    );
  }

  return (
    <Tap
      feedback="row"
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={bot.name}
      style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: c.border }]}
    >
      <BotAvatar shape={bot.shape} color={bot.color} size={42} expression={fresh && status === 'idle' ? 'done' : STATUS_EXPRESSION[status]} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[type.bodyStrong, { color: c.textPrimary }]}>
          {bot.name}
        </Text>
        <View style={styles.subline}>{subline}</View>
      </View>
      <ChevronRight size={20} strokeWidth={1.8} color={c.iconMuted} />
    </Tap>
  );
}

type Jobs = { list: Job[]; at: number };

export default function BotsScreen() {
  const c = useColors();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const app = useApp();
  const { conn, connStatus, store } = app;
  const [titleVisible, setTitleVisible] = useState(false);
  const [jobs, setJobs] = useState<Jobs | null>(null);
  const [jobsStatus, setJobsStatus] = useState<'loading' | 'ok' | 'failed'>('loading');

  const loadJobs = useCallback(() => {
    if (!conn) return;
    hermes.jobs(conn).then(
      (list) => {
        setJobs({ list, at: Date.now() });
        setJobsStatus('ok');
      },
      () => setJobsStatus('failed'),
    );
  }, [conn]);

  // Live while the view is open: runs and approvals arrive on their streams, the schedule is polled.
  useFocusEffect(
    useCallback(() => {
      loadJobs();
      const timer = setInterval(loadJobs, 3000);
      return () => clearInterval(timer);
    }, [loadJobs]),
  );

  const bots = useMemo(() => sortBots(store, app.sessions.list), [store, app.sessions.list]);
  const running = Object.entries(app.chats).filter(([, chat]) => chat.run);
  const botOf = (key: ChatKey) => store.bots.find((b) => b.id === key);

  const create = () => router.push('/bot');
  const openChat = (key: ChatKey) => router.push(key === NO_BOT ? '/chat' : { pathname: '/chat', params: { bot: key } });
  const openBot = (bot: Bot) => {
    app.openBot(bot.id);
    openChat(bot.id);
  };

  const confirmDelete = (bot: Bot) =>
    Alert.alert(`Radera ${bot.name}?`, 'Botens samtal tas också bort från appen.', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Radera', style: 'destructive', onPress: () => app.deleteBot(bot.id).catch(() => Alert.alert('Kunde inte radera boten')) },
    ]);

  const showMenu = (bot: Bot) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { title: bot.name, options: ['Redigera', 'Radera', 'Avbryt'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0) router.push({ pathname: '/bot', params: { id: bot.id } });
        if (i === 1) confirmDelete(bot);
      },
    );

  const confirmStop = (key: ChatKey) =>
    Alert.alert('Stoppa uppgiften?', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Stoppa', style: 'destructive', onPress: () => app.stop(key) },
    ]);

  let list;
  if (app.botsStatus === 'loading') {
    list = null;
  } else if (app.botsStatus === 'failed') {
    list = (
      <View style={styles.empty}>
        <BotAvatar shape="seven" color="empty" size={96} expression="error" />
        <Text style={[type.bodyStrong, { color: c.textPrimary }]}>Kunde inte läsa dina botar</Text>
        <View>
          <Button label="Försök igen" variant="secondary" onPress={app.reloadBots} />
        </View>
      </View>
    );
  } else if (!bots.length) {
    list = (
      <View style={styles.empty}>
        <BotAvatar shape="seven" color="empty" size={96} />
        <Text style={[type.bodyStrong, { color: c.textPrimary }]}>Inga botar än</Text>
        <Text style={[type.small, styles.emptyLine, { color: c.textSecondary }]}>
          Skapa din första bot – ge den ett namn, en figur och en färg.
        </Text>
        <View>
          <Button label="Skapa bot" onPress={create} />
        </View>
      </View>
    );
  } else {
    list = (
      <View style={styles.list}>
        {bots.map((bot, i) => (
          <Animated.View
            key={bot.id}
            entering={FadeInUp.duration(motion.base)}
            exiting={FadeOut.duration(motion.base)}
            layout={LinearTransition.duration(motion.base)}
          >
            <BotRow bot={bot} last={i === bots.length - 1} onPress={() => openBot(bot)} onLongPress={() => showMenu(bot)} />
          </Animated.View>
        ))}
      </View>
    );
  }

  const hermesFailed = connStatus === 'offline' || (connStatus === 'connected' && jobsStatus === 'failed');

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <BotsTopBar titleVisible={titleVisible} onMenu={() => navigation.openDrawer()} onCreate={create} />
      <ScrollView
        contentContainerStyle={styles.body}
        onScroll={(e) => setTitleVisible(e.nativeEvent.contentOffset.y > 40)}
        scrollEventThrottle={32}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={() => {
              loadJobs();
              app.refreshSessions();
            }}
          />
        }
      >
        <Text accessibilityRole="header" style={[type.titleLarge, styles.title, { color: c.textPrimary }]}>
          Bots
        </Text>
        {/* Rows present at launch appear at once; only a newly created bot slides in. */}
        <LayoutAnimationConfig skipEntering>{list}</LayoutAnimationConfig>

        {connStatus === 'none' && (
          <ErrorBanner text="Inte ansluten till Hermes" action="Anslut" onRetry={() => router.push('/server')} />
        )}
        {hermesFailed && (
          <ErrorBanner
            text="Kunde inte nå Hermes"
            onRetry={() => {
              app.reconnect();
              loadJobs();
            }}
          />
        )}

        {running.length > 0 && (
          <View style={styles.section}>
            <Overline>Pågår</Overline>
            {running.map(([key, chat]) =>
              chat.run ? (
                <View key={key} style={styles.cards}>
                  <TaskCard run={chat.run} bot={botOf(key)} onPress={() => openChat(key)} onStop={() => confirmStop(key)} />
                  {chat.run.approvals.map((a, i) => (
                    <Animated.View key={`${a.requestId}-${i}`} exiting={FadeOut.duration(motion.base)}>
                      <ApprovalCard
                        chatKey={key}
                        approval={a}
                        bot={botOf(key)}
                        onPress={() => openChat(key)}
                        onShow={() => router.push({ pathname: '/draft', params: { key, i } })}
                      />
                    </Animated.View>
                  ))}
                </View>
              ) : null,
            )}
          </View>
        )}

        {connStatus === 'connected' && jobsStatus === 'loading' && !jobs ? (
          <View style={styles.section}>
            <Skeleton width="100%" height={120} />
            <Skeleton width="70%" height={20} />
            <Skeleton width="55%" height={20} />
          </View>
        ) : jobs && jobs.list.length > 0 && conn ? (
          <View style={[styles.section, hermesFailed && { opacity: 0.6 }]}>
            <Overline>Schemalagt</Overline>
            {hermesFailed && <Text style={[type.caption, { color: c.textSecondary }]}>Senast uppdaterad {clock(jobs.at)}</Text>}
            {jobs.list.map((j) => (
              <View key={j.id}>
                <Text style={[type.body, { color: c.textPrimary }]}>{j.name}</Text>
                <Text style={[type.caption, { color: c.textSecondary }]}>{j.paused ? `${j.schedule} · pausad` : j.schedule}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { paddingBottom: space[10], gap: space[3] },
  title: { marginHorizontal: space[4], marginBottom: space[2] },
  list: { marginHorizontal: space[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 9, paddingHorizontal: 4, borderRadius: 10 },
  rowText: { flex: 1 },
  subline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { alignItems: 'center', gap: space[2], paddingVertical: space[10], paddingHorizontal: space[8] },
  emptyLine: { textAlign: 'center', maxWidth: 240, marginBottom: space[2] },
  section: { marginHorizontal: space[3], gap: space[2] },
  cards: { gap: space[2] },
});
