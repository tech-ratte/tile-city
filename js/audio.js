const VOLUME_KEY = "tile-city-volume";

const SOUNDS = {
  tile: "assets/sound/tile.mp3",
  point: "assets/sound/point.mp3",
  clear: "assets/sound/clear.mp3",
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

/** Resume AudioContext + warm SFX so bot timer playback is allowed. */
export function unlockAudio() {
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

/** Start clear, then win sounds 1.5s later (may overlap clear), in ranking order. */
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
  playMeepleSound,
  playWinSound,
  playEndFanfare,
  bindVolumeBar,
  unlockAudio,
  getAudioDebugState,
};

if (typeof globalThis !== "undefined") globalThis.TileCityAudio = TileCityAudio;

export default TileCityAudio;
