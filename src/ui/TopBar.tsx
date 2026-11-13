import { ChevronLeft, Menu, Plus, SquarePen } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_TEXT, type Bot, type BotStatus, type Expression } from '../state/bots';
import { useColors } from '../theme/theme';
import { type } from '../theme/tokens';
import { BotAvatar } from './BotAvatar';
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

function BackButton({ onPress, label = 'Tillbaka' }: { onPress: () => void; label?: string }) {
  const c = useColors();
  return (
    <Tap onPress={onPress} accessibilityLabel={label} style={styles.icon}>
      <ChevronLeft size={20} strokeWidth={1.8} color={c.textPrimary} />
    </Tap>
  );
}

function NewChatButton({ onPress }: { onPress: () => void }) {
  const c = useColors();
  return (
    <Tap onPress={onPress} accessibilityLabel="Nytt samtal" style={styles.icon}>
      <SquarePen size={20} strokeWidth={1.8} color={c.textPrimary} />
    </Tap>
  );
}

// `bots`: menu · (title appears once the large title has scrolled away) · plus button.
export function BotsTopBar({ titleVisible, onMenu, onCreate }: { titleVisible: boolean; onMenu: () => void; onCreate: () => void }) {
  const c = useColors();
  return (
    <Bar
      left={
        <Tap onPress={onMenu} accessibilityLabel="Öppna sidomeny" style={styles.icon}>
          <Menu size={20} strokeWidth={1.8} color={c.textPrimary} />
        </Tap>
      }
      center={
        titleVisible ? (
          <Text maxFontSizeMultiplier={1.4} style={[type.titleNav, { color: c.textPrimary }]}>
            Bots
          </Text>
        ) : null
      }
      right={
        <Tap feedback="button" onPress={onCreate} accessibilityLabel="Skapa bot" style={styles.icon}>
          <View style={[styles.plus, { backgroundColor: c.primary }]}>
            <Plus size={16} strokeWidth={1.8} color={c.textOnPrimary} />
          </View>
        </Tap>
      }
    />
  );
}

// `bot-chat`: back · avatar + name over "{status} · {leverantör}" · new chat with the bot.
// The "▾" and the model picker come with Leverantörer (build step 5).
export function BotChatTopBar({
  bot,
  expression,
  status,
  provider,
  offline,
  onBack,
  onEdit,
  onNew,
}: {
  bot: Bot;
  expression: Expression;
  status: BotStatus;
  provider: string | null;
  offline: boolean;
  onBack: () => void;
  onEdit: () => void;
  onNew: () => void;
}) {
  const c = useColors();
  const statusText = STATUS_TEXT[status];
  const statusColor = status === 'waiting' ? c.textWaiting : status === 'error' ? c.textError : c.textSecondary;
  return (
    <Bar
      left={<BackButton onPress={onBack} label="Tillbaka till Bots" />}
      center={
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${bot.name}, redigera bot`} style={styles.title}>
          <BotAvatar shape={bot.shape} color={bot.color} size={30} expression={expression} />
          <View>
            <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[type.bodyStrong, { color: c.textPrimary }]}>
              {bot.name}
            </Text>
            {offline ? (
              <Text maxFontSizeMultiplier={1.4} style={[type.caption, { color: c.textError }]}>
                Ingen anslutning
              </Text>
            ) : statusText || provider ? (
              <Text maxFontSizeMultiplier={1.4} numberOfLines={1} style={[type.caption, { color: c.textSecondary }]}>
                {statusText ? <Text style={{ color: statusColor }}>{statusText}</Text> : null}
                {statusText && provider ? ' · ' : ''}
                {provider}
              </Text>
            ) : null}
          </View>
        </Pressable>
      }
      right={<NewChatButton onPress={onNew} />}
    />
  );
}

// `chat`: only for conversations without a bot (from before Bots).
export function ChatTopBar({
  subtitle,
  offline,
  mode,
  onBack,
  onNew,
}: {
  subtitle: string | null;
  offline: boolean;
  mode: PresenceMode;
  onBack: () => void;
  onNew: () => void;
}) {
  const c = useColors();
  return (
    <Bar
      left={<BackButton onPress={onBack} label="Tillbaka till Bots" />}
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
      right={<NewChatButton onPress={onNew} />}
    />
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 4 },
  side: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 52, maxWidth: '64%' },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
