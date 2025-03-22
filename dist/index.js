// ../antetype-core/dist/index.js
var s = ((t) => (t.INIT = "antetype.init", t.CLOSE = "antetype.close", t.DRAW = "antetype.draw", t.CALC = "antetype.calc", t.RECALC_FINISHED = "antetype.recalc.finished", t.MODULES = "antetype.modules", t.SETTINGS = "antetype.settings.definition", t))(s || {});

// src/index.ts
var Event = /* @__PURE__ */ ((Event2) => {
  Event2["CALC"] = "antetype.cursor.calc";
  Event2["POSITION"] = "antetype.cursor.position";
  Event2["DOWN"] = "antetype.cursor.on.down";
  Event2["UP"] = "antetype.cursor.on.up";
  Event2["MOVE"] = "antetype.cursor.on.move";
  Event2["SLIP"] = "antetype.cursor.on.slip";
  return Event2;
})(Event || {});
var AntetypeCursor = class {
  #injected;
  #module = null;
  #instance = null;
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
    this.#instance = modules.cursor = this.#module({
      canvas,
      modules,
      injected: this.#injected
    });
  }
  // @TODO there is not unregister method to remove all subscriptions
  draw(event) {
    if (!this.#instance) {
      return;
    }
    const { element } = event.detail;
    const typeToAction = {
      selection: this.#instance.drawSelection
    };
    const el = typeToAction[element.type];
    if (typeof el == "function") {
      el(element);
    }
  }
  static subscriptions = {
    [s.MODULES]: "register",
    [s.DRAW]: "draw"
  };
};
var EnAntetypeCursor = AntetypeCursor;
var src_default = EnAntetypeCursor;
export {
  AntetypeCursor,
  Event,
  src_default as default
};
