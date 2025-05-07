// ../antetype-core/src/type.d.ts
var Event = {
  INIT: "antetype.init",
  CLOSE: "antetype.close",
  DRAW: "antetype.draw",
  CALC: "antetype.calc",
  RECALC_FINISHED: "antetype.recalc.finished",
  MODULES: "antetype.modules",
  SETTINGS: "antetype.settings.definition",
  TYPE_DEFINITION: "antetype.layer.type.definition",
  FONTS_LOADED: "antetype.font.loaded"
};

// ../antetype-core/src/component/clone.ts
function Clone({ canvas }) {
  const ctx = canvas.getContext("2d");
  const maxDepth = 50;
  const originalSymbol = Symbol("original");
  const cloneSymbol = Symbol("clone");
  const isObject = (value) => {
    return typeof value === "object" && !Array.isArray(value) && value !== null;
  };
  const getOriginal = function(object) {
    return object[originalSymbol] ?? object;
  };
  const getClone = function(object) {
    return object[cloneSymbol] ?? object;
  };
  const iterateResolveAndCloneObject = async (object, recursive, depth = 0) => {
    if (recursive.has(object)) {
      return recursive.get(object);
    }
    if (object[originalSymbol] || object.type === "document") {
      return object;
    }
    const clone = {};
    recursive.set(object, clone);
    clone[originalSymbol] = object;
    object[cloneSymbol] = clone;
    if (maxDepth <= depth + 1) {
      console.error("We've reach limit depth!", object);
      throw new Error("limit reached");
    }
    for (const key of Object.keys(object)) {
      let result = await resolve(object[key], object);
      if (isObject(result)) {
        result = await iterateResolveAndCloneObject(result, recursive, depth + 1);
      } else if (Array.isArray(result)) {
        result = await iterateResolveAndCloneArray(result, recursive, depth + 1);
      }
      clone[key] = result;
    }
    ;
    return clone;
  };
  const iterateResolveAndCloneArray = async (object, recursive, depth = 0) => {
    const clone = [];
    if (maxDepth <= depth + 1) {
      console.error("We've reach limit depth!", object);
      throw new Error("limit reached");
    }
    for (const value of object) {
      let result = await resolve(value, object);
      if (isObject(result)) {
        result = await iterateResolveAndCloneObject(result, recursive, depth + 1);
      } else if (Array.isArray(result)) {
        result = await iterateResolveAndCloneArray(result, recursive, depth + 1);
      }
      clone.push(result);
    }
    ;
    return clone;
  };
  const resolve = async (value, object) => {
    return typeof value == "function" ? await value(ctx, object) : value;
  };
  const cloneDefinition = async (data) => {
    return await iterateResolveAndCloneObject(data, /* @__PURE__ */ new WeakMap());
  };
  const isClone = (layer) => !!layer[originalSymbol];
  return {
    isClone,
    cloneDefinition,
    getClone,
    getOriginal
  };
}

