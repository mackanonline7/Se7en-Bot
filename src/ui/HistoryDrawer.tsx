import { useRouter } from 'expo-router';
import { Search, Settings, SquarePen, X } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, ScrollView, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Session } from '../hermes/client';
import { useApp } from '../state/AppState';
import { clock, groupSessions, searchSessions, sessionTitle } from '../state/history';
import { useColors } from '../theme/theme';
import { radius, space, type } from '../theme/tokens';
import { Overline, Skeleton, StatusDot, STATUS_LABEL } from './parts';
import { Tap } from './Tap';

type Nav = { closeDrawer(): void };

// Hidden until the row moves, so it never shows through the row's rounded corners.
function DeleteAction({ progress, onPress }: { progress: SharedValue<number>; onPress: () => void }) {
  const c = useColors();
  const style = useAnimatedStyle(() => ({ opacity: progress.value > 0.01 ? 1 : 0 }));
  return (
    <Animated.View style={style}>
      <Tap feedback="button" onPress={onPress} accessibilityLabel="Radera" style={[styles.delete, { backgroundColor: c.errorFill }]}>
        <Text style={[type.button, { color: c.onErrorFill }]}>Radera</Text>
      </Tap>
    </Animated.View>
  );
}

export function HistoryDrawer({ navigation }: { navigation: Nav }) {
  const c = useColors();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const [query, setQuery] = useState('');
  const { sessions, chat } = app;
  const runKind = chat.run ? (chat.run.approvals.length ? 'waiting' : 'busy') : null;

  const close = () => navigation.closeDrawer();
  const go = (path: '/agent' | '/server') => {
    close();
    router.push(path);
  };
  const toChat = () => {
    close();
    if (router.canDismiss()) router.dismissAll();
  };
  const openChat = (id: string) => {
    toChat();
    app.openSession(id);
  };
  const newChat = () => {
    toChat();
    app.newChat();
  };

  const confirmDelete = (s: Session) =>
    Alert.alert('Radera samtalet?', undefined, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Radera', style: 'destructive', onPress: () => app.deleteSession(s.id).catch(() => Alert.alert('Kunde inte radera samtalet')) },
    ]);

  const showMenu = (s: Session) =>
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Byt namn', 'Radera', 'Avbryt'], destructiveButtonIndex: 1, cancelButtonIndex: 2 },
      (i) => {
        if (i === 0)
          Alert.prompt('Byt namn', undefined, (title) => title?.trim() && app.renameSession(s.id, title.trim()).catch(() => Alert.alert('Kunde inte byta namn')), 'plain-text', sessionTitle(s));
        if (i === 1) confirmDelete(s);
      },
    );

  const results = useMemo(() => (query.trim() ? searchSessions(sessions.list, query) : null), [sessions.list, query]);
  const groups = useMemo(() => groupSessions(sessions.list, Date.now()), [sessions.list]);

  const row = (s: Session, showTime: boolean) => {
    const selected = s.id === chat.sessionId;
    return (
      <ReanimatedSwipeable
        key={s.id}
        friction={2}
        rightThreshold={40}
        renderRightActions={(progress) => <DeleteAction progress={progress} onPress={() => confirmDelete(s)} />}
      >
        <Tap
          feedback="row"
          onPress={() => openChat(s.id)}
          onLongPress={() => showMenu(s)}
          accessibilityState={{ selected }}
          style={[styles.row, { backgroundColor: selected ? c.bgRowSelected : c.bgSidebar }]}
        >
          <Text numberOfLines={1} style={[selected ? type.bodyStrong : type.body, { color: c.textPrimary, flex: 1 }]}>
            {sessionTitle(s)}
          </Text>
          {showTime && <Text style={[type.caption, { color: c.textSecondary }]}>{clock(s.updatedAt)}</Text>}
        </Tap>
      </ReanimatedSwipeable>
    );
  };

  let list;
  if (sessions.status === 'loading') {
    list = [85, 70, 60, 80, 65, 75].map((w) => <Skeleton key={w} width={`${w}%`} height={20} style={{ margin: 12 }} />);
  } else if (sessions.status === 'failed' && !sessions.list.length) {
    list = (
      <Text style={[type.small, styles.note, { color: c.textError }]}>
        Kunde inte hämta historik{' '}
        <Text onPress={app.refreshSessions} style={{ color: c.link, textDecorationLine: 'underline' }}>
          Försök igen
        </Text>
      </Text>
    );
  } else if (results) {
    list = results.length ? (
      results.map((s) => row(s, false))
    ) : (
      <Text style={[type.small, styles.note, { color: c.textSecondary }]}>Inga träffar för ”{query.trim()}”.</Text>
    );
  } else if (!groups.length) {
    list = <Text style={[type.small, styles.note, { color: c.textSecondary }]}>Inga samtal än.</Text>;
  } else {
    list = groups.map((g) => (
      <View key={g.label} style={styles.group}>
        <View style={styles.overline}>
          <Overline>{g.label}</Overline>
        </View>
        {g.sessions.map((s) => row(s, g.label === 'Idag'))}
      </View>
    ));
  }

  const navRow = (label: string, onPress: (() => void) | null, selected = false, right?: ReactNode) => (
    <Tap
      key={label}
      feedback="row"
      onPress={onPress ?? undefined}
      disabled={!onPress}
      accessibilityState={{ selected, disabled: !onPress }}
      style={[styles.row, selected && { backgroundColor: c.bgRowSelected }]}
    >
      <Text style={[selected ? type.bodyStrong : type.body, { color: c.textPrimary, flex: 1 }]}>{label}</Text>
      {right}
    </Tap>
  );

  return (
    <View style={[styles.fill, { paddingTop: insets.top, backgroundColor: c.bgSidebar }]}>
      <View style={styles.searchRow}>
        <View style={[styles.search, { borderColor: c.border, backgroundColor: dark ? c.bgCard : c.bg }]}>
          <Search size={16} strokeWidth={1.8} color={c.iconMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Sök i samtal"
            placeholderTextColor={c.textSecondary}
            style={[type.body, { flex: 1, color: c.textPrimary, padding: 0 }]}
            accessibilityLabel="Sök i samtal"
          />
          {query ? (
            <Tap onPress={() => setQuery('')} accessibilityLabel="Rensa sökning">
              <X size={16} strokeWidth={1.8} color={c.iconMuted} />
            </Tap>
          ) : null}
        </View>
        <Tap onPress={newChat} accessibilityLabel="Nytt samtal" style={styles.icon}>
          <SquarePen size={20} strokeWidth={1.8} color={c.textPrimary} />
        </Tap>
      </View>

      <View style={styles.nav}>
        {navRow('Chatt', toChat, true)}
        {navRow(
          'Agent',
          () => go('/agent'),
          false,
          runKind && (
            <View style={styles.status}>
              <StatusDot kind={runKind} />
              <Text style={[type.small, { color: runKind === 'waiting' ? c.textWaiting : c.textPrimary }]}>{STATUS_LABEL[runKind]}</Text>
            </View>
          ),
        )}
        {/* Media and Leverantörer are later build steps: shown inactive. */}
        {navRow('Media', null)}
        {navRow('Leverantörer', null)}
      </View>
      <View style={[styles.divider, { backgroundColor: c.border }]} />

      <ScrollView style={styles.fill} contentContainerStyle={{ paddingHorizontal: 6, paddingBottom: space[4] }}>
        {list}
      </ScrollView>

      <View style={[styles.divider, { backgroundColor: c.border, marginBottom: 0 }]} />
      {/* Inställningar is a later build step; until then the footer opens its Hermes-server sheet. */}
      <Tap
        feedback="row"
        onPress={() => go('/server')}
        accessibilityLabel="Inställningar"
        style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <View style={[styles.avatar, { backgroundColor: c.primary }]}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: c.textOnPrimary }}>Du</Text>
        </View>
        <Text style={[type.bodyStrong, { color: c.textPrimary, flex: 1 }]}>Inställningar</Text>
        <Settings size={20} strokeWidth={1.8} color={c.textPrimary} />
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 12, paddingRight: 4, paddingVertical: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  nav: { paddingHorizontal: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 12 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { height: 1, marginVertical: 6, marginHorizontal: 14 },
  group: { marginTop: space[2] },
  overline: { paddingHorizontal: 12, paddingBottom: 4 },
  note: { paddingHorizontal: 12, paddingVertical: 8 },
  delete: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.sm, marginLeft: 6 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 12 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
