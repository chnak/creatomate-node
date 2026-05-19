import { Canvas } from '@napi-rs/canvas';
import { Source } from '../../Source';
import { Canvas2DRenderer } from './Canvas2DRenderer';
import { TransitionRenderer } from './TransitionRenderer';
import { AnimationEngine } from '../animations/AnimationEngine';
import { ElementBase } from '../../elements/ElementBase';
import { TextElementRenderer } from '../elements/TextElementRenderer';
import { ImageElementRenderer } from '../elements/ImageElementRenderer';
import { ShapeRenderer } from '../elements/ShapeRenderer';
import { CompositionRenderer } from '../elements/CompositionRenderer';
import { VideoElementRenderer } from '../elements/VideoElementRenderer';
import { AnimationBase } from '../../animations/AnimationBase';

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
  skewX: number;
  skewY: number;
  clip: boolean;
  visible: boolean;
  blendMode: string;
  blurRadius: number;
  colorOverlay?: string;
  compositionWidth?: number;
  compositionHeight?: number;
}

interface ActiveElementInfo {
  element: ElementBase<any>;
  state: ElementState;
  hasTransition: boolean;
  transitionDuration: number;
  transitionStartTime: number;
  previousElement: ElementBase<any> | null;
}

/**
 * Generates frames by rendering elements at specific times.
 */
export class FrameGenerator {
  private canvas: Canvas;
  private renderer: Canvas2DRenderer;
  private transitionRenderer: TransitionRenderer;
  private animationEngine: AnimationEngine;
  private source: Source;
  private config: RenderConfig;
  private lastRenderedElements: Map<number, { element: ElementBase<any>; endTime: number }> = new Map();

  constructor(
    canvas: Canvas,
    renderer: Canvas2DRenderer,
    animationEngine: AnimationEngine,
    source: Source,
    config: RenderConfig
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.transitionRenderer = new TransitionRenderer(canvas);
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

    // Filter to only active elements per track (track-based sequencing)
    const activeElements = this.getActiveElementsWithInfo(elements, time);

    // Sort by zIndex
    const sortedElements = this.sortByZIndex(activeElements);

    // Check for transitions and render appropriately
    const transitionElements = this.checkTransitions(sortedElements, time);

    if (transitionElements.length > 0) {
      // Handle transitions - this draws to offscreen canvases and composites to main canvas
      await this.renderWithTransitions(transitionElements, time);
    } else {
      // Normal rendering
      for (const info of sortedElements) {
        if (!info.state.visible) continue;
        await this.renderElement(info.element, info.state, time);
      }
    }

    // Return canvas buffer
    return this.renderer.getBuffer();
  }

