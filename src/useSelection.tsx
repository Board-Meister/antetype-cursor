import { Event, ICursorParams, SelectEvent } from "@src/index";
import type { Layout, IBaseDef, IStart, ISize } from "@boardmeister/antetype-core"
import type { IWorkspace } from "@boardmeister/antetype-workspace"
import IterableWeakMap, { IIterableWeakMap } from "@src/IterableWeakMap";
import { ISelectionDef, selectionType } from "@src/module";


export interface ISelection {
  select: (e: MouseEvent) => Promise<void>;
  selectionMouseUp: () => void;
  startSelectionMove: (e: MouseEvent) => void;
  isSelected: (needle: IBaseDef) => IBaseDef|false
}

export interface IEvent {
  shiftKey: boolean;
  ctrlKey: boolean;
  x: number;
  y: number;
  layers: Layout;
}

export interface IState {
  seeThroughStackMap: IIterableWeakMap<IBaseDef, true>,
  selected: IIterableWeakMap<IBaseDef, true>,
}


export default function useSelection(
  {
    modules,
    injected: { herald }
  }: ICursorParams
): ISelection {
  let selected = IterableWeakMap<IBaseDef, true>();
  let shown: ISelectionDef[] = [];
  // let state: IState|null = null;
  let seeThroughStackMap = IterableWeakMap<IBaseDef, true>();
  const eventState: IEvent = {
    x: 0,
    y: 0,
    shiftKey: false,
    ctrlKey: false,
    layers: [],
  }
  const core = modules.core;
  const getSizeAndStart = (layer: IBaseDef): { size: ISize, start: IStart} => {
    const size = layer.area?.size ?? layer.size;
    const start = layer.area?.start ?? layer.start;

    return {
      size,
      start,
    }
  }

  const getAllClickedLayers = (
    layout: Layout,
    { x, y }: IEvent,
  ): Layout => {
    const clicked = [];
    for(let i = layout.length - 1; i >= 0; i--) {
      const layer = layout[i];
      if (layer.type === selectionType) {
        continue;
      }

      const { size, start } = getSizeAndStart(layer);
      if (!size || !layer) {
        continue;
      }

      const isClicked = x >= start.x && x <= size.w + start.x && y >= start.y && y <= size.h + start.y;
      if (!isClicked) {
        continue;
      }

      clicked.push(layer);
    }

    return clicked;
  }

  const select = async (e: MouseEvent): Promise<void> => {
    let { layerX: x, layerY: y } = e;
    const { shiftKey, ctrlKey } = e;
    const layout = core.meta.document.layout;
    const event = new CustomEvent<SelectEvent>(Event.SELECT, { detail: { x, y } });
    await herald.dispatch(event);
    ({ x,y } = event.detail);
    eventState.x = x;
    eventState.y = y;
    eventState.shiftKey = shiftKey;
    eventState.ctrlKey = ctrlKey;

    const layers = getAllClickedLayers(layout, eventState);
    eventState.layers = layers;
  }

  const resetSelected = (): void => {
    // @TODO add event when selection was cleared
    selected = IterableWeakMap<IBaseDef, true>();
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

  const startSelectionMove = (e: MouseEvent): void => {
    if (0 === eventState.layers.length) {
      if (!e.shiftKey && !e.ctrlKey) {
        resetSelected();
        showSelected();
      }
      return;
    }

    const newSelectedLayer = eventState.layers[0];
    const selectedLayer = isAnySelected(eventState.layers);
    if (!seeThroughStackMap.has(newSelectedLayer) && !selectedLayer) {
      if (!eventState.shiftKey && !eventState.ctrlKey) {
        resetSelected();
      }

      selected.set(newSelectedLayer, true);
    } else if (selectedLayer) {
      selected.set(selectedLayer, true);
    }

    selected.keys().forEach(layer => {
      // @TODO add event when layer was moved
      if (layer.area) {
        if (layer.start) {
          setNewPositionOnOriginal(layer, e.movementX, e.movementY);
        }
        layer.area.start.x += e.movementX;
        layer.area.start.y += e.movementY;
      }
    });

    showSelected();
  }

  const setNewPositionOnOriginal = (layer: IBaseDef, x: number, y: number): void => {
    const area = layer.area?.start ?? {
      x: 0,
      y: 0,
    };
    layer.start.x += x;
    layer.start.y += y;
    const original = modules.core.clone.getOriginal(layer);
    if (modules.workspace) {
      const workspace = modules.workspace as IWorkspace;
      original.start.x = workspace.toRelative(layer.start.x) as any;
      original.start.y = workspace.toRelative(layer.start.y, 'y') as any;
      return;
    }

    original.start.x = area.x + x;
    original.start.y = area.y + y;
  }

  const selectionMouseUp = (): void => {
    const { shiftKey, ctrlKey } = eventState;
    if (!shiftKey && !ctrlKey) {
      selected = IterableWeakMap();
    }

    let isFirst = true;
    let wasSelected = false;
    for (const layer of eventState.layers) {
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
    clearEventState();
  }

  const clearEventState = (): void => {
    eventState.x = 0;
    eventState.y = 0;
    eventState.shiftKey = false;
    eventState.ctrlKey = false;
    eventState.layers = [];
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

  return {
    select,
    selectionMouseUp,
    startSelectionMove,
    isSelected,
  }
}
