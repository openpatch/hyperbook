function capitalise([first, ...rest]) {
  return first.toUpperCase() + rest.join("");
}

function clean_attribute(v) {
  if (v && !isNaN(v)) {
    v = parseFloat(v);
  }

  const constants = {
    true: true,
    on: true,
    false: false,
    off: false,
    "": true,
  };

  return constants[v] === undefined ? v : constants[v];
}

function splitlist(v) {
  return v.split(/\s*,\s*/g);
}

function clean_material_id(material_id) {
  if (!material_id) {
    return;
  }
  let m;
  if (
    (m = material_id.match(
      /(?:(?:beta.)?geogebra.org\/(?:[a-zA-Z0-9]+)|ggbm.at)\/([a-zA-Z0-9]+)$/,
    ))
  ) {
    material_id = m[1];
  }
  return material_id;
}

/** Resolve an enum: either return the index of the value in the list, or the original value if it's not in the list.
 */
function enum_attribute(v, values) {
  const i = values.indexOf(v);
  return i >= 0 ? i : v;
}

/* Resolve a map of attribute values: either return the value corresponding to the given key, or the original value if it's not in the map.
 */
function map_attribute(raw_value, values) {
  const mapped_value = values[raw_value];
  const value = mapped_value === undefined ? raw_value : mapped_value;
  return value;
}

const mode_map = {
  move: 0,
  point: 1,
  join: 2,
  parallel: 3,
  orthogonal: 4,
  intersect: 5,
  delete: 6,
  vector: 7,
  "line bisector": 8,
  "angular bisector": 9,
  "circle two points": 10,
  "circle three points": 11,
  "conic five points": 12,
  tangents: 13,
  relation: 14,
  segment: 15,
  polygon: 16,
  text: 17,
  ray: 18,
  midpoint: 19,
  "circle arc three points": 20,
  "circle sector three points": 21,
  "circumcircle arc three points": 22,
  "circumcircle sector three points": 23,
  semicircle: 24,
  slider: 25,
  image: 26,
  "show hide object": 27,
  "show hide label": 28,
  "mirror at point": 29,
  "mirror at line": 30,
  "translate by vector": 31,
  "rotate by angle": 32,
  "dilate from point": 33,
  "circle point radius": 34,
  "copy visual style": 35,
  angle: 36,
  "vector from point": 37,
  distance: 38,
  "move rotate": 39,
  translateview: 40,
  "zoom in": 41,
  "zoom out": 42,
  "selection listener": 43,
  "polar diameter": 44,
  "segment fixed": 45,
  "angle fixed": 46,
  locus: 47,
  macro: 48,
  area: 49,
  slope: 50,
  "regular polygon": 51,
  "show hide checkbox": 52,
  compasses: 53,
  "mirror at circle": 54,
  "ellipse three points": 55,
  "hyperbola three points": 56,
  parabola: 57,
  fitline: 58,
  "record to spreadsheet": 59,
  "button action": 60,
  "textfield action": 61,
  pen: 62,
  "rigid polygon": 64,
  polyline: 65,
  "probability calculator": 66,
  "attach / detach": 67,
  "function inspector": 68,
  "intersect two surfaces": 69,
  "vector polygon": 70,
  "create list": 71,
  "complex number": 72,
  "point on object": 501,
  "mode spreadsheet create list": 2001,
  "mode spreadsheet create matrix": 2002,
  "mode spreadsheet create listofpoints": 2003,
  "mode spreadsheet create tabletext": 2004,
  "mode spreadsheet create polyline": 2005,
  "mode spreadsheet onevarstats": 2020,
  "mode spreadsheet twovarstats": 2021,
  "mode spreadsheet multivarstats": 2022,
  "mode spreadsheet sort": 2030,
  "mode spreadsheet sort az": 2031,
  "mode spreadsheet sort za": 2032,
  "mode spreadsheet sum": 2040,
  "mode spreadsheet average": 2041,
  "mode spreadsheet count": 2042,
  "mode spreadsheet min": 2043,
  "mode spreadsheet max": 2044,
  "freehand mode": 73,
  "view in front of": 502,
  "plane three points": 510,
  "plane point line": 511,
  "orthogonal plane": 512,
  "parallel plane": 513,
  "perpendicular line (3d)": 514,
  "sphere point radius": 520,
  "sphere two points": 521,
  "cone given by two points and radius": 522,
  "cylinder given by two points and radius": 523,
  prism: 531,
  "extrude to prism or cylinder": 532,
  pyramid: 533,
  "extrude to pyramid or cone": 534,
  net: 535,
  cube: 536,
  tetrahedron: 537,
  "rotate view": 540,
  "circle point radius direction": 550,
  "circle axis point": 551,
  volume: 560,
  "rotate around line": 570,
  "mirror at plane": 571,
};

