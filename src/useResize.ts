import type { IBaseDef, Layout } from "@boardmeister/antetype-core"
import { Event as CoreEvent } from "@boardmeister/antetype-core"
import type { IWorkspace } from "@boardmeister/antetype-workspace"
import type { SaveEvent, IMementoState } from "@boardmeister/antetype-memento"
import { Event, ICursorParams, ICursorSettings } from "@src/index";
import { ISelectionDef, selectionType } from "@src/module";
import { DownEvent, IEvent, MoveEvent, SlipEvent, UpEvent } from "@src/useDetect";
import { calc, isNotEditable, setNewPositionOnOriginal } from "@src/shared";
import { getLayerFromSelection } from "@src/useSelection";
import { Event as MementoEvent } from "@boardmeister/antetype-memento"

interface IResizeSaveData {
  x: number;
  y: number;
  w: number;
  h: number;
  after: {
    x: number;
    y: number;
    w: number;
    h: number;
  }
}

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
    herald,
    canvas,
    modules,
  }: ICursorParams,
  showSelected: VoidFunction,
  settings: ICursorSettings,
): void {
  let mode = ResizeMode.NONE,
    disableResize = false,
    resizeInProgress = false,
    saved = false
  ;
  const eventSnapshot: IEventSnapshot = {
    waiting: false,
    layout: null,
    movement: null,
  };
  const isDisabled = (): boolean => settings.resize?.disabled ?? false;
  const determinateCursorType = (layer: ISelectionDef|null, target: IEvent): string => {
    if (!layer || layer.selection.layer.hierarchy?.parent !== modules.core.meta.document) {
      mode = ResizeMode.NONE;
      return 'default';
    }

    const { start: { x: sX, y: sY }, size: { h, w } } = layer;
    const { x, y } = target.hover;
    // Buffer bottom doesn't matter as we don't detect that cursor is near layer, we detect when he enters it
    const bufferTop = calc(herald, { bufferTop: settings.resize?.buffer ?? 10 }).bufferTop,
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
    // Specific cases when layers don't support `size` - like polygons
    if (layer) {
      layer = getLayerFromSelection(modules.core.clone.getClone(layer));
      const original = modules.core.clone.getOriginal(layer);
      if (!original?.size) {
        return;
      }
    }

    canvasCursorTypeChange(e);
    resizeSelected(e);
  }

  const resizeSelected = (e: CustomEvent<MoveEvent>): void => {
    const { target } = e.detail;
    const layers = target.selected.keys();
    if (0 === layers.length || ResizeMode.NONE === mode || !target.isDown) {
      return;
    }

    let { hover: { mX: x, mY: y } } = target;
    if (mode === ResizeMode.LEFT || mode === ResizeMode.RIGHT ) y = 0;
    if (mode === ResizeMode.TOP  || mode === ResizeMode.BOTTOM) x = 0;

    /** @TODO move to event, so we can decouple workspace from cursor */
    const scale = modules.workspace ? (modules.workspace as IWorkspace).getScale() : 1;
    x /= scale;
    y /= scale;

    if (resizeInProgress) {
      eventSnapshot.waiting = true;
      eventSnapshot.movement = { x, y };
      eventSnapshot.layout = layers;
      return;
    }

    saveResize(layers);
    bulkResize(layers, x, y);
  }

  const bulkResize = (layout: Layout, x: number, y: number): void => {
    for (const layer of layout) {
      resize(layer, x, y);
    }
  }

  const resize = (original: IBaseDef, x: number, y: number): void => {
    const layer = modules.core.clone.getClone(original);
    // @TODO at some point figure out how to apply group scoped sizes and allow resizing nested
    //    elements
    if (layer.hierarchy?.parent !== modules.core.meta.document) {
      return;
    }

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

  const saveResize = (layers: Layout): void => {
    if (saved) {
      return;
    }
    saved = true;
    const state: IMementoState<IResizeSaveData>[] = [];
    layers.forEach(original => {
      const layer = modules.core.clone.getClone(original);
      state.push({
        origin: 'cursor.move',
        layer: original,
        data: {
          x: layer.start.x,
          y: layer.start.y,
          w: layer.size.w,
          h: layer.size.h,
          after: {
            w: 0,
            h: 0,
            x: 0,
            y: 0,
          }
        },
        undo: async (original: IBaseDef, data: IResizeSaveData): Promise<void> => {
          const clone = modules.core.clone.getClone(original);
          data.after.x = clone.start.x;
          data.after.y = clone.start.y;
          setNewPositionOnOriginal(modules, original, data.x - clone.start.x, data.y - clone.start.y);
          data.after.w = clone.size.w;
          data.after.h = clone.size.h;
          await changeLayerSize(original, data.w - clone.size.w, data.h - clone.size.h);
        },
        redo: async (original: IBaseDef, data: IResizeSaveData): Promise<void> => {
          setNewPositionOnOriginal(modules, original, data.after.x - data.x, data.after.y - data.y);
          await changeLayerSize(original, data.after.w - data.w, data.after.h - data.h);
        },
      });
    });

    if (state.length > 0) {
      void herald.dispatch(new CustomEvent<SaveEvent<IResizeSaveData>>(MementoEvent.SAVE, { detail: { state } }));
    }
  }

  const changeLayerSize = async (original: IBaseDef, x: number, y: number): Promise<void> => {
    // @TODO similar case like in src/shared.tsx:90
    if (!original.size) {
      return;
    }
    const layer = modules.core.clone.getClone(original);

    if (layer.area) {
      if (!isNotEditable(layer.area.size.w)) layer.area.size.w += x;
      if (!isNotEditable(layer.area.size.h)) layer.area.size.h += y;
    }

    original = modules.core.clone.getOriginal(layer);
    if (modules.workspace) {
      const workspace = modules.workspace as IWorkspace;
      original.size.w = workspace.toRelative(layer.area!.size.w) as any;
      original.size.h = workspace.toRelative(layer.area!.size.h, 'y') as any;
    } else {
      const area = layer.area?.size ?? layer.size;
      original.size.w = area.w + x;
      original.size.h = area.h + y;
    }

    resizeInProgress = true;
    await modules.core.view.resize(original, original.size);
    showSelected();
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
    const { target } = e.detail;
    const layer = target?.hover?.layer;
    if (layer?.type === selectionType) {
      canvas!.style.cursor = determinateCursorType(layer as ISelectionDef, target);
    } else {
      resetMode();
    }

    if (mode === ResizeMode.NONE) {
      disableResize = true;
      return;
    }
    e.preventDefault();
  }

  const handleUpAfterResize = (e: CustomEvent<UpEvent>): void => {
    saved = false;
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

  const unregister = herald.batch([
    {
      event: Event.MOVE,
      subscription: {
        method: e => {
          if (isDisabled()) {
            return;
          }
          handleMove(e as CustomEvent<MoveEvent>);
        },
        priority: -10,
      },
    },
    {
      event: Event.SLIP,
      subscription: {
        method: e => {
          if (isDisabled()) {
            return;
          }
          revertCursorToDefault(e as CustomEvent<SlipEvent>);
        },
      },
    },
    {
      event: Event.DOWN,
      subscription: {
        method: e => {
          if (isDisabled()) {
            return;
          }
          handleDown(e as CustomEvent<DownEvent>);
        },
        priority: -10,
      },
    },
    {
      event: Event.UP,
      subscription: {
        method: e => {
          if (isDisabled()) {
            return;
          }
          handleUpAfterResize(e as CustomEvent<UpEvent>);
        },
        priority: -10,
      },
    },
    {
      event: CoreEvent.CLOSE,
      subscription: {
        method: () => { unregister() },
      },
    }
  ]);
}
