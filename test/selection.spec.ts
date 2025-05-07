import type { ICore } from "@boardmeister/antetype-core";
import Core from "@boardmeister/antetype-core/src/core";
import { Herald } from "@boardmeister/herald";
import { type ICursor } from "@src/index";
import Cursor from "@src/module";
import { initialize, close, generateRandomLayer, awaitClick as awaitClickBase } from "test/helpers/definition.helper";

describe('Cursors selection', () => {
  let cursor: ICursor;
  const herald = new Herald();
  const canvas = document.createElement('canvas');
  const core = Core({ herald, canvas }) as ICore;
  beforeEach(() => {
    cursor = Cursor({ canvas, modules: { core }, herald });
  });

  afterEach(async () => {
    await close(herald);
  })

  it('allows to select one or multiple layers', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testSelect1',
        10, 10,
        10, 10,
      ),
      generateRandomLayer(
        'testSelect2',
        25, 10,
        10, 10,
      ),
    ], {
      cursor: {
        resize: {
          buffer: 0, // Disable resizing so we can have layers of any size (clicking on buffer prevents selection)
        }
      }
    });

    const awaitClick = (...rest: unknown[]): Promise<void> => awaitClickBase(herald, canvas, ...rest);
    await awaitClick(15, 15);
    expect(cursor.selected.keys().length).withContext('First layer was selected').toBe(1);
    expect(cursor.selected.firstKey()?.type).toBe('testSelect1');
    await awaitClick(22.5, 15);
    expect(cursor.selected.keys().length).withContext('Nothing was selected').toBe(0);
    await awaitClick(30, 15);
    expect(cursor.selected.keys().length).withContext('Second layer was selected').toBe(1);
    expect(cursor.selected.firstKey()?.type).toBe('testSelect2')
    await awaitClick(15, 15, { shiftKey: true }, { shiftKey: true });
    expect(cursor.selected.keys().length).withContext('Both are selected').toBe(2);
    await awaitClick(30, 15, { ctrlKey: true }, { ctrlKey: true });
    expect(cursor.selected.keys().length).withContext('One was unselected with ctrl').toBe(1);
    expect(cursor.selected.firstKey()?.type).toBe('testSelect1');
    await awaitClick(30, 15, { ctrlKey: true }, { ctrlKey: true });
    expect(cursor.selected.keys().length).withContext('Reselected with control').toBe(2);
    await awaitClick(15, 15, { shiftKey: true }, { shiftKey: true });
    expect(cursor.selected.keys().length).withContext('Shift key does nothing on already selected').toBe(2);
    await awaitClick(22.5, 15, { shiftKey: true }, { shiftKey: true });
    expect(cursor.selected.keys().length).withContext('Shift key nowhere does not change selection').toBe(2);
  });
});