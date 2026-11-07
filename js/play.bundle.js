(() => {
  // js/audio.js
  var VOLUME_KEY = "tile-city-volume";
  var SOUNDS = {
    tile: "assets/sound/tile.mp3",
    point: "assets/sound/point.mp3",
    clear: "assets/sound/clear.mp3",
    rouletteStart: "assets/sound/roulette/start.mp3",
    rouletteSlow: "assets/sound/roulette/slow.mp3",
    rouletteStop: "assets/sound/roulette/stop.mp3"
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
  function playHtmlFallback(src, onStarted, maxPlaySec) {
    return new Promise((resolve) => {
      let settled = false;
      let cutTimer = null;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (cutTimer != null) clearTimeout(cutTimer);
        resolve(result);
      };
      try {
        const audio = new Audio(src);
        audio.volume = volume;
        audio.addEventListener("error", () => finish({ ok: false, mode: "html-fallback", reason: "element-error" }), { once: true });
        audio.addEventListener("ended", () => finish({ ok: true, mode: "html-fallback", ended: true }), { once: true });
        void audio.play().then(
          () => {
            if (typeof onStarted === "function") onStarted();
            if (maxPlaySec != null && maxPlaySec > 0) {
              cutTimer = setTimeout(() => {
                try {
                  audio.pause();
                } catch (err) {
                }
                finish({ ok: true, mode: "html-fallback", cut: true });
              }, maxPlaySec * 1e3);
            }
          },
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
  function mixMono(buf) {
    const n = buf.length;
    const out = new Float32Array(n);
    const ch0 = buf.getChannelData(0);
    if (buf.numberOfChannels < 2) {
      out.set(ch0);
      return out;
    }
    const ch1 = buf.getChannelData(1);
    for (let i = 0; i < n; i++) out[i] = (ch0[i] + ch1[i]) * 0.5;
    return out;
  }
  function detectTicks(buf, opts) {
    if (!buf) return [];
    const thr = opts && opts.thr != null ? opts.thr : 0.05;
    const minGap = opts && opts.minGap != null ? opts.minGap : 0.04;
    const sampleRate = buf.sampleRate;
    const channel = mixMono(buf);
    const win = Math.max(1, Math.floor(sampleRate * 0.01));
    const hop = Math.max(1, Math.floor(sampleRate * 5e-3));
    const env = [];
    for (let i = 0; i + win < channel.length; i += hop) {
      let sum = 0;
      for (let j = 0; j < win; j++) sum += channel[i + j] * channel[i + j];
      env.push({ t: i / sampleRate, e: Math.sqrt(sum / win) });
    }
    const times = [];
    let last = -999;
    for (let i = 2; i < env.length - 2; i++) {
      const e = env[i].e;
      if (e > thr && e > env[i - 1].e && e > env[i - 2].e && e >= env[i + 1].e && e >= env[i + 2].e) {
        if (env[i].t - last < minGap) continue;
        times.push(env[i].t);
        last = env[i].t;
      }
    }
    return times;
  }
  async function peekTicks(src, tickOpts) {
    await resumeCtx();
    const buf = await loadBuffer(src);
    if (!buf) return [];
    return detectTicks(buf, tickOpts || {});
  }
  function getSoundDuration(src) {
    const buf = buffers.get(src);
    return buf && Number.isFinite(buf.duration) ? buf.duration : null;
  }
  function preloadSounds(srcs) {
    (srcs || []).forEach((src) => {
      if (!src) return;
      void loadBuffer(src);
      try {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = src;
      } catch (err) {
      }
    });
  }
  function armTickTimers(ticks, onTick, leadSec) {
    const timers = [];
    if (typeof onTick !== "function" || !ticks.length) return timers;
    const lead = Number.isFinite(leadSec) ? leadSec : 0;
    const origin = performance.now();
    ticks.forEach((at, index) => {
      const fireAt = Math.max(0, at - lead);
      timers.push(
        setTimeout(() => {
          onTick(index, at);
        }, Math.max(0, fireAt * 1e3 - (performance.now() - origin)))
      );
    });
    return timers;
  }
  async function playWithTicks(src, tickOpts, onTick, presetTicks) {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") {
      try {
        void ctx.resume();
      } catch (err) {
      }
    }
    const cached = buffers.get(src) || null;
    const maxPlaySec = tickOpts && tickOpts.maxPlaySec != null ? Number(tickOpts.maxPlaySec) : null;
    let ticks = Array.isArray(presetTicks) ? presetTicks.slice() : cached ? detectTicks(cached, tickOpts || {}) : [];
    if (maxPlaySec != null && maxPlaySec > 0) {
      ticks = ticks.filter((at) => at < maxPlaySec);
    }
    const leadSec = tickOpts && tickOpts.lead != null ? Number(tickOpts.lead) : 0;
    function waitTicksDone() {
      const last = ticks.length ? ticks[ticks.length - 1] : 0;
      const durMs = maxPlaySec != null && maxPlaySec > 0 ? maxPlaySec * 1e3 : cached ? cached.duration * 1e3 : Math.max(800, last * 1e3 + 80);
      return new Promise(
        (resolve) => setTimeout(resolve, Math.max(durMs, last * 1e3 + 30))
      );
    }
    if (!(volume > 0)) {
      const timers2 = armTickTimers(ticks, onTick, leadSec);
      await waitTicksDone();
      timers2.forEach((id) => clearTimeout(id));
      return { ok: true, mode: "silent", ticks };
    }
    let timers = [];
    let result = await playHtmlFallback(src, () => {
      timers = armTickTimers(ticks, onTick, leadSec);
    }, maxPlaySec);
    if (!result.ok) {
      timers.forEach((id) => clearTimeout(id));
      let buf = cached;
      if (!buf) buf = await loadBuffer(src);
      if (buf && ctx) {
        try {
          await resumeCtx();
        } catch (err) {
        }
        const playPromise = playBuffer(buf, ctx);
        timers = armTickTimers(ticks, onTick, leadSec);
        result = await playPromise;
        if (maxPlaySec != null && maxPlaySec > 0) {
          await new Promise((resolve) => setTimeout(resolve, maxPlaySec * 1e3));
          result = { ok: true, mode: "web-audio", cut: true };
        }
      }
    }
    if (!result.ok) {
      timers.forEach((id) => clearTimeout(id));
      timers = armTickTimers(ticks, onTick, leadSec);
      await waitTicksDone();
    }
    timers.forEach((id) => clearTimeout(id));
    return Object.assign({ ticks }, result || { ok: false });
  }
  function unlockAudio() {
    unlocked = true;
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") {
      try {
        void ctx.resume();
      } catch (err) {
      }
    }
    void resumeCtx().then(() => warmCommon());
    return resumeCtx();
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
    playWithTicks,
    peekTicks,
    getSoundDuration,
    preloadSounds,
    detectTicks,
    playMeepleSound,
    playWinSound,
    playEndFanfare,
    bindVolumeBar,
    unlockAudio,
    getAudioDebugState,
    SOUNDS
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
    { id: "standard", label: "Standard" },
    { id: "master", label: "Master" }
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
      earnedDim: !!meeple.earnedDim,
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
  function scoreFeature(game2, kind, parts, points, options) {
    const opts = options || {};
    const winners = majorityPlayers(
      meepleCountsOnFeature(game2.board, kind, parts, game2.players.length)
    );
    if (winners.length) {
      const live = buildFeatureClaims(game2);
      stampFeatureClaimsFromMap(game2.board, kind, parts, live);
    }
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
  function buildFeatureClaims(game2) {
    const claims = /* @__PURE__ */ new Map();
    const seen = /* @__PURE__ */ new Set();
    const board = game2.board;
    const players = game2.players || [];
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
  function createGame(random, players, options) {
    const roll = random || Math.random;
    const tiles = buildTiles();
    const start = tiles.find((tile) => tile.start);
    const deck = shuffle(tiles.filter((tile) => !tile.start), roll);
    const game2 = new Game(deck, players, options);
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
      if (game2.pendingConfirm && !game2.confirmTurnEnd()) break;
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
  function serializeGame(game2) {
    return {
      v: SAVE_VERSION,
      players: game2.players.map((player) => ({
        id: player.id,
        name: player.name,
        bot: !!player.bot,
        botStrength: player.bot ? player.botStrength || "standard" : null
      })),
      options: normalizeGameOptions(game2.options),
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
      pendingConfirm: game2.pendingConfirm ? Object.assign({}, game2.pendingConfirm) : null,
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
    const game2 = new Game(
      (data.deck || []).map((tile) => makeTile(tile.id, tile.start)),
      players,
      data.options
    );
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
    game2.pendingConfirm = data.pendingConfirm ? Object.assign({}, data.pendingConfirm) : null;
    game2.pendingDiscard = !!data.pendingDiscard;
    game2.standings = Array.isArray(data.standings) ? data.standings.slice() : players.map((_, index) => index);
    game2.finalScored = !!data.finalScored;
    game2.rankingOpen = !!data.rankingOpen;
    if (!game2.finished) game2.reconcileHand();
    return game2;
  }

  // js/game/botMaster.js
  function clamp01(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x;
  }
  function featureMajority(board, kind, parts, playerCount) {
    return majorityPlayers(meepleCountsOnFeature(board, kind, parts, playerCount));
  }
  function componentKey(parts) {
    return parts.map((p) => p.x + "," + p.y + "," + p.index).sort().join("|");
  }
  function partKeySet(parts) {
    const set = /* @__PURE__ */ new Set();
    for (const p of parts) set.add(p.x + "," + p.y + "," + p.index);
    return set;
  }
  function setsOverlap(a, b) {
    for (const k of a) {
      if (b.has(k)) return true;
    }
    return false;
  }
  function deckSupply(game2) {
    let cityEdges = 0;
    let roadEdges = 0;
    let cityTiles = 0;
    let roadTiles = 0;
    const byId = /* @__PURE__ */ Object.create(null);
    const tiles = (game2.deck || []).concat(game2.current ? [game2.current] : []);
    for (const tile of tiles) {
      byId[tile.id] = (byId[tile.id] || 0) + 1;
      const type = BY_ID[tile.id];
      if (!type || !type.edges) continue;
      let hasC = false;
      let hasR = false;
      for (const edge of type.edges) {
        if (edge === "C") {
          cityEdges += 1;
          hasC = true;
        }
        if (edge === "R") {
          roadEdges += 1;
          hasR = true;
        }
      }
      if (hasC) cityTiles += 1;
      if (hasR) roadTiles += 1;
    }
    return {
      byId,
      cityEdges,
      roadEdges,
      cityTiles,
      roadTiles,
      remaining: tiles.length,
      deckLen: (game2.deck || []).length
    };
  }
  function futureDrawsFor(game2, targetPlayer) {
    const n = game2.players.length;
    if (n <= 0 || targetPlayer < 0 || targetPlayer >= n) return 0;
    const holder = game2.player;
    let count = 0;
    if (game2.current && holder === targetPlayer) count += 1;
    const deck = game2.deck || [];
    for (let i = 0; i < deck.length; i++) {
      if ((holder + 1 + i) % n === targetPlayer) count += 1;
    }
    return count;
  }
  function binomAtLeast(draws, p, need) {
    if (need <= 0) return 1;
    if (draws < need) return 0;
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const q = 1 - p;
    let term = Math.pow(q, draws);
    let prob = 0;
    for (let k = 0; k <= draws; k++) {
      if (k >= need) prob += term;
      if (k === draws) break;
      term *= (draws - k) / (k + 1) * (p / q);
    }
    return clamp01(prob);
  }
  function edgeWant(kind) {
    return kind === "city" ? "C" : "R";
  }
  function connectsFeature(kind, edges, linkDirs) {
    const want = edgeWant(kind);
    for (const dir of linkDirs) {
      if (edges[DIR_INDEX[dir]] !== want) return false;
    }
    return true;
  }
  function listOpenSlots(board, kind, parts) {
    const slots = /* @__PURE__ */ new Map();
    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile) continue;
      const rot = tile.rot || 0;
      if (kind === "city") {
        const city2 = tile.cities && tile.cities[part.index];
        if (!city2) continue;
        for (const catalogDir of city2.edges) {
          const dir = absDir(catalogDir, rot);
          const step = NEI[DIR_INDEX[dir]];
          const nx = part.x + step.dx;
          const ny = part.y + step.dy;
          const neighbor = board.get(keyOf(nx, ny));
          if (neighbor) {
            if (findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]) >= 0) continue;
            return { slots: [], blocked: true };
          }
          const key = keyOf(nx, ny);
          const fromDir = OPP_DIR[dir];
          let slot = slots.get(key);
          if (!slot) {
            slot = { x: nx, y: ny, linkDirs: [] };
            slots.set(key, slot);
          }
          if (!slot.linkDirs.includes(fromDir)) slot.linkDirs.push(fromDir);
        }
      } else if (kind === "road") {
        const road2 = tile.roads && tile.roads[part.index];
        if (!road2) continue;
        for (const catalogDir of road2) {
          const dir = absDir(catalogDir, rot);
          const step = NEI[DIR_INDEX[dir]];
          const nx = part.x + step.dx;
          const ny = part.y + step.dy;
          const neighbor = board.get(keyOf(nx, ny));
          if (neighbor) {
            if (findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]) >= 0) continue;
            return { slots: [], blocked: true };
          }
          const key = keyOf(nx, ny);
          const fromDir = OPP_DIR[dir];
          let slot = slots.get(key);
          if (!slot) {
            slot = { x: nx, y: ny, linkDirs: [] };
            slots.set(key, slot);
          }
          if (!slot.linkDirs.includes(fromDir)) slot.linkDirs.push(fromDir);
        }
      }
    }
    return { slots: [...slots.values()], blocked: false };
  }
  function typeFitsSlot(board, kind, type, slot) {
    for (let rot = 0; rot < 4; rot++) {
      const edges = rotateEdges(type.edges, rot);
      if (!canPlace(board, slot.x, slot.y, edges)) continue;
      if (!connectsFeature(kind, edges, slot.linkDirs)) continue;
      return true;
    }
    return false;
  }
  function catalogFitsSlot(board, kind, slot) {
    for (const type of TYPES) {
      if (typeFitsSlot(board, kind, type, slot)) return true;
    }
    return false;
  }
  function analyzeClosability(board, kind, parts, supply) {
    const { slots, blocked } = listOpenSlots(board, kind, parts);
    if (blocked) {
      return { impossible: true, reason: "blocked", deckUseful: 0, slotCount: 0 };
    }
    if (!slots.length) {
      return { impossible: false, reason: "closed", deckUseful: 0, slotCount: 0 };
    }
    for (const slot of slots) {
      if (!catalogFitsSlot(board, kind, slot)) {
        return { impossible: true, reason: "catalog", deckUseful: 0, slotCount: slots.length };
      }
    }
    let deckUseful = 0;
    const byId = supply && supply.byId || /* @__PURE__ */ Object.create(null);
    for (const id of Object.keys(byId)) {
      const count = byId[id] || 0;
      if (count <= 0) continue;
      const type = BY_ID[id];
      if (!type) continue;
      let fits = false;
      for (const slot of slots) {
        if (typeFitsSlot(board, kind, type, slot)) {
          fits = true;
          break;
        }
      }
      if (fits) deckUseful += count;
    }
    if (deckUseful <= 0) {
      return { impossible: true, reason: "deck", deckUseful: 0, slotCount: slots.length };
    }
    return { impossible: false, reason: "ok", deckUseful, slotCount: slots.length };
  }
  function closeChancePaths(openings, kind, supply, game2, me, beneficiaries, board, parts) {
    const need = Math.max(1, Math.min(Math.max(0, openings), 3));
    let useful;
    let impossible = false;
    if (board && parts && (kind === "city" || kind === "road")) {
      const analysis = analyzeClosability(board, kind, parts, supply);
      useful = analysis.deckUseful;
      impossible = analysis.impossible || openings >= 5;
    } else {
      useful = kind === "city" ? supply.cityTiles || 0 : supply.roadTiles || 0;
      impossible = openings >= 5 || openings >= 1 && useful <= 0;
    }
    if (impossible || openings >= 1 && useful <= 0) {
      return {
        pSelf: 0,
        pOpp: 0,
        combined: 0,
        useful: useful || 0,
        need,
        impossible: true
      };
    }
    const pool = Math.max(1, supply.remaining || 0);
    const pTile = Math.min(1, useful / pool);
    const benef = Array.isArray(beneficiaries) ? beneficiaries : [];
    const pSelf = benef.includes(me) ? binomAtLeast(futureDrawsFor(game2, me), pTile, need) : 0;
    let pOpp = 0;
    for (const b of benef) {
      if (b === me) continue;
      const pb = binomAtLeast(futureDrawsFor(game2, b), pTile, need);
      pOpp = 1 - (1 - pOpp) * (1 - pb);
    }
    const combined = 1 - (1 - pSelf) * (1 - pOpp);
    return {
      pSelf,
      pOpp,
      combined: clamp01(combined),
      useful,
      need,
      impossible: false
    };
  }
  function scoreLag(scores, me, lagRef) {
    const ref = lagRef > 0 ? lagRef : 10;
    const my = scores[me] || 0;
    let lead = my;
    for (let i = 0; i < scores.length; i++) {
      if (i === me) continue;
      if ((scores[i] || 0) > lead) lead = scores[i] || 0;
    }
    return clamp01((lead - my) / ref);
  }
  function listIncompleteCities(board, playerCount, countOpenEdges2) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const [pos, tile] of board) {
      const [x, y] = pos.split(",").map(Number);
      (tile.cities || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seen.has(seed)) return;
        const result = collectCityComponent(board, x, y, index);
        for (const part of result.parts) seen.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        const winners = featureMajority(board, "city", result.parts, playerCount);
        if (!winners.length) return;
        const tiles = uniqueTileCount(result.parts);
        const pennants = cityPennantCount(board, result.parts);
        const openings = countOpenEdges2(board, "city", result.parts);
        out.push({
          id: componentKey(result.parts),
          kind: "city",
          parts: result.parts,
          partSet: partKeySet(result.parts),
          winners,
          tiles,
          pennants,
          size: tiles + pennants,
          openings
        });
      });
    }
    return out;
  }
  function listIncompleteRoads(board, playerCount, countOpenEdges2) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const [pos, tile] of board) {
      const [x, y] = pos.split(",").map(Number);
      (tile.roads || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seen.has(seed)) return;
        const result = collectRoadComponent(board, x, y, index);
        for (const part of result.parts) seen.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        const winners = featureMajority(board, "road", result.parts, playerCount);
        if (!winners.length) return;
        const tiles = uniqueTileCount(result.parts);
        const openings = countOpenEdges2(board, "road", result.parts);
        out.push({
          id: componentKey(result.parts),
          kind: "road",
          parts: result.parts,
          partSet: partKeySet(result.parts),
          winners,
          tiles,
          pennants: 0,
          size: tiles,
          openings
        });
      });
    }
    return out;
  }
  function listFields(board, playerCount) {
    const seen = /* @__PURE__ */ new Set();
    const out = [];
    for (const [pos, tile] of board) {
      if (!tile.meeple || tile.meeple.kind !== "field") continue;
      const [x, y] = pos.split(",").map(Number);
      const index = tile.meeple.index;
      const seed = x + "," + y + "," + index;
      if (seen.has(seed)) continue;
      const result = collectFieldComponent(board, x, y, index);
      for (const part of result.parts) seen.add(part.x + "," + part.y + "," + part.index);
      const winners = featureMajority(board, "field", result.parts, playerCount);
      if (!winners.length) continue;
      const cities = completedCitiesTouchingField(board, result.parts);
      out.push({
        id: componentKey(result.parts),
        kind: "field",
        parts: result.parts,
        partSet: partKeySet(result.parts),
        winners,
        tiles: uniqueTileCount(result.parts),
        pennants: 0,
        size: cities,
        openings: 0
      });
    }
    return out;
  }
  function overlapping(list, feat) {
    const out = [];
    for (const other of list) {
      if (other.kind !== feat.kind) continue;
      if (setsOverlap(feat.partSet, other.partSet)) out.push(other);
    }
    return out;
  }
  function isBig(feat, weights) {
    if (feat.kind === "city") return feat.size >= (weights.joinCityMin == null ? 4 : weights.joinCityMin);
    if (feat.kind === "road") return feat.size >= (weights.joinRoadMin == null ? 4 : weights.joinRoadMin);
    if (feat.kind === "field") return feat.size >= (weights.joinFieldMin == null ? 2 : weights.joinFieldMin);
    return false;
  }
  function enemySoleOwner(feat, me) {
    if (feat.winners.length === 1 && feat.winners[0] !== me) return feat.winners[0];
    return null;
  }
  function pathsFor(feat, supply, game2, me) {
    if (feat.kind === "field") {
      return { pSelf: 0, pOpp: 0, combined: 0, impossible: true };
    }
    return closeChancePaths(
      feat.openings,
      feat.kind,
      supply,
      game2,
      me,
      feat.winners,
      game2.board,
      feat.parts
    );
  }
  function featureExpectedPoints(feat, pClose) {
    const endPts = feat.size;
    const completePts = feat.kind === "city" ? feat.size * 2 : feat.size;
    const p = clamp01(pClose);
    return p * completePts + (1 - p) * endPts;
  }
  function masterExtraScore(ctx) {
    const { before, after, me, weights, placed, countOpenEdges: countOpenEdges2, turnsAfter } = ctx;
    if (!weights || !weights.isMaster) return 0;
    const n = before.players.length;
    const supplyAfter = deckSupply(after);
    const supplyBefore = deckSupply(before);
    const lag = scoreLag(before.scores, me, weights.lagRef == null ? 10 : weights.lagRef);
    const lastTurn = (turnsAfter == null ? 1 : turnsAfter) <= 0;
    const citiesBefore = listIncompleteCities(before.board, n, countOpenEdges2);
    const citiesAfter = listIncompleteCities(after.board, n, countOpenEdges2);
    const roadsBefore = listIncompleteRoads(before.board, n, countOpenEdges2);
    const roadsAfter = listIncompleteRoads(after.board, n, countOpenEdges2);
    const fieldsBefore = listFields(before.board, n);
    const fieldsAfter = listFields(after.board, n);
    let value = 0;
    const evSelf = weights.evSelf || 0;
    const supplyOpp = weights.supplyOpp || 0;
    const deadClaim = weights.deadClaim || 0;
    for (const feat of citiesAfter.concat(roadsAfter)) {
      const paths = pathsFor(feat, supplyAfter, after, me);
      if (feat.winners.includes(me)) {
        if (paths.impossible) {
          if (lastTurn) {
            if (evSelf) value += evSelf * feat.size;
          } else if (deadClaim) {
            value += deadClaim * feat.size;
          }
        } else if (evSelf) {
          value += evSelf * featureExpectedPoints(feat, paths.combined);
        }
      }
      const enemy = enemySoleOwner(feat, me);
      if (enemy != null && isBig(feat, weights) && supplyOpp && !paths.impossible) {
        value += supplyOpp * feat.size * paths.pOpp;
      }
    }
    const joinOk = weights.joinOk || 0;
    const joinFail = weights.joinFail || 0;
    const joinKinds = [
      { before: citiesBefore, after: citiesAfter },
      { before: roadsBefore, after: roadsAfter },
      { before: fieldsBefore, after: fieldsAfter }
    ];
    for (const group of joinKinds) {
      for (const feat of group.after) {
        if (!isBig(feat, weights)) continue;
        const prevs = overlapping(group.before, feat);
        const meNow = feat.winners.includes(me);
        const meBefore = prevs.some((p) => p.winners.includes(me));
        const enemyNow = enemySoleOwner(feat, me);
        const paths = feat.kind === "field" ? { impossible: false } : pathsFor(feat, supplyAfter, after, me);
        if (meNow && joinOk && !paths.impossible) {
          const maxOwnBefore = prevs.filter((p) => p.winners.includes(me)).reduce((m, p) => Math.max(m, p.size), 0);
          const newlyIn = !meBefore;
          const grewMerge = meBefore && feat.size > maxOwnBefore;
          if (newlyIn || grewMerge) {
            value += joinOk * feat.size * 1;
          }
        }
        if (enemyNow != null && meBefore && !meNow && joinFail) {
          value += joinFail * feat.size;
        }
      }
    }
    if (lag > 0) {
      const denyBlock = weights.denyBlock || 0;
      const denyFatten = weights.denyFatten || 0;
      const denyGroups = [
        { before: citiesBefore, after: citiesAfter },
        { before: roadsBefore, after: roadsAfter }
      ];
      for (const group of denyGroups) {
        for (const feat of group.after) {
          const enemy = enemySoleOwner(feat, me);
          if (enemy == null) continue;
          if (!isBig(feat, weights)) continue;
          const pathsAfter = pathsFor(feat, supplyAfter, after, me);
          const pBlockAfter = 1 - pathsAfter.pOpp;
          const prevs = overlapping(group.before, feat);
          let pBlockBefore = 1;
          let sizeBefore = 0;
          if (prevs.length) {
            const prior = prevs.find((p) => enemySoleOwner(p, me) != null) || prevs[0];
            sizeBefore = prior.size;
            const pathsBefore = pathsFor(prior, supplyBefore, before, me);
            pBlockBefore = 1 - pathsBefore.pOpp;
          }
          const dBlock = pBlockAfter - pBlockBefore;
          const dSize = feat.size - sizeBefore;
          if (denyBlock && dBlock > 0) {
            value += lag * denyBlock * feat.size * dBlock;
          }
          if (denyFatten && dSize > 0) {
            value += lag * denyFatten * dSize * pathsAfter.pOpp;
          }
        }
      }
    }
    if (placed) {
      const board = after.board;
      const here = board.get(keyOf(placed.x, placed.y));
      if (weights.monasteryClaim && here && here.monastery && here.meeple && here.meeple.kind === "monastery" && here.meeple.player === me) {
        value += weights.monasteryClaim;
      }
      if (weights.monasteryPush) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const spot = board.get(keyOf(placed.x + dx, placed.y + dy));
            if (!spot || !spot.monastery || !spot.meeple || spot.meeple.kind !== "monastery") continue;
            if (spot.meeple.player !== me) continue;
            if (monasteryComplete(board, placed.x + dx, placed.y + dy)) continue;
            const filled = monasteryTileCount(board, placed.x + dx, placed.y + dy);
            value += weights.monasteryPush * Math.max(0, filled - 5);
          }
        }
      }
    }
    const posCap = weights.extraPosCap == null ? 4.5 : weights.extraPosCap;
    const negCap = weights.extraNegCap == null ? -7 : weights.extraNegCap;
    if (value > posCap) value = posCap;
    if (value < negCap) value = negCap;
    return value;
  }
  function masterFieldAllowed(phase, completedCities, stock, turnsAfter) {
    if (completedCities <= 0) return false;
    if (turnsAfter != null && turnsAfter <= 0) return true;
    if (phase === "early") return false;
    if (phase === "end" || phase === "late") return true;
    if (stock <= 1) return completedCities >= 3;
    return completedCities >= 2;
  }

  // js/game/bot.js
  var STANDARD_WEIGHTS = {
    immediateSelf: 1,
    endSelf: 0.7,
    meepleReturn: 0.45,
    equity: 0.4,
    openClose: 1.25,
    exclusiveComplete: 0.22,
    immediateOpp: -0.85,
    endOpp: -0.45,
    sharedOppScale: 0.3,
    gift: -0.4,
    enemyCompleteGift: -6,
    openWaste: -1.5,
    earlyFieldBan: -3,
    skipMonastery: -2.5,
    oppLeadGift: -0.35,
    isMaster: false
  };
  var BOT_WEIGHTS = {
    standard: STANDARD_WEIGHTS,
    master: Object.assign({}, STANDARD_WEIGHTS, {
      isMaster: true,
      // Keep base scoring close to standard so extras cannot overturn free points.
      equity: 0.35,
      gift: -0.35,
      enemyCompleteGift: -7,
      // Master extras — small deltas only (see extraPosCap / extraNegCap).
      evSelf: 0.18,
      supplyOpp: -0.2,
      joinOk: 0.25,
      joinFail: -0.5,
      joinCityMin: 3,
      joinRoadMin: 3,
      joinFieldMin: 2,
      lagRef: 12,
      denyBlock: 0.45,
      denyFatten: -0.35,
      deadClaim: -2.5,
      monasteryPush: 0.85,
      monasteryClaim: 2.2,
      extraPosCap: 4.5,
      extraNegCap: -7
    })
  };
  function turnsAfterThis(game2, me) {
    const draws = futureDrawsFor(game2, me);
    if (game2.current && game2.player === me) return Math.max(0, draws - 1);
    return draws;
  }
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
  function featureMajority2(board, kind, parts, playerCount) {
    return majorityPlayers(meepleCountsOnFeature(board, kind, parts, playerCount));
  }
  function stockPenalty(stock, immediateSelf, turnsAfter) {
    if (immediateSelf >= 4) return 0;
    if (turnsAfter <= 0) return 0;
    let raw = 0;
    if (stock >= 4) raw = 0;
    else if (stock === 3) raw = 0.4;
    else if (stock === 2) raw = 1;
    else if (stock === 1) raw = 2.5;
    return raw * Math.min(1, turnsAfter / 3);
  }
  function fieldAllowed(phase, completedCities, stock, master, turnsAfter) {
    if (completedCities <= 0) return false;
    if (turnsAfter <= 0) return true;
    if (master) return masterFieldAllowed(phase, completedCities, stock, turnsAfter);
    if (phase === "early") return false;
    if (phase === "mid") return completedCities >= 2 && stock >= 2;
    return true;
  }
  function meepleOptions(game2, phase, master, turnsAfter) {
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
        if (!fieldAllowed(phase, cities, stock, master, turnsAfter)) continue;
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
    const t3 = EQUITY_TUNING;
    const cityBonus = (phase === "early" ? t3.earlyCityMul : 1) * t3.cityMul;
    const roadBonus = (phase === "early" ? t3.earlyRoadMul : 1) * t3.roadMul;
    const fieldPhase = FIELD_PHASE[phase] || FIELD_PHASE.mid;
    for (const [pos, tile] of board) {
      const [x, y] = pos.split(",").map(Number);
      (tile.cities || []).forEach((_, index) => {
        const seed = x + "," + y + "," + index;
        if (seenCities.has(seed)) return;
        const result = collectCityComponent(board, x, y, index);
        for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
        if (result.complete) return;
        const winners = featureMajority2(board, "city", result.parts, n);
        if (!winners.length) return;
        const tiles = uniqueTileCount(result.parts);
        const pennants = cityPennantCount(board, result.parts);
        const openings = countOpenEdges(board, "city", result.parts);
        const completeBonus = openings <= 1 ? t3.cityOpen1 : openings === 2 ? t3.cityOpen2 : t3.cityOpen3Plus;
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
        const winners = featureMajority2(board, "road", result.parts, n);
        if (!winners.length) return;
        const tiles = uniqueTileCount(result.parts);
        const openings = countOpenEdges(board, "road", result.parts);
        const value = tiles * (openings <= 1 ? t3.roadOpen1 : t3.roadOpen2Plus) * roadBonus;
        if (winners.includes(me)) equity += value;
        else gift += value;
      });
      if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery" && !monasteryComplete(board, x, y)) {
        const filled = monasteryTileCount(board, x, y);
        const value = filled * t3.monasteryFilled + (9 - filled) * t3.monasteryEmpty;
        if (tile.meeple.player === me) equity += value;
        else gift += value;
      }
      if (tile.meeple && tile.meeple.kind === "field") {
        const seed = x + "," + y + "," + tile.meeple.index;
        if (seenFields.has(seed)) continue;
        const result = collectFieldComponent(board, x, y, tile.meeple.index);
        for (const part of result.parts) seenFields.add(part.x + "," + part.y + "," + part.index);
        const winners = featureMajority2(board, "field", result.parts, n);
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
      const winners = featureMajority2(afterBoard, "city", after.parts, 8);
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
  function betterScore(scored, place, best, lastTurn) {
    if (!best) return true;
    if (scored.value !== best.scored.value) return scored.value > best.scored.value;
    if (scored.immSelf !== best.scored.immSelf) return scored.immSelf > best.scored.immSelf;
    if (scored.returned !== best.scored.returned) return scored.returned > best.scored.returned;
    if (scored.stock !== best.scored.stock) {
      return lastTurn ? scored.stock < best.scored.stock : scored.stock > best.scored.stock;
    }
    if (!place || !best.place) return false;
    return place.y < best.place.y || place.y === best.place.y && place.x < best.place.x;
  }
  function evaluateApplied(before, after, me, weights, phase, placed, meepleUsed, stockBefore, optionKind, endBefore, deep, turnsAfter) {
    const n = before.players.length;
    const immSelf = scoreDelta(before.scores, after.scores, me);
    const immOpp = bestOppDelta(before.scores, after.scores, me, n);
    const returned = Math.max(0, after.meeples[me] - (stockBefore - (meepleUsed ? 1 : 0)));
    const eg = equityAndGift(after, me, weights, phase);
    const sharedScale = weights.sharedOppScale == null ? 1 : weights.sharedOppScale;
    const lastTurn = turnsAfter <= 0;
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
    if (meepleUsed) value -= stockPenalty(stockBefore, immSelf, turnsAfter);
    if (placed) {
      value += cityOpeningDeltaScore(before.board, after.board, placed.x, placed.y, me, weights);
      const tile = after.board.get(keyOf(placed.x, placed.y));
      if (tile && tile.monastery && meepleUsed && optionKind && optionKind !== "monastery") {
        value += weights.skipMonastery;
      }
      if (optionKind === "field" && !lastTurn) {
        if (phase === "early") value += weights.earlyFieldBan;
        else if (phase === "mid" && stockBefore <= 2) value += weights.earlyFieldBan * 0.5;
      }
    }
    if (weights.isMaster) {
      value += masterExtraScore({
        before,
        after,
        me,
        weights,
        placed,
        countOpenEdges,
        turnsAfter
      });
    }
    return {
      value,
      immSelf,
      immOpp,
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
  function considerOption(best, scored, place, slotId, lastTurn) {
    const candidate = { place, slotId, scored };
    return betterScore(scored, place, best, lastTurn) ? candidate : best;
  }
  function finishIfConfirm(game2) {
    if (game2.pendingConfirm && !game2.confirmTurnEnd()) return false;
    return true;
  }
  function applyMeepleChoice(game2, slotId) {
    const after = cloneGame(game2);
    if (slotId) {
      if (!after.placeMeeple(slotId)) return null;
    } else if (!after.skipMeeple()) {
      return null;
    }
    if (!finishIfConfirm(after)) return null;
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
    if (!finishIfConfirm(placed)) return null;
    return placed;
  }
  function chooseBotAction(game2, strength) {
    const level = strength && BOT_WEIGHTS[strength] ? strength : "standard";
    const weights = BOT_WEIGHTS[level];
    if (!game2 || game2.finished) return null;
    if (game2.pendingDiscard) return { type: "discard" };
    const phase = deckPhase(game2.deck.length);
    const endMul = phase === "end" ? 1.15 : 1;
    const endBefore = projectedScores(game2);
    const master = !!weights.isMaster;
    if (game2.pendingMeeple) {
      const me2 = game2.pendingMeeple.player;
      const turnsAfter2 = turnsAfterThis(game2, me2);
      const lastTurn2 = turnsAfter2 <= 0;
      const tuned2 = Object.assign({}, weights, {
        endSelf: weights.endSelf * endMul * (lastTurn2 ? 1.5 : 1),
        endOpp: weights.endOpp * endMul,
        equity: weights.equity * (lastTurn2 ? 1.25 : 1)
      });
      const place = { x: game2.pendingMeeple.x, y: game2.pendingMeeple.y, rot: 0 };
      const stockBefore2 = game2.meeples[me2];
      const shortlist2 = [];
      for (const option of meepleOptions(game2, phase, master, turnsAfter2)) {
        const after = applyMeepleChoice(game2, option.slotId);
        if (!after) continue;
        const scored = evaluateApplied(
          game2,
          after,
          me2,
          tuned2,
          phase,
          place,
          !!option.slotId,
          stockBefore2,
          option.kind,
          endBefore,
          false,
          turnsAfter2
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
          tuned2,
          phase,
          place,
          !!item.slotId,
          stockBefore2,
          item.kind,
          endBefore,
          true,
          turnsAfter2
        );
        best2 = considerOption(best2, scored, place, item.slotId, lastTurn2);
      }
      return { type: "meeple", slotId: best2 ? best2.slotId : null };
    }
    if (!game2.current) return null;
    const me = game2.player;
    const turnsAfter = turnsAfterThis(game2, me);
    const lastTurn = turnsAfter <= 0;
    const tuned = Object.assign({}, weights, {
      endSelf: weights.endSelf * endMul * (lastTurn ? 1.5 : 1),
      endOpp: weights.endOpp * endMul,
      equity: weights.equity * (lastTurn ? 1.25 : 1)
    });
    const stockBefore = game2.meeples[me];
    const placements = listPlacements(game2);
    const shortlist = [];
    for (const place of placements) {
      const placedOnly = cloneGame(game2);
      placedOnly.setRotation(place.rot);
      if (!placedOnly.place(place.x, place.y)) continue;
      for (const option of meepleOptions(placedOnly, phase, master, turnsAfter)) {
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
          false,
          turnsAfter
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
        true,
        turnsAfter
      );
      best = considerOption(best, scored, item.place, item.slotId, lastTurn);
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
      addHome: "Add to Home Screen",
      addHomeTitle: "Add to Home Screen",
      addHomeTabIos: "iPhone",
      addHomeTabAndroid: "Android",
      addHomePlatformLabel: "Platform",
      addHomeIosIntro: "Add TileCity to your Home Screen from Safari\u2019s Share menu and play it like an app!",
      addHomeIosStep1: "Open this site in Safari.",
      addHomeIosStep2: "Tap the Share button at the bottom (or in the toolbar).",
      addHomeIosStep3: "Scroll and choose \u201CAdd to Home Screen\u201D, then tap Add.",
      addHomeIosActionLabel: "Add to Home Screen",
      addHomeAndroidIntro: "Add TileCity from Chrome\u2019s browser menu!",
      addHomeAndroidStep1: "Open this site in Chrome.",
      addHomeAndroidStep2: "Tap the \u22EE menu at the top right.",
      addHomeAndroidStep3: "Choose \u201CAdd to Home screen\u201D or \u201CInstall app\u201D, then confirm.",
      addHomeAndroidAddLabel: "Add to Home screen",
      addHomeAndroidNote: "Menu names vary by browser and phone maker.",
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
      botStrengthMaster: "Master",
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
      basicsTitle: "Your turn",
      basicsPlace: "Draw one tile and place it adjacent to tiles already on the board. Every touching edge must match.",
      basicsMeeple: "You may place one meeple on a city, road, monastery, or grassland on the tile you just placed.",
      basicsOccupied: "You cannot place a meeple on a feature that already has any meeple \u2014 even far along the same connected area.",
      basicsScore: "A finished city, road, or monastery scores right away, and those meeples return to their owners.",
      basicsFarm: "A meeple laid on grassland stays until the end of the game.",
      refCity: "City",
      refRoad: "Road",
      refMonastery: "Monastery",
      refField: "Grassland",
      refMeeple: "Meeple",
      tocTutorial: "Tutorial",
      tocDetails: "Notes",
      tocTiles: "Tiles A\u2013X",
      tutTitle: "How to play",
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
      tut3Body: "Put a monastery tile down and you may seat a meeple on it. Framed cells can earn monastery points once filled \u2014 it scores when all eight neighbors are taken.",
      tut3Score: "No points yet",
      tut4Title: "Cities merge \u2014 shared score",
      tut4Body: "When each side has the same number of meeples in a merged city, both score the same points.",
      tut4Score: "Tied majority (4 tiles)",
      tut5Title: "Finish a monastery",
      tut5Body: "Fill the last empty space around a monastery. The meeple scores and returns to your hand.",
      tut5Score: "Monastery: 9 points when the 3\xD73 is full",
      tut6Title: "Cities merge \u2014 you alone",
      tut6Body: "If you have more meeples than anyone else in a merged city, only you score. If the city has a pennant, add +2 for the pennant.",
      tut6Score: "2 vs 1 \u2192 only you +12 (5 tiles + 1 pennant)",
      tut7Title: "Grassland scoring",
      tut7Body: "At game end, grassland scores 3 points for each completed city it touches. Terrain cut off by roads or cities \u2014 including corners \u2014 is treated as separate.",
      tut7Score: "Three completed cities \u2192 +9",
      detailsTitle: "Notes",
      notesLead: "Scoring chart and the full tile list.",
      tocPlace: "How to place",
      tocMeeple: "Meeples",
      tocScore: "Scoring",
      tocControls: "Controls",
      tocGoal: "Goal",
      tocSetup: "Setup",
      tocTurn: "Turn",
      tocEnd: "Game end",
      goalTitle: "Goal",
      goalBody: "Take turns placing tiles and meeples. Complete roads, cities, and monasteries during the game to score points. When the last tile is placed, score leftover roads, cities, monasteries, and grasslands. Highest score wins.",
      setupSecTitle: "Setup",
      setupPlayers: "Players",
      setupPlayersBody: "2\u20138 players. Each color has 7 meeples. On the prepare screen, choose names (max 10 letters) and unique colors.",
      setupStartTile: "Start tile",
      setupStartTileBody: "Place the marked D tile face-up in the center. Shuffle the other 71 tiles into the deck.",
      setupFirst: "First player",
      setupFirstBody: "A roulette on the play screen picks the starting player at random. Turns then follow the player list order.",
      rouletteTitle: "Roulette",
      rouletteLead: "Choose the starting player.",
      rouletteStart: "Start",
      rouletteGoesFirst: "goes first!",
      turnTitle: "On your turn",
      turnDraw: "1. Draw a tile",
      turnDrawBody: "Take the top tile from the deck so everyone can see it.",
      turnPlace: "2. Place the tile",
      turnPlaceBody: "Rotate in 90\xB0 steps and place it so the edges match neighboring tiles (see Placement). If it cannot be placed in any orientation, discard it and draw again \u2014 your turn is not spent.",
      turnMeeple: "3. Place a meeple (optional)",
      turnMeepleBody: "You may put one of your meeples on a free road, city, monastery, or grassland on the tile you just placed.",
      turnScore: "4. Score completed areas",
      turnScoreBody: "If that placement completes a road, city, or monastery, score it now. Meeples on those completed areas return to their owners.",
      placeTitle: "How to place tiles",
      placeTouch: "Share a full side",
      placeTouchBody: "The new tile must touch an existing tile along at least one full side. Touching only at a corner does not count.",
      placeEdges: "Matching edges",
      placeEdgesBody: "Where tiles touch, the terrain must continue: city to city, road to road, grassland to grassland.",
      placeNoFlip: "Rotate only",
      placeNoFlipBody: "You may rotate the tile, but you cannot flip or mirror it.",
      placeOpen: "Grow in any direction",
      placeOpenBody: "The map can expand freely in every direction.",
      legalTitle: "OK example",
      legalBody: "Center is start tile D. North city matches E rotated 180\xB0. East road matches U rotated 90\xB0. South grassland matches V\u2019s north grassland.",
      illegalEdgesTitle: "Not allowed \u2014 edges clash",
      illegalEdgesBody: "D\u2019s east edge is a road, but unrotated E\u2019s west edge is a grassland. Even one mismatched side means you cannot place it there.",
      illegalCornerTitle: "Not allowed \u2014 corner only",
      illegalCornerBody: "Tiles that only meet at a corner do not share a side, so you cannot place them that way.",
      meepleTitle: "Meeples",
      meepleWhere: "Where you can place",
      meepleWhereBody: "Only on the tile you just placed \u2014 on a free road, city, monastery, or grassland mark.",
      meepleOne: "No joining occupied areas",
      meepleOneBody: "You cannot place a meeple on a road, city, or grassland that already has any meeple somewhere in its connected area.",
      meepleStock: "Running out",
      meepleStockBody: "If you have no meeples left, place the tile only. Completing a road, city, or monastery returns those meeples (except during final scoring).",
      meepleSkip: "Skipping",
      meepleSkipBody: "You may place the tile and choose not to place a meeple.",
      scoreTitle: "Scoring chart",
      scoreIntro: "When a road, city, or monastery is completed, the player with the most meeples on it scores. If tied for most, each tied player scores the full points. Those meeples then return to their owners.",
      scoreFeature: "Terrain",
      scoreComplete: "When completed",
      scoreIncomplete: "Incomplete at game end",
      scoreRoad: "Road",
      scoreRoadBody: "1 point per tile",
      scoreRoadEndBody: "1 point per tile",
      scoreCity: "City",
      scoreCityBody: "2 points per tile / 2 per pennant",
      scoreCityEndBody: "1 point per tile / 1 per pennant",
      scoreMonastery: "Monastery",
      scoreMonasteryBody: "9 points (monastery + all 8 neighbors)",
      scoreMonasteryEndBody: "1 for the monastery + 1 per neighboring tile",
      scoreField: "Grassland",
      scoreFieldBody: "-",
      scoreFieldEndBody: "3 points per completed city it touches",
      endTitle: "Game end",
      endWhen: "When it ends",
      endWhenBody: "After the last tile is placed (or you Exit early), final scoring runs.",
      endRoads: "Incomplete roads",
      endRoadsBody: "1 point per tile.",
      endCities: "Incomplete cities",
      endCitiesBody: "1 point per tile + 1 per pennant.",
      endMonasteries: "Incomplete monasteries",
      endMonasteriesBody: "1 point per filled space in the 3\xD73 area (including the monastery tile).",
      endFields: "Grasslands",
      endFieldsBody: "Farmers stay on the board. Each grassland scores 3 points for every completed city it touches. Majority works the same as above.",
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
      tileIBothBody: "Even with both sides filled, I\u2019s cities stay split by the grassland inside the tile. Corner-only contact between the two E tiles does not merge them.",
      tilesTitle: "Tile list",
      tilesIntro: "Same letter codes and counts as the classic base set. North is up in the catalog. J and K are mirrors \u2014 rotation never turns one into the other. Pennants (banners) are listed separately from plain twins.",
      legendField: "Grassland",
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
      edgesA: "N grassland \xB7 E grassland \xB7 S road \xB7 W grassland",
      edgesB: "All sides grassland",
      edgesD: "N city \xB7 E road \xB7 S grassland \xB7 W road",
      edgesE: "N city \xB7 else grassland",
      rulesFoot: "TileCity \xB7 fan-made browser game with base-set style rules. Unofficial; not connected to Carcassonne\xAE, Hans im Gl\xFCck, or Asmodee.",
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
      addHome: "\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0",
      addHomeTitle: "\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0",
      addHomeTabIos: "iPhone",
      addHomeTabAndroid: "Android",
      addHomePlatformLabel: "\u6A5F\u7A2E",
      addHomeIosIntro: "Safari \u306E\u5171\u6709\u30E1\u30CB\u30E5\u30FC\u304B\u3089 TileCity \u3092\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0\u3057\u3066\u3001\u30A2\u30D7\u30EA\u306E\u3088\u3046\u306B\u697D\u3057\u3082\u3046\uFF01",
      addHomeIosStep1: "\u3053\u306E\u30B5\u30A4\u30C8\u3092 Safari \u3067\u958B\u304F\u3002",
      addHomeIosStep2: "\u753B\u9762\u4E0B\uFF08\u307E\u305F\u306F\u30C4\u30FC\u30EB\u30D0\u30FC\uFF09\u306E\u5171\u6709\u30DC\u30BF\u30F3\u3092\u30BF\u30C3\u30D7\u3059\u308B\u3002",
      addHomeIosStep3: "\u4E00\u89A7\u3092\u30B9\u30AF\u30ED\u30FC\u30EB\u3057\u3066\u300C\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0\u300D\u3092\u9078\u3073\u3001\u8FFD\u52A0\u3092\u30BF\u30C3\u30D7\u3059\u308B\u3002",
      addHomeIosActionLabel: "\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0",
      addHomeAndroidIntro: "Chrome \u3067\u306F\u30D6\u30E9\u30A6\u30B6\u306E\u30E1\u30CB\u30E5\u30FC\u304B\u3089 TileCity \u3092\u8FFD\u52A0\u3057\u3088\u3046\uFF01",
      addHomeAndroidStep1: "\u3053\u306E\u30B5\u30A4\u30C8\u3092 Chrome \u3067\u958B\u304F\u3002",
      addHomeAndroidStep2: "\u53F3\u4E0A\u306E \u22EE \u30E1\u30CB\u30E5\u30FC\u3092\u30BF\u30C3\u30D7\u3059\u308B\u3002",
      addHomeAndroidStep3: "\u300C\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0\u300D\u307E\u305F\u306F\u300C\u30A2\u30D7\u30EA\u3092\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u300D\u3092\u9078\u3073\u3001\u78BA\u5B9A\u3059\u308B\u3002",
      addHomeAndroidAddLabel: "\u30DB\u30FC\u30E0\u753B\u9762\u306B\u8FFD\u52A0",
      addHomeAndroidNote: "\u30E1\u30CB\u30E5\u30FC\u540D\u306F\u30D6\u30E9\u30A6\u30B6\u3084\u7AEF\u672B\u30E1\u30FC\u30AB\u30FC\u3067\u7570\u306A\u308B\u3053\u3068\u304C\u3042\u308A\u307E\u3059\u3002",
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
      botStrengthMaster: "\u9054\u4EBA",
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
      basicsTitle: "\u81EA\u5206\u306E\u624B\u756A",
      basicsPlace: "\u30BF\u30A4\u30EB\u30921\u679A\u5F15\u304D\u3001\u5834\u306E\u30BF\u30A4\u30EB\u306B\u96A3\u63A5\u3055\u305B\u308B\u3088\u3046\u306B\u7F6E\u304F\u3002\u3059\u3079\u3066\u306E\u8FBA\u304C\u6210\u7ACB\u3059\u308B\u3053\u3068\u304C\u6761\u4EF6\u3002",
      basicsMeeple: "\u7F6E\u3044\u305F\u3070\u304B\u308A\u306E\u30BF\u30A4\u30EB\u306E\u90FD\u5E02\u30FB\u9053\u30FB\u4FEE\u9053\u9662\u30FB\u8349\u539F\u306E\u3044\u305A\u308C\u304B\u306B\u30DF\u30FC\u30D7\u30EB\u30921\u4EBA\u7F6E\u304F\u3053\u3068\u304C\u3067\u304D\u308B\u3002",
      basicsOccupied: "\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u3044\u308B\u5730\u5F62\u306B\u306F\u3001\u9060\u304F\u96E2\u308C\u3066\u3044\u3066\u3082\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F\u3053\u3068\u304C\u3067\u304D\u306A\u3044\u3002",
      basicsScore: "\u5B8C\u6210\u3057\u305F\u90FD\u5E02\u30FB\u9053\u30FB\u4FEE\u9053\u9662\u306F\u3059\u3050\u306B\u5F97\u70B9\u3057\u3001\u305D\u306E\u30DF\u30FC\u30D7\u30EB\u306F\u6301\u3061\u4E3B\u306E\u624B\u5143\u306B\u623B\u308B\u3002",
      basicsFarm: "\u8349\u539F\u306B\u5BDD\u304B\u305B\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u6700\u5F8C\u307E\u3067\u6B8B\u308B\u3002",
      refCity: "\u90FD\u5E02",
      refRoad: "\u9053",
      refMonastery: "\u4FEE\u9053\u9662",
      refField: "\u8349\u539F",
      refMeeple: "\u30DF\u30FC\u30D7\u30EB",
      tocTutorial: "\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB",
      tocDetails: "\u88DC\u8DB3",
      tocTiles: "\u30BF\u30A4\u30EB A\u2013X",
      tutTitle: "\u904A\u3073\u65B9",
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
      tut3Body: "\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u3092\u7F6E\u304D\u3001\u30DF\u30FC\u30D7\u30EB\u3092\u4E57\u305B\u308B\u3053\u3068\u304C\u3067\u304D\u307E\u3059\u3002\u67A0\u306E\u30DE\u30B9\u304C\u57CB\u307E\u308B\u3068\u4FEE\u9053\u9662\u306E\u5F97\u70B9\u306B\u306A\u308A\u307E\u3059\u3002\u5468\u56F28\u30DE\u30B9\u304C\u3059\u3079\u3066\u57CB\u307E\u3063\u305F\u3068\u304D\u306B\u5F97\u70B9\u3057\u307E\u3059\u3002",
      tut3Score: "\u307E\u3060\u5F97\u70B9\u306A\u3057",
      tut4Title: "\u90FD\u5E02\u304C\u5408\u6D41 \u2014 \u540C\u6642\u306B\u5F97\u70B9",
      tut4Body: "\u5408\u6D41\u3057\u305F\u90FD\u5E02\u3067\u5404\u81EA\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u540C\u6570\u306E\u3068\u304D\u3001\u3069\u3061\u3089\u3082\u540C\u3058\u70B9\u6570\u3092\u5F97\u307E\u3059\u3002",
      tut4Score: "\u540C\u6570\uFF084\u679A\uFF09",
      tut5Title: "\u4FEE\u9053\u9662\u306E\u5468\u308A\u3092\u57CB\u3081\u3066\u5F97\u70B9",
      tut5Body: "\u4FEE\u9053\u9662\u306E\u5468\u56F2\u3067\u6700\u5F8C\u306E1\u30DE\u30B9\u3092\u57CB\u3081\u308B\u3068\u5B8C\u6210\u3002\u30DF\u30FC\u30D7\u30EB\u304C\u5F97\u70B9\u3057\u3066\u624B\u5143\u306B\u623B\u308A\u307E\u3059\u3002",
      tut5Score: "\u4FEE\u9053\u9662\uFF1A3\xD73\u304C\u57CB\u307E\u308B\u3068 9\u70B9",
      tut6Title: "\u90FD\u5E02\u304C\u5408\u6D41 \u2014 \u81EA\u5206\u3060\u3051\u5F97\u70B9",
      tut6Body: "\u5408\u6D41\u3057\u305F\u90FD\u5E02\u3067\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u76F8\u624B\u3088\u308A\u591A\u3044\u3068\u304D\u3001\u5F97\u70B9\u3067\u304D\u308B\u306E\u306F\u81EA\u5206\u3060\u3051\u3067\u3059\u3002\u90FD\u5E02\u306B\u30DA\u30CA\u30F3\u30C8\u304C\u3042\u308B\u5834\u5408\u3001\u30DA\u30CA\u30F3\u30C8\u5206 +2 \u3055\u308C\u307E\u3059\u3002",
      tut6Score: "2\u5BFE1 \u2192 \u81EA\u5206\u3060\u3051 +12\uFF08\u30BF\u30A4\u30EB5 + \u30DA\u30CA\u30F3\u30C81\uFF09",
      tut7Title: "\u8349\u539F\u306E\u5F97\u70B9",
      tut7Body: "\u30B2\u30FC\u30E0\u7D42\u4E86\u6642\u3001\u8349\u539F\u306F\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3002\u9053\u3084\u90FD\u5E02\uFF08\u89D2\u542B\u3080\uFF09\u3067\u906E\u3089\u308C\u305F\u5730\u5F62\u306F\u5206\u65AD\u3068\u307F\u306A\u3057\u307E\u3059\u3002",
      tut7Score: "\u5B8C\u6210\u90FD\u5E02\u304C3\u3064 \u2192 +9",
      detailsTitle: "\u88DC\u8DB3",
      notesLead: "\u5F97\u70B9\u8868\u3068\u5168\u30BF\u30A4\u30EB\u4E00\u89A7\u3067\u3059\u3002",
      tocPlace: "\u7F6E\u304D\u65B9",
      tocMeeple: "\u30DF\u30FC\u30D7\u30EB",
      tocScore: "\u5F97\u70B9",
      tocControls: "\u64CD\u4F5C",
      tocGoal: "\u76EE\u7684",
      tocSetup: "\u6E96\u5099",
      tocTurn: "\u624B\u756A",
      tocEnd: "\u7D42\u4E86",
      goalTitle: "\u76EE\u7684",
      goalBody: "\u9806\u756A\u306B\u30BF\u30A4\u30EB\u3068\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u3044\u3066\u3044\u304D\u307E\u3059\u3002\u30B2\u30FC\u30E0\u4E2D\u306B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3092\u5B8C\u6210\u3055\u305B\u308B\u3068\u5F97\u70B9\u3002\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u3089\u3001\u6B8B\u3063\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u3068\u8349\u539F\u3082\u5F97\u70B9\u3057\u3001\u4E00\u756A\u70B9\u304C\u9AD8\u3044\u4EBA\u304C\u52DD\u3061\u3067\u3059\u3002",
      setupSecTitle: "\u6E96\u5099",
      setupPlayers: "\u30D7\u30EC\u30A4\u30E4\u30FC",
      setupPlayersBody: "2\u301C8\u4EBA\u3002\u5404\u82727\u4F53\u306E\u30DF\u30FC\u30D7\u30EB\u3092\u4F7F\u3044\u307E\u3059\u3002\u6E96\u5099\u753B\u9762\u3067\u540D\u524D\uFF08\u6700\u592710\u6587\u5B57\uFF09\u3068\u8272\u3092\u9078\u3073\u307E\u3059\uFF08\u8272\u306E\u91CD\u8907\u306F\u4E0D\u53EF\uFF09\u3002",
      setupStartTile: "\u30B9\u30BF\u30FC\u30C8\u30BF\u30A4\u30EB",
      setupStartTileBody: "\u5370\u4ED8\u304D\u306E D \u30BF\u30A4\u30EB1\u679A\u3092\u4E2D\u592E\u306B\u8868\u5411\u304D\u3067\u7F6E\u304D\u307E\u3059\u3002\u6B8B\u308A71\u679A\u3092\u3088\u304F\u6DF7\u305C\u3066\u5C71\u672D\u306B\u3057\u307E\u3059\u3002",
      setupFirst: "\u5148\u624B",
      setupFirstBody: "\u30D7\u30EC\u30A4\u753B\u9762\u306E\u30EB\u30FC\u30EC\u30C3\u30C8\u3067\u5148\u624B\u304C\u6C7A\u307E\u308A\u307E\u3059\u3002\u4EE5\u964D\u306F\u30D7\u30EC\u30A4\u30E4\u30FC\u306E\u4E26\u3073\u9806\u306B\u624B\u756A\u304C\u56DE\u308A\u307E\u3059\u3002",
      rouletteTitle: "\u30EB\u30FC\u30EC\u30C3\u30C8",
      rouletteLead: "\u6700\u521D\u306E\u30D7\u30EC\u30A4\u30E4\u30FC\u3092\u6C7A\u3081\u307E\u3059\u3002",
      rouletteStart: "\u30B9\u30BF\u30FC\u30C8",
      rouletteGoesFirst: "\u304C\u5148\u624B\uFF01",
      turnTitle: "\u624B\u756A\u306E\u6D41\u308C",
      turnDraw: "1. \u30BF\u30A4\u30EB\u3092\u5F15\u304F",
      turnDrawBody: "\u5C71\u672D\u306E\u4E00\u756A\u4E0A\u30921\u679A\u5F15\u304D\u3001\u5168\u54E1\u306B\u898B\u3048\u308B\u3088\u3046\u306B\u3057\u307E\u3059\u3002",
      turnPlace: "2. \u30BF\u30A4\u30EB\u3092\u7F6E\u304F",
      turnPlaceBody: "90\xB0\u5358\u4F4D\u3067\u56DE\u8EE2\u3057\u3001\u96A3\u306E\u30BF\u30A4\u30EB\u3068\u7D75\u67C4\u304C\u3064\u306A\u304C\u308B\u3088\u3046\u306B\u7F6E\u304D\u307E\u3059\uFF08\u7F6E\u304D\u65B9\u53C2\u7167\uFF09\u3002\u3069\u306E\u5411\u304D\u3067\u3082\u7F6E\u3051\u306A\u3044\u5834\u5408\u306F\u6368\u3066\u3066\u5F15\u304D\u76F4\u3057\u307E\u3059\u3002\u3053\u306E\u3068\u304D\u624B\u756A\u306F\u6D88\u8CBB\u3057\u307E\u305B\u3093\u3002",
      turnMeeple: "3. \u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304F\uFF08\u4EFB\u610F\uFF09",
      turnMeepleBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u3001\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u8349\u539F\u306B\u3001\u81EA\u5206\u306E\u30DF\u30FC\u30D7\u30EB\u30921\u4F53\u7F6E\u3051\u307E\u3059\u3002\u7F6E\u304B\u306A\u304F\u3066\u3082\u69CB\u3044\u307E\u305B\u3093\u3002",
      turnScore: "4. \u5B8C\u6210\u3057\u305F\u5834\u6240\u306E\u5F97\u70B9",
      turnScoreBody: "\u305D\u306E\u914D\u7F6E\u3067\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3057\u305F\u3089\u3001\u3059\u3050\u306B\u5F97\u70B9\u3057\u307E\u3059\u3002\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u6301\u3061\u4E3B\u306E\u624B\u5143\u3078\u623B\u308A\u307E\u3059\u3002",
      placeTitle: "\u30BF\u30A4\u30EB\u306E\u7F6E\u304D\u65B9",
      placeTouch: "\u8FBA\u3067\u63A5\u3059\u308B",
      placeTouchBody: "\u65B0\u3057\u3044\u30BF\u30A4\u30EB\u306F\u3001\u3059\u3067\u306B\u7F6E\u3044\u3066\u3042\u308B\u30BF\u30A4\u30EB\u3068\u5C11\u306A\u304F\u3068\u30821\u8FBA\u5168\u4F53\u3067\u63A5\u3059\u308B\u3088\u3046\u306B\u7F6E\u304D\u307E\u3059\u3002\u89D2\u3060\u3051\u304C\u89E6\u308C\u3066\u3044\u308B\u72B6\u614B\u3067\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      placeEdges: "\u7D75\u67C4\u3092\u3064\u306A\u3052\u308B",
      placeEdgesBody: "\u63A5\u3059\u308B\u8FBA\u306F\u7AEF\u304B\u3089\u7AEF\u307E\u3067\u540C\u3058\u5730\u5F62\u3067\u3042\u308B\u3053\u3068\u3002\u90FD\u5E02\u306F\u90FD\u5E02\u3001\u9053\u306F\u9053\u3001\u8349\u539F\u306F\u8349\u539F\u306B\u3064\u306A\u304C\u308A\u307E\u3059\u3002",
      placeNoFlip: "\u56DE\u8EE2\u306E\u307F",
      placeNoFlipBody: "\u30BF\u30A4\u30EB\u306F\u56DE\u8EE2\u3067\u304D\u307E\u3059\u304C\u3001\u88CF\u8FD4\u3057\u305F\u308A\u93E1\u6620\u3057\u305F\u308A\u306F\u3067\u304D\u307E\u305B\u3093\u3002",
      placeOpen: "\u3069\u306E\u65B9\u5411\u306B\u3082\u4F38\u3070\u305B\u308B",
      placeOpenBody: "\u30DE\u30C3\u30D7\u306F\u4E0A\u4E0B\u5DE6\u53F3\u3001\u3069\u306E\u65B9\u5411\u306B\u3082\u5E83\u3052\u3089\u308C\u307E\u3059\u3002",
      legalTitle: "\u7F6E\u3051\u308B\u4F8B",
      legalBody: "\u4E2D\u592E\u306F\u30B9\u30BF\u30FC\u30C8\u30BF\u30A4\u30EB D\u3002\u5317\u306E\u90FD\u5E02\u306F 180\xB0 \u56DE\u8EE2\u306E E\u3001\u6771\u306E\u9053\u306F 90\xB0 \u56DE\u8EE2\u306E U\u3001\u5357\u306E\u8349\u539F\u306F V \u306E\u5317\u8349\u539F\u3068\u3064\u306A\u304C\u3063\u3066\u3044\u307E\u3059\u3002",
      illegalEdgesTitle: "\u7F6E\u3051\u306A\u3044\u4F8B \u2014 \u8FBA\u304C\u5408\u308F\u306A\u3044",
      illegalEdgesBody: "D \u306E\u6771\u8FBA\u306F\u9053\u306A\u306E\u306B\u3001\u7121\u56DE\u8EE2\u306E E \u306E\u897F\u8FBA\u306F\u8349\u539F\u3067\u3059\u30021\u8FBA\u3067\u3082\u5408\u308F\u306A\u3051\u308C\u3070\u3001\u305D\u3053\u306B\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      illegalCornerTitle: "\u7F6E\u3051\u306A\u3044\u4F8B \u2014 \u89D2\u3060\u3051",
      illegalCornerBody: "\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u308B\u30BF\u30A4\u30EB\u306F\u8FBA\u3092\u5171\u6709\u3057\u3066\u3044\u306A\u3044\u306E\u3067\u3001\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleTitle: "\u30DF\u30FC\u30D7\u30EB",
      meepleWhere: "\u7F6E\u304D\u5834\u6240",
      meepleWhereBody: "\u4ECA\u7F6E\u3044\u305F\u30BF\u30A4\u30EB\u306E\u4E0A\u3060\u3051\u3002\u7A7A\u3044\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u30FB\u8349\u539F\u306E\u30DE\u30FC\u30AF\u306B\u7F6E\u3051\u307E\u3059\u3002",
      meepleOne: "\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u3042\u308B\u5834\u6240\u3078\u306F\u7F6E\u3051\u306A\u3044",
      meepleOneBody: "\u3064\u306A\u304C\u3063\u3066\u3044\u308B\u9053\u30FB\u90FD\u5E02\u30FB\u8349\u539F\u306E\u3069\u3053\u304B\u306B\u3001\u3059\u3067\u306B\u30DF\u30FC\u30D7\u30EB\uFF08\u81EA\u5206\u306E\u3082\u76F8\u624B\u306E\u3082\uFF09\u304C\u3042\u308B\u5834\u5408\u3001\u305D\u3053\u306B\u306F\u7F6E\u3051\u307E\u305B\u3093\u3002",
      meepleStock: "\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u304F\u306A\u3063\u305F\u3089",
      meepleStockBody: "\u624B\u5143\u306B\u30DF\u30FC\u30D7\u30EB\u304C\u306A\u3051\u308C\u3070\u3001\u30BF\u30A4\u30EB\u3092\u7F6E\u304F\u3060\u3051\u306B\u306A\u308A\u307E\u3059\u3002\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u3053\u306B\u3044\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u3059\uFF08\u6700\u7D42\u5F97\u70B9\u6642\u3092\u9664\u304F\uFF09\u3002",
      meepleSkip: "\u7F6E\u304B\u306A\u3044\u9078\u629E",
      meepleSkipBody: "\u30BF\u30A4\u30EB\u3060\u3051\u7F6E\u3044\u3066\u3001\u30DF\u30FC\u30D7\u30EB\u3092\u7F6E\u304B\u306A\u3044\u3053\u3068\u3082\u3067\u304D\u307E\u3059\u3002",
      scoreTitle: "\u5F97\u70B9\u8868",
      scoreIntro: "\u9053\u30FB\u90FD\u5E02\u30FB\u4FEE\u9053\u9662\u304C\u5B8C\u6210\u3059\u308B\u3068\u3001\u305D\u306E\u4E0A\u306E\u30DF\u30FC\u30D7\u30EB\u304C\u4E00\u756A\u591A\u3044\u30D7\u30EC\u30A4\u30E4\u30FC\u304C\u5F97\u70B9\u3057\u307E\u3059\u3002\u540C\u6570\u306A\u3089\u3001\u305D\u306E\u5168\u54E1\u304C\u540C\u3058\u70B9\u6570\u3092\u3082\u3089\u3048\u307E\u3059\u3002\u5F97\u70B9\u3057\u305F\u30DF\u30FC\u30D7\u30EB\u306F\u624B\u5143\u306B\u623B\u308A\u307E\u3059\u3002",
      scoreFeature: "\u5730\u5F62",
      scoreComplete: "\u5B8C\u6210\u6642",
      scoreIncomplete: "\u30B2\u30FC\u30E0\u7D42\u4E86\u6642\u306B\u672A\u5B8C\u6210",
      scoreRoad: "\u9053",
      scoreRoadBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9",
      scoreRoadEndBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9",
      scoreCity: "\u90FD\u5E02",
      scoreCityBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D2\u70B9 / \u30DA\u30CA\u30F3\u30C81\u3064\u306B\u3064\u304D2\u70B9",
      scoreCityEndBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 / \u30DA\u30CA\u30F3\u30C81\u3064\u306B\u3064\u304D1\u70B9",
      scoreMonastery: "\u4FEE\u9053\u9662",
      scoreMonasteryBody: "9\u70B9\uFF08\u4FEE\u9053\u9662\u81EA\u8EAB + \u5468\u56F28\u679A\u3059\u3079\u3066\uFF09",
      scoreMonasteryEndBody: "\u4FEE\u9053\u9662\u81EA\u8EAB\u30671\u70B9 + \u5468\u56F2\u306E\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9",
      scoreField: "\u8349\u539F",
      scoreFieldBody: "-",
      scoreFieldEndBody: "\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u6E08\u307F\u306E\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9",
      endTitle: "\u30B2\u30FC\u30E0\u7D42\u4E86",
      endWhen: "\u3044\u3064\u7D42\u308F\u308B\u304B",
      endWhenBody: "\u6700\u5F8C\u306E\u30BF\u30A4\u30EB\u3092\u7F6E\u3044\u305F\u5F8C\uFF08\u307E\u305F\u306F\u300C\u9000\u51FA\u300D\u3067\u9014\u4E2D\u7D42\u4E86\u3057\u305F\u3068\u304D\uFF09\u306B\u3001\u6700\u7D42\u5F97\u70B9\u3092\u884C\u3044\u307E\u3059\u3002",
      endRoads: "\u672A\u5B8C\u6210\u306E\u9053",
      endRoadsBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9\u3002",
      endCities: "\u672A\u5B8C\u6210\u306E\u90FD\u5E02",
      endCitiesBody: "\u30BF\u30A4\u30EB1\u679A\u306B\u3064\u304D1\u70B9 + \u30DA\u30CA\u30F3\u30C81\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endMonasteries: "\u672A\u5B8C\u6210\u306E\u4FEE\u9053\u9662",
      endMonasteriesBody: "3\xD73\uFF08\u4FEE\u9053\u9662\u30BF\u30A4\u30EB\u3092\u542B\u3080\uFF09\u306E\u57CB\u307E\u3063\u3066\u3044\u308B\u30DE\u30B91\u3064\u306B\u3064\u304D1\u70B9\u3002",
      endFields: "\u8349\u539F",
      endFieldsBody: "\u8349\u539F\u306B\u7F6E\u3044\u305F\u30DF\u30FC\u30D7\u30EB\uFF08\u8FB2\u6C11\uFF09\u306F\u305D\u306E\u307E\u307E\u3002\u63A5\u3057\u3066\u3044\u308B\u5B8C\u6210\u90FD\u5E021\u3064\u306B\u3064\u304D3\u70B9\u3002\u540C\u6570\u306E\u3068\u304D\u306F\u4E0A\u8A18\u3068\u540C\u3058\u3067\u3059\u3002",
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
      tileIBothBody: "\u4E21\u5074\u304C\u57CB\u307E\u3063\u3066\u3082\u3001\u30BF\u30A4\u30EB\u5185\u306E\u8349\u539F\u3067\u90FD\u5E02\u306F\u5206\u304B\u308C\u307E\u3059\u30022\u679A\u306E E \u304C\u89D2\u3060\u3051\u3067\u89E6\u308C\u3066\u3044\u3066\u3082\u3001\u5408\u4F75\u3057\u307E\u305B\u3093\u3002",
      tilesTitle: "\u30BF\u30A4\u30EB\u4E00\u89A7",
      tilesIntro: "\u30AF\u30E9\u30B7\u30C3\u30AF\u57FA\u672C\u30BB\u30C3\u30C8\u3068\u540C\u3058\u6587\u5B57\u30B3\u30FC\u30C9\u3068\u679A\u6570\u3067\u3059\u3002\u30AB\u30BF\u30ED\u30B0\u3067\u306F\u4E0A\u304C\u5317\u3002J \u3068 K \u306F\u93E1\u6620\u3067\u3001\u56DE\u8EE2\u3067\u306F\u4E92\u3044\u306B\u306A\u308A\u307E\u305B\u3093\u3002\u30DA\u30CA\u30F3\u30C8\u4ED8\u304D\u306F\u7121\u5370\u3068\u5206\u3051\u3066\u8A18\u8F09\u3057\u3066\u3044\u307E\u3059\u3002",
      legendField: "\u8349\u539F",
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
      edgesA: "\u5317\u8349\u539F \xB7 \u6771\u8349\u539F \xB7 \u5357\u9053 \xB7 \u897F\u8349\u539F",
      edgesB: "\u5168\u8FBA\u8349\u539F",
      edgesD: "\u5317\u90FD\u5E02 \xB7 \u6771\u9053 \xB7 \u5357\u8349\u539F \xB7 \u897F\u9053",
      edgesE: "\u5317\u90FD\u5E02 \xB7 \u307B\u304B\u8349\u539F",
      rulesFoot: "TileCity \xB7 \u57FA\u672C\u30BB\u30C3\u30C8\u98A8\u30EB\u30FC\u30EB\u306E\u30D5\u30A1\u30F3\u30E1\u30A4\u30C9\u30D6\u30E9\u30A6\u30B6\u30B2\u30FC\u30E0\u3002\u975E\u516C\u5F0F\u3067\u3042\u308A\u3001Carcassonne\xAE / Hans im Gl\xFCck / Asmodee \u3068\u306F\u95A2\u4FC2\u3042\u308A\u307E\u305B\u3093\u3002",
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

  // js/play/storage.js
  var SETUP_KEY = "tile-city-setup";
  var SAVE_KEY = "tile-city-save";
  var ROULETTE_KEY = "tile-city-roulette";
  function markRoulettePending() {
    try {
      sessionStorage.setItem(ROULETTE_KEY, "1");
    } catch (err) {
    }
  }
  function clearRoulettePending() {
    try {
      sessionStorage.removeItem(ROULETTE_KEY);
    } catch (err) {
    }
  }
  function isRoulettePending() {
    try {
      return sessionStorage.getItem(ROULETTE_KEY) === "1";
    } catch (err) {
      return false;
    }
  }
  function parseSetupPayload(Carcassonne2, raw) {
    if (!raw) return null;
    let data;
    try {
      data = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (err) {
      return null;
    }
    if (Array.isArray(data)) {
      return {
        players: Carcassonne2.normalizePlayers(data),
        options: Carcassonne2.normalizeGameOptions(null)
      };
    }
    if (!data || typeof data !== "object") return null;
    const players = Carcassonne2.normalizePlayers(data.players || data.roster);
    if (!players || !players.length) return null;
    return {
      players,
      options: Carcassonne2.normalizeGameOptions(data.options)
    };
  }
  function loadSetup(Carcassonne2) {
    try {
      const raw = sessionStorage.getItem(SETUP_KEY);
      if (!raw) return null;
      return parseSetupPayload(Carcassonne2, raw);
    } catch (err) {
      return null;
    }
  }
  function loadRoster(Carcassonne2) {
    const setup = loadSetup(Carcassonne2);
    return setup ? setup.players : null;
  }
  function loadSetupOptions(Carcassonne2) {
    const setup = loadSetup(Carcassonne2);
    return Carcassonne2.normalizeGameOptions(setup && setup.options);
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

  // node_modules/html-to-image/es/util.js
  function resolveUrl(url, baseUrl) {
    if (url.match(/^[a-z]+:\/\//i)) {
      return url;
    }
    if (url.match(/^\/\//)) {
      return window.location.protocol + url;
    }
    if (url.match(/^[a-z]+:/i)) {
      return url;
    }
    const doc = document.implementation.createHTMLDocument();
    const base = doc.createElement("base");
    const a = doc.createElement("a");
    doc.head.appendChild(base);
    doc.body.appendChild(a);
    if (baseUrl) {
      base.href = baseUrl;
    }
    a.href = url;
    return a.href;
  }
  var uuid = /* @__PURE__ */ (() => {
    let counter = 0;
    const random = () => (
      // eslint-disable-next-line no-bitwise
      `0000${(Math.random() * 36 ** 4 << 0).toString(36)}`.slice(-4)
    );
    return () => {
      counter += 1;
      return `u${random()}${counter}`;
    };
  })();
  function toArray(arrayLike) {
    const arr = [];
    for (let i = 0, l = arrayLike.length; i < l; i++) {
      arr.push(arrayLike[i]);
    }
    return arr;
  }
  var styleProps = null;
  function getStyleProperties(options = {}) {
    if (styleProps) {
      return styleProps;
    }
    if (options.includeStyleProperties) {
      styleProps = options.includeStyleProperties;
      return styleProps;
    }
    styleProps = toArray(window.getComputedStyle(document.documentElement));
    return styleProps;
  }
  function px(node, styleProperty) {
    const win = node.ownerDocument.defaultView || window;
    const val = win.getComputedStyle(node).getPropertyValue(styleProperty);
    return val ? parseFloat(val.replace("px", "")) : 0;
  }
  function getNodeWidth(node) {
    const leftBorder = px(node, "border-left-width");
    const rightBorder = px(node, "border-right-width");
    return node.clientWidth + leftBorder + rightBorder;
  }
  function getNodeHeight(node) {
    const topBorder = px(node, "border-top-width");
    const bottomBorder = px(node, "border-bottom-width");
    return node.clientHeight + topBorder + bottomBorder;
  }
  function getImageSize(targetNode, options = {}) {
    const width = options.width || getNodeWidth(targetNode);
    const height = options.height || getNodeHeight(targetNode);
    return { width, height };
  }
  function getPixelRatio() {
    let ratio;
    let FINAL_PROCESS;
    try {
      FINAL_PROCESS = process;
    } catch (e) {
    }
    const val = FINAL_PROCESS && FINAL_PROCESS.env ? FINAL_PROCESS.env.devicePixelRatio : null;
    if (val) {
      ratio = parseInt(val, 10);
      if (Number.isNaN(ratio)) {
        ratio = 1;
      }
    }
    return ratio || window.devicePixelRatio || 1;
  }
  var canvasDimensionLimit = 16384;
  function checkCanvasDimensions(canvas) {
    if (canvas.width > canvasDimensionLimit || canvas.height > canvasDimensionLimit) {
      if (canvas.width > canvasDimensionLimit && canvas.height > canvasDimensionLimit) {
        if (canvas.width > canvas.height) {
          canvas.height *= canvasDimensionLimit / canvas.width;
          canvas.width = canvasDimensionLimit;
        } else {
          canvas.width *= canvasDimensionLimit / canvas.height;
          canvas.height = canvasDimensionLimit;
        }
      } else if (canvas.width > canvasDimensionLimit) {
        canvas.height *= canvasDimensionLimit / canvas.width;
        canvas.width = canvasDimensionLimit;
      } else {
        canvas.width *= canvasDimensionLimit / canvas.height;
        canvas.height = canvasDimensionLimit;
      }
    }
  }
  function createImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        img.decode().then(() => {
          requestAnimationFrame(() => resolve(img));
        });
      };
      img.onerror = reject;
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.src = url;
    });
  }
  async function svgToDataURL(svg) {
    return Promise.resolve().then(() => new XMLSerializer().serializeToString(svg)).then(encodeURIComponent).then((html) => `data:image/svg+xml;charset=utf-8,${html}`);
  }
  async function nodeToDataURL(node, width, height) {
    const xmlns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(xmlns, "svg");
    const foreignObject = document.createElementNS(xmlns, "foreignObject");
    svg.setAttribute("width", `${width}`);
    svg.setAttribute("height", `${height}`);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    foreignObject.setAttribute("width", "100%");
    foreignObject.setAttribute("height", "100%");
    foreignObject.setAttribute("x", "0");
    foreignObject.setAttribute("y", "0");
    foreignObject.setAttribute("externalResourcesRequired", "true");
    svg.appendChild(foreignObject);
    foreignObject.appendChild(node);
    return svgToDataURL(svg);
  }
  var isInstanceOfElement = (node, instance) => {
    if (node instanceof instance)
      return true;
    const nodePrototype = Object.getPrototypeOf(node);
    if (nodePrototype === null)
      return false;
    return nodePrototype.constructor.name === instance.name || isInstanceOfElement(nodePrototype, instance);
  };

  // node_modules/html-to-image/es/clone-pseudos.js
  function formatCSSText(style) {
    const content = style.getPropertyValue("content");
    return `${style.cssText} content: '${content.replace(/'|"/g, "")}';`;
  }
  function formatCSSProperties(style, options) {
    return getStyleProperties(options).map((name) => {
      const value = style.getPropertyValue(name);
      const priority = style.getPropertyPriority(name);
      return `${name}: ${value}${priority ? " !important" : ""};`;
    }).join(" ");
  }
  function getPseudoElementStyle(className, pseudo, style, options) {
    const selector = `.${className}:${pseudo}`;
    const cssText = style.cssText ? formatCSSText(style) : formatCSSProperties(style, options);
    return document.createTextNode(`${selector}{${cssText}}`);
  }
  function clonePseudoElement(nativeNode, clonedNode, pseudo, options) {
    const style = window.getComputedStyle(nativeNode, pseudo);
    const content = style.getPropertyValue("content");
    if (content === "" || content === "none") {
      return;
    }
    const className = uuid();
    try {
      clonedNode.className = `${clonedNode.className} ${className}`;
    } catch (err) {
      return;
    }
    const styleElement = document.createElement("style");
    styleElement.appendChild(getPseudoElementStyle(className, pseudo, style, options));
    clonedNode.appendChild(styleElement);
  }
  function clonePseudoElements(nativeNode, clonedNode, options) {
    clonePseudoElement(nativeNode, clonedNode, ":before", options);
    clonePseudoElement(nativeNode, clonedNode, ":after", options);
  }

  // node_modules/html-to-image/es/mimes.js
  var WOFF = "application/font-woff";
  var JPEG = "image/jpeg";
  var mimes = {
    woff: WOFF,
    woff2: WOFF,
    ttf: "application/font-truetype",
    eot: "application/vnd.ms-fontobject",
    png: "image/png",
    jpg: JPEG,
    jpeg: JPEG,
    gif: "image/gif",
    tiff: "image/tiff",
    svg: "image/svg+xml",
    webp: "image/webp"
  };
  function getExtension(url) {
    const match = /\.([^./]*?)$/g.exec(url);
    return match ? match[1] : "";
  }
  function getMimeType(url) {
    const extension = getExtension(url).toLowerCase();
    return mimes[extension] || "";
  }

  // node_modules/html-to-image/es/dataurl.js
  function getContentFromDataUrl(dataURL) {
    return dataURL.split(/,/)[1];
  }
  function isDataUrl(url) {
    return url.search(/^(data:)/) !== -1;
  }
  function makeDataUrl(content, mimeType) {
    return `data:${mimeType};base64,${content}`;
  }
  async function fetchAsDataURL(url, init, process2) {
    const res = await fetch(url, init);
    if (res.status === 404) {
      throw new Error(`Resource "${res.url}" not found`);
    }
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onloadend = () => {
        try {
          resolve(process2({ res, result: reader.result }));
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsDataURL(blob);
    });
  }
  var cache = {};
  function getCacheKey(url, contentType, includeQueryParams) {
    let key = url.replace(/\?.*/, "");
    if (includeQueryParams) {
      key = url;
    }
    if (/ttf|otf|eot|woff2?/i.test(key)) {
      key = key.replace(/.*\//, "");
    }
    return contentType ? `[${contentType}]${key}` : key;
  }
  async function resourceToDataURL(resourceUrl, contentType, options) {
    const cacheKey = getCacheKey(resourceUrl, contentType, options.includeQueryParams);
    if (cache[cacheKey] != null) {
      return cache[cacheKey];
    }
    if (options.cacheBust) {
      resourceUrl += (/\?/.test(resourceUrl) ? "&" : "?") + (/* @__PURE__ */ new Date()).getTime();
    }
    let dataURL;
    try {
      const content = await fetchAsDataURL(resourceUrl, options.fetchRequestInit, ({ res, result }) => {
        if (!contentType) {
          contentType = res.headers.get("Content-Type") || "";
        }
        return getContentFromDataUrl(result);
      });
      dataURL = makeDataUrl(content, contentType);
    } catch (error) {
      dataURL = options.imagePlaceholder || "";
      let msg = `Failed to fetch resource: ${resourceUrl}`;
      if (error) {
        msg = typeof error === "string" ? error : error.message;
      }
      if (msg) {
        console.warn(msg);
      }
    }
    cache[cacheKey] = dataURL;
    return dataURL;
  }

  // node_modules/html-to-image/es/clone-node.js
  async function cloneCanvasElement(canvas) {
    const dataURL = canvas.toDataURL();
    if (dataURL === "data:,") {
      return canvas.cloneNode(false);
    }
    return createImage(dataURL);
  }
  async function cloneVideoElement(video, options) {
    if (video.currentSrc) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
      ctx === null || ctx === void 0 ? void 0 : ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataURL2 = canvas.toDataURL();
      return createImage(dataURL2);
    }
    const poster = video.poster;
    const contentType = getMimeType(poster);
    const dataURL = await resourceToDataURL(poster, contentType, options);
    return createImage(dataURL);
  }
  async function cloneIFrameElement(iframe, options) {
    var _a;
    try {
      if ((_a = iframe === null || iframe === void 0 ? void 0 : iframe.contentDocument) === null || _a === void 0 ? void 0 : _a.body) {
        return await cloneNode(iframe.contentDocument.body, options, true);
      }
    } catch (_b) {
    }
    return iframe.cloneNode(false);
  }
  async function cloneSingleNode(node, options) {
    if (isInstanceOfElement(node, HTMLCanvasElement)) {
      return cloneCanvasElement(node);
    }
    if (isInstanceOfElement(node, HTMLVideoElement)) {
      return cloneVideoElement(node, options);
    }
    if (isInstanceOfElement(node, HTMLIFrameElement)) {
      return cloneIFrameElement(node, options);
    }
    return node.cloneNode(isSVGElement(node));
  }
  var isSlotElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SLOT";
  var isSVGElement = (node) => node.tagName != null && node.tagName.toUpperCase() === "SVG";
  async function cloneChildren(nativeNode, clonedNode, options) {
    var _a, _b;
    if (isSVGElement(clonedNode)) {
      return clonedNode;
    }
    let children = [];
    if (isSlotElement(nativeNode) && nativeNode.assignedNodes) {
      children = toArray(nativeNode.assignedNodes());
    } else if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && ((_a = nativeNode.contentDocument) === null || _a === void 0 ? void 0 : _a.body)) {
      children = toArray(nativeNode.contentDocument.body.childNodes);
    } else {
      children = toArray(((_b = nativeNode.shadowRoot) !== null && _b !== void 0 ? _b : nativeNode).childNodes);
    }
    if (children.length === 0 || isInstanceOfElement(nativeNode, HTMLVideoElement)) {
      return clonedNode;
    }
    await children.reduce((deferred, child) => deferred.then(() => cloneNode(child, options)).then((clonedChild) => {
      if (clonedChild) {
        clonedNode.appendChild(clonedChild);
      }
    }), Promise.resolve());
    return clonedNode;
  }
  function cloneCSSStyle(nativeNode, clonedNode, options) {
    const targetStyle = clonedNode.style;
    if (!targetStyle) {
      return;
    }
    const sourceStyle = window.getComputedStyle(nativeNode);
    if (sourceStyle.cssText) {
      targetStyle.cssText = sourceStyle.cssText;
      targetStyle.transformOrigin = sourceStyle.transformOrigin;
    } else {
      getStyleProperties(options).forEach((name) => {
        let value = sourceStyle.getPropertyValue(name);
        if (name === "font-size" && value.endsWith("px")) {
          const reducedFont = Math.floor(parseFloat(value.substring(0, value.length - 2))) - 0.1;
          value = `${reducedFont}px`;
        }
        if (isInstanceOfElement(nativeNode, HTMLIFrameElement) && name === "display" && value === "inline") {
          value = "block";
        }
        if (name === "d" && clonedNode.getAttribute("d")) {
          value = `path(${clonedNode.getAttribute("d")})`;
        }
        targetStyle.setProperty(name, value, sourceStyle.getPropertyPriority(name));
      });
    }
  }
  function cloneInputValue(nativeNode, clonedNode) {
    if (isInstanceOfElement(nativeNode, HTMLTextAreaElement)) {
      clonedNode.innerHTML = nativeNode.value;
    }
    if (isInstanceOfElement(nativeNode, HTMLInputElement)) {
      clonedNode.setAttribute("value", nativeNode.value);
    }
  }
  function cloneSelectValue(nativeNode, clonedNode) {
    if (isInstanceOfElement(nativeNode, HTMLSelectElement)) {
      const clonedSelect = clonedNode;
      const selectedOption = Array.from(clonedSelect.children).find((child) => nativeNode.value === child.getAttribute("value"));
      if (selectedOption) {
        selectedOption.setAttribute("selected", "");
      }
    }
  }
  function decorate(nativeNode, clonedNode, options) {
    if (isInstanceOfElement(clonedNode, Element)) {
      cloneCSSStyle(nativeNode, clonedNode, options);
      clonePseudoElements(nativeNode, clonedNode, options);
      cloneInputValue(nativeNode, clonedNode);
      cloneSelectValue(nativeNode, clonedNode);
    }
    return clonedNode;
  }
  async function ensureSVGSymbols(clone, options) {
    const uses = clone.querySelectorAll ? clone.querySelectorAll("use") : [];
    if (uses.length === 0) {
      return clone;
    }
    const processedDefs = {};
    for (let i = 0; i < uses.length; i++) {
      const use = uses[i];
      const id = use.getAttribute("xlink:href");
      if (id) {
        const exist = clone.querySelector(id);
        const definition = document.querySelector(id);
        if (!exist && definition && !processedDefs[id]) {
          processedDefs[id] = await cloneNode(definition, options, true);
        }
      }
    }
    const nodes = Object.values(processedDefs);
    if (nodes.length) {
      const ns = "http://www.w3.org/1999/xhtml";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("xmlns", ns);
      svg.style.position = "absolute";
      svg.style.width = "0";
      svg.style.height = "0";
      svg.style.overflow = "hidden";
      svg.style.display = "none";
      const defs = document.createElementNS(ns, "defs");
      svg.appendChild(defs);
      for (let i = 0; i < nodes.length; i++) {
        defs.appendChild(nodes[i]);
      }
      clone.appendChild(svg);
    }
    return clone;
  }
  async function cloneNode(node, options, isRoot) {
    if (!isRoot && options.filter && !options.filter(node)) {
      return null;
    }
    return Promise.resolve(node).then((clonedNode) => cloneSingleNode(clonedNode, options)).then((clonedNode) => cloneChildren(node, clonedNode, options)).then((clonedNode) => decorate(node, clonedNode, options)).then((clonedNode) => ensureSVGSymbols(clonedNode, options));
  }

  // node_modules/html-to-image/es/embed-resources.js
  var URL_REGEX = /url\((['"]?)([^'"]+?)\1\)/g;
  var URL_WITH_FORMAT_REGEX = /url\([^)]+\)\s*format\((["']?)([^"']+)\1\)/g;
  var FONT_SRC_REGEX = /src:\s*(?:url\([^)]+\)\s*format\([^)]+\)[,;]\s*)+/g;
  function toRegex(url) {
    const escaped = url.replace(/([.*+?^${}()|\[\]\/\\])/g, "\\$1");
    return new RegExp(`(url\\(['"]?)(${escaped})(['"]?\\))`, "g");
  }
  function parseURLs(cssText) {
    const urls = [];
    cssText.replace(URL_REGEX, (raw, quotation, url) => {
      urls.push(url);
      return raw;
    });
    return urls.filter((url) => !isDataUrl(url));
  }
  async function embed(cssText, resourceURL, baseURL, options, getContentFromUrl) {
    try {
      const resolvedURL = baseURL ? resolveUrl(resourceURL, baseURL) : resourceURL;
      const contentType = getMimeType(resourceURL);
      let dataURL;
      if (getContentFromUrl) {
        const content = await getContentFromUrl(resolvedURL);
        dataURL = makeDataUrl(content, contentType);
      } else {
        dataURL = await resourceToDataURL(resolvedURL, contentType, options);
      }
      return cssText.replace(toRegex(resourceURL), `$1${dataURL}$3`);
    } catch (error) {
    }
    return cssText;
  }
  function filterPreferredFontFormat(str, { preferredFontFormat }) {
    return !preferredFontFormat ? str : str.replace(FONT_SRC_REGEX, (match) => {
      while (true) {
        const [src, , format] = URL_WITH_FORMAT_REGEX.exec(match) || [];
        if (!format) {
          return "";
        }
        if (format === preferredFontFormat) {
          return `src: ${src};`;
        }
      }
    });
  }
  function shouldEmbed(url) {
    return url.search(URL_REGEX) !== -1;
  }
  async function embedResources(cssText, baseUrl, options) {
    if (!shouldEmbed(cssText)) {
      return cssText;
    }
    const filteredCSSText = filterPreferredFontFormat(cssText, options);
    const urls = parseURLs(filteredCSSText);
    return urls.reduce((deferred, url) => deferred.then((css) => embed(css, url, baseUrl, options)), Promise.resolve(filteredCSSText));
  }

  // node_modules/html-to-image/es/embed-images.js
  async function embedProp(propName, node, options) {
    var _a;
    const propValue = (_a = node.style) === null || _a === void 0 ? void 0 : _a.getPropertyValue(propName);
    if (propValue) {
      const cssString = await embedResources(propValue, null, options);
      node.style.setProperty(propName, cssString, node.style.getPropertyPriority(propName));
      return true;
    }
    return false;
  }
  async function embedBackground(clonedNode, options) {
    ;
    await embedProp("background", clonedNode, options) || await embedProp("background-image", clonedNode, options);
    await embedProp("mask", clonedNode, options) || await embedProp("-webkit-mask", clonedNode, options) || await embedProp("mask-image", clonedNode, options) || await embedProp("-webkit-mask-image", clonedNode, options);
  }
  async function embedImageNode(clonedNode, options) {
    const isImageElement = isInstanceOfElement(clonedNode, HTMLImageElement);
    if (!(isImageElement && !isDataUrl(clonedNode.src)) && !(isInstanceOfElement(clonedNode, SVGImageElement) && !isDataUrl(clonedNode.href.baseVal))) {
      return;
    }
    const url = isImageElement ? clonedNode.src : clonedNode.href.baseVal;
    const dataURL = await resourceToDataURL(url, getMimeType(url), options);
    await new Promise((resolve, reject) => {
      clonedNode.onload = resolve;
      clonedNode.onerror = options.onImageErrorHandler ? (...attributes) => {
        try {
          resolve(options.onImageErrorHandler(...attributes));
        } catch (error) {
          reject(error);
        }
      } : reject;
      const image = clonedNode;
      if (image.decode) {
        image.decode = resolve;
      }
      if (image.loading === "lazy") {
        image.loading = "eager";
      }
      if (isImageElement) {
        clonedNode.srcset = "";
        clonedNode.src = dataURL;
      } else {
        clonedNode.href.baseVal = dataURL;
      }
    });
  }
  async function embedChildren(clonedNode, options) {
    const children = toArray(clonedNode.childNodes);
    const deferreds = children.map((child) => embedImages(child, options));
    await Promise.all(deferreds).then(() => clonedNode);
  }
  async function embedImages(clonedNode, options) {
    if (isInstanceOfElement(clonedNode, Element)) {
      await embedBackground(clonedNode, options);
      await embedImageNode(clonedNode, options);
      await embedChildren(clonedNode, options);
    }
  }

  // node_modules/html-to-image/es/apply-style.js
  function applyStyle(node, options) {
    const { style } = node;
    if (options.backgroundColor) {
      style.backgroundColor = options.backgroundColor;
    }
    if (options.width) {
      style.width = `${options.width}px`;
    }
    if (options.height) {
      style.height = `${options.height}px`;
    }
    const manual = options.style;
    if (manual != null) {
      Object.keys(manual).forEach((key) => {
        style[key] = manual[key];
      });
    }
    return node;
  }

  // node_modules/html-to-image/es/embed-webfonts.js
  var cssFetchCache = {};
  async function fetchCSS(url) {
    let cache2 = cssFetchCache[url];
    if (cache2 != null) {
      return cache2;
    }
    const res = await fetch(url);
    const cssText = await res.text();
    cache2 = { url, cssText };
    cssFetchCache[url] = cache2;
    return cache2;
  }
  async function embedFonts(data, options) {
    let cssText = data.cssText;
    const regexUrl = /url\(["']?([^"')]+)["']?\)/g;
    const fontLocs = cssText.match(/url\([^)]+\)/g) || [];
    const loadFonts = fontLocs.map(async (loc) => {
      let url = loc.replace(regexUrl, "$1");
      if (!url.startsWith("https://")) {
        url = new URL(url, data.url).href;
      }
      return fetchAsDataURL(url, options.fetchRequestInit, ({ result }) => {
        cssText = cssText.replace(loc, `url(${result})`);
        return [loc, result];
      });
    });
    return Promise.all(loadFonts).then(() => cssText);
  }
  function parseCSS(source) {
    if (source == null) {
      return [];
    }
    const result = [];
    const commentsRegex = /(\/\*[\s\S]*?\*\/)/gi;
    let cssText = source.replace(commentsRegex, "");
    const keyframesRegex = new RegExp("((@.*?keyframes [\\s\\S]*?){([\\s\\S]*?}\\s*?)})", "gi");
    while (true) {
      const matches = keyframesRegex.exec(cssText);
      if (matches === null) {
        break;
      }
      result.push(matches[0]);
    }
    cssText = cssText.replace(keyframesRegex, "");
    const importRegex = /@import[\s\S]*?url\([^)]*\)[\s\S]*?;/gi;
    const combinedCSSRegex = "((\\s*?(?:\\/\\*[\\s\\S]*?\\*\\/)?\\s*?@media[\\s\\S]*?){([\\s\\S]*?)}\\s*?})|(([\\s\\S]*?){([\\s\\S]*?)})";
    const unifiedRegex = new RegExp(combinedCSSRegex, "gi");
    while (true) {
      let matches = importRegex.exec(cssText);
      if (matches === null) {
        matches = unifiedRegex.exec(cssText);
        if (matches === null) {
          break;
        } else {
          importRegex.lastIndex = unifiedRegex.lastIndex;
        }
      } else {
        unifiedRegex.lastIndex = importRegex.lastIndex;
      }
      result.push(matches[0]);
    }
    return result;
  }
  async function getCSSRules(styleSheets, options) {
    const ret = [];
    const deferreds = [];
    styleSheets.forEach((sheet) => {
      if ("cssRules" in sheet) {
        try {
          toArray(sheet.cssRules || []).forEach((item, index) => {
            if (item.type === CSSRule.IMPORT_RULE) {
              let importIndex = index + 1;
              const url = item.href;
              const deferred = fetchCSS(url).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
                try {
                  sheet.insertRule(rule, rule.startsWith("@import") ? importIndex += 1 : sheet.cssRules.length);
                } catch (error) {
                  console.error("Error inserting rule from remote css", {
                    rule,
                    error
                  });
                }
              })).catch((e) => {
                console.error("Error loading remote css", e.toString());
              });
              deferreds.push(deferred);
            }
          });
        } catch (e) {
          const inline = styleSheets.find((a) => a.href == null) || document.styleSheets[0];
          if (sheet.href != null) {
            deferreds.push(fetchCSS(sheet.href).then((metadata) => embedFonts(metadata, options)).then((cssText) => parseCSS(cssText).forEach((rule) => {
              inline.insertRule(rule, inline.cssRules.length);
            })).catch((err) => {
              console.error("Error loading remote stylesheet", err);
            }));
          }
          console.error("Error inlining remote css file", e);
        }
      }
    });
    return Promise.all(deferreds).then(() => {
      styleSheets.forEach((sheet) => {
        if ("cssRules" in sheet) {
          try {
            toArray(sheet.cssRules || []).forEach((item) => {
              ret.push(item);
            });
          } catch (e) {
            console.error(`Error while reading CSS rules from ${sheet.href}`, e);
          }
        }
      });
      return ret;
    });
  }
  function getWebFontRules(cssRules) {
    return cssRules.filter((rule) => rule.type === CSSRule.FONT_FACE_RULE).filter((rule) => shouldEmbed(rule.style.getPropertyValue("src")));
  }
  async function parseWebFontRules(node, options) {
    if (node.ownerDocument == null) {
      throw new Error("Provided element is not within a Document");
    }
    const styleSheets = toArray(node.ownerDocument.styleSheets);
    const cssRules = await getCSSRules(styleSheets, options);
    return getWebFontRules(cssRules);
  }
  function normalizeFontFamily(font) {
    return font.trim().replace(/["']/g, "");
  }
  function getUsedFonts(node) {
    const fonts = /* @__PURE__ */ new Set();
    function traverse(node2) {
      const fontFamily = node2.style.fontFamily || getComputedStyle(node2).fontFamily;
      fontFamily.split(",").forEach((font) => {
        fonts.add(normalizeFontFamily(font));
      });
      Array.from(node2.children).forEach((child) => {
        if (child instanceof HTMLElement) {
          traverse(child);
        }
      });
    }
    traverse(node);
    return fonts;
  }
  async function getWebFontCSS(node, options) {
    const rules = await parseWebFontRules(node, options);
    const usedFonts = getUsedFonts(node);
    const cssTexts = await Promise.all(rules.filter((rule) => usedFonts.has(normalizeFontFamily(rule.style.fontFamily))).map((rule) => {
      const baseUrl = rule.parentStyleSheet ? rule.parentStyleSheet.href : null;
      return embedResources(rule.cssText, baseUrl, options);
    }));
    return cssTexts.join("\n");
  }
  async function embedWebFonts(clonedNode, options) {
    const cssText = options.fontEmbedCSS != null ? options.fontEmbedCSS : options.skipFonts ? null : await getWebFontCSS(clonedNode, options);
    if (cssText) {
      const styleNode = document.createElement("style");
      const sytleContent = document.createTextNode(cssText);
      styleNode.appendChild(sytleContent);
      if (clonedNode.firstChild) {
        clonedNode.insertBefore(styleNode, clonedNode.firstChild);
      } else {
        clonedNode.appendChild(styleNode);
      }
    }
  }

  // node_modules/html-to-image/es/index.js
  async function toSvg(node, options = {}) {
    const { width, height } = getImageSize(node, options);
    const clonedNode = await cloneNode(node, options, true);
    await embedWebFonts(clonedNode, options);
    await embedImages(clonedNode, options);
    applyStyle(clonedNode, options);
    const datauri = await nodeToDataURL(clonedNode, width, height);
    return datauri;
  }
  async function toCanvas(node, options = {}) {
    const { width, height } = getImageSize(node, options);
    const svg = await toSvg(node, options);
    const img = await createImage(svg);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    const ratio = options.pixelRatio || getPixelRatio();
    const canvasWidth = options.canvasWidth || width;
    const canvasHeight = options.canvasHeight || height;
    canvas.width = canvasWidth * ratio;
    canvas.height = canvasHeight * ratio;
    if (!options.skipAutoScale) {
      checkCanvasDimensions(canvas);
    }
    canvas.style.width = `${canvasWidth}`;
    canvas.style.height = `${canvasHeight}`;
    if (options.backgroundColor) {
      context.fillStyle = options.backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  async function toPng(node, options = {}) {
    const canvas = await toCanvas(node, options);
    return canvas.toDataURL();
  }

  // js/site-origin.js
  var SITE_ORIGIN = "https://tech-ratte.github.io/tile-city";

  // js/play/share.js
  var RANK_HEX = {
    red: "#ff5d78",
    blue: "#49c4ff",
    green: "#3dff9a",
    yellow: "#ffe14a",
    orange: "#ff9a3d",
    purple: "#7c3aed",
    white: "#f4f7fb",
    brown: "#a67c52"
  };
  var SHARE_W = 1080;
  var SHARE_H = 1920;
  function siteUrl() {
    if (SITE_ORIGIN) {
      return String(SITE_ORIGIN).replace(/\/$/, "") + "/index.html";
    }
    try {
      return new URL("index.html", location.href).href;
    } catch (err) {
      return location.href;
    }
  }
  function rankingRows(game2, nameOf) {
    const order = game2.standings || game2.players.map((_, index) => index);
    return order.map((index, rank) => {
      const player = game2.players[index];
      return {
        rank: rank + 1,
        name: nameOf(player),
        score: game2.scores[index],
        color: player.id,
        hex: RANK_HEX[player.id] || "#f4f7fb",
        bot: !!player.bot,
        botMaster: !!(player.bot && player.botStrength === "master")
      };
    });
  }
  function buildShareText(game2, nameOf, labels) {
    const rows = rankingRows(game2, nameOf);
    const lines = [labels.title, ""].concat(
      rows.map((row) => row.rank + ". " + row.name + " \u2014 " + row.score),
      ["", labels.hashtag]
    );
    return lines.join("\n");
  }
  function waitFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  function measureFilledCrop(grid, pixelRatio, marginCss) {
    const slots = grid.querySelectorAll(".slot.filled");
    if (!slots.length) return null;
    const gridRect = grid.getBoundingClientRect();
    let minL = Infinity;
    let minT = Infinity;
    let maxR = -Infinity;
    let maxB = -Infinity;
    slots.forEach((el) => {
      const r = el.getBoundingClientRect();
      minL = Math.min(minL, r.left);
      minT = Math.min(minT, r.top);
      maxR = Math.max(maxR, r.right);
      maxB = Math.max(maxB, r.bottom);
    });
    const margin = marginCss * pixelRatio;
    const x = (minL - gridRect.left) * pixelRatio - margin;
    const y = (minT - gridRect.top) * pixelRatio - margin;
    const w = (maxR - minL) * pixelRatio + margin * 2;
    const h = (maxB - minT) * pixelRatio + margin * 2;
    return { x, y, w, h };
  }
  function clampCrop(crop, imgW, imgH) {
    if (!crop) {
      return { x: 0, y: 0, w: imgW, h: imgH };
    }
    const x = Math.max(0, Math.floor(crop.x));
    const y = Math.max(0, Math.floor(crop.y));
    const right = Math.min(imgW, Math.ceil(crop.x + crop.w));
    const bottom = Math.min(imgH, Math.ceil(crop.y + crop.h));
    return {
      x,
      y,
      w: Math.max(1, right - x),
      h: Math.max(1, bottom - y)
    };
  }
  async function captureBoardPng() {
    const grid = document.getElementById("grid");
    const box = document.getElementById("scroller");
    if (!grid || !box) throw new Error("board missing");
    const prevPad = grid.style.padding;
    const scrollLeft = box.scrollLeft;
    const scrollTop = box.scrollTop;
    const hidden = [];
    grid.querySelectorAll(".meeple-earned, .recent-ring").forEach((el) => {
      hidden.push([el, el.style.visibility]);
      el.style.visibility = "hidden";
    });
    grid.style.padding = "0";
    void grid.offsetWidth;
    const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    const crop = measureFilledCrop(grid, pixelRatio, 10);
    try {
      await waitFrame();
      const dataUrl = await toPng(grid, {
        cacheBust: true,
        pixelRatio,
        style: {
          overflow: "visible",
          padding: "0"
        }
      });
      return { dataUrl, crop };
    } finally {
      hidden.forEach(([el, value]) => {
        el.style.visibility = value;
      });
      grid.style.padding = prevPad;
      void grid.offsetWidth;
      box.scrollLeft = scrollLeft;
      box.scrollTop = scrollTop;
    }
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  var SIDE_PAD = 48;
  var SIDE_GAP = 28;
  var RANK_WIDTH = 720;
  function rankingCardSize(rows) {
    const pad = 36;
    const rowH = 72;
    const titleH = 64;
    return {
      pad,
      rowH,
      titleH,
      width: RANK_WIDTH,
      height: pad * 2 + titleH + rows.length * rowH
    };
  }
  var BOT_ICO_PATH = "M9 3h6v2h3a2 2 0 0 1 2 2v5h-2V7H6v5H4V7a2 2 0 0 1 2-2h3V3zm-3 9h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2h2v2h-2V2z";
  function drawBotBadge(ctx, cx, cy, master) {
    const size = 34;
    const x = cx - size / 2;
    const y = cy - size / 2;
    ctx.save();
    if (master) {
      ctx.fillStyle = "rgba(140, 60, 20, 0.55)";
      ctx.strokeStyle = "rgba(255, 196, 72, 0.9)";
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
    }
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, size, size, 6);
    ctx.fill();
    ctx.stroke();
    if (master) {
      ctx.shadowColor = "rgba(255, 160, 40, 0.55)";
      ctx.shadowBlur = 8;
    }
    ctx.fillStyle = master ? "#ffe7a8" : "#d7e6f5";
    ctx.translate(x + 4, y + 4);
    ctx.scale((size - 8) / 24, (size - 8) / 24);
    ctx.fill(new Path2D(BOT_ICO_PATH));
    ctx.restore();
    return size;
  }
  function drawRankingCard(ctx, rows, labels, x, y) {
    const { pad, rowH, titleH, width, height } = rankingCardSize(rows);
    ctx.fillStyle = "rgba(10, 16, 28, 0.88)";
    ctx.strokeStyle = "rgba(140, 220, 255, 0.35)";
    ctx.lineWidth = 4;
    roundRect(ctx, x, y, width, height, 26);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4f7fb";
    ctx.font = "700 42px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    ctx.fillText(labels.ranking, x + pad, y + pad + 38);
    rows.forEach((row, i) => {
      const top = y + pad + titleH + i * rowH;
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      roundRect(ctx, x + 22, top, width - 44, rowH - 12, 14);
      ctx.fill();
      ctx.fillStyle = "#93a8be";
      ctx.font = "700 32px 'Segoe UI', 'Yu Gothic UI', sans-serif";
      ctx.fillText(String(row.rank), x + 44, top + 42);
      ctx.fillStyle = "#f4f7fb";
      ctx.font = "700 38px 'Segoe UI', 'Yu Gothic UI', sans-serif";
      const score = String(row.score);
      const sw = ctx.measureText(score).width;
      const scoreX = x + width - 44 - sw;
      ctx.fillText(score, scoreX, top + 42);
      const nameMax = row.bot ? 10 : 12;
      const name = row.name.length > nameMax ? row.name.slice(0, nameMax - 1) + "\u2026" : row.name;
      ctx.fillStyle = row.hex;
      ctx.font = "700 36px 'Segoe UI', 'Yu Gothic UI', sans-serif";
      const nameX = x + 88;
      ctx.fillText(name, nameX, top + 42);
      if (row.bot) {
        const nameW = ctx.measureText(name).width;
        drawBotBadge(ctx, nameX + nameW + 22, top + 30, row.botMaster);
      }
    });
    return { x, y, w: width, h: height };
  }
  function drawBrandMark(ctx, x, y, url) {
    const label = "TileCity";
    const link = String(url || "").replace(/^https?:\/\//i, "").replace(/\/index\.html$/i, "").replace(/\/$/, "");
    const padX = 32;
    const padY = 22;
    const gap = 14;
    ctx.save();
    ctx.font = "700 64px Georgia, 'Times New Roman', serif";
    const titleMetrics = ctx.measureText(label);
    const titleAscent = titleMetrics.actualBoundingBoxAscent || 50;
    const titleDescent = titleMetrics.actualBoundingBoxDescent || 14;
    const titleW = titleMetrics.width;
    ctx.font = "600 36px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    const linkMetrics = ctx.measureText(link);
    const linkAscent = linkMetrics.actualBoundingBoxAscent || 28;
    const linkDescent = linkMetrics.actualBoundingBoxDescent || 8;
    const linkW = linkMetrics.width;
    const innerW = Math.max(titleW, linkW);
    const w = innerW + padX * 2;
    const h = padY + titleAscent + titleDescent + gap + linkAscent + linkDescent + padY;
    ctx.fillStyle = "rgba(10, 16, 28, 0.55)";
    roundRect(ctx, x, y, w, h, 18);
    ctx.fill();
    ctx.fillStyle = "#f3efe6";
    ctx.font = "700 64px Georgia, 'Times New Roman', serif";
    ctx.fillText(label, x + padX, y + padY + titleAscent);
    ctx.fillStyle = "rgba(243, 239, 230, 0.85)";
    ctx.font = "600 36px 'Segoe UI', 'Yu Gothic UI', sans-serif";
    ctx.fillText(
      link,
      x + padX,
      y + padY + titleAscent + titleDescent + gap + linkAscent
    );
    ctx.restore();
    return { x, y, w, h };
  }
  async function composeShareImage(game2, nameOf, labels) {
    const rows = rankingRows(game2, nameOf);
    const captured = await captureBoardPng();
    const board = await loadImage(captured.dataUrl);
    const crop = clampCrop(captured.crop, board.width, board.height);
    const canvas = document.createElement("canvas");
    canvas.width = SHARE_W;
    canvas.height = SHARE_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#b69256";
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);
    const brand = drawBrandMark(ctx, SIDE_PAD, SIDE_PAD, siteUrl());
    const rankSize = rankingCardSize(rows);
    const rankY = SHARE_H - SIDE_PAD - rankSize.height;
    const rankX = Math.round((SHARE_W - rankSize.width) / 2);
    const boardArea = {
      x: SIDE_PAD,
      y: brand.y + brand.h + SIDE_GAP,
      w: SHARE_W - SIDE_PAD * 2,
      h: Math.max(120, rankY - SIDE_GAP - (brand.y + brand.h + SIDE_GAP))
    };
    const scale = Math.min(boardArea.w / crop.w, boardArea.h / crop.h);
    const dw = crop.w * scale;
    const dh = crop.h * scale;
    const dx = boardArea.x + (boardArea.w - dw) / 2;
    const dy = boardArea.y + (boardArea.h - dh) / 2;
    ctx.drawImage(board, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);
    drawRankingCard(ctx, rows, labels, rankX, rankY);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (value) => value ? resolve(value) : reject(new Error("toBlob failed")),
        "image/png"
      );
    });
    const dataUrl = canvas.toDataURL("image/png");
    return { blob, dataUrl, fileName: "tilecity-ranking.png" };
  }
  function isAppleTouch() {
    const ua = navigator.userAgent || "";
    return /iPad|iPhone|iPod/.test(ua) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  }
  function snsLinks(text) {
    const url = siteUrl();
    const encodedUrl = encodeURIComponent(url);
    const body = text + "\n" + url;
    const withUrl = encodeURIComponent(body);
    const line = isAppleTouch() ? "https://line.me/R/msg/text/?" + withUrl : "https://social-plugins.line.me/lineit/share?url=" + encodedUrl + "&text=" + encodeURIComponent(text);
    return {
      url,
      x: "https://twitter.com/intent/tweet?text=" + withUrl,
      facebook: "https://www.facebook.com/sharer/sharer.php?u=" + encodedUrl,
      line,
      threads: "https://www.threads.net/intent/post?text=" + withUrl,
      text
    };
  }
  async function nativeShare({ blob, fileName, text, url }) {
    const payload = { title: "TileCity", text, url };
    if (blob) {
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ ...payload, files: [file] });
        return "files";
      }
    }
    if (navigator.share) {
      await navigator.share(payload);
      return "text";
    }
    return null;
  }
  async function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
  async function downloadBlob(blob, fileName) {
    if (isAppleTouch()) {
      return "ios-hint";
    }
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 2e3);
    return "download";
  }

  // js/play/roulette.js
  var START_TICKS = { thr: 0.05, minGap: 0.04 };
  var SLOW_TICKS = { thr: 0.09, minGap: 0.12, lead: 0.04 };
  var START_DURATION_FALLBACK = 2.7;
  function fallbackTicks(durationSec, kind) {
    const dur = Math.max(0.4, durationSec || (kind === "slow" ? 2.9 : START_DURATION_FALLBACK));
    const times = [];
    if (kind === "slow") {
      let t3 = 0.05;
      let gap = 0.12;
      while (t3 < dur - 0.05) {
        times.push(t3);
        gap = Math.min(0.75, gap * 1.28);
        t3 += gap;
      }
      if (!times.length) times.push(dur * 0.5);
      return times;
    }
    for (let t3 = 0.02; t3 < dur - 0.05; t3 += 0.052) times.push(t3);
    return times;
  }
  function hexFor(palette, id) {
    const hit = palette.find((item) => item.id === id);
    return hit ? hit.hex : "#f4f7fb";
  }
  function openFirstRoulette(opts) {
    const {
      overlay,
      players,
      winner,
      palette,
      nameOf,
      t: t3,
      onSpin,
      onDone
    } = opts;
    if (!overlay || !players || !players.length) {
      if (typeof onDone === "function") onDone();
      return { close() {
      } };
    }
    const nameEl = overlay.querySelector("#roulette-name");
    const result = overlay.querySelector("#roulette-result");
    const actionBtn = overlay.querySelector("#roulette-action");
    if (!nameEl || !actionBtn) {
      if (typeof onDone === "function") onDone();
      return { close() {
      } };
    }
    const startSrc = audio_default.SOUNDS.rouletteStart;
    const slowSrc = audio_default.SOUNDS.rouletteSlow;
    const stopSrc = audio_default.SOUNDS.rouletteStop;
    let spinning = false;
    let decided = false;
    let finished = false;
    let startDuration = START_DURATION_FALLBACK;
    let startTicks = fallbackTicks(startDuration, "start");
    let slowTicks = fallbackTicks(2.9, "slow");
    audio_default.preloadSounds([startSrc, slowSrc, stopSrc]);
    void (async () => {
      const detectedStart = await audio_default.peekTicks(startSrc, START_TICKS);
      const detectedSlow = await audio_default.peekTicks(slowSrc, SLOW_TICKS);
      if (detectedStart.length) startTicks = detectedStart;
      if (detectedSlow.length) slowTicks = detectedSlow;
      const dur = audio_default.getSoundDuration(startSrc);
      if (dur && dur > 0) startDuration = dur;
    })();
    function paintName(index) {
      const player = players[(index % players.length + players.length) % players.length];
      nameEl.textContent = nameOf(player);
      nameEl.style.color = "";
      nameEl.className = "roulette-name " + player.id;
    }
    paintName(0);
    if (result) {
      result.hidden = true;
      result.textContent = "";
    }
    actionBtn.hidden = false;
    actionBtn.disabled = false;
    actionBtn.dataset.phase = "start";
    actionBtn.textContent = t3("rouletteStart");
    overlay.hidden = false;
    overlay.removeAttribute("hidden");
    function finish() {
      if (finished) return;
      finished = true;
      overlay.hidden = true;
      overlay.setAttribute("hidden", "");
      if (typeof onDone === "function") onDone();
    }
    function reveal() {
      spinning = false;
      decided = true;
      paintName(winner);
      const player = players[winner];
      if (result) {
        result.hidden = false;
        result.innerHTML = '<span class="roulette-winner-swatch ' + player.id + '" style="--ink:' + hexFor(palette, player.id) + '"></span><strong>' + nameOf(player) + "</strong> " + t3("rouletteGoesFirst");
      }
      audio_default.playSound("rouletteStop");
      actionBtn.disabled = false;
      actionBtn.dataset.phase = "ok";
      actionBtn.textContent = t3("ok");
      actionBtn.focus();
    }
    async function runSpin() {
      if (spinning || finished || decided) return;
      spinning = true;
      actionBtn.disabled = true;
      if (typeof onSpin === "function") onSpin();
      void audio_default.unlockAudio();
      if (result) {
        result.hidden = true;
        result.textContent = "";
      }
      const halfStart = Math.max(0.35, startDuration * 0.5);
      const startTicksHalf = startTicks.filter((at) => at < halfStart);
      const activeStartTicks = startTicksHalf.length ? startTicksHalf : fallbackTicks(halfStart, "start");
      const n = players.length;
      const total = Math.max(1, activeStartTicks.length + slowTicks.length);
      let flip = 0;
      const offset = ((winner - (total - 1)) % n + n) % n;
      const onTick = () => {
        paintName(offset + flip);
        flip += 1;
      };
      await audio_default.playWithTicks(
        startSrc,
        Object.assign({}, START_TICKS, { maxPlaySec: halfStart }),
        onTick,
        activeStartTicks
      );
      if (finished) return;
      await audio_default.playWithTicks(slowSrc, SLOW_TICKS, onTick, slowTicks);
      if (finished) return;
      paintName(winner);
      reveal();
    }
    actionBtn.addEventListener("click", () => {
      if (actionBtn.dataset.phase === "ok") finish();
      else void runSpin();
    });
    return {
      close: finish,
      isOpen: () => !overlay.hidden
    };
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
  var BOT_CENTER_MS = 1e3;
  var TILE_TOTAL = game_default.TYPES.reduce((sum, type) => sum + type.count, 0);
  var exitConfirmOpen = false;
  var leaveFxTimer = null;
  var endFanfareStarted = false;
  var botTimer = null;
  var botBusy = false;
  var centerAnim = null;
  var centerAnimDone = null;
  var rouletteOpen = false;
  function loadRoster2() {
    return loadRoster(game_default);
  }
  function loadSetupOptions2() {
    return loadSetupOptions(game_default);
  }
  function loadSavedGame2() {
    return loadSavedGame(game_default);
  }
  var readyToPersist = false;
  var persistTimer = null;
  var PERSIST_ZOOM_MS = 200;
  function persistGame() {
    if (persistTimer != null) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }
    const box = document.getElementById("scroller");
    writeSave(game_default, game, {
      zoom: boardZoom,
      left: box ? box.scrollLeft : 0,
      top: box ? box.scrollTop : 0
    }, readyToPersist);
  }
  function persistGameSoon() {
    if (persistTimer != null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      persistTimer = null;
      persistGame();
    }, PERSIST_ZOOM_MS);
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
  var game = saved ? saved.game : game_default.createGame(void 0, roster, loadSetupOptions2());
  var pan = null;
  var skipClick = false;
  var suppressHandClickUntil = 0;
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
  var syncedPadX = -1;
  var syncedPadY = -1;
  function gridPadBox(grid) {
    let left = syncedPadX;
    let top = syncedPadY;
    let right = syncedPadX;
    let bottom = syncedPadY;
    if (!(left >= 0) || !(top >= 0)) {
      const style = getComputedStyle(grid);
      left = parseFloat(style.paddingLeft) || 0;
      top = parseFloat(style.paddingTop) || 0;
      right = parseFloat(style.paddingRight) || 0;
      bottom = parseFloat(style.paddingBottom) || 0;
    }
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
    if (padX === syncedPadX && padY === syncedPadY) return;
    const before = gridPadBox(grid);
    const midX = box.scrollLeft + box.clientWidth / 2;
    const midY = box.scrollTop + box.clientHeight / 2;
    const boardX = midX - before.left;
    const boardY = midY - before.top;
    grid.style.padding = padY + "px " + padX + "px";
    syncedPadX = padX;
    syncedPadY = padY;
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
    const px2 = pivot ? pivot.x - rect.left : rect.width / 2;
    const py = pivot ? pivot.y - rect.top : rect.height / 2;
    const beforePad = gridPadBox(grid);
    const contentX = box.scrollLeft + px2;
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
    ) - px2;
    box.scrollTop = mapZoomCoord(
      contentY,
      beforePad.top,
      beforePad.innerH,
      afterPad.top,
      afterPad.innerH
    ) - py;
    persistGameSoon();
  }
  var zoomRaf = null;
  var zoomGoal = null;
  function scheduleBoardZoom(next, pivot) {
    zoomGoal = { zoom: next, pivot };
    if (zoomRaf != null) return;
    zoomRaf = requestAnimationFrame(() => {
      zoomRaf = null;
      const goal = zoomGoal;
      zoomGoal = null;
      if (goal) setBoardZoom(goal.zoom, goal.pivot);
    });
  }
  function paintLegend() {
    const legend = document.getElementById("legend");
    legend.innerHTML = '<div class="hint-legend"><p><i class="swatch-key now"></i>' + t2("canPlace") + '</p><p><i class="swatch-key later"></i>' + t2("needsRotate") + '</p><div class="zoom-controls"><button type="button" class="zoom-btn" id="zoom-out" aria-label="' + t2("zoomOut") + '">\u2212</button><span class="zoom-label" id="zoom-label">' + zoomPercent() + '</span><button type="button" class="zoom-btn" id="zoom-in" aria-label="' + t2("zoomIn") + '">+</button></div></div><p class="rot-hint">' + t2("rotHint") + "</p>";
  }
  function activeSeat() {
    if (game.pendingConfirm) return game.pendingConfirm.player;
    if (game.pendingMeeple) return game.pendingMeeple.player;
    return game.player;
  }
  function undoButtonHTML() {
    return '<button type="button" id="undo-place" aria-label="' + t2("undoPlace") + '" title="' + t2("undoPlace") + '"><svg class="undo-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button>';
  }
  function isBotSeat(index) {
    return game_default.isBotPlayer(game.players[index]);
  }
  function isBotTurn() {
    if (rouletteOpen || game.finished || exitConfirmOpen) return false;
    return isBotSeat(activeSeat());
  }
  function humanControlsLocked() {
    return rouletteOpen || isBotTurn() || botBusy;
  }
  function displayPlayerName(player) {
    if (player.bot) return game_default.botNameForColor(player.id, i18n_default.getLang());
    return player.name;
  }
  function botBadgeHTML(player) {
    const master = player && player.botStrength === "master";
    const title = master ? t2("botStrengthMaster") : t2("botThinking");
    const cls = "bot-badge" + (master ? " bot-badge--master" : "");
    return '<span class="' + cls + '" title="' + title + '" aria-label="' + t2("playerKindBot") + (master ? " " + t2("botStrengthMaster") : "") + '"><svg class="bot-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 3h6v2h3a2 2 0 0 1 2 2v5h-2V7H6v5H4V7a2 2 0 0 1 2-2h3V3zm-3 9h12a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM11 2h2v2h-2V2z"/></svg></span>';
  }
  function playersHTML() {
    const order = game.finished && game.standings ? game.standings : game.players.map((_, index) => index);
    return '<ul class="players">' + order.map((index) => {
      const player = game.players[index];
      const on = !game.finished && index === game.player ? " on" : "";
      const rank = game.finished ? '<span class="rank">' + (order.indexOf(index) + 1) + "</span>" : "";
      const bot = player.bot ? botBadgeHTML(player) : "";
      const master = player.bot && player.botStrength === "master" ? " bot-master" : "";
      return '<li class="' + player.id + on + (player.bot ? " bot" : "") + master + '">' + rank + '<span class="pname">' + displayPlayerName(player) + bot + '</span><span class="meeple-count"><i class="meeple ' + player.id + '" aria-hidden="true"></i>\xD7' + game.meeples[index] + '</span><b class="score">' + game.scores[index] + "</b></li>";
    }).join("") + "</ul>";
  }
  function endActionsHTML(layout) {
    if (layout === "row") {
      return '<button type="button" class="quit-chip js-quit">' + t2("home") + '</button><button type="button" class="ranking-chip js-open-ranking">' + t2("rank") + '</button><button type="button" class="again-chip js-again">' + t2("again") + "</button>";
    }
    return '<button type="button" class="ranking-chip js-open-ranking">' + t2("rank") + '</button><div class="end-actions"><button type="button" class="quit-chip js-quit">' + t2("home") + '</button><button type="button" class="again-chip js-again">' + t2("again") + "</button></div>";
  }
  function boardCap() {
    return Math.max(
      game.board.size,
      TILE_TOTAL - game.discards.length - (game.pendingDiscard ? 1 : 0)
    );
  }
  function statsHTML() {
    const exitTop = game.finished ? "" : '<button type="button" class="exit-chip js-exit">' + t2("exit") + "</button>";
    const cap = boardCap();
    return '<div class="meters"><div><span>' + t2("deck") + "</span><b>" + game.deck.length + "</b></div><div><span>" + t2("board") + "</span><b>" + game.board.size + "</b></div><div><span>" + t2("discards") + "</span><b>" + game.discards.length + '</b></div></div><div class="hud-meta">' + exitTop + '<div class="deck-short"><span class="deck-chip">' + t2("deck") + " " + game.deck.length + '</span><span class="deck-chip">' + t2("board") + " " + game.board.size + "/" + cap + '</span><span class="deck-chip">' + t2("discards") + " " + game.discards.length + "</span></div></div>";
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
    let earned = "";
    if (pin.earned) {
      const label = pin.earnedDim ? String(pin.earned) : "+" + pin.earned;
      earned = '<span class="meeple-earned' + (pin.earnedDim ? " sub" : "") + '">' + label + "</span>";
    }
    let style = "left:" + pin.x * 100 + "%;top:" + pin.y * 100 + "%";
    if (leaving && pin.at) {
      const ageSec = Math.max(0, (Date.now() - pin.at) / 1e3);
      style += ";--leave-age:-" + ageSec + "s";
    }
    return '<span class="meeple-pin' + (leaving ? " leaving" : "") + '" style="' + style + '"><i class="meeple on-tile ' + pin.color + fieldClass + '" aria-hidden="true"></i>' + earned + "</span>";
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
    if (game.pendingConfirm) {
      marks.push(
        '<div class="meeple-layer confirm-layer"><div class="meeple-actions"><button type="button" id="confirm-turn">' + t2("ok") + "</button>" + undoButtonHTML() + "</div></div>"
      );
      return marks.join("");
    }
    if (!game.pendingMeeple) return marks.join("");
    const color = game.players[game.pendingMeeple.player].id;
    const slots = game.meepleSlots();
    const spots = slots.map(
      (slot) => '<button type="button" class="meeple-spot spot-' + slot.kind + '" data-meeple-slot="' + slot.id + '" style="left:' + slot.x * 100 + "%;top:" + slot.y * 100 + '%" aria-label="' + t2("placeMeeple") + '"><i class="meeple ' + color + '" aria-hidden="true"></i></button>'
    ).join("");
    const stock = game.meeples[game.pendingMeeple.player];
    const prompt = slots.length ? t2("pickMeeple") : stock <= 0 ? t2("noMeeplesLeft") : t2("noOpenSpot");
    marks.push(
      '<div class="meeple-layer"><p class="meeple-prompt">' + prompt + "</p>" + spots + '<div class="meeple-actions"><button type="button" id="confirm-turn">' + t2("ok") + "</button>" + undoButtonHTML() + "</div></div>"
    );
    return marks.join("");
  }
  function rankingHTML() {
    const order = game.standings || game.players.map((_, index) => index);
    const rows = order.map((index, rank) => {
      const player = game.players[index];
      const bot = player.bot ? botBadgeHTML(player) : "";
      return "<li" + (player.bot && player.botStrength === "master" ? ' class="bot-master"' : "") + '><span class="rank-num">' + (rank + 1) + '</span><span class="rank-name ' + player.id + '">' + displayPlayerName(player) + bot + '</span><b class="rank-score">' + game.scores[index] + "</b></li>";
    }).join("");
    return '<ul class="ranking-list">' + rows + "</ul>";
  }
  var sharePayload = null;
  var shareBusy = false;
  function shareLabels() {
    return {
      title: t2("shareTextTitle"),
      ranking: t2("gameOver"),
      hashtag: "#TileCity"
    };
  }
  function setShareStatus(message, kind) {
    const status = document.getElementById("share-status");
    if (!status) return;
    if (!message) {
      status.hidden = true;
      status.textContent = "";
      status.className = "share-status";
      return;
    }
    status.hidden = false;
    status.textContent = message;
    status.className = "share-status" + (kind ? " " + kind : "");
  }
  function bindShareLinks(text) {
    const links = snsLinks(text);
    const map = {
      "share-x": links.x,
      "share-line": links.line,
      "share-facebook": links.facebook,
      "share-threads": links.threads
    };
    Object.entries(map).forEach(([id, href]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.href = href;
      if (id === "share-line" && href.indexOf("line.me/R/msg/text") !== -1) {
        el.removeAttribute("target");
      } else {
        el.target = "_blank";
      }
    });
    return links;
  }
  async function openShareSheet() {
    if (!game.finished || shareBusy) return;
    const sheet = document.getElementById("share-sheet");
    const preview = document.getElementById("share-preview");
    const nativeBtn = document.getElementById("share-native");
    if (!sheet || !preview) return;
    shareBusy = true;
    sharePayload = null;
    setShareStatus(t2("sharePreparing"));
    sheet.hidden = false;
    preview.removeAttribute("src");
    preview.alt = t2("shareTitle");
    if (nativeBtn) nativeBtn.hidden = !navigator.share;
    const wasOpen = game.rankingOpen;
    game.rankingOpen = false;
    paintSide();
    try {
      const labels = shareLabels();
      const text = buildShareText(game, displayPlayerName, labels);
      const image = await composeShareImage(game, displayPlayerName, labels);
      sharePayload = { ...image, text, links: bindShareLinks(text) };
      preview.src = image.dataUrl;
      setShareStatus("");
    } catch (err) {
      console.error(err);
      const labels = shareLabels();
      const text = buildShareText(game, displayPlayerName, labels);
      sharePayload = {
        blob: null,
        dataUrl: "",
        fileName: "tilecity-ranking.png",
        text,
        links: bindShareLinks(text)
      };
      setShareStatus(t2("shareCaptureFail"), "error");
    } finally {
      game.rankingOpen = wasOpen;
      paintSide();
      shareBusy = false;
    }
  }
  function closeShareSheet() {
    const sheet = document.getElementById("share-sheet");
    if (sheet) sheet.hidden = true;
    sharePayload = null;
    setShareStatus("");
  }
  function pulseSharePreview() {
    const wrap = document.querySelector(".share-preview-wrap");
    if (!wrap) return;
    wrap.classList.remove("save-hint");
    void wrap.offsetWidth;
    wrap.classList.add("save-hint");
    window.setTimeout(() => wrap.classList.remove("save-hint"), 1800);
  }
  async function onShareNative() {
    if (!sharePayload) return;
    try {
      const mode = await nativeShare({
        blob: sharePayload.blob,
        fileName: sharePayload.fileName,
        text: sharePayload.text,
        url: sharePayload.links.url
      });
      if (mode) setShareStatus("");
      else setShareStatus(t2("shareNativeUnavailable"), "error");
    } catch (err) {
      if (err && err.name === "AbortError") return;
      console.error(err);
      setShareStatus(t2("shareNativeUnavailable"), "error");
    }
  }
  async function onShareDownload() {
    if (!sharePayload || !sharePayload.blob) {
      setShareStatus(t2("shareCaptureFail"), "error");
      return;
    }
    try {
      const mode = await downloadBlob(sharePayload.blob, sharePayload.fileName);
      if (mode === "abort") return;
      if (mode === "ios-hint") {
        pulseSharePreview();
        setShareStatus(t2("shareSaveHint"), "ok");
        return;
      }
      setShareStatus(t2("shareSaved"), "ok");
    } catch (err) {
      console.error(err);
      setShareStatus(t2("shareCaptureFail"), "error");
    }
  }
  async function onShareCopyText() {
    if (!sharePayload) return;
    const ok = await copyText(sharePayload.text + "\n" + sharePayload.links.url);
    setShareStatus(ok ? t2("shareCopied") : t2("shareCopyFail"), ok ? "ok" : "error");
  }
  async function onShareCopyUrl() {
    if (!sharePayload) return;
    const ok = await copyText(sharePayload.links.url);
    setShareStatus(ok ? t2("shareLinkCopied") : t2("shareCopyFail"), ok ? "ok" : "error");
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
    const hudTop = document.querySelector(".hud-top");
    if (hudTop) hudTop.hidden = !!game.finished;
    document.getElementById("players-root").innerHTML = playersHTML();
    document.getElementById("stats-root").innerHTML = statsHTML();
    document.getElementById("hand-root").innerHTML = handHTML();
    document.getElementById("foot-root").innerHTML = footHTML();
    paintDiscardOverlay();
    paintLegend();
  }
  var CLAIM_HEX = Object.fromEntries(
    game_default.COLOR_PALETTE.map((color) => [color.id, color.hex])
  );
  function claimAxisKind(claim) {
    const sectors = claim.sectors;
    if (!sectors || sectors.length < 2) return "ortho";
    if (sectors.length > 2) return "fan";
    let d = Math.abs(sectors[1].angle - sectors[0].angle);
    d = Math.min(d, 360 - d);
    return d >= 150 ? "ortho" : "diag";
  }
  function claimFanGradient(claim, wall, softMaxDeg) {
    const sectors = claim.sectors && claim.sectors.length >= 2 ? claim.sectors : [
      { color: claim.colors[0], angle: 270 },
      { color: claim.colors[1], angle: 90 }
    ];
    const softMax = softMaxDeg == null ? 20 : softMaxDeg;
    const n = sectors.length;
    const bounds = [];
    for (let i = 0; i < n; i++) {
      const a = sectors[i].angle;
      const b = sectors[(i + 1) % n].angle;
      const span = ((b - a) % 360 + 360) % 360;
      bounds.push(((a + span / 2) % 360 + 360) % 360);
    }
    const origin = bounds[n - 1];
    const parts = [];
    for (let i = 0; i < n; i++) {
      const hex = CLAIM_HEX[sectors[i].color] || "#ff5d78";
      const paint = wall ? "color-mix(in srgb, " + hex + " 52%, #1a0c08 48%)" : hex;
      let left = ((bounds[(i - 1 + n) % n] - origin) % 360 + 360) % 360;
      let right = ((bounds[i] - origin) % 360 + 360) % 360;
      if (right <= left) right += 360;
      const half = (right - left) / 2;
      const soft = Math.min(softMax, Math.max(5, half * 0.22));
      const solidL = left + soft;
      const solidR = right - soft;
      if (i === 0) parts.push(paint + " 0deg");
      parts.push(paint + " " + solidL + "deg");
      parts.push(paint + " " + solidR + "deg");
    }
    const firstHex = CLAIM_HEX[sectors[0].color] || "#ff5d78";
    const firstPaint = wall ? "color-mix(in srgb, " + firstHex + " 52%, #1a0c08 48%)" : firstHex;
    parts.push(firstPaint + " 360deg");
    return "conic-gradient(from " + origin + "deg, " + parts.join(", ") + ")";
  }
  var EDGE_DIRS = ["N", "E", "S", "W"];
  var GATE_CITY_IDS = /* @__PURE__ */ new Set(["C", "M", "N", "O", "P", "Q", "R", "S", "T"]);
  var HOUSE_CITY_IDS = /* @__PURE__ */ new Set(["D", "E", "F", "G", "H", "I", "J", "K", "L"]);
  var GATE_OPP = { N: "S", E: "W", S: "N", W: "E" };
  var CITY_GATE_HTML = '<span class="gate-pillar a"><span class="roof"></span><span class="win"></span></span><span class="gate-wall"><span class="door"></span></span><span class="gate-pillar b"><span class="roof"></span><span class="win"></span></span>';
  var CITY_HOUSE_HTML = '<span class="roof"></span><span class="body"><span class="win a"></span><span class="win b"></span><span class="door"></span></span>';
  function boardEdgeIsCity(tile, boardDir) {
    if (!tile || !tile.edges) return false;
    const edges = game_default.rotateEdges(tile.edges, tile.rot || 0);
    const index = EDGE_DIRS.indexOf(String(boardDir || "").toUpperCase());
    return index >= 0 && edges[index] === "C";
  }
  function clearCitySeamDecor() {
    document.querySelectorAll("#grid .city-gate, #grid .city-house").forEach((node) => node.remove());
  }
  function seamVertRotDeg(pos, kind) {
    let h = 2166136261;
    const salt = String(pos || "") + ":" + String(kind || "");
    for (let i = 0; i < salt.length; i++) {
      h ^= salt.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0 & 1 ? 90 : 270;
  }
  function cityFaceToward(pos, boardDir, claims) {
    if (!claims || !pos || !boardDir) return null;
    const prefix = pos + ":city-";
    let solo = null;
    for (const [key, claim] of claims.entries()) {
      if (!key.startsWith(prefix) || !claim || !claim.colors || !claim.colors.length) continue;
      if (claim.mode === "bridge" && claim.boardDir === boardDir) {
        return claim.face || claim.colors[0] || null;
      }
      if (claim.mode === "hub" && (claim.bridges || []).some((bridge) => bridge.dir === boardDir)) {
        return claim.face || claim.colors[0] || null;
      }
      if (!claim.tie && claim.colors.length === 1) solo = claim.colors[0];
      else if (claim.face) solo = claim.face;
    }
    return solo;
  }
  function tintGateStone(el, colorId) {
    if (!el || !colorId) return;
    const hex = CLAIM_HEX[colorId];
    if (!hex) return;
    el.style.setProperty("--tower", "color-mix(in srgb, " + hex + " 58%, #1a0c08 42%)");
    el.style.setProperty("--tower-lit", "color-mix(in srgb, " + hex + " 70%, #2a1410 30%)");
    el.style.setProperty("--tower-dark", "color-mix(in srgb, " + hex + " 34%, #0a0402 66%)");
    el.style.setProperty("--tower-mortar", "color-mix(in srgb, " + hex + " 18%, #050302 82%)");
    el.style.setProperty("--tower-roof", "color-mix(in srgb, " + hex + " 48%, #3e2010 52%)");
    el.style.setProperty("--tower-roof-dark", "color-mix(in srgb, " + hex + " 28%, #1a0a04 72%)");
    el.style.setProperty("--tower-window", "color-mix(in srgb, " + hex + " 22%, #101820 78%)");
    el.style.setProperty("--tower-door-frame", "color-mix(in srgb, " + hex + " 35%, #c9a45a 65%)");
    el.style.setProperty("--gate-wall", "color-mix(in srgb, " + hex + " 52%, #1a0c08 48%)");
    el.style.setProperty("--gate-wall-lit", "color-mix(in srgb, " + hex + " 64%, #2a1410 36%)");
    el.style.setProperty("--gate-wall-dark", "color-mix(in srgb, " + hex + " 30%, #0a0402 70%)");
  }
  function mountCityGate(slot, boardDir, colorA, colorB, vertRot) {
    if (!slot) return;
    const dir = String(boardDir || "n").toLowerCase();
    const gate = document.createElement("span");
    let cls = "city-gate edge-" + dir;
    if ((dir === "e" || dir === "w") && vertRot) cls += " rot-" + vertRot;
    gate.className = cls;
    gate.setAttribute("aria-hidden", "true");
    gate.innerHTML = CITY_GATE_HTML;
    if (colorA && colorB) {
      if (colorA === colorB) {
        gate.querySelectorAll(".gate-pillar, .gate-wall").forEach((el) => {
          tintGateStone(el, colorA);
        });
      } else {
        tintGateStone(gate.querySelector(".gate-pillar.a"), colorA);
        tintGateStone(gate.querySelector(".gate-pillar.b"), colorB);
      }
    }
    slot.appendChild(gate);
  }
  function mountCityHouse(slot, boardDir, vertRot) {
    if (!slot) return;
    const dir = String(boardDir || "n").toLowerCase();
    const house = document.createElement("span");
    let cls = "city-house edge-" + dir;
    if ((dir === "e" || dir === "w") && vertRot) cls += " rot-" + vertRot;
    house.className = cls;
    house.setAttribute("aria-hidden", "true");
    house.innerHTML = CITY_HOUSE_HTML;
    slot.appendChild(house);
  }
  function applyCityGates(claims) {
    clearCitySeamDecor();
    const board = game.board;
    for (const [pos, tile] of board.entries()) {
      const comma = pos.indexOf(",");
      const x = Number(pos.slice(0, comma));
      const y = Number(pos.slice(comma + 1));
      for (const step of [
        { dir: "E", dx: 1, dy: 0 },
        { dir: "S", dx: 0, dy: 1 }
      ]) {
        if (!boardEdgeIsCity(tile, step.dir)) continue;
        const nPos = x + step.dx + "," + (y + step.dy);
        const neighbor = board.get(nPos);
        if (!neighbor) continue;
        const opp = GATE_OPP[step.dir];
        if (!boardEdgeIsCity(neighbor, opp)) continue;
        const bothGate = GATE_CITY_IDS.has(tile.id) && GATE_CITY_IDS.has(neighbor.id);
        const anyHouse = HOUSE_CITY_IDS.has(tile.id) || HOUSE_CITY_IDS.has(neighbor.id);
        if (!bothGate && !anyHouse) continue;
        const slot = document.querySelector('#grid [data-pos="' + nPos + '"]');
        const colorA = cityFaceToward(pos, step.dir, claims);
        const colorB = cityFaceToward(nPos, opp, claims);
        if (bothGate) {
          const vertRot = step.dir === "E" ? seamVertRotDeg(nPos, "gate") : 0;
          mountCityGate(slot, opp, colorA, colorB, vertRot);
        } else {
          const vertRot = step.dir === "E" ? seamVertRotDeg(nPos, "house") : 0;
          mountCityHouse(slot, opp, vertRot);
        }
      }
    }
  }
  function applyRecentRings() {
    document.querySelectorAll("#grid .slot.filled.recent").forEach((slot) => {
      const ring = document.createElement("span");
      ring.className = "recent-ring";
      ring.setAttribute("aria-hidden", "true");
      slot.appendChild(ring);
    });
  }
  function tileRotTurns(el) {
    const tile = el.closest(".tile") || el;
    const names = [...tile.classList];
    const deg = names.find((name) => /^rot-(90|180|270)$/.test(name));
    if (deg) return Number(deg.slice(4)) / 90;
    const turn = names.find((name) => /^rot-[0-3]$/.test(name));
    return turn ? Number(turn.slice(4)) : 0;
  }
  function localDirFromBoard(boardDir, rotTurns) {
    const index = EDGE_DIRS.indexOf(String(boardDir || "").toUpperCase());
    if (index < 0) return boardDir;
    return EDGE_DIRS[(index - (rotTurns % 4 + 4) % 4 + 4) % 4];
  }
  function clearClaimEdgeGrads(el) {
    const feat = el.getAttribute("data-feat");
    const tile = el.closest(".tile");
    if (!tile) return;
    const sel = feat ? ':scope > .claim-edge-grad[data-feat="' + feat + '"]' : ":scope > .claim-edge-grad";
    tile.querySelectorAll(sel).forEach((node) => node.remove());
    if (!tile.querySelector(":scope > .claim-edge-grad")) {
      tile.classList.remove("has-claim-edge");
    }
  }
  var TOWARD_LOCAL_EDGE = { N: "0deg", E: "90deg", S: "180deg", W: "270deg" };
  function mountEdgeGrad(el, boardDir, faceHex, otherHex) {
    const tile = el.closest(".tile") || el;
    const rot = tileRotTurns(el);
    const localDir = String(localDirFromBoard(boardDir, rot) || "n").toUpperCase();
    const mid = "color-mix(in srgb, " + faceHex + " 50%, " + otherHex + " 50%)";
    tile.classList.add("has-claim-edge");
    const band = document.createElement("span");
    band.className = "claim-edge-grad claim-edge-" + localDir.toLowerCase();
    const feat = el.getAttribute("data-feat");
    if (feat) band.setAttribute("data-feat", feat);
    band.style.setProperty("--edge-from", faceHex);
    band.style.setProperty("--edge-to", mid);
    band.style.setProperty("--edge-grad-angle", TOWARD_LOCAL_EDGE[localDir] || "90deg");
    tile.appendChild(band);
  }
  function applyFeatureClaims(claims) {
    document.querySelectorAll("#grid .slot.filled").forEach((slot) => {
      const pos = slot.dataset.pos;
      if (!pos) return;
      slot.querySelectorAll("[data-feat]").forEach((el) => {
        const feat = el.getAttribute("data-feat");
        if (!feat) return;
        const claim = claims.get(pos + ":" + feat);
        el.classList.remove(
          "claim-solo",
          "claim-blend",
          "claim-half-a",
          "claim-half-b",
          "claim-fan",
          "claim-full",
          "claim-diag",
          "claim-corner",
          "claim-hub",
          "claim-bridge"
        );
        clearClaimEdgeGrads(el);
        el.style.removeProperty("--claim");
        el.style.removeProperty("--claim-a");
        el.style.removeProperty("--claim-b");
        el.style.removeProperty("--claim-c");
        el.style.removeProperty("--claim-mid");
        el.style.removeProperty("--claim-angle");
        el.style.removeProperty("--claim-side-angle");
        el.style.removeProperty("--claim-edge-a");
        el.style.removeProperty("--claim-edge-b");
        el.style.removeProperty("--claim-fan");
        el.style.removeProperty("--claim-fan-wall");
        if (!game_default.claimColorEnabled(game.options, feat)) return;
        if (!claim || !claim.colors.length) return;
        if (claim.mode === "hub") {
          const face = claim.face || claim.colors[0];
          const faceHex = CLAIM_HEX[face] || "#ff5d78";
          el.classList.add("claim-solo", "claim-hub");
          el.style.setProperty("--claim", faceHex);
          for (const bridge of claim.bridges || []) {
            const boardDir = bridge.dir;
            if (!boardDir) continue;
            const otherHex = CLAIM_HEX[bridge.color] || "#ff5d78";
            mountEdgeGrad(el, boardDir, faceHex, otherHex);
          }
          return;
        }
        if (claim.mode === "bridge") {
          const face = claim.face || claim.colors[0];
          const boardDir = claim.boardDir;
          const faceHex = CLAIM_HEX[face] || "#ff5d78";
          const partner = claim.colors[0] === face ? claim.colors[1] : claim.colors[0];
          const otherHex = CLAIM_HEX[partner] || "#49c4ff";
          el.classList.add("claim-solo", "claim-bridge");
          el.style.setProperty("--claim", faceHex);
          if (boardDir && partner) mountEdgeGrad(el, boardDir, faceHex, otherHex);
          return;
        }
        if (claim.tie && claim.colors.length >= 2) {
          const hexA = CLAIM_HEX[claim.colors[0]] || "#ff5d78";
          const hexB = CLAIM_HEX[claim.colors[1]] || "#49c4ff";
          if (claim.mode === "mix") {
            el.classList.add("claim-solo");
            el.style.setProperty(
              "--claim",
              "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)"
            );
            return;
          }
          el.classList.add("claim-blend");
          if (claim.mode === "half-a") {
            el.classList.add("claim-half-a");
            el.style.setProperty("--claim-a", hexA);
            el.style.setProperty("--claim-b", hexB);
            el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
            el.style.setProperty("--claim-angle", (claim.angle != null ? claim.angle : 135) + "deg");
            return;
          }
          if (claim.mode === "half-b") {
            el.classList.add("claim-half-b");
            el.style.setProperty("--claim-a", hexA);
            el.style.setProperty("--claim-b", hexB);
            el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
            el.style.setProperty("--claim-angle", (claim.angle != null ? claim.angle : 135) + "deg");
            return;
          }
          const axis = claimAxisKind(claim);
          if (claim.colors.length === 2 && (axis === "ortho" || axis === "diag")) {
            el.classList.add("claim-full");
            if (axis === "diag") el.classList.add("claim-diag");
            el.style.setProperty("--claim-a", hexA);
            el.style.setProperty("--claim-b", hexB);
            el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
            el.style.setProperty("--claim-angle", (claim.angle != null ? claim.angle : 90) + "deg");
            if (axis === "ortho") {
              el.style.setProperty("--claim-edge-a", "25%");
              el.style.setProperty("--claim-edge-b", "75%");
            } else {
              el.style.setProperty("--claim-edge-a", "42%");
              el.style.setProperty("--claim-edge-b", "58%");
            }
            return;
          }
          el.classList.add("claim-fan");
          el.style.setProperty("--claim-a", hexA);
          el.style.setProperty("--claim-b", hexB);
          el.style.setProperty("--claim-mid", "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)");
          el.style.setProperty("--claim-fan", claimFanGradient(claim, false, 20));
          el.style.setProperty("--claim-fan-wall", claimFanGradient(claim, true, 20));
          return;
        }
        el.classList.add("claim-solo");
        el.style.setProperty("--claim", CLAIM_HEX[claim.colors[0]] || "#ff5d78");
      });
    });
  }
  function paintGrid() {
    const bounds = game.bounds(1);
    const lockHints = game.pendingMeeple || game.pendingConfirm || game.pendingDiscard || exitConfirmOpen || humanControlsLocked();
    const hints = lockHints ? { now: [], later: [] } : game.hints();
    const now = new Set(hints.now.map((cell) => cell.x + "," + cell.y));
    const later = new Map(hints.later.map((cell) => [cell.x + "," + cell.y, cell.rots]));
    const pendingKey = game.pendingConfirm ? game.pendingConfirm.x + "," + game.pendingConfirm.y : game.pendingMeeple ? game.pendingMeeple.x + "," + game.pendingMeeple.y : null;
    const cols = bounds.maxX - bounds.minX + 1;
    const grid = document.getElementById("grid");
    grid.style.gridTemplateColumns = "repeat(" + cols + ", var(--cell))";
    grid.style.setProperty("--sand-min-x", String(bounds.minX));
    grid.style.setProperty("--sand-min-y", String(bounds.minY));
    const claims = game_default.buildFeatureClaims(game);
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
    applyFeatureClaims(claims);
    applyCityGates(claims);
    applyRecentRings();
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
  function finishCenterAnim(runDone) {
    if (centerAnim != null) {
      cancelAnimationFrame(centerAnim);
      centerAnim = null;
    }
    const done = centerAnimDone;
    centerAnimDone = null;
    if (runDone && done) done();
  }
  function cancelCenterAnim() {
    finishCenterAnim(true);
  }
  function easeInOutCubic(t3) {
    return t3 < 0.5 ? 4 * t3 * t3 * t3 : 1 - Math.pow(-2 * t3 + 2, 3) / 2;
  }
  function centerOn(pos, durationMs, onDone) {
    const done = typeof onDone === "function" ? onDone : null;
    const el = document.querySelector('#grid [data-pos="' + pos + '"]');
    finishCenterAnim(false);
    if (!el) {
      if (done) done();
      return;
    }
    const frame = scroller().getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const box = scroller();
    const dx = rect.left + rect.width / 2 - (frame.left + frame.width / 2);
    const dy = rect.top + rect.height / 2 - (frame.top + frame.height / 2);
    if (!durationMs || durationMs <= 0 || Math.abs(dx) < 2 && Math.abs(dy) < 2) {
      box.scrollLeft += dx;
      box.scrollTop += dy;
      if (done) done();
      return;
    }
    const startLeft = box.scrollLeft;
    const startTop = box.scrollTop;
    const endLeft = startLeft + dx;
    const endTop = startTop + dy;
    const start = performance.now();
    centerAnimDone = done;
    function tick(now) {
      const t3 = Math.min(1, (now - start) / durationMs);
      const e = easeInOutCubic(t3);
      box.scrollLeft = startLeft + (endLeft - startLeft) * e;
      box.scrollTop = startTop + (endTop - startTop) * e;
      if (t3 < 1) {
        centerAnim = requestAnimationFrame(tick);
        return;
      }
      finishCenterAnim(true);
    }
    centerAnim = requestAnimationFrame(tick);
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
    if (game.finished || game.pendingMeeple || game.pendingConfirm || game.pendingDiscard || !game.current) return;
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
    render({ keep: true });
  }
  function commitBotPlace(action) {
    if (!isBotTurn() || game.finished) {
      botBusy = false;
      return;
    }
    game.setRotation(action.rot);
    if (!game.place(action.x, action.y)) {
      botBusy = false;
      render({ keep: true });
      return;
    }
    playSound2("tile");
    render({ keep: true, skipBot: true });
    clearBotTimer();
    botBusy = true;
    botTimer = setTimeout(() => finishBotMeeple(action.slotId), BOT_MEEPLE_MS);
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
      paintSide();
      const center = action.x + "," + action.y;
      clearBotTimer();
      botBusy = true;
      requestAnimationFrame(() => {
        centerOn(center, BOT_CENTER_MS, () => commitBotPlace(action));
      });
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
    let earliest = null;
    for (const tile of game.board.values()) {
      if (!tile.leaveFx) continue;
      const at = tile.leaveFx.at || Date.now();
      if (earliest == null || at < earliest) earliest = at;
    }
    clearTimeout(leaveFxTimer);
    leaveFxTimer = null;
    if (earliest == null) return;
    const remaining = Math.max(0, LEAVE_FX_MS - (Date.now() - earliest));
    leaveFxTimer = setTimeout(() => {
      leaveFxTimer = null;
      const now = Date.now();
      let cleared = false;
      let remainingFx = false;
      for (const tile of game.board.values()) {
        if (!tile.leaveFx) continue;
        if (now - (tile.leaveFx.at || 0) >= LEAVE_FX_MS) {
          tile.leaveFx = null;
          cleared = true;
        } else {
          remainingFx = true;
        }
      }
      if (cleared) {
        document.querySelectorAll(".meeple-pin.leaving").forEach((el) => {
          const tileEl = el.closest("[data-pos]");
          const pos = tileEl && tileEl.dataset.pos;
          const tile = pos ? game.board.get(pos) : null;
          if (!tile || !tile.leaveFx) el.remove();
        });
      }
      if (remainingFx) armLeaveFxClear();
    }, remaining);
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
    if (opts.center) {
      requestAnimationFrame(() => centerOn(opts.center, opts.centerMs));
    } else if (anchor) {
      cancelCenterAnim();
      restoreAnchor(anchor);
    }
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
    cancelCenterAnim();
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
    if (!event.isPrimary) return;
    if (event.button !== 0 && event.button !== -1) return;
    if (humanControlsLocked()) return;
    const button = event.target.closest("button[data-rotate], button[data-set-rot]");
    if (!button) return;
    event.preventDefault();
    if (!applyHandRotation(button)) return;
    suppressHandClickUntil = Date.now() + 700;
  });
  document.addEventListener("click", (event) => {
    if (skipClick) {
      skipClick = false;
      return;
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (Date.now() < suppressHandClickUntil && (button.dataset.rotate != null || button.dataset.setRot != null)) {
      return;
    }
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
    if (button.id === "share-ranking" || button.classList.contains("js-share")) {
      openShareSheet();
      return;
    }
    if (button.id === "share-sheet-close") {
      closeShareSheet();
      return;
    }
    if (button.id === "share-native") {
      void onShareNative();
      return;
    }
    if (button.id === "share-download") {
      onShareDownload();
      return;
    }
    if (button.id === "share-copy") {
      void onShareCopyText();
      return;
    }
    if (button.id === "share-copy-url") {
      void onShareCopyUrl();
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
    if (button.id === "confirm-turn") {
      if (humanControlsLocked()) return;
      const before = game.scores.slice();
      if (game.confirmTurnEnd()) {
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
      if (game.pendingConfirm) return;
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
  var shareSheetEl = document.getElementById("share-sheet");
  if (shareSheetEl) {
    shareSheetEl.addEventListener("click", (event) => {
      if (event.target.id === "share-sheet") closeShareSheet();
    });
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const sheet = document.getElementById("share-sheet");
      if (sheet && !sheet.hidden) {
        event.preventDefault();
        closeShareSheet();
        return;
      }
    }
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
    if (game.finished || game.pendingMeeple || game.pendingConfirm || game.pendingDiscard || !game.current) return;
    event.preventDefault();
    rotateClockwise();
  });
  document.getElementById("scroller").addEventListener("wheel", (event) => {
    event.preventDefault();
    const steps = Math.max(1, Math.min(3, Math.round(Math.abs(event.deltaY) / 100)));
    const delta = (event.deltaY > 0 ? -ZOOM_WHEEL : ZOOM_WHEEL) * steps;
    const base = zoomGoal ? zoomGoal.zoom : boardZoom;
    scheduleBoardZoom(base + delta, { x: event.clientX, y: event.clientY });
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
    scheduleBoardZoom(pinch.zoom * (dist / pinch.dist), pinchMidpoint(event.touches));
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
  function syncLayoutMode() {
    const root = document.documentElement;
    const ua = navigator.userAgent || "";
    const isIPhone = /iPhone|iPod/i.test(ua);
    const isIPad = /iPad/i.test(ua) || !isIPhone && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    const narrow = window.matchMedia("(max-width: 1024px)").matches;
    const classicPadViewport = window.matchMedia(
      "(min-width: 768px) and (max-width: 1024px) and (min-height: 700px)"
    ).matches;
    if (isIPhone) {
      root.classList.remove("is-pad");
      root.classList.add("is-overlay");
      return;
    }
    const isPad = isIPad || classicPadViewport;
    root.classList.toggle("is-pad", isPad);
    root.classList.toggle("is-overlay", isPad || narrow);
  }
  syncLayoutMode();
  applyBoardZoom();
  syncBoardPadding();
  i18n_default.apply();
  audio_default.unlockAudio();
  function beginFirstRoulette() {
    const overlay = document.getElementById("first-roulette");
    if (!overlay) {
      clearRoulettePending();
      readyToPersist = true;
      render({ center: "0,0" });
      return;
    }
    rouletteOpen = true;
    readyToPersist = false;
    render({ center: "0,0", skipBot: true });
    try {
      openFirstRoulette({
        overlay,
        players: game.players,
        winner: game.player,
        palette: game_default.COLOR_PALETTE,
        nameOf: displayPlayerName,
        t: t2,
        onSpin: () => audio_default.unlockAudio(),
        onDone: () => {
          rouletteOpen = false;
          clearRoulettePending();
          readyToPersist = true;
          audio_default.unlockAudio();
          render({ keep: true });
        }
      });
    } catch (err) {
      console.error(err);
      rouletteOpen = false;
      clearRoulettePending();
      readyToPersist = true;
      render({ center: "0,0" });
    }
  }
  var needRoulette = !saved || isRoulettePending();
  if (needRoulette) {
    if (!isRoulettePending()) markRoulettePending();
    beginFirstRoulette();
  } else {
    readyToPersist = true;
    render({ keep: true });
    restoreView(saved.view);
  }
  window.addEventListener("resize", () => {
    syncLayoutMode();
    syncBoardPadding();
  });
  window.addEventListener("pagehide", () => {
    persistGame();
  });
})();
