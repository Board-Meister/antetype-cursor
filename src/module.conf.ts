import type { IInjectable, Module } from "@boardmeister/marshal"
import type { Herald, ISubscriber, Subscriptions } from "@boardmeister/herald"
import type Cursor from "@src/module";
import type { ModulesEvent } from "@boardmeister/antetype-core"
import type { IRequiredModules } from "@src/type.d";
import type Marshal from "@boardmeister/marshal";
import { Event as AntetypeCoreEvent } from "@boardmeister/antetype-core"

export const ID = 'cursor';
export const VERSION = '0.0.5';

export interface IInjected extends Record<string, object> {
  marshal: Marshal;
  herald: Herald;
}

export class AntetypeCursor {
  #injected?: IInjected;
  #module: typeof Cursor|null = null;

  static inject: Record<string, string> = {
    marshal: 'boardmeister/marshal',
    herald: 'boardmeister/herald',
  }
  inject(injections: IInjected): void {
    this.#injected = injections;
  }

  register(event: ModulesEvent): void {
    const { registration } = event.detail;

    registration[ID] = {
      load: async () => {
        if (!this.#module) {
          const module = this.#injected!.marshal.getResourceUrl(this as Module, 'module.js');
          this.#module = ((await import(module)) as { default: typeof Cursor }).default;
        }
        return modules => this.#module!({
          modules: modules as IRequiredModules,
          herald: this.#injected!.herald
        })
      },
      version: VERSION,
    };
  }

  static subscriptions: Subscriptions = {
    [AntetypeCoreEvent.MODULES]: 'register',
  }
}

const EnAntetypeCursor: IInjectable<IInjected> & ISubscriber = AntetypeCursor;
export default EnAntetypeCursor;
