import type { IBaseDef } from "@boardmeister/antetype-core"

export interface IDraw {
  drawSelection: (layer: IBaseDef) => void;
}

export default function useDraw(ctx: CanvasRenderingContext2D): IDraw {
  const drawSelection = ({ start: { x, y }, size: { w, h } }: IBaseDef): void => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.strokeStyle = '#1e272e';
    ctx.stroke();
    ctx.restore();
  }

  return {
    drawSelection,
  }
}
