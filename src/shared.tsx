import type { Layout, IBaseDef, IStart, ISize } from "@boardmeister/antetype-core"
import type { IWorkspace } from "@boardmeister/antetype-workspace"
import { selectionType } from "@src/module";
import { IRequiredModules } from "@src/index";

export  const getSizeAndStart = (layer: IBaseDef): { size: ISize, start: IStart} => {
  const size = layer.area?.size ?? layer.size;
  const start = layer.area?.start ?? layer.start;

  return {
    size,
    start,
  }
}

const isWithinLayer = (
  oX: number,
  oY: number,
  { x, y }: IStart,
  { w, h }: ISize
): boolean => oX >= x && oX <= w + x && oY >= y && oY <= h + y;

export const getLayerByPosition = (
  layout: Layout,
  x: number,
  y: number,
  skipSelection = true,
): IBaseDef|null => {
  for(let i = layout.length - 1; i >= 0; i--) {
    const layer = layout[i] as IBaseDef;
    if (skipSelection && layer.type === selectionType) {
      continue;
    }

    const { size = null, start = null } = getSizeAndStart(layer);
    if (!size || !start) {
      continue;
    }

    if (!isWithinLayer(x, y, start, size)) {
      continue;
    }

    return layer;
  }

  return null;
}

export const getAllClickedLayers = (
  layout: Layout,
  x: number,
  y: number,
  skipSelection = true,
): Layout => {
  const clicked = [];
  for(let i = layout.length - 1; i >= 0; i--) {
    const layer = layout[i];
    if (skipSelection && layer.type === selectionType) {
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

export const setNewPositionOnOriginal = (modules: IRequiredModules, layer: IBaseDef, x: number, y: number): void => {
  if (layer.area) {
    if (!isNaN(layer.start.x)) layer.area.start.x += x;
    if (!isNaN(layer.start.y)) layer.area.start.y += y;
  }

  if (layer.start) {
    if (!isNaN(layer.start.x)) layer.start.x += x;
    if (!isNaN(layer.start.y)) layer.start.y += y;
  }

  // @TODO probably move it to event
  // something like Adapter/Global events like ANTETYPE.LAYER.SET.START which is pretty generic and
  // should we easy to understand and used by different modules
  const original = modules.core.clone.getOriginal(layer);
  if (modules.workspace) {
    const workspace = modules.workspace as IWorkspace;
    if (original.start) {
      if (!isNaN(original.start.x)) original.start.x = workspace.toRelative(layer.start.x) as any;
      if (!isNaN(original.start.y)) original.start.y = workspace.toRelative(layer.start.y, 'y') as any;
    }
    return;
  }

  const area = layer.area?.start ?? layer.start;
  if (area && original.start) {
    if (!isNaN(original.start.x)) original.start.x = area.x + x;
    if (!isNaN(original.start.y)) original.start.y = area.y + y;
  }
}
