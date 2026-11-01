(() => {
  // js/audio.js
  var VOLUME_KEY = "tile-city-volume";
  var SOUNDS = {
    tile: "assets/sound/tile.mp3",
    point: "assets/sound/point.mp3",
    clear: "assets/sound/clear.mp3"
  };
  var MEEPLE_COLORS = [
    "red",
    "blue",
    "green",
    "yellow",
    "orange",
    "purple",
    "white",
    "brown"
  ];
  function loadVolume() {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw == null || raw === "") return 0.7;
      const n = Number(raw);
      if (!Number.isFinite(n)) return 0.7;
      return Math.min(1, Math.max(0, n / 100));
    } catch (err) {
      return 0.7;
    }
  }
  var volume = loadVolume();
  function getVolume() {
    return volume;
  }
  function setVolume(next) {
    volume = Math.min(1, Math.max(0, Number(next) || 0));
    try {
      localStorage.setItem(VOLUME_KEY, String(Math.round(volume * 100)));
    } catch (err) {
    }
    syncVolumeInputs();
  }
  function playSrc(src) {
    if (!(volume > 0) || !src) return;
    try {
      const audio = new Audio(src);
      audio.volume = volume;
      void audio.play().catch(() => {
      });
    } catch (err) {
    }
  }
  function playSrcAsync(src) {
    return new Promise((resolve) => {
      if (!(volume > 0) || !src) {
        resolve();
        return;
      }
      try {
        const audio = new Audio(src);
        audio.volume = volume;
        const done = () => resolve();
        audio.addEventListener("ended", done, { once: true });
        audio.addEventListener("error", done, { once: true });
        void audio.play().catch(() => resolve());
      } catch (err) {
        resolve();
      }
    });
  }
  function playSound(name) {
    playSrc(SOUNDS[name]);
  }
  function playMeepleSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    const n = 1 + Math.floor(Math.random() * 3);
    playSrc("assets/sound/meeple/" + color + "/" + color + n + ".mp3");
  }
  function playWinSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    playSrc("assets/sound/win/" + color + ".mp3");
  }
  async function playEndFanfare(colors) {
    const clearDone = playSrcAsync(SOUNDS.clear);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    for (const color of colors || []) {
      if (!MEEPLE_COLORS.includes(color)) continue;
      await playSrcAsync("assets/sound/win/" + color + ".mp3");
    }
    await clearDone;
  }
  function syncVolumeInputs() {
    const value = String(Math.round(volume * 100));
    document.querySelectorAll(".volume-range").forEach((input) => {
      input.value = value;
    });
  }
  function bindVolumeBar() {
    syncVolumeInputs();
    document.querySelectorAll(".volume-range").forEach((input) => {
      input.addEventListener("input", () => {
        setVolume(Number(input.value) / 100);
      });
    });
  }
  var TileCityAudio = {
    getVolume,
    setVolume,
    playSound,
    playMeepleSound,
    playWinSound,
    playEndFanfare,
    bindVolumeBar
  };
  if (typeof globalThis !== "undefined") globalThis.TileCityAudio = TileCityAudio;
  var audio_default = TileCityAudio;

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
    const raw = item.name == null ? "" : String(item.name);
    const name = raw.trim().slice(0, NAME_MAX) || COLOR_PALETTE.find((c) => c.id === id).label;
    const bot = !!(item && item.bot);
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
  var MARKUP = {
    A: '<i class="road to-s"></i><span class="monastery"><i class="wing left"></i><i class="wing right"></i><i class="cross"></i><i class="roof"></i><i class="body"></i></span>',
    B: '<span class="monastery"><i class="wing left"></i><i class="wing right"></i><i class="cross"></i><i class="roof"></i><i class="body"></i></span>',
    C: '<i class="city fill"></i><i class="pennant p-c" title="\u65D7"></i>',
    D: '<i class="city cap n shallow"></i><i class="road h"></i>',
    E: '<i class="city cap n"></i>',
    F: '<i class="city bar h"></i><i class="pennant p-bar" title="\u65D7"></i>',
    G: '<i class="city bar h"></i>',
    H: '<i class="city cap n"></i><i class="city cap s"></i>',
    I: '<i class="city cap n gap-w"></i><i class="city cap w gap-n"></i>',
    J: '<i class="city cap n"></i><i class="bend se edge"></i><i class="bend se line"></i>',
    K: '<i class="city cap n"></i><i class="bend sw edge"></i><i class="bend sw line"></i>',
    L: '<i class="city cap n shallow"></i><i class="road h-e"></i><i class="road h-w"></i><i class="road v-s"></i><i class="village"></i>',
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
  function awardPoints(game2, players, points) {
    for (const player of players) game2.scores[player] += points;
  }
  function returnMeepleFromTile(game2, tile, kind, index) {
    if (!tile || !tile.meeple) return false;
    if (tile.meeple.kind !== kind) return false;
    if (kind === "road" || kind === "city" || kind === "field") {
      if (tile.meeple.index !== index) return false;
    }
    const meeple = tile.meeple;
    game2.meeples[meeple.player] += 1;
    tile.leaveFx = {
      color: meeple.color,
      kind: meeple.kind,
      x: meeple.x,
      y: meeple.y,
      earned: meeple.earned || 0,
      at: Date.now()
    };
    tile.meeple = null;
    return true;
  }
  function returnMeeplesOnFeature(game2, kind, parts) {
    let returned = 0;
    for (const part of parts) {
      const tile = game2.board.get(keyOf(part.x, part.y));
      if (returnMeepleFromTile(game2, tile, kind, part.index)) returned += 1;
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
  function scoreFeature(game2, kind, parts, points, options) {
    const opts = options || {};
    const winners = majorityPlayers(
      meepleCountsOnFeature(game2.board, kind, parts, game2.players.length)
    );
    if (winners.length && points > 0) {
      awardPoints(game2, winners, points);
      labelMeepleEarnings(game2.board, kind, parts, winners, points);
    }
    if (opts.returnMeeples) return returnMeeplesOnFeature(game2, kind, parts);
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
  function resolveCompletions(game2, x, y) {
    const board = game2.board;
    const tile = board.get(keyOf(x, y));
    if (!tile) return { roads: 0, cities: 0, monasteries: 0, points: 0 };
    const summary = { roads: 0, cities: 0, monasteries: 0, points: 0 };
    const before = game2.scores.slice();
    const seenRoads = /* @__PURE__ */ new Set();
    const seenCities = /* @__PURE__ */ new Set();
    (tile.roads || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenRoads.has(seed)) return;
      const result = collectRoadComponent(board, x, y, index);
      for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
      if (!result.complete) return;
      scoreFeature(game2, "road", result.parts, roadPoints(result.parts, true), { returnMeeples: true });
      summary.roads += 1;
    });
    (tile.cities || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenCities.has(seed)) return;
      const result = collectCityComponent(board, x, y, index);
      for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
      if (!result.complete) return;
      scoreFeature(game2, "city", result.parts, cityPoints(board, result.parts, true), { returnMeeples: true });
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
        scoreFeature(game2, "monastery", [{ x: mx, y: my, index: null }], 9, { returnMeeples: true });
        summary.monasteries += 1;
      }
    }
    summary.points = game2.scores.reduce((sum, score, i) => sum + (score - before[i]), 0);
    return summary;
  }
  function finalizeScores(game2) {
    const board = game2.board;
    const seenRoads = /* @__PURE__ */ new Set();
    const seenCities = /* @__PURE__ */ new Set();
    const seenFields = /* @__PURE__ */ new Set();
    const stockBefore = game2.meeples.slice();
    const keep = { returnMeeples: false };
    for (const [pos, tile] of board) {
      const [x, y] = pos.split(",").map(Number);
      (tile.roads || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenRoads.has(seed)) return;
        const result = collectRoadComponent(board, x, y, index);
        for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        scoreFeature(game2, "road", result.parts, roadPoints(result.parts, false), keep);
      });
      (tile.cities || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenCities.has(seed)) return;
        const result = collectCityComponent(board, x, y, index);
        for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        scoreFeature(game2, "city", result.parts, cityPoints(board, result.parts, false), keep);
      });
      if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery") {
        if (!monasteryComplete(board, x, y)) {
          scoreFeature(game2, "monastery", [{ x, y, index: null }], monasteryTileCount(board, x, y), keep);
        }
      }
      const fields = fieldPortsFor(tile);
      fields.forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenFields.has(seed)) return;
        const result = collectFieldComponent(board, x, y, index);
        for (const part of result.parts) seenFields.add(part.x + "," + part.y + "," + part.index);
        const cities = completedCitiesTouchingField(board, result.parts);
        scoreFeature(game2, "field", result.parts, cities * 3, keep);
      });
    }
    game2.standings = rankPlayers(game2.scores, stockBefore);
    game2.rankingOpen = true;
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
  function createGame(random, players) {
    const roll = random || Math.random;
    const tiles = buildTiles();
    const start = tiles.find((tile) => tile.start);
    const deck = shuffle(tiles.filter((tile) => !tile.start), roll);
    const game2 = new Game(deck, players);
    game2.board.set("0,0", clonePlaced(start, 0));
    game2.player = Math.floor(roll() * game2.players.length);
    game2.pull();
    return game2;
  }
  function simulateToLastTile(random) {
    const game2 = createGame(random);
    let guard = 0;
    while (!game2.finished && ++guard < 120) {
      while (game2.pendingDiscard) {
        if (!game2.acknowledgeDiscard()) break;
      }
      if (game2.finished || !game2.current) break;
      if (game2.deck.length === 0) return game2;
      for (let i = 0; i < 4 && game2.hints().now.length === 0; i++) game2.rotate(1);
      const cell = game2.hints().now[0];
      if (!cell) break;
      if (!game2.place(cell.x, cell.y)) break;
      const slots = game2.meepleSlots();
      if (slots.length) game2.placeMeeple(slots[0].id);
      else if (!game2.skipMeeple()) break;
    }
    return game2;
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
  function serializeGame(game2) {
    return {
      v: SAVE_VERSION,
      players: game2.players.map((player) => ({
        id: player.id,
        name: player.name,
        bot: !!player.bot,
        botStrength: player.bot ? player.botStrength || "standard" : null
      })),
      deck: game2.deck.map(snapshotLooseTile),
      discards: game2.discards.map(snapshotLooseTile),
      board: Array.from(game2.board.entries()).map(([key, tile]) => [key, snapshotPlacedTile(tile)]),
      player: game2.player,
      current: snapshotLooseTile(game2.current),
      rotation: game2.rotation,
      finished: !!game2.finished,
      scores: game2.scores.slice(),
      meeples: game2.meeples.slice(),
      lastPlacedBy: Object.assign({}, game2.lastPlacedBy),
      pendingMeeple: game2.pendingMeeple ? Object.assign({}, game2.pendingMeeple) : null,
      pendingDiscard: !!game2.pendingDiscard,
      standings: game2.standings.slice(),
      finalScored: !!game2.finalScored,
      rankingOpen: !!game2.rankingOpen
    };
  }
  function restoreGame(data) {
    if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.board)) return null;
    const players = normalizePlayers(data.players);
    if (!players || players.length < PLAYERS_MIN) return null;
    const game2 = new Game((data.deck || []).map((tile) => makeTile(tile.id, tile.start)), players);
    game2.board = /* @__PURE__ */ new Map();
    for (const entry of data.board) {
      if (!entry || entry.length < 2 || !entry[1]) continue;
      game2.board.set(entry[0], revivePlacedTile(entry[1]));
    }
    if (!game2.board.size) return null;
    game2.discards = (data.discards || []).map((tile) => makeTile(tile.id, tile.start));
    game2.player = (data.player % players.length + players.length) % players.length;
    game2.current = data.current ? makeTile(data.current.id, data.current.start) : null;
    game2.rotation = (data.rotation % 4 + 4) % 4;
    game2.finished = !!data.finished;
    game2.scores = players.map((_, index) => Number(data.scores && data.scores[index]) || 0);
    game2.meeples = players.map((_, index) => {
      const value = data.meeples && data.meeples[index];
      return value == null ? MEEPLES_EACH : Number(value);
    });
    game2.lastPlacedBy = Object.assign(
      Object.fromEntries(players.map((player) => [player.id, null])),
      data.lastPlacedBy || {}
    );
    game2.pendingMeeple = data.pendingMeeple ? Object.assign({}, data.pendingMeeple) : null;
    game2.pendingDiscard = !!data.pendingDiscard;
    game2.standings = Array.isArray(data.standings) ? data.standings.slice() : players.map((_, index) => index);
    game2.finalScored = !!data.finalScored;
    game2.rankingOpen = !!data.rankingOpen;
    if (!game2.finished) game2.reconcileHand();
    return game2;
  }

  // js/game/bot.js
  var BOT_WEIGHTS = {
    standard: {
      immediateSelf: 1,
      immediateOpp: 0.85,
      endSelf: 0.55,
      endOpp: 0.45,
      meepleReturn: 0.35,
      equity: 0.25,
      gift: 0.4,
      enemyCompleteGift: 6,
      openWaste: 1.5,
      earlyFieldBan: 3,
      skipMonastery: 2.5
    }
  };
  var FIELD_PHASE = { early: 0.15, mid: 0.45, late: 1, end: 1.2 };
  var DECK_CUT = { early: 48, late: 24, end: 8 };
  function cloneGame(game2) {
    return restoreGame(serializeGame(game2));
  }
  function deckPhase(remaining) {
    if (remaining <= DECK_CUT.end) return "end";
    if (remaining <= DECK_CUT.late) return "late";
    if (remaining <= DECK_CUT.early) return "mid";
    return "early";
  }
  function projectedScores(game2) {
    const clone = cloneGame(game2);
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
        const city = tile.cities && tile.cities[part.index];
        if (!city) {
          open += 1;
          continue;
        }
        for (const catalogDir of city.edges) {
          const dir = absDir(catalogDir, rot);
          const step = NEI[DIR_INDEX[dir]];
          const neighbor = board.get(keyOf(part.x + step.dx, part.y + step.dy));
          if (!neighbor || findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]) < 0) open += 1;
        }
      } else if (kind === "road") {
        const road = tile.roads && tile.roads[part.index];
        if (!road) {
          open += 1;
          continue;
        }
        for (const catalogDir of road) {
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
    if (stock === 1) return 2;
    return 0;
  }
  function fieldAllowed(phase, completedCities, stock) {
    if (phase === "early") return false;
    if (phase === "mid") return completedCities >= 2 && stock >= 3;
    return completedCities >= 1 || stock >= 2;
  }
  function meepleOptions(game2, phase) {
    const options = [{ slotId: null, kind: null }];
    if (!game2.pendingMeeple) return options;
    const stock = game2.meeples[game2.pendingMeeple.player];
    if (stock <= 0) return options;
    const x = game2.pendingMeeple.x;
    const y = game2.pendingMeeple.y;
    for (const slot of game2.meepleSlots()) {
      if (slot.kind === "field") {
        const field = collectFieldComponent(game2.board, x, y, slot.index);
        const cities = completedCitiesTouchingField(game2.board, field.parts);
        if (!fieldAllowed(phase, cities, stock)) continue;
        options.push({ slotId: slot.id, kind: slot.kind, cities });
        continue;
      }
      options.push({ slotId: slot.id, kind: slot.kind });
    }
    return options;
  }
  function equityAndGift(game2, me, weights, phase) {
    let equity = 0;
    let gift = 0;
    const board = game2.board;
    const n = game2.players.length;
    const seenCities = /* @__PURE__ */ new Set();
    const seenRoads = /* @__PURE__ */ new Set();
    const seenFields = /* @__PURE__ */ new Set();
    const cityBonus = phase === "early" ? 1.15 : 1;
    const roadBonus = phase === "early" ? 0.85 : 1;
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
        const completeBonus = openings <= 1 ? 1.2 : openings === 2 ? 0.9 : 0.5;
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
        const value = tiles * (openings <= 1 ? 0.8 : 0.4) * roadBonus;
        if (winners.includes(me)) equity += value;
        else gift += value;
      });
      if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery" && !monasteryComplete(board, x, y)) {
        const filled = monasteryTileCount(board, x, y);
        const value = filled * 0.7 + (9 - filled) * 0.35;
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
  function openWastePenalty(beforeBoard, afterBoard, x, y, me, weights) {
    const tile = afterBoard.get(keyOf(x, y));
    if (!tile || !tile.cities) return 0;
    let penalty = 0;
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
      if (afterOpen > beforeOpen) penalty += weights.openWaste;
    });
    return penalty;
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
    let value = weights.immediateSelf * immSelf - weights.immediateOpp * immOpp + weights.meepleReturn * returned + eg.equity - eg.gift;
    if (deep && endBefore) {
      const endAfter = projectedScores(after);
      const endSelf = scoreDelta(endBefore, endAfter, me);
      const endOpp = bestOppDelta(endBefore, endAfter, me, n);
      value += weights.endSelf * (endSelf - immSelf) - weights.endOpp * (endOpp - immOpp);
    }
    if (immOpp > 0 && immSelf <= 0) value -= weights.enemyCompleteGift;
    if (meepleUsed) value -= stockPenalty(stockBefore, immSelf);
    if (placed) {
      value -= openWastePenalty(before.board, after.board, placed.x, placed.y, me, weights);
      const tile = after.board.get(keyOf(placed.x, placed.y));
      if (tile && tile.monastery && meepleUsed && optionKind && optionKind !== "monastery") {
        value -= weights.skipMonastery;
      }
      if (optionKind === "field" && (phase === "early" || phase === "mid" && stockBefore <= 2)) {
        value -= weights.earlyFieldBan;
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
  function listPlacements(game2) {
    const out = [];
    if (!game2.current) return out;
    for (let rot = 0; rot < 4; rot++) {
      const edges = rotateEdges(game2.current.edges, rot);
      for (const cell of openCells(game2.board)) {
        if (!canPlace(game2.board, cell.x, cell.y, edges)) continue;
        out.push({ rot, x: cell.x, y: cell.y });
      }
    }
    return out;
  }
  function considerOption(best, scored, place, slotId) {
    const candidate = { place, slotId, scored };
    return betterScore(scored, place, best) ? candidate : best;
  }
  function applyMeepleChoice(game2, slotId) {
    const after = cloneGame(game2);
    if (slotId) {
      if (!after.placeMeeple(slotId)) return null;
    } else if (!after.skipMeeple()) {
      return null;
    }
    return after;
  }
  function applyPlaceChoice(game2, place, slotId) {
    const placed = cloneGame(game2);
    placed.setRotation(place.rot);
    if (!placed.place(place.x, place.y)) return null;
    if (slotId) {
      if (!placed.placeMeeple(slotId)) return null;
    } else if (!placed.skipMeeple()) {
      return null;
    }
    return placed;
  }
  function chooseBotAction(game2, strength) {
    const level = strength && BOT_WEIGHTS[strength] ? strength : "standard";
    const weights = BOT_WEIGHTS[level];
    if (!game2 || game2.finished) return null;
    if (game2.pendingDiscard) return { type: "discard" };
    const phase = deckPhase(game2.deck.length);
    const endMul = phase === "end" ? 1.15 : 1;
    const tuned = Object.assign({}, weights, {
      endSelf: weights.endSelf * endMul,
      endOpp: weights.endOpp * endMul
    });
    const endBefore = projectedScores(game2);
    if (game2.pendingMeeple) {
      const me2 = game2.pendingMeeple.player;
      const place = { x: game2.pendingMeeple.x, y: game2.pendingMeeple.y, rot: 0 };
      const stockBefore2 = game2.meeples[me2];
      const shortlist2 = [];
      for (const option of meepleOptions(game2, phase)) {
        const after = applyMeepleChoice(game2, option.slotId);
        if (!after) continue;
        const scored = evaluateApplied(
          game2,
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
        const after = applyMeepleChoice(game2, item.slotId);
        if (!after) continue;
        const scored = evaluateApplied(
          game2,
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
    if (!game2.current) return null;
    const me = game2.player;
    const stockBefore = game2.meeples[me];
    const placements = listPlacements(game2);
    const shortlist = [];
    for (const place of placements) {
      const placedOnly = cloneGame(game2);
      placedOnly.setRotation(place.rot);
      if (!placedOnly.place(place.x, place.y)) continue;
      for (const option of meepleOptions(placedOnly, phase)) {
        const after = applyMeepleChoice(placedOnly, option.slotId);
        if (!after) continue;
        const scored = evaluateApplied(
          game2,
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
      const after = applyPlaceChoice(game2, item.place, item.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game2,
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
    BOT_WEIGHTS,
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
    simulateToLastTile,
    normalizeBotStrength,
    chooseBotAction,
    cloneGame,
    deckPhase,
    isBotPlayer
  };
  var game_default = Carcassonne;

  // js/i18n.js
  var KEY = "tile-city-lang";
  var dict = {
    en: {
      homeTitle: "Tile City",
      homeLead: "A tile-laying game of expanding roads and cities to score points.",
      play: "Play",
      rules: "Rules",
      home: "Home",
      langEn: "EN",
      langJa: "JA",
      langLabel: "Language",
      volumeLabel: "Volume",
      setupTitle: "Players",
      setupLead: "2\u20138 players. Name max 6 letters. Each color once. Bots play automatically.",
      addPlayer: "Add player",
      start: "Start",
      back: "Back",
      playerName: "Player name",
      removePlayer: "Remove",
      playersCount: "{n} / {max} players",
      errNeedPlayers: "Need {min}\u2013{max} players.",
      errUniqueColor: "Each color can only be used once.",
      playerKind: "Type",
      playerKindHuman: "Human",
      playerKindBot: "Bot",
      botStrength: "Strength",
      botStrengthStandard: "Standard",
      botBadge: "BOT",
      botThinking: "Bot is playing\u2026",
      colorRed: "Red",
      colorBlue: "Blue",
      colorGreen: "Green",
      colorYellow: "Yellow",
      colorOrange: "Orange",
      colorPurple: "Purple",
      colorWhite: "White",
      colorBrown: "Brown",
      rulesTitle: "Tile City Rules",
      rulesLead: "Base-set style tile placement for 2\u20138 players. Original art \u2014 not the publisher\u2019s illustrations.",
      tocGoal: "Goal",
      tocSetup: "Setup",
      tocTurn: "Turn",
      tocPlace: "Placement",
      tocMeeple: "Meeples",
      tocScore: "Scoring",
      tocEnd: "Game end",
      tocTiles: "Tiles A\u2013X",
      goalTitle: "Goal",
      goalBody: "Score the most points by completing roads, cities, and monasteries during the game, then score leftover features and fields at the end.",
      setupSecTitle: "Setup",
      setupPlayers: "Players",
      setupPlayersBody: "2\u20138. Each color has 7 meeples. Pick names (max 6 letters) and unique colors on the setup screen.",
      setupStartTile: "Start tile",
      setupStartTileBody: "One marked D tile starts face-up in the center. Shuffle the other 71 tiles into the deck.",
      setupFirst: "First player",
      setupFirstBody: "The starting player is chosen at random. Turns then follow the player list order.",
      turnTitle: "On your turn",
      turnDraw: "1. Draw",
      turnDrawBody: "Take the top tile so everyone can see it.",
      turnPlace: "2. Place",
      turnPlaceBody: "Rotate in 90\xB0 steps and place it legally (see Placement). If no orientation fits anywhere, discard it and draw again \u2014 your turn is not spent.",
      turnMeeple: "3. Meeple (optional)",
      turnMeepleBody: "You may put one of your meeples on an open feature of the tile you just placed.",
      turnScore: "4. Score",
      turnScoreBody: "Any roads, cities, or monasteries completed by that placement score now and return those meeples.",
      placeTitle: "Placement",
      placeTouch: "Touch a side",
      placeTouchBody: "The new tile must share at least one full side with an existing tile. Corner-only contact is illegal.",
      placeEdges: "Edges match",
      placeEdgesBody: "Every touching side must match end-to-end: city\u2013city, road\u2013road, field\u2013field.",
      placeNoFlip: "No flip",
      placeNoFlipBody: "Rotate only; never mirror the tile.",
      placeOpen: "Open board",
      placeOpenBody: "The map can grow in any direction.",
      legalTitle: "Legal",
      legalBody: "Center is start tile D. North city matches E rotated 180\xB0. East road matches U rotated 90\xB0. South field matches V\u2019s north field.",
      illegalEdgesTitle: "Illegal \u2014 edges clash",
      illegalEdgesBody: "D\u2019s east edge is a road; unrotated E\u2019s west edge is a field. One mismatch blocks the place.",
      illegalCornerTitle: "Illegal \u2014 corner only",
      illegalCornerBody: "Tiles that only touch at a corner do not share a side, so the place is illegal.",
      meepleTitle: "Meeples",
      meepleWhere: "Where",
      meepleWhereBody: "Only on the tile you just placed: road, city, monastery, or field mark that is still free.",
      meepleOne: "One feature",
      meepleOneBody: "You cannot join a road, city, or field that already has any meeple on its connected area.",
      meepleStock: "Stock",
      meepleStockBody: "If you have no meeples left, skip placement. Completing a feature returns your meeples there (except at final scoring).",
      meepleSkip: "Skip",
      meepleSkipBody: "You may place the tile and skip the meeple.",
      scoreTitle: "Scoring during the game",
      scoreIntro: "When a feature finishes, the player(s) with the most meeples on it score. Ties: every tied player gets the full points. Those meeples return to stock.",
      scoreFeature: "Feature",
      scoreComplete: "Complete",
      scoreRoad: "Road",
      scoreRoadBody: "1 point per tile in the road",
      scoreCity: "City",
      scoreCityBody: "2 points per tile + 2 per pennant (banner)",
      scoreMonastery: "Monastery",
      scoreMonasteryBody: "9 points when all 8 neighbors are filled",
      scoreField: "Field",
      scoreFieldBody: "Not scored mid-game",
      endTitle: "Game end",
      endWhen: "When",
      endWhenBody: "After the last tile is placed (or Exit ends the game early), final scoring runs.",
      endRoads: "Incomplete roads",
      endRoadsBody: "1 point per tile.",
      endCities: "Incomplete cities",
      endCitiesBody: "1 point per tile + 1 per pennant.",
      endMonasteries: "Incomplete monasteries",
      endMonasteriesBody: "1 point per filled cell in the 3\xD73 (including the monastery tile).",
      endFields: "Fields",
      endFieldsBody: "Farmers stay on the board. Each field scores 3 points per completed city it touches. Majority rules as above.",
      endMeeples: "Meeples",
      endMeeplesBody: "Final scoring does not return meeples; +N labels show what each scored.",
      endTies: "Ties",
      endTiesBody: "Equal score \u2192 more meeples still in stock ranks higher.",
      controlsTitle: "Controls",
      controlsRotate: "Rotate",
      controlsRotateBody: "Right-click the board, press R while the pointer is over the board, or tap the hand preview / angle thumbs.",
      controlsZoom: "Zoom",
      controlsZoomBody: "Mouse wheel or pinch. Buttons on desktop legend.",
      controlsPan: "Pan",
      controlsPanBody: "Drag the board.",
      controlsHints: "Hints",
      controlsHintsBody: "Green = can place now. Gray = needs a different rotation.",
      tileITitle: "Separate cities on tile I",
      tileIIntro: "Tile I has two cities that only meet at a corner point. They stay separate unless each joins other tiles along a full city edge.",
      tileINorth: "Joins the north city",
      tileINorthBody: "E rotated 180\xB0 matches I\u2019s north city edge. I\u2019s west city stays separate.",
      tileIWest: "Joins the west city",
      tileIWestBody: "E rotated 90\xB0 matches I\u2019s west city edge. I\u2019s north city stays separate.",
      tileIBoth: "Still two cities",
      tileIBothBody: "Even with both sides filled, I\u2019s cities remain split by field inside the tile. Corner-only contact between the two E tiles does not merge them.",
      tilesTitle: "Tiles A\u2013X",
      tilesIntro: "Same letter codes and counts as the classic base set. North is up in the catalog. J and K are mirrors \u2014 rotation never turns one into the other. Pennants (banners) are listed separately from plain twins.",
      legendField: "Field",
      legendRoad: "Road",
      legendCity: "City",
      legendPennant: "Pennant",
      badgePennant: "Pennant",
      badgeStart: "1 is start",
      tileA: "Monastery + road",
      tileB: "Monastery",
      tileC: "City all sides",
      tileD: "City + straight road",
      tileE: "Single city side",
      tileF: "Linked opposite cities",
      tileG: "Linked opposite cities",
      tileGExtra: "Like F, no pennant.",
      tileH: "Split opposite cities",
      tileI: "Split adjacent cities",
      tileJ: "City + right curve",
      tileK: "City + left curve",
      tileL: "City + 3-way road",
      tileM: "Corner city",
      tileN: "Corner city",
      tileO: "Corner city + road",
      tileP: "Corner city + road",
      tileQ: "3-side city",
      tileR: "3-side city",
      tileS: "3-side city + gate road",
      tileT: "3-side city + gate road",
      tileU: "Straight road",
      tileV: "Curve",
      tileW: "3-way road",
      tileX: "Crossroads",
      edgesA: "N field \xB7 E field \xB7 S road \xB7 W field",
      edgesB: "All sides field",
      edgesD: "N city \xB7 E road \xB7 S field \xB7 W road",
      edgesE: "N city \xB7 else field",
      rulesFoot: "Tile City \xB7 base-set rules adapted for this browser version.",
      canPlace: "Can place",
      needsRotate: "Needs rotate",
      rotHint: "Right-click or R to rotate \xB7 Wheel to zoom",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      deck: "deck",
      board: "board",
      discards: "discards",
      exit: "Exit",
      rank: "Rank",
      again: "Again",
      skip: "Skip",
      ok: "OK",
      endGame: "End",
      cancel: "Cancel",
      boardView: "Board",
      rotateTile: "Rotate tile",
      unplaceableTile: "Unplaceable tile",
      placeMeeple: "Place meeple",
      undoPlace: "Undo place",
      noLegalPlace: "No legal place for this tile",
      endThisGame: "End this game?",
      gameOver: "Game over",
      pickMeeple: "Pick a mark to place a meeple",
      noMeeplesLeft: "No meeples left",
      noOpenSpot: "No open spot for a meeple"
    },
    ja: {
      homeTitle: "Tile City",
      homeLead: "\u9053\u3068\u90FD\u5E02\u3092\u5E83\u3052\u3066\u5F97\u70B9\u3092\u7AF6\u3046\u30BF\u30A4\u30EB\u914D\u7F6E\u30B2\u30FC\u30E0\u3002",
      play: "\u904A\u3076",
      rules: "\u30EB\u30FC\u30EB",
      home: "\u30DB\u30FC\u30E0",
      langEn: "EN",
      langJa: "JA",
      langLabel: "\u8A00\u8A9E",
      volumeLabel: "\u97F3\u91CF",
      setupTitle: "\u30D7\u30EC\u30A4\u30E4\u30FC",
      setupLead: "2\u301C8\u4EBA\u3002\u540D\u524D\u306F\u6700\u59276\u6587\u5B57\u3002\u8272\u306F\u91CD\u8907\u4E0D\u53EF\u3002Bot\u306F\u81EA\u52D5\u3067\u624B\u756A\u3092\u9032\u3081\u307E\u3059\u3002",
      addPlayer: "\u8FFD\u52A0",
      start: "\u958B\u59CB",
      back: "\u623B\u308B",
      playerName: "\u30D7\u30EC\u30A4\u30E4\u30FC\u540D",
      removePlayer: "\u524A\u9664",
      playersCount: "{n} / {max} \u4EBA",
      errNeedPlayers: "{min}\u301C{max} \u4EBA\u5FC5\u8981\u3067\u3059\u3002",
      errUniqueColor: "\u540C\u3058\u8272\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002",
      playerKind: "\u7A2E\u5225",
      playerKindHuman: "\u4EBA",
      playerKindBot: "Bot",
      botStrength: "\u5F37\u3055",
      botStrengthStandard: "\u6A19\u6E96",
      botBadge: "BOT",
      botThinking: "Bot\u306E\u624B\u756A\u2026",
      colorRed: "\u8D64",
      colorBlue: "\u9752",
      colorGreen: "\u7DD1",
      colorYellow: "\u9EC4",
      colorOrange: "\u6A59",
      colorPurple: "\u7D2B",
      colorWhite: "\u767D",
      colorBrown: "\u8336",
      rulesTitle: "Tile City \u30EB\u30FC\u30EB",
      rulesLead: "2\u301C8\u4EBA\u5411\u3051\u306E\u57FA\u672C\u30BB\u30C3\u30C8\u98A8\u30BF\u30A4\u30EB\u914D\u7F6E\u3002\u30AA\u30EA\u30B8\u30CA\u30EB\u7D75\u67C4\u3067\u3059\uFF08\u88FD\u54C1\u306E\u30A4\u30E9\u30B9\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
      tocGoal: "\u76EE\u7684",
      tocSetup: "\u6E96\u5099",
      tocTurn: "\u624B\u756A",
      tocPlace: "\u914D\u7F6E",
      tocMeeple: "\u30DF\u30FC\u30D7\u30EB",
      tocScore: "\u5F97\u70B9",
      tocEnd: "\u7D42\u4E86",
      tocTiles: "\u30BF\u30A4\u30EB A\u2013X",
      goalTitle: "\u76EE\u7684",
      goalBody: "\u30B2\u30FC\u30E0\u4E2D\u306B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u5B8C\u6210\u3055\u305B\u3066\u5F97\u70B9\u3057\u3001\u7D42\u4E86\u6642\u306B\u6B8B\u308A\u306E\u8981\u7D20\u3068\u7551\u3092\u5F97\u70B9\u3057\u3066\u3001\u6700\u3082\u9AD8\u3044\u70B9\u3092\u76EE\u6307\u3057\u307E\u3059\u3002",
      setupSecTitle: "\u6E96\u5099",
      setupPlayers: "\u30D7\u30EC\u30A4\u30E4\u30FC",
      setupPlayersBody: "2\u301C8\u4EBA\u3002\u5404\u82727\u4F53\u306E\u30DF\u30FC\u30D7\u30EB\u3002\u8A2D\u5B9A\u753B\u9762\u3067\u540D\u524D\uFF08\u6700\u59276\u6587\u5B57\uFF09\u3068\u8272\u3092\u9078\u3073\u307E\u3059\u3002",
      setupStartTile: "\u958B\u59CB\u30BF\u30A4\u30EB",
      setupStartTileBody: "\u5370\u4ED8\u304D\u306E D \u30BF\u30A4\u30EB1\u679A\u3092\u4E2D\u592E\u306B\u8868\u5411\u304D\u3067\u7F6E\u304D\u307E\u3059\u3002\u6B8B\u308A71\u679A\u3092\u5C71\u672D\u306B\u3057\u307E\u3059\u3002",
      setupFirst: "\u5148\u624B",
      setupFirstBody: "\u5148\u624B\u306F\u30E9\u30F3\u30C0\u30E0\u306B\u6C7A\u307E\u308A\u307E\u3059\u3002\u4EE5\u964D\u306F\u30D7\u30EC\u30A4\u30E4\u30FC\u9806\u306B\u624B\u756A\u304C\u56DE\u308A\u307E\u3059\u3002",
      turnTitle: "\u624B\u756A",
      turnDraw: "1. \u30C9\u30ED\u30FC",
      turnDrawBody: "\u5C71\u672D\u306E\u4E00\u756A\u4E0A\u3092\u5F15\u304D\u3001\u5168\u54E1\u306B\u898B\u3048\u308B\u3088\u3046\u306B\u3057\u307E\u3059\u3002",
      turnPlace: "2. \u914D\u7F6E",
      turnPlaceBody: "90\xB0\u5358\u4F4D\u3067\u56DE\u8EE2\u3057\u3001\u5408\u6CD5\u306A\u5834\u6240\u306B\u7F6E\u304D\u307E\u3059\uFF08\u914D\u7F6E\u53C2\u7167\uFF09\u3002\u3069\u306E\u5411\u304D\u3067\u3082\u7F6E\u3051\u306A\u3044\u5834\u5408\u306F\u6368\u3066\u3066\u5F15\u304D\u76F4\u3057 \u2014 \u624B\u756A\u306F\u6D88\u8CBB\u3057\u307E\u305B\u3093\u3002",
      turnMeeple: "3. \u30DF\u30FC\u30D7\u30EB\uFF08\u4EFB\u610F\uFF09",
      turnMeepleBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u7A7A\u304D\u8981\u7D20\u306B\u3001\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u30921\u4F53\u7F6E\u3051\u307E\u3059\u3002",
      turnScore: "4. \u5F97\u70B9",
      turnScoreBody: "\u305D\u306E\u914D\u7F6E\u3067\u5B8C\u6210\u3057\u305F\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u5F97\u70B9\u3057\u3001\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u3092\u623B\u3057\u307E\u3059\u3002",
      placeTitle: "\u914D\u7F6E",
      placeTouch: "\u8FBA\u3067\u63A5\u3059\u308B",
      placeTouchBody: "\u65B0\u3057\u3044\u30BF\u30A4\u30EB\u306F\u65E2\u5B58\u30BF\u30A4\u30EB\u3068\u5C11\u306A\u304F\u3068\u30821\u8FBA\u5168\u4F53\u3067\u63A5\u3059\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059\u3002\u89D2\u3060\u3051\u306F\u4E0D\u53EF\u3067\u3059\u3002",
      placeEdges: "\u8FBA\u306E\u4E00\u81F4",
      placeEdgesBody: "\u63A5\u3059\u308B\u8FBA\u306F\u7AEF\u304B\u3089\u7AEF\u307E\u3067\u4E00\u81F4\uFF1A\u90FD\u5E02\u2013\u90FD\u5E02\u3001\u9053\u2013\u9053\u3001\u7551\u2013\u7551\u3002",
      placeNoFlip: "\u88CF\u8FD4\u3057\u4E0D\u53EF",
      placeNoFlipBody: "\u56DE\u8EE2\u306E\u307F\u3002\u30BF\u30A4\u30EB\u306E\u93E1\u6620\u306F\u3057\u307E\u305B\u3093\u3002",
      placeOpen: "\u76E4\u9762\u306F\u81EA\u7531",
      placeOpenBody: "\u30DE\u30C3\u30D7\u306F\u3069\u306E\u65B9\u5411\u306B\u3082\u4F38\u3070\u305B\u307E\u3059\u3002",
      legalTitle: "\u5408\u6CD5",
      legalBody: "\u4E2D\u592E\u306F\u958B\u59CB\u30BF\u30A4\u30EB D\u3002\u5317\u306E\u90FD\u5E02\u306F 180\xB0 \u56DE\u8EE2\u306E E\u3001\u6771\u306E\u9053\u306F 90\xB0 \u56DE\u8EE2\u306E U\u3001\u5357\u306E\u7551\u306F V \u306E\u5317\u7551\u3068\u4E00\u81F4\u3002",
      illegalEdgesTitle: "\u9055\u6CD5 \u2014 \u8FBA\u304C\u4E0D\u4E00\u81F4",
      illegalEdgesBody: "D \u306E\u6771\u8FBA\u306F\u9053\u3001\u7121\u56DE\u8EE2\u306E E \u306E\u897F\u8FBA\u306F\u7551\u30021\u8FBA\u3067\u3082\u4E0D\u4E00\u81F4\u306A\u3089\u7F6E\u3051\u307E\u305B\u3093\u3002",
      illegalCornerTitle: "\u9055\u6CD5 \u2014 \u89D2\u3060\u3051",
      illegalCornerBody: "\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u308B\u30BF\u30A4\u30EB\u306F\u8FBA\u3092\u5171\u6709\u3057\u306A\u3044\u306E\u3067\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleTitle: "\u30DF\u30FC\u30D7\u30EB",
      meepleWhere: "\u7F6E\u304D\u5834\u6240",
      meepleWhereBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u4E0A\u306E\u307F\u3002\u307E\u3060\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u7551\u306E\u30DE\u30FC\u30AF\u3078\u3002",
      meepleOne: "\u4E00\u3064\u306E\u8981\u7D20",
      meepleOneBody: "\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u7551\u306E\u63A5\u7D9A\u9818\u57DF\u306B\u306F\u53C2\u52A0\u3067\u304D\u307E\u305B\u3093\u3002",
      meepleStock: "\u30B9\u30C8\u30C3\u30AF",
      meepleStockBody: "\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u3051\u308C\u3070\u914D\u7F6E\u3092\u30B9\u30AD\u30C3\u30D7\u3002\u8981\u7D20\u5B8C\u6210\u3067\u623B\u308B\uFF08\u6700\u7D42\u5F97\u70B9\u6642\u3092\u9664\u304F\uFF09\u3002",
      meepleSkip: "\u30B9\u30AD\u30C3\u30D7",
      meepleSkipBody: "\u30BF\u30A4\u30EB\u3060\u3051\u7F6E\u3044\u3066\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304B\u306A\u3044\u3053\u3068\u3082\u3067\u304D\u307E\u3059\u3002",
      scoreTitle: "\u30B2\u30FC\u30E0\u4E2D\u306E\u5F97\u70B9",
      scoreIntro: "\u8981\u7D20\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u306E\u4E0A\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u6700\u591A\u306E\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u5F97\u70B9\u3002\u540C\u6570\u306A\u3089\u5168\u54E1\u304C\u6E80\u70B9\u3092\u5F97\u3066\u3001\u30DF\u30FC\u30D7\u30EB\u306F\u30B9\u30C8\u30C3\u30AF\u3078\u623B\u308A\u307E\u3059\u3002",
      scoreFeature: "\u8981\u7D20",
      scoreComplete: "\u5B8C\u6210\u6642",
      scoreRoad: "\u9053",
      scoreRoadBody: "\u9053\u306E\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9",
      scoreCity: "\u90FD\u5E02",
      scoreCityBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D2\u70B9 + \u30DA\u30CA\u30F3\u30C8\uFF08\u65D7\uFF091\u3064\u306B\u3064\u304D2\u70B9",
      scoreMonastery: "\u4FEE\u9053\u9662",
      scoreMonasteryBody: "\u5468\u56F28\u30DE\u30B9\u304C\u57CB\u307E\u308B\u30689\u70B9",
      scoreField: "\u7551",
      scoreFieldBody: "\u30B2\u30FC\u30E0\u4E2D\u306F\u5F97\u70B9\u3057\u306A\u3044",
      endTitle: "\u30B2\u30FC\u30E0\u7D42\u4E86",
      endWhen: "\u3044\u3064",
      endWhenBody: "\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u5F8C\uFF08\u307E\u305F\u306F Exit \u3067\u9014\u4E2D\u7D42\u4E86\uFF09\u306B\u6700\u7D42\u5F97\u70B9\u3092\u884C\u3044\u307E\u3059\u3002",
      endRoads: "\u672A\u5B8C\u6210\u306E\u9053",
      endRoadsBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9\u3002",
      endCities: "\u672A\u5B8C\u6210\u306E\u90FD\u5E02",
      endCitiesBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 + \u30DA\u30CA\u30F3\u30C81\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endMonasteries: "\u672A\u5B8C\u6210\u306E\u4FEE\u9053\u9662",
      endMonasteriesBody: "3\xD73\uFF08\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u542B\u3080\uFF09\u306E\u57CB\u307E\u3063\u3066\u3044\u308B\u30DE\u30B91\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endFields: "\u7551",
      endFieldsBody: "\u8FB2\u6C11\u306F\u305D\u306E\u307E\u307E\u3002\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3002\u591A\u6570\u6C7A\u306F\u4E0A\u8A18\u3068\u540C\u3058\u3002",
      endMeeples: "\u30DF\u30FC\u30D7\u30EB",
      endMeeplesBody: "\u6700\u7D42\u5F97\u70B9\u3067\u306F\u30DF\u30FC\u30D7\u30EB\u306F\u623B\u308A\u307E\u305B\u3093\u3002+N \u8868\u793A\u3067\u5F97\u70B9\u3092\u793A\u3057\u307E\u3059\u3002",
      endTies: "\u540C\u70B9",
      endTiesBody: "\u540C\u70B9\u306A\u3089\u30B9\u30C8\u30C3\u30AF\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u591A\u3044\u65B9\u304C\u4E0A\u4F4D\u3002",
      controlsTitle: "\u64CD\u4F5C",
      controlsRotate: "\u56DE\u8EE2",
      controlsRotateBody: "\u76E4\u9762\u3092\u53F3\u30AF\u30EA\u30C3\u30AF\u3001\u30DD\u30A4\u30F3\u30BF\u304C\u76E4\u4E0A\u306E\u3068\u304D R\u3001\u307E\u305F\u306F\u624B\u5143\u30D7\u30EC\u30D3\u30E5\u30FC\uFF0F\u89D2\u5EA6\u30B5\u30E0\u3092\u30BF\u30C3\u30D7\u3002",
      controlsZoom: "\u30BA\u30FC\u30E0",
      controlsZoomBody: "\u30DB\u30A4\u30FC\u30EB\u307E\u305F\u306F\u30D4\u30F3\u30C1\u3002\u30C7\u30B9\u30AF\u30C8\u30C3\u30D7\u3067\u306F\u51E1\u4F8B\u306E\u30DC\u30BF\u30F3\u3082\u53EF\u3002",
      controlsPan: "\u30D1\u30F3",
      controlsPanBody: "\u76E4\u9762\u3092\u30C9\u30E9\u30C3\u30B0\u3002",
      controlsHints: "\u30D2\u30F3\u30C8",
      controlsHintsBody: "\u7DD1\uFF1D\u4ECA\u7F6E\u3051\u308B\u3002\u7070\uFF1D\u5225\u306E\u56DE\u8EE2\u304C\u5FC5\u8981\u3002",
      tileITitle: "\u30BF\u30A4\u30EB I \u306E\u5206\u96E2\u90FD\u5E02",
      tileIIntro: "\u30BF\u30A4\u30EB I \u306F\u89D2\u70B9\u3060\u3051\u3067\u63A5\u3059\u308B2\u3064\u306E\u90FD\u5E02\u304C\u3042\u308A\u307E\u3059\u3002\u305D\u308C\u305E\u308C\u304C\u8FBA\u5168\u4F53\u3067\u4ED6\u30BF\u30A4\u30EB\u3068\u7E4B\u304C\u3089\u306A\u3044\u9650\u308A\u5225\u7269\u306E\u307E\u307E\u3067\u3059\u3002",
      tileINorth: "\u5317\u306E\u90FD\u5E02\u3068\u63A5\u7D9A",
      tileINorthBody: "180\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u5317\u90FD\u5E02\u8FBA\u3068\u4E00\u81F4\u3002\u897F\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3002",
      tileIWest: "\u897F\u306E\u90FD\u5E02\u3068\u63A5\u7D9A",
      tileIWestBody: "90\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u897F\u90FD\u5E02\u8FBA\u3068\u4E00\u81F4\u3002\u5317\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3002",
      tileIBoth: "\u305D\u308C\u3067\u30822\u90FD\u5E02",
      tileIBothBody: "\u4E21\u5074\u304C\u57CB\u307E\u3063\u3066\u3082\u3001\u30BF\u30A4\u30EB\u5185\u306E\u7551\u3067\u90FD\u5E02\u306F\u5206\u304B\u308C\u307E\u3059\u30022\u679A\u306E E \u306E\u89D2\u63A5\u89E6\u3060\u3051\u3067\u306F\u5408\u4F75\u3057\u307E\u305B\u3093\u3002",
      tilesTitle: "\u30BF\u30A4\u30EB A\u2013X",
      tilesIntro: "\u30AF\u30E9\u30B7\u30C3\u30AF\u57FA\u672C\u30BB\u30C3\u30C8\u3068\u540C\u3058\u6587\u5B57\u30B3\u30FC\u30C9\u3068\u679A\u6570\u3002\u30AB\u30BF\u30ED\u30B0\u3067\u306F\u4E0A\u304C\u5317\u3002J \u3068 K \u306F\u93E1\u6620\u3067\u3001\u56DE\u8EE2\u3067\u306F\u4E92\u3044\u306B\u306A\u308A\u307E\u305B\u3093\u3002\u30DA\u30CA\u30F3\u30C8\u4ED8\u304D\u306F\u7121\u5370\u3068\u5206\u3051\u3066\u8A18\u8F09\u3002",
      legendField: "\u7551",
      legendRoad: "\u9053",
      legendCity: "\u90FD\u5E02",
      legendPennant: "\u30DA\u30CA\u30F3\u30C8",
      badgePennant: "\u30DA\u30CA\u30F3\u30C8",
      badgeStart: "1\u679A\u306F\u958B\u59CB",
      tileA: "\u4FEE\u9053\u9662 + \u9053",
      tileB: "\u4FEE\u9053\u9662",
      tileC: "\u56DB\u65B9\u90FD\u5E02",
      tileD: "\u90FD\u5E02 + \u76F4\u7DDA\u306E\u9053",
      tileE: "\u90FD\u5E021\u8FBA",
      tileF: "\u5BFE\u8FBA\u9023\u7D50\u90FD\u5E02",
      tileG: "\u5BFE\u8FBA\u9023\u7D50\u90FD\u5E02",
      tileGExtra: "F \u3068\u540C\u3058\u5F62\u3067\u30DA\u30CA\u30F3\u30C8\u306A\u3057\u3002",
      tileH: "\u5BFE\u8FBA\u5206\u96E2\u90FD\u5E02",
      tileI: "\u96A3\u8FBA\u5206\u96E2\u90FD\u5E02",
      tileJ: "\u90FD\u5E02 + \u53F3\u30AB\u30FC\u30D6",
      tileK: "\u90FD\u5E02 + \u5DE6\u30AB\u30FC\u30D6",
      tileL: "\u90FD\u5E02 + \u4E09\u53C9\u8DEF",
      tileM: "\u89D2\u90FD\u5E02",
      tileN: "\u89D2\u90FD\u5E02",
      tileO: "\u89D2\u90FD\u5E02 + \u9053",
      tileP: "\u89D2\u90FD\u5E02 + \u9053",
      tileQ: "\u4E09\u8FBA\u90FD\u5E02",
      tileR: "\u4E09\u8FBA\u90FD\u5E02",
      tileS: "\u4E09\u8FBA\u90FD\u5E02 + \u9580\u306E\u9053",
      tileT: "\u4E09\u8FBA\u90FD\u5E02 + \u9580\u306E\u9053",
      tileU: "\u76F4\u7DDA\u306E\u9053",
      tileV: "\u30AB\u30FC\u30D6",
      tileW: "\u4E09\u53C9\u8DEF",
      tileX: "\u5341\u5B57\u8DEF",
      edgesA: "\u5317\u7551 \xB7 \u6771\u7551 \xB7 \u5357\u9053 \xB7 \u897F\u7551",
      edgesB: "\u5168\u8FBA\u7551",
      edgesD: "\u5317\u90FD\u5E02 \xB7 \u6771\u9053 \xB7 \u5357\u7551 \xB7 \u897F\u9053",
      edgesE: "\u5317\u90FD\u5E02 \xB7 \u307B\u304B\u7551",
      rulesFoot: "Tile City \xB7 \u30D6\u30E9\u30A6\u30B6\u7248\u5411\u3051\u306B\u57FA\u672C\u30BB\u30C3\u30C8\u30EB\u30FC\u30EB\u3092\u518D\u69CB\u6210\u3002",
      canPlace: "\u7F6E\u3051\u308B",
      needsRotate: "\u8981\u56DE\u8EE2",
      rotHint: "\u53F3\u30AF\u30EA\u30C3\u30AF / R \u3067\u56DE\u8EE2 \xB7 \u30DB\u30A4\u30FC\u30EB\u3067\u30BA\u30FC\u30E0",
      zoomOut: "\u7E2E\u5C0F",
      zoomIn: "\u62E1\u5927",
      deck: "\u5C71\u672D",
      board: "\u76E4\u9762",
      discards: "\u6368\u3066\u672D",
      exit: "\u9000\u51FA",
      rank: "\u9806\u4F4D",
      again: "\u3082\u3046\u4E00\u5EA6",
      skip: "\u30B9\u30AD\u30C3\u30D7",
      ok: "OK",
      endGame: "\u7D42\u4E86",
      cancel: "\u30AD\u30E3\u30F3\u30BB\u30EB",
      boardView: "\u76E4\u9762",
      rotateTile: "\u30BF\u30A4\u30EB\u3092\u56DE\u8EE2",
      unplaceableTile: "\u7F6E\u3051\u306A\u3044\u30BF\u30A4\u30EB",
      placeMeeple: "\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F",
      undoPlace: "\u914D\u7F6E\u3092\u623B\u3059",
      noLegalPlace: "\u3053\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3051\u308B\u5834\u6240\u304C\u3042\u308A\u307E\u305B\u3093",
      endThisGame: "\u3053\u306E\u30B2\u30FC\u30E0\u3092\u7D42\u4E86\u3057\u307E\u3059\u304B\uFF1F",
      gameOver: "\u30B2\u30FC\u30E0\u7D42\u4E86",
      pickMeeple: "\u30DE\u30FC\u30AF\u3092\u9078\u3093\u3067\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F",
      noMeeplesLeft: "\u30DF\u30FC\u30D7\u30EB\u304C\u3042\u308A\u307E\u305B\u3093",
      noOpenSpot: "\u7F6E\u3051\u308B\u5834\u6240\u304C\u3042\u308A\u307E\u305B\u3093"
    }
  };
  function getLang() {
    try {
      const stored = localStorage.getItem(KEY);
      if (stored === "ja" || stored === "en") return stored;
    } catch (err) {
    }
    const nav = typeof navigator !== "undefined" && navigator.language || "en";
    return String(nav).toLowerCase().startsWith("ja") ? "ja" : "en";
  }
  function setLang(lang) {
    const next = lang === "ja" ? "ja" : "en";
    try {
      localStorage.setItem(KEY, next);
    } catch (err) {
    }
    return next;
  }
  function t(key, lang, vars) {
    const pack = dict[lang || getLang()] || dict.en;
    let text = pack[key] != null ? pack[key] : dict.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach((name) => {
        text = text.split("{" + name + "}").join(String(vars[name]));
      });
    }
    return text;
  }
  function colorLabel(id, lang) {
    const key = "color" + id.charAt(0).toUpperCase() + id.slice(1);
    return t(key, lang);
  }
  function apply(root) {
    const lang = getLang();
    const scope = root || document;
    if (typeof document !== "undefined" && document.documentElement) {
      document.documentElement.lang = lang;
    }
    scope.querySelectorAll("[data-i18n]").forEach((node) => {
      const key = node.getAttribute("data-i18n");
      if (!key) return;
      const attr = node.getAttribute("data-i18n-attr");
      const text = t(key, lang);
      if (attr) node.setAttribute(attr, text);
      else node.textContent = text;
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((node) => {
      node.setAttribute("aria-label", t(node.getAttribute("data-i18n-aria"), lang));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.getAttribute("data-i18n-title"), lang));
    });
    scope.querySelectorAll(".lang-bar [data-lang]").forEach((btn) => {
      btn.classList.toggle("on", btn.getAttribute("data-lang") === lang);
    });
    const bar = (root || document).querySelector(".lang-bar");
    if (bar) bar.setAttribute("aria-label", t("langLabel", lang));
    document.querySelectorAll(".volume-bar").forEach((node) => {
      node.setAttribute("aria-label", t("volumeLabel", lang));
    });
    return lang;
  }
  function bindLangBar(onChange) {
    document.querySelectorAll(".lang-bar [data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLang(btn.getAttribute("data-lang"));
        apply();
        if (typeof onChange === "function") onChange(getLang());
      });
    });
    apply();
  }
  var TileCityI18n = {
    KEY,
    dict,
    getLang,
    setLang,
    t,
    colorLabel,
    apply,
    bindLangBar
  };
  if (typeof globalThis !== "undefined") globalThis.TileCityI18n = TileCityI18n;
  var i18n_default = TileCityI18n;

  // js/play/storage.js
  var SETUP_KEY = "tile-city-setup";
  var SAVE_KEY = "tile-city-save";
  function loadRoster(Carcassonne2) {
    try {
      const raw = sessionStorage.getItem(SETUP_KEY);
      if (!raw) return null;
      return Carcassonne2.normalizePlayers(JSON.parse(raw));
    } catch (err) {
      return null;
    }
  }
  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (err) {
    }
  }
  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.game) return data;
      if (data && data.v) return { game: data, view: null };
      return null;
    } catch (err) {
      clearSave();
      return null;
    }
  }
  function loadSavedGame(Carcassonne2) {
    const save = readSave();
    if (!save) return null;
    const restored = Carcassonne2.restoreGame(save.game);
    if (!restored) {
      clearSave();
      return null;
    }
    return { game: restored, view: save.view || null };
  }
  function writeSave(Carcassonne2, game2, view, ready) {
    if (!ready) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        game: Carcassonne2.serializeGame(game2),
        view
      }));
    } catch (err) {
    }
  }

  // js/play/main.js
  var t2 = (key) => i18n_default.t(key);
  var playSound2 = (name) => audio_default.playSound(name);
  var playMeepleSound2 = (color) => audio_default.playMeepleSound(color);
  function scoresGained(before) {
    return game.scores.some((score, index) => score > (before[index] || 0));
  }
  var ZOOM_MIN = 0.35;
  var ZOOM_MAX = 1.6;
  var ZOOM_STEP = 0.05;
  var ZOOM_WHEEL = 0.025;
  var LEAVE_FX_MS = 2e3;
  var BOT_MOVE_MS = 450;
  var BOT_MEEPLE_MS = 380;
  var BOT_DISCARD_MS = 550;
  var TILE_TOTAL = game_default.TYPES.reduce((sum, type) => sum + type.count, 0);
  var exitConfirmOpen = false;
  var leaveFxTimer = null;
  var endFanfareStarted = false;
  var botTimer = null;
  var botBusy = false;
  function loadRoster2() {
    return loadRoster(game_default);
  }
  function loadSavedGame2() {
    return loadSavedGame(game_default);
  }
  var readyToPersist = false;
  function persistGame() {
    const box = document.getElementById("scroller");
    writeSave(game_default, game, {
      zoom: boardZoom,
      left: box ? box.scrollLeft : 0,
      top: box ? box.scrollTop : 0
    }, readyToPersist);
  }
  function restoreView(view) {
    if (!view) return;
    const zoom = Number(view.zoom);
    if (Number.isFinite(zoom)) {
      boardZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
      applyBoardZoom();
      syncBoardPadding();
    }
    const box = scroller();
    const left = Number(view.left);
    const top = Number(view.top);
    requestAnimationFrame(() => {
      void document.getElementById("grid").offsetWidth;
      if (Number.isFinite(left)) box.scrollLeft = left;
      if (Number.isFinite(top)) box.scrollTop = top;
      persistGame();
    });
  }
  var saved = loadSavedGame2();
  var roster = loadRoster2();
  if (!saved && !roster) {
    location.replace("setup.html");
    throw new Error("setup required");
  }
  var game = saved ? saved.game : game_default.createGame(void 0, roster);
  var pan = null;
  var skipClick = false;
  var boardZoom = 0.8;
  endFanfareStarted = !!game.finished;
  window.__game = game;
  function zoomPercent() {
    return Math.round(boardZoom * 100) + "%";
  }
  function applyBoardZoom() {
    document.documentElement.style.setProperty("--board-zoom", String(boardZoom));
    const label = document.getElementById("zoom-label");
    if (label) label.textContent = zoomPercent();
  }
  function gridPadBox(grid) {
    const style = getComputedStyle(grid);
    const left = parseFloat(style.paddingLeft) || 0;
    const top = parseFloat(style.paddingTop) || 0;
    const right = parseFloat(style.paddingRight) || 0;
    const bottom = parseFloat(style.paddingBottom) || 0;
    return {
      left,
      top,
      right,
      bottom,
      innerW: Math.max(0, grid.offsetWidth - left - right),
      innerH: Math.max(0, grid.offsetHeight - top - bottom)
    };
  }
  function syncBoardPadding() {
    const box = scroller();
    const grid = document.getElementById("grid");
    const padX = Math.max(1, Math.ceil(box.clientWidth));
    const padY = Math.max(1, Math.ceil(box.clientHeight));
    const before = gridPadBox(grid);
    if (before.left === padX && before.right === padX && before.top === padY && before.bottom === padY) {
      return;
    }
    const midX = box.scrollLeft + box.clientWidth / 2;
    const midY = box.scrollTop + box.clientHeight / 2;
    const boardX = midX - before.left;
    const boardY = midY - before.top;
    grid.style.padding = padY + "px " + padX + "px";
    void grid.offsetWidth;
    box.scrollLeft = padX + boardX - box.clientWidth / 2;
    box.scrollTop = padY + boardY - box.clientHeight / 2;
  }
  function mapZoomCoord(coord, padBefore, innerBefore, padAfter, innerAfter) {
    if (coord <= padBefore) return padAfter + (coord - padBefore);
    if (coord >= padBefore + innerBefore) {
      return padAfter + innerAfter + (coord - padBefore - innerBefore);
    }
    if (!(innerBefore > 0)) return padAfter;
    return padAfter + (coord - padBefore) * (innerAfter / innerBefore);
  }
  function setBoardZoom(next, pivot) {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 1e3) / 1e3));
    if (clamped === boardZoom) {
      applyBoardZoom();
      return;
    }
    const box = scroller();
    const grid = document.getElementById("grid");
    syncBoardPadding();
    const rect = box.getBoundingClientRect();
    const px = pivot ? pivot.x - rect.left : rect.width / 2;
    const py = pivot ? pivot.y - rect.top : rect.height / 2;
    const beforePad = gridPadBox(grid);
    const contentX = box.scrollLeft + px;
    const contentY = box.scrollTop + py;
    boardZoom = clamped;
    applyBoardZoom();
    void grid.offsetWidth;
    const afterPad = gridPadBox(grid);
    box.scrollLeft = mapZoomCoord(
      contentX,
      beforePad.left,
      beforePad.innerW,
      afterPad.left,
      afterPad.innerW
    ) - px;
    box.scrollTop = mapZoomCoord(
      contentY,
      beforePad.top,
      beforePad.innerH,
      afterPad.top,
      afterPad.innerH
    ) - py;
    persistGame();
  }
  function paintLegend() {
    const legend = document.getElementById("legend");
    legend.innerHTML = '<div class="hint-legend"><p><i class="swatch-key now"></i>' + t2("canPlace") + '</p><p><i class="swatch-key later"></i>' + t2("needsRotate") + '</p><div class="zoom-controls"><button type="button" class="zoom-btn" id="zoom-out" aria-label="' + t2("zoomOut") + '">\u2212</button><span class="zoom-label" id="zoom-label">' + zoomPercent() + '</span><button type="button" class="zoom-btn" id="zoom-in" aria-label="' + t2("zoomIn") + '">+</button></div></div><p class="rot-hint">' + t2("rotHint") + "</p>";
  }
  function activeSeat() {
    if (game.pendingMeeple) return game.pendingMeeple.player;
    return game.player;
  }
  function isBotSeat(index) {
    return game_default.isBotPlayer(game.players[index]);
  }
  function isBotTurn() {
    if (game.finished || exitConfirmOpen) return false;
    return isBotSeat(activeSeat());
  }
  function humanControlsLocked() {
    return isBotTurn() || botBusy;
  }
  function playersHTML() {
    const order = game.finished && game.standings ? game.standings : game.players.map((_, index) => index);
    return '<ul class="players">' + order.map((index) => {
      const player = game.players[index];
      const on = !game.finished && index === game.player ? " on" : "";
      const rank = game.finished ? '<span class="rank">' + (order.indexOf(index) + 1) + "</span>" : "";
      const bot = player.bot ? '<span class="bot-badge" title="' + t2("botThinking") + '">' + t2("botBadge") + "</span>" : "";
      return '<li class="' + player.id + on + (player.bot ? " bot" : "") + '">' + rank + '<span class="pname">' + player.name + bot + '</span><span class="meeple-count"><i class="meeple ' + player.id + '" aria-hidden="true"></i>\xD7' + game.meeples[index] + '</span><b class="score">' + game.scores[index] + "</b></li>";
    }).join("") + "</ul>";
  }
  function endActionsHTML(layout) {
    if (layout === "row") {
      return '<button type="button" class="quit-chip js-quit">' + t2("home") + '</button><button type="button" class="ranking-chip js-open-ranking">' + t2("rank") + '</button><button type="button" class="again-chip js-again">' + t2("again") + "</button>";
    }
    return '<button type="button" class="ranking-chip js-open-ranking">' + t2("rank") + '</button><div class="end-actions"><button type="button" class="quit-chip js-quit">' + t2("home") + '</button><button type="button" class="again-chip js-again">' + t2("again") + "</button></div>";
  }
  function statsHTML() {
    const exitTop = game.finished ? "" : '<button type="button" class="exit-chip js-exit">' + t2("exit") + "</button>";
    return '<div class="meters"><div><span>' + t2("deck") + "</span><b>" + game.deck.length + "</b></div><div><span>" + t2("board") + "</span><b>" + game.board.size + "</b></div><div><span>" + t2("discards") + "</span><b>" + game.discards.length + '</b></div></div><div class="hud-meta">' + exitTop + '<div class="deck-short"><span class="deck-chip">' + t2("deck") + " " + game.deck.length + '</span><span class="deck-chip">' + t2("board") + " " + game.board.size + "/" + TILE_TOTAL + '</span><span class="deck-chip">' + t2("discards") + " " + game.discards.length + "</span></div></div>";
  }
  function handHTML() {
    if (game.finished) {
      if (!game.rankingOpen) {
        return '<div class="hand ranking-hand">' + endActionsHTML("row") + "</div>";
      }
      return "";
    }
    if (!game.current) return "";
    if (game.pendingDiscard) {
      return '<div class="hand discard-only"><div class="preview" aria-label="' + t2("unplaceableTile") + '"><span class="preview-frame">' + game_default.tileHTML(game.current.id, 0) + "</span></div></div>";
    }
    if (humanControlsLocked()) {
      return '<div class="hand bot-hand"><div class="preview" aria-label="' + t2("botThinking") + '"><span class="preview-frame">' + game_default.tileHTML(game.current.id, game.rotation) + '</span></div><p class="bot-status">' + t2("botThinking") + "</p></div>";
    }
    const counts = game.rotationCounts();
    const thumbs = [0, 1, 2, 3].map((rot) => {
      const on = rot === game.rotation ? " on" : "";
      const able = counts[rot] ? " able" : "";
      return '<button type="button" class="thumb' + on + able + '" data-set-rot="' + rot + '" aria-pressed="' + (rot === game.rotation) + '"><span class="mini"><span class="scaler">' + game_default.tileHTML(game.current.id, rot) + '</span></span><span class="deg">' + rot * 90 + "\xB0</span></button>";
    }).join("");
    return '<div class="hand"><button type="button" class="preview" data-rotate="1" aria-label="' + t2("rotateTile") + '"><span class="preview-frame">' + game_default.tileHTML(game.current.id, game.rotation) + '</span></button><div class="rots">' + thumbs + "</div></div>";
  }
  function footHTML() {
    if (game.finished && !game.rankingOpen) return endActionsHTML("stack");
    if (game.finished) return "";
    return '<button type="button" class="exit-chip js-exit">' + t2("exit") + "</button>";
  }
  function meeplePinHTML(pin, leaving) {
    const fieldClass = pin.kind === "field" ? " field-meeple" : "";
    const earned = pin.earned ? '<span class="meeple-earned">+' + pin.earned + "</span>" : "";
    return '<span class="meeple-pin' + (leaving ? " leaving" : "") + '" style="left:' + pin.x * 100 + "%;top:" + pin.y * 100 + '%"><i class="meeple on-tile ' + pin.color + fieldClass + '" aria-hidden="true"></i>' + earned + "</span>";
  }
  function meepleMarksHTML(tile, pending) {
    const marks = [];
    if (tile.meeple) marks.push(meeplePinHTML(tile.meeple, false));
    if (tile.leaveFx) marks.push(meeplePinHTML(tile.leaveFx, true));
    if (!pending) return marks.join("");
    if (humanControlsLocked()) {
      marks.push('<div class="meeple-layer bot-meeple"><p class="meeple-prompt">' + t2("botThinking") + "</p></div>");
      return marks.join("");
    }
    const color = game.players[game.pendingMeeple.player].id;
    const slots = game.meepleSlots();
    const spots = slots.map(
      (slot) => '<button type="button" class="meeple-spot spot-' + slot.kind + '" data-meeple-slot="' + slot.id + '" style="left:' + slot.x * 100 + "%;top:" + slot.y * 100 + '%" aria-label="' + t2("placeMeeple") + '"><i class="meeple ' + color + '" aria-hidden="true"></i></button>'
    ).join("");
    const stock = game.meeples[game.pendingMeeple.player];
    const prompt = slots.length ? t2("pickMeeple") : stock <= 0 ? t2("noMeeplesLeft") : t2("noOpenSpot");
    marks.push(
      '<div class="meeple-layer"><p class="meeple-prompt">' + prompt + "</p>" + spots + '<div class="meeple-actions"><button type="button" id="undo-place" aria-label="' + t2("undoPlace") + '" title="' + t2("undoPlace") + '"><svg class="undo-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.5 8C9.85 8 7.45 9 5.6 10.6L2 7v9h9l-3.62-3.62C8.77 11.22 10.54 10.5 12.5 10.5c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg></button><button type="button" id="skip-meeple">' + t2("skip") + "</button></div></div>"
    );
    return marks.join("");
  }
  function rankingHTML() {
    const order = game.standings || game.players.map((_, index) => index);
    const rows = order.map((index, rank) => {
      const player = game.players[index];
      return '<li><span class="rank-num">' + (rank + 1) + '</span><span class="rank-name ' + player.id + '">' + player.name + '</span><b class="rank-score">' + game.scores[index] + "</b></li>";
    }).join("");
    return '<ul class="ranking-list">' + rows + "</ul>";
  }
  function paintDiscardOverlay() {
    const overlay = document.getElementById("discard-overlay");
    const card = document.getElementById("overlay-card");
    const message = document.getElementById("overlay-message");
    const rankingRoot = document.getElementById("ranking-root");
    const rankingActions = document.getElementById("ranking-actions");
    const actions = document.getElementById("overlay-actions");
    const ok = document.getElementById("ok-discard");
    const confirmExit = document.getElementById("confirm-exit");
    const cancelExit = document.getElementById("cancel-exit");
    const minimize = document.getElementById("minimize-ranking");
    function showActions(mode) {
      ok.hidden = mode !== "discard";
      confirmExit.hidden = mode !== "exit";
      cancelExit.hidden = mode !== "exit";
      actions.hidden = mode === "ranking";
      rankingActions.hidden = mode !== "ranking";
      minimize.hidden = mode !== "ranking";
      card.classList.toggle("ranking-open", mode === "ranking");
      card.classList.toggle("exit-open", mode === "exit");
    }
    if (game.pendingDiscard) {
      exitConfirmOpen = false;
      overlay.hidden = false;
      message.hidden = false;
      message.textContent = t2("noLegalPlace");
      rankingRoot.hidden = true;
      rankingRoot.innerHTML = "";
      showActions("discard");
      return;
    }
    if (exitConfirmOpen && !game.finished) {
      overlay.hidden = false;
      message.hidden = false;
      message.textContent = t2("endThisGame");
      rankingRoot.hidden = true;
      rankingRoot.innerHTML = "";
      showActions("exit");
      return;
    }
    if (game.finished && game.rankingOpen) {
      exitConfirmOpen = false;
      overlay.hidden = false;
      message.hidden = false;
      message.textContent = t2("gameOver");
      rankingRoot.hidden = false;
      rankingRoot.innerHTML = rankingHTML();
      showActions("ranking");
      return;
    }
    exitConfirmOpen = false;
    overlay.hidden = true;
    rankingRoot.hidden = true;
    rankingRoot.innerHTML = "";
    showActions("discard");
  }
  function paintSide() {
    document.getElementById("players-root").innerHTML = playersHTML();
    document.getElementById("stats-root").innerHTML = statsHTML();
    document.getElementById("hand-root").innerHTML = handHTML();
    document.getElementById("foot-root").innerHTML = footHTML();
    paintDiscardOverlay();
    paintLegend();
  }
  function paintGrid() {
    const bounds = game.bounds(1);
    const lockHints = game.pendingMeeple || game.pendingDiscard || exitConfirmOpen || humanControlsLocked();
    const hints = lockHints ? { now: [], later: [] } : game.hints();
    const now = new Set(hints.now.map((cell) => cell.x + "," + cell.y));
    const later = new Map(hints.later.map((cell) => [cell.x + "," + cell.y, cell.rots]));
    const pendingKey = game.pendingMeeple ? game.pendingMeeple.x + "," + game.pendingMeeple.y : null;
    const cols = bounds.maxX - bounds.minX + 1;
    const grid = document.getElementById("grid");
    grid.style.gridTemplateColumns = "repeat(" + cols + ", var(--cell))";
    grid.style.setProperty("--sand-min-x", String(bounds.minX));
    grid.style.setProperty("--sand-min-y", String(bounds.minY));
    const parts = [];
    for (let y = bounds.minY; y <= bounds.maxY; y++) {
      for (let x = bounds.minX; x <= bounds.maxX; x++) {
        const pos = x + "," + y;
        const tile = game.board.get(pos);
        if (tile) {
          const owner = tile.owner ? " owner-" + tile.owner : "";
          const recent = tile.owner && game.lastPlacedBy[tile.owner] === pos ? " recent" : "";
          const pending = pendingKey === pos;
          parts.push(
            '<div class="slot filled' + owner + recent + (pending ? " meeple-target" : "") + '" data-pos="' + pos + '"><div class="scaler">' + game_default.tileHTML(tile.id, tile.rot) + "</div>" + meepleMarksHTML(tile, pending) + "</div>"
          );
          continue;
        }
        if (now.has(pos)) {
          parts.push(
            '<button type="button" class="slot empty hint-now" data-pos="' + pos + '" data-place="' + pos + '" data-preview-rot="' + game.rotation + '" aria-label="Can place"></button>'
          );
          continue;
        }
        if (later.has(pos)) {
          parts.push(
            '<div class="slot empty hint-rot" data-pos="' + pos + '" data-preview-rot="' + game.rotation + '"></div>'
          );
          continue;
        }
        parts.push('<div class="slot empty" data-pos="' + pos + '"></div>');
      }
    }
    grid.innerHTML = parts.join("");
  }
  function scroller() {
    return document.getElementById("scroller");
  }
  function captureAnchor() {
    const slots = document.querySelectorAll("#grid [data-pos]");
    if (!slots.length) return null;
    const frame = scroller().getBoundingClientRect();
    const cx = frame.left + frame.width / 2;
    const cy = frame.top + frame.height / 2;
    let best = null;
    let bestD = Infinity;
    slots.forEach((el) => {
      const rect2 = el.getBoundingClientRect();
      const dist = (rect2.left + rect2.width / 2 - cx) ** 2 + (rect2.top + rect2.height / 2 - cy) ** 2;
      if (dist < bestD) {
        bestD = dist;
        best = el;
      }
    });
    const rect = best.getBoundingClientRect();
    return {
      pos: best.dataset.pos,
      dx: rect.left + rect.width / 2 - cx,
      dy: rect.top + rect.height / 2 - cy
    };
  }
  function centerOn(pos) {
    const el = document.querySelector('#grid [data-pos="' + pos + '"]');
    if (!el) return;
    const frame = scroller().getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const box = scroller();
    box.scrollLeft += rect.left + rect.width / 2 - (frame.left + frame.width / 2);
    box.scrollTop += rect.top + rect.height / 2 - (frame.top + frame.height / 2);
  }
  function restoreAnchor(anchor) {
    const el = document.querySelector('#grid [data-pos="' + anchor.pos + '"]');
    if (!el) return;
    const frame = scroller().getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const box = scroller();
    box.scrollLeft += rect.left + rect.width / 2 - (frame.left + frame.width / 2) - anchor.dx;
    box.scrollTop += rect.top + rect.height / 2 - (frame.top + frame.height / 2) - anchor.dy;
  }
  function showGhost(slot) {
    if (!slot || slot.querySelector(".ghost") || !game.current || game.pendingDiscard) return;
    const ok = slot.classList.contains("hint-now");
    const blocked = slot.classList.contains("hint-rot");
    if (!ok && !blocked) return;
    const ghost = document.createElement("div");
    ghost.className = ok ? "ghost" : "ghost invalid";
    ghost.innerHTML = '<div class="scaler">' + game_default.tileHTML(game.current.id, game.rotation) + "</div>";
    slot.appendChild(ghost);
  }
  function rotateClockwise() {
    if (humanControlsLocked()) return;
    if (game.finished || game.pendingMeeple || game.pendingDiscard || !game.current) return;
    game.rotate(1);
    render({ keep: true });
  }
  function clearBotTimer() {
    if (botTimer != null) {
      clearTimeout(botTimer);
      botTimer = null;
    }
  }
  function scheduleBot(delay) {
    clearBotTimer();
    if (!isBotTurn() || game.finished) {
      botBusy = false;
      return;
    }
    botBusy = true;
    botTimer = setTimeout(runBotStep, delay == null ? BOT_MOVE_MS : delay);
  }
  function finishBotMeeple(slotId) {
    const before = game.scores.slice();
    const color = game.players[game.pendingMeeple.player].id;
    let ok = false;
    if (slotId) {
      ok = game.placeMeeple(slotId);
      if (ok) playMeepleSound2(color);
    } else {
      ok = game.skipMeeple();
    }
    if (!ok && game.pendingMeeple) ok = game.skipMeeple();
    if (ok && scoresGained(before)) playSound2("point");
    botBusy = false;
    render({ keep: true, center: game.lastPlacedBy[color] || void 0 });
  }
  function runBotStep() {
    botTimer = null;
    if (!isBotTurn() || game.finished) {
      botBusy = false;
      return;
    }
    const seat = activeSeat();
    const strength = game.players[seat].botStrength || "standard";
    const action = game_default.chooseBotAction(game, strength);
    if (!action) {
      botBusy = false;
      return;
    }
    if (action.type === "discard") {
      if (game.acknowledgeDiscard()) {
        botBusy = false;
        render({ keep: true });
      } else {
        botBusy = false;
      }
      return;
    }
    if (action.type === "meeple") {
      finishBotMeeple(action.slotId);
      return;
    }
    if (action.type === "place") {
      game.setRotation(action.rot);
      if (!game.place(action.x, action.y)) {
        botBusy = false;
        render({ keep: true });
        return;
      }
      playSound2("tile");
      const center = action.x + "," + action.y;
      render({ keep: true, center });
      clearBotTimer();
      botBusy = true;
      botTimer = setTimeout(() => finishBotMeeple(action.slotId), BOT_MEEPLE_MS);
    }
  }
  function applyHandRotation(button) {
    if (!button) return false;
    if (button.dataset.rotate != null) {
      rotateClockwise();
      return true;
    }
    if (button.dataset.setRot != null) {
      game.setRotation(Number(button.dataset.setRot));
      render({ keep: true });
      return true;
    }
    return false;
  }
  function firstPlaceColors() {
    const order = game.standings || [];
    if (!order.length) return [];
    const top = game.scores[order[0]];
    const colors = [];
    for (const index of order) {
      if (game.scores[index] !== top) break;
      colors.push(game.players[index].id);
    }
    return colors;
  }
  function armLeaveFxClear() {
    let has = false;
    for (const tile of game.board.values()) {
      if (tile.leaveFx) {
        has = true;
        break;
      }
    }
    if (!has) return;
    clearTimeout(leaveFxTimer);
    leaveFxTimer = setTimeout(() => {
      for (const tile of game.board.values()) tile.leaveFx = null;
      document.querySelectorAll(".meeple-pin.leaving").forEach((el) => el.remove());
    }, LEAVE_FX_MS);
  }
  function maybePlayEndFanfare() {
    if (!game.finished || endFanfareStarted) return;
    endFanfareStarted = true;
    void audio_default.playEndFanfare(firstPlaceColors());
  }
  function render(opts) {
    opts = opts || {};
    game.reconcileHand();
    const anchor = opts.keep ? captureAnchor() : null;
    paintSide();
    paintGrid();
    persistGame();
    armLeaveFxClear();
    maybePlayEndFanfare();
    if (opts.center) requestAnimationFrame(() => centerOn(opts.center));
    else if (anchor) restoreAnchor(anchor);
    if (opts.skipBot) return;
    if (isBotTurn()) {
      const delay = game.pendingDiscard ? BOT_DISCARD_MS : BOT_MOVE_MS;
      scheduleBot(delay);
    } else {
      botBusy = false;
      clearBotTimer();
    }
  }
  document.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest(".slot")) event.preventDefault();
    if (!event.target.closest("#scroller")) return;
    pan = {
      x: event.clientX,
      y: event.clientY,
      left: scroller().scrollLeft,
      top: scroller().scrollTop,
      moved: false
    };
    scroller().classList.add("dragging");
  });
  document.addEventListener("mousemove", (event) => {
    if (!pan) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.moved = true;
    if (!pan.moved) return;
    scroller().scrollLeft = pan.left - dx;
    scroller().scrollTop = pan.top - dy;
  });
  document.addEventListener("mouseup", () => {
    if (!pan) return;
    if (pan.moved) {
      skipClick = true;
      setTimeout(() => {
        skipClick = false;
      }, 0);
      persistGame();
    }
    pan = null;
    scroller().classList.remove("dragging");
  });
  document.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (event.button !== 0 && event.button !== -1) return;
    if (humanControlsLocked()) return;
    const button = event.target.closest("button[data-rotate], button[data-set-rot]");
    if (!button) return;
    event.preventDefault();
    applyHandRotation(button);
  });
  document.addEventListener("click", (event) => {
    if (skipClick) {
      skipClick = false;
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.id === "zoom-in") {
      setBoardZoom(boardZoom + ZOOM_STEP);
      return;
    }
    if (button.id === "zoom-out") {
      setBoardZoom(boardZoom - ZOOM_STEP);
      return;
    }
    if (button.id === "ok-discard") {
      if (humanControlsLocked()) return;
      if (game.acknowledgeDiscard()) render({ keep: true });
      return;
    }
    if (button.id === "minimize-ranking") {
      game.rankingOpen = false;
      render({ keep: true });
      return;
    }
    if (button.classList.contains("js-open-ranking")) {
      game.rankingOpen = true;
      exitConfirmOpen = false;
      render({ keep: true });
      return;
    }
    if (button.classList.contains("js-exit")) {
      exitConfirmOpen = true;
      render({ keep: true });
      return;
    }
    if (button.id === "cancel-exit") {
      exitConfirmOpen = false;
      render({ keep: true });
      return;
    }
    if (button.id === "confirm-exit") {
      exitConfirmOpen = false;
      game.finishGame();
      render({ keep: true });
      return;
    }
    if (button.classList.contains("js-again") || button.id === "again-game") {
      clearSave();
      location.href = "setup.html";
      return;
    }
    if (button.classList.contains("js-quit") || button.id === "end-game") {
      clearSave();
      location.href = "index.html";
      return;
    }
    if (button.id === "skip-meeple") {
      if (humanControlsLocked()) return;
      const before = game.scores.slice();
      if (game.skipMeeple()) {
        if (scoresGained(before)) playSound2("point");
        render({ keep: true });
      }
      return;
    }
    if (button.id === "undo-place") {
      if (humanControlsLocked()) return;
      if (game.undoPlace()) render({ keep: true });
      return;
    }
    if (button.dataset.meepleSlot) {
      if (humanControlsLocked()) return;
      const before = game.scores.slice();
      const color = game.players[game.pendingMeeple.player].id;
      if (game.placeMeeple(button.dataset.meepleSlot)) {
        playMeepleSound2(color);
        if (scoresGained(before)) playSound2("point");
        render({ keep: true });
      }
      return;
    }
    if (humanControlsLocked()) return;
    if (applyHandRotation(button)) return;
    if (button.dataset.place) {
      const parts = button.dataset.place.split(",").map(Number);
      if (game.place(parts[0], parts[1])) {
        playSound2("tile");
        render({ keep: true });
      }
    }
  });
  var pointerOnBoard = false;
  document.getElementById("scroller").addEventListener("pointerenter", () => {
    pointerOnBoard = true;
  });
  document.getElementById("scroller").addEventListener("pointerleave", () => {
    pointerOnBoard = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (humanControlsLocked()) return;
    if (game.pendingDiscard && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      if (game.acknowledgeDiscard()) render({ keep: true });
      return;
    }
    if (event.key === "r" || event.key === "R") {
      if (!pointerOnBoard || game.pendingDiscard) return;
      event.preventDefault();
      rotateClockwise();
    }
  });
  document.addEventListener("contextmenu", (event) => {
    if (!event.target.closest("#scroller")) return;
    if (humanControlsLocked()) return;
    if (game.finished || game.pendingMeeple || game.pendingDiscard || !game.current) return;
    event.preventDefault();
    rotateClockwise();
  });
  document.getElementById("scroller").addEventListener("wheel", (event) => {
    event.preventDefault();
    const steps = Math.max(1, Math.min(3, Math.round(Math.abs(event.deltaY) / 100)));
    const delta = (event.deltaY > 0 ? -ZOOM_WHEEL : ZOOM_WHEEL) * steps;
    setBoardZoom(boardZoom + delta, { x: event.clientX, y: event.clientY });
  }, { passive: false });
  var pinch = null;
  function pinchDistance(touches) {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.hypot(dx, dy);
  }
  function pinchMidpoint(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }
  function midpointOverScroller(mid) {
    const box = scroller().getBoundingClientRect();
    return mid.x >= box.left && mid.x <= box.right && mid.y >= box.top && mid.y <= box.bottom;
  }
  document.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 2) {
      if (event.touches.length < 2) pinch = null;
      return;
    }
    const mid = pinchMidpoint(event.touches);
    if (!midpointOverScroller(mid)) {
      pinch = null;
      return;
    }
    pinch = {
      dist: pinchDistance(event.touches),
      zoom: boardZoom
    };
  }, { passive: true });
  document.addEventListener("touchmove", (event) => {
    if (!pinch || event.touches.length !== 2) return;
    const dist = pinchDistance(event.touches);
    if (!(pinch.dist > 0) || !(dist > 0)) return;
    event.preventDefault();
    setBoardZoom(pinch.zoom * (dist / pinch.dist), pinchMidpoint(event.touches));
  }, { passive: false });
  document.addEventListener("touchend", (event) => {
    if (event.touches.length < 2) pinch = null;
  }, { passive: true });
  document.addEventListener("touchcancel", () => {
    pinch = null;
  }, { passive: true });
  document.addEventListener("gesturestart", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("gesturechange", (event) => event.preventDefault(), { passive: false });
  document.addEventListener("mouseover", (event) => {
    showGhost(event.target.closest("[data-preview-rot]"));
  });
  document.addEventListener("mouseout", (event) => {
    const slot = event.target.closest("[data-preview-rot]");
    if (!slot || slot.contains(event.relatedTarget)) return;
    const ghost = slot.querySelector(".ghost");
    if (ghost) ghost.remove();
  });
  document.addEventListener("focusin", (event) => {
    showGhost(event.target.closest("[data-preview-rot]"));
  });
  applyBoardZoom();
  syncBoardPadding();
  i18n_default.apply();
  readyToPersist = true;
  if (saved) {
    render({ keep: true });
    restoreView(saved.view);
  } else {
    render({ center: "0,0" });
  }
  window.addEventListener("resize", () => {
    syncBoardPadding();
  });
  window.addEventListener("pagehide", () => {
    persistGame();
  });
})();
