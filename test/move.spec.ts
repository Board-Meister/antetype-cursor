import type { IBaseDef, ICore, Layout } from "@boardmeister/antetype-core";
import { Core } from "@boardmeister/antetype-core";
import { Herald } from "@boardmeister/herald";
import { type ICursor } from "@src/type.d";
import Cursor from "@src/module";
import {
  initialize, close, generateRandomLayer, awaitClick as awaitClickBase, generateMouseEvent, awaitEvent,
  defaultSettings
} from "test/helpers/definition.helper";
import { Event } from "@src/type.d";
import { Event as MementoEvent, type SaveEvent } from "@boardmeister/antetype-memento"
import type { IMoveSaveData } from "@src/useSelection";

describe('Cursors movement', () => {
  let cursor: ICursor, core: ICore, moveMap: WeakMap<IBaseDef, {x: number, y: number}>;
  const herald = new Herald();
  const canvas = document.createElement('canvas');

  let cursorX = 0,
    cursorY = 0;
  const getSelected = (): Layout => cursor.selected.keys();
  const awaitClick = (...rest: unknown[]): Promise<void> => {
    cursorX = rest[0] as number;
    cursorY = rest[1] as number;
    return awaitClickBase(herald, canvas, ...rest)
  };
  const moveAndVerify = async (layout: Layout, x: number, y: number, context = ''): Promise<void> => {
    const layerStarts = [];
    for (const layer of layout) {
      if (!moveMap.has(layer)) {
        moveMap.set(layer, {
          x: layer.start.x,
          y: layer.start.y,
        });
      }
      layerStarts.push(moveMap.get(layer)!);
    }

    canvas.dispatchEvent(generateMouseEvent('mousemove', {
      clientX: cursorX,
      clientY: cursorY,
      movementX: x,
      movementY: y,
    }));
    await awaitEvent(herald, Event.MOVE);

    for (let i = 0; i < layout.length; i++) {
      const layer = layout[i];
      const { x: baseX, y: baseY } = layerStarts[i];
      expect(layer.start.x).withContext(context + ` Check layer ${String(i + 1)} for X`).toBe(baseX + x);
      expect(layer.start.y).withContext(context + ` Check layer ${String(i + 1)} for Y`).toBe(baseY + y);

      moveMap.set(layer, {
        x: baseX + x,
        y: baseY + y,
      });
    }
  }

  beforeEach(() => {
    cursorX = 0;
    cursorY = 0;
    moveMap = new WeakMap();
    core = Core({ herald });
    cursor = Cursor({ modules: { core }, herald });
    core.meta.setCanvas(canvas);
  });

  afterEach(async () => {
    await close(herald);
  })

  it('works on one layer', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testMove1',
        10, 10,
        10, 10,
      ),
    ], defaultSettings);

    expect(core.meta.document.base[0].start.x).toBe(10);
    expect(core.meta.document.base[0].start.y).toBe(10);
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: 15,
      clientY: 15,
    }));
    await awaitEvent(herald, Event.DOWN);
    await moveAndVerify(core.meta.document.base, 5, 7);
    await moveAndVerify(core.meta.document.base, -2, 1);
    await moveAndVerify(core.meta.document.base, 2, -1);
    await moveAndVerify(core.meta.document.base, -2, -2);
  });

  it('works on multiple layers', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testMove1',
        10, 10,
        10, 10,
      ),
      generateRandomLayer(
        'testMove2',
        15, 15,
        14, 17,
      ),
      generateRandomLayer(
        'testMove3',
        20, 20,
        16, 12,
      ),
    ], defaultSettings);

    await awaitClick(14, 14);
    await awaitClick(16, 16, { shiftKey: true });
    await awaitClick(21, 21, { shiftKey: true });
    expect(getSelected().length).toBe(3);
    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: 16,
      clientY: 16,
    }));
    await awaitEvent(herald, Event.DOWN);
    await moveAndVerify(core.meta.document.base, 5, 7);
    expect(getSelected().length).toBe(3);
    await moveAndVerify(core.meta.document.base, 1, -2);
    expect(getSelected().length).toBe(3);
    await moveAndVerify(core.meta.document.base, 0, 0);
    await moveAndVerify(core.meta.document.base, -2, 0);
    await moveAndVerify(core.meta.document.base, -2, -3);
  });

  it('can be undone and redone', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testMove1',
        10, 10,
        10, 10,
      ),
    ], defaultSettings);
    let stateEvent: CustomEvent<SaveEvent<IMoveSaveData>>;

    const unregister = herald.register(
      MementoEvent.SAVE,
      (e: CustomEvent<SaveEvent<IMoveSaveData>>) => {
        stateEvent = e;
      }
    );

    canvas.dispatchEvent(generateMouseEvent('mousedown', {
      clientX: 15,
      clientY: 15,
    }));
    await awaitEvent(herald, Event.DOWN);
    await Promise.all([
      moveAndVerify(core.meta.document.base, 5, 6),
      awaitEvent(herald, MementoEvent.SAVE),
    ]);

    const { state } = stateEvent!.detail;
    const { layer, data, undo, redo } = state[0];
    await undo(layer, data!);
    const toCheck = core.meta.document.base[0];
    expect(toCheck.start.x).withContext('undo X').toBe(10);
    expect(toCheck.start.y).withContext('undo Y').toBe(10);
    await redo(layer, data!);
    expect(toCheck.start.x).withContext('redo X').toBe(15);
    expect(toCheck.start.y).withContext('redo Y').toBe(16);
    unregister();
  });

  it('on the next moved layer unselects the previous one', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testMove1',
        10, 10,
        10, 10,
      ),
      generateRandomLayer(
        'testMove2',
        25, 25,
        10, 10,
      ),
      generateRandomLayer(
        'testMove3',
        40, 40,
        10, 10,
      ),
    ], defaultSettings);

    canvas.dispatchEvent(generateMouseEvent('mousedown', { clientX: 15, clientY: 15 }));
    await awaitEvent(herald, Event.DOWN);
    expect(getSelected().length).withContext('Before move down').toBe(0);

    await moveAndVerify([core.meta.document.base[0]], 10, 1, '[First move]');
    expect(getSelected().length).withContext('First move').toBe(1);
    canvas.dispatchEvent(generateMouseEvent('mouseup', { clientX: 15, clientY: 15 }));
    await awaitEvent(herald, Event.UP);
    expect(getSelected().length).withContext('First move Up').toBe(1);

    canvas.dispatchEvent(generateMouseEvent('mousedown', { clientX: 35, clientY: 35 }));
    await awaitEvent(herald, Event.DOWN);
    await moveAndVerify([core.meta.document.base[1]], 10, 1, '[Second move]');
    expect(getSelected().length).withContext('Second move down').toBe(1);
    await awaitEvent(herald, Event.UP);
    expect(getSelected().length).withContext('First move Up').toBe(1);
    expect(core.meta.document.base[0].start.x).toBe(20);
    expect(core.meta.document.base[0].start.y).toBe(11);

    canvas.dispatchEvent(generateMouseEvent('mousedown', { clientX: 45, clientY: 45 }));
    await awaitEvent(herald, Event.DOWN);
    await moveAndVerify([core.meta.document.base[2]], 10, 1, '[Third move]');
    expect(getSelected().length).withContext('Second move down').toBe(1);
    await awaitEvent(herald, Event.UP);
    expect(getSelected().length).withContext('First move Up').toBe(1);
    expect(core.meta.document.base[0].start.x).toBe(20);
    expect(core.meta.document.base[0].start.y).toBe(11);
    expect(core.meta.document.base[1].start.x).toBe(35);
    expect(core.meta.document.base[1].start.y).toBe(26);
  });

  it('changes cursor icon properly',  async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testMove1',
        10, 10,
        50, 50,
      ),
    ],  {
      cursor: {
        resize: {
          buffer: 10,
        }
      }
    });

    let startX = 35,
      startY = 35;
    const verifyCursor = (cursor: string): void => {
      expect(canvas.style.cursor).withContext(`X: ${String(startX)} Y: ${String(startY)}`).toBe(cursor);
    }
    const move = (x: number, y: number): Promise<void> => {
      canvas.dispatchEvent(generateMouseEvent('mousemove', {
        clientX: x,
        clientY: y,
        movementX: x - startX,
        movementY: y - startY,
      }));
      startX = x;
      startY = y;
      return awaitEvent(herald, Event.MOVE);
    }
    await awaitClick(startX, startY);
    verifyCursor('pointer');
    await move(15, 15);
    verifyCursor('nwse-resize');
    await move(5, 5);
    verifyCursor('default');
    await move(55, 15);
    verifyCursor('nesw-resize');
    await move(55, 5);
    verifyCursor('default');
    await move(55, 55);
    verifyCursor('nwse-resize');
    await move(55, 65);
    verifyCursor('default');
    await move(15, 55);
    verifyCursor('nesw-resize');
    await move(35, 15);
    verifyCursor('ns-resize');
    await move(35, 55);
    verifyCursor('ns-resize');
    await move(15, 35);
    verifyCursor('ew-resize');
    await move(55, 35);
    verifyCursor('ew-resize');
  });
});