  /**
   * Get active elements with transition information.
   */
  private getActiveElementsWithInfo(elements: ElementBase<any>[], time: number): ActiveElementInfo[] {
    // Group elements by track, preserving original order
    const trackMap = new Map<number, ElementBase<any>[]>();

    for (const element of elements) {
      const track = (element.properties as any).track ?? 0;
      if (!trackMap.has(track)) {
        trackMap.set(track, []);
      }
      trackMap.get(track)!.push(element);
    }

    // For each track, find ALL active elements at the current time
    const activeElements: ActiveElementInfo[] = [];

    for (const [track, trackElements] of trackMap) {
      // Elements on same track are sequential - calculate effective start times
      // If an element doesn't have explicit time, it starts after the previous element ends
      let runningEndTime = 0;
      const effectiveTimes: Map<ElementBase<any>, number> = new Map();

      for (const element of trackElements) {
        const explicitTime = typeof (element.properties as any).time === 'number' ? (element.properties as any).time : null;
        const explicitDuration = (element.properties as any).duration !== undefined;

        // If element has explicit time, use it; otherwise use runningEndTime
        const effectiveTime = explicitTime !== null ? explicitTime : runningEndTime;
        effectiveTimes.set(element, effectiveTime);

        // Also set the effectiveTime as the element's time property for consistent access
        (element.properties as any).time = effectiveTime;

        if (explicitDuration) {
          runningEndTime = effectiveTime + (element.properties as any).duration;
        }
        // If no explicit time and no explicit duration, element plays at effectiveTime indefinitely
        // but doesn't advance runningEndTime, allowing subsequent elements to also use effectiveTime
      }

      // Now find ALL active elements at the current time
      for (const element of trackElements) {
        const elementTime = effectiveTimes.get(element)!;
        const duration = (element.properties as any).duration;

        // If current time is before this element's start time, skip it
        // (but don't break - later elements might have different effective times)
        if (time < elementTime) {
          continue;
        }

        // Current time >= elementTime - check if this element is active
        let isActive = false;

        if (duration === undefined) {
          // No duration = plays indefinitely from elementTime
          isActive = true;
        } else if (time < elementTime + duration) {
          // Has duration - check if current time is within range
          isActive = true;
        }

        if (isActive) {
          const state = this.resolveElementState(element, time);
          const transition = (element.properties as any).transition as AnimationBase<any> | undefined;
          const transitionDuration = transition?.properties?.duration ?? 0;

          // Find previous element on same track - must be the element that ended before this one starts
          let previousElement: ElementBase<any> | null = null;
          for (const e of trackElements) {
            if (e === element) break;
            const eTime = effectiveTimes.get(e)!;
            const eDur = (e.properties as any).duration ?? 0;
            if (eTime + eDur === elementTime) {
              previousElement = e;
              break;
            }
          }

          // Transition starts when element becomes active (not at end of duration)
          // This is because elements are sequential on the same track, not overlapping
          const transitionStartTime = elementTime;

          activeElements.push({
            element: element,
            state,
            hasTransition: !!transition && transitionDuration > 0,
            transitionDuration,
            transitionStartTime,
            previousElement,
          });
        }
      }
    }

    return activeElements;
  }

  /**
   * Check which elements need transition rendering.
   */
  private checkTransitions(activeElements: ActiveElementInfo[], time: number): ActiveElementInfo[] {
    return activeElements.filter(info => {
      if (!info.hasTransition) return false;

      // Check if we're in the transition window
      return time >= info.transitionStartTime && time < info.transitionStartTime + info.transitionDuration;
    });
  }

  /**
   * Render elements with transitions.
   */
  private async renderWithTransitions(transitionElements: ActiveElementInfo[], time: number): Promise<void> {
    for (const info of transitionElements) {
      const { element, state, transitionDuration, transitionStartTime, previousElement } = info;

      if (!previousElement) {
        // No previous element, render normally
        await this.renderElement(element, state, time);
        continue;
      }

      // Calculate transition progress (0 to 1)
      const transitionProgress = Math.min(1, Math.max(0, (time - transitionStartTime) / transitionDuration));

      // Resolve previous element state at transition start time
      const prevState = this.resolveElementState(previousElement, transitionStartTime);

      // Create offscreen canvases for from/to
      const fromCanvas = this.renderer.createBuffer(this.config.width, this.config.height);
      const toCanvas = this.renderer.createBuffer(this.config.width, this.config.height);

      // Create temporary renderers for each canvas
      const fromRenderer = new Canvas2DRenderer(fromCanvas);
      const toRenderer = new Canvas2DRenderer(toCanvas);

      // Clear both canvases
      fromRenderer.clear(this.source.properties.fillColor as string | undefined);
      toRenderer.clear(this.source.properties.fillColor as string | undefined);

      // Render previous element to fromCanvas
      await this.renderElementToRenderer(fromRenderer, previousElement, prevState, transitionStartTime);

      // Render current element to toCanvas
      await this.renderElementToRenderer(toRenderer, element, state, time);

      // Apply transition using the universal transition renderer
      const transitionAnimation = (element.properties as any).transition as AnimationBase<any>;

      // Use the actual transition renderer
      if (transitionAnimation) {
        this.transitionRenderer.renderTransition(fromCanvas, toCanvas, transitionProgress, transitionAnimation);
      } else {
        this.renderer.drawFade(fromCanvas, toCanvas, transitionProgress);
      }
    }
    // Note: Non-transition elements are already included in the transition rendering
    // because we rendered fromCanvas with previousElement and toCanvas with current element
  }

