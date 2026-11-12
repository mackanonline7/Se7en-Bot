import * as Haptics from 'expo-haptics';
import { ArrowUp, Mic, Plus, Square } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useColors } from '../theme/theme';
import { radius, type } from '../theme/tokens';
import { Tap } from './Tap';

type Props = { offline: boolean; streaming: boolean; onSend: (text: string) => void; onStop: () => void };

export function Composer({ offline, streaming, onSend, onStop }: Props) {
  const c = useColors();
  const [text, setText] = useState('');
  const canSend = text.trim() !== '' && !offline;

  const send = () => {
    if (!canSend) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSend(text.trim());
    setText('');
  };

  return (
    <View
      style={[styles.box, { backgroundColor: c.bgComposer, borderColor: c.border }, offline && { opacity: 0.4 }]}
      pointerEvents={offline ? 'none' : 'auto'}
    >
      {/* Attachments (plus) and Röstläge (mic) are later build steps: shown inactive. */}
      <Tap disabled accessibilityLabel="Bifoga" style={styles.icon}>
        <Plus size={22} strokeWidth={1.8} color={c.textPrimary} />
      </Tap>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        editable={!offline}
        placeholder={offline ? 'Ingen anslutning till Hermes' : 'Fråga Se7en…'}
        placeholderTextColor={c.textSecondary}
        style={[type.body, styles.input, { color: c.textPrimary }]}
        accessibilityLabel="Meddelande"
      />
      <Tap disabled accessibilityLabel="Röstläge" style={styles.icon}>
        <Mic size={22} strokeWidth={1.8} color={c.textPrimary} />
      </Tap>
      {streaming ? (
        <Tap feedback="button" onPress={onStop} accessibilityLabel="Stoppa svaret" style={[styles.send, { backgroundColor: c.primary }]}>
          <Square size={14} strokeWidth={1.8} color={c.textOnPrimary} fill={c.textOnPrimary} />
        </Tap>
      ) : (
        <Tap
          feedback="button"
          onPress={send}
          disabled={!canSend}
          accessibilityLabel="Skicka"
          style={[styles.send, { backgroundColor: c.primary }]}
        >
          <ArrowUp size={16} strokeWidth={1.8} color={c.textOnPrimary} />
        </Tap>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: radius.input,
    paddingTop: 6,
    paddingRight: 6,
    paddingBottom: 6,
    paddingLeft: 10,
    gap: 4,
  },
  // 6 lines × 21 px line height.
  input: { flex: 1, maxHeight: 126, paddingTop: 6, paddingBottom: 6 },
  icon: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  send: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
