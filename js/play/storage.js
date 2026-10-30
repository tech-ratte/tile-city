const SETUP_KEY = "tile-city-setup";
const SAVE_KEY = "tile-city-save";

export { SETUP_KEY, SAVE_KEY };

export function loadRoster(Carcassonne) {
  try {
    const raw = sessionStorage.getItem(SETUP_KEY);
    if (!raw) return null;
    return Carcassonne.normalizePlayers(JSON.parse(raw));
  } catch (err) {
    return null;
  }
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
