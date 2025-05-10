import type { ICore } from "@boardmeister/antetype-core";
import Core from "@boardmeister/antetype-core/src/core";
import { Herald } from "@boardmeister/herald";
import { Event, type ICursor } from "@src/index";
import Cursor from "@src/module";
import { initialize, close, generateRandomLayer, awaitEvent, generateMouseEvent } from "test/helpers/definition.helper";

describe('Drawing selection', () => {
  let cursor: ICursor, core: ICore;
  const herald = new Herald();
  const canvas = document.createElement('canvas');
  beforeEach(() => {
    core = Core({ herald, canvas }) as ICore;
    cursor = Cursor({ canvas, modules: { core }, herald });
  });

  afterEach(async () => {
    await close(herald);
  })

  it('is done correctly', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testSelect',
        10, 10,
        50, 50,
      )
    ]);

    const down = generateMouseEvent('mousedown', {
      clientX: 20,
      clientY: 20
    });

    const up = generateMouseEvent('mouseup', {
      clientX: 20,
      clientY: 20
    });

    canvas.dispatchEvent(down);
    await awaitEvent(herald, Event.DOWN);
    canvas.dispatchEvent(up);
    await awaitEvent(herald, Event.UP);

    expect(cursor.selected.keys().length).toBe(1);
    const document = core.meta.document;
    expect(document.base.length).toBe(1);
    expect(document.layout.length).toBe(2);
    const possibleSelection = document.layout.slice(-1)[0];
    expect(possibleSelection.type).toBe('selection');
    expect(possibleSelection).toEqual(jasmine.objectContaining({
      size: jasmine.objectContaining({
        w: 50,
        h: 50,
      }),
      start: jasmine.objectContaining({
        x: 10,
        y: 10,
      }),
    }));
  });
});