import { ElementBase } from '../../elements/ElementBase';

/**
 * Text element renderer.
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
      blendMode: string;
      rotation: number;
      scaleX: number;
      scaleY: number;
      compositionWidth?: number;
      compositionHeight?: number;
    },
    context: { time: number; width: number; height: number }
  ): Promise<void> {
    const props = element.properties as any;
    const text = props.text ?? '';
    const fontSize = typeof props.fontSize === 'number' ? props.fontSize : 48;
    const fontFamily = props.fontFamily || 'Arial';
    const fontWeight = props.fontWeight || 400;
    const fontStyle = props.fontStyle || 'normal';
    const fillColor = props.fillColor || '#000000';

    renderer.setOpacity(state.opacity);
    renderer.setBlendMode(state.blendMode);

    // Apply rotation and scale around element center
    const centerX = state.x + state.width / 2;
    const centerY = state.y + state.height / 2;
    if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
      renderer.applyTransforms(state.rotation, state.scaleX, state.scaleY, centerX, centerY);
    }

    // Determine effective bounds for alignment - use composition dimensions if available
    const effectiveWidth = state.compositionWidth || state.width;
    const effectiveHeight = state.compositionHeight || state.height;

    renderer.drawText(
      text,
      state.x,
      state.y,
      effectiveWidth,
      effectiveHeight,
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
        xAlignment: props.xAlignment,
        yAlignment: props.yAlignment,
      },
      context
    );

    if (state.rotation !== 0 || state.scaleX !== 1 || state.scaleY !== 1) {
      renderer.resetTransform();
    }
    renderer.resetBlendMode();
    renderer.resetOpacity();
  }
}