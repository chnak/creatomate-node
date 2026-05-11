import { ElementBase } from '../../elements/ElementBase';

/**
 * Shape element renderer (Rectangle, Ellipse).
 */
export class ShapeRenderer {
  /**
   * Render shape element.
   */
  static render(
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
  ): void {
    const props = element.properties as any;
    const fillColor = props.fillColor;
    const strokeColor = props.strokeColor;
    const strokeWidth = props.strokeWidth ?? 0;
    const borderRadius = props.borderRadius ?? 0;
    const shadowColor = props.shadowColor;
    const shadowBlur = props.shadowBlur ?? 0;
    const shadowX = props.shadowX ?? 0;
    const shadowY = props.shadowY ?? 0;
    const colorOverlay = props.colorOverlay;

    renderer.setOpacity(state.opacity);
    renderer.setBlendMode(state.blendMode);
    if (state.blurRadius > 0) {
      renderer.setBlurRadius(state.blurRadius);
    }

    // Apply clipping before drawing
    if (state.clip) {
      renderer.beginClip(state.x, state.y, state.width, state.height);
    }

    // Apply shadow if specified
    if (shadowColor && shadowBlur > 0) {
      renderer.setShadow(shadowColor, shadowBlur, shadowX, shadowY);
    }

    // Apply rotation and scale around element center
    const centerX = state.x + state.width / 2;
    const centerY = state.y + state.height / 2;
    if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
      renderer.applyTransforms(state.rotation, state.scaleX, state.scaleY, centerX, centerY);
    }

    if ((element as any).type === 'ellipse') {
      renderer.drawEllipse(
        state.x,
        state.y,
        state.width,
        state.height,
        fillColor,
        strokeColor,
        strokeWidth,
        context
      );
    } else {
      renderer.drawRectangle(
        state.x,
        state.y,
        state.width,
        state.height,
        fillColor,
        strokeColor,
        strokeWidth,
        borderRadius,
        context
      );
    }

    // Apply color overlay after drawing the shape
    if (colorOverlay) {
      renderer.setColorOverlay(colorOverlay, state.x, state.y, state.width, state.height);
    }

    if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
      renderer.resetTransform();
    }
    if (shadowColor && shadowBlur > 0) {
      renderer.resetShadow();
    }
    if (state.blurRadius > 0) {
      renderer.resetBlur();
    }
    if (state.clip) {
      renderer.endClip();
    }
    renderer.resetBlendMode();
    renderer.resetOpacity();
  }
}