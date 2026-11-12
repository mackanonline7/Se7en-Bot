import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/theme';

type Feedback = 'button' | 'icon' | 'row';

// Shared pressed/disabled states from components.md ("Gemensamt för alla tryckbara").
export function Tap({
  feedback = 'icon',
  style,
  disabled,
  comingSoon,
  ...rest
}: Omit<PressableProps, 'style'> & {
  feedback?: Feedback;
  style?: StyleProp<ViewStyle>;
  // Not built yet: inactive, announced as "Kommer snart".
  comingSoon?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || !!comingSoon }}
      accessibilityHint={comingSoon ? 'Kommer snart' : undefined}
      disabled={disabled || comingSoon}
      hitSlop={6}
      style={({ pressed }) => [
        style,
        (disabled || comingSoon) && { opacity: 0.4 },
        pressed && feedback === 'button' && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        pressed && feedback === 'icon' && { opacity: 0.6 },
        pressed && feedback === 'row' && { backgroundColor: c.bgMuted },
      ]}
      {...rest}
    />
  );
}
