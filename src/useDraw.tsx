import type { IBaseDef } from "@boardmeister/antetype-core"

export interface IDraw {
  drawSelection: (layer: IBaseDef) => void;
}

export default function useDraw(ctx: CanvasRenderingContext2D): IDraw {
  const drawSelectionRect = (x: number, y: number, w: number, h: number, fill: string): void => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.strokeStyle = fill;
    ctx.stroke();
    ctx.restore();
  }

  const drawSelection = ({ start: { x, y }, size: { w, h } }: IBaseDef): void => {
    drawSelectionRect(x - 2, y - 2, w + 4, h + 4, '#FFF');    // Outer ring
    drawSelectionRect(x - 1, y - 1, w + 2, h + 2, '#1e272e'); // Middle ring
    drawSelectionRect(x, y, w, h, '#FFF');                    // Inner ring
  }

  return {
    drawSelection,
  }
}
