import type { IInjectable, Module } from "@boardmeister/marshal"
import type { Herald, ISubscriber, Subscriptions } from "@boardmeister/herald"
import type Cursor from "@src/module";
import { Event as AntetypeCoreEvent } from "@boardmeister/antetype-core"
import type { ModulesEvent } from "@boardmeister/antetype-core"
import type { IRequiredModules } from "@src/type.d";
import type Marshal from "@boardmeister/marshal";

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

  async register(event: CustomEvent<ModulesEvent>): Promise<void> {
    const { modules, canvas } = event.detail;
    if (!this.#module) {
      const module = this.#injected!.marshal.getResourceUrl(this as Module, 'module.js');
      this.#module = ((await import(module)) as { default: typeof Cursor }).default;
    }
    modules.cursor = this.#module({
      canvas,
      modules: modules as IRequiredModules,
      herald: this.#injected!.herald
    });
  }

  static subscriptions: Subscriptions = {
    [AntetypeCoreEvent.MODULES]: 'register',
  }
}

const EnAntetypeCursor: IInjectable<IInjected> & ISubscriber = AntetypeCursor;
export default EnAntetypeCursor;
