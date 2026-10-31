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

function playSrc(src) {
  if (!(volume > 0) || !src) return;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => {});
  } catch (err) {}
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

export function playSound(name) {
  playSrc(SOUNDS[name]);
}

export function playMeepleSound(color) {
  if (!MEEPLE_COLORS.includes(color)) return;
  const n = 1 + Math.floor(Math.random() * 3);
  playSrc("assets/sound/meeple/" + color + "/" + color + n + ".mp3");
}

export function playWinSound(color) {
  if (!MEEPLE_COLORS.includes(color)) return;
  playSrc("assets/sound/win/" + color + ".mp3");
}

/** Start clear, then win sounds 1.5s later (may overlap clear), in ranking order. */
export async function playEndFanfare(colors) {
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
  syncVolumeInputs();
  document.querySelectorAll(".volume-range").forEach((input) => {
    input.addEventListener("input", () => {
      setVolume(Number(input.value) / 100);
    });
  });
}

const TileCityAudio = {
  getVolume,
  setVolume,
  playSound,
  playMeepleSound,
  playWinSound,
  playEndFanfare,
  bindVolumeBar,
};

if (typeof globalThis !== "undefined") globalThis.TileCityAudio = TileCityAudio;

export default TileCityAudio;
