import type { IInjectable, Module } from "@boardmeister/marshal"
import type { Minstrel } from "@boardmeister/minstrel"
import type { Herald, ISubscriber, Subscriptions } from "@boardmeister/herald"
import type { ModulesEvent, Modules } from "@boardmeister/antetype"
import type { ICore, DrawEvent, IBaseDef } from "@boardmeister/antetype-core"
import type Cursor from "@src/module";
import { Event as AntetypeEvent } from "@boardmeister/antetype"
import { Event as AntetypeCoreEvent } from "@boardmeister/antetype-core"

export interface IRequiredModules extends Modules {
  core: ICore;
}

export interface SelectEvent {
  x: number;
  y: number;
}

export enum Event {
  SELECT = 'antetype.cursor.select',
}

export interface ICursor {
  drawSelection: (layer: IBaseDef) => void
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
    this.#instance = modules.transform = this.#module({
      canvas,
      modules: modules as IRequiredModules,
      injected: this.#injected!
    });
    this.#instance;
  }

  async draw(event: CustomEvent<DrawEvent>): Promise<void> {
    if (!this.#instance) {
      return;
    }
    const { element } = event.detail;
    const typeToAction: Record<string, (def: IBaseDef) => void> = {
      selection: this.#instance.drawSelection,
    };

    const el = typeToAction[element.type]
    if (typeof el == 'function') {
      await el(element);
    }
  }

  static subscriptions: Subscriptions = {
    [AntetypeEvent.MODULES]: 'register',
    [AntetypeCoreEvent.DRAW]: 'draw',
  }
}

const EnAntetypeCursor: IInjectable&ISubscriber = AntetypeCursor;
export default EnAntetypeCursor;
