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
  async #n(e, n) {
    if (!this.#e) {
      let r = this.#t.minstrel.getResourceUrl(this, "core.js");
      this.#r = (await import(r)).default, this.#e = this.#r({ canvas: n, modules: e, injected: this.#t });
    }
    return this.#e;
  }
  async register(e) {
    let { modules: n, canvas: r } = e.detail;
    n.core = await this.#n(n, r);
  }
  async init(e) {
    if (!this.#e) throw new Error("Instance not loaded, trigger registration event first");
    let { base: n, settings: r } = e.detail;
    for (let a in r) this.#e.setting.set(a, r[a]);
    let o = this.#e.meta.document;
    o.base = n;
    let l = [];
    return (this.#e.setting.get("fonts") ?? []).forEach((a) => {
      l.push(this.#e.font.load(a));
    }), await Promise.all(l), o.layout = await this.#e.view.recalculate(o, o.base), await this.#e.view.redraw(o.layout), o;
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

// src/shared.tsx
var getSizeAndStart = (layer) => {
  const size = layer.area?.size ?? layer.size;
  const start = layer.area?.start ?? layer.start;
  return {
    size,
    start
  };
};
var isWithinLayer = (oX, oY, { x, y }, { w, h }) => oX >= x && oX <= w + x && oY >= y && oY <= h + y;
var getLayerByPosition = (layout, x, y, skipSelection = true) => {
  for (let i2 = layout.length - 1; i2 >= 0; i2--) {
    const layer = layout[i2];
    if (skipSelection && layer.type === selectionType) {
      continue;
    }
    const { size = null, start = null } = getSizeAndStart(layer);
    if (!size || !start) {
      continue;
    }
    if (!isWithinLayer(x, y, start, size)) {
      continue;
    }
    return layer;
  }
  return null;
};
var getAllClickedLayers = (layout, x, y, skipSelection = true) => {
  const clicked = [];
  for (let i2 = layout.length - 1; i2 >= 0; i2--) {
    const layer = layout[i2];
    if (skipSelection && layer.type === selectionType) {
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

// src/useSelection.tsx
function useSelection({
  modules,
  injected: { herald }
}) {
  let selected = IterableWeakMap();
  let shown = [];
  let canMove = false;
  let skipUp = false;
  let seeThroughStackMap = IterableWeakMap();
  const core = modules.core;
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
    if (!canMove) {
      return;
    }
    skipUp = true;
    const { target: { down }, origin: { movementX, movementY } } = e.detail;
    if (0 === down.layers.length) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
        showSelected();
      }
      return;
    }
    const newSelectedLayer = down.layers[0];
    const selectedLayer = isAnySelected(down.layers);
    if (!seeThroughStackMap.has(newSelectedLayer) && !selectedLayer) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
      }
      selected.set(newSelectedLayer, true);
    } else if (selectedLayer) {
      selected.set(selectedLayer, true);
    }
    selected.keys().forEach((layer) => {
      if (layer.area) {
        if (layer.start) {
          setNewPositionOnOriginal(layer, movementX, movementY);
        }
        layer.area.start.x += movementX;
        layer.area.start.y += movementY;
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
  const selectionMouseUp = (event) => {
    canMove = false;
    if (skipUp) {
      skipUp = false;
      return;
    }
    const { target: { down } } = event.detail;
    const { shiftKey, ctrlKey } = down;
    if (!shiftKey && !ctrlKey) {
      selected = IterableWeakMap();
    }
    let isFirst = true;
    let wasSelected = false;
    for (const layer of down.layers) {
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
  const enableMove = () => {
    canMove = true;
  };
  herald.register("antetype.cursor.on.down" /* DOWN */, enableMove);
  herald.register("antetype.cursor.on.up" /* UP */, selectionMouseUp);
  herald.register("antetype.cursor.on.move" /* MOVE */, startSelectionMove);
  return {
    selected,
    isSelected,
    showSelected
  };
}

// src/useDetect.tsx
function useDetect({
  injected: { herald },
  modules: { core }
}) {
  const eventState = {
    down: {
      layers: [],
      x: 0,
      y: 0,
      shiftKey: false,
      ctrlKey: false
    },
    hover: {
      layer: null,
      x: 0,
      y: 0
    }
  };
  const calcPosition = async (x, y) => {
    const event = new CustomEvent("antetype.cursor.position" /* POSITION */, { detail: { x, y } });
    await herald.dispatch(event);
    return event.detail;
  };
  const onDown = async (e) => {
    let { layerX: x, layerY: y } = e;
    const { shiftKey, ctrlKey } = e;
    const layout = core.meta.document.layout;
    ({ x, y } = await calcPosition(x, y));
    eventState.down.x = x;
    eventState.down.y = y;
    eventState.down.shiftKey = shiftKey;
    eventState.down.ctrlKey = ctrlKey;
    eventState.down.layers = getAllClickedLayers(layout, x, y);
    void herald.dispatch(new CustomEvent("antetype.cursor.on.down" /* DOWN */, { detail: {
      origin: e,
      target: eventState
    } }));
  };
  const onUp = async (e) => {
    await herald.dispatch(new CustomEvent("antetype.cursor.on.up" /* UP */, { detail: { origin: e, target: eventState } }));
    clearEventStateDown();
    await onMove(e);
  };
  const onMove = async (e) => {
    const layout = core.meta.document.layout;
    let { layerX: x, layerY: y } = e;
    ({ x, y } = await calcPosition(x, y));
    const newLayer = getLayerByPosition(layout, x, y, false);
    eventState.hover.x = x;
    eventState.hover.y = y;
    if (newLayer !== eventState.hover.layer) {
      await herald.dispatch(new CustomEvent("antetype.cursor.on.slip" /* SLIP */, { detail: {
        origin: e,
        target: eventState,
        from: eventState.hover.layer,
        to: newLayer
      } }));
    }
    eventState.hover.layer = newLayer;
    await herald.dispatch(new CustomEvent("antetype.cursor.on.move" /* MOVE */, { detail: { origin: e, target: eventState } }));
  };
  const clearEventStateDown = () => {
    eventState.down.x = 0;
    eventState.down.y = 0;
    eventState.down.shiftKey = false;
    eventState.down.ctrlKey = false;
    eventState.down.layers = [];
  };
  return {
    onDown,
    onUp,
    onMove
  };
}

// src/useDraw.tsx
function useDraw(ctx) {
  const drawSelection = ({ start: { x, y }, size: { w, h } }) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.strokeStyle = "#1e272e";
    ctx.stroke();
    ctx.restore();
  };
  return {
    drawSelection
  };
}

// src/useResize.tsx
function useResize({
  injected: { herald },
  canvas
}) {
  const determinateCursorType = (layer, target) => {
    const { start: { x: sX, y: sY }, size: { h, w } } = layer;
    const { x, y } = target.hover;
    const bufferTop = 5, bufferBottom = 15;
    const top = y <= sY + bufferTop && y >= sY - bufferBottom, right = x <= sX + bufferBottom + w && x >= sX - bufferTop + w, bottom = y <= sY + bufferBottom + h && y >= sY - bufferTop + h, left = x <= sX + bufferTop && x >= sX - bufferBottom;
    if (top && left || bottom && right) {
      return "nwse-resize";
    }
    if (top && right || bottom && left) {
      return "nesw-resize";
    }
    if (top || bottom) {
      return "ns-resize";
    }
    if (left || right) {
      return "ew-resize";
    }
    return "pointer";
  };
  const canvasCursorTypeChange = (e) => {
    const { target } = e.detail;
    const layer = target.hover.layer;
    if (layer?.type === selectionType) {
      const cursor = determinateCursorType(layer, target);
      ;
      canvas.style.cursor = cursor;
    }
  };
  const revertCursorToDefault = (e) => {
    const { from } = e.detail;
    if (from?.type === selectionType) {
      canvas.style.cursor = "default";
    }
  };
  herald.register("antetype.cursor.on.move" /* MOVE */, canvasCursorTypeChange);
  herald.register("antetype.cursor.on.slip" /* SLIP */, revertCursorToDefault);
}

// src/module.tsx
var selectionType = "selection";
function Cursor(params) {
  const { canvas } = params;
  if (!canvas) {
    throw new Error("[Antetype Cursor] Canvas is empty!");
  }
  const ctx = canvas.getContext("2d");
  const { drawSelection } = useDraw(ctx);
  const { selected, showSelected, isSelected } = useSelection(params);
  const { onDown, onUp, onMove } = useDetect(params);
  useResize(params);
  canvas.addEventListener("mousedown", onDown, false);
  canvas.addEventListener("mouseup", onUp, false);
  canvas.addEventListener("mousemove", onMove, false);
  return {
    drawSelection,
    selected,
    showSelected,
    isSelected
  };
}
export {
  Cursor as default,
  selectionType
};
