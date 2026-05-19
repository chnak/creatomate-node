import { ElementBase } from '../../elements/ElementBase';
import { getEasingFunction } from '../animations/EasingFunctions';

/**
 * Text element renderer with full animation support.
 */
export class TextElementRenderer {
  /**
   * Render text element.
   */
  static async render(
    renderer: any,
    element: ElementBase<any>,
    state: {
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
      rotationX?: number;
      rotationY?: number;
    },
    context: { time: number; width: number; height: number }
  ): Promise<void> {
    const props = element.properties as any;
    const text = props.text ?? '';
    const animations = props.animations as any[] || [];

    // Check if this is a text animation that needs split rendering
    const textAnimType = this.getTextAnimationType(animations);

    if (textAnimType && textAnimType.split) {
      // Use animated rendering for letter/word/line animations
      const animState = this.calculateTextAnimationState(animations, context.time);
      this.renderAnimatedText(renderer, element, state, context, textAnimType, animState);
    } else {
      // Standard rendering
      this.renderStandardText(renderer, element, state, context);
    }
  }

  /**
   * Get text animation type and its properties.
   */
  private static getTextAnimationType(animations: any[]): { type: string; split: string; progress: number; easing: string; direction: string; distance: number; order: string } | null {
    for (const anim of animations) {
      const type = anim.properties?.type || anim.type;
      if (type === 'text-appear' || type === 'text-slide' || type === 'text-fly' ||
          type === 'text-reveal' || type === 'text-wave' || type === 'text-typewriter') {
        const props = anim.properties || anim;
        return {
          type,
          split: props.split || 'letter',
          progress: 1, // Will be calculated based on time
          easing: props.easing || 'linear',
          direction: props.direction || 'left',
          distance: typeof props.distance === 'number' ? props.distance : 50,
          order: props.order || 'default'
        };
      }
    }
    return null;
  }

  /**
   * Calculate animation state at current time.
   */
  private static calculateTextAnimationState(animations: any[], time: number): { progress: number; unitProgress: number[] } {
    let overallProgress = 0;
    const unitProgress: number[] = [0];

    for (const anim of animations) {
      const props = anim.properties || anim;
      const animTime = typeof props.time === 'number' ? props.time : 0;
      const animDuration = typeof props.duration === 'number' ? props.duration : 1;
      const easing = props.easing || 'linear';

      const elapsed = time - animTime;
      let progress = elapsed / animDuration;
      progress = Math.max(0, Math.min(1, progress));

      const easedProgress = getEasingFunction(easing as any)(progress);
      overallProgress = easedProgress;
    }

    return { progress: overallProgress, unitProgress };
  }

