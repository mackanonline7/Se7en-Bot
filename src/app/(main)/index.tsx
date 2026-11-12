import { useNavigation, useRouter } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';
import { ArrowDown } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../state/AppState';
import type { ChatMessage } from '../../state/chat';
import { dayLabel } from '../../state/history';
import { useColors } from '../../theme/theme';
import { space, type } from '../../theme/tokens';
import { Composer } from '../../ui/Composer';
import { MessageBubble } from '../../ui/MessageBubble';
import { Button, EmptyState, ErrorBanner, Skeleton } from '../../ui/parts';
import { StatusLine } from '../../ui/StatusLine';
import { Tap } from '../../ui/Tap';
import { ChatTopBar } from '../../ui/TopBar';

type Row = { kind: 'divider'; id: string; label: string } | { kind: 'message'; id: string; message: ChatMessage; gap: number };

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

// Newest first, for the inverted list. Divider when the day changes; 10 px between
// messages, 8 px between consecutive messages from the same sender.
function toRows(messages: ChatMessage[], now: number): Row[] {
  const rows: Row[] = [];
  messages.forEach((m, i) => {
    const prev = messages[i - 1];
    if (!prev || !sameDay(prev.createdAt, m.createdAt)) rows.push({ kind: 'divider', id: `d-${m.id}`, label: dayLabel(m.createdAt, now) });
    rows.push({ kind: 'message', id: m.id, message: m, gap: prev && prev.role === m.role ? 8 : 10 });
  });
  return rows.reverse();
}

export default function ChatScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  const { height } = useWindowDimensions();
  const app = useApp();
  const { chat, connStatus } = app;
  const sessionId = chat.sessionId;
  const list = useRef<FlatList<Row>>(null);
  const [scrolledUp, setScrolledUp] = useState(false);
  const rows = useMemo(() => toRows(chat.messages, Date.now()), [chat.messages]);
  const offline = connStatus === 'offline' || connStatus === 'none';

  const send = (text: string) => {
    app.send(text);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  let body;
  if (connStatus === 'loading') {
    body = <View style={styles.fill} />;
  } else if (connStatus === 'none') {
    body = (
      <View style={[styles.fill, styles.centered]}>
        <EmptyState
          title="Anslut till Hermes"
          line="Lägg in adressen till din Hermes-server."
          action={<View style={{ marginTop: space[2] }}><Button label="Anslut" onPress={() => router.push('/server')} /></View>}
        />
      </View>
    );
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
        <EmptyState title="Vad kan jag hjälpa till med?" />
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
          ListHeaderComponent={<StatusLine run={chat.run} onWaitingPress={() => router.push('/agent')} />}
          ListHeaderComponentStyle={{ marginTop: chat.run ? 10 : 0 }}
          onScroll={(e) => setScrolledUp(e.nativeEvent.contentOffset.y > height)}
          scrollEventThrottle={100}
          renderItem={({ item }) =>
            item.kind === 'divider' ? (
              <Text style={[type.caption, styles.divider, { color: c.textSecondary }]}>{item.label}</Text>
            ) : (
              <View style={{ marginTop: item.gap }}>
                <MessageBubble message={item.message} onRetry={app.retry} />
              </View>
            )
          }
        />
        {scrolledUp && (
          <Tap
            feedback="button"
            accessibilityLabel="Till senaste"
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
      <ChatTopBar
        subtitle={chat.runtime?.model ?? null}
        offline={connStatus === 'offline'}
        mode={connStatus === 'offline' ? 'error' : chat.run ? 'thinking' : 'idle'}
        onMenu={() => navigation.openDrawer()}
        onNew={app.newChat}
      />
      {connStatus === 'offline' && <ErrorBanner text="Ingen anslutning till Hermes" onRetry={app.reconnect} />}
      {chat.loading === 'failed' && sessionId && (
        <ErrorBanner text="Kunde inte hämta samtalet" onRetry={() => app.openSession(sessionId)} />
      )}
      {body}
      <View style={{ marginTop: 6, marginHorizontal: 10, marginBottom: Math.max(insets.bottom, 16) }}>
        <Composer offline={offline} streaming={!!chat.run} onSend={send} onStop={app.stop} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: space[4], paddingVertical: space[2] },
  divider: { textAlign: 'center', marginTop: 10 },
  skeletons: { padding: space[4], gap: 10 },
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
