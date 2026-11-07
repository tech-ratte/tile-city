const VOLUME_KEY = "tile-city-volume";

const SOUNDS = {
  tile: "assets/sound/tile.mp3",
  point: "assets/sound/point.mp3",
  clear: "assets/sound/clear.mp3",
  rouletteStart: "assets/sound/roulette/start.mp3",
  rouletteSlow: "assets/sound/roulette/slow.mp3",
  rouletteStop: "assets/sound/roulette/stop.mp3",
};

const MEEPLE_COLORS = [
  "red", "blue", "green", "yellow", "orange", "purple", "white", "brown",
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

let volume = loadVolume();
let audioCtx = null;
const buffers = new Map();
const loading = new Map();
let unlockArmed = false;
let unlocked = false;

export function getVolume() {
  return volume;
}

export function setVolume(next) {
  volume = Math.min(1, Math.max(0, Number(next) || 0));
  try {
    localStorage.setItem(VOLUME_KEY, String(Math.round(volume * 100)));
  } catch (err) {}
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
    } catch (err) {}
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
      // Wait until playback ends so sequential fanfare / ranking sounds do not overlap.
      audio.addEventListener("ended", () => finish({ ok: true, mode: "html-fallback", ended: true }), { once: true });
      void audio.play().then(
        () => {
          if (typeof onStarted === "function") onStarted();
          if (maxPlaySec != null && maxPlaySec > 0) {
            cutTimer = setTimeout(() => {
              try {
                audio.pause();
              } catch (err) {}
              finish({ ok: true, mode: "html-fallback", cut: true });
            }, maxPlaySec * 1000);
          }
        },
        (err) => finish({
          ok: false,
          mode: "html-fallback",
          reason: err && err.name ? err.name : String(err),
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

/** Peak times (seconds) for click/tick SFX. */
export function detectTicks(buf, opts) {
  if (!buf) return [];
  const thr = opts && opts.thr != null ? opts.thr : 0.05;
  const minGap = opts && opts.minGap != null ? opts.minGap : 0.04;
  const sampleRate = buf.sampleRate;
  const channel = mixMono(buf);
  const win = Math.max(1, Math.floor(sampleRate * 0.01));
  const hop = Math.max(1, Math.floor(sampleRate * 0.005));
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
    if (
      e > thr &&
      e > env[i - 1].e &&
      e > env[i - 2].e &&
      e >= env[i + 1].e &&
      e >= env[i + 2].e
    ) {
      if (env[i].t - last < minGap) continue;
      times.push(env[i].t);
      last = env[i].t;
    }
  }
  return times;
}

/** Decode (or reuse cache) and return tick times without playing. */
export async function peekTicks(src, tickOpts) {
  await resumeCtx();
  const buf = await loadBuffer(src);
  if (!buf) return [];
  return detectTicks(buf, tickOpts || {});
}

export function getSoundDuration(src) {
  const buf = buffers.get(src);
  return buf && Number.isFinite(buf.duration) ? buf.duration : null;
}

export function preloadSounds(srcs) {
  (srcs || []).forEach((src) => {
    if (!src) return;
    void loadBuffer(src);
    try {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = src;
    } catch (err) {}
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
      }, Math.max(0, fireAt * 1000 - (performance.now() - origin)))
    );
  });
  return timers;
}

/**
 * Play a clip and fire onTick at click times.
 * Starts HTMLAudioElement immediately (gesture-friendly). Optional presetTicks
 * skips decode/detection so callers can avoid awaits before play().
 * tickOpts.maxPlaySec stops playback early (e.g. play only the first half).
 */