  /**
   * Render standard text without animation splits.
   */
  private static renderStandardText(
    renderer: any,
    element: ElementBase<any>,
    state: {
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
      rotationX?: number;
      rotationY?: number;
    },
    context: { time: number; width: number; height: number }
  ): void {
    const props = element.properties as any;

    // Expand TextBackground object if present
    let bgProps = props;
    if (props.background && typeof props.background.toMap === 'function') {
      bgProps = { ...props, ...props.background.toMap() };
    }

    const text = bgProps.text ?? '';
    const fontSize = typeof bgProps.fontSize === 'number' ? bgProps.fontSize : 48;
    const fontFamily = bgProps.fontFamily || 'Arial';
    const fontWeight = bgProps.fontWeight || 400;
    const fontStyle = bgProps.fontStyle || 'normal';
    const fillColor = bgProps.fillColor || '#000000';
    const letterSpacing = typeof bgProps.letterSpacing === 'number' ? bgProps.letterSpacing : 0;
    const lineHeight = typeof bgProps.lineHeight === 'number' ? bgProps.lineHeight : 1.2;
    const textAlign = bgProps.textAlign || 'left';
    const xAlignment = bgProps.xAlignment;
    const blendMode = bgProps.blendMode;
    const colorFilter = bgProps.colorFilter;
    const colorFilterValue = bgProps.colorFilterValue;

    // Calculate text position based on alignment
    let textX = state.x;
    let textY = state.y;

    // Handle xAlignment (element alignment) - this moves the entire text block
    if (xAlignment !== undefined) {
      if (typeof xAlignment === 'string' && xAlignment.endsWith('%')) {
        const alignPercent = parseFloat(xAlignment) / 100;
        textX = state.x + state.width * alignPercent - state.width / 2;
      } else if (typeof xAlignment === 'number') {
        textX = state.x + xAlignment - state.width / 2;
      }
    }

    // Handle yAlignment (vertical alignment of element within its bounds)
    const yAlignment = props.yAlignment;
    if (yAlignment !== undefined) {
      if (typeof yAlignment === 'string' && yAlignment.endsWith('%')) {
        const alignPercent = parseFloat(yAlignment) / 100;
        textY = state.y + state.height * alignPercent - state.height / 2;
      } else if (typeof yAlignment === 'number') {
        textY = state.y + yAlignment - state.height / 2;
      }
    }

    // Handle textAlign (text content alignment within its bounds)
    const effectiveTextAlign = props.textAlign || 'left';
    let textAlignOffset = 0;
    if (effectiveTextAlign === 'center') {
      textAlignOffset = state.width / 2;
    } else if (effectiveTextAlign === 'right') {
      textAlignOffset = state.width;
    }

    renderer.setOpacity(state.opacity);

    // Apply blend mode if specified
    if (blendMode && blendMode !== 'none') {
      renderer.setBlendMode(blendMode);
    }

    // Apply color filter
    if (colorFilter && colorFilter !== 'none') {
      renderer.applyColorFilter(colorFilter, colorFilterValue);
    }

    // Draw text background if specified
    if (bgProps.backgroundColor || bgProps.background_color) {
      const bgColor = bgProps.backgroundColor || bgProps.background_color;
      const rawXPadding = bgProps.backgroundXPadding ?? bgProps.background_x_padding;
      const rawYPadding = bgProps.backgroundYPadding ?? bgProps.background_y_padding;
      const rawBorderRadius = bgProps.backgroundBorderRadius ?? bgProps.background_border_radius;

      // Parse padding value (supports number or percentage string)
      const parsePadding = (val: any): number => {
        if (typeof val === 'number') return val * fontSize / 100;
        if (typeof val === 'string' && val.endsWith('%')) return parseFloat(val) / 100 * fontSize;
        if (typeof val === 'string') return parseFloat(val) || 0;
        return 0;
      };

      const bgPadding = parsePadding(rawXPadding);
      const bgYPadding = parsePadding(rawYPadding);
      const bgBorderRadius = typeof rawBorderRadius === 'number' ? rawBorderRadius : (parseFloat(rawBorderRadius) || 0);

      renderer.ctx.fillStyle = bgColor;
      const lines = text.split('\n');
      const totalHeight = lines.length * fontSize * lineHeight;
      const bgX = textX - bgPadding + textAlignOffset;
      const bgY = textY - bgYPadding;
      const bgWidth = state.width + bgPadding * 2;
      const bgHeight = totalHeight + bgYPadding * 2;

      renderer.ctx.beginPath();
      if (bgBorderRadius > 0) {
        const r = Math.min(bgBorderRadius, bgWidth / 2, bgHeight / 2);
        renderer.ctx.moveTo(bgX + r, bgY);
        renderer.ctx.lineTo(bgX + bgWidth - r, bgY);
        renderer.ctx.arcTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + r, r);
        renderer.ctx.lineTo(bgX + bgWidth, bgY + bgHeight - r);
        renderer.ctx.arcTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - r, bgY + bgHeight, r);
        renderer.ctx.lineTo(bgX + r, bgY + bgHeight);
        renderer.ctx.arcTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - r, r);
        renderer.ctx.lineTo(bgX, bgY + r);
        renderer.ctx.arcTo(bgX, bgY, bgX + r, bgY, r);
        renderer.ctx.closePath();
      } else {
        renderer.ctx.rect(bgX, bgY, bgWidth, bgHeight);
      }
      renderer.ctx.fill();
    }

    renderer.drawText(
      text,
      textX + textAlignOffset,
      textY,
      state.width,
      state.height,
      {
        fontFamily,
        fontSize,
        fontWeight,
        fontStyle,
        fillColor,
        strokeColor: props.strokeColor,
        strokeWidth: props.strokeWidth,
        shadowColor: props.shadowColor,
        shadowBlur: props.shadowBlur,
        shadowOffsetX: props.shadowX,
        shadowOffsetY: props.shadowY,
        letterSpacing,
        lineHeight,
        textAlign: effectiveTextAlign,
      },
      context
    );

    // Reset color filter
    if (colorFilter && colorFilter !== 'none') {
      renderer.resetColorFilter();
    }

    // Reset blend mode
    if (blendMode && blendMode !== 'none') {
      renderer.resetBlendMode();
    }

    renderer.resetOpacity();
  }

  /**
   * Render text with animated character/word/line reveals.
   */
  private static renderAnimatedText(
    renderer: any,
    element: ElementBase<any>,
    state: {
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    },
    context: { time: number; width: number; height: number },
    textAnimType: { type: string; split: string; easing: string; direction: string; distance: number; order: string },
    animState: { progress: number; unitProgress: number[] }
  ): void {
    const props = element.properties as any;
    const text = props.text ?? '';
    const fontSize = typeof props.fontSize === 'number' ? props.fontSize : 48;
    const fontFamily = props.fontFamily || 'Arial';
    const fontWeight = props.fontWeight || 400;
    const fontStyle = props.fontStyle || 'normal';
    const fillColor = props.fillColor || '#000000';

    const { split, easing, direction, distance } = textAnimType;

    // Split text into units based on split mode
    let units: string[] = [];
    if (split === 'letter') {
      units = this.splitIntoLetters(text);
    } else if (split === 'word') {
      units = this.splitIntoWords(text);
    } else {
      units = this.splitIntoLines(text);
    }

    const totalUnits = units.length;
    const easedProgress = getEasingFunction(easing as any)(animState.progress);

    // Calculate how many units to show based on animation type
    let visibleCount: number;
    if (textAnimType.type === 'text-typewriter' || textAnimType.type === 'text-appear') {
      // Typewriter/appear: characters appear one by one
      visibleCount = Math.ceil(easedProgress * totalUnits);
    } else {
      visibleCount = Math.ceil(easedProgress * totalUnits);
    }

    // Render visible units
    let currentX = state.x;
    let currentY = state.y;
    const lineHeight = fontSize * 1.2;

    for (let i = 0; i < visibleCount; i++) {
      let unitIndex = i;
      if (textAnimType.order === 'reversed') {
        unitIndex = totalUnits - 1 - i;
      }

      const unit = units[unitIndex];
      const unitDelay = i / Math.max(1, totalUnits - 1);
      const unitProgress = Math.max(0, Math.min(1, (easedProgress - unitDelay) * (totalUnits - 1)));
      const unitEased = getEasingFunction(easing as any)(unitProgress);

      // Calculate offset based on animation type and direction
      let offsetX = 0, offsetY = 0;
      if (textAnimType.type === 'text-slide' || textAnimType.type === 'text-fly') {
        if (direction === 'left') offsetX = distance * (1 - unitEased);
        else if (direction === 'right') offsetX = -distance * (1 - unitEased);
        else if (direction === 'up') offsetY = distance * (1 - unitEased);
        else if (direction === 'down') offsetY = -distance * (1 - unitEased);
      } else if (textAnimType.type === 'text-wave') {
        offsetY = Math.sin(i * 0.5 * Math.PI) * distance * (1 - unitEased);
      }

      const unitOpacity = textAnimType.type === 'text-appear' ? unitEased : state.opacity;

      renderer.setOpacity(unitOpacity);

      renderer.drawText(
        unit,
        currentX + offsetX,
        currentY + offsetY,
        state.width,
        state.height,
        {
          fontFamily,
          fontSize,
          fontWeight,
          fontStyle,
          fillColor,
          strokeColor: props.strokeColor,
          strokeWidth: props.strokeWidth,
          shadowColor: props.shadowColor,
          shadowBlur: props.shadowBlur,
          shadowOffsetX: props.shadowX,
          shadowOffsetY: props.shadowY,
        },
        context
      );

      // Update position for next unit
      if (split === 'letter') {
        currentX += renderer.ctx.measureText(unit).width;
        if (unit === ' ' || currentX > state.x + state.width - fontSize) {
          currentX = state.x;
          currentY += lineHeight;
        }
      } else if (split === 'word') {
        currentX += renderer.ctx.measureText(unit + ' ').width;
        if (currentX > state.x + state.width - fontSize) {
          currentX = state.x;
          currentY += lineHeight;
        }
      } else {
        currentY += lineHeight;
      }
    }

    renderer.resetOpacity();
  }

  /**
   * Render text with character/word/line animation (legacy method).
   */
  static renderAnimated(
    renderer: any,
    element: ElementBase<any>,
    state: {
      x: number;
      y: number;
      width: number;
      height: number;
      opacity: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    },
    context: { time: number; width: number; height: number },
    animationProps: {
      split: 'letter' | 'word' | 'line';
      progress: number;
      easing: string;
      direction: string;
      distance: number;
    }
  ): void {
    const props = element.properties as any;
    const text = props.text ?? '';
    const fontSize = typeof props.fontSize === 'number' ? props.fontSize : 48;
    const fontFamily = props.fontFamily || 'Arial';
    const fontWeight = props.fontWeight || 400;
    const fontStyle = props.fontStyle || 'normal';
    const fillColor = props.fillColor || '#000000';

    const { split, progress, easing, direction, distance } = animationProps;

    // Split text into units based on split mode
    let units: string[] = [];
    if (split === 'letter') {
      units = this.splitIntoLetters(text);
    } else if (split === 'word') {
      units = this.splitIntoWords(text);
    } else {
      units = this.splitIntoLines(text);
    }

    const totalUnits = units.length;
    const easedProgress = getEasingFunction(easing as any)(progress);

    // Calculate how many units to show
    let visibleCount: number;
    if (split === 'letter') {
      visibleCount = Math.floor(easedProgress * totalUnits);
    } else if (split === 'word') {
      visibleCount = Math.floor(easedProgress * totalUnits);
    } else {
      visibleCount = Math.floor(easedProgress * totalUnits);
    }

    // Render visible units
    let currentX = state.x;
    let currentY = state.y;
    const lineHeight = fontSize * 1.2;

    for (let i = 0; i < visibleCount; i++) {
      const unit = units[i];
      const unitDelay = i / totalUnits;
      const unitProgress = Math.max(0, Math.min(1, (easedProgress - unitDelay) * totalUnits));
      const unitEased = getEasingFunction(easing as any)(unitProgress);

      // Calculate offset based on direction
      let offsetX = 0, offsetY = 0;
      if (direction === 'left') offsetX = distance * (1 - unitEased);
      else if (direction === 'right') offsetX = -distance * (1 - unitEased);
      else if (direction === 'up') offsetY = distance * (1 - unitEased);
      else if (direction === 'down') offsetY = -distance * (1 - unitEased);

      renderer.setOpacity(state.opacity * unitEased);

      renderer.drawText(
        unit,
        currentX + offsetX,
        currentY + offsetY,
        state.width,
        state.height,
        {
          fontFamily,
          fontSize,
          fontWeight,
          fontStyle,
          fillColor,
          strokeColor: props.strokeColor,
          strokeWidth: props.strokeWidth,
          shadowColor: props.shadowColor,
          shadowBlur: props.shadowBlur,
          shadowOffsetX: props.shadowX,
          shadowOffsetY: props.shadowY,
        },
        context
      );

      // Update position
      if (split === 'letter') {
        currentX += renderer.ctx.measureText(unit).width;
        if (unit === ' ' || currentX > state.x + state.width) {
          currentX = state.x;
          currentY += lineHeight;
        }
      } else if (split === 'word') {
        currentX += renderer.ctx.measureText(unit + ' ').width;
        if (currentX > state.x + state.width) {
          currentX = state.x;
          currentY += lineHeight;
        }
      } else {
        currentY += lineHeight;
      }
    }

    renderer.resetOpacity();
  }

  /**
   * Split text into individual letters.
   */
  private static splitIntoLetters(text: string): string[] {
    const result: string[] = [];
    for (const char of text) {
      result.push(char);
    }
    return result;
  }

  /**
   * Split text into words.
   */
  private static splitIntoWords(text: string): string[] {
    return text.split(/\s+/).filter(w => w.length > 0);
  }

  /**
   * Split text into lines.
   */
  private static splitIntoLines(text: string): string[] {
    return text.split('\n');
  }
}
