const VOLUME_KEY = "tile-city-volume";

const SOUNDS = {
  tile: "assets/sound/tile.mp3",
  point: "assets/sound/point.mp3",
};

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

export function playSound(name) {
  if (!(volume > 0)) return;
  const src = SOUNDS[name];
  if (!src) return;
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => {});
  } catch (err) {}
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
  bindVolumeBar,
};

if (typeof globalThis !== "undefined") globalThis.TileCityAudio = TileCityAudio;

export default TileCityAudio;
