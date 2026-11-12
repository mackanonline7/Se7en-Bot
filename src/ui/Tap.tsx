import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '../theme/theme';

type Feedback = 'button' | 'icon' | 'row';

// Shared pressed/disabled states from components.md ("Gemensamt för alla tryckbara").
export function Tap({
  feedback = 'icon',
  style,
  disabled,
  ...rest
}: Omit<PressableProps, 'style'> & { feedback?: Feedback; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        style,
        disabled && { opacity: 0.4 },
        pressed && feedback === 'button' && { transform: [{ scale: 0.97 }], opacity: 0.85 },
        pressed && feedback === 'icon' && { opacity: 0.6 },
        pressed && feedback === 'row' && { backgroundColor: c.bgMuted },
      ]}
      {...rest}
    />
  );
}