/** From https://wiki.geogebra.org/en/Reference:GeoGebra_Apps_API
 */
const method_names = [
  "debug",
  "deleteObject",
  "enable3D",
  "enableCAS",
  "enableLabelDrags",
  "enableRightClick",
  "enableShiftDragZoom",
  "evalCommand",
  "evalCommandCAS",
  "evalCommandGetLabels",
  "evalXML",
  "exists",
  "exportPDF",
  "exportSVG",
  "getAlgorithmXML",
  "getAllObjectNames",
  "getBase64",
  "getCASObjectNumber",
  "getCaption",
  "getColor",
  "getCommandString",
  "getDefinitionString",
  "getEditorState",
  "getFileJSON",
  "getFilling",
  "getGraphicsOptions",
  "getGridVisible",
  "getLaTeXBase64",
  "getLaTeXString",
  "getLabelStyle",
  "getLabelVisible",
  "getLayer",
  "getLineStyle",
  "getLineThickness",
  "getListValue",
  "getMode",
  "getObjectName",
  "getObjectNumber",
  "getObjectType",
  "getPNGBase64",
  "getPerspectiveXML",
  "getPointSize",
  "getPointStyle",
  "getScreenshotBase64",
  "getValue",
  "getValueString",
  "getVersion",
  "getVisible",
  "getXML",
  "getXcoord",
  "getYcoord",
  "getZcoord",
  "hideCursorWhenDragging",
  "isAnimationRunning",
  "isDefined",
  "isIndependent",
  "isMoveable",
  "newConstruction",
  "openFile",
  "recalculateEnvironments",
  "redo",
  "refreshViews",
  "registerAddListener",
  "registerClearListener",
  "registerClickListener",
  "registerClientListener",
  "registerObjectClickListener",
  "registerObjectUpdateListener",
  "registerRemoveListener",
  "registerRenameListener",
  "registerStoreUndoListener\n",
  "registerUpdateListener",
  "remove",
  "renameObject",
  "reset",
  "setAlgebraOptions",
  "setAnimating",
  "setAnimationSpeed",
  "setAuxiliary",
  "setAxesVisible",
  "setAxisLabels",
  "setAxisSteps",
  "setAxisUnits",
  "setBase64",
  "setCaption",
  "setColor",
  "setCoordSystem",
  "setCoords",
  "setCustomToolBar",
  "setDisplayStyle",
  "setEditorState",
  "setErrorDialogsActive",
  "setFileJSON",
  "setFilling",
  "setFixed",
  "setGraphicsOptions",
  "setGridVisible",
  "setHeight",
  "setLabelStyle",
  "setLabelVisible",
  "setLayer",
  "setLayerVisible",
  "setLineStyle",
  "setLineThickness",
  "setListValue",
  "setMode",
  "setOnTheFlyPointCreationActive",
  "setPerspective",
  "setPointCapture",
  "setPointSize",
  "setPointStyle",
  "setRepaintingActive",
  "setRounding",
  "setSize",
  "setTextValue",
  "setTrace",
  "setUndoPoint",
  "setValue",
  "setVisible",
  "setWidth",
  "setXML",
  "showAlgebraInput",
  "showMenuBar",
  "showResetIcon",
  "showToolBar",
  "startAnimation",
  "stopAnimation",
  "undo",
  "unregisterAddListener",
  "unregisterClearListener",
  "unregisterClickListener",
  "unregisterClientListener",
  "unregisterObjectClickListener",
  "unregisterObjectUpdateListener",
  "unregisterRemoveListener",
  "unregisterRenameListener",
  "unregisterStoreUndoListener",
  "unregisterUpdateListener",
  "writePNGtoFile",
];

