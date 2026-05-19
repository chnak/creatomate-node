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
import { AnimationBase } from '../../animations/AnimationBase';
import { getEasingFunction } from '../animations/EasingFunctions';

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
  animations?: AnimationBase<any>[];
  // 3D rotation properties
  rotationX?: number;
  rotationY?: number;
}

interface AnimResult {
  x: number;
  y: number;
  opacity: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  skewX: number;
  skewY: number;
  // 3D rotation
  rotationX?: number;
  rotationY?: number;
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

    // Track pending mask
    let pendingMask: { element: ElementBase<any>; state: any; maskMode: string } | null = null;

    // Render each element
    for (let i = 0; i < sortedElements.length; i++) {
      const element = sortedElements[i];
      const props = element.properties as any;
      const state = this.resolveElementState(element, time);
      if (!state.visible) continue;

      // Check if current element has maskMode (will affect next element)
      if (props.maskMode && props.maskMode !== 'none') {
        pendingMask = { element, state, maskMode: props.maskMode };
        continue; // Don't render the mask element itself
      }

      // If there's a pending mask, apply it to this element
      if (pendingMask) {
        await this.renderElementWithMask(element, state, pendingMask, time);
        pendingMask = null;
      } else {
        await this.renderElement(element, state, time);
      }
    }

