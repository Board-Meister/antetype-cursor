import type { ICore, Layout } from "@boardmeister/antetype-core";
import Core from "@boardmeister/antetype-core/src/core";
import { Herald } from "@boardmeister/herald";
import { type ICursor } from "@src/index";
import Cursor from "@src/module";
import {
  initialize, close, generateRandomLayer, defaultSettings, awaitClick as awaitClickBase, generateKeyboardEvent
} from "test/helpers/definition.helper";
import { Event as MementoEvent, type SaveEvent } from "@boardmeister/antetype-memento"
import type { IDeleteSaveData } from "@src/useDelete";

describe('Deleting selection', () => {
  let cursor: ICursor, core: ICore;
  const herald = new Herald();
  const canvas = document.createElement('canvas');
  const awaitClick = (...rest: unknown[]): Promise<void> => awaitClickBase(herald, canvas, ...rest);
  const getSelected = (): Layout => cursor.selected.keys();
  beforeEach(() => {
    core = Core({ herald, canvas }) as ICore;
    cursor = Cursor({ canvas, modules: { core }, herald });
  });

  afterEach(async () => {
    await close(herald);
  })

  it('is done correctly and can be redone', async () => {
    await initialize(herald, [
      generateRandomLayer(
        'testDelete',
        10, 10,
        10, 10,
      )
    ], defaultSettings);

    let stateEvent: CustomEvent<SaveEvent<IDeleteSaveData>>;
    await awaitClick(15, 15);
    const unregister = herald.register(
      MementoEvent.SAVE,
      (e: CustomEvent<SaveEvent<IDeleteSaveData>>) => {
        stateEvent = e;
      }
    );
    expect(getSelected().length).withContext('First layer was selected').toBe(1);
    canvas.dispatchEvent(generateKeyboardEvent('keyup', 'Delete'));
    expect(core.meta.document.base.length).toBe(0);
    const { state } = stateEvent!.detail;
    const { layer, data, undo, redo } = state[0];
    await undo(layer, data!);
    expect(core.meta.document.base.length).toBe(1);
    await redo(layer, data!);
    expect(core.meta.document.base.length).toBe(0);
    unregister();
  });
});