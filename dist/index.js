// ../antetype-core/dist/index.js
var o = { INIT: "antetype.init", CLOSE: "antetype.close", DRAW: "antetype.draw", CALC: "antetype.calc", RECALC_FINISHED: "antetype.recalc.finished", MODULES: "antetype.modules", SETTINGS: "antetype.settings.definition", TYPE_DEFINITION: "antetype.layer.type.definition", FONTS_LOADED: "antetype.font.loaded" };
var i = class {
  #e;
  #n = null;
  static inject = { minstrel: "boardmeister/minstrel", herald: "boardmeister/herald" };
  inject(e) {
    this.#e = e;
  }
  async #t(e, n) {
    let t = this.#e.minstrel.getResourceUrl(this, "core.js");
    return this.#n = (await import(t)).default, this.#n({ canvas: n, modules: e, herald: this.#e.herald });
  }
  async register(e) {
    let { modules: n, canvas: t } = e.detail;
    n.core = await this.#t(n, t);
  }
  static subscriptions = { [o.MODULES]: "register" };
};

// src/index.ts
var Event = /* @__PURE__ */ ((Event2) => {
  Event2["CALC"] = "antetype.cursor.calc";
  Event2["POSITION"] = "antetype.cursor.position";
  Event2["DOWN"] = "antetype.cursor.on.down";
  Event2["UP"] = "antetype.cursor.on.up";
  Event2["MOVE"] = "antetype.cursor.on.move";
  Event2["SLIP"] = "antetype.cursor.on.slip";
  Event2["RESIZED"] = "antetype.cursor.on.resized";
  return Event2;
})(Event || {});
var AntetypeCursor = class {
  #injected;
  #module = null;
  // #instance: ICursor|null = null;
  static inject = {
    minstrel: "boardmeister/minstrel",
    herald: "boardmeister/herald"
  };
  inject(injections) {
    this.#injected = injections;
  }
  async register(event) {
    const { modules, canvas } = event.detail;
    if (!this.#module) {
      const module = this.#injected.minstrel.getResourceUrl(this, "module.js");
      this.#module = (await import(module)).default;
    }
    modules.cursor = this.#module({
      canvas,
      modules,
      herald: this.#injected.herald
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
  static subscriptions = {
    [o.MODULES]: "register"
    // [AntetypeCoreEvent.DRAW]: 'draw',
  };
};
var EnAntetypeCursor = AntetypeCursor;
var src_default = EnAntetypeCursor;
export {
  AntetypeCursor,
  Event,
  src_default as default
};