const props = {
  appName: {
    set: (app, v, e) => e.setAttribute("appname", v),
    get: (app, e) => e.get_data("param-appname"),
  },
  animating: {
    set: (app, v) => {
      if (v) {
        app.startAnimation();
      } else {
        app.stopAnimation();
      }
    },
    get: (app) => app.isAnimationRunning(),
  },
  CASObjectNumber: {
    get: (app) => app.getCASObjectNumber(),
  },
  editorState: {
    set: (app, v) => {
      app.setEditorState(v);
    },
    get: (app) => {
      app.getEditorState();
    },
  },
  graphicsOptions: {
    set: (app, v) => {
      app.setGraphicsOptions(v);
    },
    get: (app) => {
      app.getGraphicsOptions();
    },
  },
  height: {
    set: (app, v) => {
      app.setHeight(v);
    },
    get: (app, e) => parseFloat(e.get_data("param-height")),
  },
  mode: {
    set: (app, v) => {
      app.setMode(map_attribute(v, mode_map));
    },
    get: (app) => {
      const mode = app.getMode();
      return Object.keys(mode_map).find((n) => mode_map[n] == mode) || mode;
    },
  },
  objectNames: {
    get: (app) => app.getAllObjectNames(),
  },
  objectNumber: {
    get: (app) => app.getObjectNumber(),
  },
  perspective: {
    set: (app, v) => app.setPerspective(v),
  },
  scaleX: {
    get: (app, e) => parseFloat(e.get_data("scalex")),
  },
  scaleY: {
    get: (app, e) => parseFloat(e.get_data("scaley")),
  },
  width: {
    set: (app, v) => {
      app.setWidth(v);
    },
    get: (app, e) => parseFloat(e.get_data("param-width")),
  },
};

/** From https://wiki.geogebra.org/en/Reference:GeoGebra_App_Parameters
 */
const init_param_names = [
  "algebraInputPosition",
  "allowStyleBar",
  "allowUpscale",
  "appName",
  "autoHeight",
  "borderColor",
  "buttonBorderColor",
  "buttonRounding",
  "buttonShadows",
  "capturingThreshold",
  "country",
  "customToolBar",
  "editorBackgroundColor",
  "editorForegroundColor",
  "enable3d",
  "enableCAS",
  "enableFileFeatures",
  "enableLabelDrags",
  "enableRightClick",
  "enableShiftDragZoom",
  "enableUndoRedo",
  "errorDialogsActive",
  "filename",
  "ggbBase64",
  "height",
  "keyboardType",
  "language",
  "playButton",
  "preventFocus",
  "randomSeed",
  "rounding",
  "scale",
  "scaleContainerClass",
  "showAlgebraInput",
  "showAnimationButton",
  "showFullscreenButton",
  "showLogging",
  "showMenuBar",
  "showResetIcon",
  "showStartTooltip",
  "showSuggestionButtons",
  "showToolBar",
  "showToolBarHelp",
  "showZoomButtons",
  "textmode",
  "transparentGraphics",
  "width",
];

