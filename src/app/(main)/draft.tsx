import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../../state/AppState';
import { useColors } from '../../theme/theme';
import { space, type } from '../../theme/tokens';
import { Markdown } from '../../ui/Markdown';
import { Button } from '../../ui/parts';

// agent.md › Visa utkast: the approval's preview + Godkänn/Neka at the bottom.
export default function DraftSheet() {
  const c = useColors();
  const router = useRouter();
  const app = useApp();
  const { i } = useLocalSearchParams<{ i: string }>();
  const approval = app.chat.run?.approvals[Number(i)];
  const [state, setState] = useState<'idle' | 'once' | 'deny' | 'error'>('idle');

  if (!approval) {
    return (
      <View style={styles.body}>
        <Text style={[type.small, { color: c.textSecondary }]}>Frågan är redan besvarad.</Text>
      </View>
    );
  }

  const respond = async (choice: 'once' | 'deny') => {
    setState(choice);
    try {
      await app.respondApproval(approval, choice);
      if (choice === 'once') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      setState('error');
    }
  };

  const preview = [approval.description, approval.command && '```\n' + approval.command + '\n```'].filter(Boolean).join('\n\n');
  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={[type.titleNav, { color: c.textPrimary }]}>Utkast</Text>
        <Markdown text={preview} color={c.textPrimary} />
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: c.border }]}>
        {state === 'error' && <Text style={[type.small, { color: c.textError }]}>Kunde inte skicka svaret</Text>}
        <View style={styles.buttons}>
          <Button label="Godkänn" onPress={() => respond('once')} loading={state === 'once'} />
          <Button label="Neka" variant="destructive" onPress={() => respond('deny')} loading={state === 'deny'} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: space[5], gap: space[3] },
  footer: { borderTopWidth: 1, padding: space[4], paddingBottom: space[8], gap: space[2] },
  buttons: { flexDirection: 'row', gap: space[2] },
});
