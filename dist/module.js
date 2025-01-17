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
var setNewPositionOnOriginal = (modules, layer, x, y) => {
  if (layer.area) {
    if (!isNaN(layer.start.x)) layer.area.start.x += x;
    if (!isNaN(layer.start.y)) layer.area.start.y += y;
  }
  if (layer.start) {
    if (!isNaN(layer.start.x)) layer.start.x += x;
    if (!isNaN(layer.start.y)) layer.start.y += y;
  }
  const original = modules.core.clone.getOriginal(layer);
  if (modules.workspace) {
    const workspace = modules.workspace;
    if (original.start) {
      if (!isNaN(original.start.x)) original.start.x = workspace.toRelative(layer.start.x);
      if (!isNaN(original.start.y)) original.start.y = workspace.toRelative(layer.start.y, "y");
    }
    return;
  }
  const area = layer.area?.start ?? layer.start;
  if (area && original.start) {
    if (!isNaN(original.start.x)) original.start.x = area.x + x;
    if (!isNaN(original.start.y)) original.start.y = area.y + y;
  }
};

// src/useSelection.tsx
function useSelection({
  modules,
  injected: { herald }
}) {
  const selected = IterableWeakMap();
  let shown = [];
  let canMove = false;
  let skipUp = false;
  let seeThroughStackMap = IterableWeakMap();
  const core = modules.core;
  const resetSelected = () => {
    for (const key of selected.keys()) {
      selected.delete(key);
    }
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
    if (e.defaultPrevented || !canMove) {
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
      setNewPositionOnOriginal(modules, layer, movementX, movementY);
    });
    showSelected();
  };
  const selectionMouseUp = (event) => {
    if (event.defaultPrevented) {
      return;
    }
    canMove = false;
    if (skipUp) {
      skipUp = false;
      return;
    }
    const { target: { down } } = event.detail;
    const { shiftKey, ctrlKey } = down;
    if (!shiftKey && !ctrlKey) {
      resetSelected();
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
  const enableMove = (e) => {
    if (e.defaultPrevented) {
      return;
    }
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
}, selected) {
  const eventState = {
    selected,
    isDown: false,
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
    eventState.isDown = true;
    let { layerX: x, layerY: y } = e;
    const { shiftKey, ctrlKey } = e;
    const layout = core.meta.document.layout;
    ({ x, y } = await calcPosition(x, y));
    eventState.down.x = x;
    eventState.down.y = y;
    eventState.down.shiftKey = shiftKey;
    eventState.down.ctrlKey = ctrlKey;
    eventState.down.layers = getAllClickedLayers(layout, x, y);
    void herald.dispatch(new CustomEvent("antetype.cursor.on.down" /* DOWN */, {
      detail: {
        origin: e,
        target: eventState
      },
      cancelable: true
    }));
  };
  const onUp = async (e) => {
    eventState.isDown = false;
    await herald.dispatch(new CustomEvent("antetype.cursor.on.up" /* UP */, {
      detail: { origin: e, target: eventState },
      cancelable: true
    }));
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
      await herald.dispatch(new CustomEvent("antetype.cursor.on.slip" /* SLIP */, {
        detail: {
          origin: e,
          target: eventState,
          from: eventState.hover.layer,
          to: newLayer
        },
        cancelable: true
      }));
    }
    eventState.hover.layer = newLayer;
    await herald.dispatch(new CustomEvent("antetype.cursor.on.move" /* MOVE */, {
      detail: { origin: e, target: eventState },
      cancelable: true
    }));
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
  canvas,
  modules
}) {
  let mode = 8 /* NONE */, disableResize = false;
  const determinateCursorType = (layer, target) => {
    const { start: { x: sX, y: sY }, size: { h, w } } = layer;
    const { x, y } = target.hover;
    const bufferTop = 10, bufferBottom = 0;
    const top = y <= sY + bufferTop && y >= sY - bufferBottom, right = x <= sX + bufferBottom + w && x >= sX - bufferTop + w, bottom = y <= sY + bufferBottom + h && y >= sY - bufferTop + h, left = x <= sX + bufferTop && x >= sX - bufferBottom;
    if (top && left || bottom && right) {
      mode = top && left ? 6 /* TOP_LEFT */ : 5 /* BOTTOM_RIGHT */;
      return "nwse-resize";
    }
    if (top && right || bottom && left) {
      mode = top && right ? 4 /* TOP_RIGHT */ : 7 /* BOTTOM_LEFT */;
      return "nesw-resize";
    }
    if (top || bottom) {
      mode = top ? 0 /* TOP */ : 1 /* BOTTOM */;
      return "ns-resize";
    }
    if (left || right) {
      mode = left ? 3 /* LEFT */ : 2 /* RIGHT */;
      return "ew-resize";
    }
    resetMode();
    return "pointer";
  };
  const resetMode = () => {
    mode = 8 /* NONE */;
  };
  const handleMove = (e) => {
    if (disableResize) {
      return;
    }
    canvasCursorTypeChange(e);
    resizeSelected(e);
  };
  const resizeSelected = (e) => {
    const { target, origin } = e.detail;
    const layers = target.selected.keys();
    if (0 === layers.length || 8 /* NONE */ === mode || !target.isDown) {
      return;
    }
    let { movementY: y, movementX: x } = origin;
    if (mode === 3 /* LEFT */ || mode === 2 /* RIGHT */) y = 0;
    if (mode === 0 /* TOP */ || mode === 1 /* BOTTOM */) x = 0;
    for (const layer of layers) {
      resize(layer, x, y);
    }
  };
  const resize = (layer, x, y) => {
    if (mode !== 5 /* BOTTOM_RIGHT */ && mode !== 2 /* RIGHT */ && mode !== 1 /* BOTTOM */) {
      setNewPositionOnOriginal(
        modules,
        layer,
        mode === 4 /* TOP_RIGHT */ ? 0 : x,
        mode === 7 /* BOTTOM_LEFT */ ? 0 : y
      );
    }
    if (mode === 0 /* TOP */ || mode === 6 /* TOP_LEFT */ || mode === 4 /* TOP_RIGHT */) {
      y *= -1;
    }
    if (mode === 3 /* LEFT */ || mode === 6 /* TOP_LEFT */ || mode === 7 /* BOTTOM_LEFT */) {
      x *= -1;
    }
    changeLayerSize(layer, x, y);
    modules.core.view.redraw();
  };
  const changeLayerSize = (layer, x, y) => {
    if (layer.area) {
      if (!isNaN(layer.area.size.w)) layer.area.size.w += x;
      if (!isNaN(layer.area.size.h)) layer.area.size.h += y;
    }
    if (layer.start) {
      if (!isNaN(layer.size.w)) layer.size.w += x;
      if (!isNaN(layer.size.h)) layer.size.h += y;
    }
    const original = modules.core.clone.getOriginal(layer);
    if (modules.workspace) {
      const workspace = modules.workspace;
      if (!isNaN(original.size.w)) original.size.w = workspace.toRelative(layer.area.size.w);
      if (!isNaN(original.size.h)) original.size.h = workspace.toRelative(layer.area.size.h, "y");
      return;
    }
    const area = layer.area?.size ?? layer.size;
    if (!isNaN(original.size.w)) original.size.w = area.w + x;
    if (!isNaN(original.size.h)) original.size.h = area.h + y;
  };
  const canvasCursorTypeChange = (e) => {
    const { target } = e.detail;
    if (mode !== 8 /* NONE */) {
      e.preventDefault();
      if (target.isDown) {
        return;
      }
    }
    const layer = target.hover.layer;
    if (layer?.type === selectionType) {
      canvas.style.cursor = determinateCursorType(layer, target);
    } else {
      resetMode();
    }
  };
  const resetCanvasCursor = () => {
    canvas.style.cursor = "default";
  };
  const revertCursorToDefault = (e) => {
    const { from, target: { isDown } } = e.detail;
    if (isDown && mode !== 8 /* NONE */) {
      return;
    }
    resetMode();
    if (from?.type === selectionType) {
      resetCanvasCursor();
    }
  };
  const handleDown = (e) => {
    if (mode === 8 /* NONE */) {
      disableResize = true;
      return;
    }
    e.preventDefault();
  };
  const handleUpAfterResize = (e) => {
    disableResize = false;
    const { target } = e.detail;
    const layer = target.hover.layer;
    if (mode !== 8 /* NONE */) {
      e.preventDefault();
    }
    resetMode();
    if (layer?.type === selectionType) {
      canvas.style.cursor = determinateCursorType(layer, target);
    } else {
      resetCanvasCursor();
    }
  };
  herald.register("antetype.cursor.on.move" /* MOVE */, {
    method: handleMove,
    priority: -10
  });
  herald.register("antetype.cursor.on.slip" /* SLIP */, revertCursorToDefault);
  herald.register("antetype.cursor.on.down" /* DOWN */, {
    method: handleDown,
    priority: -10
  });
  herald.register("antetype.cursor.on.up" /* UP */, {
    method: handleUpAfterResize,
    priority: -10
  });
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
  const { onDown, onUp, onMove } = useDetect(params, selected);
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
