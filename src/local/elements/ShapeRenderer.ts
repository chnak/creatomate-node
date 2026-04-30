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
    },
    context: { time: number; width: number; height: number }
  ): void {
    const props = element.properties as any;
    const fillColor = props.fillColor;
    const strokeColor = props.strokeColor;
    const strokeWidth = props.strokeWidth ?? 0;
    const borderRadius = props.borderRadius ?? 0;

    renderer.setOpacity(state.opacity);

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

    renderer.resetOpacity();
  }
}