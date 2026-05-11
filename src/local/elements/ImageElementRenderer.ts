import { ElementBase } from '../../elements/ElementBase';

/**
 * Image element renderer.
 */
export class ImageElementRenderer {
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
}