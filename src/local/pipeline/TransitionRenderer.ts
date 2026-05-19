import { Canvas } from '@napi-rs/canvas';
import { AnimationBase } from '../../animations/AnimationBase';

/**
 * Enum for transition types supported by the local renderer.
 */
export enum TransitionType {
  CIRCULAR_WIPE = 'circular-wipe',
  WIPE = 'wipe',
  SLIDE = 'slide',
  FLIP = 'flip',
  PAN = 'pan',
  SCALE = 'scale',
  BOUNCE = 'bounce',
  SHAKE = 'shake',
  SPIN = 'spin',
  SQUASH = 'squash',
  SHIFT = 'shift',
  ROTATE_SLIDE = 'rotate-slide',
  COLOR_WIPE = 'color-wipe',
  FILM_ROLL = 'film-roll',
  FADE = 'fade',
  WIGGLE = 'wiggle',
}

/**
 * Properties for wipe transition.
 */
interface WipeProps {
  xAnchor?: number | string;
  startAngle?: number | string;
  endAngle?: number | string;
  clip?: 'both' | 'first-only' | 'second-only';
  fade?: boolean;
}

/**
 * Properties for slide transition.
 */
interface SlideProps {
  scope?: 'composition' | 'element';
  direction?: number | string;
  distance?: number | string;
  fixed?: 'none' | 'first-only' | 'second-only';
  fade?: boolean;
}

/**
 * Properties for flip transition.
 */
interface FlipProps {
  xRotation?: number | string;
  yRotation?: number | string;
  xAnchor?: number | string;
  yAnchor?: number | string;
  backfaceVisible?: boolean;
  fade?: boolean;
}

/**
 * Properties for pan transition.
 */
interface PanProps {
  scope?: 'composition' | 'element';
  startScale?: number | string;
  startX?: number | string;
  startY?: number | string;
  endScale?: number | string;
  endX?: number | string;
  endY?: number | string;
}

/**
 * Properties for scale transition.
 */
interface ScaleProps {
  xAnchor?: number | string;
  yAnchor?: number | string;
  originX?: number | string;
  originY?: number | string;
  fade?: boolean;
}

/**
 * Properties for spin transition.
 */
interface SpinProps {
  xAnchor?: number | string;
  yAnchor?: number | string;
  axis?: 'x' | 'y' | 'z';
  fade?: boolean;
}

/**
 * Universal transition renderer that supports all transition types.
 */
