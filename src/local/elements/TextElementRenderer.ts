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
    renderer.drawText(
      text,
      state.x,
      state.y,
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
    renderer.resetOpacity();
  }
}