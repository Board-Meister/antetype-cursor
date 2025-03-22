import { Event, ICursorParams, ICursorSettings } from "@src/index";
import type { IBaseDef } from "@boardmeister/antetype-core"
import { Event as CoreEvent } from "@boardmeister/antetype-core"
import type { SaveEvent, IMementoState } from "@boardmeister/antetype-memento"
import { Event as MementoEvent } from "@boardmeister/antetype-memento"
import IterableWeakMap, { IIterableWeakMap } from "@src/IterableWeakMap";
import { ISelectionDef, selectionType } from "@src/module";
import { getSizeAndStart, setNewPositionOnOriginal } from "@src/shared";
import { MoveEvent, UpEvent } from "@src/useDetect";

export interface ISelection {
  selected: IIterableWeakMap<IBaseDef, true>;
  showSelected: () => void;
  isSelected: (needle: IBaseDef) => IBaseDef|false;
  resetSeeThroughStackMap: VoidFunction;
}

export type Selected = IIterableWeakMap<IBaseDef, true>;

export function getLayerFromSelection(layer: IBaseDef): IBaseDef {
  if (layer.type === selectionType) {
    return (layer as ISelectionDef).selection.layer;
  }

  return layer;
}

interface IMoveSaveData {
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
    injected: { herald }
  }: ICursorParams,
  settings: ICursorSettings,
): ISelection {
  const selected = IterableWeakMap<IBaseDef, true>();
  let shown: ISelectionDef[] = [];
  let canMove = false;
  let skipUp = false;
  let skipMove = true;
  let accumulatedMoveX = 0;
  let accumulatedMoveY = 0;
  let seeThroughStackMap = IterableWeakMap<IBaseDef, true>();
  const core = modules.core;
  const innerSettings = {
    moveBufor: 5,
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
      void herald.dispatch(new CustomEvent<SaveEvent<IMoveSaveData>>(MementoEvent.SAVE, {  detail: { state } }));
    }
  }

  const shouldSkipMove = (e: CustomEvent<MoveEvent>): boolean => {
    if (!skipMove) {
      return false;
    }

    const { origin: { movementX, movementY }, } = e.detail;
    accumulatedMoveX += movementX;
    accumulatedMoveY += movementY;
    if (
      Math.abs(accumulatedMoveX) > innerSettings.moveBufor
      || Math.abs(accumulatedMoveY) > innerSettings.moveBufor
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
    const { target: { down, hover: { mY, mX } } } = e.detail;
    if (0 === down.layers.length) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
        showSelected();
      }
      return;
    }

    const newSelectedLayer = core.clone.getOriginal(down.layers[0]);
    const selectedLayer = isAnySelected(down.layers);
    if (!seeThroughStackMap.has(newSelectedLayer) && !selectedLayer) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
      }

      selected.set(newSelectedLayer, true);
    } else if (selectedLayer) {
      selected.set(selectedLayer, true);
    }

    if (isFirstMotionAfterDown) {
      saveSelectedPosition();
    }

    selected.keys().forEach(layer => {
      // @TODO firgure out a wat to set group scoped sized when moving nested layers
      if (layer.hierarchy?.parent !== modules.core.meta.document) {
        return;
      }
      // @TODO add event when layer was moved
      setNewPositionOnOriginal(modules, layer, mX, mY);
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
    for (const layer of shown) {
      core.manage.removeVolatile(layer);
    }
    shown = [];

    for (const layer of selected.keys()) {
      const { size, start } = getSizeAndStart(core.clone.getClone(layer));
      const selection = {
        type: selectionType,
        size,
        start,
        selection: {
          layer,
        }
      } as ISelectionDef;
      shown.push(selection);
      core.manage.addVolatile(selection);
    }
    // @TODO event when selection has been added
    core.view.redraw();
    // @TODO event when selection is visible
  }

  const enableMove = (e: CustomEvent<MoveEvent>): void => {
    console.log(e);
    
    if (e.defaultPrevented || e.detail.origin.button !== 0) {
      return;
    }
    canMove = true;
  }

  const unregister = herald.batch([
    {
      event:Event.DOWN,
      subscription: e => {
        if (isDisabled()) {
          return;
        }

        enableMove(e as CustomEvent<MoveEvent>)
      },
    },
    {
      event:Event.UP,
      subscription: e => {
        if (isDisabled()) {
          return;
        }

        selectionMouseUp(e)
      },
    },
    {
      event:Event.MOVE,
      subscription: e => {
        if (isDisabled()) {
          return;
        }

        startSelectionMove(e)
      },
    },
    {
      event: CoreEvent.CLOSE,
      subscription: {
        method: () => { unregister() },
      },
    }
  ]);

  return {
    selected,
    isSelected,
    showSelected,
    resetSeeThroughStackMap,
  };
}
