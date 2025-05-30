import type { Layout } from "@boardmeister/antetype-core"
import { calc, getAllClickedLayers, getLayerByPosition } from "@src/shared";
import type {
  ICursorParams, ICursorSettings, IEvent, PositionEvent, DownEvent, UpEvent, MoveEvent, SlipEvent
} from "@src/type.d";
import { Event } from "@src/type.d";
import { Selected } from "@src/useSelection";

export interface IDetect {
  onDown: (e: MouseEvent) => Promise<void>;
  onUp: (e: MouseEvent) => Promise<void>;
  onMove: (e: MouseEvent) => Promise<void>;
  onOut: (e: MouseEvent) => Promise<void>;
}

export default function useDetect(
  {
    herald,
    modules: { core },
    canvas,
  }: ICursorParams,
  selected: Selected,
  settings: ICursorSettings,
): IDetect {
  const eventState: IEvent = {
    selected,
    isDown: false,
    wasMoved: false,
    down: {
      layers: [],
      x: 0,
      y: 0,
      shiftKey: false,
      ctrlKey: false,
    },
    hover: {
      layer: null,
      deep: null,
      x: 0,
      y: 0,
      mX: 0,
      mY: 0,
    },
  }

  const isDisabled = (): boolean => settings.detect?.disabled ?? false;
  const calcPosition = async (x: number, y: number): Promise<{ x: number, y: number }> => {
    // if this operation will turn to be too expensive check this out https://stackoverflow.com/a/36860652/11495586
    const boundingBox = canvas!.getBoundingClientRect();
    x -= boundingBox.left;
    y -= boundingBox.top;

    const event = new CustomEvent<PositionEvent>(Event.POSITION, { detail: { x, y } });
    await herald.dispatch(event)

    return event.detail;
  }

  const onDown = async (e: MouseEvent): Promise<void> => {
    if (isDisabled()) {
      return;
    }
    eventState.isDown = true;
    eventState.wasMoved = false;
    let { clientX: x, clientY: y } = e;
    const { shiftKey, ctrlKey } = e;
    const layout = core.meta.document.layout;
    ({ x, y } = await calcPosition(x, y));
    await updateHover(e, layout, x, y, 0, 0)
    eventState.down.x = x;
    eventState.down.y = y;
    eventState.down.shiftKey = shiftKey;
    eventState.down.ctrlKey = ctrlKey;
    eventState.down.layers = getAllClickedLayers(layout, x, y);

    void herald.dispatch(new CustomEvent<DownEvent>(Event.DOWN, {
      detail: {
        origin: e,
        target: eventState,
      },
      cancelable: true,
    }));
  }

  const onUp = async (e: MouseEvent): Promise<void> => {
    if (isDisabled()) {
      return;
    }
    eventState.isDown = false;

    await herald.dispatch(new CustomEvent<UpEvent>(Event.UP, {
      detail: { origin: e, target: eventState },
      cancelable: true,
    }));
    clearEventStateDown();
    await onMove(e);
  }

  const onMove = async (e: MouseEvent): Promise<void> => {
    if (isDisabled()) {
      return;
    }
    eventState.wasMoved = true;
    const layout = core.meta.document.layout;
    let { clientX: x, clientY: y, movementX, movementY } = e;
    ({ x, y } = await calcPosition(x, y));
    ({ movementX, movementY } = calc(herald, { movementX, movementY }));
    await updateHover(e, layout, x, y, movementX, movementY);

    await herald.dispatch(new CustomEvent<MoveEvent>(Event.MOVE, {
      detail: { origin: e, target: eventState },
      cancelable: true,
    }));
  }

  const updateHover = async (
    e: MouseEvent,
    layout: Layout,
    x: number,
    y: number,
    movementX: number,
    movementY: number,
  ): Promise<void> => {
    const newLayer = getLayerByPosition(layout, x, y, true);
    const newDeepLayer = getLayerByPosition(layout, x, y, true, true);

    eventState.hover.x = x;
    eventState.hover.y = y;
    eventState.hover.mY = movementY;
    eventState.hover.mX = movementX;

    if (newLayer !== eventState.hover.layer) {
      await herald.dispatch(new CustomEvent<SlipEvent>(Event.SLIP, {
        detail: {
          origin: e,
          target: eventState,
          from: eventState.hover.layer,
          to: newLayer,
        },
        cancelable: true,
      }));
    }

    eventState.hover.layer = newLayer;
    eventState.hover.deep = newDeepLayer;
  }

  const clearEventStateDown = (): void => {
    eventState.down.x = 0;
    eventState.down.y = 0;
    eventState.down.shiftKey = false;
    eventState.down.ctrlKey = false;
    eventState.down.layers = [];
  }

  const onOut = async (e: MouseEvent): Promise<void> => {
    await herald.dispatch(new CustomEvent<SlipEvent>(Event.SLIP, {
      detail: {
        origin: e,
        target: eventState,
        from: eventState.hover.layer,
        to: null,
      },
      cancelable: true,
    }));
    eventState.hover.layer = null;
    eventState.hover.deep = null;
  }

  return {
    onDown,
    onUp,
    onMove,
    onOut,
  }
}
