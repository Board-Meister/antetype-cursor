import type { IBaseDef, InitEvent, ISettings, Layout } from "@boardmeister/antetype-core";
import { Event as CoreEvent } from "@boardmeister/antetype-core";
import type { Herald } from "@boardmeister/herald";
import { Event } from "@src/index";

export const generateRandomLayer = (
  type: string,
  x: number|null = null,
  y: number|null = null,
  w: number|null = null,
  h: number|null = null,
): IBaseDef => {
  const layer: IBaseDef = {
    type,
    start: { x: x ?? Math.random(), y: y ?? Math.random() },
    size: { w: w ?? Math.random(), h: h ?? Math.random() },
    _mark: Math.random(),
  };

  layer.area = {
    start: Object.assign({}, layer.start),
    size: Object.assign({}, layer.size),
  }

  return layer;
};

export const initialize = (herald: Herald, layout: Layout|null = null, settings: ISettings = {}): Promise<void> => {
  return herald.dispatch(new CustomEvent<InitEvent>(CoreEvent.INIT, {
    detail: {
      base: layout ?? [
        generateRandomLayer('clear1'),
        generateRandomLayer('clear2'),
        generateRandomLayer('clear3'),
        generateRandomLayer('clear4'),
      ],
      settings,
    }
  }));
}

export const close = (herald: Herald): Promise<void> => {
  return herald.dispatch(new CustomEvent<CloseEvent>(CoreEvent.CLOSE));
}

export const awaitEvent = (herald: Herald, event: string, timeout = 100): Promise<void> => {
  return new Promise(resolve => {
    const timeoutId = setTimeout(() => {
      unregister();
      resolve();
    }, timeout);

    const unregister = herald.register(event, () => {
      unregister();
      resolve();
      clearTimeout(timeoutId);
    });
  });
}

export const generateMouseEvent = (type: string, details: MouseEventInit = {}): MouseEvent => {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    ...details,
  });
}

export const generateKeyboardEvent = (type: string, key: string, details: KeyboardEventInit = {}): KeyboardEvent => {
  return new KeyboardEvent(type, {
    key,
    code: key,
    bubbles: true,
    cancelable: true,
    ...details,
  });
}

export const awaitClick = async (
  herald: Herald,
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  additionalDown: MouseEventInit = {},
  additionalUp: MouseEventInit = {},
): Promise<void> => {
  const down = generateMouseEvent('mousedown', {
    clientX: x,
    clientY: y,
    ...additionalDown,
  });

  const up = generateMouseEvent('mouseup', {
    clientX: x,
    clientY: y,
    ...additionalUp,
  });

  canvas.dispatchEvent(down);
  await awaitEvent(herald, Event.DOWN);
  canvas.dispatchEvent(up);
  await awaitEvent(herald, Event.UP);
}

export const defaultSettings = {
  cursor: {
    resize: {
      buffer: 0, // Disable resizing so we can have layers of any size (clicking on buffer prevents selection)
    }
  }
};