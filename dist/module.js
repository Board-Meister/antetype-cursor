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

// src/IterableWeakMap.tsx
function IterableWeakMap() {
  const weakMap = /* @__PURE__ */ new WeakMap(), arrKeys = [], arrValues = [], objectToIndex = /* @__PURE__ */ new WeakMap(), _ = {
    get [Symbol.toStringTag]() {
      return "IterableWeakMap";
    },
    get: (key) => weakMap.get(key),
    set: (key, value) => {
      if (weakMap.has(key)) {
        return _;
      }
      weakMap.set(key, value);
      objectToIndex.set(key, arrKeys.length);
      arrKeys.push(key);
      arrValues.push(value);
      return _;
    },
    delete: (key) => {
      if (!weakMap.get(key) || !objectToIndex.has(key)) {
        return false;
      }
      weakMap.delete(key);
      arrKeys.splice(objectToIndex.get(key), 1);
      arrValues.splice(objectToIndex.get(key), 1);
      objectToIndex.delete(key);
      return true;
    },
    has: (key) => weakMap.has(key),
    keys: () => arrKeys,
    values: () => arrValues,
    empty: () => !!arrValues.length,
    clone: () => {
      const cloned = IterableWeakMap();
      arrKeys.forEach((key) => {
        cloned.set(key, _.get(key));
      });
      return cloned;
    }
  };
  return Object.freeze(_);
}

