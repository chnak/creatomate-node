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
    },
    context: { time: number; width: number; height: number }
  ): Promise<void> {
    const props = element.properties as any;
    const source = props.source;

    if (!source) return;

    renderer.setOpacity(state.opacity);
    await renderer.drawImage(source, state.x, state.y, state.width, state.height, context);
    renderer.resetOpacity();
  }
}