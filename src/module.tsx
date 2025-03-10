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
  const { canvas, injected, modules } = params;
  if (!canvas) {
    throw new Error('[Antetype Cursor] Canvas is empty!')
  }
  const ctx = canvas.getContext('2d')!;

  if (!modules.core.setting.has('cursor')) {
    modules.core.setting.set('cursor', {})
  }
  const settings = new Proxy({}, {
    get(target: unknown, prop: string) {
      target;
      return ((modules.core.setting.get('cursor')! as unknown) as any)[prop] as unknown;
    },
    set(obj, prop, value) {
      obj;
      const settings = ((modules.core.setting.get('cursor')! as unknown) as any);
      settings[prop] = value;

      return true;
    }
  });
  const { drawSelection } = useDraw(injected, ctx);
  const { selected, showSelected, isSelected, resetSeeThroughStackMap } = useSelection(params, settings);
  const { onDown, onUp, onMove, onOut } = useDetect(params, selected, settings);
  useResize(params, showSelected, settings);
  useDelete(params, selected, settings);

  canvas.addEventListener('mousedown', onDown, false);
  canvas.addEventListener('mouseup', onUp, false);
  canvas.addEventListener('mousemove', onMove, false);
  canvas.addEventListener('mouseout', onOut, false);

  return {
    drawSelection,
    selected,
    showSelected,
    isSelected,
    resetSeeThroughStackMap,
  };
}