// ../antetype-core/src/core.ts
function Core(parameters) {
  const {
    herald
  } = parameters;
  const sessionQueue = [];
  const calcQueue = [];
  const layerPolicy = Symbol("layer");
  const { cloneDefinition, isClone, getOriginal, getClone } = Clone(parameters);
  const __DOCUMENT = {
    type: "document",
    base: [],
    layout: [],
    start: { x: 0, y: 0 },
    size: { w: 0, h: 0 },
    settings: {
      core: {
        fonts: []
      }
    }
  };
  console.log(__DOCUMENT);
  const debounce = (func, timeout = 100) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      if (args[0] === "clear") {
        return;
      }
      timer = setTimeout(() => {
        void func.apply({}, args);
      }, timeout);
    };
  };
  const debounceRecalculatedEvent = debounce(() => {
    void herald.dispatch(new CustomEvent(Event.RECALC_FINISHED));
  });
  const debounceCalcQueueCheck = debounce(async () => {
    if (calcQueue.length == 0) {
      return;
    }
    await calcQueue.shift()();
    debounceCalcQueueCheck();
  });
  const draw = (element) => {
    herald.dispatchSync(new CustomEvent(Event.DRAW, { detail: { element } }));
  };
  const redraw = (layout = __DOCUMENT.layout) => {
    for (const layer of layout) {
      draw(layer);
    }
  };
  const assignHierarchy = (element, parent, position) => {
    element.hierarchy ??= {
      parent,
      position
    };
    if (parent) {
      element.hierarchy.parent = parent;
    }
    if (position) {
      element.hierarchy.position = position;
    }
  };
  const moveCalculationToQueue = (func) => {
    let trigger = false;
    const awaitQueue = (resolve) => {
      setTimeout(() => {
        if (!trigger) {
          awaitQueue(resolve);
          return;
        }
        void func().then((result) => {
          resolve(result);
        });
      });
    };
    const promise = new Promise((resolve) => {
      awaitQueue(resolve);
    });
    calcQueue.push(() => {
      trigger = true;
      return promise;
    });
    debounceCalcQueueCheck();
    return promise;
  };
  const calc2 = async (element, parent = null, position = null, currentSession = null) => {
    if (currentSession !== (sessionQueue[0] ?? null)) {
      return moveCalculationToQueue(() => calc2(element, parent, position, currentSession));
    }
    const original = getOriginal(element);
    position ??= original.hierarchy?.position ?? 0;
    assignHierarchy(original, parent ? getOriginal(parent) : null, position);
    const event = new CustomEvent(Event.CALC, { detail: { element, sessionId: currentSession } });
    await herald.dispatch(event);
    const clone = event.detail.element;
    if (clone !== null) {
      markAsLayer(clone);
      assignHierarchy(clone, parent ? getClone(parent) : null, position);
    }
    return clone;
  };
  const generateId = () => Math.random().toString(16).slice(2);
  const isLayer = (layer) => getClone(layer)[layerPolicy] === true;
  const markAsLayer = (layer) => {
    layer[layerPolicy] = true;
    getOriginal(layer).id ??= generateId();
    const clone = getClone(layer);
    if (!clone.id) {
      Object.defineProperty(clone, "id", {
        get() {
          return getOriginal(layer).id;
        }
      });
    }
    return layer;
  };
  const startSession = () => {
    const sessionId = Symbol("illustrator_session_id" + String(Math.random()));
    sessionQueue.push(sessionId);
    return sessionId;
  };
  const stopSession = () => {
    sessionQueue.shift();
  };
  const recalculate = async (parent = __DOCUMENT, layout = __DOCUMENT.base, startedSession = null) => {
    const currentSession = startedSession ?? startSession();
    markAsLayer(parent);
    const calculated = [];
    for (let i3 = 0; i3 < layout.length; i3++) {
      const calcLayer = await calc2(layout[i3], parent, i3, currentSession);
      if (calcLayer !== null) calculated.push(calcLayer);
    }
    parent.layout = calculated;
    debounceRecalculatedEvent();
    if (!startedSession) {
      stopSession();
    }
    return calculated;
  };
  const calcAndUpdateLayer = async (original) => {
    if (!original.hierarchy?.parent) {
      return;
    }
    const position = original.hierarchy.position;
    const parent = original.hierarchy.parent;
    const newLayer = await calc2(original, parent, position);
    if (newLayer === null) {
      removeVolatile(original);
      return;
    }
    getClone(parent).layout[position] = newLayer;
  };
  const move = async (original, newStart) => {
    original.start = newStart;
    await calcAndUpdateLayer(original);
  };
  const resize = async (original, newSize) => {
    original.size = newSize;
    await calcAndUpdateLayer(original);
  };
  const add = (def, parent = null, position = null) => {
    if (parent && isClone(parent)) {
      parent = getOriginal(parent);
    }
    let layout = parent ? parent.layout : __DOCUMENT.base;
    parent ??= __DOCUMENT;
    if (parent.base) {
      layout = parent.base;
    }
    position ??= layout.length;
    insert(def, parent, position, layout);
  };
  const addVolatile = (def, parent = null, position = null) => {
    if (parent && !isClone(parent)) {
      parent = getClone(parent);
    }
    parent ??= __DOCUMENT;
    position ??= parent.layout.length;
    insert(def, parent, position, parent.layout);
  };
  const insert = (def, parent, position, layout) => {
    layout.splice(position, 0, def);
    def.hierarchy = {
      position,
      parent
    };
    recalculatePositionInLayout(layout);
  };
  const recalculatePositionInLayout = (layout) => {
    for (let i3 = 0; i3 < layout.length; i3++) {
      const layer = layout[i3];
      if (!layer.hierarchy) {
        continue;
      }
      layer.hierarchy.position = i3;
    }
  };
  const remove = (def) => {
    if (!def.hierarchy?.parent) {
      return;
    }
    const position = def.hierarchy.position;
    const parent = getOriginal(def.hierarchy.parent);
    const layout = (parent?.type === "document" ? parent.base : parent?.layout) ?? [];
    if (layout[position] !== getOriginal(def)) {
      return;
    }
    layout.splice(position, 1);
    recalculatePositionInLayout(layout);
  };
  const removeVolatile = (def) => {
    if (!def.hierarchy?.parent) {
      return;
    }
    const position = def.hierarchy.position;
    const parent = getClone(def.hierarchy.parent);
    const layout = parent.layout;
    if (layout[position] !== getClone(def)) {
      return;
    }
    layout.splice(position, 1);
    recalculatePositionInLayout(layout);
  };
  const loadFont = async (font) => {
    try {
      const myFont = new FontFace(font.name, "url(" + font.url + ")");
      document.fonts.add(await myFont.load());
      module.view.redrawDebounce();
    } catch (error) {
      console.error("Font couldn't be loaded:", font.name + ",", font.url, error);
    }
  };
  const retrieveSettingsDefinition = async function(additional = {}) {
    const event = new CustomEvent(Event.SETTINGS, {
      detail: {
        settings: [],
        additional
      }
    });
    await herald.dispatch(event);
    return event.detail.settings;
  };
  const setSetting = (path, value, settings) => {
    if (path.length <= 1) {
      settings[path[0]] = value;
      return;
    }
    settings[path[0]] ??= {};
    if (typeof settings[path[0]] !== "object" || settings[path[0]] === null) {
      console.warn("Cannot set setting, due to one of destination not being an object", path, settings, value);
      return;
    }
    setSetting(path.slice(1), value, settings[path[0]]);
  };
  const getSetting = (path, settings) => {
    if (path.length <= 1) {
      return settings[path[0]];
    }
    if (!settings[path[0]]) {
      return void 0;
    }
    return getSetting(path.slice(1), settings[path[0]]);
  };
  const setSettingsDefinition = (e) => {
    const settings = e.detail.settings;
    const generateFonts = () => {
      const definitions = [];
      for (const font of __DOCUMENT.settings?.core?.fonts ?? []) {
        definitions.push([[
          {
            type: "asset",
            name: "url",
            label: "File",
            value: font.url
          },
          {
            type: "title",
            name: "name",
            label: "Name",
            value: font.name
          }
        ]]);
      }
      return definitions;
    };
    settings.push({
      details: {
        label: "Core"
      },
      name: "core",
      tabs: [
        {
          label: "Font",
          fields: [
            [{
              label: "Fonts",
              type: "container",
              fields: [
                [{
                  name: "fonts",
                  type: "list",
                  label: "Fonts List",
                  template: [
                    [
                      {
                        type: "asset",
                        name: "url",
                        label: "File",
                        value: ""
                      },
                      {
                        type: "title",
                        name: "name",
                        label: "Name",
                        value: ""
                      }
                    ]
                  ],
                  entry: {
                    url: "",
                    name: ""
                  },
                  fields: generateFonts()
                }]
              ]
            }]
          ]
        }
      ]
    });
  };
  const layerDefinitions = () => {
    const event = new CustomEvent(Event.TYPE_DEFINITION, {
      detail: {
        definitions: {}
      }
    });
    herald.dispatchSync(event);
    return event.detail.definitions;
  };
  const getModule = () => ({
    meta: {
      document: __DOCUMENT,
      generateId,
      layerDefinitions
    },
    clone: {
      definitions: cloneDefinition,
      getOriginal,
      getClone
    },
    manage: {
      markAsLayer,
      remove,
      removeVolatile,
      add,
      addVolatile,
      calcAndUpdateLayer
    },
    view: {
      calc: calc2,
      recalculate,
      draw,
      redraw,
      redrawDebounce: debounce(redraw),
      move,
      resize
    },
    policies: {
      isLayer,
      isClone
    },
    font: {
      load: loadFont
    },
    setting: {
      set(name, value) {
        const path = name.split(".");
        if (!path.slice(-1)) {
          path.pop();
        }
        setSetting(path, value, __DOCUMENT.settings);
      },
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
      get(name) {
        const path = name.split(".");
        if (!path.slice(-1)) {
          path.pop();
        }
        return getSetting(path, __DOCUMENT.settings) ?? null;
      },
      has: function(name) {
        return !!(this.get(name) ?? false);
      },
      retrieve: retrieveSettingsDefinition
    }
  });
  const module = getModule();
  const isObject = (item) => !!(item && typeof item === "object" && !Array.isArray(item));
  const mergeDeep = (target, ...sources) => {
    if (!sources.length) return target;
    const source = sources.shift();
    if (isObject(target) && isObject(source)) {
      for (const key in source) {
        const sEl = source[key];
        if (isObject(sEl)) {
          const tEl = target[key];
          if (!tEl) Object.assign(target, { [key]: {} });
          mergeDeep(target[key], sEl);
        } else {
          Object.assign(target, { [key]: sEl });
        }
      }
    }
    return mergeDeep(target, ...sources);
  };
  const init = async (base, settings) => {
    for (const key in settings) {
      module.setting.set(key, settings[key]);
    }
    const doc = __DOCUMENT;
    doc.settings = mergeDeep({}, doc.settings, settings);
    doc.base = base;
    void Promise.all((module.setting.get("core.fonts") ?? []).map((font) => module.font.load(font))).then(() => {
      void herald.dispatch(new CustomEvent(Event.FONTS_LOADED));
    });
    doc.layout = await module.view.recalculate(doc, doc.base);
    module.view.redraw(doc.layout);
    return doc;
  };
  const unregister = herald.batch([
    {
      event: Event.CLOSE,
      subscription: () => {
        unregister();
      }
    },
    {
      event: Event.INIT,
      subscription: (event) => {
        const { base, settings } = event.detail;
        return init(base, settings);
      }
    },
    {
      event: Event.SETTINGS,
      subscription: (e) => {
        setSettingsDefinition(e);
      }
    },
    {
      event: Event.CALC,
      subscription: [
        {
          priority: -255,
          method: async (event) => {
            if (event.detail.element === null) {
              return;
            }
            event.detail.element = await module.clone.definitions(event.detail.element);
          }
        }
      ]
    }
  ]);
  return module;
}