// extra attributes mapping to methods
const methodAttributes = {
  perspective: (app, v) => app.setPerspective(v),
  axes: (app, v) => app.setAxesVisible(...splitlist(v).map((x) => x == "true")),
  xaxis: (app, v) =>
    app.setAxesVisible(
      v,
      app.getGraphicsOptions(1).axes.y.visible,
      app.getGraphicsOptions(1).axes.z.visible,
    ),
  yaxis: (app, v) =>
    app.setAxesVisible(
      app.getGraphicsOptions(1).axes.x.visible,
      v,
      app.getGraphicsOptions(1).axes.z.visible,
    ),
  zaxis: (app, v) =>
    app.setAxesVisible(
      app.getGraphicsOptions(1).axes.x.visible,
      app.getGraphicsOptions(1).axes.y.visible,
      v,
    ),
  rounding: (app, v) => app.setRounding(v),
  hidecursorwhendragging: (app, v) => app.hideCursorWhenDragging(v),
  repaintingactive: (app, v) => app.setRepaintingActive(v),
  errordialogsactive: (app, v) => app.setErrorDialogsActive(v),
  coordsystem: (app, v) =>
    app.setCoordSystem(...splitlist(v).map((x) => parseFloat(x))),
  axislabels: (app, v) => app.setAxisLabels(1, ...splitlist(v)),
  xaxislabel: (app, v) =>
    app.setAxisLabels(
      1,
      v,
      app.getGraphicsOptions(1).axes.y.label || "",
      app.getGraphicsOptions(1).axes.z.label || "",
    ),
  yaxislabel: (app, v) =>
    app.setAxisLabels(
      1,
      app.getGraphicsOptions(1).axes.x.label || "",
      v,
      app.getGraphicsOptions(1).axes.z.label || "",
    ),
  zaxislabel: (app, v) =>
    app.setAxisLabels(
      1,
      app.getGraphicsOptions(1).axes.x.label || "",
      app.getGraphicsOptions(1).axes.y.label || "",
      v,
    ),
  axissteps: (app, v) =>
    app.setAxisSteps(...splitlist(v).map((x) => parseFloat(x))),
  axisunits: (app, v) => app.setAxisUnits(...splitlist(v)),
  grid: (app, v) => app.setGridVisible(1, v),
  grid1: (app, v) => app.setGridVisible(1, v),
  grid2: (app, v) => app.setGridVisible(2, v),
  grid3: (app, v) => app.setGridVisible(3, v),
  editorstate: (app, content) => app.setEditorState({ content }),
};

const graphics_option_names = [
  "pointCapturing",
  "gridIsBold",
  "gridType",
  "bgColor",
  "gridColor",
  "axesColor",
];

class GeogebraElement extends HTMLElement {
  static get observedAttributes() {
    let names = init_param_names.slice();
    names = names.concat(Object.keys(methodAttributes));
    names = names.concat(graphics_option_names);
    names = names.concat([
      "material",
      "gridDistance",
      "sortAlgebra",
      "pointcapture",
      "rightanglestyle",
      "mode",
    ]);
    return names.map((n) => n.toLowerCase());
  }

  reset() {
    this._app_created = new Promise((resolve, reject) => {
      this._resolve_app_created = resolve;
    });
    this._app = null;
  }

  constructor() {
    super();
    this.reset();

    this.init_commands = this.textContent.trim().replace(/^\s*$\n?/gm, "");

    this.wrap_methods();

    this.setup_attribute_changers();

    this.setup_props();

    this.dispatchEvent(new CustomEvent("appletconstructed"));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    const { group, fn } = this.attribute_changers[name];

    const value = clean_attribute(newValue);

    const group_handlers = {
      init: () => {
        if (this._app) {
          const xml = this._app.getXML();
          this.reset();
          this.try_create(xml);
        }
      },
      immediate: async () => {
        const app = await this.applet;
        fn(app, value);
      },
      "graphics options": () => {
        this.set_graphics_options();
      },
    };

    if (!(group in group_handlers)) {
      throw new Error(`Invalid attribute changer group: ${group}`);
    }
    group_handlers[group]();
  }

