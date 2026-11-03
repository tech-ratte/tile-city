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
    BOT_NAMES: () => BOT_NAMES,
    BOT_STRENGTHS: () => BOT_STRENGTHS,
    BOT_STRENGTH_IDS: () => BOT_STRENGTH_IDS,
    BOT_WEIGHTS: () => BOT_WEIGHTS,
    COLOR_PALETTE: () => COLOR_PALETTE,
    DEFAULT_GAME_OPTIONS: () => DEFAULT_GAME_OPTIONS,
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
    botNameForColor: () => botNameForColor,
    buildFeatureClaims: () => buildFeatureClaims,
    buildTiles: () => buildTiles,
    canPlace: () => canPlace,
    chooseBotAction: () => chooseBotAction,
    cityPoints: () => cityPoints,
    claimColorEnabled: () => claimColorEnabled,
    cloneGame: () => cloneGame,
    collectCityComponent: () => collectCityComponent,
    collectFieldComponent: () => collectFieldComponent,
    collectRoadComponent: () => collectRoadComponent,
    completedCitiesTouchingField: () => completedCitiesTouchingField,
    createGame: () => createGame,
    deckPhase: () => deckPhase,
    default: () => index_default,
    defaultPlayerName: () => defaultPlayerName,
    edgeText: () => edgeText,
    featColorOptionKey: () => featColorOptionKey,
    finalizeScores: () => finalizeScores,
    isBotPlayer: () => isBotPlayer,
    isMeepleSlotOpen: () => isMeepleSlotOpen,
    listMeepleSlots: () => listMeepleSlots,
    makeTile: () => makeTile,
    monasteryComplete: () => monasteryComplete,
    monasteryHTML: () => monasteryHTML,
    nextPlayerName: () => nextPlayerName,
    normalizeBotStrength: () => normalizeBotStrength,
    normalizeGameOptions: () => normalizeGameOptions,
    normalizePlayers: () => normalizePlayers,
    openCells: () => openCells,
    rankPlayers: () => rankPlayers,
    resolveCompletions: () => resolveCompletions,
    restoreGame: () => restoreGame,
    roadPoints: () => roadPoints,
    rotateEdges: () => rotateEdges,
    scoreFeature: () => scoreFeature,
    serializeGame: () => serializeGame,
    simulateToLastTile: () => simulateToLastTile,
    stampFeatureClaim: () => stampFeatureClaim,
    stampFeatureClaimsFromMap: () => stampFeatureClaimsFromMap,
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
  var BOT_NAMES = {
    red: { en: "Rex", ja: "\u30EC\u30C3\u30AF\u30B9" },
    // hot-blooded warrior, boy ~17
    blue: { en: "Cain", ja: "\u30AB\u30A4\u30F3" },
    // cold sage, boy ~18
    green: { en: "Rock", ja: "\u30ED\u30C3\u30AF" },
    // young thief, boy ~11
    yellow: { en: "Luna", ja: "\u30EB\u30CA" },
    // mischievous princess, girl ~10
    orange: { en: "Asuka", ja: "\u30A2\u30B9\u30AB" },
    // energetic fighter, girl ~17
    purple: { en: "Mora", ja: "\u30E2\u30FC\u30E9" },
    // necromancer, woman ~80
    white: { en: "Cecil", ja: "\u30BB\u30B7\u30EB" },
    // apprentice cleric, girl ~15
    brown: { en: "Eliza", ja: "\u30A8\u30EA\u30B6" }
    // haughty mage, woman ~23
  };
  function defaultPlayerName(index) {
    return "Player" + (Number(index) + 1);
  }
  function nextPlayerName(list) {
    let max = 0;
    for (const player of list || []) {
      const match = String(player && player.name != null ? player.name : "").match(/^Player(\d+)$/i);
      if (!match) continue;
      const n = Number(match[1]);
      if (n > max) max = n;
    }
    return "Player" + (max + 1);
  }
  function botNameForColor(id, lang) {
    const entry = BOT_NAMES[id];
    if (entry) {
      if (typeof entry === "string") return entry;
      return lang === "en" ? entry.en : entry.ja;
    }
    const color = COLOR_PALETTE.find((item) => item.id === id);
    return color ? color.label : "Bot";
  }
  var PLAYERS = COLOR_PALETTE.slice(0, 4).map((color, index) => ({
    id: color.id,
    name: defaultPlayerName(index)
  }));
  var MEEPLES_EACH = 7;
  var PLAYERS_MIN = 2;
  var PLAYERS_MAX = 8;
  var NAME_MAX = 10;
  var BOT_STRENGTHS = [
    { id: "standard", label: "Standard" }
  ];
  var BOT_STRENGTH_IDS = BOT_STRENGTHS.map((item) => item.id);
  function normalizeBotStrength(value, isBot) {
    if (!isBot) return null;
    if (typeof value === "string" && BOT_STRENGTH_IDS.includes(value)) return value;
    return "standard";
  }
  function normalizePlayerRecord(item) {
    const known = new Set(COLOR_PALETTE.map((color) => color.id));
    const id = item && known.has(item.id) ? item.id : null;
    if (!id) return null;
    const bot = !!(item && item.bot);
    const raw = item.name == null ? "" : String(item.name);
    const name = bot ? botNameForColor(id) : raw.trim().slice(0, NAME_MAX) || COLOR_PALETTE.find((c) => c.id === id).label;
    return {
      id,
      name,
      bot,
      botStrength: normalizeBotStrength(item && item.botStrength, bot)
    };
  }
  function defaultPlayerList() {
    return PLAYERS.map((player) => ({
      id: player.id,
      name: player.name,
      bot: false,
      botStrength: null
    }));
  }
  function normalizePlayers(list) {
    if (!Array.isArray(list) || !list.length) {
      return defaultPlayerList();
    }
    const used = /* @__PURE__ */ new Set();
    const out = [];
    for (const item of list) {
      if (out.length >= PLAYERS_MAX) break;
      const player = normalizePlayerRecord(item);
      if (!player || used.has(player.id)) continue;
      used.add(player.id);
      out.push(player);
    }
    if (out.length < PLAYERS_MIN) {
      return defaultPlayerList();
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
  function pillars(...corners) {
    return corners.map((c) => `<i class="city-pillar ${c}"></i>`).join("");
  }
  function city(cls, inner = "", feat = "city-0") {
    return `<i class="city ${cls}" data-feat="${feat}">${inner}</i>`;
  }
  function gatePillarHTML(side) {
    return '<span class="gate-pillar ' + side + '"><span class="roof"></span><span class="win"></span></span>';
  }
  function cityTowerHTML() {
    return '<span class="city-keep" title="\u5854">' + gatePillarHTML("left") + '<span class="city-tower"><span class="roof"></span><span class="win"></span><span class="door"></span></span>' + gatePillarHTML("right") + "</span>";
  }
  function road(cls, feat) {
    return `<i class="road ${cls}" data-feat="${feat}"></i>`;
  }
  function bend(cls, feat) {
    return `<i class="bend ${cls}" data-feat="${feat}"></i>`;
  }
  function monasteryHTML(withFeat = true) {
    const feat = withFeat ? ' data-feat="monastery"' : "";
    return '<span class="monastery"' + feat + '><span class="wing left"><span class="win"></span></span><span class="wing right"><span class="win"></span></span><span class="cross"></span><span class="roof"></span><span class="body"><span class="win"></span><span class="win"></span></span></span>';
  }
  var MARKUP = {
    A: road("to-s", "road-0") + monasteryHTML(true),
    B: monasteryHTML(true),
    /* Fill has no field wall — pillars only (all edges connect); keep in the center. */
    C: city("fill", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + '<i class="pennant p-c" title="\u65D7"></i>',
    D: city("cap n shallow", pillars("nw", "ne")) + road("h", "road-0"),
    E: city("cap n", pillars("nw", "ne")),
    F: city("bar h", pillars("nw", "ne", "sw", "se")) + '<i class="pennant p-bar" title="\u65D7"></i>',
    G: city("bar h", pillars("nw", "ne", "sw", "se")),
    H: city("cap n", pillars("nw", "ne"), "city-0") + city("cap s", pillars("sw", "se"), "city-1"),
    I: city("cap n gap-w", pillars("nw", "ne"), "city-0") + city("cap w gap-n", pillars("nw", "sw"), "city-1"),
    J: city("cap n", pillars("nw", "ne")) + bend("se edge", "road-0") + bend("se line", "road-0"),
    K: city("cap n", pillars("nw", "ne")) + bend("sw edge", "road-0") + bend("sw line", "road-0"),
    L: city("cap n shallow", pillars("nw", "ne")) + road("h-e", "road-0") + road("h-w", "road-2") + road("v-s", "road-1") + '<i class="village"></i>',
    M: city("elbow ne", pillars("nw", "ne", "se")) + '<i class="pennant p-ne" title="\u65D7"></i>',
    N: city("elbow ne", pillars("nw", "ne", "se")),
    O: city("elbow nw", pillars("nw", "ne", "sw")) + bend("se edge", "road-0") + bend("se line", "road-0") + '<i class="pennant p-nw" title="\u65D7"></i>',
    P: city("elbow nw", pillars("nw", "ne", "sw")) + bend("se edge", "road-0") + bend("se line", "road-0"),
    /* Mouth city — keep sits in the city mass (above the south notch / gate). */
    Q: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + '<i class="pennant p-u" title="\u65D7"></i>',
    R: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()),
    S: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + road("gate", "road-0") + '<i class="pennant p-u" title="\u65D7"></i>',
    T: city("mouth s", pillars("nw", "ne", "sw", "se") + cityTowerHTML()) + road("gate", "road-0"),
    U: road("v", "road-0"),
    V: bend("sw edge", "road-0") + bend("sw line", "road-0"),
    W: road("h-e", "road-0") + road("h-w", "road-2") + road("v-s", "road-1") + '<i class="village"></i>',
    X: road("v-n", "road-0") + road("h-e", "road-1") + road("v-s", "road-2") + road("h-w", "road-3") + '<i class="village"></i>'
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
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.14 },
      { id: "road-0", kind: "road", index: 0, x: 0.5, y: 0.5 },
      // Gap under the city tip joins left/right above the road into one field.
      { id: "field-0", kind: "field", index: 0, x: 0.2, y: 0.36 },
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
      { id: "city-0", kind: "city", index: 0, x: 0.5, y: 0.14 },
      { id: "road-0", kind: "road", index: 0, x: 0.78, y: 0.5 },
      { id: "road-1", kind: "road", index: 1, x: 0.5, y: 0.78 },
      { id: "road-2", kind: "road", index: 2, x: 0.22, y: 0.5 },
      { id: "field-0", kind: "field", index: 0, x: 0.86, y: 0.86 },
      { id: "field-1", kind: "field", index: 1, x: 0.14, y: 0.86 },
      // Northern strip field: outer NE pocket (top corners are city).
      { id: "field-2", kind: "field", index: 2, x: 0.86, y: 0.14 }
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
    return cities.map((city2) => ({ edges: city2.edges.slice(), pennant: !!city2.pennant }));
  }
  function copyRoads(roads) {
    return roads.map((road2) => road2.slice());
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
    const meeple = tile.meeple;
    game.meeples[meeple.player] += 1;
    tile.leaveFx = {
      color: meeple.color,
      kind: meeple.kind,
      x: meeple.x,
      y: meeple.y,
      earned: meeple.earned || 0,
      earnedDim: !!meeple.earnedDim,
      at: Date.now()
    };
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
    const marked = [];
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile || !tile.meeple) continue;
      if (tile.meeple.kind !== kind) continue;
      if (kind !== "monastery" && tile.meeple.index !== part.index) continue;
      if (!win.has(tile.meeple.player)) continue;
      marked.push(tile.meeple);
    }
    if (!marked.length) return;
    const leadByPlayer = /* @__PURE__ */ new Set();
    for (const meeple of marked) {
      if (!leadByPlayer.has(meeple.player)) {
        leadByPlayer.add(meeple.player);
        meeple.earned = (meeple.earned || 0) + points;
        meeple.earnedDim = false;
      } else {
        meeple.earned = (meeple.earned || 0) + points;
        meeple.earnedDim = true;
      }
    }
  }
  function featClaimId(kind, index) {
    return kind === "monastery" ? "monastery" : kind + "-" + index;
  }
  function claimMapKey(part, kind) {
    return part.x + "," + part.y + ":" + featClaimId(kind, part.index);
  }
  function stampFeatureClaim(board, kind, parts, claim) {
    if (!claim || !claim.colors || !claim.colors.length || !parts.length) return;
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile) continue;
      if (!tile.featureClaims) tile.featureClaims = {};
      const stored = {
        colors: claim.colors.slice(),
        tie: !!claim.tie
      };
      if (claim.mode) stored.mode = claim.mode;
      if (claim.angle != null) stored.angle = claim.angle;
      if (claim.sideAngle != null) stored.sideAngle = claim.sideAngle;
      if (claim.dir) stored.dir = claim.dir;
      if (claim.boardDir) stored.boardDir = claim.boardDir;
      if (claim.face) stored.face = claim.face;
      if (claim.hubOther) stored.hubOther = true;
      if (claim.bridges && claim.bridges.length) {
        stored.bridges = claim.bridges.map((bridge) => ({
          dir: bridge.dir,
          color: bridge.color
        }));
      }
      if (claim.sectors && claim.sectors.length) {
        stored.sectors = claim.sectors.map((sector) => ({
          color: sector.color,
          angle: sector.angle
        }));
      }
      tile.featureClaims[featClaimId(kind, part.index)] = stored;
    }
  }
  function stampFeatureClaimsFromMap(board, kind, parts, claims) {
    for (const part of parts) {
      const claim = claims.get(claimMapKey(part, kind));
      if (!claim) continue;
      stampFeatureClaim(board, kind, [part], claim);
    }
  }
  function scoreFeature(game, kind, parts, points, options) {
    const opts = options || {};
    const winners = majorityPlayers(
      meepleCountsOnFeature(game.board, kind, parts, game.players.length)
    );
    if (winners.length) {
      const live = buildFeatureClaims(game);
      stampFeatureClaimsFromMap(game.board, kind, parts, live);
    }
    if (winners.length && points > 0) {
      awardPoints(game, winners, points);
      labelMeepleEarnings(game.board, kind, parts, winners, points);
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
        const city2 = collectCityComponent(board, part.x, part.y, cityIndex);
        if (!city2.complete) continue;
        const id = componentId(city2.parts);
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
  function partId(part) {
    return part.x + "," + part.y + "," + part.index;
  }
  function featureAdjacency(board, kind, parts) {
    const set = new Set(parts.map(partId));
    const adj = /* @__PURE__ */ new Map();
    for (const part of parts) adj.set(partId(part), []);
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile) continue;
      const rot = tile.rot || 0;
      const edges = kind === "city" ? tile.cities && tile.cities[part.index] && tile.cities[part.index].edges || [] : tile.roads && tile.roads[part.index] || [];
      for (const catalogDir of edges) {
        const dir = absDir(catalogDir, rot);
        const step = NEI[DIR_INDEX[dir]];
        const nx = part.x + step.dx;
        const ny = part.y + step.dy;
        const neighbor = board.get(keyOf(nx, ny));
        if (!neighbor) continue;
        const nextIndex = kind === "city" ? findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]) : findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]);
        if (nextIndex < 0) continue;
        const next = { x: nx, y: ny, index: nextIndex };
        const nid = partId(next);
        if (!set.has(nid)) continue;
        adj.get(partId(part)).push(next);
      }
    }
    return adj;
  }
  function blendAngle(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (!dx && !dy) return 135;
    return Math.atan2(dx, -dy) * 180 / Math.PI;
  }
  function polesFromEdges(edges, seeds, part) {
    const byColor = /* @__PURE__ */ new Map();
    for (const edge of edges) {
      if (!edge.color) continue;
      if (!byColor.has(edge.color)) byColor.set(edge.color, []);
      byColor.get(edge.color).push(edge);
    }
    const poles = /* @__PURE__ */ new Map();
    for (const [color, list] of byColor.entries()) {
      let best = list[0];
      if (list.length > 1 && seeds && part) {
        const seed = seeds.get(color);
        const sx = seed ? seed.x - part.x : best.dx;
        const sy = seed ? seed.y - part.y : best.dy;
        let bestScore = -Infinity;
        for (const edge of list) {
          const score = edge.dx * sx + edge.dy * sy;
          if (score > bestScore) {
            bestScore = score;
            best = edge;
          }
        }
      }
      poles.set(color, { x: best.dx, y: best.dy, n: 1 });
    }
    return poles;
  }
  function localClaimAngle(boardAngle, tileRot) {
    const rot = ((tileRot || 0) % 4 + 4) % 4;
    return Math.round((boardAngle - rot * 90) * 10) / 10;
  }
  function normDeg(deg) {
    return (deg % 360 + 360) % 360;
  }
  function poleForColor(color, poles, seeds, part) {
    let pole = poles.get(color);
    if (pole && (pole.x || pole.y)) return pole;
    const seed = seeds.get(color);
    if (seed) return { x: seed.x - part.x, y: seed.y - part.y, n: 1 };
    return null;
  }
  function partEdgeDirs(board, kind, part) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile) return [];
    const rot = tile.rot || 0;
    const catalog = kind === "city" ? tile.cities && tile.cities[part.index] && tile.cities[part.index].edges || [] : tile.roads && tile.roads[part.index] || [];
    return catalog.map((dir) => absDir(dir, rot));
  }
  function dirVec(dir) {
    const step = NEI[DIR_INDEX[dir]];
    return { x: step.dx, y: step.dy };
  }
  function scoreColorForDir(color, dir, poles, seeds, part) {
    const want = dirVec(dir);
    let vec = null;
    const pole = poles.get(color);
    if (pole && (pole.x || pole.y)) vec = pole;
    else {
      const seed = seeds.get(color);
      if (seed) vec = { x: seed.x - part.x, y: seed.y - part.y };
    }
    if (!vec) return -Infinity;
    return vec.x * want.x + vec.y * want.y;
  }
  function pickBlendPalette(nearest, edges, seeds, part, edgeDirs) {
    if (nearest.length <= 1) return nearest.slice();
    const poles = polesFromEdges(edges, seeds, part);
    let maxCols = edgeDirs.length <= 1 ? Math.min(2, nearest.length) : Math.min(edgeDirs.length, nearest.length);
    if (edgeDirs.length === 2 && nearest.length >= 3) {
      maxCols = Math.min(3, nearest.length);
    }
    if (nearest.length <= maxCols) return nearest.slice();
    const dirs = edgeDirs.length ? edgeDirs : ["N", "E"];
    const picked = [];
    const used = /* @__PURE__ */ new Set();
    for (const dir of dirs) {
      if (picked.length >= maxCols) break;
      const want = dirVec(dir);
      let best = null;
      let bestScore = -Infinity;
      for (const color of nearest) {
        if (used.has(color)) continue;
        let score = scoreColorForDir(color, dir, poles, seeds, part);
        for (const edge of edges) {
          if (edge.color === color && edge.dx === want.x && edge.dy === want.y) {
            score += 10;
          }
        }
        if (score > bestScore) {
          bestScore = score;
          best = color;
        }
      }
      if (best == null) continue;
      picked.push(best);
      used.add(best);
    }
    for (const color of nearest) {
      if (picked.length >= maxCols) break;
      if (used.has(color)) continue;
      picked.push(color);
      used.add(color);
    }
    return picked.sort();
  }
  function blendFromSeeds(colorA, colorB, seeds, part, tileRot) {
    const seedA = seeds.get(colorA) || { x: part.x, y: part.y };
    const seedB = seeds.get(colorB) || { x: part.x + 1, y: part.y };
    const boardAngle = blendAngle(seedA, seedB);
    const local = localClaimAngle(boardAngle, tileRot);
    const ortho = seedA.x === seedB.x || seedA.y === seedB.y;
    const secA = normDeg(local + 180);
    const secB = ortho ? normDeg(local) : normDeg(local + 90);
    return {
      colors: [colorA, colorB],
      tie: true,
      mode: "full",
      angle: local,
      sectors: [
        { color: colorA, angle: secA },
        { color: colorB, angle: secB }
      ]
    };
  }
  function poleForPaletteColor(color, edges, seeds, part, edgeDirs) {
    const poles = polesFromEdges(edges, seeds, part);
    const solid = poles.get(color);
    if (solid && (solid.x || solid.y)) return solid;
    let bestDir = null;
    let bestScore = -Infinity;
    for (const dir of edgeDirs || []) {
      const score = scoreColorForDir(color, dir, poles, seeds, part);
      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }
    if (bestDir && bestScore > -Infinity) {
      const vec = dirVec(bestDir);
      return { x: vec.x, y: vec.y, n: 1 };
    }
    return poleForColor(color, poles, seeds, part);
  }
  function isElbowDirs(edgeDirs) {
    if (!edgeDirs || edgeDirs.length !== 2) return false;
    const i0 = DIR_INDEX[edgeDirs[0]];
    const i1 = DIR_INDEX[edgeDirs[1]];
    if (i0 == null || i1 == null) return false;
    const diff = Math.abs(i0 - i1) % 4;
    return diff === 1 || diff === 3;
  }
  function blendCornerInherit(palette, edges, seeds, part, tileRot, edgeDirs, kind) {
    if (kind && kind !== "city") return null;
    if (!isElbowDirs(edgeDirs)) return null;
    const blendEdges = edges.filter(
      (edge) => edge.blend && edge.colors && edge.colors.length === 2
    );
    const solidEdges = edges.filter((edge) => edge.color);
    const inherited = blendEdges.find(
      (edge) => edge.colors.every((color) => palette.indexOf(color) >= 0)
    );
    if (!inherited || !solidEdges.length) return null;
    const side = solidEdges.find((edge) => inherited.colors.indexOf(edge.color) < 0);
    if (!side) return null;
    const seedA = seeds.get(inherited.colors[0]) || {
      x: part.x + inherited.dx,
      y: part.y + inherited.dy
    };
    const seedB = seeds.get(inherited.colors[1]) || {
      x: part.x - inherited.dx,
      y: part.y - inherited.dy
    };
    const boardAngle = blendAngle(seedA, seedB);
    const colorA = inherited.colors[0];
    const colorB = inherited.colors[1];
    const sideBoard = blendAngle({ x: 0, y: 0 }, { x: side.dx, y: side.dy });
    return {
      colors: [colorA, colorB, side.color],
      tie: true,
      mode: "corner",
      angle: localClaimAngle(boardAngle, tileRot),
      sideAngle: localClaimAngle(sideBoard, tileRot),
      sectors: [
        {
          color: colorA,
          angle: normDeg(localClaimAngle(boardAngle, tileRot) + 180)
        },
        {
          color: colorB,
          angle: normDeg(localClaimAngle(boardAngle, tileRot))
        },
        {
          color: side.color,
          angle: normDeg(localClaimAngle(sideBoard, tileRot))
        }
      ]
    };
  }
  function blendFan(nearest, edges, seeds, part, tileRot, edgeDirs, kind) {
    const dirs = edgeDirs || [];
    const edgeColors = [];
    for (const edge of edges) {
      if (edge.color && edgeColors.indexOf(edge.color) < 0) edgeColors.push(edge.color);
      if (edge.colors) {
        for (const color of edge.colors) {
          if (edgeColors.indexOf(color) < 0) edgeColors.push(color);
        }
      }
    }
    const expanded = nearest.slice();
    for (const color of edgeColors) {
      if (expanded.indexOf(color) < 0) expanded.push(color);
    }
    expanded.sort();
    const palette = pickBlendPalette(expanded, edges, seeds, part, dirs);
    const poles = polesFromEdges(edges, seeds, part);
    const cornerEarly = blendCornerInherit(palette, edges, seeds, part, tileRot, dirs, kind);
    if (cornerEarly) return cornerEarly;
    if (palette.length === 2) {
      const colorA = palette[0];
      const colorB = palette[1];
      const edgeA = poles.get(colorA);
      const edgeB = poles.get(colorB);
      const solidA = edgeA && (edgeA.x || edgeA.y);
      const solidB = edgeB && (edgeB.x || edgeB.y);
      if (!solidA || !solidB) {
        if (dirs.length >= 2) {
          const poleA = poleForPaletteColor(colorA, edges, seeds, part, dirs);
          const poleB = poleForPaletteColor(colorB, edges, seeds, part, dirs);
          if (poleA && poleB && (poleA.x || poleA.y) && (poleB.x || poleB.y)) {
            const sectors3 = [
              {
                color: colorA,
                angle: normDeg(localClaimAngle(blendAngle({ x: 0, y: 0 }, poleA), tileRot)),
                pole: poleA
              },
              {
                color: colorB,
                angle: normDeg(localClaimAngle(blendAngle({ x: 0, y: 0 }, poleB), tileRot)),
                pole: poleB
              }
            ].sort((a, b) => a.angle - b.angle);
            const boardAngle2 = blendAngle(sectors3[0].pole, sectors3[1].pole);
            return {
              colors: [sectors3[0].color, sectors3[1].color],
              tie: true,
              mode: "full",
              angle: localClaimAngle(boardAngle2, tileRot),
              sectors: sectors3.map((sector) => ({
                color: sector.color,
                angle: sector.angle
              }))
            };
          }
        }
        return blendFromSeeds(colorA, colorB, seeds, part, tileRot);
      }
      const boardA = blendAngle({ x: 0, y: 0 }, edgeA);
      const boardB = blendAngle({ x: 0, y: 0 }, edgeB);
      const sectors2 = [
        {
          color: colorA,
          angle: normDeg(localClaimAngle(boardA, tileRot)),
          pole: edgeA
        },
        {
          color: colorB,
          angle: normDeg(localClaimAngle(boardB, tileRot)),
          pole: edgeB
        }
      ].sort((a, b) => a.angle - b.angle);
      const boardAngle = blendAngle(sectors2[0].pole, sectors2[1].pole);
      return {
        colors: [sectors2[0].color, sectors2[1].color],
        tie: true,
        mode: "full",
        angle: localClaimAngle(boardAngle, tileRot),
        sectors: sectors2.map((sector) => ({ color: sector.color, angle: sector.angle }))
      };
    }
    const sectors = [];
    for (const color of palette) {
      const edgePole = poles.get(color);
      const pole = edgePole && (edgePole.x || edgePole.y) ? edgePole : poleForColor(color, poles, seeds, part);
      if (!pole || !pole.x && !pole.y) continue;
      const boardAngle = blendAngle({ x: 0, y: 0 }, pole);
      sectors.push({
        color,
        angle: normDeg(localClaimAngle(boardAngle, tileRot)),
        pole
      });
    }
    sectors.sort((a, b) => a.angle - b.angle);
    const uniq = [];
    for (const sector of sectors) {
      if (uniq.length && Math.abs(normDeg(uniq[uniq.length - 1].angle - sector.angle)) < 1) continue;
      uniq.push(sector);
    }
    if (uniq.length < 2) {
      return blendFromSeeds(palette[0], palette[1] || palette[0], seeds, part, tileRot);
    }
    if (uniq.length === 2) {
      const boardAngle = blendAngle(uniq[0].pole, uniq[1].pole);
      return {
        colors: [uniq[0].color, uniq[1].color],
        tie: true,
        mode: "full",
        angle: localClaimAngle(boardAngle, tileRot),
        sectors: uniq.map((sector) => ({ color: sector.color, angle: sector.angle }))
      };
    }
    return {
      colors: uniq.map((sector) => sector.color),
      tie: true,
      mode: "full",
      angle: 0,
      sectors: uniq.map((sector) => ({ color: sector.color, angle: sector.angle }))
    };
  }
  function blendHalf(colorA, colorB, boardAngle, tileRot, mode) {
    return {
      colors: [colorA, colorB],
      tie: true,
      mode,
      angle: localClaimAngle(boardAngle, tileRot)
    };
  }
  function absDirFromDelta(dx, dy) {
    if (dy < 0) return "N";
    if (dx > 0) return "E";
    if (dy > 0) return "S";
    return "W";
  }
  function localEdgeDir(boardDir, tileRot) {
    const rot = ((tileRot || 0) % 4 + 4) % 4;
    const index = DIR_INDEX[boardDir];
    if (index == null) return boardDir;
    return DIRS[(index - rot + 4) % 4];
  }
  function pickConnectedFace(nearest, part) {
    const list = nearest && nearest.length ? nearest : [];
    if (list.length <= 1) return list[0] || null;
    let h = 2166136261;
    const salt = String(part.x) + "," + String(part.y) + ":" + String(part.index == null ? 0 : part.index);
    for (let i = 0; i < salt.length; i++) {
      h ^= salt.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    for (const color of list) {
      for (let i = 0; i < color.length; i++) {
        h ^= color.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      h ^= 158;
      h = Math.imul(h, 16777619);
    }
    return list[(h >>> 0) % list.length];
  }
  function blendCityHub(edges, nearest, part) {
    const bridges = [];
    const seen = /* @__PURE__ */ new Set();
    for (const edge of edges) {
      if (!edge.color) continue;
      const dir = absDirFromDelta(edge.dx, edge.dy);
      const key = dir + ":" + edge.color;
      if (seen.has(key)) continue;
      seen.add(key);
      bridges.push({ dir, color: edge.color });
    }
    return {
      colors: nearest.slice(),
      tie: true,
      mode: "hub",
      face: pickConnectedFace(nearest, part),
      bridges
    };
  }
  function blendCityBridge(face, other, boardDir, tileRot) {
    return {
      colors: [face, other],
      tie: true,
      mode: "bridge",
      face,
      dir: localEdgeDir(boardDir, tileRot),
      boardDir
    };
  }
  function buildFeatureClaims(game) {
    const claims = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    const board = game.board;
    const players = game.players || [];
    const playerCount = players.length;
    function paint(kind, parts) {
      const counts = meepleCountsOnFeature(board, kind, parts, playerCount);
      const winners = majorityPlayers(counts);
      if (!winners.length) return;
      const winnerSet = new Set(winners);
      const colors = winners.map((index) => players[index].id);
      if (colors.length === 1) {
        for (const part of parts) {
          claims.set(claimMapKey(part, kind), {
            colors: colors.slice(),
            tie: false
          });
        }
        return;
      }
      const adj = featureAdjacency(board, kind, parts);
      const distByColor = /* @__PURE__ */ new Map();
      const seeds = /* @__PURE__ */ new Map();
      const queue = [];
      for (const part of parts) {
        const tile = board.get(keyOf(part.x, part.y));
        if (!tile || !tile.meeple) continue;
        const m = tile.meeple;
        if (m.kind !== kind || m.index !== part.index) continue;
        if (!winnerSet.has(m.player)) continue;
        const color = players[m.player].id;
        if (!seeds.has(color)) seeds.set(color, { x: part.x, y: part.y });
        const id = partId(part);
        if (!distByColor.has(id)) distByColor.set(id, /* @__PURE__ */ new Map());
        const cmap = distByColor.get(id);
        if (cmap.has(color) && cmap.get(color) <= 0) continue;
        cmap.set(color, 0);
        queue.push({ x: part.x, y: part.y, index: part.index, color, d: 0 });
      }
      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        for (const next of adj.get(partId(cur)) || []) {
          const nid = partId(next);
          const nd = cur.d + 1;
          if (!distByColor.has(nid)) distByColor.set(nid, /* @__PURE__ */ new Map());
          const cmap = distByColor.get(nid);
          if (cmap.has(cur.color) && cmap.get(cur.color) <= nd) continue;
          cmap.set(cur.color, nd);
          queue.push({ x: next.x, y: next.y, index: next.index, color: cur.color, d: nd });
        }
      }
      const fallback = colors.slice().sort();
      const owners = /* @__PURE__ */ new Map();
      for (const part of parts) {
        const cmap = distByColor.get(partId(part));
        let nearest = [];
        if (cmap && cmap.size) {
          let minD = Infinity;
          for (const d of cmap.values()) if (d < minD) minD = d;
          for (const [color, d] of cmap.entries()) {
            if (d === minD) nearest.push(color);
          }
          nearest.sort();
        } else {
          nearest = fallback.slice();
        }
        owners.set(partId(part), nearest.length ? nearest : fallback.slice(0, 1));
      }
      function primaryOwner(id) {
        const nearest = owners.get(id) || fallback;
        return nearest.length === 1 ? nearest[0] : null;
      }
      function tileRotAt(part) {
        const tile = board.get(keyOf(part.x, part.y));
        return tile && tile.rot ? tile.rot : 0;
      }
      const minTieDist = /* @__PURE__ */ new Map();
      for (const part of parts) {
        const nearest = owners.get(partId(part));
        if (!nearest || nearest.length < 2) continue;
        const cmap = distByColor.get(partId(part));
        if (!cmap) continue;
        const d = cmap.get(nearest[0]);
        if (d == null) continue;
        const key = nearest.slice().sort().join("|");
        if (!minTieDist.has(key) || d < minTieDist.get(key)) minTieDist.set(key, d);
      }
      const meetingParts = /* @__PURE__ */ new Map();
      for (const part of parts) {
        const nearest = owners.get(partId(part));
        if (!nearest || nearest.length < 2) continue;
        const cmap = distByColor.get(partId(part));
        if (!cmap) continue;
        const d = cmap.get(nearest[0]);
        const key = nearest.slice().sort().join("|");
        if (d == null || d !== minTieDist.get(key)) continue;
        if (!meetingParts.has(key)) meetingParts.set(key, []);
        meetingParts.get(key).push(part);
      }
      for (const [key, meetings] of meetingParts.entries()) {
        if (meetings.length < 2) continue;
        const colors2 = key.split("|");
        if (colors2.length !== 2) continue;
        const kept = [];
        for (const part of meetings) {
          const seedA = seeds.get(colors2[0]);
          const seedB = seeds.get(colors2[1]);
          if (!seedA || !seedB) {
            kept.push(part);
            continue;
          }
          const va = { x: seedA.x - part.x, y: seedA.y - part.y };
          const vb = { x: seedB.x - part.x, y: seedB.y - part.y };
          const la = Math.hypot(va.x, va.y) || 1;
          const lb = Math.hypot(vb.x, vb.y) || 1;
          const dot = (va.x * vb.x + va.y * vb.y) / (la * lb);
          if (dot < 0.2) {
            kept.push(part);
            continue;
          }
          let best = colors2[0];
          let bestScore = -Infinity;
          for (const color of colors2) {
            const seed = seeds.get(color);
            if (!seed) continue;
            const score = -Math.hypot(seed.x - part.x, seed.y - part.y);
            if (score > bestScore) {
              bestScore = score;
              best = color;
            }
          }
          owners.set(partId(part), [best]);
        }
        meetingParts.set(key, kept.length ? kept : meetings.slice(0, 1));
      }
      for (const part of parts) {
        const id = partId(part);
        const nearest = owners.get(id);
        if (!nearest || nearest.length < 2) continue;
        const cmap = distByColor.get(id);
        if (!cmap) continue;
        const d = cmap.get(nearest[0]);
        const key = nearest.slice().sort().join("|");
        if (d == null || !minTieDist.has(key) || d <= minTieDist.get(key)) continue;
        const meetings = meetingParts.get(key) || [];
        if (!meetings.length) continue;
        let meet = meetings[0];
        let meetDist = Infinity;
        for (const m of meetings) {
          const md = Math.hypot(m.x - part.x, m.y - part.y);
          if (md < meetDist) {
            meetDist = md;
            meet = m;
          }
        }
        const vx = part.x - meet.x;
        const vy = part.y - meet.y;
        const dots = [];
        for (const color of nearest) {
          const seed = seeds.get(color);
          if (!seed) continue;
          dots.push((seed.x - meet.x) * vx + (seed.y - meet.y) * vy);
        }
        if (!dots.length) continue;
        const maxDot = Math.max.apply(null, dots);
        const minDot = Math.min.apply(null, dots);
        if (!(maxDot < 0.25 && minDot < -0.25)) continue;
        let best = nearest[0];
        let bestScore = -Infinity;
        for (const color of nearest) {
          const seed = seeds.get(color);
          if (!seed) continue;
          const score = -Math.hypot(seed.x - part.x, seed.y - part.y);
          if (score > bestScore) {
            bestScore = score;
            best = color;
          }
        }
        owners.set(id, [best]);
      }
      function edgeSamples(part) {
        const id = partId(part);
        const edges = [];
        for (const next of adj.get(id) || []) {
          const nearest = owners.get(partId(next)) || [];
          const dx = next.x - part.x;
          const dy = next.y - part.y;
          if (nearest.length === 1) {
            edges.push({ color: nearest[0], dx, dy });
            continue;
          }
          if (nearest.length === 2) {
            edges.push({ colors: nearest.slice(), dx, dy, blend: true });
          }
        }
        return edges;
      }
      for (const part of parts) {
        const id = partId(part);
        const nearest = owners.get(id);
        const key = claimMapKey(part, kind);
        if (nearest.length >= 2) {
          if (kind === "city") {
            claims.set(key, blendCityHub(edgeSamples(part), nearest, part));
          } else {
            claims.set(
              key,
              blendFan(
                nearest,
                edgeSamples(part),
                seeds,
                part,
                tileRotAt(part),
                partEdgeDirs(board, kind, part),
                kind
              )
            );
          }
        } else {
          claims.set(key, { colors: [nearest[0]], tie: false });
        }
      }
      for (const part of parts) {
        const id = partId(part);
        const own = primaryOwner(id);
        if (!own) continue;
        for (const next of adj.get(id) || []) {
          const other = primaryOwner(partId(next));
          if (!other || other === own) continue;
          if (!(next.x > part.x || next.x === part.x && next.y > part.y)) continue;
          const dx = next.x - part.x;
          const dy = next.y - part.y;
          const keyA = claimMapKey(part, kind);
          const keyB = claimMapKey(next, kind);
          if (kind === "city") {
            const boardDirA = absDirFromDelta(dx, dy);
            const boardDirB = absDirFromDelta(-dx, -dy);
            claims.set(keyA, blendCityBridge(own, other, boardDirA, tileRotAt(part)));
            claims.set(keyB, blendCityBridge(other, own, boardDirB, tileRotAt(next)));
          } else {
            const boardAngle = blendAngle({ x: -dx, y: -dy }, { x: dx, y: dy });
            claims.set(keyA, blendHalf(own, other, boardAngle, tileRotAt(part), "half-a"));
            claims.set(keyB, blendHalf(own, other, boardAngle, tileRotAt(next), "half-b"));
          }
        }
      }
      if (kind === "city") {
        for (const part of parts) {
          const claim = claims.get(claimMapKey(part, kind));
          if (!claim || claim.mode !== "hub" || !claim.bridges) continue;
          for (const bridge of claim.bridges) {
            const opp = OPP_DIR[bridge.dir];
            const nei = NEI[DIR_INDEX[bridge.dir]];
            if (!opp || !nei) continue;
            const nx = part.x + nei.dx;
            const ny = part.y + nei.dy;
            let nPart = null;
            for (const next of adj.get(partId(part)) || []) {
              if (next.x === nx && next.y === ny) {
                nPart = next;
                break;
              }
            }
            if (!nPart) continue;
            const nKey = claimMapKey(nPart, kind);
            const nClaim = claims.get(nKey);
            if (!nClaim || nClaim.mode === "hub" || nClaim.mode === "bridge") continue;
            if (nClaim.tie) continue;
            const face = nClaim.colors[0];
            const hubFace = claim.face || claim.colors[0];
            claims.set(nKey, {
              colors: hubFace && hubFace !== face ? [face, hubFace] : [face],
              tie: false,
              mode: "bridge",
              face,
              dir: localEdgeDir(opp, tileRotAt(nPart)),
              boardDir: opp,
              hubOther: true
            });
          }
        }
      }
    }
    for (const [pos, tile] of board.entries()) {
      const comma = pos.indexOf(",");
      const x = Number(pos.slice(0, comma));
      const y = Number(pos.slice(comma + 1));
      (tile.cities || []).forEach((_, index) => {
        const id = "city:" + x + "," + y + "," + index;
        if (seen.has(id)) return;
        const result = collectCityComponent(board, x, y, index);
        for (const part of result.parts) seen.add("city:" + part.x + "," + part.y + "," + part.index);
        paint("city", result.parts);
      });
      (tile.roads || []).forEach((_, index) => {
        const id = "road:" + x + "," + y + "," + index;
        if (seen.has(id)) return;
        const result = collectRoadComponent(board, x, y, index);
        for (const part of result.parts) seen.add("road:" + part.x + "," + part.y + "," + part.index);
        paint("road", result.parts);
      });
      if (tile.monastery) {
        const id = "monastery:" + x + "," + y;
        if (!seen.has(id)) {
          seen.add(id);
          paint("monastery", [{ x, y, index: null }]);
        }
      }
    }
    for (const [pos, tile] of board.entries()) {
      if (!tile.featureClaims) continue;
      for (const feat of Object.keys(tile.featureClaims)) {
        const key = pos + ":" + feat;
        if (claims.has(key)) continue;
        const stored = tile.featureClaims[feat];
        if (!stored || !stored.colors || !stored.colors.length) continue;
        const next = {
          colors: stored.colors.slice(),
          tie: !!stored.tie
        };
        if (stored.mode) next.mode = stored.mode;
        if (stored.angle != null) next.angle = stored.angle;
        if (stored.sideAngle != null) next.sideAngle = stored.sideAngle;
        if (stored.dir) next.dir = stored.dir;
        if (stored.boardDir) next.boardDir = stored.boardDir;
        if (stored.face) next.face = stored.face;
        if (stored.hubOther) next.hubOther = true;
        if (stored.bridges && stored.bridges.length) {
          next.bridges = stored.bridges.map((bridge) => ({
            dir: bridge.dir,
            color: bridge.color
          }));
        }
        if (stored.sectors && stored.sectors.length) {
          next.sectors = stored.sectors.map((sector) => ({
            color: sector.color,
            angle: sector.angle
          }));
        }
        claims.set(key, next);
      }
    }
    return claims;
  }

  // js/game/options.js
  var DEFAULT_GAME_OPTIONS = {
    colorRoads: true,
    colorCities: true,
    colorMonasteries: true
  };
  function normalizeGameOptions(raw) {
    const out = Object.assign({}, DEFAULT_GAME_OPTIONS);
    if (!raw || typeof raw !== "object") return out;
    if (typeof raw.colorRoads === "boolean") out.colorRoads = raw.colorRoads;
    if (typeof raw.colorCities === "boolean") out.colorCities = raw.colorCities;
    if (typeof raw.colorMonasteries === "boolean") out.colorMonasteries = raw.colorMonasteries;
    return out;
  }
  function featColorOptionKey(feat) {
    const id = String(feat || "");
    if (id === "monastery" || id.startsWith("monastery")) return "colorMonasteries";
    if (id.startsWith("city")) return "colorCities";
    if (id.startsWith("road")) return "colorRoads";
    return null;
  }
  function claimColorEnabled(options, feat) {
    const key = featColorOptionKey(feat);
    if (!key) return true;
    const opts = normalizeGameOptions(options);
    return opts[key] !== false;
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
    constructor(deck, players, options) {
      this.players = normalizePlayers(players);
      this.options = normalizeGameOptions(options);
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
      if (!tile || !tile.edges) return false;
      for (const cell of openCells(this.board)) {
        for (let rot = 0; rot < 4; rot++) {
          if (canPlace(this.board, cell.x, cell.y, rotateEdges(tile.edges, rot))) return true;
        }
      }
      return false;
    }
    /**
     * Heal stuck hands: unplaceable current must be pendingDiscard.
     * Also resume a missing pull after restore / interrupted end.
     * Returns true when state changed.
     */
    reconcileHand() {
      if (this.finished || this.pendingMeeple) return false;
      if (this.current) {
        if (!this.canPlaceAnywhere(this.current)) {
          if (this.pendingDiscard) return false;
          this.pendingDiscard = true;
          this.rotation = 0;
          return true;
        }
        if (this.pendingDiscard) {
          this.pendingDiscard = false;
          return true;
        }
        return false;
      }
      if (this.pendingDiscard) {
        this.pendingDiscard = false;
      }
      this.pull();
      return true;
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
        this.pendingDiscard = true;
        this.current = tile;
        return true;
      }
      this.finishGame();
      return false;
    }
    finishGame() {
      this.pendingDiscard = false;
      this.pendingMeeple = null;
      this.current = null;
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
  function createGame(random, players, options) {
    const roll = random || Math.random;
    const tiles = buildTiles();
    const start = tiles.find((tile) => tile.start);
    const deck = shuffle(tiles.filter((tile) => !tile.start), roll);
    const game = new Game(deck, players, options);
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
    const out = {
      id: tile.id,
      start: !!tile.start,
      rot: tile.rot || 0,
      owner: tile.owner || null,
      meeple: tile.meeple ? Object.assign({}, tile.meeple) : null
    };
    if (tile.featureClaims && Object.keys(tile.featureClaims).length) {
      out.featureClaims = JSON.parse(JSON.stringify(tile.featureClaims));
    }
    return out;
  }
  function revivePlacedTile(data) {
    const tile = clonePlaced(makeTile(data.id, data.start), data.rot || 0, data.owner || null);
    tile.meeple = data.meeple ? Object.assign({}, data.meeple) : null;
    if (data.featureClaims && typeof data.featureClaims === "object") {
      tile.featureClaims = JSON.parse(JSON.stringify(data.featureClaims));
    }
    return tile;
  }
  function serializeGame(game) {
    return {
      v: SAVE_VERSION,
      players: game.players.map((player) => ({
        id: player.id,
        name: player.name,
        bot: !!player.bot,
        botStrength: player.bot ? player.botStrength || "standard" : null
      })),
      options: normalizeGameOptions(game.options),
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
    const game = new Game(
      (data.deck || []).map((tile) => makeTile(tile.id, tile.start)),
      players,
      data.options
    );
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
    if (!game.finished) game.reconcileHand();
    return game;
  }

  // js/game/bot.js
  var BOT_WEIGHTS = {
    standard: {
      // --- 加点（正） ---
      /** 自分の即時得点 */
      immediateSelf: 1,
      /** 終了見積もりに対する自分の潜在増分 */
      endSelf: 0.7,
      /** この手で回収できたミープル数 */
      meepleReturn: 0.45,
      /** 自分多数の未完成フィーチャー見込み */
      equity: 0.4,
      /** 自都市の開口が減った回数ぶん（閉じに近づける） */
      openClose: 1.25,
      /**
       * 自分だけが即時得点した完成への上乗せ（×即時点）。
       * 独占完成を修道院の小前進などより優先しやすくする。
       */
      exclusiveComplete: 0.22,
      // --- 減点（負）: 値を見れば減点と分かる ---
      /** 敵の即時得点（自分0のときフル適用） */
      immediateOpp: -0.85,
      /** 終了見積もりに対する敵の潜在増分（自分潜在0のときフル適用） */
      endOpp: -0.45,
      /**
       * 自分も得点しているときの「共有分」の敵点に掛ける割合 (0–1)。
       * 同点完成 40/40 を実質ほぼ無視しないための緩和。
       * 敵だけ多い超過分には immediateOpp/endOpp をフル適用。
       */
      sharedOppScale: 0.3,
      /** 敵多数フィーチャーを残す／太らせる量（妨害ではなく事故抑制） */
      gift: -0.4,
      /** 自分0点なのに敵だけ完成させたときの平坦ペナ */
      enemyCompleteGift: -6,
      /** 自都市の開口が増えた回数ぶん */
      openWaste: -1.5,
      /** 序盤（やミープル不足）での畑ミープル */
      earlyFieldBan: -3,
      /** 修道院タイルなのに修道院以外へミープル */
      skipMonastery: -2.5,
      /**
       * 自分の即時得点が小さいのに敵にまとまった点を渡す手の追加減点
       * （自分も得点しているが敵の方が多いケース）。
       */
      oppLeadGift: -0.35
    }
  };
  var FIELD_PHASE = { early: 0.15, mid: 0.45, late: 1, end: 1.2 };
  var DECK_CUT = { early: 48, late: 24, end: 8 };
  var EQUITY_TUNING = {
    cityOpen1: 1.2,
    cityOpen2: 0.9,
    cityOpen3Plus: 0.85,
    cityMul: 1.25,
    roadMul: 0.75,
    roadOpen1: 0.8,
    roadOpen2Plus: 0.4,
    monasteryFilled: 1,
    monasteryEmpty: 0.35,
    earlyCityMul: 1.15,
    earlyRoadMul: 0.85
  };
  function cloneGame(game) {
    return restoreGame(serializeGame(game));
  }
  function deckPhase(remaining) {
    if (remaining <= DECK_CUT.end) return "end";
    if (remaining <= DECK_CUT.late) return "late";
    if (remaining <= DECK_CUT.early) return "mid";
    return "early";
  }
  function projectedScores(game) {
    const clone = cloneGame(game);
    if (!clone.finalScored) finalizeScores(clone);
    return clone.scores.slice();
  }
  function scoreDelta(before, after, index) {
    return (after[index] || 0) - (before[index] || 0);
  }
  function bestOppDelta(before, after, me, playerCount) {
    let best = 0;
    for (let i = 0; i < playerCount; i++) {
      if (i === me) continue;
      const delta = scoreDelta(before, after, i);
      if (delta > best) best = delta;
    }
    return best;
  }
  function scaledOppTerm(selfGain, oppGain, oppWeight, sharedScale) {
    if (!(oppGain > 0) || !oppWeight) return 0;
    if (!(selfGain > 0)) return oppWeight * oppGain;
    const scale = sharedScale == null ? 1 : sharedScale;
    const shared = Math.min(selfGain, oppGain);
    const oppExtra = Math.max(0, oppGain - selfGain);
    return oppWeight * (oppExtra + shared * scale);
  }
  function countOpenEdges(board, kind, parts) {
    let open = 0;
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile) {
        open += 1;
        continue;
      }
      const rot = tile.rot || 0;
      if (kind === "city") {
        const city2 = tile.cities && tile.cities[part.index];
        if (!city2) {
          open += 1;
          continue;
        }
        for (const catalogDir of city2.edges) {
          const dir = absDir(catalogDir, rot);
          const step = NEI[DIR_INDEX[dir]];
          const neighbor = board.get(keyOf(part.x + step.dx, part.y + step.dy));
          if (!neighbor || findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]) < 0) open += 1;
        }
      } else if (kind === "road") {
        const road2 = tile.roads && tile.roads[part.index];
        if (!road2) {
          open += 1;
          continue;
        }
        for (const catalogDir of road2) {
          const dir = absDir(catalogDir, rot);
          const step = NEI[DIR_INDEX[dir]];
          const neighbor = board.get(keyOf(part.x + step.dx, part.y + step.dy));
          if (!neighbor || findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]) < 0) open += 1;
        }
      }
    }
    return open;
  }
  function featureMajority(board, kind, parts, playerCount) {
    return majorityPlayers(meepleCountsOnFeature(board, kind, parts, playerCount));
  }
  function stockPenalty(stock, immediateSelf) {
    if (immediateSelf >= 4) return 0;
    if (stock >= 4) return 0;
    if (stock === 3) return 0.4;
    if (stock === 2) return 1;
    if (stock === 1) return 2.5;
    return 0;
  }
  function fieldAllowed(phase, completedCities, stock) {
    if (phase === "early") return false;
    if (phase === "mid") return completedCities >= 2 && stock >= 3;
    return completedCities >= 1 || stock >= 2;
  }
  function meepleOptions(game, phase) {
    const options = [{ slotId: null, kind: null }];
    if (!game.pendingMeeple) return options;
    const stock = game.meeples[game.pendingMeeple.player];
    if (stock <= 0) return options;
    const x = game.pendingMeeple.x;
    const y = game.pendingMeeple.y;
    for (const slot of game.meepleSlots()) {
      if (slot.kind === "field") {
        const field = collectFieldComponent(game.board, x, y, slot.index);
        const cities = completedCitiesTouchingField(game.board, field.parts);
        if (!fieldAllowed(phase, cities, stock)) continue;
        options.push({ slotId: slot.id, kind: slot.kind, cities });
        continue;
      }
      options.push({ slotId: slot.id, kind: slot.kind });
    }
    return options;
  }
  function equityAndGift(game, me, weights, phase) {
    let equity = 0;
    let gift = 0;
    const board = game.board;
    const n = game.players.length;
    const seenCities = /* @__PURE__ */ new Set();
    const seenRoads = /* @__PURE__ */ new Set();
    const seenFields = /* @__PURE__ */ new Set();
    const t = EQUITY_TUNING;
    const cityBonus = (phase === "early" ? t.earlyCityMul : 1) * t.cityMul;
    const roadBonus = (phase === "early" ? t.earlyRoadMul : 1) * t.roadMul;
    const fieldPhase = FIELD_PHASE[phase] || FIELD_PHASE.mid;
    for (const [pos, tile] of board) {
      const [x, y] = pos.split(",").map(Number);
      (tile.cities || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenCities.has(seed)) return;
        const result = collectCityComponent(board, x, y, index);
        for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        const winners = featureMajority(board, "city", result.parts, n);
        if (!winners.length) return;
        const tiles = uniqueTileCount(result.parts);
        const pennants = cityPennantCount(board, result.parts);
        const openings = countOpenEdges(board, "city", result.parts);
        const completeBonus = openings <= 1 ? t.cityOpen1 : openings === 2 ? t.cityOpen2 : t.cityOpen3Plus;
        const value = (tiles + pennants) * completeBonus * cityBonus;
        if (winners.includes(me)) equity += value;
        else gift += value;
      });
      (tile.roads || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenRoads.has(seed)) return;
        const result = collectRoadComponent(board, x, y, index);
        for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        const winners = featureMajority(board, "road", result.parts, n);
        if (!winners.length) return;
        const tiles = uniqueTileCount(result.parts);
        const openings = countOpenEdges(board, "road", result.parts);
        const value = tiles * (openings <= 1 ? t.roadOpen1 : t.roadOpen2Plus) * roadBonus;
        if (winners.includes(me)) equity += value;
        else gift += value;
      });
      if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery" && !monasteryComplete(board, x, y)) {
        const filled = monasteryTileCount(board, x, y);
        const value = filled * t.monasteryFilled + (9 - filled) * t.monasteryEmpty;
        if (tile.meeple.player === me) equity += value;
        else gift += value;
      }
      if (tile.meeple && tile.meeple.kind === "field") {
        const seed = x + "," + y + "," + tile.meeple.index;
        if (seenFields.has(seed)) continue;
        const result = collectFieldComponent(board, x, y, tile.meeple.index);
        for (const part of result.parts) seenFields.add(part.x + "," + part.y + "," + part.index);
        const winners = featureMajority(board, "field", result.parts, n);
        if (!winners.length) continue;
        const cities = completedCitiesTouchingField(board, result.parts);
        const value = cities * 3 * fieldPhase;
        if (winners.includes(me)) equity += value;
        else gift += value;
      }
    }
    return {
      equity: equity * weights.equity,
      gift: gift * weights.gift
    };
  }
  function cityOpeningDeltaScore(beforeBoard, afterBoard, x, y, me, weights) {
    const tile = afterBoard.get(keyOf(x, y));
    if (!tile || !tile.cities) return 0;
    let openingsIncreased = 0;
    let openingsReduced = 0;
    tile.cities.forEach((_, index) => {
      const after = collectCityComponent(afterBoard, x, y, index);
      if (after.complete) return;
      const winners = featureMajority(afterBoard, "city", after.parts, 8);
      if (!winners.includes(me)) return;
      if (uniqueTileCount(after.parts) <= 1) return;
      const beforeParts = after.parts.filter((part) => !(part.x === x && part.y === y));
      if (!beforeParts.length) return;
      const afterOpen = countOpenEdges(afterBoard, "city", after.parts);
      const beforeOpen = countOpenEdges(beforeBoard, "city", beforeParts);
      if (afterOpen > beforeOpen) openingsIncreased += afterOpen - beforeOpen;
      else if (afterOpen < beforeOpen) openingsReduced += beforeOpen - afterOpen;
    });
    const close = weights.openClose || 0;
    return weights.openWaste * openingsIncreased + close * openingsReduced;
  }
  function betterScore(scored, place, best) {
    if (!best) return true;
    if (scored.value !== best.scored.value) return scored.value > best.scored.value;
    if (scored.immSelf !== best.scored.immSelf) return scored.immSelf > best.scored.immSelf;
    if (scored.returned !== best.scored.returned) return scored.returned > best.scored.returned;
    if (scored.stock !== best.scored.stock) return scored.stock > best.scored.stock;
    if (!place || !best.place) return false;
    return place.y < best.place.y || place.y === best.place.y && place.x < best.place.x;
  }
  function evaluateApplied(before, after, me, weights, phase, placed, meepleUsed, stockBefore, optionKind, endBefore, deep) {
    const n = before.players.length;
    const immSelf = scoreDelta(before.scores, after.scores, me);
    const immOpp = bestOppDelta(before.scores, after.scores, me, n);
    const returned = Math.max(0, after.meeples[me] - (stockBefore - (meepleUsed ? 1 : 0)));
    const eg = equityAndGift(after, me, weights, phase);
    const sharedScale = weights.sharedOppScale == null ? 1 : weights.sharedOppScale;
    let value = weights.immediateSelf * immSelf + scaledOppTerm(immSelf, immOpp, weights.immediateOpp, sharedScale) + weights.meepleReturn * returned + eg.equity + eg.gift;
    if (deep && endBefore) {
      const endAfter = projectedScores(after);
      const endSelf = scoreDelta(endBefore, endAfter, me);
      const endOpp = bestOppDelta(endBefore, endAfter, me, n);
      const latSelf = endSelf - immSelf;
      const latOpp = endOpp - immOpp;
      value += weights.endSelf * latSelf + scaledOppTerm(latSelf, latOpp, weights.endOpp, sharedScale);
    }
    if (immSelf >= 4 && immOpp <= 0 && weights.exclusiveComplete) {
      value += weights.exclusiveComplete * immSelf;
    }
    if (immSelf > 0 && immOpp > immSelf && weights.oppLeadGift) {
      value += weights.oppLeadGift * (immOpp - immSelf);
    }
    if (immOpp > 0 && immSelf <= 0) value += weights.enemyCompleteGift;
    if (meepleUsed) value -= stockPenalty(stockBefore, immSelf);
    if (placed) {
      value += cityOpeningDeltaScore(before.board, after.board, placed.x, placed.y, me, weights);
      const tile = after.board.get(keyOf(placed.x, placed.y));
      if (tile && tile.monastery && meepleUsed && optionKind && optionKind !== "monastery") {
        value += weights.skipMonastery;
      }
      if (optionKind === "field" && (phase === "early" || phase === "mid" && stockBefore <= 2)) {
        value += weights.earlyFieldBan;
      }
    }
    return {
      value,
      immSelf,
      returned,
      stock: after.meeples[me]
    };
  }
  var DEEP_CANDIDATE_LIMIT = 10;
  function listPlacements(game) {
    const out = [];
    if (!game.current) return out;
    for (let rot = 0; rot < 4; rot++) {
      const edges = rotateEdges(game.current.edges, rot);
      for (const cell of openCells(game.board)) {
        if (!canPlace(game.board, cell.x, cell.y, edges)) continue;
        out.push({ rot, x: cell.x, y: cell.y });
      }
    }
    return out;
  }
  function considerOption(best, scored, place, slotId) {
    const candidate = { place, slotId, scored };
    return betterScore(scored, place, best) ? candidate : best;
  }
  function applyMeepleChoice(game, slotId) {
    const after = cloneGame(game);
    if (slotId) {
      if (!after.placeMeeple(slotId)) return null;
    } else if (!after.skipMeeple()) {
      return null;
    }
    return after;
  }
  function applyPlaceChoice(game, place, slotId) {
    const placed = cloneGame(game);
    placed.setRotation(place.rot);
    if (!placed.place(place.x, place.y)) return null;
    if (slotId) {
      if (!placed.placeMeeple(slotId)) return null;
    } else if (!placed.skipMeeple()) {
      return null;
    }
    return placed;
  }
  function chooseBotAction(game, strength) {
    const level = strength && BOT_WEIGHTS[strength] ? strength : "standard";
    const weights = BOT_WEIGHTS[level];
    if (!game || game.finished) return null;
    if (game.pendingDiscard) return { type: "discard" };
    const phase = deckPhase(game.deck.length);
    const endMul = phase === "end" ? 1.15 : 1;
    const tuned = Object.assign({}, weights, {
      endSelf: weights.endSelf * endMul,
      endOpp: weights.endOpp * endMul
    });
    const endBefore = projectedScores(game);
    if (game.pendingMeeple) {
      const me2 = game.pendingMeeple.player;
      const place = { x: game.pendingMeeple.x, y: game.pendingMeeple.y, rot: 0 };
      const stockBefore2 = game.meeples[me2];
      const shortlist2 = [];
      for (const option of meepleOptions(game, phase)) {
        const after = applyMeepleChoice(game, option.slotId);
        if (!after) continue;
        const scored = evaluateApplied(
          game,
          after,
          me2,
          tuned,
          phase,
          place,
          !!option.slotId,
          stockBefore2,
          option.kind,
          endBefore,
          false
        );
        shortlist2.push({ slotId: option.slotId, kind: option.kind, scored });
      }
      shortlist2.sort((a, b) => b.scored.value - a.scored.value);
      let best2 = null;
      for (const item of shortlist2.slice(0, DEEP_CANDIDATE_LIMIT)) {
        const after = applyMeepleChoice(game, item.slotId);
        if (!after) continue;
        const scored = evaluateApplied(
          game,
          after,
          me2,
          tuned,
          phase,
          place,
          !!item.slotId,
          stockBefore2,
          item.kind,
          endBefore,
          true
        );
        best2 = considerOption(best2, scored, place, item.slotId);
      }
      return { type: "meeple", slotId: best2 ? best2.slotId : null };
    }
    if (!game.current) return null;
    const me = game.player;
    const stockBefore = game.meeples[me];
    const placements = listPlacements(game);
    const shortlist = [];
    for (const place of placements) {
      const placedOnly = cloneGame(game);
      placedOnly.setRotation(place.rot);
      if (!placedOnly.place(place.x, place.y)) continue;
      for (const option of meepleOptions(placedOnly, phase)) {
        const after = applyMeepleChoice(placedOnly, option.slotId);
        if (!after) continue;
        const scored = evaluateApplied(
          game,
          after,
          me,
          tuned,
          phase,
          place,
          !!option.slotId,
          stockBefore,
          option.kind,
          endBefore,
          false
        );
        shortlist.push({
          place,
          slotId: option.slotId,
          kind: option.kind,
          scored
        });
      }
    }
    shortlist.sort((a, b) => b.scored.value - a.scored.value || b.scored.immSelf - a.scored.immSelf);
    let best = null;
    for (const item of shortlist.slice(0, DEEP_CANDIDATE_LIMIT)) {
      const after = applyPlaceChoice(game, item.place, item.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game,
        after,
        me,
        tuned,
        phase,
        item.place,
        !!item.slotId,
        stockBefore,
        item.kind,
        endBefore,
        true
      );
      best = considerOption(best, scored, item.place, item.slotId);
    }
    if (!best) {
      const fallback = placements[0];
      if (!fallback) return null;
      return { type: "place", rot: fallback.rot, x: fallback.x, y: fallback.y, slotId: null };
    }
    return {
      type: "place",
      rot: best.place.rot,
      x: best.place.x,
      y: best.place.y,
      slotId: best.slotId
    };
  }
  function isBotPlayer(player) {
    return !!(player && player.bot);
  }

  // js/game/index.js
  var Carcassonne = {
    PLAYERS,
    COLOR_PALETTE,
    PLAYERS_MIN,
    PLAYERS_MAX,
    NAME_MAX,
    MEEPLES_EACH,
    BOT_STRENGTHS,
    BOT_STRENGTH_IDS,
    BOT_NAMES,
    botNameForColor,
    defaultPlayerName,
    nextPlayerName,
    BOT_WEIGHTS,
    TYPES,
    MARKUP,
    monasteryHTML,
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
    buildFeatureClaims,
    scoreFeature,
    stampFeatureClaim,
    stampFeatureClaimsFromMap,
    FIELD_CITY_TOUCH,
    createGame,
    serializeGame,
    restoreGame,
    SAVE_VERSION,
    simulateToLastTile,
    DEFAULT_GAME_OPTIONS,
    normalizeGameOptions,
    claimColorEnabled,
    featColorOptionKey,
    normalizeBotStrength,
    chooseBotAction,
    cloneGame,
    deckPhase,
    isBotPlayer
  };
  var index_default = Carcassonne;
  return __toCommonJS(index_exports);
})();
