import type { IBaseDef, ICore, Layout } from "@boardmeister/antetype-core";
import Core from "@boardmeister/antetype-core/src/core";
import { Herald } from "@boardmeister/herald";
import { type ICursor } from "@src/index";
import Cursor from "@src/module";
import {
  initialize, close, generateRandomLayer, awaitClick as awaitClickBase, generateMouseEvent, awaitEvent
} from "test/helpers/definition.helper";
import { Event } from "@src/index";
import { Event as MementoEvent, type SaveEvent } from "@boardmeister/antetype-memento"
import type { IMoveSaveData } from "@src/useSelection";

describe('Cursors movement', () => {
  let cursor: ICursor, core: ICore, moveMap: WeakMap<IBaseDef, {x: number, y: number}>;
  const herald = new Herald();
  const canvas = document.createElement('canvas');
  const defaultSettings = {
    cursor: {
      resize: {
        buffer: 0, // Disable resizing so we can have layers of any size (clicking on buffer prevents selection)
      }
    }
  };
  const getSelected = (): Layout => cursor.selected.keys();
  const awaitClick = (...rest: unknown[]): Promise<void> => awaitClickBase(herald, canvas, ...rest);
  const moveAndVerify = async (layout: Layout, x: number, y: number): Promise<void> => {
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
      movementX: x,
      movementY: y,
    }));
    await awaitEvent(herald, Event.MOVE);

    for (let i = 0; i < layout.length; i++) {
      const layer = layout[i];
      const { x: baseX, y: baseY } = layerStarts[i];
      expect(layer.start.x).withContext(`Check layer ${String(i + 1)} for X`).toBe(baseX + x);
      expect(layer.start.y).withContext(`Check layer ${String(i + 1)} for Y`).toBe(baseY + y);

      moveMap.set(layer, {
        x: baseX + x,
        y: baseY + y,
      });
    }
  }

  beforeEach(() => {
    moveMap = new WeakMap();
    core = Core({ herald, canvas }) as ICore;
    cursor = Cursor({ canvas, modules: { core }, herald });
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
});