// ../antetype-core/dist/index.js
var i = ((e) => (e.STRUCTURE = "antetype.structure", e.MIDDLE = "antetype.structure.middle", e.BAR_BOTTOM = "antetype.structure.bar.bottom", e.CENTER = "antetype.structure.center", e.COLUMN_LEFT = "antetype.structure.column.left", e.COLUMN_RIGHT = "antetype.structure.column.right", e.COLUMN_RIGHT_AFTER = "antetype.structure.column.right.after", e.COLUMN_RIGHT_BEFORE = "antetype.structure.column.right.before", e.BAR_TOP = "antetype.structure.bar.top", e.MODULES = "antetype.modules", e.ACTIONS = "antetype.structure.column.left.actions", e.PROPERTIES = "antetype.structure.column.left.properties", e.SHOW_PROPERTIES = "antetype.structure.column.left.properties.show", e))(i || {});
var c = ((r2) => (r2.INIT = "antetype.init", r2.CLOSE = "antetype.close", r2.DRAW = "antetype.draw", r2.CALC = "antetype.calc", r2.RECALC_FINISHED = "antetype.recalc.finished", r2.MODULES = "antetype.modules", r2))(c || {});
var s = class {
  #t;
  #r = null;
  #e = null;
  static inject = { minstrel: "boardmeister/minstrel", herald: "boardmeister/herald" };
  inject(t) {
    this.#t = t;
  }
  async #n(t, n) {
    if (!this.#e) {
      let o2 = this.#t.minstrel.getResourceUrl(this, "core.js");
      this.#r = (await import(o2)).default, this.#e = this.#r({ canvas: n, modules: t, injected: this.#t });
    }
    return this.#e;
  }
  async register(t) {
    let { modules: n, canvas: o2 } = t.detail;
    n.core = await this.#n(n, o2);
  }
  async init(t) {
    if (!this.#e) throw new Error("Instance not loaded, trigger registration event first");
    let { base: n, settings: o2 } = t.detail;
    for (let r2 in o2) this.#e.setting.set(r2, o2[r2]);
    let a = this.#e.meta.document;
    a.base = n;
    let l = [];
    return (this.#e.setting.get("fonts") ?? []).forEach((r2) => {
      l.push(this.#e.font.load(r2));
    }), await Promise.all(l), a.layout = await this.#e.view.recalculate(a, a.base), await this.#e.view.redraw(a.layout), a;
  }
  async cloneDefinitions(t) {
    if (!this.#e) throw new Error("Instance not loaded, trigger registration event first");
    t.detail.element !== null && (t.detail.element = await this.#e.clone.definitions(t.detail.element));
  }
  static subscriptions = { [i.MODULES]: "register", "antetype.init": "init", "antetype.calc": [{ method: "cloneDefinitions", priority: -255 }] };
};

// ../antetype-memento/dist/index.js
var r = ((e) => (e.STRUCTURE = "antetype.structure", e.MIDDLE = "antetype.structure.middle", e.BAR_BOTTOM = "antetype.structure.bar.bottom", e.CENTER = "antetype.structure.center", e.COLUMN_LEFT = "antetype.structure.column.left", e.COLUMN_RIGHT = "antetype.structure.column.right", e.BAR_TOP = "antetype.structure.bar.top", e.MODULES = "antetype.modules", e.ACTIONS = "antetype.structure.column.left.actions", e.PROPERTIES = "antetype.structure.column.left.properties", e))(r || {});
var i2 = ((t) => (t.SAVE = "antetype.memento.save", t))(i2 || {});
var o = class {
  #e;
  #t = null;
  #r = null;
  static inject = { minstrel: "boardmeister/minstrel", herald: "boardmeister/herald" };
  inject(t) {
    this.#e = t;
  }
  async register(t) {
    let { modules: s2, canvas: n } = t.detail;
    if (!this.#t) {
      let a = this.#e.minstrel.getResourceUrl(this, "module.js");
      this.#t = (await import(a)).default;
    }
    this.#r = s2.transform = this.#t({ canvas: n, modules: s2, injected: this.#e });
  }
  save(t) {
    this.#r && this.#r.addToStack(t.detail.state);
  }
  static subscriptions = { [r.MODULES]: "register", "antetype.memento.save": "save" };
};

// src/index.tsx
var Event = /* @__PURE__ */ ((Event2) => {
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
    [c.MODULES]: "register",
    [c.DRAW]: "draw"
  };
};
var EnAntetypeCursor = AntetypeCursor;
var src_default = EnAntetypeCursor;
export {
  AntetypeCursor,
  Event,
  src_default as default
};
