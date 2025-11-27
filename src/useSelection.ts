import type { Canvas, IBaseDef } from "@boardmeister/antetype-core"
import type { SaveEvent, IMementoState } from "@boardmeister/antetype-memento"
import { Event as MementoEvent } from "@boardmeister/antetype-memento"
import type { IEventRegistration } from "@boardmeister/herald";
import IterableWeakMap, { IIterableWeakMap } from "@src/IterableWeakMap";
import type { DispatchHelper } from "@src/module";
import { getSizeAndStart, setNewPositionOnOriginal } from "@src/shared";
import type {
  ISelectionDef, ICursorParams, ICursorSettings, MoveEvent, UpEvent, BaseEvent
} from "@src/type.d";
import { Event, selectionType } from "@src/type.d";

export interface ISelection {
  selected: IIterableWeakMap<IBaseDef, true>;
  showSelected: () => void;
  isSelected: (needle: IBaseDef) => IBaseDef|false;
  resetSeeThroughStackMap: VoidFunction;
  selection: ISelectionInfo;
  events: (anchor: Canvas|null) => IEventRegistration[]
}

export interface ISelectionInfo {
  layers: ISelectionDef[];
}

export type Selected = IIterableWeakMap<IBaseDef, true>;

export function getLayerFromSelection(layer: IBaseDef): IBaseDef {
  if (layer.type === selectionType) {
    return (layer as ISelectionDef).selection.layer;
  }

  return layer;
}

export interface IMoveSaveData {
  x: number;
  y: number;
  after: {
    x: number;
    y: number;
  }
}

