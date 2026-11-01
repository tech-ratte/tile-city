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

/** Fixed persona names for bots (by meeple color). */
export const BOT_NAMES = {
  red: { en: "Rex", ja: "レックス" }, // hot-blooded warrior, boy ~17
  blue: { en: "Cain", ja: "カイン" }, // cold sage, boy ~18
  green: { en: "Rock", ja: "ロック" }, // young thief, boy ~11
  yellow: { en: "Luna", ja: "ルナ" }, // mischievous princess, girl ~10
  orange: { en: "Asuka", ja: "アスカ" }, // energetic fighter, girl ~17
  purple: { en: "Mora", ja: "モーラ" }, // necromancer, woman ~80
  white: { en: "Cecil", ja: "セシル" }, // apprentice cleric, girl ~15
  brown: { en: "Eliza", ja: "エリザ" }, // haughty mage, woman ~23
};

export function defaultPlayerName(index) {
  return "Player" + (Number(index) + 1);
}

/** Next PlayerN based on the highest Player# already in the roster (keeps counting after removals). */
export function nextPlayerName(list) {
  let max = 0;
  for (const player of list || []) {
    const match = String(player && player.name != null ? player.name : "").match(/^Player(\d+)$/i);
    if (!match) continue;
    const n = Number(match[1]);
    if (n > max) max = n;
  }
  return "Player" + (max + 1);
}

export function botNameForColor(id, lang) {
  const entry = BOT_NAMES[id];
  if (entry) {
    if (typeof entry === "string") return entry;
    return lang === "en" ? entry.en : entry.ja;
  }
  const color = COLOR_PALETTE.find((item) => item.id === id);
  return color ? color.label : "Bot";
}

export const PLAYERS = COLOR_PALETTE.slice(0, 4).map((color, index) => ({
  id: color.id,
  name: defaultPlayerName(index),
}));

export const MEEPLES_EACH = 7;

export const PLAYERS_MIN = 2;

export const PLAYERS_MAX = 8;

export const NAME_MAX = 10;

/** Bot difficulty ids shown in setup. Only standard is implemented for now. */
export const BOT_STRENGTHS = [
  { id: "standard", label: "Standard" },
];

export const BOT_STRENGTH_IDS = BOT_STRENGTHS.map((item) => item.id);

export function normalizeBotStrength(value, isBot) {
  if (!isBot) return null;
  if (typeof value === "string" && BOT_STRENGTH_IDS.includes(value)) return value;
  return "standard";
}

export function normalizePlayerRecord(item) {
  const known = new Set(COLOR_PALETTE.map((color) => color.id));
  const id = item && known.has(item.id) ? item.id : null;
  if (!id) return null;
  const bot = !!(item && item.bot);
  const raw = item.name == null ? "" : String(item.name);
  const name = bot
    ? botNameForColor(id)
    : raw.trim().slice(0, NAME_MAX) || COLOR_PALETTE.find((c) => c.id === id).label;
  return {
    id: id,
    name: name,
    bot: bot,
    botStrength: normalizeBotStrength(item && item.botStrength, bot),
  };
}

export function defaultPlayerList() {
  return PLAYERS.map((player) => ({
    id: player.id,
    name: player.name,
    bot: false,
    botStrength: null,
  }));
}

export function normalizePlayers(list) {
  if (!Array.isArray(list) || !list.length) {
    return defaultPlayerList();
  }
  const used = new Set();
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
