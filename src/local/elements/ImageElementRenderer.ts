import { ElementBase } from '../../elements/ElementBase';
import { MediaDownloader } from '../utils/MediaDownloader';

/**
 * Image element renderer.
 */
export class ImageElementRenderer {
  private static downloader = MediaDownloader.getInstance();

  /**
   * Render image element.
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
      skewX: number;
      skewY: number;
      clip?: boolean;
      rotationX?: number;
      rotationY?: number;
    },
    context: { time: number; width: number; height: number }
  ): Promise<void> {
    const props = element.properties as any;
    const source = props.source;
    const blendMode = props.blendMode;
    const colorFilter = props.colorFilter;
    const colorFilterValue = props.colorFilterValue;
    const strokeColor = props.strokeColor;
    const strokeWidth = props.strokeWidth ?? 0;
    const borderRadius = props.borderRadius ?? 0;

    if (!source) return;

    // Download media to local cache if needed
    const localPath = await this.downloader.getLocalPath(source);

    renderer.setOpacity(state.opacity);

    // Apply blend mode if specified
    if (blendMode && blendMode !== 'none') {
      renderer.setBlendMode(blendMode);
    }

    try {
      const { loadImage } = await import('@napi-rs/canvas');
      const img = await loadImage(localPath);

      // Calculate draw area based on fit property
      const { drawX, drawY, drawWidth, drawHeight } = this.calculateFit(
        img.width, img.height,
        state.x, state.y, state.width, state.height,
        props.fit
      );

      // Apply skew transformation
      if (state.skewX !== 0 || state.skewY !== 0) {
        const centerX = state.x + state.width / 2;
        const centerY = state.y + state.height / 2;
        renderer.ctx.translate(centerX, centerY);
        renderer.ctx.transform(1, Math.tan(state.skewY), Math.tan(state.skewX), 1, 0, 0);
        renderer.ctx.translate(-centerX, -centerY);
      }

      // Apply clip if needed
      if (state.clip || borderRadius > 0) {
        renderer.ctx.save();
        renderer.ctx.beginPath();
        if (borderRadius > 0) {
          const r = Math.min(borderRadius, state.width / 2, state.height / 2);
          renderer.ctx.moveTo(drawX + r, drawY);
          renderer.ctx.lineTo(drawX + drawWidth - r, drawY);
          renderer.ctx.arcTo(drawX + drawWidth, drawY, drawX + drawWidth, drawY + r, r);
          renderer.ctx.lineTo(drawX + drawWidth, drawY + drawHeight - r);
          renderer.ctx.arcTo(drawX + drawWidth, drawY + drawHeight, drawX + drawWidth - r, drawY + drawHeight, r);
          renderer.ctx.lineTo(drawX + r, drawY + drawHeight);
          renderer.ctx.arcTo(drawX, drawY + drawHeight, drawX, drawY + drawHeight - r, r);
          renderer.ctx.lineTo(drawX, drawY + r);
          renderer.ctx.arcTo(drawX, drawY, drawX + r, drawY, r);
          renderer.ctx.closePath();
        } else {
          renderer.ctx.rect(state.x, state.y, state.width, state.height);
        }
        renderer.ctx.clip();
      }

      // Apply color filter before drawing
      if (colorFilter && colorFilter !== 'none') {
        renderer.applyColorFilter(colorFilter, colorFilterValue);
      }

      // Apply blur effect before drawing
      if (props.blurRadius && props.blurRadius > 0) {
        const blurAmount = Math.min(props.blurRadius, 100);
        renderer.ctx.filter = `blur(${blurAmount}px)`;
        renderer.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        renderer.ctx.filter = 'none';
      } else if (props.repeat) {
        // Repeat image as pattern to fill bounds
        const pattern = renderer.ctx.createPattern(img, 'repeat');
        if (pattern) {
          renderer.ctx.fillStyle = pattern;
          renderer.ctx.fillRect(state.x, state.y, state.width, state.height);
        }
      } else {
        renderer.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      }

      // Apply color overlay
      if (props.colorOverlay) {
        renderer.ctx.fillStyle = props.colorOverlay;
        renderer.ctx.fillRect(state.x, state.y, state.width, state.height);
      }

      // Apply stroke
      if (strokeColor && strokeWidth > 0) {
        renderer.ctx.strokeStyle = strokeColor;
        renderer.ctx.lineWidth = strokeWidth;
        renderer.ctx.stroke();
      }

      if (state.clip || borderRadius > 0) {
        renderer.ctx.restore();
      }
    } catch (e) {
      console.warn('Failed to load image:', source, e);
    }

    // Reset blend mode
    if (blendMode && blendMode !== 'none') {
      renderer.resetBlendMode();
    }

    // Reset color filter
    if (colorFilter && colorFilter !== 'none') {
      renderer.resetColorFilter();
    }

    renderer.resetOpacity();
  }

  /**
   * Calculate draw position and size based on fit property.
   */
  private static calculateFit(
    srcWidth: number, srcHeight: number,
    destX: number, destY: number, destWidth: number, destHeight: number,
    fit?: string
  ): { drawX: number; drawY: number; drawWidth: number; drawHeight: number } {
    const srcAspect = srcWidth / srcHeight;
    const destAspect = destWidth / destHeight;

    let drawWidth = destWidth;
    let drawHeight = destHeight;
    let drawX = destX;
    let drawY = destY;

    if (fit === 'contain') {
      if (srcAspect > destAspect) {
        drawHeight = destWidth / srcAspect;
        drawY = destY + (destHeight - drawHeight) / 2;
      } else {
        drawWidth = destHeight * srcAspect;
        drawX = destX + (destWidth - drawWidth) / 2;
      }
    } else if (fit === 'cover') {
      if (srcAspect > destAspect) {
        drawWidth = destHeight * srcAspect;
        drawX = destX + (destWidth - drawWidth) / 2;
      } else {
        drawHeight = destWidth / srcAspect;
        drawY = destY + (destHeight - drawHeight) / 2;
      }
    } else if (fit === 'fill') {
      // fill uses the full destination area
    }

    return { drawX, drawY, drawWidth, drawHeight };
  }
}