import * as Clipboard from 'expo-clipboard';
import { ActionSheetIOS, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../state/chat';
import { useColors } from '../theme/theme';
import { radius, type } from '../theme/tokens';
import { Markdown } from './Markdown';
import { ThinkingDots } from './parts';

export function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry: (id: string) => void }) {
  const c = useColors();
  const user = message.role === 'user';
  const fg = user ? c.textOnUserPill : c.textPrimary;

  // "Generera om" is left out: Hermes has no regenerate route, and re-sending would
  // add a duplicate user turn to the transcript.
  const showMenu = () => {
    if (!message.text) return;
    ActionSheetIOS.showActionSheetWithOptions({ options: ['Kopiera', 'Dela', 'Avbryt'], cancelButtonIndex: 2 }, (i) => {
      if (i === 0) Clipboard.setStringAsync(message.text);
      if (i === 1) Share.share({ message: message.text });
    });
  };

  if (message.status === 'waiting') {
    return (
      <View style={[styles.bubble, styles.assistant, styles.waiting, { backgroundColor: c.bgMuted }]}>
        <ThinkingDots />
      </View>
    );
  }

  return (
    <View style={{ alignItems: user ? 'flex-end' : 'flex-start' }}>
      <Pressable
        onLongPress={showMenu}
        accessibilityLabel={user ? 'Ditt meddelande' : 'Svar från Se7en'}
        style={[
          styles.bubble,
          user ? styles.user : styles.assistant,
          { backgroundColor: user ? c.userPill : c.bgMuted },
          message.status === 'sending' && { opacity: 0.6 },
        ]}
      >
        {user ? (
          <Text style={[type.body, { color: fg }]}>{message.text}</Text>
        ) : message.text ? (
          <Markdown text={message.text} color={fg} />
        ) : null}
        {message.status === 'streaming' && <ThinkingDots />}
        {message.status === 'error' && (
          <Text style={[type.body, { color: c.textError }]}>
            Något gick fel.{' '}
            <Text onPress={() => onRetry(message.id)} accessibilityRole="link" style={{ color: c.link, textDecorationLine: 'underline' }}>
              Försök igen
            </Text>
          </Text>
        )}
      </Pressable>
      {message.status === 'failed' && (
        <Text onPress={() => onRetry(message.id)} accessibilityRole="button" style={[type.caption, { color: c.textError, marginTop: 4 }]}>
          Kunde inte skickas · Försök igen
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: radius.bubble, paddingVertical: 9, paddingHorizontal: 12 },
  user: { maxWidth: '80%', borderBottomRightRadius: 4 },
  assistant: { maxWidth: '88%', borderBottomLeftRadius: 4, alignSelf: 'flex-start' },
  waiting: { width: 56, height: 36, justifyContent: 'center', alignItems: 'center' },
});
