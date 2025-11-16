import type { CanvasChangeEvent, IBaseDef, Layout } from "@boardmeister/antetype-core"
import type { SaveEvent, IMementoState } from "@boardmeister/antetype-memento"
import { Selected } from "@src/useSelection";
import { Event as MementoEvent } from "@boardmeister/antetype-memento"
import type { ICursorParams, ICursorSettings } from "@src/type.d";
import type { IEventRegistration } from "@boardmeister/herald";
import { Event as CoreEvent } from "@boardmeister/antetype-core"

export interface IDelete {
  onKeyUp: (e: KeyboardEvent) => Promise<void>;
  remove: (layers: IBaseDef[]) => Promise<void>;
  events: IEventRegistration[];
}

export interface IDeleteSaveData {
}

export default function useDelete(
  {
    modules,
    herald,
  }: ICursorParams,
  selected: Selected,
  settings: ICursorSettings,
): IDelete {
  const isDisabled = (): boolean => settings.delete?.disabled ?? false;

  const remove = async (layers: IBaseDef[]): Promise<void> => {
    layers.forEach(layer => {
      modules.core.manage.remove(layer);
      selected.delete(layer)
    });
    saveDelete(layers);
    await modules.core.view.recalculate();
    modules.core.view.redraw();
  }
  const onKeyUp = async (e: KeyboardEvent): Promise<void> => {
    const canvas = modules.core.meta.getCanvas();
    if (e.target !== canvas && e.target !== document.body || isDisabled()) {
      return;
    }

    if (e.code === "Delete" || e.code === "Backspace") {
      await remove(selected.keys())
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

  return {
    onKeyUp,
    remove,
    events: [
      {
        event: CoreEvent.CANVAS_CHANGE,
        subscription: ({ detail: { current } }: CanvasChangeEvent) => {
          if (current instanceof HTMLCanvasElement) {
            current.setAttribute('tabindex', '0');
          }
        }
      }
    ]
  };
}
