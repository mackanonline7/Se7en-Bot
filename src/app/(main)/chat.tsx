import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NO_BOT, useApp, useChat } from '../../state/AppState';
import { botStatus } from '../../state/bots';
import type { ChatMessage } from '../../state/chat';
import { dayLabel } from '../../state/history';
import { useColors } from '../../theme/theme';
import { space, type } from '../../theme/tokens';
import { BotAvatar } from '../../ui/BotAvatar';
import { Composer } from '../../ui/Composer';
import { MessageBubble } from '../../ui/MessageBubble';
import { Button, EmptyState, ErrorBanner, Skeleton } from '../../ui/parts';
import { StatusLine } from '../../ui/StatusLine';
import { Tap } from '../../ui/Tap';
import { BotChatTopBar, ChatTopBar } from '../../ui/TopBar';
import { useBotExpression } from '../../ui/useBotExpression';

type Row =
  | { kind: 'divider'; id: string; label: string }
  // endsGroup: the last bubble in a run of assistant bubbles, where the bot's avatar sits.
  | { kind: 'message'; id: string; message: ChatMessage; gap: number; endsGroup: boolean; latest: boolean };

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

// Newest first, for the inverted list. Divider when the day changes; 10 px between
// messages, 8 px between consecutive messages from the same sender.
function toRows(messages: ChatMessage[], now: number): Row[] {
  const rows: Row[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    const next = messages[i + 1];
    if (!prev || !sameDay(prev.createdAt, m.createdAt)) rows.push({ kind: 'divider', id: `d-${m.id}`, label: dayLabel(m.createdAt, now) });
    rows.push({
      kind: 'message',
      id: m.id,
      message: m,
      gap: prev && prev.role === m.role ? 8 : 10,
      endsGroup: m.role === 'assistant' && next?.role !== 'assistant',
      latest: !next,
    });
  });
  return rows.reverse();
}

