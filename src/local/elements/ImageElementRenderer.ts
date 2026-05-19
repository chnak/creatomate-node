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
      blendMode: string;
      rotation: number;
      scaleX: number;
      scaleY: number;
      blurRadius: number;
      clip: boolean;
    },
    context: { time: number; width: number; height: number }
  ): Promise<void> {
    const props = element.properties as any;
    const source = props.source;
    const colorOverlay = props.colorOverlay;

    if (!source) return;

    // Download media to local cache if needed
    const localPath = await this.downloader.getLocalPath(source);

    renderer.setOpacity(state.opacity);
    renderer.setBlendMode(state.blendMode);
    if (state.blurRadius > 0) {
      renderer.setBlurRadius(state.blurRadius);
    }

    // Apply clipping before drawing
    if (state.clip) {
      renderer.beginClip(state.x, state.y, state.width, state.height);
    }

    // Apply rotation and scale around element center
    const centerX = state.x + state.width / 2;
    const centerY = state.y + state.height / 2;
    if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
      renderer.applyTransforms(state.rotation, state.scaleX, state.scaleY, centerX, centerY);
    }

    await renderer.drawImage(source, state.x, state.y, state.width, state.height, context);

    // Apply color overlay after drawing the image
    if (colorOverlay) {
      renderer.setColorOverlay(colorOverlay, state.x, state.y, state.width, state.height);
    }

    if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
      renderer.resetTransform();
    }
    if (state.clip) {
      renderer.endClip();
    }
    if (state.blurRadius > 0) {
      renderer.resetBlur();
    }
    renderer.resetBlendMode();
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