  /**
   * Parse anchor value to normalized form (0-1).
   */
  private parseAnchor(value: number | string | undefined, base: number): number {
    if (value === undefined) return 0.5;
    if (typeof value === 'number') {
      if (value > 1) return value / base; // Pixel value, normalize
      return value; // Already normalized 0-1
    }
    if (typeof value === 'string') {
      if (value.endsWith('%')) {
        return parseFloat(value) / 100;
      }
      return parseFloat(value) / base;
    }
    return 0.5;
  }

  /**
   * Render an element to a specific renderer (for transition buffers).
   */
  private async renderElementToRenderer(
    renderer: Canvas2DRenderer,
    element: ElementBase<any>,
    state: ElementState,
    time: number
  ): Promise<void> {
    const context = { time, width: this.config.width, height: this.config.height, fps: this.config.fps };

    switch (state.type) {
      case 'text':
        await TextElementRenderer.render(renderer, element, state, context);
        break;
      case 'image':
        await ImageElementRenderer.render(renderer, element, state, context);
        break;
      case 'rectangle':
      case 'shape':
        ShapeRenderer.render(renderer, element, state, context);
        break;
      case 'ellipse':
        ShapeRenderer.render(renderer, element, state, context);
        break;
      case 'video':
        await VideoElementRenderer.render(renderer, element, state, context);
        break;
      case 'composition':
        await CompositionRenderer.render(renderer, element, state, context, async (child, childState, childContext) => {
          const childStateResolved = this.resolveElementState(child, time);
          if (!childStateResolved.visible) return;
          if (childState.compositionWidth !== undefined) {
            childStateResolved.compositionWidth = childState.compositionWidth;
          }
          if (childState.compositionHeight !== undefined) {
            childStateResolved.compositionHeight = childState.compositionHeight;
          }
          childStateResolved.x += state.x;
          childStateResolved.y += state.y;
          await this.renderElementToRenderer(renderer, child, childStateResolved, time);
        });
        break;
    }
  }

  /**
   * Get only the active elements at the given time, respecting track-based sequencing.
   * Elements on the same track are sequential - only the currently active one is rendered.
   */
  private getActiveElements(elements: ElementBase<any>[], time: number): ElementBase<any>[] {
    // Group elements by track, preserving original order
    const trackMap = new Map<number, ElementBase<any>[]>();

    for (const element of elements) {
      const track = (element.properties as any).track ?? 0;
      if (!trackMap.has(track)) {
        trackMap.set(track, []);
      }
      trackMap.get(track)!.push(element);
    }

    // For each track, find the active element at the given time
    const activeElements: ElementBase<any>[] = [];

    for (const [track, trackElements] of trackMap) {
      // Elements on same track are sequential - find which one is currently active
      let activeElement: ElementBase<any> | null = null;

      for (const element of trackElements) {
        const elementTime = typeof (element.properties as any).time === 'number' ? (element.properties as any).time : 0;
        const duration = (element.properties as any).duration;

        // If current time is before this element's start time, it's not yet visible
        if (time < elementTime) {
          break; // Elements after this on the same track are also not visible
        }

        // Current time >= elementTime
        if (duration === undefined) {
          // No duration = plays indefinitely - this is the active element
          activeElement = element;
          break;
        }

        // Has duration - check if current time is within range
        if (time < elementTime + duration) {
          activeElement = element;
          break;
        }
        // Duration expired - continue to next element on same track
      }

      if (activeElement) {
        activeElements.push(activeElement);
      }
    }

    return activeElements;
  }

  /**
   * Flatten nested composition elements.
   * Note: Composition children are NOT flattened because CompositionRenderer handles them directly.
   */
  private flattenElements(elements: Array<ElementBase<any> | Record<string, any>>): ElementBase<any>[] {
    const result: ElementBase<any>[] = [];

    for (const element of elements) {
      if (element instanceof ElementBase) {
        result.push(element);

        // Note: Do NOT flatten composition children - CompositionRenderer renders them directly
        // This prevents double-rendering of children
      }
    }

    return result;
  }

