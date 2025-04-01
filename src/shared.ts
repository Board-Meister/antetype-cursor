import type { Layout, IBaseDef, IStart, ISize, IParentDef } from "@boardmeister/antetype-core"
import type { IWorkspace } from "@boardmeister/antetype-workspace"
import { selectionType } from "@src/module";
import type { CalcEvent, IRequiredModules } from "@src/index";
import { Event } from "@src/index";
import type { Herald } from "@boardmeister/herald";

export const calc = <T extends Record<string, number>>(herald: Herald, toCalc: T): T => {
  const event = new CustomEvent<CalcEvent>(Event.CALC, { detail: { values: toCalc } });
  herald.dispatchSync(event)

  return event.detail.values as T;
}

export const getSizeAndStart = (layer: IBaseDef): { size: ISize, start: IStart} => {
  let w = 0,
    h = 0,
    x = 0,
    y = 0
  ;

  if (layer.size || layer.area?.size) {
    ({ w, h } = layer.area?.size ?? layer.size);
  }
  if (layer.start || layer.area?.start) {
    ({ x, y } = layer.area?.start ?? layer.start);
  }

  if (layer.hierarchy?.parent) {
    const { start } = getSizeAndStart(layer.hierarchy.parent);
    x += start.x;
    y += start.y;
  }

  return {
    size: { w, h },
    start: { x, y },
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
  deep = false,
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

    if (deep && (layer as IParentDef).layout) {
      const subLayer = getLayerByPosition(
        (layer as IParentDef).layout,
        x,
        y,
        skipSelection,
        true,
      )

      if (subLayer) return subLayer;
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

export const isEditable = (value: unknown): boolean =>
  (typeof value == 'number' && isNaN(value))
  || typeof value == 'undefined'
;

export const setNewPositionOnOriginal = (modules: IRequiredModules, layer: IBaseDef, x: number, y: number): void => {
  layer = modules.core.clone.getClone(layer);
  if (layer.area) {
    if (!isEditable(layer.area.start.x)) layer.area.start.x += x;
    if (!isEditable(layer.area.start.y)) layer.area.start.y += y;
  }

  if (layer.start) {
    if (!isEditable(layer.start.x)) layer.start.x += x;
    if (!isEditable(layer.start.y)) layer.start.y += y;
  }

  // @TODO probably move it to event
  // something like Adapter/Global events like ANTETYPE.LAYER.SET.START which is pretty generic and
  // should we easy to understand and used by different modules
  const original = modules.core.clone.getOriginal(layer);
  if (modules.workspace) {
    const workspace = modules.workspace as IWorkspace;
    if (original.start) {
      if (!isEditable(original.start.x)) original.start.x = workspace.toRelative(layer.start.x) as any;
      if (!isEditable(original.start.y)) original.start.y = workspace.toRelative(layer.start.y, 'y') as any;
    }
    return;
  }

  const area = layer.area?.start ?? layer.start;
  if (area && original.start) {
    if (!isEditable(original.start.x)) original.start.x = area.x + x;
    if (!isEditable(original.start.y)) original.start.y = area.y + y;
  }
}
