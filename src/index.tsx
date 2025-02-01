import type { IInjectable, Module } from "@boardmeister/marshal"
import type { Minstrel } from "@boardmeister/minstrel"
import type { Herald, ISubscriber, Subscriptions } from "@boardmeister/herald"
import type { ModulesEvent, Modules } from "@boardmeister/antetype"
import type { ICore, DrawEvent, IBaseDef } from "@boardmeister/antetype-core"
import type Cursor from "@src/module";
import { Event as AntetypeEvent } from "@boardmeister/antetype"
import { Event as AntetypeCoreEvent } from "@boardmeister/antetype-core"
import { IIterableWeakMap } from "@src/IterableWeakMap";

export interface IRequiredModules extends Modules {
  core: ICore;
}

export interface PositionEvent {
  x: number;
  y: number;
}

export enum Event {
  POSITION = 'antetype.cursor.position',
  DOWN = 'antetype.cursor.on.down',
  UP = 'antetype.cursor.on.up',
  MOVE = 'antetype.cursor.on.move',
  SLIP = 'antetype.cursor.on.slip',
}

export interface ICursor {
  selected: IIterableWeakMap<IBaseDef, true>;
  showSelected: () => void;
  isSelected: (needle: IBaseDef) => IBaseDef|false;
  drawSelection: (layer: IBaseDef) => void,
}

export interface ICursorParams {
  canvas: HTMLCanvasElement|null,
  modules: IRequiredModules,
  injected: IInjected,
}

interface IInjected extends Record<string, object> {
  minstrel: Minstrel;
  herald: Herald;
}

export class AntetypeCursor {
  #injected?: IInjected;
  #module: typeof Cursor|null = null;
  #instance: ICursor|null = null;

  static inject: Record<string, string> = {
    minstrel: 'boardmeister/minstrel',
    herald: 'boardmeister/herald',
  }
  inject(injections: IInjected): void {
    this.#injected = injections;
  }

  async register(event: CustomEvent<ModulesEvent>): Promise<void> {
    const { modules, canvas } = event.detail;
    if (!this.#module) {
      const module = this.#injected!.minstrel.getResourceUrl(this as Module, 'module.js');
      this.#module = ((await import(module)) as { default: typeof Cursor }).default;
    }
    this.#instance = modules.cursor = this.#module({
      canvas,
      modules: modules as IRequiredModules,
      injected: this.#injected!
    });
  }

  // @TODO there is not unregister method to remove all subscriptions

  draw(event: CustomEvent<DrawEvent>): void {
    if (!this.#instance) {
      return;
    }
    const { element } = event.detail;
    const typeToAction: Record<string, (def: IBaseDef) => void> = {
      selection: this.#instance.drawSelection,
    };

    const el = typeToAction[element.type]
    if (typeof el == 'function') {
      el(element);
    }
  }

  static subscriptions: Subscriptions = {
    [AntetypeEvent.MODULES]: 'register',
    [AntetypeCoreEvent.DRAW]: 'draw',
  }
}

export { DownEvent, UpEvent, MoveEvent, SlipEvent, IEvent, IEventDown, IEventHover } from "@src/useDetect";

const EnAntetypeCursor: IInjectable<IInjected> & ISubscriber = AntetypeCursor;
export default EnAntetypeCursor;
