import { Keyframe, ValueOrKeyframes } from '../../properties/Keyframe';
import { Easing } from '../../properties/Easing';
import { getEasingFunction, lerp } from './EasingFunctions';

/**
 * Resolved element state at a specific time.
 */
export interface ResolvedProperty<T> {
  value: T;
  keyframes: Keyframe<T>[] | null;
}

/**
 * Animation engine for interpolating keyframed values.
 */
export class AnimationEngine {
  /**
   * Interpolate a value at the given time.
   */
  interpolate<T>(keyframes: ValueOrKeyframes<T>, time: number, defaultValue: T): T {
    // If not keyframes, return the direct value
    if (!Array.isArray(keyframes)) {
      return keyframes;
    }

    // Find surrounding keyframes
    const sorted = [...keyframes].sort((a, b) => {
      const aTime = a.time === 'start' ? 0 : a.time === 'end' ? Infinity : a.time;
      const bTime = b.time === 'start' ? 0 : b.time === 'end' ? Infinity : b.time;
      return aTime - bTime;
    });

    if (sorted.length === 0) {
      return defaultValue;
    }

    // Handle 'start' and 'end'
    let effectiveTime = time;
    const startKeyframe = sorted.find(k => k.time === 'start');
    const endKeyframe = sorted.find(k => k.time === 'end');

    if (startKeyframe && endKeyframe) {
      // Both exist - time is relative between them
      const startTime = 0;
      const endTime = endKeyframe.time === 'end' ? 1 : (endKeyframe.time as number);
      const duration = endTime - startTime;
      if (duration > 0) {
        effectiveTime = (time - startTime) / duration;
      }
    }

    // Find the two keyframes to interpolate between
    let before: Keyframe<T> | null = null;
    let after: Keyframe<T> | null = null;

    for (let i = 0; i < sorted.length; i++) {
      const k = sorted[i];
      const kTime = k.time === 'start' ? 0 : k.time === 'end' ? 1 : k.time;

      if (kTime <= effectiveTime) {
        before = k;
      }
      if (kTime >= effectiveTime && after === null) {
        after = k;
      }
    }

    if (!before && !after) {
      return sorted[0].value;
    }

    if (!before) return after!.value;
    if (!after) return before.value;

    const beforeTime = before.time === 'start' ? 0 : before.time === 'end' ? 1 : before.time;
    const afterTime = after.time === 'start' ? 0 : after.time === 'end' ? 1 : after.time;

    if (beforeTime === afterTime) {
      return before.value;
    }

    // Calculate interpolation factor
    const t = (effectiveTime - beforeTime) / (afterTime - beforeTime);
    const easing = before.easing || after.easing || 'linear';
    const easedT = getEasingFunction(easing as Easing)(t);

    // Interpolate based on type
    if (typeof before.value === 'number' && typeof after.value === 'number') {
      return lerp(before.value, after.value, easedT) as unknown as T;
    }

    // For non-numeric values, just return before value at t < 0.5, after otherwise
    return t < 0.5 ? before.value : after.value;
  }

  /**
   * Get interpolation factor between two keyframes.
   */
  getInterpolationFactor(
    beforeTime: number,
    afterTime: number,
    currentTime: number,
    easing: Easing
  ): number {
    if (beforeTime === afterTime) return 0;
    const t = (currentTime - beforeTime) / (afterTime - beforeTime);
    return getEasingFunction(easing)(Math.max(0, Math.min(1, t)));
  }

  /**
   * Check if element is active at given time.
   */
  isElementActive(
    time: number,
    elementTime: number | string | undefined,
    duration: number | string | undefined
  ): boolean {
    const startTime = typeof elementTime === 'number' ? elementTime : 0;
    if (time < startTime) return false;

    if (duration === undefined || duration === null) {
      return true; // No duration means visible until end
    }

    const endTime = typeof duration === 'number'
      ? startTime + duration
      : Infinity;

    return time <= endTime;
  }
}