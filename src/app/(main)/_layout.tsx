import { Stack } from 'expo-router';
import { useColors, useReduceMotion } from '../../theme/theme';

export default function MainLayout() {
  const c = useColors();
  const reduce = useReduceMotion();
  const sheet = {
    presentation: 'formSheet' as const,
    sheetAllowedDetents: [0.6, 1],
    sheetGrabberVisible: true,
    sheetCornerRadius: 20,
    contentStyle: { backgroundColor: c.bgCard },
  };
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: reduce ? 'fade' : 'default',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="agent" />
      <Stack.Screen name="server" options={sheet} />
      <Stack.Screen name="draft" options={sheet} />
    </Stack>
  );
}