// ../herald/dist/index.js
var __classPrivateFieldGet = function(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __classPrivateFieldSet = function(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var _Herald_instances;
var _Herald_injected;
var _Herald_subscribers;
var _Herald_subscribersMap;
var _Herald_continueDispatching;
var _Herald_validateEvent;
var _Herald_prepareSubscribers;
var _Herald_getSubscriberMethod;
var _Herald_isObject;
var _Herald_sortSubscribers;
var _Herald_sort;
var Herald = class {
  constructor() {
    _Herald_instances.add(this);
    _Herald_injected.set(this, {
      subscribers: []
    });
    _Herald_subscribers.set(this, {});
    _Herald_subscribersMap.set(this, {});
  }
  inject(injections) {
    if (!__classPrivateFieldGet(this, _Herald_injected, "f"))
      return;
    __classPrivateFieldSet(this, _Herald_injected, injections, "f");
    __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_sortSubscribers).call(this);
  }
  async dispatch(event) {
    __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_validateEvent).call(this, event);
    for (const subscriber of __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_prepareSubscribers).call(this, event.type)) {
      try {
        await __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_getSubscriberMethod).call(this, subscriber)(event);
        if (__classPrivateFieldGet(this, _Herald_instances, "m", _Herald_continueDispatching).call(this, event)) {
          break;
        }
      } catch (e) {
        console.error("Dispatcher error:", e);
        throw e;
      }
    }
  }
  dispatchSync(event) {
    __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_validateEvent).call(this, event);
    for (const subscriber of __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_prepareSubscribers).call(this, event.type)) {
      try {
        __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_getSubscriberMethod).call(this, subscriber)(event);
        if (__classPrivateFieldGet(this, _Herald_instances, "m", _Herald_continueDispatching).call(this, event)) {
          break;
        }
      } catch (e) {
        console.error("Dispatcher error:", e);
        throw e;
      }
    }
  }
  batch(events) {
    const unregistrations = [];
    events.forEach(({ event, subscription, constraint = null, sort = true, symbol = null }) => {
      unregistrations.push(this.register(event, subscription, constraint, sort, symbol));
    });
    return () => {
      unregistrations.forEach((unregistration) => {
        unregistration();
      });
    };
  }
  register(event, subscription, constraint = null, sort = true, symbol = null) {
    symbol ?? (symbol = Symbol("event"));
    const subs = Array.isArray(subscription) ? subscription : [
      typeof subscription == "object" ? subscription : { method: subscription }
    ];
    for (const sub of subs) {
      sub.priority ?? (sub.priority = 0);
      if (sub.priority < -256 || sub.priority > 256) {
        console.error("Subscriber priority must be in range -256:256", { [event]: sub });
        throw new Error("Error above stopped registration of an event");
      }
      sub.constraint ?? (sub.constraint = constraint);
    }
    __classPrivateFieldGet(this, _Herald_subscribers, "f")[event] = [
      ...__classPrivateFieldGet(this, _Herald_subscribers, "f")[event] ?? [],
      ...subs
    ];
    __classPrivateFieldGet(this, _Herald_subscribersMap, "f")[symbol] = [
      ...__classPrivateFieldGet(this, _Herald_subscribersMap, "f")[symbol] ?? [],
      ...subs
    ];
    sort && __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_sort).call(this, event);
    return () => {
      this.unregister(event, symbol);
    };
  }
  unregister(event, symbol) {
    if (!__classPrivateFieldGet(this, _Herald_subscribersMap, "f")[symbol]) {
      console.warn("Tried to unregister not registered events", event);
      return;
    }
    const events = [...__classPrivateFieldGet(this, _Herald_subscribers, "f")[event]];
    __classPrivateFieldGet(this, _Herald_subscribersMap, "f")[symbol].forEach((sub) => {
      const index = events.indexOf(sub);
      if (index !== -1)
        events.splice(index, 1);
      else
        throw new Error("Attempt to remove event from wrong collection");
    });
    __classPrivateFieldGet(this, _Herald_subscribers, "f")[event] = events;
    delete __classPrivateFieldGet(this, _Herald_subscribersMap, "f")[symbol];
  }
};
_Herald_injected = /* @__PURE__ */ new WeakMap(), _Herald_subscribers = /* @__PURE__ */ new WeakMap(), _Herald_subscribersMap = /* @__PURE__ */ new WeakMap(), _Herald_instances = /* @__PURE__ */ new WeakSet(), _Herald_continueDispatching = function _Herald_continueDispatching2(event) {
  return event.cancelBubble;
}, _Herald_validateEvent = function _Herald_validateEvent2(event) {
  if (!(event instanceof CustomEvent)) {
    throw new Error("Event passed to dispatcher must be of type CustomEvent");
  }
}, _Herald_prepareSubscribers = function _Herald_prepareSubscribers2(key) {
  return [...__classPrivateFieldGet(this, _Herald_subscribers, "f")[key] ?? []];
}, _Herald_getSubscriberMethod = function _Herald_getSubscriberMethod2(subscriber) {
  const constraint = subscriber.constraint, { marshal = null } = __classPrivateFieldGet(this, _Herald_injected, "f"), module = typeof constraint == "string" ? marshal?.get(constraint) : constraint;
  let method = subscriber.method;
  if (module && typeof method == "string") {
    method = module[method] ?? null;
    if (method) {
      method = method.bind(module);
    }
  }
  if (typeof method != "function") {
    console.error("Error below references this object", constraint);
    throw new Error("Module " + String(constraint.constructor ?? constraint) + " doesn't have non-static method " + String(subscriber.method));
  }
  return method;
}, _Herald_isObject = function _Herald_isObject2(x) {
  return typeof x === "object" && !Array.isArray(x) && x !== null;
}, _Herald_sortSubscribers = function _Herald_sortSubscribers2() {
  const { marshal = null, subscribers = [] } = __classPrivateFieldGet(this, _Herald_injected, "f");
  __classPrivateFieldSet(this, _Herald_subscribers, {}, "f");
  subscribers.forEach((subscriberObject) => {
    const subscriptions = subscriberObject.module.subscriptions ?? subscriberObject.module.constructor?.subscriptions;
    if (typeof subscriptions != "object") {
      return;
    }
    if (!__classPrivateFieldGet(this, _Herald_instances, "m", _Herald_isObject).call(this, subscriptions)) {
      return;
    }
    Object.keys(subscriptions).forEach((moduleName) => {
      this.register(moduleName, subscriptions[moduleName], marshal?.getModuleConstraint(subscriberObject.config) ?? null, false);
    });
  });
  Object.keys(__classPrivateFieldGet(this, _Herald_subscribers, "f")).forEach((event) => {
    __classPrivateFieldGet(this, _Herald_instances, "m", _Herald_sort).call(this, event);
  });
}, _Herald_sort = function _Herald_sort2(event) {
  __classPrivateFieldGet(this, _Herald_subscribers, "f")[event].sort((a, b) => a.priority - b.priority);
};
Herald.inject = {
  "marshal": "boardmeister/marshal",
  "subscribers": "!subscriber"
};

