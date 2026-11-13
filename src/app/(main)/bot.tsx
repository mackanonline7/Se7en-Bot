import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActionSheetIOS, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../state/AppState';
import { BOT_COLORS, NAME_MAX, nameProblem, pickColor, SHAPES, type BotColor, type BotShape } from '../../state/bots';
import { useColors, useReduceMotion } from '../../theme/theme';
import { radius, space, type } from '../../theme/tokens';
import { BotAvatar } from '../../ui/BotAvatar';
import { Button } from '../../ui/parts';
import { Tap } from '../../ui/Tap';

// create-bot.md: one sheet for "Ny bot" and "Redigera bot".
export default function BotSheet() {
  const c = useColors();
  const reduce = useReduceMotion();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const app = useApp();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = app.store.bots.find((b) => b.id === id);
  const [initial] = useState(() => ({
    name: editing?.name ?? '',
    shape: editing?.shape ?? ('circle' satisfies BotShape),
    color: editing?.color ?? pickColor(app.store.bots, Math.random()),
  }));
  const [name, setName] = useState(initial.name);
  const [shape, setShape] = useState<BotShape>(initial.shape);
  const [color, setColor] = useState<BotColor>(initial.color);
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'failed' | 'closing'>('idle');
  const [happy, setHappy] = useState(false);
  // The duplicate message waits for a 300 ms pause in typing (or a press on the button).
  const [settledName, setSettledName] = useState(name);
  useEffect(() => {
    const timer = setTimeout(() => setSettledName(name), 300);
    return () => clearTimeout(timer);
  }, [name]);

  const problem = nameProblem(name, app.store.bots, editing?.id);
  const duplicate = problem === 'duplicate' && nameProblem(settledName, app.store.bots, editing?.id) === 'duplicate';
  const dirty = name !== initial.name || shape !== initial.shape || color !== initial.color;
  const locked = state === 'saving' || state === 'closing';

  usePreventRemove(dirty && state !== 'closing', ({ repeat }) => {
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Släng ändringarna?', options: ['Släng', 'Fortsätt redigera'], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (i) => {
        if (i === 0) repeat();
      },
    );
  });

  // Close only after the guard above has seen the saved state.
  useEffect(() => {
    if (state === 'closing') router.back();
  }, [state, router]);

  const scale = useSharedValue(1);
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pickShape = (next: BotShape) => {
    Haptics.selectionAsync();
    setShape(next);
    if (!reduce) {
      scale.value = 0.9;
      scale.value = withSpring(1, { duration: 300 });
    }
  };
  const pickBotColor = (next: BotColor) => {
    Haptics.selectionAsync();
    setColor(next);
  };
  const cheer = () => {
    setHappy(true);
    setTimeout(() => setHappy(false), 600);
  };

  const save = async () => {
    if (problem) {
      setSettledName(name);
      return;
    }
    setState('saving');
    try {
      await app.saveBot({ name, shape, color }, editing?.id);
      if (!editing) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState('closing');
    } catch {
      setState('failed');
    }
  };

  const shapeName = SHAPES.find((s) => s.id === shape)?.name;
  const colorName = BOT_COLORS.find((x) => x.id === color)?.name;
  const fieldBorder = duplicate ? c.textError : focused ? c.borderStrong : c.border;

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: c.bgCard }]}>
      <View style={styles.header}>
        <Tap onPress={() => router.back()} disabled={locked} accessibilityLabel="Avbryt" style={styles.cancel}>
          <Text style={[type.body, { color: c.textPrimary }]}>Avbryt</Text>
        </Tap>
        <Text accessibilityRole="header" style={[type.titleNav, { color: c.textPrimary }]}>
          {editing ? 'Redigera bot' : 'Ny bot'}
        </Text>
        <View style={styles.cancel} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Pressable onPress={cheer} accessibilityLabel={`${name.trim() || 'Din bot'}, ${shapeName}, ${colorName}`} style={styles.preview}>
          <Animated.View style={bounce}>
            <BotAvatar shape={shape} color={color} size={92} expression={happy ? 'done' : 'idle'} />
          </Animated.View>
          <Text numberOfLines={1} style={[type.bodyStrong, { color: name.trim() ? c.textPrimary : c.textSecondary }]}>
            {name.trim() || 'Din bot'}
          </Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={[type.bodyStrong, { color: c.textPrimary }]}>Namnge din bot</Text>
          <View style={[styles.field, { borderColor: fieldBorder }, locked && { opacity: 0.4 }]}>
            <TextInput
              value={name}
              onChangeText={(text) => setName(text.replace(/\n/g, ''))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus={!editing}
              editable={!locked}
              maxLength={NAME_MAX}
              returnKeyType="done"
              placeholder="T.ex. Mejlhjälpen"
              placeholderTextColor={c.textSecondary}
              accessibilityLabel="Namnge din bot"
              style={[type.body, styles.input, { color: c.textPrimary }]}
            />
            <Text style={[type.caption, { color: name.length >= NAME_MAX ? c.textError : c.textSecondary }]}>
              {name.length}/{NAME_MAX}
            </Text>
          </View>
          {duplicate && <Text style={[type.small, { color: c.textError }]}>Du har redan en bot som heter {name.trim()}.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={[type.bodyStrong, { color: c.textPrimary }]}>Figur</Text>
          <View accessibilityRole="radiogroup" style={styles.grid}>
            {[SHAPES.slice(0, 6), SHAPES.slice(6)].map((rowShapes, r) => (
              <View key={r} style={styles.gridRow}>
                {rowShapes.map((s) => (
                  <Pressable
                    key={s.id}
                    onPress={() => pickShape(s.id)}
                    disabled={locked}
                    accessibilityRole="radio"
                    accessibilityLabel={s.name}
                    accessibilityState={{ selected: s.id === shape }}
                    style={({ pressed }) => [
                      styles.cell,
                      { backgroundColor: c.bgMuted, borderColor: s.id === shape ? c.borderStrong : 'transparent' },
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    <BotAvatar shape={s.id} color={color} size={26} still />
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[type.bodyStrong, { color: c.textPrimary }]}>Färg</Text>
          <View accessibilityRole="radiogroup" style={styles.colors}>
            {BOT_COLORS.map((x) => (
              <Pressable
                key={x.id}
                onPress={() => pickBotColor(x.id)}
                disabled={locked}
                accessibilityRole="radio"
                accessibilityLabel={x.name}
                accessibilityState={{ selected: x.id === color }}
                style={({ pressed }) => [styles.swatchTap, pressed && { transform: [{ scale: 0.92 }] }]}
              >
                {/* Selected: 2 px bg-card gap, then a 2 px border-strong ring. */}
                <View style={[styles.swatchRing, { borderColor: x.id === color ? c.borderStrong : 'transparent' }]}>
                  <View style={[styles.swatch, { backgroundColor: c.bot[x.id] }]} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space[4]) }]}>
        {state === 'failed' && <Text style={[type.small, { color: c.textError }]}>Kunde inte spara boten. Försök igen.</Text>}
        <Button
          label={editing ? 'Spara' : 'Skapa bot'}
          onPress={save}
          fullWidth
          height={46}
          loading={locked}
          disabled={problem === 'empty' || duplicate}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space[4], paddingTop: space[4] },
  cancel: { minWidth: 60, minHeight: 44, justifyContent: 'center' },
  body: { paddingHorizontal: space[4], gap: space[4], paddingBottom: space[4] },
  preview: { alignItems: 'center', gap: space[2], paddingTop: 4, paddingBottom: 10 },
  section: { gap: space[2] },
  field: { flexDirection: 'row', alignItems: 'center', gap: space[2], borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  input: { flex: 1, padding: 0 },
  grid: { gap: 6 },
  gridRow: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: radius.sm, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  colors: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchTap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  swatchRing: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  footer: { paddingHorizontal: space[4], paddingTop: space[2], gap: space[2] },
});
