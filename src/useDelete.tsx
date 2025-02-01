import type { IBaseDef, Layout } from "@boardmeister/antetype-core"
import type { SaveEvent, IMementoState } from "@boardmeister/antetype-memento"
import { ICursorParams } from "@src/index";
import { Selected } from "@src/useSelection";
import { Event as MementoEvent } from "@boardmeister/antetype-memento"

export interface IDelete {
}

export interface IDeleteSaveData {
}

export default function useDelete(
  {
    modules,
    injected: { herald },
    canvas,
  }: ICursorParams,
  selected: Selected,
): IDelete {
  canvas!.setAttribute('tabindex', '0');
  const onKeyUp = async (e: KeyboardEvent): Promise<void> => {
    if (e.target !== canvas && e.target !== document.body) {
      return;
    }

    if (e.code === "Delete" || e.code === "Backspace") {
      const keys = selected.keys();
      keys.forEach(key => {
        modules.core.manage.remove(key);
        selected.delete(key)
      });
      saveDelete(keys);
      await modules.core.view.recalculate();
      modules.core.view.redraw();
    }
  }

  const saveDelete = (layers: Layout): void => {
    const state: IMementoState<IDeleteSaveData>[] = [];
    layers.forEach(layer => {
      const original = modules.core.clone.getOriginal(layer);
      state.push({
        origin: 'cursor.delete',
        layer: original,
        data: {},
        undo: async (original: IBaseDef): Promise<void> => {
          modules.core.manage.add(original, original.hierarchy?.parent ?? null, original.hierarchy?.position ?? null);
          await modules.core.view.recalculate();
        },
        redo: async (original: IBaseDef): Promise<void> => {
          modules.core.manage.remove(original);
          await modules.core.view.recalculate();
        },
      });
    });

    if (state.length > 0) {
      void herald.dispatch(new CustomEvent<SaveEvent<IDeleteSaveData>>(MementoEvent.SAVE, { detail: { state } }));
    }
  }

  document.addEventListener('keyup', onKeyUp, false);
  return {};
}
