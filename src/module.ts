/* eslint-disable @typescript-eslint/no-misused-promises */
import { ICursor, ICursorParams, type ICursorSettings } from "@src/index";
import { Event as CoreEvent } from "@boardmeister/antetype-core"
import type { IBaseDef, DrawEvent } from "@boardmeister/antetype-core"
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
  const { canvas, herald, modules } = params;
  if (!canvas) {
    throw new Error('[Antetype Cursor] Canvas is empty!');
  }
  const ctx = canvas.getContext('2d')!;

  if (!modules.core.setting.has('cursor')) {
    modules.core.setting.set('cursor', {})
  }
  const settings = new Proxy({}, {
    get(_target, prop: keyof ICursorSettings) {
      return modules.core.setting.get<ICursorSettings>('cursor')![prop] as unknown;
    },
    set(_obj, prop: keyof ICursorSettings, value) {
      const settings = modules.core.setting.get<ICursorSettings>('cursor')!;
      settings[prop] = value as ICursorSettings[keyof ICursorSettings];

      return true;
    }
  });
  const { drawSelection } = useDraw(herald, ctx);
  const { selected, showSelected, isSelected, resetSeeThroughStackMap } = useSelection(params, settings);
  const { onDown, onUp, onMove, onOut } = useDetect(params, selected, settings);
  useResize(params, showSelected, settings);
  const { onKeyUp } = useDelete(params, selected, settings);

  canvas.addEventListener('mousedown', onDown, false);
  canvas.addEventListener('mouseup', onUp, false);
  canvas.addEventListener('mousemove', onMove, false);
  canvas.addEventListener('mouseout', onOut, false);
  canvas.addEventListener('keyup', onKeyUp, false);

  const unregister = herald.batch([
    {
      event: CoreEvent.CLOSE,
      subscription: () => {
        canvas.removeEventListener('mousedown', onDown, false);
        canvas.removeEventListener('mouseup', onUp, false);
        canvas.removeEventListener('mousemove', onMove, false);
        canvas.removeEventListener('mouseout', onOut, false);
        canvas.removeEventListener('keyup', onKeyUp, false);
        unregister();
      }
    },
    {
      event: CoreEvent.DRAW,
      subscription: (event: CustomEvent<DrawEvent>): void => {
        const { element } = event.detail;
        const typeToAction: Record<string, (def: IBaseDef) => void> = {
          selection: drawSelection,
        };

        const el = typeToAction[element.type]
        if (typeof el == 'function') {
          el(element);
        }
      }
    }
  ])

  return {
    drawSelection,
    selected,
    showSelected,
    isSelected,
    resetSeeThroughStackMap,
  };
}
