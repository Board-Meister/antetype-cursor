// ../../tool/antetype/dist/index.js
var Event = /* @__PURE__ */ ((Event22) => {
  Event22["STRUCTURE"] = "antetype.structure";
  Event22["MIDDLE"] = "antetype.structure.middle";
  Event22["BAR_BOTTOM"] = "antetype.structure.bar.bottom";
  Event22["CENTER"] = "antetype.structure.center";
  Event22["COLUMN_LEFT"] = "antetype.structure.column.left";
  Event22["COLUMN_RIGHT"] = "antetype.structure.column.right";
  Event22["BAR_TOP"] = "antetype.structure.bar.top";
  Event22["MODULES"] = "antetype.modules";
  Event22["ACTIONS"] = "antetype.structure.column.left.actions";
  Event22["PROPERTIES"] = "antetype.structure.column.left.properties";
  return Event22;
})(Event || {});

// ../antetype-core/dist/index.js
var i = ((e) => (e.STRUCTURE = "antetype.structure", e.MIDDLE = "antetype.structure.middle", e.BAR_BOTTOM = "antetype.structure.bar.bottom", e.CENTER = "antetype.structure.center", e.COLUMN_LEFT = "antetype.structure.column.left", e.COLUMN_RIGHT = "antetype.structure.column.right", e.BAR_TOP = "antetype.structure.bar.top", e.MODULES = "antetype.modules", e.ACTIONS = "antetype.structure.column.left.actions", e.PROPERTIES = "antetype.structure.column.left.properties", e))(i || {});
var c = ((r2) => (r2.INIT = "antetype.init", r2.CLOSE = "antetype.close", r2.DRAW = "antetype.draw", r2.CALC = "antetype.calc", r2))(c || {});
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
    for (let a in o2) this.#e.setting.set(a, o2[a]);
    let r2 = this.#e.meta.document;
    r2.base = n;
    let l = [];
    return (this.#e.setting.get("fonts") ?? []).forEach((a) => {
      l.push(this.#e.font.load(a));
    }), await Promise.all(l), r2.layout = await this.#e.view.recalculate(r2, r2.base), await this.#e.view.redraw(r2.layout), r2;
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
    [c.DRAW]: "draw"
  };
};
var EnAntetypeCursor = AntetypeCursor;
var src_default = EnAntetypeCursor;
export {
  AntetypeCursor,
  Event2 as Event,
  src_default as default
};
