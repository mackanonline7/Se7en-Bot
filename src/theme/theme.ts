import { useEffect, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { palettes, type Colors } from './tokens';

// Follows the system; the Settings › Tema lock comes with the Settings screen.
export function useColors(): Colors {
  return useColorScheme() === 'dark' ? palettes.dark : palettes.light;
}

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}
