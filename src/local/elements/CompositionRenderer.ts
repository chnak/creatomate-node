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
    },
    context: { time: number; width: number; height: number },
    renderChild: (element: ElementBase<any>, state: any, context: any) => Promise<void>
  ): Promise<void> {
    const props = element.properties as any;

    // Render background fill if specified
    const fillColor = props.fillColor;
    if (fillColor) {
      renderer.setOpacity(state.opacity);
      renderer.drawRectangle(
        state.x,
        state.y,
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

    // Render child elements
    const children = props.elements || [];
    for (const child of children) {
      if (child instanceof ElementBase) {
        await renderChild(child, state, context);
      }
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