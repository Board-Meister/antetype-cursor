import { ICursor, ICursorParams } from "@src/index";
import type { IBaseDef } from "@boardmeister/antetype-core"
import useSelection from "@src/useSelection";

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
  const { select, selectionMouseUp, startSelectionMove } = useSelection(params)

  const mouseDown = (e: MouseEvent): void => {
    void select(e);
    canvas.addEventListener('mousemove', mouseMove, false)
    canvas.addEventListener('mouseup', mouseUp, false)
  }

  const mouseUp = (e: MouseEvent): void => {
    e;
    selectionMouseUp();
    canvas.removeEventListener('mousemove', mouseMove, false)
    canvas.removeEventListener('mouseup', mouseUp, false)
  }

  const mouseUpRemoveMove = (): void => {
    canvas.removeEventListener('mousemove', mouseMove, false)
    canvas.removeEventListener('mouseup', mouseUpRemoveMove, false)
  }

  const mouseMove = (e: MouseEvent): void => {
    startSelectionMove(e);
    canvas.removeEventListener('mouseup', mouseUp, false)
    canvas.addEventListener('mouseup', mouseUpRemoveMove, false)
  }

  canvas.addEventListener('mousedown', mouseDown, false)

  const drawSelection = ({ start: { x, y }, size: { w, h } }: IBaseDef): void => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  return {
    drawSelection,
  };
}
