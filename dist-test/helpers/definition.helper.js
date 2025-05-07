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

// test/helpers/definition.helper.ts
var generateRandomLayer = (type, x = null, y = null, w = null, h = null) => ({
  type,
  start: { x: x ?? Math.random(), y: y ?? Math.random() },
  size: { w: w ?? Math.random(), h: h ?? Math.random() },
  _mark: Math.random()
});
var initialize = (herald, layout = null, settings = {}) => {
  return herald.dispatch(new CustomEvent(o.INIT, {
    detail: {
      base: layout ?? [
        generateRandomLayer("clear1"),
        generateRandomLayer("clear2"),
        generateRandomLayer("clear3"),
        generateRandomLayer("clear4")
      ],
      settings
    }
  }));
};
var close = (herald) => {
  return herald.dispatch(new CustomEvent(o.CLOSE));
};
var awaitEvent = (herald, event, timeout = 100) => {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      unregister();
      resolve();
    }, timeout);
    const unregister = herald.register(event, () => {
      unregister();
      resolve();
      clearTimeout(timeoutId);
    });
  });
};
var generateMouseEvent = (type, details = {}) => {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    ...details
  });
};
var awaitClick = async (herald, canvas, x, y, additionalDown = {}, additionalUp = {}) => {
  const down = generateMouseEvent("mousedown", {
    clientX: x,
    clientY: y,
    ...additionalDown
  });
  const up = generateMouseEvent("mouseup", {
    clientX: x,
    clientY: y,
    ...additionalUp
  });
  canvas.dispatchEvent(down);
  await awaitEvent(herald, "antetype.cursor.on.down" /* DOWN */);
  canvas.dispatchEvent(up);
  await awaitEvent(herald, "antetype.cursor.on.up" /* UP */);
};
export {
  awaitClick,
  awaitEvent,
  close,
  generateMouseEvent,
  generateRandomLayer,
  initialize
};
