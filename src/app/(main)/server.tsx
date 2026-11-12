import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { HermesError } from '../../hermes/client';
import { useApp } from '../../state/AppState';
import { useColors } from '../../theme/theme';
import { radius, space, type } from '../../theme/tokens';
import { Button, StatusChip } from '../../ui/parts';

// settings.md › Hermes-server: Adress, Token (secure), status, Anslut, Koppla från.
export default function ServerSheet() {
  const c = useColors();
  const router = useRouter();
  const app = useApp();
  const [url, setUrl] = useState(app.conn?.url ?? '');
  const [token, setToken] = useState(app.conn?.token ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await app.connect(url, token);
      router.back();
    } catch (e) {
      setError(
        e instanceof HermesError && (e.status === 401 || e.status === 403)
          ? 'Fel token. Kontrollera API_SERVER_KEY.'
          : 'Kunde inte nå servern. Kontrollera adressen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await app.disconnect();
    setUrl('');
    setToken('');
  };

  const field = [type.body, styles.field, { color: c.textPrimary, borderColor: c.border, backgroundColor: c.bg }];
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={[type.titleNav, { color: c.textPrimary }]}>Hermes-server</Text>
        {app.conn &&
          (app.connStatus === 'connected' ? <StatusChip kind="busy" label="Ansluten" /> : <StatusChip kind="error" label="Ej ansluten" />)}
      </View>
      <Text style={[type.small, { color: c.textSecondary }]}>Adress</Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        placeholder="http://192.168.1.10:8642"
        placeholderTextColor={c.textSecondary}
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Adress"
        style={field}
      />
      <Text style={[type.small, { color: c.textSecondary }]}>Token</Text>
      <TextInput
        value={token}
        onChangeText={setToken}
        placeholder="API_SERVER_KEY"
        placeholderTextColor={c.textSecondary}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Token"
        style={field}
      />
      {error && <Text style={[type.small, { color: c.textError }]}>{error}</Text>}
      <View style={styles.buttons}>
        <Button label="Anslut" onPress={connect} loading={busy} disabled={!url.trim() || !token.trim()} />
        {app.conn && <Button label="Koppla från" variant="destructive" onPress={disconnect} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: space[5], gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[2] },
  field: { borderWidth: 1, borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: 12, marginBottom: space[2] },
  buttons: { flexDirection: 'row', gap: space[2], marginTop: space[2] },
});
