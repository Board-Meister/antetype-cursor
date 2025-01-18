import type { IBaseDef, Layout } from "@boardmeister/antetype-core"
import type { IWorkspace } from "@boardmeister/antetype-workspace"
import { Event, ICursorParams } from "@src/index";
import { ISelectionDef, selectionType } from "@src/module";
import { DownEvent, IEvent, MoveEvent, SlipEvent, UpEvent } from "@src/useDetect";
import { isEditable, setNewPositionOnOriginal } from "@src/shared";
import { getLayerFromSelection } from "@src/useSelection";

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

interface IMovement {
  x: number;
  y: number;
}

interface IEventSnapshot {
  waiting: boolean;
  layout: Layout|null;
  movement: IMovement|null;
}

export default function useResize(
  {
    injected: { herald },
    canvas,
    modules,
  }: ICursorParams,
): void {
  let mode = ResizeMode.NONE,
    disableResize = false,
    resizeInProgress = false
  ;
  const eventSnapshot: IEventSnapshot = {
    waiting: false,
    layout: null,
    movement: null,
  };
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

    let { target: { hover: { layer } } } = e.detail;
    if (layer) {
      layer = getLayerFromSelection(layer);
      const original = modules.core.clone.getOriginal(layer);
      if (!original?.size) {
        return;
      }
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

    if (resizeInProgress) {
      eventSnapshot.waiting = true;
      eventSnapshot.movement = { x, y };
      eventSnapshot.layout = layers;
      return;
    }

    bulkResize(layers, x, y);
  }

  const bulkResize = (layout: Layout, x: number, y: number): void => {
    for (const layer of layout) {
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

    void changeLayerSize(layer, x, y)
  }

  const changeLayerSize = async (layer: IBaseDef, x: number, y: number): Promise<void> => {
    // @TODO similar case like in src/shared.tsx:90
    if (!layer.size) {
      return;
    }

    if (layer.area) {
      if (!isEditable(layer.area.size.w)) layer.area.size.w += x;
      if (!isEditable(layer.area.size.h)) layer.area.size.h += y;
    }

    const original = modules.core.clone.getOriginal(layer);
    if (modules.workspace) {
      const workspace = modules.workspace as IWorkspace;
      if (!isEditable(original.size.w)) original.size.w = workspace.toRelative(layer.area!.size.w) as any;
      if (!isEditable(original.size.h)) original.size.h = workspace.toRelative(layer.area!.size.h, 'y') as any;
    } else {
      const area = layer.area?.size ?? layer.size;
      if (!isEditable(original.size?.w)) original.size.w = area.w + x;
      if (!isEditable(original.size?.h)) original.size.h = area.h + y;
    }

    resizeInProgress = true;
    await modules.core.manage.resize(original, layer, original.size);
    modules.core.view.redraw();
    resizeInProgress = false;
    if (eventSnapshot.waiting) {
      const { layout, movement } = eventSnapshot;
      const { x, y } = movement!;
      resetEventSnapshot();
      bulkResize(layout!, x, y)
    }
  }

  const resetEventSnapshot = (): void => {
    eventSnapshot.waiting = false;
    eventSnapshot.movement = null;
    eventSnapshot.layout = null;
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