// ../antetype-core/dist/index.js
var o = { INIT: "antetype.init", CLOSE: "antetype.close", DRAW: "antetype.draw", CALC: "antetype.calc", RECALC_FINISHED: "antetype.recalc.finished", MODULES: "antetype.modules", SETTINGS: "antetype.settings.definition", TYPE_DEFINITION: "antetype.layer.type.definition", FONTS_LOADED: "antetype.font.loaded" };
var i = class {
  #e;
  #n = null;
  static inject = { minstrel: "boardmeister/minstrel", herald: "boardmeister/herald" };
  inject(e) {
    this.#e = e;
  }
  async #t(e, n2) {
    let t = this.#e.minstrel.getResourceUrl(this, "core.js");
    return this.#n = (await import(t)).default, this.#n({ canvas: n2, modules: e, herald: this.#e.herald });
  }
  async register(e) {
    let { modules: n2, canvas: t } = e.detail;
    n2.core = await this.#t(n2, t);
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

// ../antetype-memento/dist/index.js
var i2 = ((e) => (e.INIT = "antetype.init", e.CLOSE = "antetype.close", e.DRAW = "antetype.draw", e.CALC = "antetype.calc", e.RECALC_FINISHED = "antetype.recalc.finished", e.MODULES = "antetype.modules", e.SETTINGS = "antetype.settings.definition", e))(i2 || {});
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
  static subscriptions = { [i2.MODULES]: "register", "antetype.memento.save": "save" };
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
        arrKeys.forEach((value, i3) => {
          objectToIndex.set(value, i3);
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
  for (let i3 = layout.length - 1; i3 >= 0; i3--) {
    const layer = layout[i3];
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
  for (let i3 = layout.length - 1; i3 >= 0; i3--) {
    const layer = layout[i3];
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
    await updateHover(e, layout, x, y, 0, 0);
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
    await updateHover(e, layout, x, y, movementX, movementY);
    await herald.dispatch(new CustomEvent("antetype.cursor.on.move" /* MOVE */, {
      detail: { origin: e, target: eventState },
      cancelable: true
    }));
  };
  const updateHover = async (e, layout, x, y, movementY, movementX) => {
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
    if (!layer || layer.selection.layer.hierarchy?.parent !== modules.core.meta.document) {
      mode = 8 /* NONE */;
      return "default";
    }
    const { start: { x: sX, y: sY }, size: { h, w } } = layer;
    const { x, y } = target.hover;
    const bufferTop = calc(herald, { bufferTop: settings.resize?.buffer ?? 10 }).bufferTop, bufferBottom = 0;
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
    await modules.core.view.resize(original, original.size);
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
    const { target } = e.detail;
    const layer = target?.hover?.layer;
    if (layer?.type === selectionType) {
      canvas.style.cursor = determinateCursorType(layer, target);
    } else {
      resetMode();
    }
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
    get(_target, prop) {
      return modules.core.setting.get("cursor")[prop];
    },
    set(_obj, prop, value) {
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

// test/selection.spec.ts
describe("Cursors selection", () => {
  let cursor;
  const herald = new Herald();
  const canvas = document.createElement("canvas");
  const core = Core({ herald, canvas });
  const defaultSettings = {
    cursor: {
      resize: {
        buffer: 0
        // Disable resizing so we can have layers of any size (clicking on buffer prevents selection)
      }
    }
  };
  const awaitClick2 = (...rest) => awaitClick(herald, canvas, ...rest);
  const getSelected = () => cursor.selected.keys();
  const getFirst = () => cursor.selected.firstKey();
  beforeEach(() => {
    cursor = Cursor({ canvas, modules: { core }, herald });
  });
  afterEach(async () => {
    await close(herald);
  });
  it("allows to select one or multiple layers", async () => {
    await initialize(herald, [
      generateRandomLayer(
        "testSelect1",
        10,
        10,
        10,
        10
      ),
      generateRandomLayer(
        "testSelect2",
        25,
        10,
        10,
        10
      )
    ], defaultSettings);
    await awaitClick2(15, 15);
    expect(getSelected().length).withContext("First layer was selected").toBe(1);
    expect(getFirst()?.type).toBe("testSelect1");
    await awaitClick2(22.5, 15);
    expect(getSelected().length).withContext("Nothing was selected").toBe(0);
    await awaitClick2(30, 15);
    expect(getSelected().length).withContext("Second layer was selected").toBe(1);
    expect(getFirst()?.type).toBe("testSelect2");
    await awaitClick2(15, 15, { shiftKey: true }, { shiftKey: true });
    expect(getSelected().length).withContext("Both are selected").toBe(2);
    await awaitClick2(30, 15, { ctrlKey: true }, { ctrlKey: true });
    expect(getSelected().length).withContext("One was unselected with ctrl").toBe(1);
    expect(getFirst()?.type).toBe("testSelect1");
    await awaitClick2(30, 15, { ctrlKey: true }, { ctrlKey: true });
    expect(getSelected().length).withContext("Reselected with control").toBe(2);
    await awaitClick2(15, 15, { shiftKey: true }, { shiftKey: true });
    expect(getSelected().length).withContext("Shift key does nothing on already selected").toBe(2);
    await awaitClick2(22.5, 15, { shiftKey: true }, { shiftKey: true });
    expect(getSelected().length).withContext("Shift key nowhere does not change selection").toBe(2);
  });
  fit("has working see-through selection", async () => {
    await initialize(herald, [
      generateRandomLayer(
        "testSelect1",
        10,
        10,
        40,
        40
      ),
      generateRandomLayer(
        "testSelect2",
        30,
        30,
        40,
        40
      )
    ], defaultSettings);
    await awaitClick2(35, 35);
    expect(getSelected().length).withContext("Higher layer was selected").toBe(1);
    expect(getFirst()?.type).toBe("testSelect2");
    await awaitClick2(35, 35);
    expect(getSelected().length).withContext("Amount of layer did not change").toBe(1);
    expect(getFirst()?.type).toBe("testSelect1");
    await awaitClick2(35, 35);
    expect(getSelected().length).withContext("Amount of layer did not change").toBe(0);
    await awaitClick2(35, 35);
    expect(getSelected().length).withContext("Higher layer was selected").toBe(1);
    expect(getFirst()?.type).toBe("testSelect2");
  });
});
