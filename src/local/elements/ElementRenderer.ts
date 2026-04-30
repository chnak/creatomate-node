import { Canvas2DRenderer } from '../pipeline/Canvas2DRenderer';

export interface ElementRendererContext {
  time: number;
  width: number;
  height: number;
  fps?: number;
}

/**
 * Base class for element renderers.
 */
export abstract class ElementRenderer {
  protected renderer: Canvas2DRenderer;

  constructor(renderer: Canvas2DRenderer) {
    this.renderer = renderer;
  }

  /**
   * Render the element at the given time.
   */
  abstract render(context: ElementRendererContext): Promise<void>;

  /**
   * Check if element is visible at given time.
   */
  protected isVisible(
    time: number,
    elementTime: number | string | undefined,
    duration: number | string | undefined
  ): boolean {
    const startTime = typeof elementTime === 'number' ? elementTime : 0;
    if (time < startTime) return false;

    if (duration === undefined || duration === null) {
      return true;
    }

    const endTime = typeof duration === 'number'
      ? startTime + (duration as number)
      : startTime + Infinity;

    return time <= endTime;
  }

  /**
   * Parse unit string to pixels.
   */
  protected parseUnit(value: string | number, base: number): number {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;

    const trimmed = value.trim();

    if (trimmed.endsWith('%')) {
      return (parseFloat(trimmed) / 100) * base;
    }

    if (trimmed.endsWith('px')) {
      return parseFloat(trimmed);
    }

    if (trimmed.endsWith('vmin')) {
      const vmin = Math.min(base, base) / 100;
      return parseFloat(trimmed) * vmin;
    }

    if (trimmed.endsWith('vmax')) {
      const vmax = Math.max(base, base) / 100;
      return parseFloat(trimmed) * vmax;
    }

    return parseFloat(trimmed) || 0;
  }

  /**
   * Parse rotation to radians.
   */
  protected parseRotation(value: string | number): number {
    if (typeof value === 'number') return value * (Math.PI / 180);

    const trimmed = String(value).trim();

    if (trimmed.endsWith('°')) {
      return (parseFloat(trimmed) * Math.PI) / 180;
    }

    if (trimmed.endsWith('turn')) {
      return parseFloat(trimmed) * 2 * Math.PI;
    }

    if (trimmed.endsWith('rad')) {
      return parseFloat(trimmed);
    }

    return (parseFloat(trimmed) || 0) * (Math.PI / 180);
  }
}