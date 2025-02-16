import { ICursor, ICursorParams } from "@src/index";
import type { IBaseDef } from "@boardmeister/antetype-core"
import useSelection from "@src/useSelection";
import useDetect from "@src/useDetect";
import useDraw from "@src/useDraw";
import useResize from "@src/useResize";
import useDelete from "@src/useDelete";

export const selectionType = 'selection';

export interface ISelectionDef extends IBaseDef {
  type: 'selection',
  selection: {
    layer: IBaseDef;
  }
}

export default function Cursor(
  params: ICursorParams
): ICursor {
  const { canvas } = params;
  if (!canvas) {
    throw new Error('[Antetype Cursor] Canvas is empty!')
  }
  const ctx = canvas.getContext('2d')!;

  const { drawSelection } = useDraw(ctx);
  const { selected, showSelected, isSelected, resetSeeThroughStackMap } = useSelection(params);
  const { onDown, onUp, onMove } = useDetect(params, selected);
  useResize(params, showSelected);
  useDelete(params, selected);

  canvas.addEventListener('mousedown', onDown, false);
  canvas.addEventListener('mouseup', onUp, false);
  canvas.addEventListener('mousemove', onMove, false);

  return {
    drawSelection,
    selected,
    showSelected,
    isSelected,
    resetSeeThroughStackMap,
  };
}
