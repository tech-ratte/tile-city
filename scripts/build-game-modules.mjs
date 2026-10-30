import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const body = fs.readFileSync(path.join(root, "js", "game", "_body.js"), "utf8");
const lines = body.split("\n");

// Top-level declarations start at indent 2 (two spaces) and are not continuation.
const tops = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^  (const|let|var|function|class) /.test(line) || /^  \/\/ /.test(line) && i + 1 < lines.length && /^  (const|function|class) /.test(lines[i + 1])) {
    // skip pure comment-only markers unless followed by decl - handled below
  }
  if (/^  (const|let|var|function|class) /.test(line)) {
    const nameMatch = line.match(/^  (?:const|let|var|function|class) ([A-Za-z0-9_]+)/);
    tops.push({ line: i, name: nameMatch ? nameMatch[1] : ("anon" + i), raw: line.trim() });
  }
}

function blockEnd(start) {
  const first = lines[start];
  if (/;\s*$/.test(first) && !/[{\[\(]/.test(first)) return start;

  let brace = 0;
  let paren = 0;
  let bracket = 0;
  let started = false;
  let quote = null;
  for (let i = start; i < lines.length; i++) {
    const s = lines[i];
    for (let c = 0; c < s.length; c++) {
      const ch = s[c];
      const prev = c > 0 ? s[c - 1] : "";
      if (quote) {
        if (ch === quote && prev !== "\\") quote = null;
        continue;
      }
      if (ch === "'" || ch === "\"" || ch === "`") {
        quote = ch;
        continue;
      }
      if (ch === "{") { brace++; started = true; }
      else if (ch === "}") brace--;
      else if (ch === "(") { paren++; started = true; }
      else if (ch === ")") paren--;
      else if (ch === "[") { bracket++; started = true; }
      else if (ch === "]") bracket--;
    }
    if (started && brace <= 0 && paren <= 0 && bracket <= 0) return i;
  }
  return lines.length - 1;
}

const blocks = tops.map((t, idx) => {
  const end = blockEnd(t.line);
  const nextStart = idx + 1 < tops.length ? tops[idx + 1].line : lines.length;
  const realEnd = Math.min(end, nextStart - 1);
  // include leading comments directly above
  let start = t.line;
  while (start > 0 && /^\s*\/\//.test(lines[start - 1])) start--;
  while (start > 0 && lines[start - 1].trim() === "") start--;
  // don't steal previous block
  if (idx > 0) start = Math.max(start, tops[idx - 1].line);
  // fix: start should be >= previous end+1
  return { ...t, start: t.line, end: realEnd };
});

// Fix starts to include comments between previous end and this decl
for (let i = 0; i < blocks.length; i++) {
  const prevEnd = i === 0 ? -1 : blocks[i - 1].end;
  let start = blocks[i].line;
  for (let j = blocks[i].line - 1; j > prevEnd; j--) {
    if (lines[j].trim() === "" || /^\s*\/\//.test(lines[j])) start = j;
    else break;
  }
  blocks[i].start = start;
}

const modules = {
  constants: [
    "COLOR_PALETTE", "PLAYERS", "MEEPLES_EACH", "PLAYERS_MIN", "PLAYERS_MAX", "NAME_MAX",
    "normalizePlayers", "EDGE_NAME", "DIR_NAME", "NEI", "DIRS", "DIR_INDEX", "OPP_DIR",
  ],
  catalog: ["TYPES", "MARKUP", "BY_ID", "MEEPLE_LAYOUTS", "FIELD_PORTS", "FIELD_CITY_TOUCH"],
  tiles: [
    "keyOf", "rotateEdges", "rotClass", "tileHTML", "copyCities", "copyRoads",
    "makeTile", "buildTiles", "clonePlaced", "rotatePoint", "listMeepleSlots",
  ],
  board: ["canPlace", "openCells", "byPos", "boardErrors", "edgeText"],
  features: [
    "absDir", "findRoadIndexByAbsEdge", "findCityIndexByAbsEdge",
    "collectRoadComponent", "collectCityComponent", "monasteryComplete",
    "fieldPortsFor", "findFieldIndexByAbsPort", "collectFieldComponent",
    "featureHasMeeple", "isMeepleSlotOpen",
  ],
  scoring: [
    "meepleCountsOnFeature", "majorityPlayers", "uniqueTileCount", "cityPennantCount",
    "componentId", "awardPoints", "returnMeepleFromTile", "returnMeeplesOnFeature",
    "labelMeepleEarnings", "scoreFeature", "roadPoints", "cityPoints",
    "monasteryTileCount", "completedCitiesTouchingField",
    "resolveCompletions", "finalizeScores", "rankPlayers",
  ],
  engine: ["shuffle", "Game", "createGame", "simulateToLastTile"],
  persist: [
    "SAVE_VERSION", "snapshotLooseTile", "snapshotPlacedTile", "revivePlacedTile",
    "serializeGame", "restoreGame",
  ],
};

const byName = Object.fromEntries(blocks.map((b) => [b.name, b]));
const missing = [];
for (const [mod, names] of Object.entries(modules)) {
  for (const name of names) {
    if (!byName[name]) missing.push(mod + ":" + name);
  }
}
if (missing.length) {
  console.error("Missing symbols:", missing);
  console.error("Found:", blocks.map((b) => b.name).join(", "));
  process.exit(1);
}

function undent(text) {
  return text.replace(/^  /gm, "");
}

const exportMap = {};

for (const [mod, names] of Object.entries(modules)) {
  const chunks = [];
  for (const name of names) {
    const b = byName[name];
    chunks.push(lines.slice(b.start, b.end + 1).join("\n"));
    exportMap[name] = mod;
  }
  let code = undent(chunks.join("\n\n")) + "\n";
  // add imports based on used names from other modules - second pass
  fs.writeFileSync(path.join(root, "js", "game", mod + ".raw.js"), code);
  console.log(mod, names.length, "symbols", code.length);
}

fs.writeFileSync(
  path.join(root, "js", "game", "_symbols.json"),
  JSON.stringify({ blocks: blocks.map((b) => ({ name: b.name, start: b.start, end: b.end })), modules, exportMap }, null, 2)
);
console.log("raw modules written — wiring imports next");
