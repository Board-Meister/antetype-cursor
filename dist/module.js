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

// src/shared.tsx
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

// src/useDetect.tsx
function useDetect({
  injected: { herald },
  modules: { core }
}, selected) {
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
    eventState.wasMoved = false;
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
    eventState.wasMoved = true;
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

// src/IterableWeakMap.tsx
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

// src/useSelection.tsx
function getLayerFromSelection(layer) {
  if (layer.type === selectionType) {
    return layer.selection.layer;
  }
  return layer;
}
function useSelection({
  modules,
  injected: { herald }
}) {
  const selected = IterableWeakMap();
  let shown = [];
  let canMove = false;
  let skipUp = false;
  let skipMove = true;
  let accumulatedMoveX = 0;
  let accumulatedMoveY = 0;
  let seeThroughStackMap = IterableWeakMap();
  const core = modules.core;
  const settings = {
    moveBufor: 5
  };
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
      void herald.dispatch(new CustomEvent(i.SAVE, { detail: { state } }));
    }
  };
  const shouldSkipMove = (e) => {
    if (!skipMove) {
      return false;
    }
    const { origin: { movementX, movementY } } = e.detail;
    accumulatedMoveX += movementX;
    accumulatedMoveY += movementY;
    if (Math.abs(accumulatedMoveX) > settings.moveBufor || Math.abs(accumulatedMoveY) > settings.moveBufor) {
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
    const { target: { down }, origin: { movementX, movementY } } = e.detail;
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
      setNewPositionOnOriginal(modules, layer, movementX, movementY);
    });
    showSelected();
  };
  const selectionMouseUp = (event) => {
    if (event.defaultPrevented) {
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
    if (e.defaultPrevented) {
      return;
    }
    canMove = true;
  };
  const unregister = herald.batch([
    {
      event: "antetype.cursor.on.down" /* DOWN */,
      subscription: enableMove
    },
    {
      event: "antetype.cursor.on.up" /* UP */,
      subscription: selectionMouseUp
    },
    {
      event: "antetype.cursor.on.move" /* MOVE */,
      subscription: startSelectionMove
    },
    {
      event: Event.CLOSE,
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

// src/useDraw.tsx
function useDraw(ctx) {
  const drawSelectionRect = (x, y, w, h, fill) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.strokeStyle = fill;
    ctx.stroke();
    ctx.restore();
  };
  const drawSelection = ({ start: { x, y }, size: { w, h } }) => {
    drawSelectionRect(x - 2, y - 2, w + 4, h + 4, "#FFF");
    drawSelectionRect(x - 1, y - 1, w + 2, h + 2, "#1e272e");
    drawSelectionRect(x, y, w, h, "#FFF");
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
}, showSelected) {
  let mode = 8 /* NONE */, disableResize = false, resizeInProgress = false, saved = false;
  const eventSnapshot = {
    waiting: false,
    layout: null,
    movement: null
  };
  const determinateCursorType = (layer, target) => {
    if (layer.selection.layer.hierarchy?.parent !== modules.core.meta.document) {
      return "default";
    }
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
    const { target, origin } = e.detail;
    const layers = target.selected.keys();
    if (0 === layers.length || 8 /* NONE */ === mode || !target.isDown) {
      return;
    }
    let { movementY: y, movementX: x } = origin;
    if (mode === 3 /* LEFT */ || mode === 2 /* RIGHT */) y = 0;
    if (mode === 0 /* TOP */ || mode === 1 /* BOTTOM */) x = 0;
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
      void herald.dispatch(new CustomEvent(i.SAVE, { detail: { state } }));
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
        method: handleMove,
        priority: -10
      }
    },
    {
      event: "antetype.cursor.on.slip" /* SLIP */,
      subscription: {
        method: revertCursorToDefault
      }
    },
    {
      event: "antetype.cursor.on.down" /* DOWN */,
      subscription: {
        method: handleDown,
        priority: -10
      }
    },
    {
      event: "antetype.cursor.on.up" /* UP */,
      subscription: {
        method: handleUpAfterResize,
        priority: -10
      }
    },
    {
      event: Event.CLOSE,
      subscription: {
        method: () => {
          unregister();
        }
      }
    }
  ]);
}

// src/useDelete.tsx
function useDelete({
  modules,
  injected: { herald },
  canvas
}, selected) {
  canvas.setAttribute("tabindex", "0");
  const onKeyUp = async (e) => {
    if (e.target !== canvas && e.target !== document.body) {
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
      void herald.dispatch(new CustomEvent(i.SAVE, { detail: { state } }));
    }
  };
  document.addEventListener("keyup", onKeyUp, false);
  return {};
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
  const { selected, showSelected, isSelected, resetSeeThroughStackMap } = useSelection(params);
  const { onDown, onUp, onMove } = useDetect(params, selected);
  useResize(params, showSelected);
  useDelete(params, selected);
  canvas.addEventListener("mousedown", onDown, false);
  canvas.addEventListener("mouseup", onUp, false);
  canvas.addEventListener("mousemove", onMove, false);
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
