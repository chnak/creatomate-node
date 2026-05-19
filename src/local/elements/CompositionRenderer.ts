import { ElementBase } from '../../elements/ElementBase';

/**
 * Composition element renderer for nested elements.
 */
export class CompositionRenderer {
  /**
   * Render composition element.
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
      skewX: number;
      skewY: number;
      clip?: boolean;
      rotationX?: number;
      rotationY?: number;
    },
    context: { time: number; width: number; height: number },
    renderChild: (element: ElementBase<any>, state: any, context: any) => Promise<void>
  ): Promise<void> {
    const props = element.properties as any;
    const blendMode = props.blendMode;
    const colorFilter = props.colorFilter;
    const colorFilterValue = props.colorFilterValue;

    // Apply blend mode if specified
    if (blendMode && blendMode !== 'none') {
      renderer.setBlendMode(blendMode);
    }

    const ctx = renderer.ctx;

    // Save context and apply composition transforms
    ctx.save();

    // Apply composition transform (center-based)
    const centerX = state.x + state.width / 2;
    const centerY = state.y + state.height / 2;
    ctx.translate(centerX, centerY);

    // Apply skew
    if (state.skewX !== 0 || state.skewY !== 0) {
      ctx.transform(1, Math.tan(state.skewY), Math.tan(state.skewX), 1, 0, 0);
    }

    // Apply 3D rotations (simulated with scale for 2D canvas)
    const rotX = state.rotationX ?? 0;
    const rotY = state.rotationY ?? 0;
    const hasRotationX = Math.abs(rotX) > 0.01;
    const hasRotationY = Math.abs(rotY) > 0.01;
    if (hasRotationX || hasRotationY) {
      if (hasRotationX) {
        ctx.scale(1, Math.cos(rotX));
      }
      if (hasRotationY) {
        ctx.scale(Math.cos(rotY), 1);
      }
    }

    // Apply scale
    if (state.scaleX !== 1 || state.scaleY !== 1) {
      ctx.scale(state.scaleX, state.scaleY);
    }

    // Apply rotation
    if (state.rotation !== 0) {
      ctx.rotate(state.rotation);
    }

    ctx.translate(-state.width / 2, -state.height / 2);

    // Apply color filter
    if (colorFilter && colorFilter !== 'none') {
      renderer.applyColorFilter(colorFilter, colorFilterValue);
    }

    // Render background fill if specified
    const fillColor = props.fillColor;
    if (fillColor) {
      renderer.setOpacity(state.opacity);
      renderer.drawRectangle(
        0,
        0,
        state.width,
        state.height,
        fillColor,
        undefined,
        0,
        0,
        context
      );
      renderer.resetOpacity();
    }

    // Apply clip to child elements
    if (state.clip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, state.width, state.height);
      ctx.clip();
    }

    // Render child elements - they are positioned relative to composition origin
    const children = props.elements || [];
    for (const child of children) {
      if (child instanceof ElementBase) {
        // Pass composition dimensions so children can align relative to composition bounds
        const childStateWithCompositionBounds = {
          ...state,
          compositionWidth: state.width,
          compositionHeight: state.height,
        };
        await renderChild(child, childStateWithCompositionBounds, context);
      }
    }

    if (state.clip) {
      ctx.restore();
    }

    ctx.restore();

    // Reset blend mode
    if (blendMode && blendMode !== 'none') {
      renderer.resetBlendMode();
    }

    // Reset color filter
    if (colorFilter && colorFilter !== 'none') {
      renderer.resetColorFilter();
    }
  }

  /**
   * Flatten composition elements recursively.
   */
  static flattenElements(elements: Array<ElementBase<any> | Record<string, any>>): ElementBase<any>[] {
    const result: ElementBase<any>[] = [];

    for (const element of elements) {
      if (element instanceof ElementBase) {
        result.push(element);

        if ((element as any).type === 'composition' && (element.properties as any).elements) {
          result.push(...this.flattenElements((element.properties as any).elements));
        }
      }
    }

    return result;
  }
}