// ../antetype-core/dist/index.js
var o = ((e) => (e.INIT = "antetype.init", e.CLOSE = "antetype.close", e.DRAW = "antetype.draw", e.CALC = "antetype.calc", e.RECALC_FINISHED = "antetype.recalc.finished", e.MODULES = "antetype.modules", e.SETTINGS = "antetype.settings.definition", e))(o || {});

// src/index.ts
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
      herald: this.#injected.herald
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
    [o.MODULES]: "register",
    [o.DRAW]: "draw"
  };
};

// ../antetype-memento/dist/index.js
var i = ((e) => (e.INIT = "antetype.init", e.CLOSE = "antetype.close", e.DRAW = "antetype.draw", e.CALC = "antetype.calc", e.RECALC_FINISHED = "antetype.recalc.finished", e.MODULES = "antetype.modules", e.SETTINGS = "antetype.settings.definition", e))(i || {});
var o2 = ((t) => (t.SAVE = "antetype.memento.save", t))(o2 || {});
var n = class {
  #e;
  #t = null;
  #i = null;
  static inject = { minstrel: "boardmeister/minstrel", herald: "boardmeister/herald" };
  inject(t) {
    this.#e = t;
  }
  async register(t) {
    let { modules: s, canvas: r } = t.detail;
    if (!this.#t) {
      let a = this.#e.minstrel.getResourceUrl(this, "module.js");
      this.#t = (await import(a)).default;
    }
    this.#i = s.memento = this.#t({ canvas: r, modules: s, injected: this.#e });
  }
  save(t) {
    this.#i && this.#i.addToStack(t.detail.state);
  }
  static subscriptions = { [i.MODULES]: "register", "antetype.memento.save": "save" };
};