  connectedCallback() {
    if (!this._app) {
      this.try_create();
    }
  }

  /** Add some methods to this object which wrap methods in the GeoGebra API
   */
  wrap_methods() {
    method_names.forEach((name) => {
      this[name] = async (...args) => {
        const app = await this.applet;
        return app[name](...args);
      };
    });
  }

  /** Setup functions which should be called when an attribute's value changes
   */
  setup_attribute_changers() {
    this.attribute_changers = {
      material: { group: "init" },
    };
    for (let name of init_param_names) {
      let changer;
      const set_method = "set" + capitalise(name);
      if (method_names.indexOf(set_method) >= 0) {
        changer = {
          group: "immediate",
          fn: (app, v) => app[set_method](v),
        };
      } else if (method_names.indexOf(name) >= 0) {
        changer = {
          group: "immediate",
          fn: (app, v) => app[name](v),
        };
      } else {
        changer = {
          group: "init",
        };
      }
      this.attribute_changers[name.toLowerCase()] = changer;
    }

    Object.entries(methodAttributes).map(([name, fn]) => {
      this.attribute_changers[name.toLowerCase()] = {
        group: "immediate",
        fn: (app, v) => {
          if (v === null) {
            return;
          }
          fn(app, v);
        },
      };
    });

    for (let name of graphics_option_names.concat(["gridDistance"])) {
      this.attribute_changers[name.toLowerCase()] = {
        group: "graphics options",
        fn: (app, v) => this.set_graphics_options(),
      };
    }

    this.attribute_changers["pointcapture"] = {
      group: "immediate",
      fn: (app, v) =>
        app.setPointCapture(
          1,
          enum_attribute(v, ["none", "snap", "fixed", "automatic"]),
        ),
    };
    this.attribute_changers["sortalgebra"] = {
      group: "immediate",
      fn: (app, v) =>
        app.setAlgebraOptions({
          sortBy: enum_attribute(v, ["dependency", "type", "layer", "order"]),
        }),
    };

    this.attribute_changers["mode"] = {
      group: "immediate",
      fn: (app, v) => app.setMode(map_attribute(v, mode_map)),
    };
  }

  get_data(name) {
    const container = this.querySelector(".appletParameters");
    if (!container) {
      return;
    }
    return container.getAttribute(`data-${name.toLowerCase()}`);
  }

  /** Add properties on this object which set or get properties from the applet.
   */
  setup_props() {
    Object.entries(props).forEach(([name, { get, set }]) => {
      const d = {};
      if (get) {
        d.get = () => {
          if (this._app) {
            return get(this._app, this);
          }
          throw new Error("The GeoGebra app has not loaded yet.");
        };
      }
      if (set) {
        d.set = async (v) => {
          const app = await this.applet;
          set(app, v, this);
        };
      }
      Object.defineProperty(this, name, d);
    });
  }

  /** Get the value of an attribute, and convert it to a number or boolean when appropriate.
   */
  cleanGetAttribute(name) {
    if (!this.hasAttribute(name)) {
      return null;
    }

    let v = this.getAttribute(name);

    return clean_attribute(v);
  }

  async set_graphics_options() {
    const app = await this.applet;
    const graphics_options = Object.fromEntries(
      graphics_option_names
        .filter((name) => this.hasAttribute(name))
        .map((name) => [name, this.cleanGetAttribute(name)]),
    );
    graphics_options["rightAngleStyle"] = enum_attribute(
      this.getAttribute("rightanglestyle"),
      ["none", "square", "dot", "l"],
    );
    if (this.hasAttribute("gridDistance")) {
      const v = this.cleanGetAttribute("gridDistance");
      const [x, y] = v.split(",").map((x) => parseFloat(x));
      graphics_options["gridDistance"] = { x, y };
    }
    app.setGraphicsOptions(1, graphics_options);
  }

