import { ChevronLeft, Menu, SquarePen } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/theme';
import { type } from '../theme/tokens';
import { PresenceDots, type PresenceMode } from './PresenceDots';
import { Tap } from './Tap';

function Bar({ left, center, right }: { left: ReactNode; center: ReactNode; right: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: c.bg }]}>
      <View style={styles.side}>{left}</View>
      <View style={styles.center}>{center}</View>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function ChatTopBar({
  subtitle,
  offline,
  mode,
  onMenu,
  onNew,
}: {
  subtitle: string | null;
  offline: boolean;
  mode: PresenceMode;
  onMenu: () => void;
  onNew: () => void;
}) {
  const c = useColors();
  return (
    <Bar
      left={
        <Tap onPress={onMenu} accessibilityLabel="Öppna sidomeny" style={styles.icon}>
          <Menu size={20} strokeWidth={1.8} color={c.textPrimary} />
        </Tap>
      }
      center={
        <>
          <View style={styles.title}>
            <PresenceDots size="sm" mode={mode} />
            <Text maxFontSizeMultiplier={1.4} style={[type.titleNav, { color: c.textPrimary }]}>
              Se7en Bot
            </Text>
          </View>
          {offline ? (
            <Text maxFontSizeMultiplier={1.4} style={[type.caption, { color: c.textError }]}>
              Ingen anslutning
            </Text>
          ) : subtitle ? (
            <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[type.caption, { color: c.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </>
      }
      right={
        <Tap onPress={onNew} accessibilityLabel="Nytt samtal" style={styles.icon}>
          <SquarePen size={20} strokeWidth={1.8} color={c.textPrimary} />
        </Tap>
      }
    />
  );
}

export function SubTopBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  const c = useColors();
  return (
    <Bar
      left={
        <Tap onPress={onBack} accessibilityLabel="Tillbaka" style={styles.icon}>
          <ChevronLeft size={20} strokeWidth={1.8} color={c.textPrimary} />
        </Tap>
      }
      center={
        <Text maxFontSizeMultiplier={1.4} style={[type.titleNav, { color: c.textPrimary }]}>
          {title}
        </Text>
      }
      right={right}
    />
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 4 },
  side: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
