import { useEffect, useRef, type ReactNode } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path, Polygon, Rect } from 'react-native-svg';
import type { BotColor, BotShape, Expression } from '../state/bots';
import { useColors, useReduceMotion } from '../theme/theme';

// Geometry from components.md › BotAvatar (viewBox 0 0 48 48). `round` = filled and
// stroked in the body colour with round joins; `dy` moves the eyes down.
const SHAPE: Record<BotShape, { dy: number; body: (fill: string) => ReactNode }> = {
  circle: { dy: 0, body: (f) => <Circle cx={24} cy={24} r={20} fill={f} /> },
  square: { dy: 0, body: (f) => <Rect x={5} y={5} width={38} height={38} rx={13} fill={f} /> },
  hexagon: { dy: 0, body: (f) => <Polygon points="24,5 40.5,14.5 40.5,33.5 24,43 7.5,33.5 7.5,14.5" {...round(f, 5)} /> },
  clover: {
    dy: 0,
    body: (f) => (
      <G fill={f}>
        <Circle cx={24} cy={14} r={10.5} />
        <Circle cx={34} cy={24} r={10.5} />
        <Circle cx={24} cy={34} r={10.5} />
        <Circle cx={14} cy={24} r={10.5} />
        <Circle cx={24} cy={24} r={10} />
      </G>
    ),
  },
  drop: { dy: 7, body: (f) => <Path d="M24 4C30 12 40 21 40 29.5A16 16 0 0 1 8 29.5C8 21 18 12 24 4Z" {...round(f, 2)} /> },
  triangle: { dy: 5, body: (f) => <Path d="M24 9 41 38H7Z" {...round(f, 8)} /> },
  seven: {
    dy: 0,
    body: (f) => (
      <G fill={f}>
        <Circle cx={24} cy={24} r={15} />
        {[[24, 11], [34.2, 15.9], [36.7, 26.9], [29.6, 35.7], [18.4, 35.7], [11.3, 26.9], [13.8, 15.9]].map(([x, y]) => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={8} />
        ))}
      </G>
    ),
  },
  pentagon: { dy: 2, body: (f) => <Polygon points="24,6 42.1,19.1 35.2,40.4 12.8,40.4 5.9,19.1" {...round(f, 5)} /> },
  octagon: {
    dy: 0,
    body: (f) => <Polygon points="42.5,16.3 42.5,31.7 31.7,42.5 16.3,42.5 5.5,31.7 5.5,16.3 16.3,5.5 31.7,5.5" {...round(f, 4)} />,
  },
  diamond: { dy: 0, body: (f) => <Polygon points="24,6 42,24 24,42 6,24" {...round(f, 7)} /> },
  pillow: { dy: 0, body: (f) => <Path d="M7 7Q24 12 41 7Q36 24 41 41Q24 36 7 41Q12 24 7 7Z" {...round(f, 5)} /> },
  cross: {
    dy: 0,
    body: (f) => (
      <G fill={f}>
        <Rect x={15} y={4} width={18} height={40} rx={9} />
        <Rect x={4} y={15} width={40} height={18} rx={9} />
      </G>
    ),
  },
};

function round(fill: string, width: number) {
  return { fill, stroke: fill, strokeWidth: width, strokeLinejoin: 'round' as const };
}

// Dot eyes: [left x, right x, y, r]. The other expressions are drawn as rects or paths.
const DOTS = {
  idle: [18, 30, 24, 3.6],
  thinking: [20.5, 32.5, 21.5, 3.4],
  waiting: [18, 30, 24, 3.6],
} as const;

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);

function DotEye({ x, y, r, color, dx, blink }: { x: number; y: number; r: number; color: string; dx: SharedValue<number>; blink: SharedValue<number> }) {
  const props = useAnimatedProps(() => ({ cx: x + dx.value, ry: r * blink.value }));
  return <AnimatedEllipse cy={y} rx={r} fill={color} animatedProps={props} />;
}

export function BotAvatar({
  shape,
  color,
  size,
  expression = 'idle',
  still,
  label,
}: {
  shape: BotShape;
  color: BotColor | 'empty';
  size: number;
  expression?: Expression;
  // No blink or eye movement (pickers, history rows). `xs` sizes never animate.
  still?: boolean;
  // Set when the avatar stands alone; next to a name it is decoration.
  label?: string;
}) {
  const c = useColors();
  const reduce = useReduceMotion();
  const animate = !still && !reduce && size > 16;
  const blink = useSharedValue(1);
  const dx = useSharedValue(0);
  const fade = useSharedValue(1);
  const mounted = useRef(false);

  useEffect(() => {
    cancelAnimation(blink);
    cancelAnimation(dx);
    blink.value = 1;
    dx.value = 0;
    // Expressions cross-fade in 150 ms; the body does not move.
    if (mounted.current && !reduce) {
      fade.value = 0;
      fade.value = withTiming(1, { duration: 150 });
    }
    mounted.current = true;
    if (!animate) return;
    if (expression === 'waiting') {
      // Looks back and forth: 16/28 ↔ 20/32 over 2.4 s.
      dx.value = -2;
      dx.value = withRepeat(withTiming(2, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1, true);
      return () => cancelAnimation(dx);
    }
    if (expression === 'idle') {
      // Blinks every 4–6 s: scaleY 1 → 0.1 → 1 in 140 ms.
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        timer = setTimeout(() => {
          blink.value = withSequence(withTiming(0.1, { duration: 70 }), withTiming(1, { duration: 70 }));
          schedule();
        }, 4000 + Math.random() * 2000);
      };
      schedule();
      return () => clearTimeout(timer);
    }
  }, [expression, animate, reduce, blink, dx, fade]);

  const eyesProps = useAnimatedProps(() => ({ opacity: fade.value }));
  const bodyColor = color === 'empty' ? c.botEmptyBody : c.bot[color];
  const eye = color === 'empty' ? c.botEmptyEye : c.botEye;
  const { dy, body } = SHAPE[shape];

  let eyes: ReactNode;
  if (expression === 'working') {
    eyes = (
      <>
        <Rect x={14} y={22.4} width={8} height={3.2} rx={1.6} fill={eye} />
        <Rect x={26} y={22.4} width={8} height={3.2} rx={1.6} fill={eye} />
      </>
    );
  } else if (expression === 'done' || expression === 'error') {
    const d = expression === 'done' ? ['M14.5 25.5Q18 20.5 21.5 25.5', 'M26.5 25.5Q30 20.5 33.5 25.5'] : ['M15 22.5 21 25', 'M33 22.5 27 25'];
    eyes = d.map((path) => <Path key={path} d={path} stroke={eye} strokeWidth={2.8} strokeLinecap="round" fill="none" />);
  } else {
    const [left, right, y, r] = DOTS[expression];
    eyes = (
      <>
        <DotEye x={left} y={y} r={r} color={eye} dx={dx} blink={blink} />
        <DotEye x={right} y={y} r={r} color={eye} dx={dx} blink={blink} />
      </>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessible={label ? true : undefined} accessibilityLabel={label}>
      {body(bodyColor)}
      <AnimatedG y={dy} animatedProps={eyesProps}>
        {eyes}
      </AnimatedG>
    </Svg>
  );
}