// src/IterableWeakMap.ts
function IterableWeakMap() {
  let weakMap = /* @__PURE__ */ new WeakMap(), arrKeys = [], arrValues = [], objectToIndex = /* @__PURE__ */ new WeakMap();
  const _ = {
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
      if (!weakMap.has(key) && objectToIndex.has(key)) {
        return false;
      }
      if (weakMap.has(key)) {
        weakMap.delete(key);
      }
      if (objectToIndex.has(key)) {
        arrKeys.splice(objectToIndex.get(key), 1);
        arrValues.splice(objectToIndex.get(key), 1);
        objectToIndex.delete(key);
        arrKeys.forEach((value, i2) => {
          objectToIndex.set(value, i2);
        });
      }
      return true;
    },
    first: () => arrValues[0] ?? null,
    last: () => arrValues.slice(-1)[0] ?? null,
    firstKey: () => arrKeys[0] ?? null,
    lastKey: () => arrKeys.slice(-1)[0] ?? null,
    has: (key) => weakMap.has(key),
    keys: () => [...arrKeys],
    values: () => [...arrValues],
    empty: () => arrValues.length == 0,
    reset: function() {
      weakMap = /* @__PURE__ */ new WeakMap();
      objectToIndex = /* @__PURE__ */ new WeakMap();
      arrKeys = [];
      arrValues = [];
    },
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

// src/shared.ts
var calc = (herald, toCalc) => {
  const event = new CustomEvent("antetype.cursor.calc" /* CALC */, { detail: { values: toCalc } });
  herald.dispatchSync(event);
  return event.detail.values;
};
var getSizeAndStart = (layer) => {
  let w = 0, h = 0, x = 0, y = 0;
  if (layer.size || layer.area?.size) {
    ({ w, h } = layer.area?.size ?? layer.size);
  }
  if (layer.start || layer.area?.start) {
    ({ x, y } = layer.area?.start ?? layer.start);
  }
  if (layer.hierarchy?.parent) {
    const { start } = getSizeAndStart(layer.hierarchy.parent);
    x += start.x;
    y += start.y;
  }
  return {
    size: { w, h },
    start: { x, y }
  };
};
var isWithinLayer = (oX, oY, { x, y }, { w, h }) => oX >= x && oX <= w + x && oY >= y && oY <= h + y;
var getLayerByPosition = (layout, x, y, skipSelection = true, deep = false) => {
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
    if (deep && layer.layout) {
      const subLayer = getLayerByPosition(
        layer.layout,
        x,
        y,
        skipSelection,
        true
      );
      if (subLayer) return subLayer;
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
var isEditable = (value) => typeof value == "number" && isNaN(value) || typeof value == "undefined";
var setNewPositionOnOriginal = (modules, layer, x, y) => {
  layer = modules.core.clone.getClone(layer);
  if (layer.area) {
    if (!isEditable(layer.area.start.x)) layer.area.start.x += x;
    if (!isEditable(layer.area.start.y)) layer.area.start.y += y;
  }
  if (layer.start) {
    if (!isEditable(layer.start.x)) layer.start.x += x;
    if (!isEditable(layer.start.y)) layer.start.y += y;
  }
  const original = modules.core.clone.getOriginal(layer);
  if (modules.workspace) {
    const workspace = modules.workspace;
    if (original.start) {
      if (!isEditable(original.start.x)) original.start.x = workspace.toRelative(layer.start.x);
      if (!isEditable(original.start.y)) original.start.y = workspace.toRelative(layer.start.y, "y");
    }
    return;
  }
  const area = layer.area?.start ?? layer.start;
  if (area && original.start) {
    if (!isEditable(original.start.x)) original.start.x = area.x + x;
    if (!isEditable(original.start.y)) original.start.y = area.y + y;
  }
};

// src/useSelection.ts
function getLayerFromSelection(layer) {
  if (layer.type === selectionType) {
    return layer.selection.layer;
  }
  return layer;
}
function useSelection({
  modules,
  herald
}, settings) {
  const selected = IterableWeakMap();
  let shown = [];
  let canMove = false;
  let skipUp = false;
  let skipMove = true;
  let accumulatedMoveX = 0;
  let accumulatedMoveY = 0;
  let seeThroughStackMap = IterableWeakMap();
  const core = modules.core;
  const innerSettings = {
    moveBufor: 5
  };
  const isDisabled = () => settings.select?.disabled ?? false;
  const resetSelected = () => {
    while (!selected.empty()) {
      selected.delete(selected.firstKey());
    }
  };
  const resetSeeThroughStackMap = () => {
    seeThroughStackMap = IterableWeakMap();
  };
  const isSelected = (needle) => {
    const original = core.clone.getOriginal(needle);
    if (selected.has(original)) {
      return original;
    }
    return false;
  };
  const isAnySelected = (needles) => {
    for (const needle of needles) {
      const original = core.clone.getOriginal(needle);
      if (selected.has(original)) {
        return original;
      }
    }
    return false;
  };
  const saveSelectedPosition = () => {
    const layers = selected.keys();
    const state = [];
    layers.forEach((original) => {
      const layer = modules.core.clone.getClone(original);
      state.push({
        origin: "cursor.move",
        layer: original,
        data: {
          x: layer.area.start.x,
          y: layer.area.start.y,
          after: {
            x: 0,
            y: 0
          }
        },
        undo: (original2, data) => {
          const clone = modules.core.clone.getClone(original2);
          data.after.x = clone.area.start.x;
          data.after.y = clone.area.start.y;
          setNewPositionOnOriginal(modules, original2, data.x - clone.area.start.x, data.y - clone.area.start.y);
        },
        redo: (original2, data) => {
          setNewPositionOnOriginal(modules, original2, data.after.x - data.x, data.after.y - data.y);
        }
      });
    });
    if (state.length > 0) {
      void herald.dispatch(new CustomEvent(o2.SAVE, { detail: { state } }));
    }
  };
  const shouldSkipMove = (e) => {
    if (!skipMove) {
      return false;
    }
    const { origin: { movementX, movementY } } = e.detail;
    accumulatedMoveX += movementX;
    accumulatedMoveY += movementY;
    if (Math.abs(accumulatedMoveX) > innerSettings.moveBufor || Math.abs(accumulatedMoveY) > innerSettings.moveBufor) {
      skipMove = false;
      return false;
    }
    return true;
  };
  const startSelectionMove = (e) => {
    if (e.defaultPrevented || !canMove || shouldSkipMove(e)) {
      return;
    }
    const isFirstMotionAfterDown = !skipUp;
    skipUp = true;
    const { target: { down, hover: { mY, mX } } } = e.detail;
    if (0 === down.layers.length) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
        showSelected();
      }
      return;
    }
    const newSelectedLayer = core.clone.getOriginal(down.layers[0]);
    const selectedLayer = isAnySelected(down.layers);
    if (!seeThroughStackMap.has(newSelectedLayer) && !selectedLayer) {
      if (!down.shiftKey && !down.ctrlKey) {
        resetSelected();
      }
      selected.set(newSelectedLayer, true);
    } else if (selectedLayer) {
      selected.set(selectedLayer, true);
    }
    if (isFirstMotionAfterDown) {
      saveSelectedPosition();
    }
    selected.keys().forEach((layer) => {
      if (layer.hierarchy?.parent !== modules.core.meta.document) {
        return;
      }
      const scale = modules.workspace.getScale();
      setNewPositionOnOriginal(modules, layer, mX / scale, mY / scale);
    });
    showSelected();
  };
  const selectionMouseUp = (event) => {
    if (event.defaultPrevented || event.detail.origin.button !== 0) {
      return;
    }
    accumulatedMoveX = 0;
    accumulatedMoveY = 0;
    skipMove = true;
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
      const origin = modules.core.clone.getOriginal(layer);
      if (selected.has(origin) && ctrlKey) {
        selected.delete(origin);
        break;
      }
      if (!seeThroughStackMap.has(origin)) {
        selected.set(origin, true);
        wasSelected = true;
        if (isFirst) {
          resetSeeThroughStackMap();
        }
        seeThroughStackMap.set(origin, true);
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
      const { size, start } = getSizeAndStart(core.clone.getClone(layer));
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
    if (e.defaultPrevented || e.detail.origin.button !== 0) {
      return;
    }
    canMove = true;
  };
  const unregister = herald.batch([
    {
      event: "antetype.cursor.on.down" /* DOWN */,
      subscription: (e) => {
        if (isDisabled()) {
          return;
        }
        enableMove(e);
      }
    },
    {
      event: "antetype.cursor.on.up" /* UP */,
      subscription: (e) => {
        if (isDisabled()) {
          return;
        }
        selectionMouseUp(e);
      }
    },
    {
      event: "antetype.cursor.on.move" /* MOVE */,
      subscription: (e) => {
        if (isDisabled()) {
          return;
        }
        startSelectionMove(e);
      }
    },
    {
      event: o.CLOSE,
      subscription: {
        method: () => {
          unregister();
        }
      }
    }
  ]);
  return {
    selected,
    isSelected,
    showSelected,
    resetSeeThroughStackMap
  };
}

// src/useDetect.ts
function useDetect({
  herald,
  modules: { core },
  canvas
}, selected, settings) {
  const eventState = {
    selected,
    isDown: false,
    wasMoved: false,
    down: {
      layers: [],
      x: 0,
      y: 0,
      shiftKey: false,
      ctrlKey: false
    },
    hover: {
      layer: null,
      deep: null,
      x: 0,
      y: 0,
      mX: 0,
      mY: 0
    }
  };
  const isDisabled = () => settings.detect?.disabled ?? false;
  const skipSelectionOnMove = () => settings.detect?.move?.skipSelection ?? false;
  const calcPosition = async (x, y) => {
    const boundingBox = canvas.getBoundingClientRect();
    x -= boundingBox.left;
    y -= boundingBox.top;
    const event = new CustomEvent("antetype.cursor.position" /* POSITION */, { detail: { x, y } });
    await herald.dispatch(event);
    return event.detail;
  };
  const onDown = async (e) => {
    if (isDisabled()) {
      return;
    }
    eventState.isDown = true;
    eventState.wasMoved = false;
    let { clientX: x, clientY: y } = e;
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
    if (isDisabled()) {
      return;
    }
    eventState.isDown = false;
    await herald.dispatch(new CustomEvent("antetype.cursor.on.up" /* UP */, {
      detail: { origin: e, target: eventState },
      cancelable: true
    }));
    clearEventStateDown();
    await onMove(e);
  };
  const onMove = async (e) => {
    if (isDisabled()) {
      return;
    }
    eventState.wasMoved = true;
    const layout = core.meta.document.layout;
    let { clientX: x, clientY: y, movementX, movementY } = e;
    ({ x, y } = await calcPosition(x, y));
    ({ movementX, movementY } = calc(herald, { movementX, movementY }));
    const newLayer = getLayerByPosition(layout, x, y, skipSelectionOnMove());
    const newDeepLayer = getLayerByPosition(layout, x, y, skipSelectionOnMove(), true);
    eventState.hover.x = x;
    eventState.hover.y = y;
    eventState.hover.mY = movementY;
    eventState.hover.mX = movementX;
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
    eventState.hover.deep = newDeepLayer;
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
  const onOut = async (e) => {
    await herald.dispatch(new CustomEvent("antetype.cursor.on.slip" /* SLIP */, {
      detail: {
        origin: e,
        target: eventState,
        from: eventState.hover.layer,
        to: null
      },
      cancelable: true
    }));
    eventState.hover.layer = null;
    eventState.hover.deep = null;
  };
  return {
    onDown,
    onUp,
    onMove,
    onOut
  };
}

// src/useDraw.ts
function useDraw(herald, ctx) {
  const drawSelectionRect = (x, y, w, h, thickness, fill) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.lineWidth = thickness;
    ctx.strokeStyle = fill;
    ctx.stroke();
    ctx.restore();
  };
  const drawSelection = ({ start: { x, y }, size: { w, h } }) => {
    const unit = calc(herald, { unit: 1 }).unit;
    drawSelectionRect(
      x - unit * 2,
      y - unit * 2,
      w + unit * 4,
      h + unit * 4,
      unit,
      "#FFF"
    );
    drawSelectionRect(
      x - unit,
      y - unit,
      w + unit * 2,
      h + unit * 2,
      unit,
      "#1e272e"
    );
  };
  return {
    drawSelection
  };
}

// src/useResize.ts
function useResize({
  herald,
  canvas,
  modules
}, showSelected, settings) {
  let mode = 8 /* NONE */, disableResize = false, resizeInProgress = false, saved = false;
  const eventSnapshot = {
    waiting: false,
    layout: null,
    movement: null
  };
  const isDisabled = () => settings.resize?.disabled ?? false;
  const determinateCursorType = (layer, target) => {
    if (layer.selection.layer.hierarchy?.parent !== modules.core.meta.document) {
      return "default";
    }
    const { start: { x: sX, y: sY }, size: { h, w } } = layer;
    const { x, y } = target.hover;
    const bufferTop = calc(herald, { bufferTop: 10 }).bufferTop, bufferBottom = 0;
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
    let { target: { hover: { layer } } } = e.detail;
    if (layer) {
      layer = getLayerFromSelection(modules.core.clone.getClone(layer));
      const original = modules.core.clone.getOriginal(layer);
      if (!original?.size) {
        return;
      }
    }
    canvasCursorTypeChange(e);
    resizeSelected(e);
  };
  const resizeSelected = (e) => {
    const { target } = e.detail;
    const layers = target.selected.keys();
    if (0 === layers.length || 8 /* NONE */ === mode || !target.isDown) {
      return;
    }
    let { hover: { mX: x, mY: y } } = target;
    if (mode === 3 /* LEFT */ || mode === 2 /* RIGHT */) y = 0;
    if (mode === 0 /* TOP */ || mode === 1 /* BOTTOM */) x = 0;
    const scale = modules.workspace.getScale();
    x /= scale;
    y /= scale;
    if (resizeInProgress) {
      eventSnapshot.waiting = true;
      eventSnapshot.movement = { x, y };
      eventSnapshot.layout = layers;
      return;
    }
    saveResize(layers);
    bulkResize(layers, x, y);
  };
  const bulkResize = (layout, x, y) => {
    for (const layer of layout) {
      resize(layer, x, y);
    }
  };
  const resize = (original, x, y) => {
    const layer = modules.core.clone.getClone(original);
    if (layer.hierarchy?.parent !== modules.core.meta.document) {
      return;
    }
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
    void changeLayerSize(layer, x, y);
  };
  const saveResize = (layers) => {
    if (saved) {
      return;
    }
    saved = true;
    const state = [];
    layers.forEach((original) => {
      const layer = modules.core.clone.getClone(original);
      state.push({
        origin: "cursor.move",
        layer: original,
        data: {
          x: layer.start.x,
          y: layer.start.y,
          w: layer.size.w,
          h: layer.size.h,
          after: {
            w: 0,
            h: 0,
            x: 0,
            y: 0
          }
        },
        undo: async (original2, data) => {
          const clone = modules.core.clone.getClone(original2);
          data.after.x = clone.start.x;
          data.after.y = clone.start.y;
          setNewPositionOnOriginal(modules, original2, data.x - clone.start.x, data.y - clone.start.y);
          data.after.w = clone.size.w;
          data.after.h = clone.size.h;
          await changeLayerSize(original2, data.w - clone.size.w, data.h - clone.size.h);
        },
        redo: async (original2, data) => {
          setNewPositionOnOriginal(modules, original2, data.after.x - data.x, data.after.y - data.y);
          await changeLayerSize(original2, data.after.w - data.w, data.after.h - data.h);
        }
      });
    });
    if (state.length > 0) {
      void herald.dispatch(new CustomEvent(o2.SAVE, { detail: { state } }));
    }
  };
  const changeLayerSize = async (original, x, y) => {
    if (!original.size) {
      return;
    }
    const layer = modules.core.clone.getClone(original);
    if (layer.area) {
      if (!isEditable(layer.area.size.w)) layer.area.size.w += x;
      if (!isEditable(layer.area.size.h)) layer.area.size.h += y;
    }
    original = modules.core.clone.getOriginal(layer);
    if (modules.workspace) {
      const workspace = modules.workspace;
      original.size.w = workspace.toRelative(layer.area.size.w);
      original.size.h = workspace.toRelative(layer.area.size.h, "y");
    } else {
      const area = layer.area?.size ?? layer.size;
      original.size.w = area.w + x;
      original.size.h = area.h + y;
    }
    resizeInProgress = true;
    await modules.core.manage.resize(original, original.size);
    showSelected();
    modules.core.view.redraw();
    resizeInProgress = false;
    if (eventSnapshot.waiting) {
      const { layout, movement } = eventSnapshot;
      const { x: x2, y: y2 } = movement;
      resetEventSnapshot();
      bulkResize(layout, x2, y2);
    }
  };
  const resetEventSnapshot = () => {
    eventSnapshot.waiting = false;
    eventSnapshot.movement = null;
    eventSnapshot.layout = null;
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
    saved = false;
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
  const unregister = herald.batch([
    {
      event: "antetype.cursor.on.move" /* MOVE */,
      subscription: {
        method: (e) => {
          if (isDisabled()) {
            return;
          }
          handleMove(e);
        },
        priority: -10
      }
    },
    {
      event: "antetype.cursor.on.slip" /* SLIP */,
      subscription: {
        method: (e) => {
          if (isDisabled()) {
            return;
          }
          revertCursorToDefault(e);
        }
      }
    },
    {
      event: "antetype.cursor.on.down" /* DOWN */,
      subscription: {
        method: (e) => {
          if (isDisabled()) {
            return;
          }
          handleDown(e);
        },
        priority: -10
      }
    },
    {
      event: "antetype.cursor.on.up" /* UP */,
      subscription: {
        method: (e) => {
          if (isDisabled()) {
            return;
          }
          handleUpAfterResize(e);
        },
        priority: -10
      }
    },
    {
      event: o.CLOSE,
      subscription: {
        method: () => {
          unregister();
        }
      }
    }
  ]);
}

// src/useDelete.ts
function useDelete({
  modules,
  herald,
  canvas
}, selected, settings) {
  canvas.setAttribute("tabindex", "0");
  const isDisabled = () => settings.delete?.disabled ?? false;
  const onKeyUp = async (e) => {
    if (e.target !== canvas && e.target !== document.body || isDisabled()) {
      return;
    }
    if (e.code === "Delete" || e.code === "Backspace") {
      const keys = selected.keys();
      keys.forEach((key) => {
        modules.core.manage.remove(key);
        selected.delete(key);
      });
      saveDelete(keys);
      await modules.core.view.recalculate();
      modules.core.view.redraw();
    }
  };
  const saveDelete = (layers) => {
    const state = [];
    layers.forEach((layer) => {
      const original = modules.core.clone.getOriginal(layer);
      state.push({
        origin: "cursor.delete",
        layer: original,
        data: {},
        undo: async (original2) => {
          modules.core.manage.add(original2, original2.hierarchy?.parent ?? null, original2.hierarchy?.position ?? null);
          await modules.core.view.recalculate();
        },
        redo: async (original2) => {
          modules.core.manage.remove(original2);
          await modules.core.view.recalculate();
        }
      });
    });
    if (state.length > 0) {
      void herald.dispatch(new CustomEvent(o2.SAVE, { detail: { state } }));
    }
  };
  document.addEventListener("keyup", onKeyUp, false);
  return {};
}

// src/module.ts
var selectionType = "selection";
function Cursor(params) {
  const { canvas, herald, modules } = params;
  if (!canvas) {
    throw new Error("[Antetype Cursor] Canvas is empty!");
  }
  const ctx = canvas.getContext("2d");
  if (!modules.core.setting.has("cursor")) {
    modules.core.setting.set("cursor", {});
  }
  const settings = new Proxy({}, {
    get(target, prop) {
      target;
      return modules.core.setting.get("cursor")[prop];
    },
    set(obj, prop, value) {
      obj;
      const settings2 = modules.core.setting.get("cursor");
      settings2[prop] = value;
      return true;
    }
  });
  const { drawSelection } = useDraw(herald, ctx);
  const { selected, showSelected, isSelected, resetSeeThroughStackMap } = useSelection(params, settings);
  const { onDown, onUp, onMove, onOut } = useDetect(params, selected, settings);
  useResize(params, showSelected, settings);
  useDelete(params, selected, settings);
  canvas.addEventListener("mousedown", onDown, false);
  canvas.addEventListener("mouseup", onUp, false);
  canvas.addEventListener("mousemove", onMove, false);
  canvas.addEventListener("mouseout", onOut, false);
  const unregister = herald.batch([
    {
      event: o.CLOSE,
      subscription: () => {
        canvas.removeEventListener("mousedown", onDown, false);
        canvas.removeEventListener("mouseup", onUp, false);
        canvas.removeEventListener("mousemove", onMove, false);
        canvas.removeEventListener("mouseout", onOut, false);
        unregister();
      }
    },
    {
      event: o.DRAW,
      subscription: (event) => {
        const { element } = event.detail;
        const typeToAction = {
          selection: drawSelection
        };
        const el = typeToAction[element.type];
        if (typeof el == "function") {
          el(element);
        }
      }
    }
  ]);
  return {
    drawSelection,
    selected,
    showSelected,
    isSelected,
    resetSeeThroughStackMap
  };
}
export {
  Cursor as default,
  selectionType
};