export async function playWithTicks(src, tickOpts, onTick, presetTicks) {
  // Kick resume without blocking play() on decode.
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    try {
      void ctx.resume();
    } catch (err) {}
  }

  const cached = buffers.get(src) || null;
  const maxPlaySec =
    tickOpts && tickOpts.maxPlaySec != null ? Number(tickOpts.maxPlaySec) : null;
  let ticks = Array.isArray(presetTicks)
    ? presetTicks.slice()
    : cached
      ? detectTicks(cached, tickOpts || {})
      : [];
  if (maxPlaySec != null && maxPlaySec > 0) {
    ticks = ticks.filter((at) => at < maxPlaySec);
  }

  const leadSec =
    tickOpts && tickOpts.lead != null ? Number(tickOpts.lead) : 0;

  function waitTicksDone() {
    const last = ticks.length ? ticks[ticks.length - 1] : 0;
    const durMs =
      maxPlaySec != null && maxPlaySec > 0
        ? maxPlaySec * 1000
        : cached
          ? cached.duration * 1000
          : Math.max(800, last * 1000 + 80);
    return new Promise((resolve) =>
      setTimeout(resolve, Math.max(durMs, last * 1000 + 30))
    );
  }

  if (!(volume > 0)) {
    const timers = armTickTimers(ticks, onTick, leadSec);
    await waitTicksDone();
    timers.forEach((id) => clearTimeout(id));
    return { ok: true, mode: "silent", ticks };
  }

  // HTML audio first — play() must run before any decode await.
  // Arm name-flip timers only after playback actually starts.
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
      } catch (err) {}
      const playPromise = playBuffer(buf, ctx);
      timers = armTickTimers(ticks, onTick, leadSec);
      result = await playPromise;
      if (maxPlaySec != null && maxPlaySec > 0) {
        await new Promise((resolve) => setTimeout(resolve, maxPlaySec * 1000));
        // Web Audio sources can't be paused easily mid-node; wait then continue.
        result = { ok: true, mode: "web-audio", cut: true };
      }
    }
  }
  if (!result.ok) {
    // Keep visuals moving even if audio is blocked.
    timers.forEach((id) => clearTimeout(id));
    timers = armTickTimers(ticks, onTick, leadSec);
    await waitTicksDone();
  }
  timers.forEach((id) => clearTimeout(id));
  return Object.assign({ ticks }, result || { ok: false });
}

/** Resume AudioContext + warm SFX so bot timer playback is allowed. */
export function unlockAudio() {
  unlocked = true;
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") {
    try {
      void ctx.resume();
    } catch (err) {}
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

export function playSound(name) {
  unlockAudio();
  playSrc(SOUNDS[name]);
}

/** Awaitable play for tests / sequencing. Resolves with { ok, mode, ... }. */
export function playSoundAsync(name) {
  unlockAudio();
  const src = SOUNDS[name];
  if (!src) return Promise.resolve({ ok: false, reason: "unknown-sound" });
  if (!(volume > 0)) return Promise.resolve({ ok: false, reason: "muted" });
  return playSrcAsync(src).then((result) => Object.assign({
    buffered: buffers.has(src),
    ctxState: getCtx() ? getCtx().state : null,
  }, result || { ok: false, reason: "no-result" }));
}

export function getAudioDebugState() {
  const ctx = getCtx();
  return {
    unlocked,
    volume,
    ctxState: ctx ? ctx.state : null,
    bufferCount: buffers.size,
    buffered: [...buffers.keys()],
  };
}

export function playMeepleSound(color) {
  if (!MEEPLE_COLORS.includes(color)) return;
  unlockAudio();
  const n = 1 + Math.floor(Math.random() * 3);
  playSrc("assets/sound/meeple/" + color + "/" + color + n + ".mp3");
}

export function playWinSound(color) {
  if (!MEEPLE_COLORS.includes(color)) return;
  unlockAudio();
  playSrc("assets/sound/win/" + color + ".mp3");
}

/** Start clear, then win sounds 1.5s later, one after another in ranking order. */
export async function playEndFanfare(colors) {
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

export function bindVolumeBar() {
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

const TileCityAudio = {
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
  SOUNDS,
};

if (typeof globalThis !== "undefined") globalThis.TileCityAudio = TileCityAudio;

export default TileCityAudio;
