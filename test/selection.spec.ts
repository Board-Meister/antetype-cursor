import type { IBaseDef, ICore, Layout } from "@boardmeister/antetype-core";
import Core from "@boardmeister/antetype-core/src/core";
import { Herald } from "@boardmeister/herald";
import { type ICursor } from "@src/index";
import Cursor from "@src/module";
import { initialize, close, generateRandomLayer, awaitClick as awaitClickBase, defaultSettings } from "test/helpers/definition.helper";

describe('Cursors selection', () => {
  let cursor: ICursor, core: ICore;
  const herald = new Herald();
  const canvas = document.createElement('canvas');
  const awaitClick = (...rest: unknown[]): Promise<void> => awaitClickBase(herald, canvas, ...rest);
  const getSelected = (): Layout => cursor.selected.keys();
  const getFirst = (): IBaseDef|null => cursor.selected.firstKey();
  beforeEach(() => {
    core = Core({ herald, canvas }) as ICore;
    cursor = Cursor({ canvas, modules: { core }, herald });
  });

  afterEach(async () => {
    await close(herald);
  })

  it('allows to select one or multiple layers', async () => {
    /*
      +-----+  +-----+
      |     |  |     |
      |     |  |     |
      +-----+  +-----+
    */
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
    ], defaultSettings);

    await awaitClick(15, 15);
    expect(getSelected().length).withContext('First layer was selected').toBe(1);
    expect(getFirst()?.type).toBe('testSelect1');
    await awaitClick(22.5, 15);
    expect(getSelected().length).withContext('Nothing was selected').toBe(0);
    await awaitClick(30, 15);
    expect(getSelected().length).withContext('Second layer was selected').toBe(1);
    expect(getFirst()?.type).toBe('testSelect2')
    await awaitClick(15, 15, { shiftKey: true }, { shiftKey: true });
    expect(getSelected().length).withContext('Both are selected').toBe(2);
    await awaitClick(30, 15, { ctrlKey: true }, { ctrlKey: true });
    expect(getSelected().length).withContext('One was unselected with ctrl').toBe(1);
    expect(getFirst()?.type).toBe('testSelect1');
    await awaitClick(30, 15, { ctrlKey: true }, { ctrlKey: true });
    expect(getSelected().length).withContext('Reselected with control').toBe(2);
    await awaitClick(15, 15, { shiftKey: true }, { shiftKey: true });
    expect(getSelected().length).withContext('Shift key does nothing on already selected').toBe(2);
    await awaitClick(22.5, 15, { shiftKey: true }, { shiftKey: true });
    expect(getSelected().length).withContext('Shift key nowhere does not change selection').toBe(2);
  });

  it('has working see-through selection', async () => {
    /*
      +----------+
      |          |
      |    +----------+
      |    |          |
      |    |          |
      +----+          |
           |          |
           +----------+
    */
    await initialize(herald, [
      generateRandomLayer(
        'testSelect1',
        10, 10,
        40, 40,
      ),
      generateRandomLayer(
        'testSelect2',
        30, 30,
        40, 40,
      ),
    ], defaultSettings);

    await awaitClick(35, 35);
    expect(getSelected().length).withContext('Higher layer was selected').toBe(1);
    expect(getFirst()?.type).toBe('testSelect2')
    await awaitClick(35, 35);
    expect(getSelected().length).withContext('Amount of layer did not change').toBe(1);
    expect(getFirst()?.type).toBe('testSelect1')
    await awaitClick(35, 35);
    expect(getSelected().length).withContext('Amount of layer did not change').toBe(0);
    await awaitClick(35, 35);
    expect(getSelected().length).withContext('Higher layer was selected').toBe(1);
    expect(getFirst()?.type).toBe('testSelect2')
    await awaitClick(35, 35, { shiftKey: true });
    expect(getSelected().length).withContext('Both layers got selected').toBe(2);
    await awaitClick(35, 35, { shiftKey: true });
    expect(getSelected().length).withContext('Both layers are still selected').toBe(2);
  });
});