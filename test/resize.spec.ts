import type { IBaseDef, ICore, Layout } from "@boardmeister/antetype-core";
import Core from "@boardmeister/antetype-core/dist/core";
import { Herald } from "@boardmeister/herald";
import { type ICursor } from "@src/index";
import Cursor from "@src/module";
import {
  initialize, close, generateRandomLayer, awaitClick as awaitClickBase, generateKeyboardEvent,
  awaitEvent,
  generateMouseEvent
} from "test/helpers/definition.helper";
import { Event as MementoEvent, type SaveEvent } from "@boardmeister/antetype-memento"
import type { IDeleteSaveData } from "@src/useDelete";
import { Event } from "@src/index";

enum Direction {
  DEFAULT,
  REVERSE,
  NO_X,
  NO_Y,
}

describe('Resize', () => {
  let cursor: ICursor, resizeMap: WeakMap<IBaseDef, {x: number, y: number, w: number, h: number}>, core: ICore;
  const herald = new Herald();
  const canvas = document.createElement('canvas');
  let cursorX = 0,
    cursorY = 0;
  const awaitClick = (...rest: unknown[]): Promise<void> => {
    cursorX = rest[0] as number;
    cursorY = rest[1] as number;
    return awaitClickBase(herald, canvas, ...rest)
  };
  const getSelected = (): Layout => cursor.selected.keys();
  const randomBetween = (min: number, max: number): number => { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min);
  }
  const settings = {
    cursor: {
      resize: {
        buffer: 10
      }
    }
  };
  /**
   *
   * @param layout
   * @param x
   * @param y
   * @param expectedX
   * @param expectedY
   * @param direction Direction defines if we are moving right/left or top/bottom. When moving right or bottom we don't
   *  change starting position, just the size.
   */
  const resizeAndValidate = async (
    layout: Layout,
    x: number,
    y: number,
    expectedX: number|null = null,
    expectedY: number|null = null,
    direction: Direction = Direction.DEFAULT,
  ): Promise<void> => {
    const layerStarts = [];
    for (const layer of layout) {
      if (!resizeMap.has(layer)) {
        resizeMap.set(layer, {
          ...layer.start,
          ...layer.size,
        });
      }
      layerStarts.push(resizeMap.get(layer)!);
    }

    expectedX ??= x;
    expectedY ??= y;
    canvas.dispatchEvent(generateMouseEvent('mousemove', {
      clientX: cursorX,
      clientY: cursorY,
      movementX: x,
      movementY: y,
    }));
    cursorX += x;
    cursorY += y;

    await awaitEvent(herald, Event.RESIZED);
    for (let i = 0; i < layout.length; i++) {
      const layer = layout[i];
      const { x: baseX, y: baseY, h, w } = layerStarts[i];
      let expectedW = w - expectedX,
        expectedH = h - expectedY,
        cX = expectedX,
        cY = expectedY
      ;

      if (direction === Direction.REVERSE) {
        expectedW = w + cX;
        expectedH = h + cY;
        cX = 0;
        cY = 0;
      } else if (direction === Direction.NO_X) {
        expectedW = w + cX;
        cX = 0;
      } else if (direction === Direction.NO_Y) {
        expectedH = h + cY;
        cY = 0;
      }

      expect(layer.start.x).withContext('Check X').toBe(baseX + cX);
      expect(layer.size.w).withContext('Check width').toBe(expectedW);
      expect(layer.start.y).withContext('Check Y').toBe(baseY + cY);
      expect(layer.size.h).withContext('Check height').toBe(expectedH);

      resizeMap.set(layer, {
        x: baseX + cX,
        y: baseY + cY,
        w: expectedW,
        h: expectedH,
      });
    }
  }
  const doMovementSet = async (
    {
      ey0 = null,
      ex0 = null,
      ey1 = null,
      ex1 = null,
      ey2 = null,
      ex2 = null,
      ey3 = null,
      ex3 = null,
      ey4 = null,
      ex4 = null,
      ey5 = null,
      ex5 = null,
    }: Record<string, number|null> = {},
    direction: Direction = Direction.DEFAULT,
  ): Promise<void> => {
    await resizeAndValidate(core.meta.document.base, randomBetween(1, 10), 0, ex0, ey0, direction);
    await resizeAndValidate(core.meta.document.base, 0, randomBetween(1, 10), ex1, ey1, direction);
    await resizeAndValidate(core.meta.document.base, randomBetween(1, 10), randomBetween(1, 10), ex2, ey2, direction);
    await resizeAndValidate(core.meta.document.base, randomBetween(1, 10), -randomBetween(1, 10), ex3, ey3, direction);
    await resizeAndValidate(core.meta.document.base, -randomBetween(1, 10), -randomBetween(1, 10), ex4, ey4, direction);
    await resizeAndValidate(core.meta.document.base, 0, 0, ex5, ey5, direction);
  }
  beforeEach(() => {
    core = Core({ herald, canvas }) as ICore;
    resizeMap = new WeakMap();
    cursor = Cursor({ canvas, modules: { core }, herald });
  });

  afterEach(async () => {
    await close(herald);
  })

  it('is done correctly', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testResize',
        10, 10,
        50, 50,
      )
    ], settings);

    await awaitClick(15, 15);

    expect(getSelected().length).withContext('First layer was selected').toBe(1);
    // Click on the corner within 10px radius from the sides, so we can move it in all directions
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: 15,
      clientY: 15,
    }));
    await awaitEvent(herald, Event.DOWN);
    await doMovementSet();

    // Bottom right corner
    let layer = core.meta.document.base[0];
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + layer.size.w - 5,
      clientY: layer.start.y + layer.size.h - 5,
    }));

    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('All layers are still selected').toBe(1);
    await doMovementSet({}, Direction.REVERSE);

    // Top right corner
    layer = core.meta.document.base[0];
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + layer.size.w - 5,
      clientY: layer.start.y + 5,
    }));
    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('All layers are selected').toBe(1);
    await doMovementSet({}, Direction.NO_X);

    // Bottom right corner
    layer = core.meta.document.base[0];
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + 5,
      clientY: layer.start.y + layer.size.h - 5,
    }));
    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('All layers are selected').toBe(1);
    await doMovementSet({}, Direction.NO_Y);
  });

  it('can affect multiple layers at once', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testResize1',
        10, 10,
        50, 50,
      ),
      generateRandomLayer(
        'testResize2',
        60, 60,
        50, 50,
      ),
      generateRandomLayer(
        'testResize3',
        110, 110,
        50, 50,
      )
    ], settings);

    await awaitClick(15, 15);
    await awaitClick(65, 65, { shiftKey: true });
    await awaitClick(115, 115, { shiftKey: true });
    expect(getSelected().length).withContext('All layers are selected').toBe(3);
    // Click on the corner within 10px radius from the sides, so we can move it in all directions
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: 15,
      clientY: 15,
    }));
    await awaitEvent(herald, Event.DOWN);
    await doMovementSet();

    // Bottom right corner
    let layer = core.meta.document.base[2];
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + layer.size.w - 5,
      clientY: layer.start.y + layer.size.h - 5,
    }));

    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('All layers are still selected').toBe(3);
    await doMovementSet({}, Direction.REVERSE);

    // Top right corner
    layer = core.meta.document.base[2];
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + layer.size.w - 5,
      clientY: layer.start.y + 5,
    }));
    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('All layers are selected').toBe(3);
    await doMovementSet({}, Direction.NO_X);

    // Bottom right corner
    layer = core.meta.document.base[2];
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + 5,
      clientY: layer.start.y + layer.size.h - 5,
    }));
    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('All layers are selected').toBe(3);
    await doMovementSet({}, Direction.NO_Y);
  });

  it('depends where the cursor lies', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testResize',
        10, 10,
        50, 50,
      )
    ], settings);

    await awaitClick(15, 15);
    expect(getSelected().length).withContext('First layer was selected').toBe(1);
    // Only left side
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: 15,
      clientY: 25,
    }));
    await awaitEvent(herald, Event.DOWN);
    await doMovementSet({
      ey0: 0,
      ey1: 0,
      ey2: 0,
      ey3: 0,
      ey4: 0,
      ey5: 0,
    });
    let layer = core.meta.document.base[0];
    // Right side
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + layer.size.w - 5,
      clientY: layer.start.y + (layer.size.h/2),
    }));

    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('First layer is selected when switching to right').toBe(1);
    await doMovementSet({
      ey0: 0,
      ey1: 0,
      ey2: 0,
      ey3: 0,
      ey4: 0,
      ey5: 0,
    }, Direction.REVERSE);

    layer = core.meta.document.base[0];
    // Top side
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + (layer.size.w/2),
      clientY: layer.start.y + 5,
    }));
    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('First layer is selected when switching to top').toBe(1);
    await doMovementSet({
      ex0: 0,
      ex1: 0,
      ex2: 0,
      ex3: 0,
      ex4: 0,
      ex5: 0,
    });
    // Bottom side
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: layer.start.x + (layer.size.w/2),
      clientY: layer.start.y + layer.size.h - 5,
    }));
    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('First layer is selected when switching to bottom').toBe(1);
    await doMovementSet({
      ex0: 0,
      ex1: 0,
      ex2: 0,
      ex3: 0,
      ex4: 0,
      ex5: 0,
    }, Direction.REVERSE);
  });

  it('can be undone and redone', async () => {
    let stateEvent: CustomEvent<SaveEvent<IDeleteSaveData>>;
    const unregister = herald.register(
      MementoEvent.SAVE,
      (e: CustomEvent<SaveEvent<IDeleteSaveData>>) => {
        stateEvent = e;
      }
    );

    await initialize(herald, [
      generateRandomLayer(
        'testResize',
        10, 10,
        50, 50,
      )
    ], settings);

    await awaitClick(15, 15);

    expect(getSelected().length).withContext('First layer was selected').toBe(1);
    // Click on the corner within 10px radius from the sides, so we can move it in all directions
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: 15,
      clientY: 15,
    }));
    await awaitEvent(herald, Event.DOWN);
    await resizeAndValidate(core.meta.document.base, 10, 10);
    const { state } = stateEvent!.detail;
    const { layer, data, undo, redo } = state[0];
    await undo(layer, data!);
    expect(core.meta.document.base[0].start.x).toBe(10);
    expect(core.meta.document.base[0].start.y).toBe(10);
    expect(core.meta.document.base[0].size.w).toBe(50);
    expect(core.meta.document.base[0].size.h).toBe(50);
    await redo(layer, data!);
    expect(core.meta.document.base[0].start.x).toBe(20);
    expect(core.meta.document.base[0].start.y).toBe(20);
    expect(core.meta.document.base[0].size.w).toBe(40);
    expect(core.meta.document.base[0].size.h).toBe(40);
    unregister();
  });

  // TODO Test resize queue
});