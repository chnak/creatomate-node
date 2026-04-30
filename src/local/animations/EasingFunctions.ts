import { Easing } from '../../properties/Easing';

/**
 * Easing function type.
 */
type EasingFunction = (t: number) => number;

/**
 * Easing function implementations.
 */
export const easingFunctions: Record<Easing, EasingFunction> = {
  'linear': (t) => t,
  'cubic-in': (t) => t * t * t,
  'cubic-out': (t) => 1 - Math.pow(1 - t, 3),
  'cubic-in-out': (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  'back-in': (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  'back-out': (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  'back-in-out': (t) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },
  'bounce-out': (t) => {
    const n1 = 7.5625;
    const d1 = 2.75;
    if (t < 1 / d1) {
      return n1 * t * t;
    } else if (t < 2 / d1) {
      return n1 * (t -= 1.5 / d1) * t + 0.75;
    } else if (t < 2.5 / d1) {
      return n1 * (t -= 2.25 / d1) * t + 0.9375;
    } else {
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  },
  'bounce-in': (t) => 1 - easingFunctions['bounce-out'](1 - t),
  'bounce-in-out': (t) => t < 0.5
    ? (1 - easingFunctions['bounce-out'](1 - 2 * t)) / 2
    : (1 + easingFunctions['bounce-out'](2 * t - 1)) / 2,
  'elastic-out': (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
  },
  'elastic-in': (t) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI) / 3);
  },
  'elastic-in-out': (t) => t < 0.5
    ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2
    : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * (2 * Math.PI) / 4.5)) / 2 + 1,
  'expo-out': (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  'expo-in': (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  'expo-in-out': (t) => t === 0 || t === 1 ? t : t < 0.5
    ? Math.pow(2, 20 * t - 10) / 2
    : (2 - Math.pow(2, -20 * t + 10)) / 2,
  'quart-out': (t) => 1 - Math.pow(1 - t, 4),
  'quart-in': (t) => Math.pow(t, 4),
  'quart-in-out': (t) => t < 0.5 ? 8 * Math.pow(t, 4) : 1 - Math.pow(-2 * t + 2, 4) / 2,
  'quint-out': (t) => 1 - Math.pow(1 - t, 5),
  'quint-in': (t) => Math.pow(t, 5),
  'quint-in-out': (t) => t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2,
  'sine-out': (t) => Math.sin(t * Math.PI / 2),
  'sine-in': (t) => 1 - Math.cos(t * Math.PI / 2),
  'sine-in-out': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  'circ-out': (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
  'circ-in': (t) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
  'circ-in-out': (t) => t < 0.5
    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
  'quad-out': (t) => 1 - (1 - t) * (1 - t),
  'quad-in': (t) => t * t,
  'quad-in-out': (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
};

/**
 * Get easing function by name.
 */
export function getEasingFunction(easing: Easing | undefined): EasingFunction {
  if (!easing || !easingFunctions[easing]) {
    return easingFunctions['linear'];
  }
  return easingFunctions[easing];
}

/**
 * Linear interpolation between two values.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}