export class TransitionRenderer {
  private ctx: any;
  private canvas: Canvas;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  }

  /**
   * Detect transition type from animation instance.
   */
  detectTransitionType(transition: AnimationBase<any>): string {
    const type = transition.constructor.name.toLowerCase();

    if (type.includes('circularwipe')) return TransitionType.CIRCULAR_WIPE;
    if (type.includes('wipe')) return TransitionType.WIPE;
    if (type.includes('slide')) return TransitionType.SLIDE;
    if (type.includes('flip')) return TransitionType.FLIP;
    if (type.includes('pan')) return TransitionType.PAN;
    if (type.includes('scale')) return TransitionType.SCALE;
    if (type.includes('bounce')) return TransitionType.BOUNCE;
    if (type.includes('shake')) return TransitionType.SHAKE;
    if (type.includes('spin')) return TransitionType.SPIN;
    if (type.includes('squash')) return TransitionType.SQUASH;
    if (type.includes('shift')) return TransitionType.SHIFT;
    if (type.includes('rotateslide')) return TransitionType.ROTATE_SLIDE;
    if (type.includes('colorwipe')) return TransitionType.COLOR_WIPE;
    if (type.includes('filmroll')) return TransitionType.FILM_ROLL;
    if (type.includes('fade')) return TransitionType.FADE;
    if (type.includes('wiggle')) return TransitionType.WIGGLE;

    return 'unknown';
  }

  /**
   * Parse anchor value to normalized form (0-1).
   */
  parseAnchor(value: number | string | undefined, base: number): number {
    if (value === undefined) return 0.5;
    if (typeof value === 'number') {
      if (value > 1) return value / base;
      return value;
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
   * Parse distance value to pixels.
   */
  parseDistance(value: number | string | undefined, base: number): number {
    if (value === undefined) return base;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      if (value.endsWith('%')) {
        return (parseFloat(value) / 100) * base;
      }
      return parseFloat(value) || base;
    }
    return base;
  }

  /**
   * Parse angle in degrees to radians.
   */
  parseAngle(value: number | string | undefined): number {
    if (value === undefined) return 0;
    if (typeof value === 'number') return value * (Math.PI / 180);
    if (typeof value === 'string') {
      if (value.endsWith('°')) return parseFloat(value) * (Math.PI / 180);
      if (value.endsWith('rad')) return parseFloat(value);
      return (parseFloat(value) || 0) * (Math.PI / 180);
    }
    return 0;
  }

  /**
   * Render transition between two canvases.
   */
  renderTransition(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    transition: AnimationBase<any>
  ): void {
    const type = this.detectTransitionType(transition);
    const props = transition.properties || {};

    switch (type) {
      case TransitionType.CIRCULAR_WIPE:
        this.renderCircularWipe(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.WIPE:
        this.renderWipe(fromCanvas, toCanvas, progress, props as WipeProps);
        break;
      case TransitionType.SLIDE:
        this.renderSlide(fromCanvas, toCanvas, progress, props as SlideProps);
        break;
      case TransitionType.FLIP:
        this.renderFlip(fromCanvas, toCanvas, progress, props as FlipProps);
        break;
      case TransitionType.PAN:
        this.renderPan(fromCanvas, toCanvas, progress, props as PanProps);
        break;
      case TransitionType.SCALE:
        this.renderScale(fromCanvas, toCanvas, progress, props as ScaleProps);
        break;
      case TransitionType.BOUNCE:
        this.renderBounce(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.SHAKE:
        this.renderShake(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.SPIN:
        this.renderSpin(fromCanvas, toCanvas, progress, props as SpinProps);
        break;
      case TransitionType.SQUASH:
        this.renderSquash(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.SHIFT:
        this.renderShift(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.ROTATE_SLIDE:
        this.renderRotateSlide(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.COLOR_WIPE:
        this.renderColorWipe(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.FILM_ROLL:
        this.renderFilmRoll(fromCanvas, toCanvas, progress, props);
        break;
      case TransitionType.FADE:
        this.renderFade(fromCanvas, toCanvas, progress);
        break;
      case TransitionType.WIGGLE:
        this.renderWiggle(fromCanvas, toCanvas, progress, props);
        break;
      default:
        // Unknown transition type, use fade as fallback
        this.renderFade(fromCanvas, toCanvas, progress);
    }
  }

  /**
   * Render circular wipe transition.
   */
  private renderCircularWipe(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const xAnchor = this.parseAnchor(props.xAnchor, width);
    const yAnchor = this.parseAnchor(props.yAnchor, height);
    const centerX = width * xAnchor;
    const centerY = height * yAnchor;
    const maxRadius = Math.sqrt(width * width + height * height);
    const currentRadius = maxRadius * progress;
    const ringWidth = typeof props.ringWidth === 'number' ? props.ringWidth : 0;
    const ringColor = props.ringColor;
    const fade = props.fade ?? false;

    this.ctx.save();

    if (fade) {
      this.ctx.globalAlpha = 1 - progress;
    }

    // Create circular clip path
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    this.ctx.clip();

    // Draw the from canvas
    this.ctx.drawImage(fromCanvas, 0, 0);

    this.ctx.restore();

    // Draw the to canvas
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
    this.ctx.clip();

    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(toCanvas, 0, 0);
    this.ctx.restore();

    // Draw ring border
    if (ringColor && ringWidth > 0) {
      this.ctx.strokeStyle = ringColor;
      this.ctx.lineWidth = ringWidth;
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  /**
   * Render wipe transition.
   */
  private renderWipe(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: WipeProps
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const xAnchor = this.parseAnchor(props.xAnchor, width);
    const startAngle = this.parseAngle(props.startAngle);
    const endAngle = this.parseAngle(props.endAngle ?? '360°');
    const fade = props.fade ?? false;

    const centerX = width * xAnchor;
    const centerY = height / 2;
    const maxRadius = Math.max(width, height) * 1.5;
    const currentRadius = maxRadius * (1 - progress);

    this.ctx.save();

    if (fade) {
      this.ctx.globalAlpha = 1 - progress;
    }

    // Create arc clip path (wipe from one side to another)
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.arc(centerX, centerY, currentRadius, startAngle, endAngle);
    this.ctx.closePath();
    this.ctx.clip();

    this.ctx.drawImage(fromCanvas, 0, 0);

    this.ctx.restore();

    // Draw to canvas
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(centerX, centerY);
    this.ctx.arc(centerX, centerY, currentRadius, startAngle, endAngle);
    this.ctx.closePath();
    this.ctx.clip();

    this.ctx.globalAlpha = 1;
    this.ctx.drawImage(toCanvas, 0, 0);
    this.ctx.restore();
  }

  /**
   * Render slide transition.
   */
  private renderSlide(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: SlideProps
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const direction = typeof props.direction === 'string' ? parseFloat(props.direction) : (props.direction ?? 0);
    const distance = this.parseDistance(props.distance, width);
    const fade = props.fade ?? false;

    const offsetX = Math.cos(direction * Math.PI / 180) * distance * progress;
    const offsetY = Math.sin(direction * Math.PI / 180) * distance * progress;

    if (fade) {
      this.ctx.globalAlpha = 1 - progress;
    }

    // Draw from canvas with slide offset
    this.ctx.drawImage(fromCanvas, offsetX, offsetY);

    if (fade) {
      this.ctx.globalAlpha = progress;
    }

    // Draw to canvas
    this.ctx.drawImage(toCanvas, 0, 0);

    this.ctx.globalAlpha = 1;
  }

  /**
   * Render flip transition.
   */
  private renderFlip(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: FlipProps
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const xAnchor = this.parseAnchor(props.xAnchor, width);
    const yAnchor = this.parseAnchor(props.yAnchor, height);
    const centerX = width * xAnchor;
    const centerY = height * yAnchor;

    // Flip effect using scale
    const scaleX = progress < 0.5 ? 1 - progress * 2 : 0;
    const alpha = progress < 0.5 ? 1 - progress * 2 : progress * 2 - 1;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(scaleX, 1);
    this.ctx.translate(-centerX, -centerY);

    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(fromCanvas, 0, 0);

    this.ctx.restore();

    // Show to canvas
    if (progress >= 0.5) {
      const scaleX2 = progress < 0.75 ? (progress - 0.5) * 4 : 1;
      this.ctx.save();
      this.ctx.translate(centerX, centerY);
      this.ctx.scale(scaleX2, 1);
      this.ctx.translate(-centerX, -centerY);

      this.ctx.globalAlpha = (progress - 0.5) * 2;
      this.ctx.drawImage(toCanvas, 0, 0);

      this.ctx.restore();
    }

    this.ctx.globalAlpha = 1;
  }

  /**
   * Render pan transition.
   */
  private renderPan(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: PanProps
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    const startX = this.parseDistance(props.startX, width);
    const startY = this.parseDistance(props.startY, height);
    const endX = this.parseDistance(props.endX, width);
    const endY = this.parseDistance(props.endY, height);

    const startScale = parseFloat(String(props.startScale ?? '1'));
    const endScale = parseFloat(String(props.endScale ?? '1'));

    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;
    const currentScale = startScale + (endScale - startScale) * progress;

    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);
    this.ctx.scale(currentScale, currentScale);
    this.ctx.translate(-width / 2, -height / 2);
    this.ctx.translate(currentX, currentY);

    this.ctx.drawImage(progress < 0.5 ? fromCanvas : toCanvas, 0, 0);

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Render scale transition.
   */
  private renderScale(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: ScaleProps
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const xAnchor = this.parseAnchor(props.xAnchor, width);
    const yAnchor = this.parseAnchor(props.yAnchor, height);
    const centerX = width * xAnchor;
    const centerY = height * yAnchor;

    const scale = 1 - progress;
    const alpha = 1 - progress;

    // Scale out from canvas
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(1 - progress, 1 - progress);
    this.ctx.translate(-centerX, -centerY);

    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(fromCanvas, 0, 0);

    this.ctx.restore();

    // Scale in to canvas
    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.scale(progress, progress);
    this.ctx.translate(-centerX, -centerY);

    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(toCanvas, 0, 0);

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Render bounce transition.
   */
  private renderBounce(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    // Bounce uses elastic easing for scale
    const bounceProgress = this.bounceOut(progress);
    const scale = progress < 0.5 ? 1 - bounceProgress * 0.3 : 1 + (bounceProgress - 1) * 0.3;

    this.ctx.save();
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(scale, scale);
    this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

    this.ctx.globalAlpha = progress < 0.5 ? 1 - progress * 2 : progress * 2 - 1;
    this.ctx.drawImage(progress < 0.5 ? fromCanvas : toCanvas, 0, 0);

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Bounce easing function.
   */
  private bounceOut(t: number): number {
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
  }

  /**
   * Render shake transition.
   */
  private renderShake(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const intensity = Math.sin(progress * Math.PI * 8) * (1 - progress) * 10;
    const offsetX = Math.cos(progress * Math.PI * 8) * intensity;
    const offsetY = Math.sin(progress * Math.PI * 8) * intensity;

    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);

    this.ctx.globalAlpha = progress < 0.5 ? 1 - progress * 2 : progress * 2 - 1;
    this.ctx.drawImage(progress < 0.5 ? fromCanvas : toCanvas, 0, 0);

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Render spin transition.
   */
  private renderSpin(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: SpinProps
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const xAnchor = this.parseAnchor(props.xAnchor, width);
    const yAnchor = this.parseAnchor(props.yAnchor, height);
    const centerX = width * xAnchor;
    const centerY = height * yAnchor;

    const angle = progress * Math.PI * 2;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(angle);
    this.ctx.translate(-centerX, -centerY);

    this.ctx.globalAlpha = progress < 0.5 ? 1 - progress * 2 : progress * 2 - 1;
    this.ctx.drawImage(progress < 0.5 ? fromCanvas : toCanvas, 0, 0);

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Render squash transition.
   */
  private renderSquash(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Squash effect - scale X and inverse scale Y (or vice versa)
    const scaleX = 1 - Math.sin(progress * Math.PI) * 0.5;
    const scaleY = 1 + Math.sin(progress * Math.PI) * 0.5;

    this.ctx.save();
    this.ctx.translate(width / 2, height / 2);
    this.ctx.scale(scaleX, scaleY);
    this.ctx.translate(-width / 2, -height / 2);

    this.ctx.globalAlpha = progress < 0.5 ? 1 - progress * 2 : progress * 2 - 1;
    this.ctx.drawImage(progress < 0.5 ? fromCanvas : toCanvas, 0, 0);

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Render shift transition.
   */
  private renderShift(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const direction = typeof props.direction === 'string' ? parseFloat(props.direction) : (props.direction ?? 0);
    const distance = this.parseDistance(props.distance, width);

    const offsetX = Math.cos(direction * Math.PI / 180) * distance * (1 - progress);
    const offsetY = Math.sin(direction * Math.PI / 180) * distance * (1 - progress);

    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(fromCanvas, offsetX, offsetY);

    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(toCanvas, 0, 0);

    this.ctx.globalAlpha = 1;
  }

  /**
   * Render rotate slide transition.
   */
  private renderRotateSlide(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const angle = progress * Math.PI / 4;
    const offsetX = progress * width * 0.5;

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(angle);
    this.ctx.translate(-centerX, -centerY);

    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(fromCanvas, offsetX, 0);

    this.ctx.restore();

    this.ctx.save();
    this.ctx.translate(centerX, centerY);
    this.ctx.rotate(-angle * 0.5);
    this.ctx.translate(-centerX, -centerY);

    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(toCanvas, -offsetX * 0.5, 0);

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Render color wipe transition.
   */
  private renderColorWipe(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const direction = typeof props.direction === 'string' ? parseFloat(props.direction) : (props.direction ?? 0);
    const fade = props.fade ?? false;

    const dirRad = direction * Math.PI / 180;
    const offsetX = Math.cos(dirRad) * width * progress;
    const offsetY = Math.sin(dirRad) * height * progress;

    if (fade) {
      this.ctx.globalAlpha = 1 - progress;
    }

    // Create gradient wipe
    const gradient = this.ctx.createLinearGradient(
      offsetX - Math.sin(dirRad) * width,
      offsetY + Math.cos(dirRad) * width,
      offsetX + Math.sin(dirRad) * width,
      offsetY - Math.cos(dirRad) * width
    );
    gradient.addColorStop(0, 'rgba(0,0,0,1)');
    gradient.addColorStop(progress, 'rgba(0,0,0,1)');
    gradient.addColorStop(Math.min(1, progress + 0.1), 'rgba(0,0,0,0)');

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(0, 0, width, height);
    this.ctx.clip();

    this.ctx.drawImage(fromCanvas, 0, 0);

    this.ctx.globalAlpha = 1;
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.restore();

    this.ctx.globalAlpha = 1;
  }

  /**
   * Render film roll transition.
   */
  private renderFilmRoll(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const curlRadius = Math.min(width, height) * 0.2;

    // Film roll effect - curl the edge like a page turn
    const curlProgress = progress;

    this.ctx.save();

    // Draw from canvas with curl effect
    this.ctx.beginPath();
    const curlX = width * (1 - curlProgress);
    this.ctx.moveTo(curlX, 0);
    this.ctx.lineTo(width, 0);
    this.ctx.lineTo(width, height);
    this.ctx.lineTo(curlX, height);
    this.ctx.clip();

    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(fromCanvas, 0, 0);

    // Draw curled portion
    if (curlProgress > 0) {
      this.ctx.globalAlpha = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(curlX, 0);
      this.ctx.quadraticCurveTo(curlX + curlRadius, height / 2, curlX, height);
      this.ctx.lineTo(curlX - curlRadius, height);
      this.ctx.quadraticCurveTo(curlX - curlRadius * 2, height / 2, curlX - curlRadius, 0);
      this.ctx.closePath();
      this.ctx.clip();

      this.ctx.drawImage(toCanvas, 0, 0);
    }

    this.ctx.restore();
    this.ctx.globalAlpha = 1;
  }

  /**
   * Render fade transition.
   */
  private renderFade(fromCanvas: Canvas, toCanvas: Canvas, progress: number): void {
    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(fromCanvas, 0, 0);

    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(toCanvas, 0, 0);

    this.ctx.globalAlpha = 1;
  }

  /**
   * Render wiggle transition.
   */
  private renderWiggle(
    fromCanvas: Canvas,
    toCanvas: Canvas,
    progress: number,
    props: any
  ): void {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Wiggle effect using sine waves
    const time = progress * Math.PI * 6;
    const amplitude = (1 - progress) * 15;

    const offsetX = Math.sin(time) * amplitude;
    const offsetY = Math.cos(time * 0.7) * amplitude * 0.5;

    this.ctx.save();
    this.ctx.translate(offsetX, offsetY);

    this.ctx.globalAlpha = 1 - progress;
    this.ctx.drawImage(fromCanvas, 0, 0);

    this.ctx.restore();

    this.ctx.globalAlpha = progress;
    this.ctx.drawImage(toCanvas, 0, 0);

    this.ctx.globalAlpha = 1;
  }
}