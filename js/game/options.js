/** Display options chosen on the setup screen (before the player roster). */
export const DEFAULT_GAME_OPTIONS = {
  colorRoads: true,
  colorCities: true,
  colorMonasteries: true,
};

export function normalizeGameOptions(raw) {
  const out = Object.assign({}, DEFAULT_GAME_OPTIONS);
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.colorRoads === "boolean") out.colorRoads = raw.colorRoads;
  if (typeof raw.colorCities === "boolean") out.colorCities = raw.colorCities;
  if (typeof raw.colorMonasteries === "boolean") out.colorMonasteries = raw.colorMonasteries;
  return out;
}

/** Feature id from data-feat → option key, or null if unknown. */
export function featColorOptionKey(feat) {
  const id = String(feat || "");
  if (id === "monastery" || id.startsWith("monastery")) return "colorMonasteries";
  if (id.startsWith("city")) return "colorCities";
  if (id.startsWith("road")) return "colorRoads";
  return null;
}

export function claimColorEnabled(options, feat) {
  const key = featColorOptionKey(feat);
  if (!key) return true;
  const opts = normalizeGameOptions(options);
  return opts[key] !== false;
}
