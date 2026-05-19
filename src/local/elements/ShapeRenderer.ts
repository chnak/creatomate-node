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

    // Apply blend mode if specified
    if (blendMode && blendMode !== 'none') {
      renderer.setBlendMode(blendMode);
    }

    const ctx = renderer.ctx;
    const centerX = state.x + state.width / 2;
    const centerY = state.y + state.height / 2;

    ctx.save();
    ctx.translate(centerX, centerY);

    // Apply skew transformation
    if (state.skewX !== 0 || state.skewY !== 0) {
      ctx.transform(1, Math.tan(state.skewY), Math.tan(state.skewX), 1, 0, 0);
    }

    // Apply 3D rotations (simulated with scale/rotate for 2D canvas)
    const rotX = state.rotationX ?? 0;
    const rotY = state.rotationY ?? 0;
    const hasRotationX = Math.abs(rotX) > 0.01;
    const hasRotationY = Math.abs(rotY) > 0.01;
    if (hasRotationX || hasRotationY) {
      // Simulate 3D flip using scale
      if (hasRotationX) {
        const cosX = Math.cos(rotX);
        ctx.scale(1, cosX);
      }
      if (hasRotationY) {
        const cosY = Math.cos(rotY);
        ctx.scale(cosY, 1);
      }
    }

    if (state.scaleX !== 1 || state.scaleY !== 1) {
      ctx.scale(state.scaleX, state.scaleY);
    }

    if (state.rotation !== 0) {
      ctx.rotate(state.rotation);
    }

    ctx.translate(-state.width / 2, -state.height / 2);

    // Apply color filter before drawing
    if (colorFilter && colorFilter !== 'none') {
      renderer.applyColorFilter(colorFilter, colorFilterValue);
    }

    // Apply clip if needed
    if (state.clip) {
      ctx.beginPath();
      if ((element as any).type === 'ellipse') {
        ctx.ellipse(state.width / 2, state.height / 2, state.width / 2, state.height / 2, 0, 0, Math.PI * 2);
      } else if (borderRadius > 0) {
        // Rounded rectangle clip
        const r = Math.min(borderRadius, state.width / 2, state.height / 2);
        ctx.moveTo(r, 0);
        ctx.lineTo(state.width - r, 0);
        ctx.arcTo(state.width, 0, state.width, r, r);
        ctx.lineTo(state.width, state.height - r);
        ctx.arcTo(state.width, state.height, state.width - r, state.height, r);
        ctx.lineTo(r, state.height);
        ctx.arcTo(0, state.height, 0, state.height - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
        ctx.closePath();
      } else {
        ctx.rect(0, 0, state.width, state.height);
      }
      ctx.clip();
    }

    if ((element as any).type === 'ellipse') {
      renderer.drawEllipse(
        0,
        0,
        state.width,
        state.height,
        fillColor,
        strokeColor,
        strokeWidth,
        context
      );
    } else {
      renderer.drawRectangle(
        0,
        0,
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