  try_create(xml) {
    let applet;
    // Parameters not loaded from attributes:
    // appletOnLoad, useBrowserForJS

    const options = Object.fromEntries(
      init_param_names
        .filter((name) => this.hasAttribute(name))
        .map((name) => [name, this.cleanGetAttribute(name)]),
    );

    if (!xml) {
      if (this.hasAttribute("material")) {
        options.material_id = clean_material_id(
          this.cleanGetAttribute("material"),
        );
      }
    }

    this.innerHTML = "";

    const div = document.createElement("div");
    this.appendChild(div);
    options.appletOnLoad = (app) => {
      app.registerClientListener((detail) => {
        this.dispatchEvent(new CustomEvent(detail.type, { detail: detail }));
      });
      app.registerClearListener(() =>
        this.dispatchEvent(new CustomEvent("clear")),
      );
      const other_events = ["Add", "Click", "Remove", "Rename", "Update"];
      other_events.forEach((event_name) => {
        app[`register${event_name}Listener`]((name) => {
          this.dispatchEvent(
            new CustomEvent(event_name.toLowerCase(), {
              detail: { object: name },
            }),
          );
        });
      });

      this.set_graphics_options();

      if (xml !== undefined) {
        app.setXML(xml);
      } else if (this.init_commands) {
        app.evalCommand(this.init_commands);
      }
      this._app = app;
      this._resolve_app_created(app);
      this.dispatchEvent(new CustomEvent("load", { detail: app }));
    };
    applet = new window.GGBApplet(options, true);
    applet.inject(div, "preferHTML5");
  }

  /** Returns a Promise which resolves to the GGBApplet object for this element.
   */
  get applet() {
    return this._app_created;
  }

  async set_point(name, coords) {
    const app = await this.applet;
    return app.evalCommand(`${name} = (${coords.join(",")})`);
  }

  async create_object(name, command) {
    const app = await this.applet;
    app.evalCommand(`${name} = ${command}`);
    return new GeoGebraObjectProxy(app, name);
  }

  async get_object(name) {
    const app = await this.applet;
    return new GeoGebraObjectProxy(app, name);
  }

  objects() {
    const app = this._app;
    if (!app) {
      return [];
    }
    const names = app.getAllObjectNames();
    return names.map((name) => new GeoGebraObjectProxy(app, name));
  }
}

class GeoGebraObjectProxy {
  constructor(applet, name) {
    this.applet = applet;
    this._name = name;
  }

  get name() {
    return this._name;
  }
  set name(name) {
    this.applet.renameObject(this._name, name);
    this._name = name;
  }

  get coords() {
    return [
      this.applet.getXcoord(this.name),
      this.applet.getYcoord(this.name),
      this.applet.getZcoord(this.name),
    ];
  }
  set coords(coords) {
    this.applet.setCoords(this.name, ...coords);
  }

  listValue(i) {
    return this.applet.getListValue(this.name, i);
  }
  get valueStringLocalized() {
    return this.applet.getValueString(this.name, true);
  }
  get commandLocalized() {
    return this.applet.getCommandString(this.name, true);
  }
  get LaTeXBase64Value() {
    return this.applet.getLaTeXBase64(this.name, true);
  }
  get labelStyleSubstituted() {
    return this.applet.getLabelStyle(this.name, true);
  }

  delete() {
    this.applet.deleteObject(this.name);
  }

  hide() {
    this.applet.setVisible(this.name, false);
  }
  show() {
    this.applet.setVisible(this.name, true);
  }

  on(name, fn) {
    const method = {
      add: "registerAddListener",
      click: "registerClickListener",
      remove: "registerRemoveListener",
      rename: "registerRenameListener",
      update: "registerUpdateListener",
    }[name];

    if (method) {
      this.applet[method]((object_name) => {
        if (object_name != this.name) {
          return;
        }
        fn();
      });
    } else {
      this.applet.registerClientListener((detail) => {
        if (!(detail.target == this.name && detail.type == name)) {
          return;
        }
        fn(detail);
      });
    }
  }
}

