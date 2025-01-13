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
  return Event22;
})(Event || {});

// ../antetype-core/dist/index.js
var i = ((t) => (t.STRUCTURE = "antetype.structure", t.MIDDLE = "antetype.structure.middle", t.BAR_BOTTOM = "antetype.structure.bar.bottom", t.CENTER = "antetype.structure.center", t.COLUMN_LEFT = "antetype.structure.column.left", t.COLUMN_RIGHT = "antetype.structure.column.right", t.BAR_TOP = "antetype.structure.bar.top", t.MODULES = "antetype.modules", t))(i || {});
var c = ((r) => (r.INIT = "antetype.init", r.DRAW = "antetype.draw", r.CALC = "antetype.calc", r))(c || {});
var s = class {
  #t;
  #r = null;
  #e = null;
  static inject = { minstrel: "boardmeister/minstrel", herald: "boardmeister/herald" };
  inject(e) {
    this.#t = e;
  }
  async #n(e, o) {
    if (!this.#e) {
      let r = this.#t.minstrel.getResourceUrl(this, "core.js");
      this.#r = (await import(r)).default, this.#e = this.#r({ canvas: o, modules: e, injected: this.#t });
    }
    return this.#e;
  }
  async register(e) {
    let { modules: o, canvas: r } = e.detail;
    o.core = await this.#n(o, r);
  }
  async init(e) {
    if (!this.#e) throw new Error("Instance not loaded, trigger registration event first");
    let { base: o, settings: r } = e.detail;
    for (let a in r) this.#e.setting.set(a, r[a]);
    let n = this.#e.meta.document;
    n.base = o;
    let l = [];
    return (this.#e.setting.get("fonts") ?? []).forEach((a) => {
      l.push(this.#e.font.load(a));
    }), await Promise.all(l), n.layout = await this.#e.view.recalculate(n, n.base), await this.#e.view.redraw(n.layout), console.log(n), n;
  }
  async cloneDefinitions(e) {
    if (!this.#e) throw new Error("Instance not loaded, trigger registration event first");
    e.detail.element !== null && (e.detail.element = await this.#e.clone.definitions(e.detail.element));
  }
  static subscriptions = { [i.MODULES]: "register", "antetype.init": "init", "antetype.calc": [{ method: "cloneDefinitions", priority: -255 }] };
};

// src/index.tsx
var Event2 = /* @__PURE__ */ ((Event3) => {
  Event3["SELECT"] = "antetype.cursor.select";
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
    this.#instance = modules.transform = this.#module({
      canvas,
      modules,
      injected: this.#injected
    });
    this.#instance;
  }
  async draw(event) {
    if (!this.#instance) {
      return;
    }
    const { element } = event.detail;
    const typeToAction = {
      selection: this.#instance.drawSelection
    };
    const el = typeToAction[element.type];
    if (typeof el == "function") {
      await el(element);
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
