const SETUP_KEY = "tile-city-setup";
const SAVE_KEY = "tile-city-save";
const ROULETTE_KEY = "tile-city-roulette";

export { SETUP_KEY, SAVE_KEY, ROULETTE_KEY };

export function markRoulettePending() {
  try {
    sessionStorage.setItem(ROULETTE_KEY, "1");
  } catch (err) {}
}

export function clearRoulettePending() {
  try {
    sessionStorage.removeItem(ROULETTE_KEY);
  } catch (err) {}
}

export function isRoulettePending() {
  try {
    return sessionStorage.getItem(ROULETTE_KEY) === "1";
  } catch (err) {
    return false;
  }
}

/** Parse setup payload: legacy player array or { players, options }. */
export function parseSetupPayload(Carcassonne, raw) {
  if (!raw) return null;
  let data;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (err) {
    return null;
  }
  if (Array.isArray(data)) {
    return {
      players: Carcassonne.normalizePlayers(data),
      options: Carcassonne.normalizeGameOptions(null),
    };
  }
  if (!data || typeof data !== "object") return null;
  const players = Carcassonne.normalizePlayers(data.players || data.roster);
  if (!players || !players.length) return null;
  return {
    players,
    options: Carcassonne.normalizeGameOptions(data.options),
  };
}

export function loadSetup(Carcassonne) {
  try {
    const raw = sessionStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    return parseSetupPayload(Carcassonne, raw);
  } catch (err) {
    return null;
  }
}

export function loadRoster(Carcassonne) {
  const setup = loadSetup(Carcassonne);
  return setup ? setup.players : null;
}

export function loadSetupOptions(Carcassonne) {
  const setup = loadSetup(Carcassonne);
  return Carcassonne.normalizeGameOptions(setup && setup.options);
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (err) {}
}

export function readSave() {
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

export function loadSavedGame(Carcassonne) {
  const save = readSave();
  if (!save) return null;
  const restored = Carcassonne.restoreGame(save.game);
  if (!restored) {
    clearSave();
    return null;
  }
  return { game: restored, view: save.view || null };
}

export function writeSave(Carcassonne, game, view, ready) {
  if (!ready) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      game: Carcassonne.serializeGame(game),
      view,
    }));
  } catch (err) {}
}