function parse_css_color(color) {
  if (typeof color != "string") {
    return color;
  }
  const d = document.createElement("div");
  d.style.color = color;
  if (!d.style.color) {
    return [0, 0, 0];
  }
  const [_, r, g, b] = d.style.color.match(/^rgb\((.*?),(.*?),(.*)\)/);
  return [r, g, b].map((v) => parseFloat(v));
}

const object_proxy_properties = {
  x: {
    get: "getXcoord",
    set(x) {
      this.applet.setCoords(this.name, x, this.y, this.z);
    },
  },
  y: {
    get: "getYcoord",
    set(y) {
      this.applet.setCoords(this.name, this.x, y, this.z);
    },
  },
  z: {
    get: "getZcoord",
    set(z) {
      this.applet.setCoords(this.name, this.x, this.y, z);
    },
  },
  value: { get: "getValue", set: "setValue" },
  color: {
    get: "getColor",
    set(color) {
      this.applet.setColor(this.name, ...parse_css_color(color));
    },
  },
  visible: { get: "getVisible", set: "setVisible" },
  valueString: { get: "getValueString" },
  definition: { get: "getDefinitionString" },
  command: {
    get: "getCommandString",
    set(cmd) {
      this.applet.evalCommand(`${this.name} = ${cmd}`);
    },
  },
  LaTeXString: { get: "getLaTeXString" },
  LaTeXBase64: { get: "getLaTeXBase64" },
  objectType: { get: "getObjectType" },
  exists: { get: "exists" },
  isDefined: { get: "isDefined" },
  layer: { get: "getLayer", set: "setLayer" },
  lineStyle: {
    get: "getLineStyle",
    set(v) {
      this.applet.setLineStyle(
        this.name,
        enum_attribute(v, [
          "full",
          "dashed long",
          "dashed short",
          "dotted",
          "dash-dot",
        ]),
      );
    },
  },
  lineThickness: { get: "getLineThickness", set: "setLineThickness" },
  pointStyle: {
    get: "getPointStyle",
    set(v) {
      this.applet.setPointStyle(
        this.name,
        enum_attribute(v, [
          "filled circle",
          "cross",
          "circle",
          "plus",
          "filled diamond",
          "unfilled diamond",
          "triangle north",
          "triangle south",
          "triangle east",
          "triangle west",
        ]),
      );
    },
  },
  pointSize: { get: "getPointSize", set: "setPointSize" },
  filling: { get: "getFilling", set: "setFilling" },
  caption: { get: "getCaption", set: "setCaption" },
  labelStyle: {
    get: "getLabelStyle",
    set(v) {
      this.applet.setLabelStyle(
        this.name,
        enum_attribute(v, ["name", "name value", "value", "caption"]),
      );
    },
  },
  labelVisible: { get: "getLabelVisible", set: "setLabelVisible" },
  auxiliary: { set: "setAuxiliary" },
  fixed: { set: "setFixed" },
  trace: { set: "setTrace" },
  isIndependent: { get: "isIndependent" },
  isMoveable: { get: "isMoveable" },
  animating: { set: "setAnimating" },
  animationSpeed: { set: "setAnimationSpeed" },
};

Object.entries(object_proxy_properties).forEach(([prop, { get, set }]) => {
  Object.defineProperty(GeoGebraObjectProxy.prototype, prop, {
    get() {
      return this.applet[get](this.name);
    },
    set(v) {
      if (typeof set == "string") {
        this.applet[set](this.name, v);
      } else {
        set.apply(this, [v]);
      }
    },
  });
});

customElements.define("hyperbook-geogebra", GeogebraElement);
