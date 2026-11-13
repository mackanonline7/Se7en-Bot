import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useColors, useReduceMotion } from '../theme/theme';

// components.md › PresenceDots: viewBox 160, centre r 9, inner ring 6 dots r 6 on radius 28.
// The outer ring and listening/speaking modes belong to Röstläge and come with it.
export type PresenceMode = 'idle' | 'thinking' | 'error';
const SIZES = { sm: 18, md: 40 } as const;

const INNER = [{ x: 80, y: 80, r: 9 }].concat(
  Array.from({ length: 6 }, (_, i) => ({
    x: 80 + 28 * Math.cos((i * Math.PI) / 3),
    y: 80 + 28 * Math.sin((i * Math.PI) / 3),
    r: 6,
  })),
);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Dot({ x, y, r, t, color, still }: { x: number; y: number; r: number; t: SharedValue<number>; color: string; still: boolean }) {
  const props = useAnimatedProps(() => ({
    r: still ? r : r * (0.7 + 0.3 * t.value),
    opacity: 0.45 + 0.55 * t.value,
  }));
  return <AnimatedCircle cx={x} cy={y} fill={color} animatedProps={props} />;
}

// The mark as a still icon, e.g. for conversations without a bot in the history.
export function DotsMark({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="44 44 72 72">
      {INNER.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} />
      ))}
    </Svg>
  );
}

export function PresenceDots({ size = 'sm', mode = 'idle' }: { size?: keyof typeof SIZES; mode?: PresenceMode }) {
  const c = useColors();
  const reduce = useReduceMotion();
  const phases = [useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1), useSharedValue(1)];

  useEffect(() => {
    // idle: 2400 ms breath, 300 ms stagger; thinking: inner dots breathe 1200 ms. Reduce Motion: opacity only, 2400 ms.
    const period = mode === 'thinking' && !reduce ? 1200 : 2400;
    phases.forEach((t, i) => {
      cancelAnimation(t);
      if (mode === 'error') {
        t.value = 0;
        return;
      }
      t.value = 0;
      t.value = withDelay(
        reduce ? 0 : i * 300,
        withRepeat(withTiming(1, { duration: period / 2, easing: Easing.inOut(Easing.ease) }), -1, true),
      );
    });
    return () => phases.forEach(cancelAnimation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, reduce]);

  const px = SIZES[size];
  return (
    <View accessible accessibilityLabel="Se7en" style={{ width: px, height: px }}>
      <Svg width={px} height={px} viewBox="44 44 72 72">
        {INNER.map((d, i) => (
          <Dot key={i} {...d} t={phases[i]} color={c.presence} still={reduce || mode === 'error'} />
        ))}
      </Svg>
    </View>
  );
}
