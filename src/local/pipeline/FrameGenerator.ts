import { Canvas } from '@napi-rs/canvas';
import { Source } from '../../Source';
import { Canvas2DRenderer } from './Canvas2DRenderer';
import { AnimationEngine } from '../animations/AnimationEngine';
import { ElementBase } from '../../elements/ElementBase';
import { TextElementRenderer } from '../elements/TextElementRenderer';
import { ImageElementRenderer } from '../elements/ImageElementRenderer';
import { ShapeRenderer } from '../elements/ShapeRenderer';
import { CompositionRenderer } from '../elements/CompositionRenderer';
import { VideoElementRenderer } from '../elements/VideoElementRenderer';

interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

interface ElementState {
  element: ElementBase<any>;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  clip: boolean;
  visible: boolean;
}

/**
 * Generates frames by rendering elements at specific times.
 */
export class FrameGenerator {
  private canvas: Canvas;
  private renderer: Canvas2DRenderer;
  private animationEngine: AnimationEngine;
  private source: Source;
  private config: RenderConfig;

  constructor(
    canvas: Canvas,
    renderer: Canvas2DRenderer,
    animationEngine: AnimationEngine,
    source: Source,
    config: RenderConfig
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.animationEngine = animationEngine;
    this.source = source;
    this.config = config;
  }

  /**
   * Render a frame at the given time.
   */
  async renderFrame(time: number): Promise<Buffer> {
    // Clear canvas with background color
    const bgColor = typeof this.source.properties.fillColor === 'string'
      ? this.source.properties.fillColor
      : undefined;
    this.renderer.clear(bgColor);

    // Get all elements
    const elements = this.flattenElements(this.source.properties.elements || []);

    // Sort by zIndex
    const sortedElements = this.sortByZIndex(elements);

    // Render each element
    for (const element of sortedElements) {
      const state = this.resolveElementState(element, time);
      if (!state.visible) continue;

      await this.renderElement(element, state, time);
    }

    // Return canvas buffer
    return this.renderer.getBuffer();
  }

  /**
   * Flatten nested composition elements.
   */
  private flattenElements(elements: Array<ElementBase<any> | Record<string, any>>): ElementBase<any>[] {
    const result: ElementBase<any>[] = [];

    for (const element of elements) {
      if (element instanceof ElementBase) {
        result.push(element);

        // If it's a composition, flatten its children
        if ((element as any).type === 'composition' && (element.properties as any).elements) {
          result.push(...this.flattenElements((element.properties as any).elements));
        }
      }
    }

    return result;
  }

  /**
   * Sort elements by zIndex.
   */
  private sortByZIndex(elements: ElementBase<any>[]): ElementBase<any>[] {
    return [...elements].sort((a, b) => {
      const aZ = (a.properties as any).zIndex ?? 0;
      const bZ = (b.properties as any).zIndex ?? 0;
      return aZ - bZ;
    });
  }

  /**
   * Resolve element state at given time.
   */
  private resolveElementState(element: ElementBase<any>, time: number): ElementState {
    const props = element.properties as any;

    // Check visibility time window
    const elementTime = typeof props.time === 'number' ? props.time : 0;
    const duration = props.duration;
    if (duration !== undefined && time > elementTime + (duration as number)) {
      return { element, type: (element as any).type, x: 0, y: 0, width: 0, height: 0, opacity: 0, rotation: 0, scaleX: 1, scaleY: 1, clip: false, visible: false };
    }

    // Resolve position and size
    const x = this.resolveValue(props.x, time, 0);
    const y = this.resolveValue(props.y, time, 0);
    const width = this.resolveValue(props.width, time, 100);
    const height = this.resolveValue(props.height, time, 100);
    const opacity = this.resolveValue(props.opacity, time, 1);
    const rotation = this.resolveValue(props.zRotation, time, 0);

    return {
      element,
      type: (element as any).type,
      x: typeof x === 'string' ? this.parseUnit(x, this.config.width) : x,
      y: typeof y === 'string' ? this.parseUnit(y, this.config.height) : y,
      width: typeof width === 'string' ? this.parseUnit(width, this.config.width) : width,
      height: typeof height === 'string' ? this.parseUnit(height, this.config.height) : height,
      opacity: typeof opacity === 'string' ? parseFloat(opacity) : opacity,
      rotation: typeof rotation === 'string' ? this.parseDegree(rotation) : rotation,
      scaleX: typeof props.xScale === 'number' ? props.xScale / 100 : 1,
      scaleY: typeof props.yScale === 'number' ? props.yScale / 100 : 1,
      clip: props.clip ?? false,
      visible: true,
    };
  }

  /**
   * Resolve a ValueOrKeyframes to a concrete value at time.
   */
  private resolveValue<T>(valueOrKeyframes: T | Array<any> | undefined, time: number, defaultValue: T): T {
    if (valueOrKeyframes === undefined || valueOrKeyframes === null) {
      return defaultValue;
    }

    if (Array.isArray(valueOrKeyframes)) {
      return this.animationEngine.interpolate(valueOrKeyframes, time, defaultValue);
    }

    return valueOrKeyframes;
  }

  /**
   * Parse unit string (e.g., '50%', '10px', '3 vmin').
   */
  private parseUnit(value: string | number, base: number): number {
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
      const vmin = Math.min(this.config.width, this.config.height) / 100;
      return parseFloat(trimmed) * vmin;
    }

    if (trimmed.endsWith('vmax')) {
      const vmax = Math.max(this.config.width, this.config.height) / 100;
      return parseFloat(trimmed) * vmax;
    }

    return parseFloat(trimmed) || 0;
  }

  /**
   * Parse degree string (e.g., '90°', '1.5turn').
   */
  private parseDegree(value: string | number): number {
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

  /**
   * Render a single element based on its state.
   */
  private async renderElement(element: ElementBase<any>, state: ElementState, time: number): Promise<void> {
    const context = { time, width: this.config.width, height: this.config.height, fps: this.config.fps };

    switch (state.type) {
      case 'text':
        await TextElementRenderer.render(this.renderer, element, state, context);
        break;
      case 'image':
        await ImageElementRenderer.render(this.renderer, element, state, context);
        break;
      case 'rectangle':
      case 'shape':
        ShapeRenderer.render(this.renderer, element, state, context);
        break;
      case 'ellipse':
        ShapeRenderer.render(this.renderer, element, state, context);
        break;
      case 'video':
        await VideoElementRenderer.render(this.renderer, element, state, context);
        break;
      case 'composition':
        await CompositionRenderer.render(this.renderer, element, state, context, async (child, childState, childContext) => {
          const childStateResolved = this.resolveElementState(child, time);
          if (!childStateResolved.visible) return;
          await this.renderElement(child, childStateResolved, time);
        });
        break;
    }
  }
}