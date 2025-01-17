import type { Layout, IBaseDef, IStart, ISize } from "@boardmeister/antetype-core"
import { selectionType } from "@src/module";

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
