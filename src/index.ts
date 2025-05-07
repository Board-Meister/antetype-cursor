import type { IInjectable, Module } from "@boardmeister/marshal"
import type { Minstrel } from "@boardmeister/minstrel"
import type { Herald, ISubscriber, Subscriptions } from "@boardmeister/herald"
import type { ModulesEvent, Modules, ICore, IBaseDef } from "@boardmeister/antetype-core"
import type Cursor from "@src/module";
import { Event as AntetypeCoreEvent } from "@boardmeister/antetype-core"
import { IIterableWeakMap } from "@src/IterableWeakMap";

export interface IRequiredModules extends Modules {
  core: ICore;
}

export interface PositionEvent {
  x: number;
  y: number;
}

export interface CalcEvent {
  values: Record<string, number>;
}

export enum Event {
  CALC = 'antetype.cursor.calc',
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
  resetSeeThroughStackMap: VoidFunction;
}

export interface ICursorParams {
  canvas: HTMLCanvasElement|null,
  modules: IRequiredModules,
  herald: Herald,
}

export interface ICursorSettings {
  draw?: {
    disabled?: boolean;
  }
  select?: {
    disabled?: boolean;
  }
  detect?: {
    disabled?: boolean;
    move?: {
      skipSelection?: boolean;
    }
  }
  resize?: {
    disabled?: boolean;
    buffer?: number;
  }
  delete?: {
    disabled?: boolean;
  }
}

export interface IInjected extends Record<string, object> {
  minstrel: Minstrel;
  herald: Herald;
}

export class AntetypeCursor {
  #injected?: IInjected;
  #module: typeof Cursor|null = null;
  // #instance: ICursor|null = null;

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
    modules.cursor = this.#module({
      canvas,
      modules: modules as IRequiredModules,
      herald: this.#injected!.herald
    });
  }

  // draw(event: CustomEvent<DrawEvent>): void {
  //   if (!this.#instance) {
  //     return;
  //   }
  //   const { element } = event.detail;
  //   const typeToAction: Record<string, (def: IBaseDef) => void> = {
  //     selection: this.#instance.drawSelection,
  //   };

  //   const el = typeToAction[element.type]
  //   if (typeof el == 'function') {
  //     el(element);
  //   }
  // }

  static subscriptions: Subscriptions = {
    [AntetypeCoreEvent.MODULES]: 'register',
    // [AntetypeCoreEvent.DRAW]: 'draw',
  }
}

export type { DownEvent, UpEvent, MoveEvent, SlipEvent, IEvent, IEventDown, IEventHover } from "@src/useDetect";

const EnAntetypeCursor: IInjectable<IInjected> & ISubscriber = AntetypeCursor;
export default EnAntetypeCursor;