export default function ChatScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const app = useApp();
  const { bot: botParam } = useLocalSearchParams<{ bot?: string }>();
  const key = botParam ?? NO_BOT;
  const bot = app.store.bots.find((b) => b.id === key);
  const chat = useChat(key);
  const expression = useBotExpression(chat);
  const { connStatus } = app;
  const sessionId = chat.sessionId;
  const list = useRef<FlatList<Row>>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const rows = useMemo(() => toRows(chat.messages, Date.now()), [chat.messages]);
  const offline = connStatus === 'offline' || connStatus === 'none';
  const provider = chat.runtime?.model ?? app.runtime?.model ?? null;

  // The bot was deleted while its chat was open.
  const botGone = key !== NO_BOT && !bot && app.botsStatus === 'ok';
  useEffect(() => {
    if (botGone) router.back();
  }, [botGone, router]);

  const send = (text: string) => {
    app.send(key, text);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };
  const connectButton = (
    <View style={{ marginTop: space[2] }}>
      <Button label="Anslut" onPress={() => router.push('/server')} />
    </View>
  );

  let body;
  if (connStatus === 'loading') {
    body = <View style={styles.fill} />;
  } else if (chat.loading === 'loading') {
    body = (
      <View style={[styles.fill, styles.skeletons]}>
        <Skeleton width="70%" height={52} />
        <Skeleton width="50%" height={36} style={{ alignSelf: 'flex-end' }} />
        <Skeleton width="85%" height={72} />
      </View>
    );
  } else if (!chat.messages.length) {
    body = (
      <View style={[styles.fill, styles.centered]}>
        {bot ? (
          <View style={styles.botEmpty}>
            <BotAvatar shape={bot.shape} color={bot.color} size={96} />
            <Text style={[type.bodyStrong, { color: c.textPrimary }]}>{bot.name}</Text>
            <Text style={[type.small, { color: c.textSecondary, textAlign: 'center' }]}>
              {connStatus === 'none' ? `Anslut till Hermes för att prata med ${bot.name}.` : 'Vad kan jag hjälpa till med?'}
            </Text>
            {connStatus === 'none' && connectButton}
          </View>
        ) : connStatus === 'none' ? (
          <EmptyState title="Anslut till Hermes" line="Lägg in adressen till din Hermes-server." action={connectButton} />
        ) : (
          <EmptyState title="Vad kan jag hjälpa till med?" />
        )}
      </View>
    );
  } else {
    body = (
      <View style={styles.fill}>
        <FlatList
          ref={list}
          inverted
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          ListHeaderComponent={<StatusLine run={chat.run} onWaitingPress={() => router.push({ pathname: '/draft', params: { key, i: 0 } })} />}
          ListHeaderComponentStyle={{ marginTop: chat.run ? 10 : 0 }}
          onScroll={(e) => setScrolledUp(e.nativeEvent.contentOffset.y > height)}
          scrollEventThrottle={100}
          renderItem={({ item }) => {
            if (item.kind === 'divider') {
              return <Text style={[type.caption, styles.divider, { color: c.textSecondary }]}>{item.label}</Text>;
            }
            const bubble = <MessageBubble message={item.message} onRetry={(id) => app.retry(key, id)} />;
            if (!bot || item.message.role === 'user') return <View style={{ marginTop: item.gap }}>{bubble}</View>;
            // chat.md: avatar 22 px beside the last bubble of a run; the others are indented 28 px.
            return (
              <View style={[styles.assistantRow, { marginTop: item.gap }]}>
                <View style={styles.avatarSlot}>
                  {item.endsGroup && (
                    <BotAvatar shape={bot.shape} color={bot.color} size={22} expression={item.latest ? expression : 'idle'} still={!item.latest} />
                  )}
                </View>
                <View style={styles.fill}>{bubble}</View>
              </View>
            );
          }}
        />
        {scrolledUp && (
          <Tap
            feedback="button"
            accessibilityLabel="Till botten"
            onPress={() => list.current?.scrollToOffset({ offset: 0, animated: true })}
            style={[styles.toBottom, { backgroundColor: c.bgCard, borderColor: c.border }]}
          >
            <ArrowDown size={20} strokeWidth={1.8} color={c.textPrimary} />
          </Tap>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: c.bg }]}>
      {bot ? (
        <BotChatTopBar
          bot={bot}
          expression={expression}
          status={botStatus(chat)}
          provider={provider}
          offline={connStatus === 'offline'}
          onBack={() => router.back()}
          onEdit={() => router.push({ pathname: '/bot', params: { id: bot.id } })}
          onNew={() => app.newChat(key)}
        />
      ) : (
        <ChatTopBar
          subtitle={provider}
          offline={connStatus === 'offline'}
          mode={connStatus === 'offline' ? 'error' : chat.run ? 'thinking' : 'idle'}
          onBack={() => router.back()}
          onNew={() => app.newChat(key)}
        />
      )}
      {connStatus === 'offline' && <ErrorBanner text="Ingen anslutning till Hermes" onRetry={app.reconnect} />}
      {chat.loading === 'failed' && sessionId && <ErrorBanner text="Kunde inte hämta samtalet" onRetry={() => app.openSession(sessionId)} />}
      {body}
      <View style={{ marginTop: 6, marginHorizontal: 10, marginBottom: Math.max(insets.bottom, 16) }}>
        <Composer
          placeholder={bot ? `Fråga ${bot.name}…` : 'Fråga Se7en…'}
          offline={offline}
          streaming={!!chat.run}
          onSend={send}
          onStop={() => app.stop(key)}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  botEmpty: { alignItems: 'center', gap: space[2], paddingHorizontal: space[8] },
  list: { paddingHorizontal: space[4], paddingVertical: space[2] },
  divider: { textAlign: 'center', marginTop: 10 },
  skeletons: { padding: space[4], gap: 10 },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  avatarSlot: { width: 22 },
  toBottom: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