// src/useSelection.tsx
function useSelection({
  modules,
  injected: { herald }
}) {
  let selected = IterableWeakMap();
  let shown = [];
  let seeThroughStackMap = IterableWeakMap();
  const eventState = {
    x: 0,
    y: 0,
    shiftKey: false,
    ctrlKey: false,
    layers: []
  };
  const core = modules.core;
  const getSizeAndStart = (layer) => {
    const size = layer.area?.size ?? layer.size;
    const start = layer.area?.start ?? layer.start;
    return {
      size,
      start
    };
  };
  const getAllClickedLayers = (layout, { x, y }) => {
    const clicked = [];
    for (let i2 = layout.length - 1; i2 >= 0; i2--) {
      const layer = layout[i2];
      if (layer.type === selectionType) {
        continue;
      }
      const { size, start } = getSizeAndStart(layer);
      if (!size || !layer) {
        continue;
      }
      const isClicked = x >= start.x && x <= size.w + start.x && y >= start.y && y <= size.h + start.y;
      if (!isClicked) {
        continue;
      }
      clicked.push(layer);
    }
    return clicked;
  };
  const select = async (e) => {
    let { layerX: x, layerY: y } = e;
    const { shiftKey, ctrlKey } = e;
    const layout = core.meta.document.layout;
    const event = new CustomEvent("antetype.cursor.select" /* SELECT */, { detail: { x, y } });
    await herald.dispatch(event);
    ({ x, y } = event.detail);
    eventState.x = x;
    eventState.y = y;
    eventState.shiftKey = shiftKey;
    eventState.ctrlKey = ctrlKey;
    const layers = getAllClickedLayers(layout, eventState);
    eventState.layers = layers;
  };
  const resetSelected = () => {
    selected = IterableWeakMap();
  };
  const resetSeeThroughStackMap = () => {
    seeThroughStackMap = IterableWeakMap();
  };
  const isSelected = (needle) => {
    for (const layer of selected.keys()) {
      if (needle === layer) {
        return needle;
      }
    }
    return false;
  };
  const isAnySelected = (needles) => {
    for (const layer of selected.keys()) {
      if (needles.includes(layer)) {
        return layer;
      }
    }
    return false;
  };
  const startSelectionMove = (e) => {
    if (0 === eventState.layers.length) {
      if (!e.shiftKey && !e.ctrlKey) {
        resetSelected();
        showSelected();
      }
      return;
    }
    const newSelectedLayer = eventState.layers[0];
    const selectedLayer = isAnySelected(eventState.layers);
    if (!seeThroughStackMap.has(newSelectedLayer) && !selectedLayer) {
      if (!eventState.shiftKey && !eventState.ctrlKey) {
        resetSelected();
      }
      selected.set(newSelectedLayer, true);
    } else if (selectedLayer) {
      selected.set(selectedLayer, true);
    }
    selected.keys().forEach((layer) => {
      if (layer.area) {
        if (layer.start) {
          setNewPositionOnOriginal(layer, e.movementX, e.movementY);
        }
        layer.area.start.x += e.movementX;
        layer.area.start.y += e.movementY;
      }
    });
    showSelected();
  };
  const setNewPositionOnOriginal = (layer, x, y) => {
    const area = layer.area?.start ?? {
      x: 0,
      y: 0
    };
    layer.start.x += x;
    layer.start.y += y;
    const original = modules.core.clone.getOriginal(layer);
    if (modules.workspace) {
      const workspace = modules.workspace;
      original.start.x = workspace.toRelative(layer.start.x);
      original.start.y = workspace.toRelative(layer.start.y, "y");
      return;
    }
    original.start.x = area.x + x;
    original.start.y = area.y + y;
  };
  const selectionMouseUp = () => {
    const { shiftKey, ctrlKey } = eventState;
    if (!shiftKey && !ctrlKey) {
      selected = IterableWeakMap();
    }
    let isFirst = true;
    let wasSelected = false;
    for (const layer of eventState.layers) {
      if (selected.has(layer) && ctrlKey) {
        selected.delete(layer);
        break;
      }
      if (!seeThroughStackMap.has(layer)) {
        selected.set(layer, true);
        wasSelected = true;
        if (isFirst) {
          resetSeeThroughStackMap();
        }
        seeThroughStackMap.set(layer, true);
        break;
      }
      isFirst = false;
    }
    if (!wasSelected) {
      seeThroughStackMap = IterableWeakMap();
    }
    showSelected();
    clearEventState();
  };
  const clearEventState = () => {
    eventState.x = 0;
    eventState.y = 0;
    eventState.shiftKey = false;
    eventState.ctrlKey = false;
    eventState.layers = [];
  };
  const showSelected = () => {
    for (const layer of shown) {
      core.manage.removeVolatile(layer);
    }
    shown = [];
    for (const layer of selected.keys()) {
      const { size, start } = getSizeAndStart(layer);
      const selection = {
        type: selectionType,
        size,
        start,
        selection: {
          layer
        }
      };
      shown.push(selection);
      core.manage.addVolatile(selection);
    }
    core.view.redraw();
  };
  return {
    select,
    selectionMouseUp,
    startSelectionMove,
    isSelected
  };
}

// src/module.tsx
var selectionType = "selection";
function Cursor(params) {
  const { canvas } = params;
  if (!canvas) {
    throw new Error("[Antetype Cursor] Canvas is empty!");
  }
  const ctx = canvas.getContext("2d");
  const { select, selectionMouseUp, startSelectionMove } = useSelection(params);
  const mouseDown = (e) => {
    void select(e);
    canvas.addEventListener("mousemove", mouseMove, false);
    canvas.addEventListener("mouseup", mouseUp, false);
  };
  const mouseUp = (e) => {
    e;
    selectionMouseUp();
    canvas.removeEventListener("mousemove", mouseMove, false);
    canvas.removeEventListener("mouseup", mouseUp, false);
  };
  const mouseUpRemoveMove = () => {
    canvas.removeEventListener("mousemove", mouseMove, false);
    canvas.removeEventListener("mouseup", mouseUpRemoveMove, false);
  };
  const mouseMove = (e) => {
    startSelectionMove(e);
    canvas.removeEventListener("mouseup", mouseUp, false);
    canvas.addEventListener("mouseup", mouseUpRemoveMove, false);
  };
  canvas.addEventListener("mousedown", mouseDown, false);
  const drawSelection = ({ start: { x, y }, size: { w, h } }) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  };
  return {
    drawSelection
  };
}
export {
  Cursor as default,
  selectionType
};
