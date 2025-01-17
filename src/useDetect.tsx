import type { Layout, IBaseDef } from "@boardmeister/antetype-core"
import { Event, ICursorParams, PositionEvent } from "@src/index";
import { getAllClickedLayers, getLayerByPosition } from "@src/shared";

export interface IDetect {
  onDown: (e: MouseEvent) => Promise<void>;
  onUp: (e: MouseEvent) => Promise<void>;
  onMove: (e: MouseEvent) => Promise<void>;
}

export interface IEventDown {
  x: number;
  y: number;
  layers: Layout;
  shiftKey: boolean;
  ctrlKey: boolean;
}

export interface IEventHover {
  layer: IBaseDef|null;
  x: number;
  y: number;
}

export interface IEvent {
  down: IEventDown;
  hover: IEventHover;
}


export interface BaseEvent {
  origin: MouseEvent;
  target: IEvent;
}

export type DownEvent = BaseEvent;
export type UpEvent = BaseEvent;
export type MoveEvent = BaseEvent;
export interface SlipEvent extends BaseEvent {
  from: IBaseDef|null;
  to: IBaseDef|null;
}

export default function useDetect(
  {
    injected: { herald },
    modules: { core }
  }: ICursorParams
): IDetect {
  const eventState: IEvent = {
    down: {
      layers: [],
      x: 0,
      y: 0,
      shiftKey: false,
      ctrlKey: false,
    },
    hover: {
      layer: null,
      x: 0,
      y: 0,
    },
  }

  const calcPosition = async (x: number, y: number): Promise<{ x: number, y: number }> => {
    const event = new CustomEvent<PositionEvent>(Event.POSITION, { detail: { x, y } });
    await herald.dispatch(event);

    return event.detail;
  }

  const onDown = async (e: MouseEvent): Promise<void> => {
    let { layerX: x, layerY: y } = e;
    const { shiftKey, ctrlKey } = e;
    const layout = core.meta.document.layout;
    ({ x, y } = await calcPosition(x, y));
    eventState.down.x = x;
    eventState.down.y = y;
    eventState.down.shiftKey = shiftKey;
    eventState.down.ctrlKey = ctrlKey;
    eventState.down.layers = getAllClickedLayers(layout, x, y);

    void herald.dispatch(new CustomEvent<DownEvent>(Event.DOWN, { detail: {
      origin: e,
      target: eventState,
    } }));
  }

  const onUp = async (e: MouseEvent): Promise<void> => {
    await herald.dispatch(new CustomEvent<UpEvent>(Event.UP, { detail: { origin: e, target: eventState } }));
    clearEventStateDown();
    await onMove(e);
  }

  const onMove = async (e: MouseEvent): Promise<void> => {
    const layout = core.meta.document.layout;
    let { layerX: x, layerY: y } = e;
    ({ x, y } = await calcPosition(x, y));
    const newLayer = getLayerByPosition(layout, x, y, false);
    eventState.hover.x = x;
    eventState.hover.y = y;

    if (newLayer !== eventState.hover.layer) {
      await herald.dispatch(new CustomEvent<SlipEvent>(Event.SLIP, { detail: {
        origin: e,
        target: eventState,
        from: eventState.hover.layer,
        to: newLayer,
      } }));
    }
    eventState.hover.layer = newLayer;
    await herald.dispatch(new CustomEvent<MoveEvent>(Event.MOVE, { detail: { origin: e, target: eventState } }));
  }

  const clearEventStateDown = (): void => {
    eventState.down.x = 0;
    eventState.down.y = 0;
    eventState.down.shiftKey = false;
    eventState.down.ctrlKey = false;
    eventState.down.layers = [];
  }

  return {
    onDown,
    onUp,
    onMove,
  }
}
