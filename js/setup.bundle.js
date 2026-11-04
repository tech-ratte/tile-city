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
  var audioCtx = null;
  var buffers = /* @__PURE__ */ new Map();
  var loading = /* @__PURE__ */ new Map();
  var unlockArmed = false;
  var unlocked = false;
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
  function AudioContextCtor() {
    return window.AudioContext || window.webkitAudioContext || null;
  }
  function getCtx() {
    const Ctor = AudioContextCtor();
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    return audioCtx;
  }
  async function resumeCtx() {
    const ctx = getCtx();
    if (!ctx) return null;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch (err) {
      }
    }
    return ctx;
  }
  function loadBuffer(src) {
    if (buffers.has(src)) return Promise.resolve(buffers.get(src));
    if (loading.has(src)) return loading.get(src);
    const task = (async () => {
      const ctx = await resumeCtx();
      if (!ctx) return null;
      const res = await fetch(src);
      if (!res.ok) throw new Error("audio fetch failed");
      const raw = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(raw.slice(0));
      buffers.set(src, buf);
      return buf;
    })().catch(() => {
      loading.delete(src);
      return null;
    });
    loading.set(src, task);
    return task;
  }
  function playBuffer(buf, ctx) {
    return new Promise((resolve) => {
      try {
        if (ctx.state !== "running") {
          resolve({ ok: false, mode: "web-audio", reason: "ctx-" + ctx.state });
          return;
        }
        const gain = ctx.createGain();
        gain.gain.value = volume;
        gain.connect(ctx.destination);
        const node = ctx.createBufferSource();
        node.buffer = buf;
        node.connect(gain);
        node.onended = () => resolve({ ok: true, mode: "web-audio", ctxState: ctx.state });
        node.start(0);
      } catch (err) {
        resolve({ ok: false, mode: "web-audio", reason: String(err) });
      }
    });
  }
  function playHtmlFallback(src) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
      try {
        const audio = new Audio(src);
        audio.volume = volume;
        audio.addEventListener("error", () => finish({ ok: false, mode: "html-fallback", reason: "element-error" }), { once: true });
        void audio.play().then(
          () => finish({ ok: true, mode: "html-fallback", started: true }),
          (err) => finish({
            ok: false,
            mode: "html-fallback",
            reason: err && err.name ? err.name : String(err)
          })
        );
      } catch (err) {
        finish({ ok: false, mode: "html-fallback", reason: String(err) });
      }
    });
  }
  function playSrcAsync(src) {
    return (async () => {
      if (!(volume > 0) || !src) return { ok: false, reason: "muted-or-empty" };
      const ctx = await resumeCtx();
      if (ctx) {
        const buf = await loadBuffer(src);
        if (buf) {
          const web = await playBuffer(buf, ctx);
          if (web.ok) return web;
        }
      }
      return playHtmlFallback(src);
    })();
  }
  function playSrc(src) {
    if (!(volume > 0) || !src) return;
    void playSrcAsync(src);
  }
  function warmCommon() {
    void loadBuffer(SOUNDS.tile);
    void loadBuffer(SOUNDS.point);
    void loadBuffer(SOUNDS.clear);
  }
  function unlockAudio() {
    if (unlocked) {
      void resumeCtx();
      return;
    }
    unlocked = true;
    void resumeCtx().then(() => warmCommon());
  }
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;
    const kick = () => unlockAudio();
    for (const evt of ["pointerdown", "touchstart", "keydown", "click"]) {
      document.addEventListener(evt, kick, { capture: true, passive: true });
    }
  }
  function playSound(name) {
    unlockAudio();
    playSrc(SOUNDS[name]);
  }
  function playSoundAsync(name) {
    unlockAudio();
    const src = SOUNDS[name];
    if (!src) return Promise.resolve({ ok: false, reason: "unknown-sound" });
    if (!(volume > 0)) return Promise.resolve({ ok: false, reason: "muted" });
    return playSrcAsync(src).then((result) => Object.assign({
      buffered: buffers.has(src),
      ctxState: getCtx() ? getCtx().state : null
    }, result || { ok: false, reason: "no-result" }));
  }
  function getAudioDebugState() {
    const ctx = getCtx();
    return {
      unlocked,
      volume,
      ctxState: ctx ? ctx.state : null,
      bufferCount: buffers.size,
      buffered: [...buffers.keys()]
    };
  }
  function playMeepleSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    unlockAudio();
    const n = 1 + Math.floor(Math.random() * 3);
    playSrc("assets/sound/meeple/" + color + "/" + color + n + ".mp3");
  }
  function playWinSound(color) {
    if (!MEEPLE_COLORS.includes(color)) return;
    unlockAudio();
    playSrc("assets/sound/win/" + color + ".mp3");
  }
  async function playEndFanfare(colors) {
    unlockAudio();
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
    armUnlock();
    syncVolumeInputs();
    document.querySelectorAll(".volume-range").forEach((input) => {
      input.addEventListener("input", () => {
        setVolume(Number(input.value) / 100);
        unlockAudio();
      });
    });
  }
  armUnlock();
  var TileCityAudio = {
    getVolume,
    setVolume,
    playSound,
    playSoundAsync,
    playMeepleSound,
    playWinSound,
    playEndFanfare,
    bindVolumeBar,
    unlockAudio,
    getAudioDebugState
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
    let max2 = 0;
    for (const player of list || []) {
      const match = String(player && player.name != null ? player.name : "").match(/^Player(\d+)$/i);
      if (!match) continue;
      const n = Number(match[1]);
      if (n > max2) max2 = n;
    }
    return "Player" + (max2 + 1);
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
  function awardPoints(game, players2, points) {
    for (const player of players2) game.scores[player] += points;
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
  function scoreFeature(game, kind, parts, points, options2) {
    const opts = options2 || {};
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
  function blendCornerInherit(palette2, edges, seeds, part, tileRot, edgeDirs, kind) {
    if (kind && kind !== "city") return null;
    if (!isElbowDirs(edgeDirs)) return null;
    const blendEdges = edges.filter(
      (edge) => edge.blend && edge.colors && edge.colors.length === 2
    );
    const solidEdges = edges.filter((edge) => edge.color);
    const inherited = blendEdges.find(
      (edge) => edge.colors.every((color) => palette2.indexOf(color) >= 0)
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
    const palette2 = pickBlendPalette(expanded, edges, seeds, part, dirs);
    const poles = polesFromEdges(edges, seeds, part);
    const cornerEarly = blendCornerInherit(palette2, edges, seeds, part, tileRot, dirs, kind);
    if (cornerEarly) return cornerEarly;
    if (palette2.length === 2) {
      const colorA = palette2[0];
      const colorB = palette2[1];
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
    for (const color of palette2) {
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
      return blendFromSeeds(palette2[0], palette2[1] || palette2[0], seeds, part, tileRot);
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
    const players2 = game.players || [];
    const playerCount = players2.length;
    function paint2(kind, parts) {
      const counts = meepleCountsOnFeature(board, kind, parts, playerCount);
      const winners = majorityPlayers(counts);
      if (!winners.length) return;
      const winnerSet = new Set(winners);
      const colors = winners.map((index) => players2[index].id);
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
        const color = players2[m.player].id;
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
        paint2("city", result.parts);
      });
      (tile.roads || []).forEach((_, index) => {
        const id = "road:" + x + "," + y + "," + index;
        if (seen.has(id)) return;
        const result = collectRoadComponent(board, x, y, index);
        for (const part of result.parts) seen.add("road:" + part.x + "," + part.y + "," + part.index);
        paint2("road", result.parts);
      });
      if (tile.monastery) {
        const id = "monastery:" + x + "," + y;
        if (!seen.has(id)) {
          seen.add(id);
          paint2("monastery", [{ x, y, index: null }]);
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
  function claimColorEnabled(options2, feat) {
    const key = featColorOptionKey(feat);
    if (!key) return true;
    const opts = normalizeGameOptions(options2);
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
    constructor(deck, players2, options2) {
      this.players = normalizePlayers(players2);
      this.options = normalizeGameOptions(options2);
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
      this.pendingConfirm = null;
      this.pendingDiscard = false;
      this.standings = this.players.map((_, index) => index);
      this.finalScored = false;
      this.rankingOpen = false;
    }
    /** Humans confirm with OK; bots finish the turn immediately. */
    seatNeedsConfirm(index) {
      const player = this.players[index];
      return !!(player && !player.bot);
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
      if (this.finished || this.pendingMeeple || this.pendingConfirm) return false;
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
      this.pendingConfirm = null;
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
      if (this.finished || this.pendingMeeple || this.pendingConfirm || this.pendingDiscard || !this.current) return;
      this.rotation = (this.rotation + delta % 4 + 4) % 4;
    }
    setRotation(rot) {
      if (this.finished || this.pendingMeeple || this.pendingConfirm || this.pendingDiscard || !this.current) return;
      this.rotation = (rot % 4 + 4) % 4;
    }
    place(x, y) {
      if (this.finished || this.pendingMeeple || this.pendingConfirm || this.pendingDiscard || !this.current) return false;
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
      if (!this.pendingMeeple || this.pendingConfirm) return false;
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
      if (this.seatNeedsConfirm(player)) {
        this.beginConfirm(this.pendingMeeple, true);
        return true;
      }
      this.finishMeeplePhase();
      return true;
    }
    skipMeeple() {
      if (!this.pendingMeeple || this.pendingConfirm) return false;
      this.finishMeeplePhase();
      return true;
    }
    beginConfirm(pending, placedMeeple) {
      this.pendingConfirm = {
        x: pending.x,
        y: pending.y,
        player: pending.player,
        prevLastPlaced: pending.prevLastPlaced,
        placedMeeple: !!placedMeeple
      };
      this.pendingMeeple = null;
    }
    /** Human OK: end turn after meeple, or end without meeple from the pick phase. */
    confirmTurnEnd() {
      if (this.pendingConfirm) {
        this.finishFromConfirm();
        return true;
      }
      if (this.pendingMeeple && this.seatNeedsConfirm(this.pendingMeeple.player)) {
        this.finishMeeplePhase();
        return true;
      }
      return false;
    }
    undoPlace() {
      if (this.pendingConfirm) {
        return this.undoFromConfirm();
      }
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
    undoFromConfirm() {
      if (!this.pendingConfirm) return false;
      const pending = this.pendingConfirm;
      const key = keyOf(pending.x, pending.y);
      const tile = this.board.get(key);
      if (!tile) return false;
      if (pending.placedMeeple && tile.meeple) {
        this.meeples[pending.player] += 1;
        tile.meeple = null;
        this.pendingConfirm = null;
        this.pendingMeeple = {
          x: pending.x,
          y: pending.y,
          player: pending.player,
          prevLastPlaced: pending.prevLastPlaced
        };
        return true;
      }
      this.board.delete(key);
      this.current = makeTile(tile.id, tile.start);
      this.rotation = tile.rot;
      this.player = pending.player;
      this.lastPlacedBy[this.players[pending.player].id] = pending.prevLastPlaced;
      this.pendingConfirm = null;
      this.pendingMeeple = null;
      this.finished = false;
      return true;
    }
    finishFromConfirm() {
      if (!this.pendingConfirm) return;
      const x = this.pendingConfirm.x;
      const y = this.pendingConfirm.y;
      this.pendingConfirm = null;
      resolveCompletions(this, x, y);
      this.player = (this.player + 1) % this.players.length;
      this.pull();
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
  function createGame(random, players2, options2) {
    const roll = random || Math.random;
    const tiles = buildTiles();
    const start = tiles.find((tile) => tile.start);
    const deck = shuffle(tiles.filter((tile) => !tile.start), roll);
    const game = new Game(deck, players2, options2);
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
      if (game.pendingConfirm && !game.confirmTurnEnd()) break;
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
      pendingConfirm: game.pendingConfirm ? Object.assign({}, game.pendingConfirm) : null,
      pendingDiscard: !!game.pendingDiscard,
      standings: game.standings.slice(),
      finalScored: !!game.finalScored,
      rankingOpen: !!game.rankingOpen
    };
  }
  function restoreGame(data) {
    if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.board)) return null;
    const players2 = normalizePlayers(data.players);
    if (!players2 || players2.length < PLAYERS_MIN) return null;
    const game = new Game(
      (data.deck || []).map((tile) => makeTile(tile.id, tile.start)),
      players2,
      data.options
    );
    game.board = /* @__PURE__ */ new Map();
    for (const entry of data.board) {
      if (!entry || entry.length < 2 || !entry[1]) continue;
      game.board.set(entry[0], revivePlacedTile(entry[1]));
    }
    if (!game.board.size) return null;
    game.discards = (data.discards || []).map((tile) => makeTile(tile.id, tile.start));
    game.player = (data.player % players2.length + players2.length) % players2.length;
    game.current = data.current ? makeTile(data.current.id, data.current.start) : null;
    game.rotation = (data.rotation % 4 + 4) % 4;
    game.finished = !!data.finished;
    game.scores = players2.map((_, index) => Number(data.scores && data.scores[index]) || 0);
    game.meeples = players2.map((_, index) => {
      const value = data.meeples && data.meeples[index];
      return value == null ? MEEPLES_EACH : Number(value);
    });
    game.lastPlacedBy = Object.assign(
      Object.fromEntries(players2.map((player) => [player.id, null])),
      data.lastPlacedBy || {}
    );
    game.pendingMeeple = data.pendingMeeple ? Object.assign({}, data.pendingMeeple) : null;
    game.pendingConfirm = data.pendingConfirm ? Object.assign({}, data.pendingConfirm) : null;
    game.pendingDiscard = !!data.pendingDiscard;
    game.standings = Array.isArray(data.standings) ? data.standings.slice() : players2.map((_, index) => index);
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
    const options2 = [{ slotId: null, kind: null }];
    if (!game.pendingMeeple) return options2;
    const stock = game.meeples[game.pendingMeeple.player];
    if (stock <= 0) return options2;
    const x = game.pendingMeeple.x;
    const y = game.pendingMeeple.y;
    for (const slot of game.meepleSlots()) {
      if (slot.kind === "field") {
        const field = collectFieldComponent(game.board, x, y, slot.index);
        const cities = completedCitiesTouchingField(game.board, field.parts);
        if (!fieldAllowed(phase, cities, stock)) continue;
        options2.push({ slotId: slot.id, kind: slot.kind, cities });
        continue;
      }
      options2.push({ slotId: slot.id, kind: slot.kind });
    }
    return options2;
  }
  function equityAndGift(game, me, weights, phase) {
    let equity = 0;
    let gift = 0;
    const board = game.board;
    const n = game.players.length;
    const seenCities = /* @__PURE__ */ new Set();
    const seenRoads = /* @__PURE__ */ new Set();
    const seenFields = /* @__PURE__ */ new Set();
    const t2 = EQUITY_TUNING;
    const cityBonus = (phase === "early" ? t2.earlyCityMul : 1) * t2.cityMul;
    const roadBonus = (phase === "early" ? t2.earlyRoadMul : 1) * t2.roadMul;
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
        const completeBonus = openings <= 1 ? t2.cityOpen1 : openings === 2 ? t2.cityOpen2 : t2.cityOpen3Plus;
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
        const value = tiles * (openings <= 1 ? t2.roadOpen1 : t2.roadOpen2Plus) * roadBonus;
        if (winners.includes(me)) equity += value;
        else gift += value;
      });
      if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery" && !monasteryComplete(board, x, y)) {
        const filled = monasteryTileCount(board, x, y);
        const value = filled * t2.monasteryFilled + (9 - filled) * t2.monasteryEmpty;
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
  function finishIfConfirm(game) {
    if (game.pendingConfirm && !game.confirmTurnEnd()) return false;
    return true;
  }
  function applyMeepleChoice(game, slotId) {
    const after = cloneGame(game);
    if (slotId) {
      if (!after.placeMeeple(slotId)) return null;
    } else if (!after.skipMeeple()) {
      return null;
    }
    if (!finishIfConfirm(after)) return null;
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
    if (!finishIfConfirm(placed)) return null;
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
  var game_default = Carcassonne;

  // js/i18n.js
  var KEY = "tile-city-lang";
  var dict = {
    en: {
      homeTitle: "TileCity",
      homeLead: "A tile-laying game of expanding roads and cities to score points.",
      play: "Play",
      rules: "Rules",
      home: "Home",
      langEn: "EN",
      langJa: "JA",
      langLabel: "Language",
      volumeLabel: "Volume",
      setupTitle: "Prepare to play",
      gameSettingsTitle: "Game settings",
      gameSettingsLead: "Choose which claimed features use player colors.",
      optColorRoads: "Color roads",
      optColorCities: "Color cities",
      optColorMonasteries: "Color monasteries",
      playersTitle: "Player settings",
      setupLead: "2\u20138 players. Name max 10 letters. Each color once.",
      setupLeadBot: "Bots play automatically.",
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
      rulesTitle: "TileCity Rules",
      rulesLead: "Follow the board step by step, then skim the notes below if you need them. Original art \u2014 not the publisher\u2019s illustrations.",
      tocTutorial: "Tutorial",
      tocDetails: "Notes",
      tocTiles: "Tiles A\u2013X",
      tutTitle: "How to play",
      tutLead: "One board, building as you go. Switch the explanation \u2014 the map keeps every tile you placed.",
      tutStep: "{n} / {total}",
      tutPrev: "Previous",
      tutNext: "Next",
      tut1Title: "Complete a city",
      tut1Body: "Place a tile so a city is fully walled in. The meeple on that city scores right away.",
      tut1Score: "City: 2 points per tile \u2192 here +4",
      tut2Title: "Complete a road",
      tut2Body: "A crossroads closes the end of a road. When both ends are closed, the road scores.",
      tut2Score: "Road: 1 point per tile \u2192 here +4",
      tut3Title: "Place a monastery",
      tut3Body: "Put a monastery tile down and you may seat a meeple on it. It scores later, when every neighboring space is filled.",
      tut3Score: "No points yet \u2014 the monk waits",
      tut4Title: "Cities merge \u2014 shared score",
      tut4Body: "Connecting two cities joins their meeples. If you and an opponent are tied for most, you both get the full points.",
      tut4Score: "Tied majority \u2192 both score +12",
      tut5Title: "Finish a monastery",
      tut5Body: "Fill the last empty space around a monastery. The monk scores and returns to your hand.",
      tut5Score: "Monastery: 9 points when the 3\xD73 is full",
      tut6Title: "Cities merge \u2014 you alone",
      tut6Body: "If you bring more meeples into the merged city than anyone else, only you score.",
      tut6Score: "2 vs 1 \u2192 only you score +12",
      tut7Title: "Fields at game end",
      tut7Body: "Farmers stay out until the end. Each completed city your field touches is worth 3 points.",
      tut7Score: "Two completed cities \u2192 +6 for the farmer",
      detailsTitle: "Notes",
      notesLead: "Extras the tutorial doesn\u2019t cover \u2014 placement limits, controls, and a scoring cheat sheet.",
      tocPlace: "How to place",
      tocMeeple: "Meeples",
      tocScore: "Scoring",
      tocControls: "Controls",
      tocGoal: "Goal",
      tocSetup: "Setup",
      tocTurn: "Turn",
      tocEnd: "Game end",
      goalTitle: "Goal",
      goalBody: "Take turns placing tiles and meeples. Complete roads, cities, and monasteries during the game to score points. When the last tile is placed, score leftover roads, cities, monasteries, and fields. Highest score wins.",
      setupSecTitle: "Setup",
      setupPlayers: "Players",
      setupPlayersBody: "2\u20138 players. Each color has 7 meeples. On the prepare screen, choose names (max 10 letters) and unique colors.",
      setupStartTile: "Start tile",
      setupStartTileBody: "Place the marked D tile face-up in the center. Shuffle the other 71 tiles into the deck.",
      setupFirst: "First player",
      setupFirstBody: "The starting player is chosen at random. Turns then follow the player list order.",
      turnTitle: "On your turn",
      turnDraw: "1. Draw a tile",
      turnDrawBody: "Take the top tile from the deck so everyone can see it.",
      turnPlace: "2. Place the tile",
      turnPlaceBody: "Rotate in 90\xB0 steps and place it so the edges match neighboring tiles (see Placement). If it cannot be placed in any orientation, discard it and draw again \u2014 your turn is not spent.",
      turnMeeple: "3. Place a meeple (optional)",
      turnMeepleBody: "You may put one of your meeples on a free road, city, monastery, or field on the tile you just placed.",
      turnScore: "4. Score completed areas",
      turnScoreBody: "If that placement completes a road, city, or monastery, score it now. Meeples on those completed areas return to their owners.",
      placeTitle: "How to place tiles",
      placeTouch: "Share a full side",
      placeTouchBody: "The new tile must touch an existing tile along at least one full side. Touching only at a corner does not count.",
      placeEdges: "Matching edges",
      placeEdgesBody: "Where tiles touch, the terrain must continue: city to city, road to road, field to field.",
      placeNoFlip: "Rotate only",
      placeNoFlipBody: "You may rotate the tile, but you cannot flip or mirror it.",
      placeOpen: "Grow in any direction",
      placeOpenBody: "The map can expand freely in every direction.",
      legalTitle: "OK example",
      legalBody: "Center is start tile D. North city matches E rotated 180\xB0. East road matches U rotated 90\xB0. South field matches V\u2019s north field.",
      illegalEdgesTitle: "Not allowed \u2014 edges clash",
      illegalEdgesBody: "D\u2019s east edge is a road, but unrotated E\u2019s west edge is a field. Even one mismatched side means you cannot place it there.",
      illegalCornerTitle: "Not allowed \u2014 corner only",
      illegalCornerBody: "Tiles that only meet at a corner do not share a side, so you cannot place them that way.",
      meepleTitle: "Meeples",
      meepleWhere: "Where you can place",
      meepleWhereBody: "Only on the tile you just placed \u2014 on a free road, city, monastery, or field mark.",
      meepleOne: "No joining occupied areas",
      meepleOneBody: "You cannot place a meeple on a road, city, or field that already has any meeple somewhere in its connected area.",
      meepleStock: "Running out",
      meepleStockBody: "If you have no meeples left, place the tile only. Completing a road, city, or monastery returns those meeples (except during final scoring).",
      meepleSkip: "Skipping",
      meepleSkipBody: "You may place the tile and choose not to place a meeple.",
      scoreTitle: "Scoring during the game",
      scoreIntro: "When a road, city, or monastery is completed, the player with the most meeples on it scores. If tied for most, each tied player scores the full points. Those meeples then return to their owners.",
      scoreFeature: "Area",
      scoreComplete: "When completed",
      scoreRoad: "Road",
      scoreRoadBody: "1 point per tile in the road",
      scoreCity: "City",
      scoreCityBody: "2 points per tile + 2 per pennant (banner)",
      scoreMonastery: "Monastery",
      scoreMonasteryBody: "9 points when all 8 surrounding spaces are filled",
      scoreField: "Field",
      scoreFieldBody: "Not scored during the game",
      endTitle: "Game end",
      endWhen: "When it ends",
      endWhenBody: "After the last tile is placed (or you Exit early), final scoring runs.",
      endRoads: "Incomplete roads",
      endRoadsBody: "1 point per tile.",
      endCities: "Incomplete cities",
      endCitiesBody: "1 point per tile + 1 per pennant.",
      endMonasteries: "Incomplete monasteries",
      endMonasteriesBody: "1 point per filled space in the 3\xD73 area (including the monastery tile).",
      endFields: "Fields",
      endFieldsBody: "Farmers stay on the board. Each field scores 3 points for every completed city it touches. Majority works the same as above.",
      endMeeples: "Meeples",
      endMeeplesBody: "Final scoring does not return meeples. +N labels show what each one scored.",
      endTies: "Ties",
      endTiesBody: "Equal score \u2192 the player with more meeples still in hand ranks higher.",
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
      tileIIntro: "Tile I has two cities that only meet at a corner. They stay separate unless each connects to other tiles along a full city edge.",
      tileINorth: "Joining the north city",
      tileINorthBody: "E rotated 180\xB0 matches I\u2019s north city edge. I\u2019s west city stays separate.",
      tileIWest: "Joining the west city",
      tileIWestBody: "E rotated 90\xB0 matches I\u2019s west city edge. I\u2019s north city stays separate.",
      tileIBoth: "Still two cities",
      tileIBothBody: "Even with both sides filled, I\u2019s cities stay split by the field inside the tile. Corner-only contact between the two E tiles does not merge them.",
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
      rulesFoot: "TileCity \xB7 base-set rules adapted for this browser version.",
      canPlace: "Can place",
      needsRotate: "Needs rotate",
      rotHint: "Right-click or R to rotate \xB7 Wheel to zoom",
      zoomOut: "Zoom out",
      zoomIn: "Zoom in",
      deck: "deck",
      board: "board",
      discards: "discards",
      exit: "Exit",
      rank: "Ranking",
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
      noLegalPlace: "Nowhere to place this tile",
      endThisGame: "End this game?",
      gameOver: "Ranking",
      pickMeeple: "Pick a mark to place a meeple",
      noMeeplesLeft: "No meeples left",
      noOpenSpot: "No open spot for a meeple",
      share: "Share",
      shareTitle: "Share ranking",
      shareLead: "Board image with ranking in the corner.",
      shareNative: "Share\u2026",
      shareDownload: "Save image",
      shareCopy: "Copy text",
      shareCopyUrl: "Copy link",
      shareSns: "Social",
      shareHint: "Social apps open with text and link. Attach the saved image for the board shot.",
      shareTextTitle: "I played TileCity!",
      sharePreparing: "Preparing image\u2026",
      shareCaptureFail: "Could not capture the board. You can still copy the ranking text.",
      shareDone: "Shared.",
      shareSaved: "Image saved.",
      shareSaveHint: "Long-press the preview above, then choose Add to Photos.",
      shareCopied: "Ranking text copied.",
      shareLinkCopied: "Link copied.",
      shareCopyFail: "Copy failed.",
      shareNativeUnavailable: "System share is unavailable here. Save the image and attach it."
    },
    ja: {
      homeTitle: "TileCity",
      homeLead: "\u9053\u3068\u90FD\u5E02\u3092\u5E83\u3052\u3066\u5F97\u70B9\u3092\u7AF6\u3046\u30BF\u30A4\u30EB\u914D\u7F6E\u30B2\u30FC\u30E0\u3002",
      play: "\u904A\u3076",
      rules: "\u30EB\u30FC\u30EB",
      home: "\u30DB\u30FC\u30E0",
      langEn: "EN",
      langJa: "JA",
      langLabel: "\u8A00\u8A9E",
      volumeLabel: "\u97F3\u91CF",
      setupTitle: "\u30B2\u30FC\u30E0\u306E\u6E96\u5099",
      gameSettingsTitle: "\u30B2\u30FC\u30E0\u8A2D\u5B9A",
      gameSettingsLead: "\u5360\u9818\u3057\u305F\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u3067\u5857\u308B\u304B\u3092\u9078\u3073\u307E\u3059\u3002",
      optColorRoads: "\u9053\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u306B\u3059\u308B",
      optColorCities: "\u90FD\u5E02\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u306B\u3059\u308B",
      optColorMonasteries: "\u4FEE\u9053\u9662\u3092\u30D7\u30EC\u30A4\u30E4\u30FC\u8272\u306B\u3059\u308B",
      playersTitle: "\u30D7\u30EC\u30A4\u30E4\u30FC\u8A2D\u5B9A",
      setupLead: "2\u301C8\u4EBA\u3002\u540D\u524D\u306F\u6700\u592710\u6587\u5B57\u3002\u8272\u306F\u91CD\u8907\u4E0D\u53EF\u3002",
      setupLeadBot: "Bot\u306F\u81EA\u52D5\u3067\u624B\u756A\u3092\u9032\u3081\u307E\u3059\u3002",
      addPlayer: "\u30D7\u30EC\u30A4\u30E4\u30FC\u8FFD\u52A0",
      start: "\u958B\u59CB",
      back: "\u623B\u308B",
      playerName: "\u30D7\u30EC\u30A4\u30E4\u30FC\u540D",
      removePlayer: "\u524A\u9664",
      playersCount: "{n} / {max} \u4EBA",
      errNeedPlayers: "{min}\u301C{max} \u4EBA\u5FC5\u8981\u3067\u3059\u3002",
      errUniqueColor: "\u540C\u3058\u8272\u306F\u4F7F\u3048\u307E\u305B\u3093\u3002",
      playerKind: "\u7A2E\u5225",
      playerKindHuman: "\u4EBA\u9593",
      playerKindBot: "bot",
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
      rulesTitle: "TileCity \u30EB\u30FC\u30EB",
      rulesLead: "\u76E4\u9762\u3092\u898B\u306A\u304C\u3089\u624B\u3092\u9032\u3081\u3066\u3001\u5FC5\u8981\u306A\u3089\u4E0B\u306E\u88DC\u8DB3\u3092\u8AAD\u3093\u3067\u304F\u3060\u3055\u3044\u3002\u30AA\u30EA\u30B8\u30CA\u30EB\u7D75\u67C4\u3067\u3059\uFF08\u88FD\u54C1\u306E\u30A4\u30E9\u30B9\u30C8\u3067\u306F\u3042\u308A\u307E\u305B\u3093\uFF09\u3002",
      tocTutorial: "\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB",
      tocDetails: "\u88DC\u8DB3",
      tocTiles: "\u30BF\u30A4\u30EB A\u2013X",
      tutTitle: "\u904A\u3073\u65B9",
      tutLead: "\u76E4\u9762\u306F\u3072\u3068\u3064\u3002\u30BF\u30A4\u30EB\u306F\u5F15\u304D\u7D99\u304C\u308C\u307E\u3059\u3002\u77E2\u5370\u3067\u89E3\u8AAC\u3060\u3051\u5207\u308A\u66FF\u3048\u307E\u3059\u3002",
      tutStep: "{n} / {total}",
      tutPrev: "\u524D\u3078",
      tutNext: "\u6B21\u3078",
      tut1Title: "\u90FD\u5E02\u3092\u5B8C\u6210\u3055\u305B\u3066\u5F97\u70B9",
      tut1Body: "\u57CE\u58C1\u3067\u56F2\u307E\u308C\u308B\u3088\u3046\u306B\u30BF\u30A4\u30EB\u3092\u7F6E\u304F\u3068\u3001\u90FD\u5E02\u304C\u5B8C\u6210\u3057\u307E\u3059\u3002\u305D\u306E\u90FD\u5E02\u306B\u3044\u308B\u30DF\u30FC\u30D7\u30EB\u304C\u3059\u3050\u306B\u5F97\u70B9\u3057\u307E\u3059\u3002",
      tut1Score: "\u90FD\u5E02\uFF1A\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D2\u70B9 \u2192 \u3053\u3053\u3067\u306F +4",
      tut2Title: "\u4EA4\u5DEE\u70B9\u3067\u9053\u3092\u5B8C\u6210",
      tut2Body: "\u4EA4\u5DEE\u70B9\u3092\u7F6E\u304F\u3068\u9053\u306E\u7AEF\u304C\u9589\u3058\u3066\u5B8C\u6210\u3057\u307E\u3059\u3002\u4E21\u7AEF\u304C\u9589\u3058\u305F\u9053\u304C\u5F97\u70B9\u306B\u306A\u308A\u307E\u3059\u3002",
      tut2Score: "\u9053\uFF1A\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 \u2192 \u3053\u3053\u3067\u306F +4",
      tut3Title: "\u4FEE\u9053\u9662\u3092\u7F6E\u304F",
      tut3Body: "\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u3092\u7F6E\u304D\u3001\u30DF\u30FC\u30D7\u30EB\u3092\u4E57\u305B\u308B\u3053\u3068\u304C\u3067\u304D\u307E\u3059\u3002\u5F97\u70B9\u306F\u3001\u5468\u56F2\u304C\u3059\u3079\u3066\u57CB\u307E\u3063\u305F\u3068\u304D\u306B\u5165\u308A\u307E\u3059\u3002",
      tut3Score: "\u307E\u3060\u5F97\u70B9\u306A\u3057 \u2014 \u4FEE\u9053\u58EB\u306F\u5F85\u3061\u307E\u3059",
      tut4Title: "\u90FD\u5E02\u304C\u5408\u6D41 \u2014 \u540C\u6642\u306B\u5F97\u70B9",
      tut4Body: "\u5225\u3005\u306E\u90FD\u5E02\u3092\u3064\u306A\u3050\u3068\u30DF\u30FC\u30D7\u30EB\u3082\u5408\u6D41\u3057\u307E\u3059\u3002\u6700\u591A\u304C\u540C\u6570\u306A\u3089\u3001\u305D\u306E\u5168\u54E1\u304C\u540C\u3058\u70B9\u6570\u3092\u5F97\u307E\u3059\u3002",
      tut4Score: "\u540C\u6570 \u2192 \u3069\u3061\u3089\u3082 +12",
      tut5Title: "\u4FEE\u9053\u9662\u306E\u5468\u308A\u3092\u57CB\u3081\u3066\u5F97\u70B9",
      tut5Body: "\u4FEE\u9053\u9662\u306E\u5468\u56F2\u3067\u6700\u5F8C\u306E1\u30DE\u30B9\u3092\u57CB\u3081\u308B\u3068\u5B8C\u6210\u3002\u4FEE\u9053\u58EB\u304C\u5F97\u70B9\u3057\u3066\u624B\u5143\u306B\u623B\u308A\u307E\u3059\u3002",
      tut5Score: "\u4FEE\u9053\u9662\uFF1A3\xD73\u304C\u57CB\u307E\u308B\u3068 9\u70B9",
      tut6Title: "\u90FD\u5E02\u304C\u5408\u6D41 \u2014 \u81EA\u5206\u3060\u3051\u5F97\u70B9",
      tut6Body: "\u5408\u6D41\u3057\u305F\u90FD\u5E02\u3067\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u76F8\u624B\u3088\u308A\u591A\u3044\u3068\u304D\u3001\u5F97\u70B9\u3067\u304D\u308B\u306E\u306F\u81EA\u5206\u3060\u3051\u3067\u3059\u3002",
      tut6Score: "2\u5BFE1 \u2192 \u81EA\u5206\u3060\u3051 +12",
      tut7Title: "\u30B2\u30FC\u30E0\u7D42\u4E86\u3068\u7551\u306E\u5F97\u70B9",
      tut7Body: "\u8FB2\u6C11\uFF08\u7551\u306E\u30DF\u30FC\u30D7\u30EB\uFF09\u306F\u6700\u5F8C\u307E\u3067\u76E4\u9762\u306B\u6B8B\u308A\u307E\u3059\u3002\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3067\u3059\u3002",
      tut7Score: "\u5B8C\u6210\u90FD\u5E02\u304C2\u3064 \u2192 \u8FB2\u6C11\u306F +6",
      detailsTitle: "\u88DC\u8DB3",
      notesLead: "\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB\u3067\u89E6\u308C\u3066\u3044\u306A\u3044\u7F6E\u304D\u65B9\u306E\u5236\u9650\u3001\u64CD\u4F5C\u3001\u5F97\u70B9\u65E9\u898B\u8868\u3067\u3059\u3002",
      tocPlace: "\u7F6E\u304D\u65B9",
      tocMeeple: "\u30DF\u30FC\u30D7\u30EB",
      tocScore: "\u5F97\u70B9",
      tocControls: "\u64CD\u4F5C",
      tocGoal: "\u76EE\u7684",
      tocSetup: "\u6E96\u5099",
      tocTurn: "\u624B\u756A",
      tocEnd: "\u7D42\u4E86",
      goalTitle: "\u76EE\u7684",
      goalBody: "\u9806\u756A\u306B\u30BF\u30A4\u30EB\u3068\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u3044\u3066\u3044\u304D\u307E\u3059\u3002\u30B2\u30FC\u30E0\u4E2D\u306B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u5B8C\u6210\u3055\u305B\u308B\u3068\u5F97\u70B9\u3002\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u3089\u3001\u6B8B\u3063\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3068\u7551\u3082\u5F97\u70B9\u3057\u3001\u4E00\u756A\u70B9\u304C\u9AD8\u3044\u4EBA\u304C\u52DD\u3061\u3067\u3059\u3002",
      setupSecTitle: "\u6E96\u5099",
      setupPlayers: "\u30D7\u30EC\u30A4\u30E4\u30FC",
      setupPlayersBody: "2\u301C8\u4EBA\u3002\u5404\u82727\u4F53\u306E\u30DF\u30FC\u30D7\u30EB\u3092\u4F7F\u3044\u307E\u3059\u3002\u6E96\u5099\u753B\u9762\u3067\u540D\u524D\uFF08\u6700\u592710\u6587\u5B57\uFF09\u3068\u8272\u3092\u9078\u3073\u307E\u3059\uFF08\u8272\u306E\u91CD\u8907\u306F\u4E0D\u53EF\uFF09\u3002",
      setupStartTile: "\u30B9\u30BF\u30FC\u30C8\u30BF\u30A4\u30EB",
      setupStartTileBody: "\u5370\u4ED8\u304D\u306E D \u30BF\u30A4\u30EB1\u679A\u3092\u4E2D\u592E\u306B\u8868\u5411\u304D\u3067\u7F6E\u304D\u307E\u3059\u3002\u6B8B\u308A71\u679A\u3092\u3088\u304F\u6DF7\u305C\u3066\u5C71\u672D\u306B\u3057\u307E\u3059\u3002",
      setupFirst: "\u5148\u624B",
      setupFirstBody: "\u5148\u624B\u306F\u30E9\u30F3\u30C0\u30E0\u306B\u6C7A\u307E\u308A\u307E\u3059\u3002\u4EE5\u964D\u306F\u30D7\u30EC\u30A4\u30E4\u30FC\u306E\u4E26\u3073\u9806\u306B\u624B\u756A\u304C\u56DE\u308A\u307E\u3059\u3002",
      turnTitle: "\u624B\u756A\u306E\u6D41\u308C",
      turnDraw: "1. \u30BF\u30A4\u30EB\u3092\u5F15\u304F",
      turnDrawBody: "\u5C71\u672D\u306E\u4E00\u756A\u4E0A\u30921\u679A\u5F15\u304D\u3001\u5168\u54E1\u306B\u898B\u3048\u308B\u3088\u3046\u306B\u3057\u307E\u3059\u3002",
      turnPlace: "2. \u30BF\u30A4\u30EB\u3092\u7F6E\u304F",
      turnPlaceBody: "90\xB0\u5358\u4F4D\u3067\u56DE\u8EE2\u3057\u3001\u96A3\u306E\u30BF\u30A4\u30EB\u3068\u7D75\u67C4\u304C\u3064\u306A\u304C\u308B\u3088\u3046\u306B\u7F6E\u304D\u307E\u3059\uFF08\u7F6E\u304D\u65B9\u53C2\u7167\uFF09\u3002\u3069\u306E\u5411\u304D\u3067\u3082\u7F6E\u3051\u306A\u3044\u5834\u5408\u306F\u6368\u3066\u3066\u5F15\u304D\u76F4\u3057\u307E\u3059\u3002\u3053\u306E\u3068\u304D\u624B\u756A\u306F\u6D88\u8CBB\u3057\u307E\u305B\u3093\u3002",
      turnMeeple: "3. \u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F\uFF08\u4EFB\u610F\uFF09",
      turnMeepleBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u3001\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u7551\u306B\u3001\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u30921\u4F53\u7F6E\u3051\u307E\u3059\u3002\u7F6E\u304B\u306A\u304F\u3066\u3082\u69CB\u3044\u307E\u305B\u3093\u3002",
      turnScore: "4. \u5B8C\u6210\u3057\u305F\u5834\u6240\u306E\u5F97\u70B9",
      turnScoreBody: "\u305D\u306E\u914D\u7F6E\u3067\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3057\u305F\u3089\u3001\u3059\u3050\u306B\u5F97\u70B9\u3057\u307E\u3059\u3002\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u6301\u3061\u4E3B\u306E\u624B\u5143\u3078\u623B\u308A\u307E\u3059\u3002",
      placeTitle: "\u30BF\u30A4\u30EB\u306E\u7F6E\u304D\u65B9",
      placeTouch: "\u8FBA\u3067\u63A5\u3059\u308B",
      placeTouchBody: "\u65B0\u3057\u3044\u30BF\u30A4\u30EB\u306F\u3001\u3059\u3067\u306B\u7F6E\u3044\u3066\u3042\u308B\u30BF\u30A4\u30EB\u3068\u5C11\u306A\u304F\u3068\u30821\u8FBA\u5168\u4F53\u3067\u63A5\u3059\u308B\u3088\u3046\u306B\u7F6E\u304D\u307E\u3059\u3002\u89D2\u3060\u3051\u304C\u89E6\u308C\u3066\u3044\u308B\u72B6\u614B\u3067\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      placeEdges: "\u7D75\u67C4\u3092\u3064\u306A\u3052\u308B",
      placeEdgesBody: "\u63A5\u3059\u308B\u8FBA\u306F\u7AEF\u304B\u3089\u7AEF\u307E\u3067\u540C\u3058\u5730\u5F62\u3067\u3042\u308B\u3053\u3068\u3002\u90FD\u5E02\u306F\u90FD\u5E02\u3001\u9053\u306F\u9053\u3001\u7551\u306F\u7551\u306B\u3064\u306A\u304C\u308A\u307E\u3059\u3002",
      placeNoFlip: "\u56DE\u8EE2\u306E\u307F",
      placeNoFlipBody: "\u30BF\u30A4\u30EB\u306F\u56DE\u8EE2\u3067\u304D\u307E\u3059\u304C\u3001\u88CF\u8FD4\u3057\u305F\u308A\u93E1\u6620\u3057\u305F\u308A\u306F\u3067\u304D\u307E\u305B\u3093\u3002",
      placeOpen: "\u3069\u306E\u65B9\u5411\u306B\u3082\u4F38\u3070\u305B\u308B",
      placeOpenBody: "\u30DE\u30C3\u30D7\u306F\u4E0A\u4E0B\u5DE6\u53F3\u3001\u3069\u306E\u65B9\u5411\u306B\u3082\u5E83\u3052\u3089\u308C\u307E\u3059\u3002",
      legalTitle: "\u7F6E\u3051\u308B\u4F8B",
      legalBody: "\u4E2D\u592E\u306F\u30B9\u30BF\u30FC\u30C8\u30BF\u30A4\u30EB D\u3002\u5317\u306E\u90FD\u5E02\u306F 180\xB0 \u56DE\u8EE2\u306E E\u3001\u6771\u306E\u9053\u306F 90\xB0 \u56DE\u8EE2\u306E U\u3001\u5357\u306E\u7551\u306F V \u306E\u5317\u7551\u3068\u3064\u306A\u304C\u3063\u3066\u3044\u307E\u3059\u3002",
      illegalEdgesTitle: "\u7F6E\u3051\u306A\u3044\u4F8B \u2014 \u8FBA\u304C\u5408\u308F\u306A\u3044",
      illegalEdgesBody: "D \u306E\u6771\u8FBA\u306F\u9053\u306A\u306E\u306B\u3001\u7121\u56DE\u8EE2\u306E E \u306E\u897F\u8FBA\u306F\u7551\u3067\u3059\u30021\u8FBA\u3067\u3082\u5408\u308F\u306A\u3051\u308C\u3070\u3001\u305D\u3053\u306B\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      illegalCornerTitle: "\u7F6E\u3051\u306A\u3044\u4F8B \u2014 \u89D2\u3060\u3051",
      illegalCornerBody: "\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u308B\u30BF\u30A4\u30EB\u306F\u8FBA\u3092\u5171\u6709\u3057\u3066\u3044\u306A\u3044\u306E\u3067\u3001\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleTitle: "\u30DF\u30FC\u30D7\u30EB",
      meepleWhere: "\u7F6E\u304D\u5834\u6240",
      meepleWhereBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u4E0A\u3060\u3051\u3002\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u7551\u306E\u30DE\u30FC\u30AF\u306B\u7F6E\u3051\u307E\u3059\u3002",
      meepleOne: "\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u3042\u308B\u5834\u6240\u3078\u306F\u7F6E\u3051\u306A\u3044",
      meepleOneBody: "\u3064\u306A\u304C\u3063\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u7551\u306E\u3069\u3053\u304B\u306B\u3001\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\uFF08\u81EA\u5206\u306E\u3082\u76F8\u624B\u306E\u3082\uFF09\u304C\u3042\u308B\u5834\u5408\u3001\u305D\u3053\u306B\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleStock: "\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u304F\u306A\u3063\u305F\u3089",
      meepleStockBody: "\u624B\u5143\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u3051\u308C\u3070\u3001\u30BF\u30A4\u30EB\u3092\u7F6E\u304F\u3060\u3051\u306B\u306A\u308A\u307E\u3059\u3002\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u3059\uFF08\u6700\u7D42\u5F97\u70B9\u6642\u3092\u9664\u304F\uFF09\u3002",
      meepleSkip: "\u7F6E\u304B\u306A\u3044\u9078\u629E",
      meepleSkipBody: "\u30BF\u30A4\u30EB\u3060\u3051\u7F6E\u3044\u3066\u3001\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304B\u306A\u3044\u3053\u3068\u3082\u3067\u304D\u307E\u3059\u3002",
      scoreTitle: "\u30B2\u30FC\u30E0\u4E2D\u306E\u5F97\u70B9",
      scoreIntro: "\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u306E\u4E0A\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u4E00\u756A\u591A\u3044\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u5F97\u70B9\u3057\u307E\u3059\u3002\u540C\u6570\u306A\u3089\u3001\u305D\u306E\u5168\u54E1\u304C\u540C\u3058\u70B9\u6570\u3092\u3082\u3089\u3048\u307E\u3059\u3002\u5F97\u70B9\u3057\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u3059\u3002",
      scoreFeature: "\u5834\u6240",
      scoreComplete: "\u5B8C\u6210\u3057\u305F\u3068\u304D",
      scoreRoad: "\u9053",
      scoreRoadBody: "\u9053\u306E\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9",
      scoreCity: "\u90FD\u5E02",
      scoreCityBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D2\u70B9 + \u30DA\u30CA\u30F3\u30C8\uFF08\u65D7\uFF091\u3064\u306B\u3064\u304D2\u70B9",
      scoreMonastery: "\u4FEE\u9053\u9662",
      scoreMonasteryBody: "\u5468\u56F28\u30DE\u30B9\u304C\u3059\u3079\u3066\u57CB\u307E\u308B\u30689\u70B9",
      scoreField: "\u7551",
      scoreFieldBody: "\u30B2\u30FC\u30E0\u4E2D\u306F\u5F97\u70B9\u3057\u306A\u3044",
      endTitle: "\u30B2\u30FC\u30E0\u7D42\u4E86",
      endWhen: "\u3044\u3064\u7D42\u308F\u308B\u304B",
      endWhenBody: "\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u5F8C\uFF08\u307E\u305F\u306F\u300C\u9000\u51FA\u300D\u3067\u9014\u4E2D\u7D42\u4E86\u3057\u305F\u3068\u304D\uFF09\u306B\u3001\u6700\u7D42\u5F97\u70B9\u3092\u884C\u3044\u307E\u3059\u3002",
      endRoads: "\u672A\u5B8C\u6210\u306E\u9053",
      endRoadsBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9\u3002",
      endCities: "\u672A\u5B8C\u6210\u306E\u90FD\u5E02",
      endCitiesBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 + \u30DA\u30CA\u30F3\u30C81\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endMonasteries: "\u672A\u5B8C\u6210\u306E\u4FEE\u9053\u9662",
      endMonasteriesBody: "3\xD73\uFF08\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u3092\u542B\u3080\uFF09\u306E\u57CB\u307E\u3063\u3066\u3044\u308B\u30DE\u30B91\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endFields: "\u7551",
      endFieldsBody: "\u7551\u306B\u7F6E\u3044\u305F\u30DF\u30FC\u30D7\u30EB\uFF08\u8FB2\u6C11\uFF09\u306F\u305D\u306E\u307E\u307E\u3002\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3002\u540C\u6570\u306E\u3068\u304D\u306F\u4E0A\u8A18\u3068\u540C\u3058\u3067\u3059\u3002",
      endMeeples: "\u30DF\u30FC\u30D7\u30EB",
      endMeeplesBody: "\u6700\u7D42\u5F97\u70B9\u3067\u306F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u305B\u3093\u3002+N \u8868\u793A\u3067\u5F97\u70B9\u3092\u793A\u3057\u307E\u3059\u3002",
      endTies: "\u540C\u70B9",
      endTiesBody: "\u540C\u70B9\u306A\u3089\u3001\u624B\u5143\u306B\u6B8B\u3063\u3066\u3044\u308B\u30DF\u30FC\u30D7\u30EB\u304C\u591A\u3044\u65B9\u304C\u4E0A\u4F4D\u3067\u3059\u3002",
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
      tileIIntro: "\u30BF\u30A4\u30EB I \u306B\u306F\u3001\u89D2\u3060\u3051\u3067\u63A5\u3059\u308B2\u3064\u306E\u90FD\u5E02\u304C\u3042\u308A\u307E\u3059\u3002\u305D\u308C\u305E\u308C\u304C\u8FBA\u5168\u4F53\u3067\u4ED6\u306E\u30BF\u30A4\u30EB\u3068\u3064\u306A\u304C\u3089\u306A\u3044\u9650\u308A\u3001\u5225\u3005\u306E\u90FD\u5E02\u306E\u307E\u307E\u3067\u3059\u3002",
      tileINorth: "\u5317\u306E\u90FD\u5E02\u3068\u3064\u306A\u3050",
      tileINorthBody: "180\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u5317\u306E\u90FD\u5E02\u8FBA\u3068\u5408\u3044\u307E\u3059\u3002\u897F\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3067\u3059\u3002",
      tileIWest: "\u897F\u306E\u90FD\u5E02\u3068\u3064\u306A\u3050",
      tileIWestBody: "90\xB0 \u56DE\u8EE2\u306E E \u304C I \u306E\u897F\u306E\u90FD\u5E02\u8FBA\u3068\u5408\u3044\u307E\u3059\u3002\u5317\u306E\u90FD\u5E02\u306F\u5225\u306E\u307E\u307E\u3067\u3059\u3002",
      tileIBoth: "\u305D\u308C\u3067\u30822\u3064\u306E\u90FD\u5E02",
      tileIBothBody: "\u4E21\u5074\u304C\u57CB\u307E\u3063\u3066\u3082\u3001\u30BF\u30A4\u30EB\u5185\u306E\u7551\u3067\u90FD\u5E02\u306F\u5206\u304B\u308C\u307E\u3059\u30022\u679A\u306E E \u304C\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u3066\u3082\u3001\u5408\u4F75\u3057\u307E\u305B\u3093\u3002",
      tilesTitle: "\u30BF\u30A4\u30EB A\u2013X",
      tilesIntro: "\u30AF\u30E9\u30B7\u30C3\u30AF\u57FA\u672C\u30BB\u30C3\u30C8\u3068\u540C\u3058\u6587\u5B57\u30B3\u30FC\u30C9\u3068\u679A\u6570\u3067\u3059\u3002\u30AB\u30BF\u30ED\u30B0\u3067\u306F\u4E0A\u304C\u5317\u3002J \u3068 K \u306F\u93E1\u6620\u3067\u3001\u56DE\u8EE2\u3067\u306F\u4E92\u3044\u306B\u306A\u308A\u307E\u305B\u3093\u3002\u30DA\u30CA\u30F3\u30C8\u4ED8\u304D\u306F\u7121\u5370\u3068\u5206\u3051\u3066\u8A18\u8F09\u3057\u3066\u3044\u307E\u3059\u3002",
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
      rulesFoot: "TileCity \xB7 \u30D6\u30E9\u30A6\u30B6\u7248\u5411\u3051\u306B\u57FA\u672C\u30BB\u30C3\u30C8\u30EB\u30FC\u30EB\u3092\u518D\u69CB\u6210\u3002",
      canPlace: "\u7F6E\u3051\u308B",
      needsRotate: "\u8981\u56DE\u8EE2",
      rotHint: "\u53F3\u30AF\u30EA\u30C3\u30AF / R \u3067\u56DE\u8EE2 \xB7 \u30DB\u30A4\u30FC\u30EB\u3067\u30BA\u30FC\u30E0",
      zoomOut: "\u7E2E\u5C0F",
      zoomIn: "\u62E1\u5927",
      deck: "\u5C71\u672D",
      board: "\u76E4\u9762",
      discards: "\u6368\u3066\u672D",
      exit: "\u9000\u51FA",
      rank: "\u30E9\u30F3\u30AD\u30F3\u30B0",
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
      gameOver: "\u30E9\u30F3\u30AD\u30F3\u30B0",
      pickMeeple: "\u30DE\u30FC\u30AF\u3092\u9078\u3093\u3067\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F",
      noMeeplesLeft: "\u30DF\u30FC\u30D7\u30EB\u304C\u3042\u308A\u307E\u305B\u3093",
      noOpenSpot: "\u7F6E\u3051\u308B\u5834\u6240\u304C\u3042\u308A\u307E\u305B\u3093",
      share: "\u5171\u6709",
      shareTitle: "\u30E9\u30F3\u30AD\u30F3\u30B0\u3092\u5171\u6709",
      shareLead: "\u76E4\u9762\u306E\u753B\u50CF\u306B\u30E9\u30F3\u30AD\u30F3\u30B0\u3092\u91CD\u306D\u3066\u5171\u6709\u3067\u304D\u307E\u3059\u3002",
      shareNative: "\u5171\u6709\u2026",
      shareDownload: "\u753B\u50CF\u3092\u4FDD\u5B58",
      shareCopy: "\u30C6\u30AD\u30B9\u30C8\u3092\u30B3\u30D4\u30FC",
      shareCopyUrl: "\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC",
      shareSns: "SNS",
      shareHint: "\u5404SNS\u306F\u30C6\u30AD\u30B9\u30C8\u3068\u30EA\u30F3\u30AF\u3092\u958B\u304D\u307E\u3059\u3002\u76E4\u9762\u753B\u50CF\u306F\u4FDD\u5B58\u3057\u3066\u6295\u7A3F\u306B\u6DFB\u4ED8\u3057\u3066\u304F\u3060\u3055\u3044\u3002",
      shareTextTitle: "TileCity \u3092\u30D7\u30EC\u30A4\u3057\u307E\u3057\u305F\uFF01",
      sharePreparing: "\u753B\u50CF\u3092\u6E96\u5099\u3057\u3066\u3044\u307E\u3059\u2026",
      shareCaptureFail: "\u76E4\u9762\u3092\u30AD\u30E3\u30D7\u30C1\u30E3\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\u3002\u30C6\u30AD\u30B9\u30C8\u5171\u6709\u306F\u5229\u7528\u3067\u304D\u307E\u3059\u3002",
      shareDone: "\u5171\u6709\u3057\u307E\u3057\u305F\u3002",
      shareSaved: "\u753B\u50CF\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F\u3002",
      shareSaveHint: "\u4E0A\u306E\u30D7\u30EC\u30D3\u30E5\u30FC\u3092\u9577\u62BC\u3057\u3057\u3066\u300C\u5199\u771F\u306B\u8FFD\u52A0\u300D\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044\u3002",
      shareCopied: "\u30E9\u30F3\u30AD\u30F3\u30B0\u6587\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002",
      shareLinkCopied: "\u30EA\u30F3\u30AF\u3092\u30B3\u30D4\u30FC\u3057\u307E\u3057\u305F\u3002",
      shareCopyFail: "\u30B3\u30D4\u30FC\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002",
      shareNativeUnavailable: "\u3053\u306E\u74B0\u5883\u3067\u306F\u30B7\u30B9\u30C6\u30E0\u5171\u6709\u3092\u4F7F\u3048\u307E\u305B\u3093\u3002\u753B\u50CF\u3092\u4FDD\u5B58\u3057\u3066\u6DFB\u4ED8\u3057\u3066\u304F\u3060\u3055\u3044\u3002"
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

  // js/setup/main.js
  var SETUP_KEY = "tile-city-setup";
  var palette = game_default.COLOR_PALETTE;
  var min = game_default.PLAYERS_MIN;
  var max = game_default.PLAYERS_MAX;
  var nameMax = game_default.NAME_MAX;
  var strengths = game_default.BOT_STRENGTHS;
  function defaultRoster() {
    return game_default.normalizePlayers(
      game_default.PLAYERS.map((player) => ({ id: player.id, name: player.name, bot: false }))
    );
  }
  function isLegacyColorName(player) {
    const color = palette.find((item) => item.id === player.id);
    if (!color) return false;
    const name = String(player.name || "").trim();
    if (!name) return true;
    if (name.toLowerCase() === color.label.toLowerCase()) return true;
    if (name === color.id) return true;
    const en = i18n_default.colorLabel(player.id, "en");
    const ja = i18n_default.colorLabel(player.id, "ja");
    return name === en || name === ja;
  }
  function withPlayerDefaults(list) {
    return list.map((player, index) => {
      if (player.bot || !isLegacyColorName(player)) return player;
      return Object.assign({}, player, { name: game_default.defaultPlayerName(index) });
    });
  }
  function parseStoredSetup(raw) {
    if (!raw) return null;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      return null;
    }
    if (Array.isArray(data)) {
      return {
        players: withPlayerDefaults(game_default.normalizePlayers(data)),
        options: game_default.normalizeGameOptions(null)
      };
    }
    if (!data || typeof data !== "object") return null;
    const players2 = game_default.normalizePlayers(data.players || data.roster);
    if (!players2 || !players2.length) return null;
    return {
      players: withPlayerDefaults(players2),
      options: game_default.normalizeGameOptions(data.options)
    };
  }
  function load() {
    try {
      const parsed = parseStoredSetup(sessionStorage.getItem(SETUP_KEY));
      if (parsed) return parsed;
    } catch (err) {
    }
    return {
      players: defaultRoster(),
      options: game_default.normalizeGameOptions(null)
    };
  }
  var initial = load();
  var players = initial.players;
  var options = initial.options;
  function usedColors(exceptIndex) {
    const used = /* @__PURE__ */ new Set();
    players.forEach((player, index) => {
      if (index === exceptIndex) return;
      used.add(player.id);
    });
    return used;
  }
  function nextFreeColor() {
    const used = usedColors(-1);
    return palette.find((color) => !used.has(color.id));
  }
  function setErr(msg) {
    document.getElementById("err").textContent = msg || "";
  }
  function strengthLabel(id, lang) {
    if (id === "standard") return i18n_default.t("botStrengthStandard", lang);
    return id;
  }
  function syncOptionToggles() {
    document.getElementById("opt-color-roads").checked = options.colorRoads !== false;
    document.getElementById("opt-color-cities").checked = options.colorCities !== false;
    document.getElementById("opt-color-monasteries").checked = options.colorMonasteries !== false;
  }
  function readOptionToggles() {
    options = game_default.normalizeGameOptions({
      colorRoads: document.getElementById("opt-color-roads").checked,
      colorCities: document.getElementById("opt-color-cities").checked,
      colorMonasteries: document.getElementById("opt-color-monasteries").checked
    });
  }
  function paint() {
    const list = document.getElementById("player-list");
    const canRemove = players.length > min;
    const lang = i18n_default.getLang();
    players.forEach((player) => {
      if (player.bot) player.name = game_default.botNameForColor(player.id, lang);
    });
    list.innerHTML = players.map((player, index) => {
      const used = usedColors(index);
      const swatches = palette.map((color) => {
        const taken = used.has(color.id);
        const on = color.id === player.id ? " on" : "";
        const disabled = taken && color.id !== player.id ? " disabled" : "";
        return '<button type="button" class="' + on.trim() + '" data-color="' + color.id + '" data-index="' + index + '" style="--swatch:' + color.hex + '"' + disabled + ' aria-label="' + i18n_default.colorLabel(color.id, lang) + '"></button>';
      }).join("");
      const strengthOpts = strengths.map((item) => {
        const selected = (player.botStrength || "standard") === item.id ? " selected" : "";
        return '<option value="' + item.id + '"' + selected + ">" + strengthLabel(item.id, lang) + "</option>";
      }).join("");
      return '<li class="player-row' + (player.bot ? " is-bot" : "") + '" data-index="' + index + '"><input type="text" maxlength="' + nameMax + '" value="' + player.name.replace(/"/g, "&quot;") + '" data-name="' + index + '" aria-label="' + i18n_default.t("playerName", lang) + '"' + (player.bot ? ' readonly tabindex="-1"' : "") + '><div class="player-kind"><label class="kind-label"><span class="sr-only">' + i18n_default.t("playerKind", lang) + '</span><select data-kind="' + index + '" aria-label="' + i18n_default.t("playerKind", lang) + '"><option value="human"' + (player.bot ? "" : " selected") + ">" + i18n_default.t("playerKindHuman", lang) + '</option><option value="bot"' + (player.bot ? " selected" : "") + ">" + i18n_default.t("playerKindBot", lang) + '</option></select></label><label class="strength-label' + (player.bot ? "" : " is-idle") + '"><span class="sr-only">' + i18n_default.t("botStrength", lang) + '</span><select data-strength="' + index + '" aria-label="' + i18n_default.t("botStrength", lang) + '"' + (player.bot ? "" : " disabled") + ">" + strengthOpts + '</select></label></div><div class="color-picks">' + swatches + '</div><button type="button" class="remove-player" data-remove="' + index + '"' + (canRemove ? "" : " disabled") + ' aria-label="' + i18n_default.t("removePlayer", lang) + '">\xD7</button></li>';
    }).join("");
    document.getElementById("add-player").disabled = players.length >= max || !nextFreeColor();
    document.getElementById("count-hint").textContent = i18n_default.t("playersCount", lang, { n: players.length, max });
  }
  document.querySelector(".option-list").addEventListener("change", () => {
    readOptionToggles();
    setErr("");
  });
  document.getElementById("player-list").addEventListener("input", (event) => {
    const input = event.target.closest("[data-name]");
    if (!input || input.readOnly) return;
    const index = Number(input.getAttribute("data-name"));
    if (players[index].bot) return;
    players[index].name = input.value.slice(0, nameMax);
    setErr("");
  });
  document.getElementById("player-list").addEventListener("change", (event) => {
    const kind = event.target.closest("[data-kind]");
    if (kind) {
      const index = Number(kind.getAttribute("data-kind"));
      const bot = kind.value === "bot";
      const player = players[index];
      if (bot && !player.bot) {
        player.humanName = player.name;
        player.name = game_default.botNameForColor(player.id, i18n_default.getLang());
      } else if (!bot && player.bot) {
        const restored = (player.humanName || "").trim().slice(0, nameMax);
        player.name = restored || game_default.nextPlayerName(players);
        player.humanName = null;
      }
      player.bot = bot;
      player.botStrength = bot ? game_default.normalizeBotStrength(player.botStrength, true) : null;
      setErr("");
      paint();
      return;
    }
    const strength = event.target.closest("[data-strength]");
    if (strength) {
      const index = Number(strength.getAttribute("data-strength"));
      players[index].botStrength = game_default.normalizeBotStrength(strength.value, true);
      setErr("");
    }
  });
  document.getElementById("player-list").addEventListener("click", (event) => {
    const colorBtn = event.target.closest("[data-color]");
    if (colorBtn && !colorBtn.disabled) {
      const index = Number(colorBtn.getAttribute("data-index"));
      players[index].id = colorBtn.getAttribute("data-color");
      if (players[index].bot) {
        players[index].name = game_default.botNameForColor(players[index].id, i18n_default.getLang());
      }
      setErr("");
      paint();
      return;
    }
    const remove = event.target.closest("[data-remove]");
    if (remove && !remove.disabled) {
      players.splice(Number(remove.getAttribute("data-remove")), 1);
      setErr("");
      paint();
    }
  });
  document.getElementById("add-player").addEventListener("click", () => {
    if (players.length >= max) return;
    const color = nextFreeColor();
    if (!color) return;
    players.push({
      id: color.id,
      name: game_default.nextPlayerName(players),
      bot: false,
      botStrength: null
    });
    setErr("");
    paint();
  });
  document.getElementById("start-game").addEventListener("click", () => {
    const lang = i18n_default.getLang();
    readOptionToggles();
    const cleaned = [];
    for (const player of players) {
      const name = player.bot ? game_default.botNameForColor(player.id, lang) : (player.name || "").trim().slice(0, nameMax) || game_default.nextPlayerName(cleaned);
      cleaned.push({
        id: player.id,
        name,
        bot: !!player.bot,
        botStrength: player.bot ? game_default.normalizeBotStrength(player.botStrength, true) : null
      });
    }
    const ids = cleaned.map((player) => player.id);
    if (cleaned.length < min || cleaned.length > max) {
      setErr(i18n_default.t("errNeedPlayers", lang, { min, max }));
      return;
    }
    if (new Set(ids).size !== ids.length) {
      setErr(i18n_default.t("errUniqueColor", lang));
      return;
    }
    try {
      localStorage.removeItem("tile-city-save");
    } catch (err) {
    }
    sessionStorage.setItem(SETUP_KEY, JSON.stringify({
      players: cleaned,
      options: game_default.normalizeGameOptions(options)
    }));
    location.href = "play.html";
  });
  i18n_default.bindLangBar(() => {
    setErr("");
    paint();
  });
  audio_default.bindVolumeBar();
  syncOptionToggles();
  paint();
})();