  /**
   * Sort elements by zIndex.
   */
  private sortByZIndex(elements: ActiveElementInfo[]): ActiveElementInfo[] {
    return [...elements].sort((a, b) => {
      const aZ = (a.element.properties as any).zIndex ?? 0;
      const bZ = (b.element.properties as any).zIndex ?? 0;
      return aZ - bZ;
    });
  }

  /**
   * Collect all animations including transition, enter, exit.
   */
  private collectAnimations(props: any, time: number): AnimationBase<any>[] {
    const result: AnimationBase<any>[] = [];
    const elementTime = typeof props.time === 'number' ? props.time : 0;
    const duration = props.duration ?? 999999;

    // Handle transition animation (between this and previous element)
    if (props.transition) {
      const transitionAnim = {
        ...props.transition,
        properties: { ...props.transition.properties, time: 'start', transition: true },
        _elementTime: elementTime,
        _duration: duration
      };
      result.push(transitionAnim as unknown as AnimationBase<any>);
    }

    // Handle enter animation (at start)
    if (props.enter) {
      const enterAnim = {
        ...props.enter,
        properties: { ...props.enter.properties, time: elementTime },
        _elementTime: elementTime,
        _duration: duration
      };
      result.push(enterAnim as unknown as AnimationBase<any>);
    }

    // Handle exit animation (at end)
    if (props.exit) {
      const exitAnim = {
        ...props.exit,
        properties: { ...props.exit.properties, time: elementTime + duration - (props.exit.properties?.duration ?? 1), reversed: true },
        _elementTime: elementTime,
        _duration: duration
      };
      result.push(exitAnim as unknown as AnimationBase<any>);
    }

    // Handle regular animations array
    const regularAnimations = props.animations as AnimationBase<any>[] | undefined;
    if (regularAnimations && regularAnimations.length > 0) {
      for (const anim of regularAnimations) {
        result.push({
          ...anim,
          _elementTime: elementTime,
          _duration: duration
        } as unknown as AnimationBase<any>);
      }
    }

    return result;
  }

