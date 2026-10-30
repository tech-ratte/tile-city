export const COLOR_PALETTE = [
  { id: "red", hex: "#ff5d78", label: "Red" },
  { id: "blue", hex: "#49c4ff", label: "Blue" },
  { id: "green", hex: "#3dff9a", label: "Green" },
  { id: "yellow", hex: "#ffe14a", label: "Yellow" },
  { id: "orange", hex: "#ff9a3d", label: "Orange" },
  { id: "purple", hex: "#7c3aed", label: "Purple" },
  { id: "white", hex: "#f4f7fb", label: "White" },
  { id: "brown", hex: "#a67c52", label: "Brown" },
];

export const PLAYERS = COLOR_PALETTE.slice(0, 4).map((color) => ({
  id: color.id,
  name: color.label,
}));

export const MEEPLES_EACH = 7;

export const PLAYERS_MIN = 2;

export const PLAYERS_MAX = 8;

export const NAME_MAX = 6;


export function normalizePlayers(list) {
  if (!Array.isArray(list) || !list.length) {
    return PLAYERS.map((player) => ({ id: player.id, name: player.name }));
  }
  const known = new Set(COLOR_PALETTE.map((color) => color.id));
  const used = new Set();
  const out = [];
  for (const item of list) {
    if (out.length >= PLAYERS_MAX) break;
    const id = item && known.has(item.id) ? item.id : null;
    if (!id || used.has(id)) continue;
    used.add(id);
    const raw = item.name == null ? "" : String(item.name);
    const name = raw.trim().slice(0, NAME_MAX) || COLOR_PALETTE.find((c) => c.id === id).label;
    out.push({ id: id, name: name });
  }
  if (out.length < PLAYERS_MIN) {
    return PLAYERS.map((player) => ({ id: player.id, name: player.name }));
  }
  return out;
}


export const EDGE_NAME = { C: "都市", R: "道", F: "草原" };

export const DIR_NAME = ["北", "東", "南", "西"];


// Edges are north, east, south, west in the catalog orientation.
// C is city from corner to corner. R is field, road, field. F is field.
// Clockwise 90 degrees: the old west edge becomes north.
export const NEI = [
  { dir: 0, dx: 0, dy: -1, opp: 2 },
  { dir: 1, dx: 1, dy: 0, opp: 3 },
  { dir: 2, dx: 0, dy: 1, opp: 0 },
  { dir: 3, dx: -1, dy: 0, opp: 1 },
];


export const DIRS = ["N", "E", "S", "W"];

export const DIR_INDEX = { N: 0, E: 1, S: 2, W: 3 };

export const OPP_DIR = { N: "S", E: "W", S: "N", W: "E" };