export default function useSelection(
  {
    modules,
  }: ICursorParams,
  settings: ICursorSettings,
  dispatchHelper: DispatchHelper,
): ISelection {
  const selected = IterableWeakMap<IBaseDef, true>();
  const selection: ISelectionInfo = {
    layers: [],
  };
  let canMove = false;
  let skipUp = false;
  let skipMove = false;
  let accumulatedMoveX = 0;
  let accumulatedMoveY = 0;
  let seeThroughStackMap = IterableWeakMap<IBaseDef, true>();
  const core = modules.core;
  const innerSettings = {
    moveBuffer: 5,
  }

  const isDisabled = (): boolean => settings.select?.disabled ?? false;

  const resetSelected = (): void => {
    while (!selected.empty()) {
      selected.delete(selected.firstKey()!);
    }
    // @TODO add event when selection was cleared
  }

  const resetSeeThroughStackMap = (): void => {
    seeThroughStackMap = IterableWeakMap<IBaseDef, true>();
  }

  const isSelected = (needle: IBaseDef): IBaseDef|false => {
    const original = core.clone.getOriginal(needle);
    if (selected.has(original)) {
      return original;
    }

    return false;
  }

  const isAnySelected = (needles: IBaseDef[]): IBaseDef|false => {
    for (const needle of needles) {
      const original = core.clone.getOriginal(needle);
      if (selected.has(original)) {
        return original;
      }
    }

    return false;
  }

  const saveSelectedPosition = (): void => {
    const layers = selected.keys();
    const state: IMementoState<IMoveSaveData>[] = [];
    layers.forEach(original => {
      const layer = modules.core.clone.getClone(original);
      state.push({
        origin: 'cursor.move',
        layer: original,
        data: {
          x: layer.area!.start.x,
          y: layer.area!.start.y,
          after: {
            x: 0,
            y: 0,
          }
        },
        undo: (original: IBaseDef, data: IMoveSaveData) => {
          const clone = modules.core.clone.getClone(original);
          data.after.x = clone.area!.start.x;
          data.after.y = clone.area!.start.y;
          setNewPositionOnOriginal(modules, original, data.x - clone.area!.start.x, data.y - clone.area!.start.y);
        },
        redo: (original: IBaseDef, data: IMoveSaveData) => {
          setNewPositionOnOriginal(modules, original, data.after.x - data.x, data.after.y - data.y);
        },
      });
    });

    if (state.length > 0) {
      void dispatchHelper.dispatch(new CustomEvent<SaveEvent<IMoveSaveData>>(
        MementoEvent.SAVE,
        {  detail: { state } },
      ));
    }
  }

  /**
   * This query is quite mischievous aka bad. It doesn't only return but also changes, so it will give different
   * results when called two times.
   */
  const shouldSkipMove = (e: CustomEvent<MoveEvent>): boolean => {
    if (!skipMove) {
      return false;
    }

    const { origin: { movementX, movementY }, } = e.detail;
    accumulatedMoveX += movementX;
    accumulatedMoveY += movementY;
    if (
      Math.abs(accumulatedMoveX) > innerSettings.moveBuffer
      || Math.abs(accumulatedMoveY) > innerSettings.moveBuffer
    ) {
      skipMove = false;
      return false;
    }

    return true;
  }

  // @TODO probably should be in different useCase - useMove
  const startSelectionMove = (e: CustomEvent<MoveEvent>): void => {
    if (e.defaultPrevented || !canMove || shouldSkipMove(e)) {
      return;
    }

    const isFirstMotionAfterDown = !skipUp;

    skipUp = true;
    const { target: { down, hover: { mY, mX, layer } } } = e.detail;
    if (0 === down.layers.length) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
        showSelected();
      }
      return;
    }

    const selectedLayer = layer && isAnySelected([layer]);

    if (!selectedLayer && !down.shiftKey && !down.ctrlKey) {
      resetSelected();
    }
    const newSelectedLayer = core.clone.getOriginal(down.layers[0]);
    selected.set(newSelectedLayer, true);

    if (isFirstMotionAfterDown) {
      saveSelectedPosition();
    }

    selected.keys().forEach(layer => {
      // @TODO figure out a way to set group scoped sizes when moving nested layers
      if (layer.hierarchy?.parent !== modules.core.meta.document) {
        return;
      }
      /** @TODO move to event, so we can decouple workspace from cursor */
      const scale = modules.workspace ? (modules.workspace).getScale() : 1;
      // @TODO add event when layer was moved
      setNewPositionOnOriginal(modules, layer, mX/scale, mY/scale);
    });

    showSelected();
  }

  const selectionMouseUp = (event: CustomEvent<UpEvent>): void => {
    if (event.defaultPrevented || event.detail.origin.button !== 0) {
      return;
    }
    accumulatedMoveX = 0;
    accumulatedMoveY = 0;
    skipMove = true;
    canMove = false;
    if (skipUp) {
      skipUp = false;
      return;
    }
    const { target: { down } }  = event.detail;
    const { shiftKey, ctrlKey } = down;
    if (!shiftKey && !ctrlKey) {
      resetSelected();
    }

    let isFirst = true;
    let wasSelected = false;
    for (const layer of down.layers) {
      const origin = modules.core.clone.getOriginal(layer);
      if (selected.has(origin) && ctrlKey) {
        selected.delete(origin);
        break;
      }

      if (!seeThroughStackMap.has(origin)) {
        selected.set(origin, true);
        wasSelected = true;
        if (isFirst) {
          resetSeeThroughStackMap();
        }
        seeThroughStackMap.set(origin, true);
        break;
      }
      isFirst = false;
    }

    if (!wasSelected) {
      seeThroughStackMap = IterableWeakMap<IBaseDef, true>();
    }
    // @TODO add event selected has ended

    showSelected();
  }

  const showSelected = (): void => {
    for (const layer of selection.layers) {
      core.manage.removeVolatile(layer);
    }
    selection.layers = [];

    for (const layer of selected.keys()) {
      const { size, start } = getSizeAndStart(core.clone.getClone(layer));
      const selectionLayer = {
        type: selectionType,
        size,
        start,
        selection: {
          layer,
        }
      } as ISelectionDef;
      selection.layers.push(selectionLayer);
      core.manage.addVolatile(selectionLayer);
    }
    // @TODO event when selection has been added
    core.view.redraw();
    // @TODO event when selection is visible
  }

  const enableMove = (e: CustomEvent<MoveEvent>): void => {
    if (e.defaultPrevented || e.detail.origin.button !== 0) {
      return;
    }
    canMove = true;
    skipMove = false;
  }

  return {
    selected,
    selection,
    isSelected,
    showSelected,
    resetSeeThroughStackMap,
    events: (anchor: Canvas|null = null) => [
      {
        event: Event.DOWN,
        subscription: (e: CustomEvent<MoveEvent>) => {
          if (isDisabled()) {
            return;
          }

          enableMove(e)
        },
        anchor,
      },
      {
        event: Event.UP,
        subscription: (e: CustomEvent<BaseEvent>) => {
          if (isDisabled()) {
            return;
          }

          selectionMouseUp(e)
        },
        anchor,
      },
      {
        event: Event.MOVE,
        subscription: (e: CustomEvent<BaseEvent>) => {
          if (isDisabled()) {
            return;
          }

          startSelectionMove(e)
        },
        anchor,
      },
    ]
  };
}
