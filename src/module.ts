/* eslint-disable @typescript-eslint/no-misused-promises */
import { Event as CoreEvent } from "@boardmeister/antetype-core"
import type { IBaseDef, DrawEvent, Canvas, CanvasChangeEvent } from "@boardmeister/antetype-core"
import useSelection from "@src/useSelection";
import useDetect from "@src/useDetect";
import useDraw from "@src/useDraw";
import useResize from "@src/useResize";
import useDelete from "@src/useDelete";
import type { ICursorParams, ICursor, ICursorSettings } from "@src/type.d";
import type { IEventSettings } from "@boardmeister/herald";

export interface DispatchHelper {
  dispatch: (event: CustomEvent, settings?: IEventSettings) => Promise<void>;
  dispatchSync: (event: CustomEvent, settings?: IEventSettings) => void;
}

export default function Cursor(
  params: ICursorParams
): ICursor {
  const { herald, modules } = params;
  const dispatchHelper = {
    _canvas: (): Canvas|null => modules.core.meta.getCanvas(),
    dispatch: (event: CustomEvent, settings: IEventSettings = {}) =>
      herald.dispatch(event, { origin: dispatchHelper._canvas(), ...settings }),
    dispatchSync: (event: CustomEvent, settings: IEventSettings = {}) => {
      herald.dispatchSync(event, { origin: dispatchHelper._canvas(), ...settings })
    }
  }

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
  const { drawSelection } = useDraw(herald, modules.core);
  const {
    selected, showSelected, isSelected, resetSeeThroughStackMap, selection, events: selectionEvents
  } = useSelection(params, settings, dispatchHelper);
  const { onDown, onUp, onMove, onOut } = useDetect(params, selected, settings, dispatchHelper);
  const { events: resizeEvents } = useResize(params, showSelected, settings, selection, dispatchHelper);
  const { onKeyUp, events: deleteEvents } = useDelete(params, selected, settings, dispatchHelper);

  const registerCanvasEvents = (canvas: Canvas|null): void => {
    if (canvas instanceof HTMLCanvasElement) {
      canvas.addEventListener('mousedown', onDown, false);
      canvas.addEventListener('mouseup', onUp, false);
      canvas.addEventListener('mousemove', onMove, false);
      canvas.addEventListener('mouseout', onOut, false);
      canvas.addEventListener('keyup', onKeyUp, false);
    }
  }

  const unregisterCanvasEvents = (canvas: Canvas|null): void => {
    if (canvas instanceof HTMLCanvasElement) {
      canvas.removeEventListener('mousedown', onDown, false);
      canvas.removeEventListener('mouseup', onUp, false);
      canvas.removeEventListener('mousemove', onMove, false);
      canvas.removeEventListener('mouseout', onOut, false);
      canvas.removeEventListener('keyup', onKeyUp, false);
    }
  }

  const register = (anchor: Canvas|null = null): void => {
    anchor ??= modules.core.meta.getCanvas();

    const unregister = herald.batch([
      {
        event: CoreEvent.CANVAS_CHANGE,
        subscription: ({ detail: { previous, current } }: CanvasChangeEvent) => {
          unregisterCanvasEvents(previous);
          registerCanvasEvents(current)
          unregister();
          register(current);
        },
        anchor,
      },
      {
        event: CoreEvent.CLOSE,
        subscription: () => {
          unregisterCanvasEvents(modules.core.meta.getCanvas());
          unregister();
        },
        anchor,
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
        },
        anchor,
      },
      ...(deleteEvents(anchor)),
      ...(selectionEvents(anchor)),
      ...(resizeEvents(anchor)),
    ])
  }

  register();

  return {
    drawSelection,
    selected,
    showSelected,
    isSelected,
    resetSeeThroughStackMap,
  };
}
