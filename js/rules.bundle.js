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

  // js/game/tiles.js
  function rotClass(rot) {
    const deg = (rot % 4 + 4) % 4 * 90;
    return deg ? "rot-" + deg : "";
  }
  function tileHTML(id, rot) {
    if (!MARKUP[id]) throw new Error("unknown tile " + id);
    const cls = ["tile", rotClass(rot)].filter(Boolean).join(" ");
    return '<div class="' + cls + '" aria-hidden="true">' + MARKUP[id] + "</div>";
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

  // js/rules-tutorial.js
  function keyOf(x, y) {
    return x + "," + y;
  }
  var CLAIM_HEX = {
    red: "#ff5d78",
    blue: "#49c4ff",
    green: "#3dff9a",
    yellow: "#ffe14a",
    orange: "#ff9a3d",
    purple: "#7c3aed",
    white: "#f4f7fb",
    brown: "#a67c52"
  };
  function meepleAt(tileId, rot, slotId, color, extra) {
    const layout = MEEPLE_LAYOUTS[tileId];
    const slot = layout && layout.find((item) => item.id === slotId);
    if (!slot) return null;
    const point = rotatePoint(slot, rot || 0);
    return Object.assign(
      {
        id: slot.id,
        kind: slot.kind,
        color,
        x: point.x,
        y: point.y,
        field: slot.kind === "field"
      },
      extra || {}
    );
  }
  function T(x, y, id, rot, owner, meeple) {
    const tile = { x, y, id, rot: rot || 0, owner: owner || null };
    if (meeple) tile.meeple = meeple;
    return tile;
  }
  function claim(x, y, color, kind, feat, extra) {
    return Object.assign(
      { pos: keyOf(x, y), color: color || null, kind, feat: feat || null },
      extra || {}
    );
  }
  var MONO_RING = [
    keyOf(-1, 0),
    keyOf(0, 0),
    keyOf(1, 0),
    keyOf(-1, 1),
    keyOf(1, 1),
    keyOf(-1, 2),
    keyOf(0, 2),
    keyOf(1, 2)
  ];
  function boardThrough3(monasteryMeeple) {
    return [
      T(0, 0, "D", 0, "red"),
      T(0, -1, "E", 2, "red"),
      T(-1, 0, "U", 1, "red"),
      T(1, 0, "X", 0, "red"),
      T(-2, 0, "X", 0, "red"),
      T(0, 1, "B", 0, "red", monasteryMeeple || null)
    ];
  }
  function boardThrough4(monasteryMeeple) {
    return boardThrough3(monasteryMeeple).concat([
      T(2, 0, "V", 0, "red"),
      T(2, -1, "E", 1, "red"),
      T(3, -1, "G", 0, "red"),
      T(4, -1, "G", 0, "blue"),
      T(5, -1, "E", 3, "blue")
    ]);
  }
  function boardThrough5() {
    return boardThrough4(null).concat([
      T(-1, 1, "V", 0, "red"),
      T(1, 1, "U", 0, "red"),
      T(-1, 2, "V", 2, "red"),
      T(1, 2, "V", 1, "red"),
      T(0, 2, "U", 1, "red")
    ]);
  }
  function boardThrough6() {
    return boardThrough5().concat([
      // I @ 270° north of C (was E@180); E@90 closes I's west city edge.
      T(4, 0, "I", 3, "red"),
      T(3, 0, "E", 1, "red"),
      T(3, 1, "E", 1, "red"),
      T(5, 1, "E", 3, "blue"),
      T(4, 2, "E", 0, "red"),
      T(4, 1, "C", 0, "red")
    ]);
  }
  var CLAIMS_CITY1 = [
    claim(0, 0, "red", "city", "city-0"),
    claim(0, -1, "red", "city", "city-0")
  ];
  var CLAIMS_ROAD1 = [
    claim(-2, 0, "red", "road", "road-1"),
    // X east arm
    claim(-1, 0, "red", "road", "road-0"),
    // U
    claim(0, 0, "red", "road", "road-0"),
    // D
    claim(1, 0, "red", "road", "road-3")
    // X west arm
  ];
  var CLAIMS_MONO = [claim(0, 1, "red", "monastery")];
  var CLAIMS_CITY4 = [
    claim(2, -1, "red", "city", "city-0"),
    claim(3, -1, null, "city", "city-0", {
      mode: "half-a",
      colors: ["red", "blue"],
      angle: 90
    }),
    claim(4, -1, null, "city", "city-0", {
      mode: "half-b",
      colors: ["red", "blue"],
      angle: 90
    }),
    claim(5, -1, "blue", "city", "city-0")
  ];
  var CLAIMS_CITY6 = [
    claim(4, 0, "red", "city", "city-1"),
    // I south arm → C
    claim(3, 1, "red", "city", "city-0"),
    claim(5, 1, "red", "city", "city-0"),
    claim(4, 2, "red", "city", "city-0"),
    claim(4, 1, "red", "city", "city-0")
  ];
  var STEPS = [
    {
      titleKey: "tut1Title",
      bodyKey: "tut1Body",
      scoreKey: "tut1Score",
      setup: [T(0, 0, "D", 0, "red", meepleAt("D", 0, "city-0", "red"))],
      place: T(0, -1, "E", 2, "red"),
      scores: [{ x: 0, y: 0, points: 4, color: "red", slotId: "city-0", tileId: "D", rot: 0 }],
      settled: [T(0, 0, "D", 0, "red"), T(0, -1, "E", 2, "red")],
      claims: CLAIMS_CITY1
    },
    {
      titleKey: "tut2Title",
      bodyKey: "tut2Body",
      scoreKey: "tut2Score",
      setup: [
        T(-1, 0, "U", 1, "red", meepleAt("U", 1, "road-0", "red")),
        T(1, 0, "X", 0, "red")
      ],
      place: T(-2, 0, "X", 0, "red"),
      scores: [{ x: -1, y: 0, points: 4, color: "red", slotId: "road-0", tileId: "U", rot: 1 }],
      settled: [
        T(0, 0, "D", 0, "red"),
        T(0, -1, "E", 2, "red"),
        T(-1, 0, "U", 1, "red"),
        T(1, 0, "X", 0, "red"),
        T(-2, 0, "X", 0, "red")
      ],
      claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1)
    },
    {
      titleKey: "tut3Title",
      bodyKey: "tut3Body",
      scoreKey: "tut3Score",
      monoRing: true,
      setup: [],
      place: T(0, 1, "B", 0, "red", meepleAt("B", 0, "monastery", "red")),
      scores: [],
      settled: boardThrough3(meepleAt("B", 0, "monastery", "red")),
      claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1)
    },
    {
      titleKey: "tut4Title",
      bodyKey: "tut4Body",
      scoreKey: "tut4Score",
      setup: [
        T(2, 0, "V", 0, "red"),
        T(2, -1, "E", 1, "red", meepleAt("E", 1, "city-0", "red")),
        T(3, -1, "G", 0, "red"),
        T(5, -1, "E", 3, "blue", meepleAt("E", 3, "city-0", "blue"))
      ],
      place: T(4, -1, "G", 0, "blue"),
      scores: [
        { x: 2, y: -1, points: 8, color: "red", slotId: "city-0", tileId: "E", rot: 1 },
        { x: 5, y: -1, points: 8, color: "blue", slotId: "city-0", tileId: "E", rot: 3 }
      ],
      settled: boardThrough4(meepleAt("B", 0, "monastery", "red")),
      claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_CITY4)
    },
    {
      titleKey: "tut5Title",
      bodyKey: "tut5Body",
      scoreKey: "tut5Score",
      monoRing: true,
      setup: [
        T(-1, 1, "V", 0, "red"),
        T(1, 1, "U", 0, "red"),
        T(-1, 2, "V", 2, "red"),
        T(1, 2, "V", 1, "red")
      ],
      place: T(0, 2, "U", 1, "red"),
      scores: [{ x: 0, y: 1, points: 9, color: "red", slotId: "monastery", tileId: "B", rot: 0 }],
      settled: boardThrough5(),
      claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_MONO, CLAIMS_CITY4)
    },
    {
      titleKey: "tut6Title",
      bodyKey: "tut6Body",
      scoreKey: "tut6Score",
      setup: [
        T(4, 0, "I", 3, "red"),
        T(3, 0, "E", 1, "red"),
        T(3, 1, "E", 1, "red", meepleAt("E", 1, "city-0", "red")),
        T(5, 1, "E", 3, "blue", meepleAt("E", 3, "city-0", "blue")),
        T(4, 2, "E", 0, "red", meepleAt("E", 0, "city-0", "red"))
      ],
      place: T(4, 1, "C", 0, "red"),
      scores: [
        { x: 3, y: 1, points: 12, color: "red", slotId: "city-0", tileId: "E", rot: 1 },
        { x: 4, y: 2, points: 12, color: "red", slotId: "city-0", tileId: "E", rot: 0 },
        { x: 5, y: 1, points: 0, color: "blue", slotId: "city-0", tileId: "E", rot: 3, dim: true }
      ],
      settled: boardThrough6(),
      claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_MONO, CLAIMS_CITY4, CLAIMS_CITY6)
    },
    {
      titleKey: "tut7Title",
      bodyKey: "tut7Body",
      scoreKey: "tut7Score",
      endField: true,
      setup: [
        T(1, -1, "A", 0, "red"),
        T(5, 0, "E", 1, "red", meepleAt("E", 1, "field-0", "red", { earned: 9, stay: true }))
      ],
      place: null,
      scores: [],
      settled: boardThrough6().concat([
        T(1, -1, "A", 0, "red"),
        T(5, 0, "E", 1, "red", meepleAt("E", 1, "field-0", "red", { earned: 9, stay: true }))
      ]),
      claims: CLAIMS_CITY1.concat(CLAIMS_ROAD1, CLAIMS_MONO, CLAIMS_CITY4, CLAIMS_CITY6)
    }
  ];
  function cloneTile(tile) {
    if (!tile) return null;
    const next = {
      x: tile.x,
      y: tile.y,
      id: tile.id,
      rot: tile.rot || 0,
      owner: tile.owner || null
    };
    if (tile.meeple) next.meeple = Object.assign({}, tile.meeple);
    return next;
  }
  function boardMap(tiles) {
    const map = /* @__PURE__ */ new Map();
    tiles.forEach((tile) => map.set(keyOf(tile.x, tile.y), cloneTile(tile)));
    return map;
  }
  function previousSettled(index) {
    if (index <= 0) return [];
    return STEPS[index - 1].settled || [];
  }
  function boundsFor(tiles) {
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    if (!tiles.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
    tiles.forEach((tile) => {
      minX = Math.min(minX, tile.x);
      maxX = Math.max(maxX, tile.x);
      minY = Math.min(minY, tile.y);
      maxY = Math.max(maxY, tile.y);
    });
    return { minX, maxX, minY, maxY };
  }
  var BOARD_BOUNDS = boundsFor(STEPS[STEPS.length - 1].settled || []);
  function pinHTML(meeple, leaving) {
    if (!meeple) return "";
    const fieldClass = meeple.field || meeple.kind === "field" ? " field-meeple" : "";
    let earned = "";
    if (meeple.earned != null && meeple.earned !== 0) {
      const dim = meeple.earnedDim ? " sub" : "";
      const color = meeple.color ? " " + meeple.color : "";
      earned = '<span class="meeple-earned' + color + dim + '">' + (meeple.earnedDim ? String(meeple.earned) : "+" + meeple.earned) + "</span>";
    }
    return '<span class="meeple-pin' + (leaving ? " leaving" : "") + '" style="left:' + meeple.x * 100 + "%;top:" + meeple.y * 100 + '%"><i class="meeple on-tile ' + meeple.color + fieldClass + '" aria-hidden="true"></i>' + earned + "</span>";
  }
  function fitAndCenterBoard(host) {
    const scroller = host.closest(".scroller");
    const board = host.closest(".rules-board");
    const grid = host.querySelector(".board-grid");
    if (!scroller || !board || !grid) return;
    board.style.removeProperty("--board-zoom");
    const base = parseFloat(getComputedStyle(board).getPropertyValue("--board-zoom")) || 0.48;
    const availW = Math.max(0, scroller.clientWidth - 4);
    const availH = Math.max(0, scroller.clientHeight - 4);
    const needW = grid.offsetWidth;
    const needH = grid.offsetHeight;
    let zoom = base;
    if (needW > availW && needW > 0) zoom = Math.min(zoom, base * (availW / needW));
    if (needH > availH && needH > 0) zoom = Math.min(zoom, base * (availH / needH));
    zoom = Math.max(0.2, Math.min(base, zoom * 0.98));
    if (Math.abs(zoom - base) > 1e-3) {
      board.style.setProperty("--board-zoom", String(zoom));
    }
    scroller.scrollLeft = Math.max(0, (grid.offsetWidth - scroller.clientWidth) / 2);
    scroller.scrollTop = Math.max(0, (grid.offsetHeight - scroller.clientHeight) / 2);
  }
  function claimSelector(kind, feat) {
    let base = ".city";
    if (kind === "road") base = ".road, .bend, i.road, i.bend";
    else if (kind === "monastery") base = ".monastery";
    if (!feat) return base;
    return base.split(",").map((part) => part.trim() + '[data-feat="' + feat + '"]').join(", ");
  }
  function applyClaims(host, claims) {
    (claims || []).forEach((item) => {
      const slot = host.querySelector('.slot[data-pos="' + item.pos + '"]');
      if (!slot) return;
      const els = slot.querySelectorAll(claimSelector(item.kind, item.feat));
      if (!els.length) return;
      if (item.mode === "half-a" || item.mode === "half-b") {
        const colors = item.colors || [];
        const hexA = CLAIM_HEX[colors[0]] || CLAIM_HEX.red;
        const hexB = CLAIM_HEX[colors[1]] || CLAIM_HEX.blue;
        const mid = "color-mix(in srgb, " + hexA + " 50%, " + hexB + " 50%)";
        const angle = (item.angle != null ? item.angle : 90) + "deg";
        els.forEach((el) => {
          el.classList.add("claim-blend", "claim-" + item.mode);
          el.style.setProperty("--claim-a", hexA);
          el.style.setProperty("--claim-b", hexB);
          el.style.setProperty("--claim-mid", mid);
          el.style.setProperty("--claim-angle", angle);
        });
        return;
      }
      const hex = CLAIM_HEX[item.color] || CLAIM_HEX.red;
      els.forEach((el) => {
        el.classList.add("claim-solo");
        el.style.setProperty("--claim", hex);
      });
    });
  }
  function renderGrid(host, tiles, opts) {
    const options = opts || {};
    const recentKey = options.recentKey || null;
    const placingKey = options.placingKey || null;
    const hintKey = options.hintKey || null;
    const leavePins = options.leavePins || [];
    const monoRing = options.monoRing ? new Set(MONO_RING) : null;
    const bounds = BOARD_BOUNDS;
    const cols = bounds.maxX - bounds.minX + 1;
    const grid = document.createElement("div");
    grid.className = "board-grid";
    grid.style.gridTemplateColumns = "repeat(" + cols + ", var(--cell))";
    grid.style.setProperty("--sand-min-x", String(bounds.minX));
    grid.style.setProperty("--sand-min-y", String(bounds.minY));
    const byKey = boardMap(tiles);
    const parts = [];
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const pos = keyOf(x, y);
        const tile = byKey.get(pos);
        const mono = monoRing && monoRing.has(pos) ? " mono-ring" : "";
        if (tile) {
          const owner = tile.owner ? " owner-" + tile.owner : "";
          const recent = recentKey === pos ? " recent" : "";
          const placing = placingKey === pos ? " is-placing" : "";
          let marks = pinHTML(tile.meeple, false);
          leavePins.filter((pin) => pin.pos === pos).forEach((pin) => {
            marks += pinHTML(pin.meeple, true);
          });
          const ring = recent ? '<span class="recent-ring" aria-hidden="true"></span>' : "";
          parts.push(
            '<div class="slot filled' + owner + recent + placing + mono + '" data-pos="' + pos + '"><div class="scaler">' + tileHTML(tile.id, tile.rot) + "</div>" + marks + ring + "</div>"
          );
          continue;
        }
        if (hintKey === pos) {
          parts.push('<div class="slot empty hint-now' + mono + '" data-pos="' + pos + '"></div>');
          continue;
        }
        parts.push('<div class="slot empty' + mono + '" data-pos="' + pos + '"></div>');
      }
    }
    grid.innerHTML = parts.join("");
    host.innerHTML = "";
    host.appendChild(grid);
    if (options.claims) applyClaims(host, options.claims);
    fitAndCenterBoard(host);
  }
  function mergeTiles(base, extra) {
    const map = boardMap(base);
    (extra || []).forEach((tile) => map.set(keyOf(tile.x, tile.y), cloneTile(tile)));
    return Array.from(map.values());
  }
  function leavePinsFor(scores) {
    return (scores || []).map((score) => {
      const m = meepleAt(score.tileId, score.rot, score.slotId, score.color, {
        earned: score.points,
        dim: score.dim,
        earnedDim: score.dim
      });
      if (!m) return null;
      return { pos: keyOf(score.x, score.y), meeple: m };
    }).filter(Boolean);
  }
  function escapeHtml(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function bindTutorial(root) {
    const stage = root.querySelector("[data-tutorial]");
    if (!stage) return null;
    const boardHost = stage.querySelector("[data-tutorial-board]");
    const titleEl = stage.querySelector("[data-tutorial-title]");
    const bodyEl = stage.querySelector("[data-tutorial-body]");
    const scoreEl = stage.querySelector("[data-tutorial-score]");
    const stepEl = stage.querySelector("[data-tutorial-step]");
    const dotsEl = stage.querySelector("[data-tutorial-dots]");
    const prevBtn = stage.querySelector("[data-tutorial-prev]");
    const nextBtn = stage.querySelector("[data-tutorial-next]");
    let index = 0;
    let timers = [];
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (err) {
    }
    function clearTimers() {
      timers.forEach((id) => window.clearTimeout(id));
      timers = [];
    }
    function later(fn, ms) {
      timers.push(window.setTimeout(fn, ms));
    }
    function stepOpts(extra) {
      const step = STEPS[index];
      return Object.assign(
        {
          monoRing: !!step.monoRing,
          claims: step.claims || null
        },
        extra || {}
      );
    }
    function paintCopy() {
      const step = STEPS[index];
      const lang = getLang();
      if (stepEl) stepEl.textContent = t("tutStep", lang, { n: index + 1, total: STEPS.length });
      if (titleEl) titleEl.textContent = t(step.titleKey, lang);
      if (bodyEl) bodyEl.textContent = t(step.bodyKey, lang);
      if (scoreEl) {
        const text = step.scoreKey ? t(step.scoreKey, lang) : "";
        const chips = (step.scores || []).filter((s) => s.points);
        const chipColors = new Set(chips.map((s) => s.color));
        const showChips = chipColors.size > 1;
        if (!text && !showChips) {
          scoreEl.hidden = true;
          scoreEl.innerHTML = "";
        } else {
          scoreEl.hidden = false;
          let html = text ? '<span class="tut-score-text">' + escapeHtml(text) + "</span>" : "";
          if (showChips) {
            chips.forEach((s) => {
              html += '<span class="tut-score-chip ' + s.color + (s.dim ? " sub" : "") + '">' + (s.dim ? String(s.points) : "+" + s.points) + "</span>";
            });
          }
          scoreEl.innerHTML = html;
        }
      }
      if (dotsEl) {
        dotsEl.querySelectorAll("button").forEach((btn, i) => {
          const on = i === index;
          btn.classList.toggle("on", on);
          if (on) btn.setAttribute("aria-current", "true");
          else btn.removeAttribute("aria-current");
        });
      }
      if (prevBtn) prevBtn.disabled = index === 0;
      if (nextBtn) nextBtn.disabled = index === STEPS.length - 1;
    }
    function showSettled() {
      renderGrid(boardHost, STEPS[index].settled || [], stepOpts());
    }
    function scheduleLoop(delay) {
      later(() => playStep(true), delay == null ? 1800 : delay);
    }
    function playStep(animate) {
      clearTimers();
      paintCopy();
      const step = STEPS[index];
      const base = previousSettled(index);
      const withSetup = mergeTiles(base, step.setup);
      const priorClaims = index > 0 ? STEPS[index - 1].claims : null;
      if (!animate || reduced) {
        showSettled();
        scheduleLoop(reduced ? 3200 : 2200);
        return;
      }
      if (step.place) {
        renderGrid(
          boardHost,
          withSetup,
          stepOpts({ hintKey: keyOf(step.place.x, step.place.y), claims: priorClaims })
        );
      } else if (step.endField) {
        renderGrid(boardHost, base, stepOpts({ claims: priorClaims }));
      } else {
        renderGrid(boardHost, base, stepOpts({ claims: priorClaims }));
      }
      later(() => {
        if (step.place) {
          const placed = mergeTiles(withSetup, [step.place]);
          const placeKey = keyOf(step.place.x, step.place.y);
          renderGrid(
            boardHost,
            placed,
            stepOpts({ recentKey: placeKey, placingKey: placeKey, claims: priorClaims })
          );
          later(() => {
            if (step.scores && step.scores.length) {
              const scored = new Set(step.scores.map((s) => keyOf(s.x, s.y)));
              const during = placed.map((tile) => {
                const copy = cloneTile(tile);
                if (scored.has(keyOf(copy.x, copy.y))) copy.meeple = null;
                return copy;
              });
              renderGrid(boardHost, during, {
                ...stepOpts(),
                recentKey: placeKey,
                leavePins: leavePinsFor(step.scores),
                claims: step.claims || priorClaims
              });
              later(() => {
                showSettled();
                scheduleLoop(1600);
              }, 2e3);
            } else {
              later(() => {
                showSettled();
                scheduleLoop(1600);
              }, 900);
            }
          }, 550);
        } else if (step.endField) {
          renderGrid(boardHost, step.settled || [], stepOpts());
          scheduleLoop(2800);
        } else {
          showSettled();
          scheduleLoop(1800);
        }
      }, step.place ? 700 : 500);
    }
    function go(to, animate) {
      index = Math.max(0, Math.min(STEPS.length - 1, to));
      playStep(animate !== false);
    }
    if (dotsEl) {
      dotsEl.innerHTML = STEPS.map((_, i) => {
        return '<button type="button" data-tut-dot="' + i + '" aria-label="' + (i + 1) + '"></button>';
      }).join("");
      dotsEl.addEventListener("click", (ev) => {
        const btn = ev.target.closest("[data-tut-dot]");
        if (!btn) return;
        go(Number(btn.getAttribute("data-tut-dot")), true);
      });
    }
    if (prevBtn) prevBtn.addEventListener("click", () => go(index - 1, true));
    if (nextBtn) nextBtn.addEventListener("click", () => go(index + 1, true));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearTimers();
      else playStep(true);
    });
    let resizeTimer = 0;
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (boardHost.isConnected) fitAndCenterBoard(boardHost);
      }, 120);
    }
    window.addEventListener("resize", onResize);
    go(0, true);
    return {
      refresh() {
        paintCopy();
      },
      destroy() {
        clearTimers();
        window.clearTimeout(resizeTimer);
        window.removeEventListener("resize", onResize);
      }
    };
  }

  // js/rules.js
  i18n_default.bindLangBar(() => {
    if (tutorial) tutorial.refresh();
  });
  audio_default.bindVolumeBar();
  document.querySelectorAll(".tile[data-id]").forEach((tile) => {
    const id = tile.getAttribute("data-id");
    if (id && MARKUP[id]) tile.innerHTML = MARKUP[id];
  });
  var tutorial = bindTutorial(document);
})();
