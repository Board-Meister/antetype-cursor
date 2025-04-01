import type { IBaseDef } from "@boardmeister/antetype-core"
import { calc } from "@src/shared";
import type { Herald } from "@boardmeister/herald";

export interface IDraw {
  drawSelection: (layer: IBaseDef) => void;
}

export default function useDraw(herald: Herald, ctx: CanvasRenderingContext2D): IDraw {
  const drawSelectionRect = (x: number, y: number, w: number, h: number, thickness: number, fill: string): void => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.lineWidth = thickness;
    ctx.strokeStyle = fill;
    ctx.stroke();
    ctx.restore();
  }

  const drawSelection = ({ start: { x, y }, size: { w, h } }: IBaseDef): void => {
    const unit = calc(herald, { unit: 1 }).unit;
    drawSelectionRect(
      x - (unit * 2),
      y - (unit * 2),
      w + (unit * 4),
      h + (unit * 4),
      unit,
      '#FFF'
    );    // Outer ring
    drawSelectionRect(
      x - unit,
      y - unit,
      w + (unit * 2),
      h + (unit * 2),
      unit,
      '#1e272e'
    ); // Middle ring
    // drawSelectionRect(x, y, w, h, unit, '#FFF'); // Inner ring
  }

  return {
    drawSelection,
  }
}
