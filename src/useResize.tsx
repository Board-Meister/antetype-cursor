import { Event, ICursorParams } from "@src/index";
import { ISelectionDef, selectionType } from "@src/module";
import { IEvent, MoveEvent, SlipEvent } from "@src/useDetect";

export default function useResize(
  {
    injected: { herald },
    canvas,
  }: ICursorParams,
): void {
  const determinateCursorType = (layer: ISelectionDef, target: IEvent): string => {
    const { start: { x: sX, y: sY }, size: { h, w } } = layer;
    const { x, y } = target.hover;
    const bufferTop = 5,
      bufferBottom = 15;
    const top = y <= sY + bufferTop && y >= sY - bufferBottom,
      right = x <= sX + bufferBottom + w && x >= sX - bufferTop + w,
      bottom = y <= sY + bufferBottom + h && y >= sY - bufferTop + h,
      left = x <= sX + bufferTop && x >= sX - bufferBottom
    ;

    if (top && left || bottom && right) {
      return 'nwse-resize';
    }

    if (top && right || bottom && left) {
      return 'nesw-resize';
    }

    if (top || bottom) {
      return 'ns-resize';
    }

    if (left || right) {
      return 'ew-resize';
    }

    return 'pointer';
  }

  const canvasCursorTypeChange = (e: CustomEvent<MoveEvent>): void => {
    const { target } = e.detail;
    const layer = target.hover.layer;
    if (layer?.type === selectionType) {
      const cursor = determinateCursorType(layer as ISelectionDef, target);;
      canvas!.style.cursor = cursor;
    }
  }

  const revertCursorToDefault = (e: CustomEvent<SlipEvent>): void => {
    const { from } = e.detail;
    if (from?.type === selectionType) {
      canvas!.style.cursor = 'default';
    }
  }

  herald.register(Event.MOVE, canvasCursorTypeChange);
  herald.register(Event.SLIP, revertCursorToDefault);
}
