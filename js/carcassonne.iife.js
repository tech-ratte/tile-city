var Carcassonne = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // js/game/index.js
  var index_exports = {};
  __export(index_exports, {
    COLOR_PALETTE: () => COLOR_PALETTE,
    DIR_NAME: () => DIR_NAME,
    EDGE_NAME: () => EDGE_NAME,
    FIELD_CITY_TOUCH: () => FIELD_CITY_TOUCH,
    FIELD_PORTS: () => FIELD_PORTS,
    MARKUP: () => MARKUP,
    MEEPLES_EACH: () => MEEPLES_EACH,
    MEEPLE_LAYOUTS: () => MEEPLE_LAYOUTS,
    NAME_MAX: () => NAME_MAX,
    PLAYERS: () => PLAYERS,
    PLAYERS_MAX: () => PLAYERS_MAX,
    PLAYERS_MIN: () => PLAYERS_MIN,
    SAVE_VERSION: () => SAVE_VERSION,
    TYPES: () => TYPES,
    boardErrors: () => boardErrors,
    buildTiles: () => buildTiles,
    canPlace: () => canPlace,
    cityPoints: () => cityPoints,
    collectCityComponent: () => collectCityComponent,
    collectFieldComponent: () => collectFieldComponent,
    collectRoadComponent: () => collectRoadComponent,
    completedCitiesTouchingField: () => completedCitiesTouchingField,
    createGame: () => createGame,
    default: () => index_default,
    edgeText: () => edgeText,
    finalizeScores: () => finalizeScores,
    isMeepleSlotOpen: () => isMeepleSlotOpen,
    listMeepleSlots: () => listMeepleSlots,
    makeTile: () => makeTile,
    monasteryComplete: () => monasteryComplete,
    normalizePlayers: () => normalizePlayers,
    openCells: () => openCells,
    rankPlayers: () => rankPlayers,
    resolveCompletions: () => resolveCompletions,
    restoreGame: () => restoreGame,
    roadPoints: () => roadPoints,
    rotateEdges: () => rotateEdges,
    serializeGame: () => serializeGame,
    simulateToLastTile: () => simulateToLastTile,
    tileHTML: () => tileHTML
  });

  // js/game/constants.js
  var COLOR_PALETTE = [
    { id: "red", hex: "#ff5d78", label: "Red" },
    { id: "blue", hex: "#49c4ff", label: "Blue" },
    { id: "green", hex: "#3dff9a", label: "Green" },
    { id: "yellow", hex: "#ffe14a", label: "Yellow" },
    { id: "orange", hex: "#ff9a3d", label: "Orange" },
    { id: "purple", hex: "#7c3aed", label: "Purple" },
    { id: "white", hex: "#f4f7fb", label: "White" },
    { id: "brown", hex: "#a67c52", label: "Brown" }
  ];
  var PLAYERS = COLOR_PALETTE.slice(0, 4).map((color) => ({
    id: color.id,
    name: color.label
  }));
  var MEEPLES_EACH = 7;
  var PLAYERS_MIN = 2;
  var PLAYERS_MAX = 8;
  var NAME_MAX = 6;
  function normalizePlayers(list) {
    if (!Array.isArray(list) || !list.length) {
      return PLAYERS.map((player) => ({ id: player.id, name: player.name }));
    }
    const known = new Set(COLOR_PALETTE.map((color) => color.id));
    const used = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of list) {
      if (out.length >= PLAYERS_MAX) break;
      const id = item && known.has(item.id) ? item.id : null;
      if (!id || used.has(id)) continue;
      used.add(id);
      const raw = item.name == null ? "" : String(item.name);
      const name = raw.trim().slice(0, NAME_MAX) || COLOR_PALETTE.find((c) => c.id === id).label;
      out.push({ id, name });
    }
    if (out.length < PLAYERS_MIN) {
      return PLAYERS.map((player) => ({ id: player.id, name: player.name }));
    }
    return out;
  }
  var EDGE_NAME = { C: "\u90FD\u5E02", R: "\u9053", F: "\u8349\u539F" };
  var DIR_NAME = ["\u5317", "\u6771", "\u5357", "\u897F"];
  var NEI = [
    { dir: 0, dx: 0, dy: -1, opp: 2 },
    { dir: 1, dx: 1, dy: 0, opp: 3 },
    { dir: 2, dx: 0, dy: 1, opp: 0 },
    { dir: 3, dx: -1, dy: 0, opp: 1 }
  ];
  var DIRS = ["N", "E", "S", "W"];
  var DIR_INDEX = { N: 0, E: 1, S: 2, W: 3 };
  var OPP_DIR = { N: "S", E: "W", S: "N", W: "E" };

  // js/game/catalog.js
  var TYPES = [
    { id: "A", name: "\u4FEE\u9053\u9662\u3068\u9053", count: 2, edges: ["F", "F", "R", "F"], cities: [], roads: [["S"]], monastery: true },
    { id: "B", name: "\u4FEE\u9053\u9662", count: 4, edges: ["F", "F", "F", "F"], cities: [], roads: [], monastery: true },
    { id: "C", name: "\u56DB\u8FBA\u304C\u90FD\u5E02", count: 1, edges: ["C", "C", "C", "C"], cities: [{ edges: ["N", "E", "S", "W"], pennant: true }], roads: [], monastery: false },
    { id: "D", name: "\u90FD\u5E02\u3068\u76F4\u7DDA\u306E\u9053", count: 4, edges: ["C", "R", "F", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["E", "W"]], monastery: false },
    { id: "E", name: "\u4E00\u65B9\u3060\u3051\u306E\u90FD\u5E02", count: 5, edges: ["C", "F", "F", "F"], cities: [{ edges: ["N"], pennant: false }], roads: [], monastery: false },
    { id: "F", name: "\u5411\u304B\u3044\u306E\u90FD\u5E02\u304C\u3064\u306A\u304C\u308B", count: 2, edges: ["F", "C", "F", "C"], cities: [{ edges: ["E", "W"], pennant: true }], roads: [], monastery: false },
    { id: "G", name: "\u5411\u304B\u3044\u306E\u90FD\u5E02\u304C\u3064\u306A\u304C\u308B", count: 1, edges: ["F", "C", "F", "C"], cities: [{ edges: ["E", "W"], pennant: false }], roads: [], monastery: false },
    { id: "H", name: "\u5411\u304B\u3044\u306E\u90FD\u5E02\u304C\u5206\u304B\u308C\u308B", count: 3, edges: ["C", "F", "C", "F"], cities: [{ edges: ["N"], pennant: false }, { edges: ["S"], pennant: false }], roads: [], monastery: false },
    { id: "I", name: "\u96A3\u306E\u90FD\u5E02\u304C\u5206\u304B\u308C\u308B", count: 2, edges: ["C", "F", "F", "C"], cities: [{ edges: ["N"], pennant: false }, { edges: ["W"], pennant: false }], roads: [], monastery: false },
    { id: "J", name: "\u90FD\u5E02\u3068\u53F3\u306E\u30AB\u30FC\u30D6", count: 3, edges: ["C", "R", "R", "F"], cities: [{ edges: ["N"], pennant: false }], roads: [["E", "S"]], monastery: false },
    { id: "K", name: "\u90FD\u5E02\u3068\u5DE6\u306E\u30AB\u30FC\u30D6", count: 3, edges: ["C", "F", "R", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["S", "W"]], monastery: false },
    { id: "L", name: "\u90FD\u5E02\u3068\u4E09\u53C9\u8DEF", count: 3, edges: ["C", "R", "R", "R"], cities: [{ edges: ["N"], pennant: false }], roads: [["E"], ["S"], ["W"]], monastery: false },
    { id: "M", name: "\u89D2\u306E\u90FD\u5E02", count: 2, edges: ["C", "C", "F", "F"], cities: [{ edges: ["N", "E"], pennant: true }], roads: [], monastery: false },
    { id: "N", name: "\u89D2\u306E\u90FD\u5E02", count: 3, edges: ["C", "C", "F", "F"], cities: [{ edges: ["N", "E"], pennant: false }], roads: [], monastery: false },
    { id: "O", name: "\u89D2\u306E\u90FD\u5E02\u3068\u9053", count: 2, edges: ["C", "R", "R", "C"], cities: [{ edges: ["N", "W"], pennant: true }], roads: [["E", "S"]], monastery: false },
    { id: "P", name: "\u89D2\u306E\u90FD\u5E02\u3068\u9053", count: 3, edges: ["C", "R", "R", "C"], cities: [{ edges: ["N", "W"], pennant: false }], roads: [["E", "S"]], monastery: false },
    { id: "Q", name: "\u4E09\u65B9\u304C\u90FD\u5E02", count: 1, edges: ["C", "C", "F", "C"], cities: [{ edges: ["N", "E", "W"], pennant: true }], roads: [], monastery: false },
    { id: "R", name: "\u4E09\u65B9\u304C\u90FD\u5E02", count: 3, edges: ["C", "C", "F", "C"], cities: [{ edges: ["N", "E", "W"], pennant: false }], roads: [], monastery: false },
    { id: "S", name: "\u4E09\u65B9\u306E\u90FD\u5E02\u3068\u5165\u53E3\u306E\u9053", count: 2, edges: ["C", "C", "R", "C"], cities: [{ edges: ["N", "E", "W"], pennant: true }], roads: [["S"]], monastery: false },
    { id: "T", name: "\u4E09\u65B9\u306E\u90FD\u5E02\u3068\u5165\u53E3\u306E\u9053", count: 1, edges: ["C", "C", "R", "C"], cities: [{ edges: ["N", "E", "W"], pennant: false }], roads: [["S"]], monastery: false },
    { id: "U", name: "\u76F4\u7DDA\u306E\u9053", count: 8, edges: ["R", "F", "R", "F"], cities: [], roads: [["N", "S"]], monastery: false },
    { id: "V", name: "\u30AB\u30FC\u30D6", count: 9, edges: ["F", "F", "R", "R"], cities: [], roads: [["S", "W"]], monastery: false },
    { id: "W", name: "\u4E09\u53C9\u8DEF", count: 4, edges: ["F", "R", "R", "R"], cities: [], roads: [["E"], ["S"], ["W"]], monastery: false },
    { id: "X", name: "\u5341\u5B57\u8DEF", count: 1, edges: ["R", "R", "R", "R"], cities: [], roads: [["N"], ["E"], ["S"], ["W"]], monastery: false }
  ];
  var MARKUP = {
    A: '<i class="road to-s"></i><span class="monastery"><i class="cross"></i><i class="roof"></i><i class="body"></i></span>',
    B: '<span class="monastery"><i class="cross"></i><i class="roof"></i><i class="body"></i></span>',
    C: '<i class="city fill"></i><i class="keep"></i><i class="pennant p-c" title="\u65D7"></i>',
    D: '<i class="city cap n"></i><i class="road h"></i>',
    E: '<i class="city cap n"></i>',
    F: '<i class="city bar h"></i><i class="pennant p-bar" title="\u65D7"></i>',
    G: '<i class="city bar h"></i>',
    H: '<i class="city cap n"></i><i class="city cap s"></i>',
    I: '<i class="city cap n gap-w"></i><i class="city cap w gap-n"></i>',
    J: '<i class="city cap n"></i><i class="bend se edge"></i><i class="bend se line"></i>',
    K: '<i class="city cap n"></i><i class="bend sw edge"></i><i class="bend sw line"></i>',
    L: '<i class="city cap n"></i><i class="road h-e"></i><i class="road h-w"></i><i class="road v-s"></i><i class="village"></i>',
    M: '<i class="city elbow ne"></i><i class="pennant p-ne" title="\u65D7"></i>',
    N: '<i class="city elbow ne"></i>',
    O: '<i class="city elbow nw"></i><i class="bend se edge"></i><i class="bend se line"></i><i class="pennant p-nw" title="\u65D7"></i>',
    P: '<i class="city elbow nw"></i><i class="bend se edge"></i><i class="bend se line"></i>',
    Q: '<i class="city mouth s"></i><i class="pennant p-u" title="\u65D7"></i>',
    R: '<i class="city mouth s"></i>',
    S: '<i class="city mouth s"></i><i class="road gate"></i><i class="pennant p-u" title="\u65D7"></i>',
    T: '<i class="city mouth s"></i><i class="road gate"></i>',
    U: '<i class="road v"></i>',
    V: '<i class="bend sw edge"></i><i class="bend sw line"></i>',
    W: '<i class="road h-e"></i><i class="road h-w"></i><i class="road v-s"></i><i class="village"></i>',
    X: '<i class="road v-n"></i><i class="road h-e"></i><i class="road v-s"></i><i class="road h-w"></i><i class="village"></i>'
  };
  var BY_ID = Object.fromEntries(TYPES.map((type) => [type.id, type]));
  var MEEPLE_LAYOUTS = {
    A: [
      { id: "monastery", kind: "monastery", x: 0.5, y: 0.4 },
      { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.78 },
      { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.28 }
    ],
    B: [
      { id: "monastery", kind: "monastery", x: 0.5, y: 0.4 },
      { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.72 }
    ],
    C: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.5 }
    ],
    D: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.18 },
      { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.5 },
      // Gap under the city tip joins left/right above the road into one field.
      { id: "field-0", kind: "field", index: 0, x: 0.2, y: 0.38 },
      { id: "field-1", kind: "field", index: 1, x: 0.5, y: 0.8 }
    ],
    E: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.18 },
      { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.68 }
    ],
    F: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.16 },
      { id: "field-1", kind: "field", index: 1, x: 0.5, y: 0.84 }
    ],
    G: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.16 },
      { id: "field-1", kind: "field", index: 1, x: 0.5, y: 0.84 }
    ],
    H: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
      { id: "city-1", kind: "city", index: 1, x: 0.5, y: 0.84 },
      // East/west grass joins through the middle gap between the two cities.
      { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.5 }
    ],
    I: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
      { id: "city-1", kind: "city", index: 1, x: 0.16, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.72, y: 0.72 }
    ],
    J: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
      // SE bend: road on the arc, inner field in the SE pocket, large field west.
      { id: "road-0", kind: "road", index: 0, x: 0.62, y: 0.62 },
      { id: "field-0", kind: "field", index: 0, x: 0.24, y: 0.42 },
      { id: "field-1", kind: "field", index: 1, x: 0.84, y: 0.84 }
    ],
    K: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
      { id: "road-0", kind: "road", index: 0, x: 0.38, y: 0.62 },
      { id: "field-0", kind: "field", index: 0, x: 0.76, y: 0.42 },
      { id: "field-1", kind: "field", index: 1, x: 0.16, y: 0.84 }
    ],
    L: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.16 },
      { id: "road-0", kind: "road", index: 0, x: 0.78, y: 0.5 },
      { id: "road-1", kind: "road", index: 1, x: 0.5, y: 0.78 },
      { id: "road-2", kind: "road", index: 2, x: 0.22, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.86, y: 0.86 },
      { id: "field-1", kind: "field", index: 1, x: 0.14, y: 0.86 },
      // Northern strip field: outer NE pocket (top corners are city).
      { id: "field-2", kind: "field", index: 2, x: 0.86, y: 0.16 }
    ],
    M: [
      { id: "city-0", kind: "city", index: 0, x: 0.68, y: 0.24 },
      { id: "field-0", kind: "field", index: 0, x: 0.28, y: 0.72 }
    ],
    N: [
      { id: "city-0", kind: "city", index: 0, x: 0.68, y: 0.24 },
      { id: "field-0", kind: "field", index: 0, x: 0.28, y: 0.72 }
    ],
    O: [
      { id: "city-0", kind: "city", index: 0, x: 0.28, y: 0.22 },
      { id: "road-0", kind: "road", index: 0, x: 0.62, y: 0.62 },
      { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.28 },
      { id: "field-1", kind: "field", index: 1, x: 0.84, y: 0.84 }
    ],
    P: [
      { id: "city-0", kind: "city", index: 0, x: 0.28, y: 0.22 },
      { id: "road-0", kind: "road", index: 0, x: 0.62, y: 0.62 },
      { id: "field-0", kind: "field", index: 0, x: 0.78, y: 0.28 },
      { id: "field-1", kind: "field", index: 1, x: 0.84, y: 0.84 }
    ],
    Q: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.32 },
      { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.82 }
    ],
    R: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.32 },
      { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.82 }
    ],
    S: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.28 },
      { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.78 },
      { id: "field-0", kind: "field", index: 0, x: 0.14, y: 0.86 },
      { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.86 }
    ],
    T: [
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.28 },
      { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.78 },
      { id: "field-0", kind: "field", index: 0, x: 0.14, y: 0.86 },
      { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.86 }
    ],
    U: [
      { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.22, y: 0.5 },
      { id: "field-1", kind: "field", index: 1, x: 0.78, y: 0.5 }
    ],
    // Large outer field (N/E) and small field inside the SW curve.
    V: [
      { id: "road-0", kind: "road", index: 0, x: 0.38, y: 0.62 },
      { id: "field-0", kind: "field", index: 0, x: 0.7, y: 0.3 },
      { id: "field-1", kind: "field", index: 1, x: 0.16, y: 0.84 }
    ],
    W: [
      { id: "road-0", kind: "road", index: 0, x: 0.78, y: 0.5 },
      { id: "road-1", kind: "road", index: 1, x: 0.5, y: 0.78 },
      { id: "road-2", kind: "road", index: 2, x: 0.22, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.5, y: 0.14 },
      { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.86 },
      { id: "field-2", kind: "field", index: 2, x: 0.14, y: 0.86 }
    ],
    X: [
      { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.22 },
      { id: "road-1", kind: "road", index: 1, x: 0.78, y: 0.5 },
      { id: "road-2", kind: "road", index: 2, x: 0.5, y: 0.78 },
      { id: "road-3", kind: "road", index: 3, x: 0.22, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.14, y: 0.14 },
      { id: "field-1", kind: "field", index: 1, x: 0.86, y: 0.14 },
      { id: "field-2", kind: "field", index: 2, x: 0.86, y: 0.86 },
      { id: "field-3", kind: "field", index: 3, x: 0.14, y: 0.86 }
    ]
  };
  var FIELD_PORTS = {
    A: [[["N", 0], ["N", 1], ["E", 0], ["E", 1], ["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
    B: [[["N", 0], ["N", 1], ["E", 0], ["E", 1], ["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
    C: [],
    D: [
      [["E", 0], ["W", 1]],
      [["E", 1], ["W", 0], ["S", 0], ["S", 1]]
    ],
    E: [[["E", 0], ["E", 1], ["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
    F: [[["N", 0], ["N", 1]], [["S", 0], ["S", 1]]],
    G: [[["N", 0], ["N", 1]], [["S", 0], ["S", 1]]],
    H: [[["E", 0], ["E", 1], ["W", 0], ["W", 1]]],
    I: [[["E", 0], ["E", 1], ["S", 0], ["S", 1]]],
    J: [
      [["W", 0], ["W", 1], ["E", 0], ["S", 1]],
      [["E", 1], ["S", 0]]
    ],
    K: [
      [["E", 0], ["E", 1], ["S", 0], ["W", 1]],
      [["S", 1], ["W", 0]]
    ],
    L: [
      [["E", 1], ["S", 0]],
      [["S", 1], ["W", 0]],
      [["E", 0], ["W", 1]]
    ],
    M: [[["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
    N: [[["S", 0], ["S", 1], ["W", 0], ["W", 1]]],
    O: [
      [["E", 0], ["S", 1]],
      [["E", 1], ["S", 0]]
    ],
    P: [
      [["E", 0], ["S", 1]],
      [["E", 1], ["S", 0]]
    ],
    Q: [[["S", 0], ["S", 1]]],
    R: [[["S", 0], ["S", 1]]],
    S: [[["S", 1]], [["S", 0]]],
    T: [[["S", 1]], [["S", 0]]],
    U: [
      [["W", 0], ["W", 1], ["N", 0], ["S", 1]],
      [["E", 0], ["E", 1], ["N", 1], ["S", 0]]
    ],
    V: [
      [["N", 0], ["N", 1], ["E", 0], ["E", 1], ["S", 0], ["W", 1]],
      [["S", 1], ["W", 0]]
    ],
    W: [
      [["N", 0], ["N", 1], ["E", 0], ["W", 1]],
      [["E", 1], ["S", 0]],
      [["S", 1], ["W", 0]]
    ],
    X: [
      [["N", 0], ["W", 1]],
      [["N", 1], ["E", 0]],
      [["E", 1], ["S", 0]],
      [["S", 1], ["W", 0]]
    ]
  };
  var FIELD_CITY_TOUCH = {
    D: [[0, 0]],
    E: [[0, 0]],
    F: [[0, 0], [1, 0]],
    G: [[0, 0], [1, 0]],
    H: [[0, 0], [0, 1]],
    I: [[0, 0], [0, 1]],
    J: [[0, 0]],
    K: [[0, 0]],
    L: [[2, 0]],
    M: [[0, 0]],
    N: [[0, 0]],
    O: [[0, 0]],
    P: [[0, 0]],
    Q: [[0, 0]],
    R: [[0, 0]],
    S: [[0, 0], [1, 0]],
    T: [[0, 0], [1, 0]]
  };

  // js/game/tiles.js
  function keyOf(x, y) {
    return x + "," + y;
  }
  function rotateEdges(edges, turns) {
    const n = (turns % 4 + 4) % 4;
    const next = edges.slice();
    for (let i = 0; i < n; i++) next.unshift(next.pop());
    return next;
  }
  function rotClass(rot) {
    const deg = (rot % 4 + 4) % 4 * 90;
    return deg ? "rot-" + deg : "";
  }
  function tileHTML(id, rot) {
    if (!MARKUP[id]) throw new Error("unknown tile " + id);
    const cls = ["tile", rotClass(rot)].filter(Boolean).join(" ");
    return '<div class="' + cls + '" aria-hidden="true">' + MARKUP[id] + "</div>";
  }
  function copyCities(cities) {
    return cities.map((city) => ({ edges: city.edges.slice(), pennant: !!city.pennant }));
  }
  function copyRoads(roads) {
    return roads.map((road) => road.slice());
  }
  function makeTile(id, start) {
    const type = BY_ID[id];
    if (!type) throw new Error("unknown tile " + id);
    return {
      id: type.id,
      name: type.name,
      edges: type.edges.slice(),
      cities: copyCities(type.cities),
      roads: copyRoads(type.roads),
      monastery: type.monastery,
      start: !!start
    };
  }
  function buildTiles() {
    const tiles = [];
    for (const type of TYPES) {
      for (let i = 0; i < type.count; i++) {
        tiles.push(makeTile(type.id, type.id === "D" && i === 0));
      }
    }
    return tiles;
  }
  function clonePlaced(tile, rot, owner) {
    return {
      id: tile.id,
      name: tile.name,
      edges: tile.edges.slice(),
      cities: copyCities(tile.cities),
      roads: copyRoads(tile.roads),
      monastery: tile.monastery,
      start: !!tile.start,
      rot: (rot % 4 + 4) % 4,
      owner: owner || null,
      meeple: null
    };
  }
  function rotatePoint(point, rot) {
    let x = point.x - 0.5;
    let y = point.y - 0.5;
    const turns = (rot % 4 + 4) % 4;
    for (let i = 0; i < turns; i++) {
      const nextX = -y;
      y = x;
      x = nextX;
    }
    return { x: x + 0.5, y: y + 0.5 };
  }
  function listMeepleSlots(tile) {
    const layout = MEEPLE_LAYOUTS[tile.id];
    if (!layout) return [];
    const rot = tile.rot || 0;
    return layout.map((slot) => {
      const point = rotatePoint(slot, rot);
      return {
        id: slot.id,
        kind: slot.kind,
        index: slot.index == null ? null : slot.index,
        x: point.x,
        y: point.y
      };
    });
  }

  // js/game/board.js
  function canPlace(board, x, y, edges) {
    if (board.has(keyOf(x, y))) return false;
    let touch = 0;
    for (const step of NEI) {
      const other = board.get(keyOf(x + step.dx, y + step.dy));
      if (!other) continue;
      touch += 1;
      const facing = rotateEdges(other.edges, other.rot || 0);
      if (edges[step.dir] !== facing[step.opp]) return false;
    }
    return touch > 0;
  }
  function openCells(board) {
    const found = /* @__PURE__ */ new Set();
    for (const key of board.keys()) {
      const [x, y] = key.split(",").map(Number);
      for (const step of NEI) {
        const next = keyOf(x + step.dx, y + step.dy);
        if (!board.has(next)) found.add(next);
      }
    }
    return [...found].map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    });
  }
  function byPos(a, b) {
    return a.y - b.y || a.x - b.x;
  }
  function boardErrors(board) {
    const errors = [];
    for (const [key, tile] of board) {
      const [x, y] = key.split(",").map(Number);
      const edges = rotateEdges(tile.edges, tile.rot || 0);
      let touch = 0;
      for (const step of NEI) {
        const other = board.get(keyOf(x + step.dx, y + step.dy));
        if (!other) continue;
        touch += 1;
        const facing = rotateEdges(other.edges, other.rot || 0);
        if (edges[step.dir] !== facing[step.opp]) errors.push(key);
      }
      if (key !== "0,0" && touch === 0) errors.push("float " + key);
    }
    return errors;
  }
  function edgeText(edges) {
    return DIR_NAME.map((dir, index) => dir + " " + EDGE_NAME[edges[index]]).join(" \xB7 ");
  }

  // js/game/features.js
  function absDir(catalogDir, rot) {
    return DIRS[(DIR_INDEX[catalogDir] + (rot % 4 + 4) % 4) % 4];
  }
  function findRoadIndexByAbsEdge(tile, absEdge) {
    const rot = tile.rot || 0;
    for (let i = 0; i < (tile.roads || []).length; i++) {
      for (const dir of tile.roads[i]) {
        if (absDir(dir, rot) === absEdge) return i;
      }
    }
    return -1;
  }
  function findCityIndexByAbsEdge(tile, absEdge) {
    const rot = tile.rot || 0;
    for (let i = 0; i < (tile.cities || []).length; i++) {
      for (const dir of tile.cities[i].edges) {
        if (absDir(dir, rot) === absEdge) return i;
      }
    }
    return -1;
  }
  function collectRoadComponent(board, startX, startY, startRoadIndex) {
    const visited = /* @__PURE__ */ new Set();
    const queue = [{ x: startX, y: startY, index: startRoadIndex }];
    const parts = [];
    let open = false;
    while (queue.length) {
      const cur = queue.shift();
      const id = cur.x + "," + cur.y + "," + cur.index;
      if (visited.has(id)) continue;
      visited.add(id);
      parts.push(cur);
      const tile = board.get(keyOf(cur.x, cur.y));
      if (!tile || !tile.roads || !tile.roads[cur.index]) {
        open = true;
        continue;
      }
      const rot = tile.rot || 0;
      for (const catalogDir of tile.roads[cur.index]) {
        const dir = absDir(catalogDir, rot);
        const step = NEI[DIR_INDEX[dir]];
        const nx = cur.x + step.dx;
        const ny = cur.y + step.dy;
        const neighbor = board.get(keyOf(nx, ny));
        if (!neighbor) {
          open = true;
          continue;
        }
        const nextIndex = findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]);
        if (nextIndex < 0) {
          open = true;
          continue;
        }
        queue.push({ x: nx, y: ny, index: nextIndex });
      }
    }
    return { complete: !open, parts };
  }
  function collectCityComponent(board, startX, startY, startCityIndex) {
    const visited = /* @__PURE__ */ new Set();
    const queue = [{ x: startX, y: startY, index: startCityIndex }];
    const parts = [];
    let open = false;
    while (queue.length) {
      const cur = queue.shift();
      const id = cur.x + "," + cur.y + "," + cur.index;
      if (visited.has(id)) continue;
      visited.add(id);
      parts.push(cur);
      const tile = board.get(keyOf(cur.x, cur.y));
      if (!tile || !tile.cities || !tile.cities[cur.index]) {
        open = true;
        continue;
      }
      const rot = tile.rot || 0;
      for (const catalogDir of tile.cities[cur.index].edges) {
        const dir = absDir(catalogDir, rot);
        const step = NEI[DIR_INDEX[dir]];
        const nx = cur.x + step.dx;
        const ny = cur.y + step.dy;
        const neighbor = board.get(keyOf(nx, ny));
        if (!neighbor) {
          open = true;
          continue;
        }
        const nextIndex = findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]);
        if (nextIndex < 0) {
          open = true;
          continue;
        }
        queue.push({ x: nx, y: ny, index: nextIndex });
      }
    }
    return { complete: !open, parts };
  }
  function monasteryComplete(board, x, y) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!board.has(keyOf(x + dx, y + dy))) return false;
      }
    }
    return true;
  }
  function fieldPortsFor(tile) {
    return FIELD_PORTS[tile.id] || [];
  }
  function findFieldIndexByAbsPort(tile, absEdge, side) {
    const rot = tile.rot || 0;
    const fields = fieldPortsFor(tile);
    for (let i = 0; i < fields.length; i++) {
      for (const port of fields[i]) {
        if (absDir(port[0], rot) === absEdge && port[1] === side) return i;
      }
    }
    return -1;
  }
  function collectFieldComponent(board, startX, startY, startFieldIndex) {
    const visited = /* @__PURE__ */ new Set();
    const queue = [{ x: startX, y: startY, index: startFieldIndex }];
    const parts = [];
    let open = false;
    while (queue.length) {
      const cur = queue.shift();
      const id = cur.x + "," + cur.y + "," + cur.index;
      if (visited.has(id)) continue;
      visited.add(id);
      parts.push(cur);
      const tile = board.get(keyOf(cur.x, cur.y));
      const fields = tile ? fieldPortsFor(tile) : null;
      if (!tile || !fields || !fields[cur.index]) {
        open = true;
        continue;
      }
      const rot = tile.rot || 0;
      for (const port of fields[cur.index]) {
        const dir = absDir(port[0], rot);
        const side = port[1];
        const step = NEI[DIR_INDEX[dir]];
        const nx = cur.x + step.dx;
        const ny = cur.y + step.dy;
        const neighbor = board.get(keyOf(nx, ny));
        if (!neighbor) {
          open = true;
          continue;
        }
        const nextIndex = findFieldIndexByAbsPort(neighbor, OPP_DIR[dir], 1 - side);
        if (nextIndex < 0) {
          open = true;
          continue;
        }
        queue.push({ x: nx, y: ny, index: nextIndex });
      }
    }
    return { complete: !open, parts };
  }
  function featureHasMeeple(board, kind, parts) {
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile || !tile.meeple) continue;
      if (tile.meeple.kind !== kind) continue;
      if (kind === "monastery") return true;
      if (tile.meeple.index === part.index) return true;
    }
    return false;
  }
  function isMeepleSlotOpen(board, x, y, slot) {
    if (!slot) return false;
    if (slot.kind === "monastery") {
      const tile = board.get(keyOf(x, y));
      return !(tile && tile.meeple && tile.meeple.kind === "monastery");
    }
    if (slot.kind === "road") {
      const result = collectRoadComponent(board, x, y, slot.index);
      return !featureHasMeeple(board, "road", result.parts);
    }
    if (slot.kind === "city") {
      const result = collectCityComponent(board, x, y, slot.index);
      return !featureHasMeeple(board, "city", result.parts);
    }
    if (slot.kind === "field") {
      const result = collectFieldComponent(board, x, y, slot.index);
      return !featureHasMeeple(board, "field", result.parts);
    }
    return false;
  }

  // js/game/scoring.js
  function meepleCountsOnFeature(board, kind, parts, playerCount) {
    const counts = Array.from({ length: playerCount }, () => 0);
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile || !tile.meeple) continue;
      if (tile.meeple.kind !== kind) continue;
      if (kind !== "monastery" && tile.meeple.index !== part.index) continue;
      if (tile.meeple.player < 0 || tile.meeple.player >= playerCount) continue;
      counts[tile.meeple.player] += 1;
    }
    return counts;
  }
  function majorityPlayers(counts) {
    let best = 0;
    for (const count of counts) if (count > best) best = count;
    if (best <= 0) return [];
    const winners = [];
    for (let i = 0; i < counts.length; i++) if (counts[i] === best) winners.push(i);
    return winners;
  }
  function uniqueTileCount(parts) {
    const seen = /* @__PURE__ */ new Set();
    for (const part of parts) seen.add(part.x + "," + part.y);
    return seen.size;
  }
  function cityPennantCount(board, parts) {
    let total = 0;
    const seen = /* @__PURE__ */ new Set();
    for (const part of parts) {
      const id = part.x + "," + part.y + "," + part.index;
      if (seen.has(id)) continue;
      seen.add(id);
      const tile = board.get(keyOf(part.x, part.y));
      if (tile && tile.cities && tile.cities[part.index] && tile.cities[part.index].pennant) total += 1;
    }
    return total;
  }
  function componentId(parts) {
    return parts.map((part) => part.x + "," + part.y + "," + part.index).sort().join("|");
  }
  function awardPoints(game, players, points) {
    for (const player of players) game.scores[player] += points;
  }
  function returnMeepleFromTile(game, tile, kind, index) {
    if (!tile || !tile.meeple) return false;
    if (tile.meeple.kind !== kind) return false;
    if (kind === "road" || kind === "city" || kind === "field") {
      if (tile.meeple.index !== index) return false;
    }
    game.meeples[tile.meeple.player] += 1;
    tile.meeple = null;
    return true;
  }
  function returnMeeplesOnFeature(game, kind, parts) {
    let returned = 0;
    for (const part of parts) {
      const tile = game.board.get(keyOf(part.x, part.y));
      if (returnMeepleFromTile(game, tile, kind, part.index)) returned += 1;
    }
    return returned;
  }
  function labelMeepleEarnings(board, kind, parts, winners, points) {
    if (!points || !winners.length) return;
    const win = new Set(winners);
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile || !tile.meeple) continue;
      if (tile.meeple.kind !== kind) continue;
      if (kind !== "monastery" && tile.meeple.index !== part.index) continue;
      if (!win.has(tile.meeple.player)) continue;
      tile.meeple.earned = (tile.meeple.earned || 0) + points;
    }
  }
  function scoreFeature(game, kind, parts, points, options) {
    const opts = options || {};
    const winners = majorityPlayers(
      meepleCountsOnFeature(game.board, kind, parts, game.players.length)
    );
    if (winners.length && points > 0) {
      awardPoints(game, winners, points);
      if (!opts.returnMeeples) labelMeepleEarnings(game.board, kind, parts, winners, points);
    }
    if (opts.returnMeeples) return returnMeeplesOnFeature(game, kind, parts);
    return 0;
  }
  function roadPoints(parts, complete) {
    const tiles = uniqueTileCount(parts);
    return complete ? tiles : tiles;
  }
  function cityPoints(board, parts, complete) {
    const tiles = uniqueTileCount(parts);
    const pennants = cityPennantCount(board, parts);
    if (complete) return tiles * 2 + pennants * 2;
    return tiles + pennants;
  }
  function monasteryTileCount(board, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (board.has(keyOf(x + dx, y + dy))) count += 1;
      }
    }
    return count;
  }
  function completedCitiesTouchingField(board, fieldParts) {
    const seen = /* @__PURE__ */ new Set();
    let total = 0;
    for (const part of fieldParts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile) continue;
      const touches = FIELD_CITY_TOUCH[tile.id] || [];
      for (let i = 0; i < touches.length; i++) {
        if (touches[i][0] !== part.index) continue;
        const cityIndex = touches[i][1];
        const city = collectCityComponent(board, part.x, part.y, cityIndex);
        if (!city.complete) continue;
        const id = componentId(city.parts);
        if (seen.has(id)) continue;
        seen.add(id);
        total += 1;
      }
    }
    return total;
  }
  function resolveCompletions(game, x, y) {
    const board = game.board;
    const tile = board.get(keyOf(x, y));
    if (!tile) return { roads: 0, cities: 0, monasteries: 0, points: 0 };
    const summary = { roads: 0, cities: 0, monasteries: 0, points: 0 };
    const before = game.scores.slice();
    const seenRoads = /* @__PURE__ */ new Set();
    const seenCities = /* @__PURE__ */ new Set();
    (tile.roads || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenRoads.has(seed)) return;
      const result = collectRoadComponent(board, x, y, index);
      for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
      if (!result.complete) return;
      scoreFeature(game, "road", result.parts, roadPoints(result.parts, true), { returnMeeples: true });
      summary.roads += 1;
    });
    (tile.cities || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenCities.has(seed)) return;
      const result = collectCityComponent(board, x, y, index);
      for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
      if (!result.complete) return;
      scoreFeature(game, "city", result.parts, cityPoints(board, result.parts, true), { returnMeeples: true });
      summary.cities += 1;
    });
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const mx = x + dx;
        const my = y + dy;
        const spot = board.get(keyOf(mx, my));
        if (!spot || !spot.monastery) continue;
        if (!monasteryComplete(board, mx, my)) continue;
        if (!spot.meeple || spot.meeple.kind !== "monastery") continue;
        scoreFeature(game, "monastery", [{ x: mx, y: my, index: null }], 9, { returnMeeples: true });
        summary.monasteries += 1;
      }
    }
    summary.points = game.scores.reduce((sum, score, i) => sum + (score - before[i]), 0);
    return summary;
  }
  function finalizeScores(game) {
    const board = game.board;
    const seenRoads = /* @__PURE__ */ new Set();
    const seenCities = /* @__PURE__ */ new Set();
    const seenFields = /* @__PURE__ */ new Set();
    const stockBefore = game.meeples.slice();
    const keep = { returnMeeples: false };
    for (const [pos, tile] of board) {
      const [x, y] = pos.split(",").map(Number);
      (tile.roads || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenRoads.has(seed)) return;
        const result = collectRoadComponent(board, x, y, index);
        for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        scoreFeature(game, "road", result.parts, roadPoints(result.parts, false), keep);
      });
      (tile.cities || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenCities.has(seed)) return;
        const result = collectCityComponent(board, x, y, index);
        for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        scoreFeature(game, "city", result.parts, cityPoints(board, result.parts, false), keep);
      });
      if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery") {
        if (!monasteryComplete(board, x, y)) {
          scoreFeature(game, "monastery", [{ x, y, index: null }], monasteryTileCount(board, x, y), keep);
        }
      }
      const fields = fieldPortsFor(tile);
      fields.forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenFields.has(seed)) return;
        const result = collectFieldComponent(board, x, y, index);
        for (const part of result.parts) seenFields.add(part.x + "," + part.y + "," + part.index);
        const cities = completedCitiesTouchingField(board, result.parts);
        scoreFeature(game, "field", result.parts, cities * 3, keep);
      });
    }
    game.standings = rankPlayers(game.scores, stockBefore);
    game.rankingOpen = true;
  }
  function rankPlayers(scores, meeples) {
    return scores.map((_, index) => index).sort((a, b) => {
      if (scores[b] !== scores[a]) return scores[b] - scores[a];
      if (meeples[b] !== meeples[a]) return meeples[b] - meeples[a];
      return a - b;
    });
  }

  // js/game/engine.js
  function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }
  var Game = class {
    constructor(deck, players) {
      this.players = normalizePlayers(players);
      this.deck = deck;
      this.board = /* @__PURE__ */ new Map();
      this.discards = [];
      this.player = 0;
      this.current = null;
      this.rotation = 0;
      this.finished = false;
      this.scores = this.players.map(() => 0);
      this.meeples = this.players.map(() => MEEPLES_EACH);
      this.lastPlacedBy = Object.fromEntries(this.players.map((player) => [player.id, null]));
      this.pendingMeeple = null;
      this.pendingDiscard = false;
      this.standings = this.players.map((_, index) => index);
      this.finalScored = false;
      this.rankingOpen = false;
    }
    placedEdges(rot) {
      return rotateEdges(this.current.edges, rot == null ? this.rotation : rot);
    }
    canPlaceAnywhere(tile) {
      for (const cell of openCells(this.board)) {
        for (let rot = 0; rot < 4; rot++) {
          if (canPlace(this.board, cell.x, cell.y, rotateEdges(tile.edges, rot))) return true;
        }
      }
      return false;
    }
    pull() {
      this.current = null;
      this.rotation = 0;
      this.pendingDiscard = false;
      while (this.deck.length) {
        const tile = this.deck.pop();
        if (this.canPlaceAnywhere(tile)) {
          this.current = tile;
          return false;
        }
        this.current = tile;
        this.pendingDiscard = true;
        return true;
      }
      this.finishGame();
      return false;
    }
    finishGame() {
      if (this.finalScored) {
        this.finished = true;
        this.rankingOpen = true;
        return;
      }
      this.finished = true;
      this.finalScored = true;
      finalizeScores(this);
    }
    acknowledgeDiscard() {
      if (!this.pendingDiscard || !this.current) return false;
      this.discards.push(this.current);
      this.current = null;
      this.pendingDiscard = false;
      this.pull();
      return true;
    }
    hints() {
      const now = [];
      const later = [];
      if (!this.current || this.finished || this.pendingDiscard) return { now, later };
      for (const cell of openCells(this.board)) {
        const rots = [];
        for (let rot = 0; rot < 4; rot++) {
          if (canPlace(this.board, cell.x, cell.y, rotateEdges(this.current.edges, rot))) rots.push(rot);
        }
        if (!rots.length) continue;
        if (rots.includes(this.rotation)) now.push({ x: cell.x, y: cell.y });
        else later.push({ x: cell.x, y: cell.y, rots });
      }
      now.sort(byPos);
      later.sort(byPos);
      return { now, later };
    }
    rotationCounts() {
      const counts = [0, 0, 0, 0];
      if (!this.current || this.finished || this.pendingDiscard) return counts;
      for (const cell of openCells(this.board)) {
        for (let rot = 0; rot < 4; rot++) {
          if (canPlace(this.board, cell.x, cell.y, rotateEdges(this.current.edges, rot))) counts[rot] += 1;
        }
      }
      return counts;
    }
    bounds(pad) {
      const margin = pad == null ? 1 : pad;
      let minX = 0;
      let maxX = 0;
      let minY = 0;
      let maxY = 0;
      for (const key of this.board.keys()) {
        const [x, y] = key.split(",").map(Number);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      return {
        minX: minX - margin,
        maxX: maxX + margin,
        minY: minY - margin,
        maxY: maxY + margin
      };
    }
    rotate(delta) {
      if (this.finished || this.pendingMeeple || this.pendingDiscard || !this.current) return;
      this.rotation = (this.rotation + delta % 4 + 4) % 4;
    }
    setRotation(rot) {
      if (this.finished || this.pendingMeeple || this.pendingDiscard || !this.current) return;
      this.rotation = (rot % 4 + 4) % 4;
    }
    place(x, y) {
      if (this.finished || this.pendingMeeple || this.pendingDiscard || !this.current) return false;
      const edges = rotateEdges(this.current.edges, this.rotation);
      if (!canPlace(this.board, x, y, edges)) return false;
      const key = keyOf(x, y);
      const owner = this.players[this.player].id;
      this.board.set(key, clonePlaced(this.current, this.rotation, owner));
      const prevLastPlaced = this.lastPlacedBy[owner];
      this.lastPlacedBy[owner] = key;
      this.current = null;
      this.pendingMeeple = {
        x,
        y,
        player: this.player,
        prevLastPlaced
      };
      return true;
    }
    meepleSlots() {
      if (!this.pendingMeeple) return [];
      if (this.meeples[this.pendingMeeple.player] <= 0) return [];
      const x = this.pendingMeeple.x;
      const y = this.pendingMeeple.y;
      const tile = this.board.get(keyOf(x, y));
      if (!tile) return [];
      return listMeepleSlots(tile).filter((slot) => isMeepleSlotOpen(this.board, x, y, slot));
    }
    placeMeeple(slotId) {
      if (!this.pendingMeeple) return false;
      const player = this.pendingMeeple.player;
      if (this.meeples[player] <= 0) return false;
      const x = this.pendingMeeple.x;
      const y = this.pendingMeeple.y;
      const key = keyOf(x, y);
      const tile = this.board.get(key);
      if (!tile) return false;
      const slot = listMeepleSlots(tile).find((item) => item.id === slotId);
      if (!slot || !isMeepleSlotOpen(this.board, x, y, slot)) return false;
      tile.meeple = {
        player,
        color: this.players[player].id,
        slot: slot.id,
        kind: slot.kind,
        index: slot.index == null ? null : slot.index,
        x: slot.x,
        y: slot.y
      };
      this.meeples[player] -= 1;
      this.finishMeeplePhase();
      return true;
    }
    skipMeeple() {
      if (!this.pendingMeeple) return false;
      this.finishMeeplePhase();
      return true;
    }
    undoPlace() {
      if (!this.pendingMeeple) return false;
      const pending = this.pendingMeeple;
      const key = keyOf(pending.x, pending.y);
      const tile = this.board.get(key);
      if (!tile) return false;
      this.board.delete(key);
      this.current = makeTile(tile.id, tile.start);
      this.rotation = tile.rot;
      this.player = pending.player;
      this.lastPlacedBy[this.players[pending.player].id] = pending.prevLastPlaced;
      this.pendingMeeple = null;
      this.finished = false;
      return true;
    }
    finishMeeplePhase() {
      if (!this.pendingMeeple) return;
      const x = this.pendingMeeple.x;
      const y = this.pendingMeeple.y;
      this.pendingMeeple = null;
      resolveCompletions(this, x, y);
      this.player = (this.player + 1) % this.players.length;
      this.pull();
    }
  };
  function createGame(random, players) {
    const roll = random || Math.random;
    const tiles = buildTiles();
    const start = tiles.find((tile) => tile.start);
    const deck = shuffle(tiles.filter((tile) => !tile.start), roll);
    const game = new Game(deck, players);
    game.board.set("0,0", clonePlaced(start, 0));
    game.player = Math.floor(roll() * game.players.length);
    game.pull();
    return game;
  }
  function simulateToLastTile(random) {
    const game = createGame(random);
    let guard = 0;
    while (!game.finished && ++guard < 120) {
      while (game.pendingDiscard) {
        if (!game.acknowledgeDiscard()) break;
      }
      if (game.finished || !game.current) break;
      if (game.deck.length === 0) return game;
      for (let i = 0; i < 4 && game.hints().now.length === 0; i++) game.rotate(1);
      const cell = game.hints().now[0];
      if (!cell) break;
      if (!game.place(cell.x, cell.y)) break;
      const slots = game.meepleSlots();
      if (slots.length) game.placeMeeple(slots[0].id);
      else if (!game.skipMeeple()) break;
    }
    return game;
  }

  // js/game/persist.js
  var SAVE_VERSION = 1;
  function snapshotLooseTile(tile) {
    if (!tile) return null;
    return { id: tile.id, start: !!tile.start };
  }
  function snapshotPlacedTile(tile) {
    if (!tile) return null;
    return {
      id: tile.id,
      start: !!tile.start,
      rot: tile.rot || 0,
      owner: tile.owner || null,
      meeple: tile.meeple ? Object.assign({}, tile.meeple) : null
    };
  }
  function revivePlacedTile(data) {
    const tile = clonePlaced(makeTile(data.id, data.start), data.rot || 0, data.owner || null);
    tile.meeple = data.meeple ? Object.assign({}, data.meeple) : null;
    return tile;
  }
  function serializeGame(game) {
    return {
      v: SAVE_VERSION,
      players: game.players.map((player) => ({ id: player.id, name: player.name })),
      deck: game.deck.map(snapshotLooseTile),
      discards: game.discards.map(snapshotLooseTile),
      board: Array.from(game.board.entries()).map(([key, tile]) => [key, snapshotPlacedTile(tile)]),
      player: game.player,
      current: snapshotLooseTile(game.current),
      rotation: game.rotation,
      finished: !!game.finished,
      scores: game.scores.slice(),
      meeples: game.meeples.slice(),
      lastPlacedBy: Object.assign({}, game.lastPlacedBy),
      pendingMeeple: game.pendingMeeple ? Object.assign({}, game.pendingMeeple) : null,
      pendingDiscard: !!game.pendingDiscard,
      standings: game.standings.slice(),
      finalScored: !!game.finalScored,
      rankingOpen: !!game.rankingOpen
    };
  }
  function restoreGame(data) {
    if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.board)) return null;
    const players = normalizePlayers(data.players);
    if (!players || players.length < PLAYERS_MIN) return null;
    const game = new Game((data.deck || []).map((tile) => makeTile(tile.id, tile.start)), players);
    game.board = /* @__PURE__ */ new Map();
    for (const entry of data.board) {
      if (!entry || entry.length < 2 || !entry[1]) continue;
      game.board.set(entry[0], revivePlacedTile(entry[1]));
    }
    if (!game.board.size) return null;
    game.discards = (data.discards || []).map((tile) => makeTile(tile.id, tile.start));
    game.player = (data.player % players.length + players.length) % players.length;
    game.current = data.current ? makeTile(data.current.id, data.current.start) : null;
    game.rotation = (data.rotation % 4 + 4) % 4;
    game.finished = !!data.finished;
    game.scores = players.map((_, index) => Number(data.scores && data.scores[index]) || 0);
    game.meeples = players.map((_, index) => {
      const value = data.meeples && data.meeples[index];
      return value == null ? MEEPLES_EACH : Number(value);
    });
    game.lastPlacedBy = Object.assign(
      Object.fromEntries(players.map((player) => [player.id, null])),
      data.lastPlacedBy || {}
    );
    game.pendingMeeple = data.pendingMeeple ? Object.assign({}, data.pendingMeeple) : null;
    game.pendingDiscard = !!data.pendingDiscard;
    game.standings = Array.isArray(data.standings) ? data.standings.slice() : players.map((_, index) => index);
    game.finalScored = !!data.finalScored;
    game.rankingOpen = !!data.rankingOpen;
    return game;
  }

  // js/game/index.js
  var Carcassonne = {
    PLAYERS,
    COLOR_PALETTE,
    PLAYERS_MIN,
    PLAYERS_MAX,
    NAME_MAX,
    MEEPLES_EACH,
    TYPES,
    MARKUP,
    EDGE_NAME,
    DIR_NAME,
    buildTiles,
    makeTile,
    rotateEdges,
    canPlace,
    openCells,
    boardErrors,
    edgeText,
    tileHTML,
    listMeepleSlots,
    MEEPLE_LAYOUTS,
    FIELD_PORTS,
    collectRoadComponent,
    collectCityComponent,
    collectFieldComponent,
    monasteryComplete,
    isMeepleSlotOpen,
    resolveCompletions,
    finalizeScores,
    rankPlayers,
    normalizePlayers,
    cityPoints,
    roadPoints,
    completedCitiesTouchingField,
    FIELD_CITY_TOUCH,
    createGame,
    serializeGame,
    restoreGame,
    SAVE_VERSION,
    simulateToLastTile
  };
  var index_default = Carcassonne;
  return __toCommonJS(index_exports);
})();