  /**
   * Resolve element state at given time.
   * @param element The element to resolve
   * @param time Current render time
   * @param baseWidth Override base width for percentage calculations (defaults to config.width)
   * @param baseHeight Override base height for percentage calculations (defaults to config.height)
   */
  private resolveElementState(
    element: ElementBase<any>,
    time: number,
    baseWidth?: number,
    baseHeight?: number
  ): ElementState {
    const props = element.properties as any;
    const effectiveBaseWidth = baseWidth ?? this.config.width;
    const effectiveBaseHeight = baseHeight ?? this.config.height;

    // Check visibility time window
    const elementTime = typeof props.time === 'number' ? props.time : 0;
    const duration = props.duration;
    if (duration !== undefined && time > elementTime + (duration as number)) {
      return { element, type: (element as any).type, x: 0, y: 0, width: 0, height: 0, opacity: 0, rotation: 0, scaleX: 1, scaleY: 1, clip: false, visible: false, blendMode: 'source-over', blurRadius: 0 };
    }

    // Resolve position and size
    // Must resolve width/height FIRST before computing x/y center offset
    const xRaw = this.resolveValue(props.x, time, 0);
    const yRaw = this.resolveValue(props.y, time, 0);
    // Use canvas dimensions as default for width/height (more sensible defaults)
    const widthRaw = this.resolveValue(props.width, time, this.config.width);
    const heightRaw = this.resolveValue(props.height, time, this.config.height);
    const opacity = this.resolveValue(props.opacity, time, 1);
    const rotation = this.resolveValue(props.zRotation, time, 0);

    // Parse width/height first (needed for x/y center calculation)
    const width = typeof widthRaw === 'string' ? this.parseUnit(widthRaw, this.config.width) : widthRaw;
    const height = typeof heightRaw === 'string' ? this.parseUnit(heightRaw, this.config.height) : heightRaw;

    // Parse x/y - if string percentage, position is CENTER of element (not edge)
    // Only apply center offset for values between 0% and 100% (exclusive)
    // xRaw/yRaw can be undefined, which means use default positioning (left/top)
    const xIsPercent = xRaw !== undefined && typeof xRaw === 'string' && xRaw.trim().endsWith('%');
    const yIsPercent = yRaw !== undefined && typeof yRaw === 'string' && yRaw.trim().endsWith('%');
    const xPercentVal = xIsPercent ? parseFloat(xRaw.trim()) : NaN;
    const yPercentVal = yIsPercent ? parseFloat(yRaw.trim()) : NaN;
    const xNeedsCenter = xIsPercent && !isNaN(xPercentVal) && xPercentVal > 0 && xPercentVal < 100;
    const yNeedsCenter = yIsPercent && !isNaN(yPercentVal) && yPercentVal > 0 && yPercentVal < 100;
    const x = xNeedsCenter ? this.parseUnit(xRaw, this.config.width) - width / 2 : (xIsPercent ? this.parseUnit(xRaw, this.config.width) : (xRaw !== undefined ? xRaw : 0));
    const y = yNeedsCenter ? this.parseUnit(yRaw, this.config.height) - height / 2 : (yIsPercent ? this.parseUnit(yRaw, this.config.height) : (yRaw !== undefined ? yRaw : 0));

    return {
      element,
      type: (element as any).type,
      x,
      y,
      width,
      height,
      opacity: typeof opacity === 'string' ? parseFloat(opacity) : opacity,
      rotation: typeof rotation === 'string' ? this.parseDegree(rotation) : rotation,
      scaleX: typeof computedScaleX === 'string' ? parseFloat(computedScaleX) : computedScaleX,
      scaleY: typeof computedScaleY === 'string' ? parseFloat(computedScaleY) : computedScaleY,
      skewX,
      skewY,
      rotationX,
      rotationY,
      clip: props.clip ?? false,
      visible: true,
      blendMode: props.blendMode || 'source-over',
      blurRadius: typeof props.blurRadius === 'number' ? props.blurRadius : (typeof props.blurRadius === 'string' ? parseFloat(props.blurRadius) : 0),
      colorOverlay: props.colorOverlay,
    };
  }

  /**
   * Resolve element state with composition bounds override.
   * Used for child elements inside a composition to align relative to composition dimensions.
   */
  private resolveElementStateWithOverrides(element: ElementBase<any>, time: number, overrides: any): ElementState {
    const baseState = this.resolveElementState(element, time);
    // Carry over composition bounds for alignment
    if (overrides.compositionWidth !== undefined) {
      baseState.compositionWidth = overrides.compositionWidth;
    }
    if (overrides.compositionHeight !== undefined) {
      baseState.compositionHeight = overrides.compositionHeight;
    }
    return baseState;
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
      case 'audio':
        // Audio is handled separately through LocalRenderer audio mixing
        // Audio elements are tracked for audio processing but don't render visually
        break;
      case 'composition':
        await CompositionRenderer.render(this.renderer, element, state, context, async (child, childState, childContext) => {
          // Set composition bounds BEFORE resolving element state
          // so that alignment can be computed relative to composition dimensions
          const stateWithComposition = {
            ...childState,
          };
          if (childState.compositionWidth !== undefined) {
            (stateWithComposition as any).compositionWidth = childState.compositionWidth;
          }
          if (childState.compositionHeight !== undefined) {
            (stateWithComposition as any).compositionHeight = childState.compositionHeight;
          }

          const childStateResolved = this.resolveElementStateWithOverrides(child, time, stateWithComposition);
          if (!childStateResolved.visible) return;
          // Add Composition's offset to child's position
          childStateResolved.x += state.x;
          childStateResolved.y += state.y;
          await this.renderElement(child, childStateResolved, time);
        });
        break;
    }
  }
}
