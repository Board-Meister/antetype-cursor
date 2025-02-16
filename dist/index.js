// ../antetype-core/dist/index.js
var Event = /* @__PURE__ */ ((Event22) => {
  Event22["INIT"] = "antetype.init";
  Event22["CLOSE"] = "antetype.close";
  Event22["DRAW"] = "antetype.draw";
  Event22["CALC"] = "antetype.calc";
  Event22["RECALC_FINISHED"] = "antetype.recalc.finished";
  Event22["MODULES"] = "antetype.modules";
  return Event22;
})(Event || {});

// ../antetype-memento/dist/index.js
var r = ((e) => (e.STRUCTURE = "antetype.structure", e.MIDDLE = "antetype.structure.middle", e.BAR_BOTTOM = "antetype.structure.bar.bottom", e.CENTER = "antetype.structure.center", e.COLUMN_LEFT = "antetype.structure.column.left", e.COLUMN_RIGHT = "antetype.structure.column.right", e.BAR_TOP = "antetype.structure.bar.top", e.MODULES = "antetype.modules", e.ACTIONS = "antetype.structure.column.left.actions", e.PROPERTIES = "antetype.structure.column.left.properties", e))(r || {});
var i = ((t) => (t.SAVE = "antetype.memento.save", t))(i || {});
var o = class {
  #e;
  #t = null;
  #r = null;
  static inject = { minstrel: "boardmeister/minstrel", herald: "boardmeister/herald" };
  inject(t) {
    this.#e = t;
  }
  async register(t) {
    let { modules: s, canvas: n } = t.detail;
    if (!this.#t) {
      let a = this.#e.minstrel.getResourceUrl(this, "module.js");
      this.#t = (await import(a)).default;
    }
    this.#r = s.transform = this.#t({ canvas: n, modules: s, injected: this.#e });
  }
  save(t) {
    this.#r && this.#r.addToStack(t.detail.state);
  }
  static subscriptions = { [r.MODULES]: "register", "antetype.memento.save": "save" };
};

// src/index.tsx
var Event2 = /* @__PURE__ */ ((Event3) => {
  Event3["POSITION"] = "antetype.cursor.position";
  Event3["DOWN"] = "antetype.cursor.on.down";
  Event3["UP"] = "antetype.cursor.on.up";
  Event3["MOVE"] = "antetype.cursor.on.move";
  Event3["SLIP"] = "antetype.cursor.on.slip";
  return Event3;
})(Event2 || {});
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
    [Event.MODULES]: "register",
    [Event.DRAW]: "draw"
  };
};
var EnAntetypeCursor = AntetypeCursor;
var src_default = EnAntetypeCursor;
export {
  AntetypeCursor,
  Event2 as Event,
  src_default as default
};