    // Return canvas buffer
    return this.renderer.getBuffer();
  }

  /**
   * Render element with a mask applied from previous element.
   */
  private async renderElementWithMask(
    element: ElementBase<any>,
    state: any,
    mask: { element: ElementBase<any>; state: any; maskMode: string },
    time: number
  ): Promise<void> {
    // Create offscreen canvas for the mask
    const { createCanvas } = require('@napi-rs/canvas');
    const maskCanvas = createCanvas(Math.ceil(this.config.width), Math.ceil(this.config.height));
    const maskCtx = maskCanvas.getContext('2d');
    const tempRenderer = new (require('./Canvas2DRenderer').Canvas2DRenderer)(maskCanvas);

    // First, render the actual element to the main canvas (but masked)
    // Save main canvas state
    this.renderer.ctx.save();

    // Render the element we're applying mask to
    await this.renderElement(element, state, time);

    // Get the image data from main canvas
    const mainCtx = this.renderer.ctx;
    const mainImageData = mainCtx.getImageData(0, 0, this.config.width, this.config.height);

    // Now render the mask element to mask canvas
    await this.renderElement(mask.element, mask.state, time);

    // Apply mask using composite operation
    mainCtx.globalCompositeOperation = 'destination-in';
    mainCtx.drawImage(maskCanvas, 0, 0);
    mainCtx.globalCompositeOperation = 'source-over';

    this.renderer.ctx.restore();
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
      return { element, type: (element as any).type, x: 0, y: 0, width: 0, height: 0, opacity: 0, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, clip: false, visible: false };
    }

    // Resolve position and size
    // For width/height, default to '100%' to fill the parent space when not specified
    let x = this.resolveValue(props.x, time, 0);
    let y = this.resolveValue(props.y, time, 0);
    const width = this.resolveValue(props.width, time, '100%');
    const height = this.resolveValue(props.height, time, '100%');
    let opacity = this.resolveValue(props.opacity, time, 1);
    let rotation = this.resolveValue(props.zRotation, time, 0);
    let scaleX = typeof props.xScale === 'number' ? props.xScale / 100 : 1;
    let scaleY = typeof props.yScale === 'number' ? props.yScale / 100 : 1;
    let skewX = this.parseDegree(props.xSkew ?? 0);
    let skewY = this.parseDegree(props.ySkew ?? 0);
    // 3D rotation - must use resolveValue to handle keyframes
    // parseDegree only for string values (e.g., "90deg", "1.5turn"); numeric values are already radians
    // But for user convenience, if numeric values look like degrees (e.g., 0-360 range), convert from degrees to radians
    let rotationX = this.resolveValue(props.xRotation, time, 0);
    let rotationY = this.resolveValue(props.yRotation, time, 0);
    if (typeof rotationX === 'string') {
      rotationX = this.parseDegree(rotationX);
    } else if (rotationX !== 0 && Math.abs(rotationX) <= 360) {
      // Value is small (like 90, 180, 360) - likely degrees, convert to radians
      rotationX = rotationX * (Math.PI / 180);
    }
    if (typeof rotationY === 'string') {
      rotationY = this.parseDegree(rotationY);
    } else if (rotationY !== 0 && Math.abs(rotationY) <= 360) {
      // Value is small (like 90, 180, 360) - likely degrees, convert to radians
      rotationY = rotationY * (Math.PI / 180);
    }

    // For composition elements with width/height keyframes, compute scale to simulate animation
    let computedScaleX = scaleX;
    let computedScaleY = scaleY;
    if ((element as any).type === 'composition') {
      const baseWidth = this.resolveValue(props.width, 0, '100%');
      const baseHeight = this.resolveValue(props.height, 0, '100%');
      const baseWidthNum = typeof baseWidth === 'string' ? this.parseUnit(baseWidth, effectiveBaseWidth) : baseWidth;
      const baseHeightNum = typeof baseHeight === 'string' ? this.parseUnit(baseHeight, effectiveBaseHeight) : baseHeight;

      // Resolve current dimensions
      const currentWidthNum = typeof width === 'string' ? this.parseUnit(width, effectiveBaseWidth) : width;
      const currentHeightNum = typeof height === 'string' ? this.parseUnit(height, effectiveBaseHeight) : height;

      // Compute scale if dimensions differ from base
      if (baseWidthNum > 0) {
        computedScaleX = scaleX * (currentWidthNum / baseWidthNum);
      }
      if (baseHeightNum > 0) {
        computedScaleY = scaleY * (currentHeightNum / baseHeightNum);
      }
    }

    // Apply animations (including transition, enter, exit)
    const animations = this.collectAnimations(props, time);
    if (animations && animations.length > 0) {
      const animationResult = this.applyAnimations(animations, time, { x, y, opacity, rotation, scaleX: computedScaleX, scaleY: computedScaleY, skewX, skewY, rotationX, rotationY });
      x = animationResult.x;
      y = animationResult.y;
      opacity = animationResult.opacity;
      rotation = animationResult.rotation;
      computedScaleX = animationResult.scaleX;
      computedScaleY = animationResult.scaleY;
      skewX = animationResult.skewX;
      skewY = animationResult.skewY;
      rotationX = animationResult.rotationX ?? rotationX;
      rotationY = animationResult.rotationY ?? rotationY;
    }

    return {
      element,
      type: (element as any).type,
      x: typeof x === 'string' ? this.parseUnit(x, effectiveBaseWidth) : x,
      y: typeof y === 'string' ? this.parseUnit(y, effectiveBaseHeight) : y,
      width: typeof width === 'string' ? this.parseUnit(width, effectiveBaseWidth) : width,
      height: typeof height === 'string' ? this.parseUnit(height, effectiveBaseHeight) : height,
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
      animations,
    };
  }

  /**
   * Apply animations to element properties.
   */
  private applyAnimations(
    animations: AnimationBase<any>[],
    time: number,
    initial: AnimResult
  ): AnimResult {
    const result: AnimResult = { ...initial };

    for (const animation of animations) {
      const props = animation.properties as any;
      const anim = animation as any;
      const elementTime = typeof anim._elementTime === 'number' ? anim._elementTime : 0;
      let animTime = props.time;

      // Handle 'start' and 'end' time values
      if (animTime === 'start') {
        animTime = elementTime;
      } else if (animTime === 'end') {
        animTime = elementTime + (anim._duration || 1);
      } else if (typeof animTime !== 'number') {
        animTime = 0;
      }

      const animDuration = typeof props.duration === 'number' ? props.duration : 1;
      const animEasing = props.easing ?? 'linear';

      // Calculate animation progress (0 to 1)
      const elapsed = time - animTime;
      let progress = elapsed / animDuration;
      progress = Math.max(0, Math.min(1, progress));

      // Get easing function
      const easedProgress = getEasingFunction(animEasing as any)(progress);

      // Apply animation based on type
      const type = (animation as any).type;
      const isReversed = props.reversed || props.transition;

      switch (type) {
        // Fade animation
        case 'fade':
          if (isReversed) {
            result.opacity = 1 - easedProgress;
          } else {
            result.opacity = easedProgress;
          }
          break;

        // Slide animation
        case 'slide':
          this.applySlideAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Scale animation
        case 'scale':
          this.applyScaleAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Spin animation
        case 'spin':
          this.applySpinAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Bounce animation
        case 'bounce':
          this.applyBounceAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Shake animation
        case 'shake':
          this.applyShakeAnimation(props, time, animTime, animDuration, initial, result);
          break;

        // Wiggle animation
        case 'wiggle':
          this.applyWiggleAnimation(props, time, animTime, animDuration, initial, result);
          break;

        // Shift animation
        case 'shift':
          this.applyShiftAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Pan animation
        case 'pan':
          this.applyPanAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Flip animation
        case 'flip':
          this.applyFlipAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // RotateSlide animation
        case 'rotate-slide':
          this.applyRotateSlideAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Squash animation
        case 'squash':
          this.applySquashAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // Wipe animation
        case 'wipe':
          this.applyWipeAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // CircularWipe animation
        case 'circular-wipe':
          this.applyCircularWipeAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // ColorWipe animation
        case 'color-wipe':
          this.applyColorWipeAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // FilmRoll animation
        case 'film-roll':
          this.applyFilmRollAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // ===== Text Animations =====

        // TextAppear animation
        case 'text-appear':
          this.applyTextAppearAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextSlide animation
        case 'text-slide':
          this.applyTextSlideAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextFly animation
        case 'text-fly':
          this.applyTextFlyAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextReveal animation
        case 'text-reveal':
          this.applyTextRevealAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextScale animation
        case 'text-scale':
          this.applyTextScaleAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextSpin animation
        case 'text-spin':
          this.applyTextSpinAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextCounter animation
        case 'text-counter':
          this.applyTextCounterAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextTypewriter animation
        case 'text-typewriter':
          this.applyTextTypewriterAnimation(props, easedProgress, isReversed, initial, result);
          break;

        // TextWave animation
        case 'text-wave':
          this.applyTextWaveAnimation(props, time, animTime, animDuration, initial, result);
          break;
      }
    }

    return result;
  }

  private applySlideAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'left';
    const distance = typeof props.distance === 'number' ? props.distance : 100;
    const fade = props.fade ?? false;

    let dx = 0, dy = 0;
    if (direction === 'left') dx = -distance;
    else if (direction === 'right') dx = distance;
    else if (direction === 'up') dy = -distance;
    else if (direction === 'down') dy = distance;

    if (isReversed) {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
    } else {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
    }

    if (fade) {
      result.opacity = isReversed ? 1 - progress : progress;
    }
  }

  private applyScaleAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'larger';
    const axis = props.axis;
    const startScale = typeof props.startScale === 'number' ? props.startScale / 100 : (isReversed ? 1 : 0);
    const endScale = typeof props.endScale === 'number' ? props.endScale / 100 : (isReversed ? 0 : 1);

    let targetScale = isReversed ? endScale + (startScale - endScale) * (1 - progress) : startScale + (endScale - startScale) * progress;

    if (axis === 'x') {
      result.scaleX = targetScale;
    } else if (axis === 'y') {
      result.scaleY = targetScale;
    } else {
      result.scaleX = targetScale;
      result.scaleY = targetScale;
    }
  }

  private applySpinAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'clockwise';
    const rotation = typeof props.rotation === 'number' ? props.rotation : 360;
    const angle = (direction === 'clockwise' ? 1 : -1) * rotation * (Math.PI / 180);

    if (isReversed) {
      result.rotation = initial.rotation + angle * (1 - progress);
    } else {
      result.rotation = initial.rotation + angle * progress;
    }
  }

  private applyBounceAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'up';
    const distance = typeof props.distance === 'number' ? props.distance : 50;
    const axis = props.axis;
    const count = typeof props.count === 'number' ? props.count : 1;

    let dy = 0, dx = 0;
    if (direction === 'up' || axis === 'y') dy = -distance;
    else if (direction === 'down' || axis === 'y') dy = distance;
    else if (direction === 'left' || axis === 'x') dx = -distance;
    else if (direction === 'right' || axis === 'x') dx = distance;

    // Apply bounce easing
    const bounceProgress = this.bounceEase(progress, count);

    if (isReversed) {
      result.x = initial.x + dx * (1 - bounceProgress);
      result.y = initial.y + dy * (1 - bounceProgress);
    } else {
      result.x = initial.x + dx * bounceProgress;
      result.y = initial.y + dy * bounceProgress;
    }
  }

  private applyShakeAnimation(props: any, time: number, animTime: number, animDuration: number, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'horizontal';
    const distance = typeof props.distance === 'number' ? props.distance : 10;
    const count = typeof props.count === 'number' ? props.count : 3;
    const frequency = typeof props.frequency === 'number' ? props.frequency : 10;
    const rampDuration = typeof props.rampDuration === 'number' ? props.rampDuration : animDuration;
    const randomness = typeof props.randomness === 'number' ? props.randomness : 0;

    const elapsed = time - animTime;
    if (elapsed < 0 || elapsed > animDuration) return;

    // Calculate ramp factor
    const ramp = elapsed < rampDuration ? elapsed / rampDuration : 1;
    const shakeIntensity = distance * ramp * (1 - randomness * Math.random());

    // Calculate shake offset using sine wave
    const shakeProgress = elapsed / animDuration;
    const frequencyFactor = count * 2 * Math.PI * frequency * shakeProgress;
    const decay = 1 - shakeProgress;

    if (direction === 'horizontal' || direction === 'left' || direction === 'right') {
      result.x = initial.x + Math.sin(frequencyFactor) * shakeIntensity * decay;
    }
    if (direction === 'vertical' || direction === 'up' || direction === 'down') {
      result.y = initial.y + Math.sin(frequencyFactor) * shakeIntensity * decay;
    }
  }

  private applyWiggleAnimation(props: any, time: number, animTime: number, animDuration: number, initial: AnimResult, result: AnimResult) {
    const xRotation = typeof props.xRotation === 'number' ? props.xRotation : 0;
    const yRotation = typeof props.yRotation === 'number' ? props.yRotation : 0;
    const zRotation = typeof props.zRotation === 'number' ? props.zRotation : 15;
    const count = typeof props.count === 'number' ? props.count : 3;
    const frequency = typeof props.frequency === 'number' ? props.frequency : 5;
    const rampDuration = typeof props.rampDuration === 'number' ? props.rampDuration : animDuration;

    const elapsed = time - animTime;
    if (elapsed < 0 || elapsed > animDuration) return;

    const ramp = elapsed < rampDuration ? elapsed / rampDuration : 1;
    const wiggleProgress = elapsed / animDuration;
    const frequencyFactor = count * 2 * Math.PI * frequency * wiggleProgress;
    const decay = 1 - wiggleProgress;
    const intensity = ramp * decay;

    result.rotation = initial.rotation + Math.sin(frequencyFactor) * zRotation * (Math.PI / 180) * intensity;
  }

  private applyShiftAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'left';
    const distance = typeof props.distance === 'number' ? props.distance : 100;
    const repetitions = typeof props.repetitions === 'number' ? props.repetitions : 1;

    const stepDistance = distance / repetitions;
    let dx = 0, dy = 0;
    if (direction === 'left') dx = -stepDistance;
    else if (direction === 'right') dx = stepDistance;
    else if (direction === 'up') dy = -stepDistance;
    else if (direction === 'down') dy = stepDistance;

    if (isReversed) {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
    } else {
      result.x = initial.x + dx * progress;
      result.y = initial.y + dy * progress;
    }
  }

  private applyPanAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const startX = typeof props.startX === 'number' ? props.startX : 0;
    const startY = typeof props.startY === 'number' ? props.startY : 0;
    const endX = typeof props.endX === 'number' ? props.endX : 0;
    const endY = typeof props.endY === 'number' ? props.endY : 0;
    const startScale = typeof props.startScale === 'number' ? props.startScale / 100 : 1;
    const endScale = typeof props.endScale === 'number' ? props.endScale / 100 : 1;

    if (isReversed) {
      result.x = initial.x + (endX - startX) * (1 - progress);
      result.y = initial.y + (endY - startY) * (1 - progress);
      result.scaleX = endScale + (startScale - endScale) * (1 - progress);
      result.scaleY = endScale + (startScale - endScale) * (1 - progress);
    } else {
      result.x = initial.x + (endX - startX) * progress;
      result.y = initial.y + (endY - startY) * progress;
      result.scaleX = startScale + (endScale - startScale) * progress;
      result.scaleY = startScale + (endScale - startScale) * progress;
    }
  }

  private applyFlipAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const xRotation = typeof props.xRotation === 'number' ? props.xRotation : 180;
    const yRotation = typeof props.yRotation === 'number' ? props.yRotation : 0;
    const backfaceVisible = props.backfaceVisible ?? false;

    // Flip is a 3D rotation
    const xAngle = isReversed ? xRotation * (1 - progress) : xRotation * progress;
    const yAngle = isReversed ? yRotation * (1 - progress) : yRotation * progress;

    // Set rotationX and rotationY for 3D flip effect
    result.rotationX = initial.rotationX ?? 0;
    result.rotationY = initial.rotationY ?? 0;

    if (backfaceVisible) {
      // Simple flip - just use X rotation
      result.rotationX = (initial.rotationX ?? 0) + xAngle * (Math.PI / 180);
    } else {
      // Both X and Y rotation for complete flip
      result.rotationX = (initial.rotationX ?? 0) + xAngle * (Math.PI / 180);
      result.rotationY = (initial.rotationY ?? 0) + yAngle * (Math.PI / 180);
    }
  }

  private applyRotateSlideAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'left';
    const clockwise = props.clockwise ?? false;
    const fade = props.fade ?? false;

    const distance = typeof props.distance === 'number' ? props.distance : 100;
    let dx = 0, dy = 0;
    if (direction === 'left') dx = -distance;
    else if (direction === 'right') dx = distance;
    else if (direction === 'up') dy = -distance;
    else if (direction === 'down') dy = distance;

    // Also apply rotation
    const rotation = 90 * (clockwise ? 1 : -1) * (Math.PI / 180);

    if (isReversed) {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
      result.rotation = initial.rotation + rotation * (1 - progress);
    } else {
      result.x = initial.x + dx * progress;
      result.y = initial.y + dy * progress;
      result.rotation = initial.rotation + rotation * progress;
    }

    if (fade) {
      result.opacity = isReversed ? 1 - progress : progress;
    }
  }

  private applySquashAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'down';
    const scaleAmount = 0.7; // Squash to 70%

    if (direction === 'down' || direction === 'up') {
      if (isReversed) {
        result.scaleY = 1 - (1 - scaleAmount) * (1 - progress);
        result.scaleX = 1 + (1 - scaleAmount) * (1 - progress);
      } else {
        result.scaleY = scaleAmount + (1 - scaleAmount) * progress;
        result.scaleX = 2 - scaleAmount - (1 - scaleAmount) * progress;
      }
    } else {
      if (isReversed) {
        result.scaleX = 1 - (1 - scaleAmount) * (1 - progress);
        result.scaleY = 1 + (1 - scaleAmount) * (1 - progress);
      } else {
        result.scaleX = scaleAmount + (1 - scaleAmount) * progress;
        result.scaleY = 2 - scaleAmount - (1 - scaleAmount) * progress;
      }
    }
  }

  private applyWipeAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const fade = props.fade ?? false;
    const clip = props.clip ?? 'both';

    if (isReversed) {
      if (fade) result.opacity = 1 - progress;
      // Wipe reveals/hides content
    } else {
      if (fade) result.opacity = progress;
    }
  }

  private applyCircularWipeAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const fade = props.fade ?? false;
    const ringWidth = typeof props.ringWidth === 'number' ? props.ringWidth : 50;

    if (isReversed) {
      if (fade) result.opacity = 1 - progress;
    } else {
      if (fade) result.opacity = progress;
    }
  }

  private applyColorWipeAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const color = props.color ?? '#ffffff';
    const direction = props.direction ?? 'left';

    if (isReversed) {
      result.opacity = 1 - progress;
    } else {
      result.opacity = progress;
    }
  }

  private applyFilmRollAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'left';
    const fade = props.fade ?? false;

    const distance = 20; // Film roll wiggle distance
    let dy = 0;
    if (direction === 'up') dy = -distance;
    else if (direction === 'down') dy = distance;

    if (isReversed) {
      result.y = initial.y + dy * (1 - progress);
    } else {
      result.y = initial.y + dy * Math.sin(progress * Math.PI * 8) * (1 - progress);
    }

    if (fade) {
      result.opacity = isReversed ? 1 - progress : progress;
    }
  }

  /**
   * Bounce easing function
   */
  private bounceEase(t: number, bounces: number = 1): number {
    const freq = Math.PI * bounces;
    return Math.sin(t * freq) * (1 - t);
  }

  // ===== Text Animations =====

  private applyTextAppearAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const startOpacity = typeof props.startOpacity === 'number' ? props.startOpacity : 0;
    const fade = props.fade ?? false;

    if (isReversed) {
      result.opacity = startOpacity + (1 - startOpacity) * (1 - progress);
    } else {
      result.opacity = startOpacity + (1 - startOpacity) * progress;
    }

    if (fade) {
      result.opacity = isReversed ? 1 - progress : progress;
    }
  }

  private applyTextSlideAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'left';
    const distance = typeof props.distance === 'number' ? props.distance : 50;
    const fade = props.fade ?? false;

    let dx = 0, dy = 0;
    if (direction === 'left') dx = -distance;
    else if (direction === 'right') dx = distance;
    else if (direction === 'up') dy = -distance;
    else if (direction === 'down') dy = distance;

    if (isReversed) {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
    } else {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
    }

    if (fade) {
      result.opacity = isReversed ? 1 - progress : progress;
    }
  }

  private applyTextFlyAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    // TextFly is similar to slide but with perspective
    const direction = props.direction ?? 'left';
    const distance = typeof props.distance === 'number' ? props.distance : 100;

    let dx = 0, dy = 0;
    if (direction === 'left') dx = -distance;
    else if (direction === 'right') dx = distance;
    else if (direction === 'up') dy = -distance;
    else if (direction === 'down') dy = distance;

    if (isReversed) {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
      result.opacity = progress;
    } else {
      result.x = initial.x + dx * (1 - progress);
      result.y = initial.y + dy * (1 - progress);
      result.opacity = progress;
    }
  }

  private applyTextRevealAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    // TextReveal reveals text by clipping or fading parts
    const axis = props.axis ?? 'center';
    const fade = props.fade ?? false;

    if (isReversed) {
      result.opacity = 1 - progress;
    } else {
      result.opacity = progress;
    }

    if (fade) {
      result.opacity = isReversed ? 1 - progress : progress;
    }
  }

  private applyTextScaleAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const axis = props.axis;
    const startScale = typeof props.startScale === 'number' ? props.startScale / 100 : (isReversed ? 1 : 0);
    const endScale = typeof props.endScale === 'number' ? props.endScale / 100 : (isReversed ? 0 : 1);

    let targetScale = isReversed ? endScale + (startScale - endScale) * (1 - progress) : startScale + (endScale - startScale) * progress;

    if (axis === 'x') {
      result.scaleX = targetScale;
    } else if (axis === 'y') {
      result.scaleY = targetScale;
    } else {
      result.scaleX = targetScale;
      result.scaleY = targetScale;
    }
  }

  private applyTextSpinAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    const direction = props.direction ?? 'clockwise';
    const rotation = typeof props.rotation === 'number' ? props.rotation : 360;
    const angle = (direction === 'clockwise' ? 1 : -1) * rotation * (Math.PI / 180);

    if (isReversed) {
      result.rotation = initial.rotation + angle * (1 - progress);
    } else {
      result.rotation = initial.rotation + angle * progress;
    }
  }

  private applyTextCounterAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    // TextCounter animates numerical values - for now just fade
    if (isReversed) {
      result.opacity = 1 - progress;
    } else {
      result.opacity = progress;
    }
  }

  private applyTextTypewriterAnimation(props: any, progress: number, isReversed: boolean, initial: AnimResult, result: AnimResult) {
    // TextTypewriter shows characters one by one
    // The actual character rendering is handled in TextElementRenderer
    if (isReversed) {
      result.opacity = 1 - progress;
    } else {
      result.opacity = progress;
    }
  }

  private applyTextWaveAnimation(props: any, time: number, animTime: number, animDuration: number, initial: AnimResult, result: AnimResult) {
    const distance = typeof props.distance === 'number' ? props.distance : 20;
    const frequency = typeof props.frequency === 'number' ? props.frequency : 5;
    const wavelength = typeof props.wavelength === 'number' ? props.wavelength : 1;

    const elapsed = time - animTime;
    if (elapsed < 0 || elapsed > animDuration) return;

    const waveProgress = elapsed / animDuration;
    const waveOffset = Math.sin(waveProgress * Math.PI * frequency) * distance * (1 - waveProgress);
    result.y = initial.y + waveOffset;
    result.opacity = initial.opacity * (0.5 + 0.5 * (1 - waveProgress));
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
          // Child elements should resolve their state based on composition dimensions
          const childStateResolved = this.resolveElementState(child, time, state.width, state.height);
          if (!childStateResolved.visible) return;
          await this.renderElement(child, childStateResolved, time);
        });
        break;
    }
  }
}
