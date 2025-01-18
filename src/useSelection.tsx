import { Event, ICursorParams } from "@src/index";
import type { IBaseDef } from "@boardmeister/antetype-core"
import IterableWeakMap, { IIterableWeakMap } from "@src/IterableWeakMap";
import { ISelectionDef, selectionType } from "@src/module";
import { getSizeAndStart, setNewPositionOnOriginal } from "@src/shared";
import { MoveEvent, UpEvent } from "@src/useDetect";

export interface ISelection {
  selected: IIterableWeakMap<IBaseDef, true>;
  showSelected: () => void;
  isSelected: (needle: IBaseDef) => IBaseDef|false;
}

export type Selected = IIterableWeakMap<IBaseDef, true>;

export function getLayerFromSelection(layer: IBaseDef): IBaseDef {
  if (layer.type === selectionType) {
    return (layer as ISelectionDef).selection.layer;
  }

  return layer;
}

export default function useSelection(
  {
    modules,
    injected: { herald }
  }: ICursorParams
): ISelection {
  const selected = IterableWeakMap<IBaseDef, true>();
  let shown: ISelectionDef[] = [];
  let canMove = false;
  let skipUp = false;
  let seeThroughStackMap = IterableWeakMap<IBaseDef, true>();
  const core = modules.core;

  const resetSelected = (): void => {
    while (selected.empty()) {
      selected.delete(selected.firstKey()!);
    }
    // @TODO add event when selection was cleared
  }

  const resetSeeThroughStackMap = (): void => {
    seeThroughStackMap = IterableWeakMap<IBaseDef, true>();
  }

  const isSelected = (needle: IBaseDef): IBaseDef|false => {
    for (const layer of selected.keys()) {
      if (needle === layer) {
        return needle;
      }
    }

    return false;
  }

  const isAnySelected = (needles: IBaseDef[]): IBaseDef|false => {
    for (const layer of selected.keys()) {
      if (needles.includes(layer)) {
        return layer;
      }
    }

    return false;
  }

  const startSelectionMove = (e: CustomEvent<MoveEvent>): void => {
    if (e.defaultPrevented || !canMove) {
      return;
    }

    skipUp = true;
    const { target: { down }, origin: { movementX, movementY }, } = e.detail;
    if (0 === down.layers.length) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
        showSelected();
      }
      return;
    }

    const newSelectedLayer = down.layers[0];
    const selectedLayer = isAnySelected(down.layers);
    if (!seeThroughStackMap.has(newSelectedLayer) && !selectedLayer) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
      }

      selected.set(newSelectedLayer, true);
    } else if (selectedLayer) {
      selected.set(selectedLayer, true);
    }

    selected.keys().forEach(layer => {
      // @TODO add event when layer was moved
      setNewPositionOnOriginal(modules, layer, movementX, movementY);
    });

    showSelected();
  }

  const selectionMouseUp = (event: CustomEvent<UpEvent>): void => {
    if (event.defaultPrevented) {
      return;
    }
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
      if (selected.has(layer) && ctrlKey) {
        selected.delete(layer);
        break;
      }

      if (!seeThroughStackMap.has(layer)) {
        selected.set(layer, true);
        wasSelected = true;
        if (isFirst) {
          resetSeeThroughStackMap();
        }
        seeThroughStackMap.set(layer, true);
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
      const { size, start } = getSizeAndStart(layer);
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
    if (e.defaultPrevented) {
      return;
    }
    canMove = true;
  }

  herald.register(Event.DOWN, enableMove);
  herald.register(Event.UP, selectionMouseUp);
  herald.register(Event.MOVE, startSelectionMove);

  return {
    selected,
    isSelected,
    showSelected,
  };
}
