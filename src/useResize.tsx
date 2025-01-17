import type { IBaseDef } from "@boardmeister/antetype-core"
import type { IWorkspace } from "@boardmeister/antetype-workspace"
import { Event, ICursorParams } from "@src/index";
import { ISelectionDef, selectionType } from "@src/module";
import { DownEvent, IEvent, MoveEvent, SlipEvent, UpEvent } from "@src/useDetect";
import { setNewPositionOnOriginal } from "@src/shared";

enum ResizeMode {
  TOP,
  BOTTOM,
  RIGHT,
  LEFT,
  TOP_RIGHT,
  BOTTOM_RIGHT,
  TOP_LEFT,
  BOTTOM_LEFT,
  NONE,
}

export default function useResize(
  {
    injected: { herald },
    canvas,
    modules,
  }: ICursorParams,
): void {
  let mode = ResizeMode.NONE,
    disableResize = false
  ;
  const determinateCursorType = (layer: ISelectionDef, target: IEvent): string => {
    const { start: { x: sX, y: sY }, size: { h, w } } = layer;
    const { x, y } = target.hover;
    const bufferTop = 10,
      // Buffer bottom doesn't matter as we don't detect that cursor is near layer, we detect when he enters it
      bufferBottom = 0
    ;
    const top = y <= sY + bufferTop && y >= sY - bufferBottom,
      right = x <= sX + bufferBottom + w && x >= sX - bufferTop + w,
      bottom = y <= sY + bufferBottom + h && y >= sY - bufferTop + h,
      left = x <= sX + bufferTop && x >= sX - bufferBottom
    ;

    if (top && left || bottom && right) {
      mode = top && left ? ResizeMode.TOP_LEFT : ResizeMode.BOTTOM_RIGHT;
      return 'nwse-resize';
    }

    if (top && right || bottom && left) {
      mode = top && right ? ResizeMode.TOP_RIGHT : ResizeMode.BOTTOM_LEFT;
      return 'nesw-resize';
    }

    if (top || bottom) {
      mode = top ? ResizeMode.TOP : ResizeMode.BOTTOM;
      return 'ns-resize';
    }

    if (left || right) {
      mode = left ? ResizeMode.LEFT : ResizeMode.RIGHT;
      return 'ew-resize';
    }

    resetMode();
    return 'pointer';
  }

  const resetMode = (): void => {
    mode = ResizeMode.NONE;
  }

  const handleMove = (e: CustomEvent<MoveEvent>): void => {
    if (disableResize) {
      return;
    }
    canvasCursorTypeChange(e);
    resizeSelected(e);
  }

  const resizeSelected = (e: CustomEvent<MoveEvent>): void => {
    const { target, origin } = e.detail;
    const layers = target.selected.keys();
    if (0 === layers.length || ResizeMode.NONE === mode || !target.isDown) {
      return;
    }

    let { movementY: y, movementX: x } = origin;

    if (mode === ResizeMode.LEFT || mode === ResizeMode.RIGHT ) y = 0;
    if (mode === ResizeMode.TOP  || mode === ResizeMode.BOTTOM) x = 0;

    for (const layer of layers) {
      resize(layer, x, y);
    }
  }

  const resize = (layer: IBaseDef, x: number, y: number): void => {
    if (mode !== ResizeMode.BOTTOM_RIGHT && mode !== ResizeMode.RIGHT && mode !== ResizeMode.BOTTOM) {
      setNewPositionOnOriginal(
        modules,
        layer,
        mode === ResizeMode.TOP_RIGHT ? 0 : x,
        mode === ResizeMode.BOTTOM_LEFT ? 0 : y,
      );
    }

    if (mode === ResizeMode.TOP || mode === ResizeMode.TOP_LEFT || mode === ResizeMode.TOP_RIGHT) {
      y *= -1;
    }

    if (mode === ResizeMode.LEFT || mode === ResizeMode.TOP_LEFT || mode === ResizeMode.BOTTOM_LEFT) {
      x *= -1;
    }

    changeLayerSize(layer, x, y)
    modules.core.view.redraw();
  }

  const changeLayerSize = (layer: IBaseDef, x: number, y: number): void => {

    // @TODO similar case like in src/shared.tsx:90
    if (layer.area) {
      if (!isNaN(layer.area.size.w)) layer.area.size.w += x;
      if (!isNaN(layer.area.size.h)) layer.area.size.h += y;
    }

    if (layer.start) {
      if (!isNaN(layer.size.w)) layer.size.w += x;
      if (!isNaN(layer.size.h)) layer.size.h += y;
    }

    const original = modules.core.clone.getOriginal(layer);
    if (modules.workspace) {
      const workspace = modules.workspace as IWorkspace;
      if (!isNaN(original.size.w)) original.size.w = workspace.toRelative(layer.area!.size.w) as any;
      if (!isNaN(original.size.h)) original.size.h = workspace.toRelative(layer.area!.size.h, 'y') as any;
      return;
    }

    const area = layer.area?.size ?? layer.size;
    if (!isNaN(original.size.w)) original.size.w = area.w + x;
    if (!isNaN(original.size.h)) original.size.h = area.h + y;
  }

  const canvasCursorTypeChange = (e: CustomEvent<MoveEvent>): void => {
    const { target } = e.detail;

    if (mode !== ResizeMode.NONE) {
      e.preventDefault();
      if (target.isDown) {
        return;
      }
    }

    const layer = target.hover.layer;
    if (layer?.type === selectionType) {
      canvas!.style.cursor = determinateCursorType(layer as ISelectionDef, target);
    } else {
      resetMode();
    }
  }

  const resetCanvasCursor = (): void => {
    canvas!.style.cursor = 'default';
  }

  const revertCursorToDefault = (e: CustomEvent<SlipEvent>): void => {
    const { from, target: { isDown } } = e.detail;
    if (isDown && mode !== ResizeMode.NONE) {
      return;
    }
    resetMode();
    if (from?.type === selectionType) {
      resetCanvasCursor();
    }
  }

  const handleDown = (e: CustomEvent<DownEvent>): void => {
    if (mode === ResizeMode.NONE) {
      disableResize = true;
      return;
    }
    e.preventDefault();
  }

  const handleUpAfterResize = (e: CustomEvent<UpEvent>): void => {
    disableResize = false;
    const { target } = e.detail;
    const layer = target.hover.layer;
    if (mode !== ResizeMode.NONE) {
      e.preventDefault();
    }
    resetMode();
    if (layer?.type === selectionType) {
      canvas!.style.cursor = determinateCursorType(layer as ISelectionDef, target);
    } else {
      resetCanvasCursor();
    }
  }

  herald.register(Event.MOVE, {
    method: handleMove,
    priority: -10,
  });
  herald.register(Event.SLIP, revertCursorToDefault);
  herald.register(Event.DOWN, {
    method: handleDown,
    priority: -10,
  });
  herald.register(Event.UP, {
    method: handleUpAfterResize,
    priority: -10,
  });
}
