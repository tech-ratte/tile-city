import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dir = path.join(root, "js", "game");
const { modules } = JSON.parse(fs.readFileSync(path.join(dir, "_symbols.json"), "utf8"));

const exportFrom = {};
for (const [mod, names] of Object.entries(modules)) {
  for (const name of names) exportFrom[name] = mod;
}

// Manual extra imports that static scan might miss due to method shorthand etc.
const forceImports = {
  constants: [],
  catalog: [],
  tiles: ["TYPES", "MARKUP", "BY_ID", "MEEPLE_LAYOUTS"],
  board: ["keyOf", "NEI", "rotateEdges", "DIR_NAME", "EDGE_NAME"],
  features: ["keyOf", "NEI", "DIRS", "DIR_INDEX", "OPP_DIR", "FIELD_PORTS"],
  scoring: [
    "keyOf", "FIELD_CITY_TOUCH",
    "collectRoadComponent", "collectCityComponent", "collectFieldComponent",
    "monasteryComplete", "fieldPortsFor",
  ],
  engine: [
    "normalizePlayers", "MEEPLES_EACH", "PLAYERS",
    "rotateEdges", "canPlace", "openCells", "byPos",
    "listMeepleSlots", "isMeepleSlotOpen", "makeTile", "clonePlaced", "buildTiles",
    "resolveCompletions", "finalizeScores", "keyOf",
  ],
  persist: [
    "SAVE_VERSION", // self
    "normalizePlayers", "PLAYERS_MIN", "MEEPLES_EACH",
    "makeTile", "clonePlaced", "Game",
  ],
};

function usedNames(code, selfNames) {
  const used = new Set();
  const self = new Set(selfNames);
  for (const name of Object.keys(exportFrom)) {
    if (self.has(name)) continue;
    const re = new RegExp("\\b" + name + "\\b");
    if (re.test(code)) used.add(name);
  }
  return [...used];
}

function exportList(names, code) {
  // const X = / function X / class X
  const exports = [];
  for (const name of names) {
    if (new RegExp("^(?:const|let|var|function|class) " + name + "\\b", "m").test(code)) {
      exports.push(name);
    }
  }
  return exports;
}

for (const [mod, names] of Object.entries(modules)) {
  let code = fs.readFileSync(path.join(dir, mod + ".raw.js"), "utf8");
  // persist declares SAVE_VERSION - forceImports includes it as self, filter later
  const scanned = usedNames(code, names);
  const forced = (forceImports[mod] || []).filter((n) => exportFrom[n] && exportFrom[n] !== mod);
  const imports = [...new Set([...scanned, ...forced])];

  const byMod = {};
  for (const name of imports) {
    const from = exportFrom[name];
    if (!from || from === mod) continue;
    (byMod[from] ||= []).push(name);
  }

  const importLines = Object.keys(byMod).sort().map((from) => {
    const list = byMod[from].sort().join(", ");
    return `import { ${list} } from "./${from}.js";`;
  });

  const ex = exportList(names, code);
  // Convert declarations to exported
  for (const name of ex) {
    code = code.replace(
      new RegExp("^(const|let|var|function|class) (" + name + ")\\b", "m"),
      "export $1 $2"
    );
  }

  const out = (importLines.length ? importLines.join("\n") + "\n\n" : "") + code.trim() + "\n";
  fs.writeFileSync(path.join(dir, mod + ".js"), out);
  console.log(mod, "imports", imports.length, "exports", ex.length);
}

// index.js public API matching previous Carcassonne surface
const apiExports = [
  "PLAYERS", "COLOR_PALETTE", "PLAYERS_MIN", "PLAYERS_MAX", "NAME_MAX", "MEEPLES_EACH",
  "TYPES", "MARKUP", "EDGE_NAME", "DIR_NAME",
  "buildTiles", "makeTile", "rotateEdges", "canPlace", "openCells", "boardErrors",
  "edgeText", "tileHTML", "listMeepleSlots", "MEEPLE_LAYOUTS", "FIELD_PORTS",
  "collectRoadComponent", "collectCityComponent", "collectFieldComponent",
  "monasteryComplete", "isMeepleSlotOpen", "resolveCompletions", "finalizeScores",
  "rankPlayers", "normalizePlayers", "cityPoints", "roadPoints",
  "completedCitiesTouchingField", "FIELD_CITY_TOUCH",
  "createGame", "serializeGame", "restoreGame", "SAVE_VERSION", "simulateToLastTile",
];

const byMod = {};
for (const name of apiExports) {
  const from = exportFrom[name];
  if (!from) throw new Error("API symbol missing from modules: " + name);
  (byMod[from] ||= []).push(name);
}

const indexLines = [];
for (const from of Object.keys(byMod).sort()) {
  indexLines.push(`export { ${byMod[from].join(", ")} } from "./${from}.js";`);
}
indexLines.push("");
indexLines.push("import * as api from \"./index.ns.js\";");
// simpler: build namespace object in index

const index = `import {
  PLAYERS,
  COLOR_PALETTE,
  PLAYERS_MIN,
  PLAYERS_MAX,
  NAME_MAX,
  MEEPLES_EACH,
  EDGE_NAME,
  DIR_NAME,
  normalizePlayers,
} from "./constants.js";
import {
  TYPES,
  MARKUP,
  MEEPLE_LAYOUTS,
  FIELD_PORTS,
  FIELD_CITY_TOUCH,
} from "./catalog.js";
import {
  buildTiles,
  makeTile,
  rotateEdges,
  tileHTML,
  listMeepleSlots,
} from "./tiles.js";
import {
  canPlace,
  openCells,
  boardErrors,
  edgeText,
} from "./board.js";
import {
  collectRoadComponent,
  collectCityComponent,
  collectFieldComponent,
  monasteryComplete,
  isMeepleSlotOpen,
} from "./features.js";
import {
  resolveCompletions,
  finalizeScores,
  rankPlayers,
  cityPoints,
  roadPoints,
  completedCitiesTouchingField,
} from "./scoring.js";
import {
  createGame,
  simulateToLastTile,
} from "./engine.js";
import {
  serializeGame,
  restoreGame,
  SAVE_VERSION,
} from "./persist.js";

const Carcassonne = {
  PLAYERS,
  COLOR_PALETTE,
  PLAYERS_MIN,
  PLAYERS_MAX,
  NAME_MAX,
  MEEPLES_EACH,
  TYPES,
  MARKUP,
  EDGE_NAME,
  DIR_NAME,
  buildTiles,
  makeTile,
  rotateEdges,
  canPlace,
  openCells,
  boardErrors,
  edgeText,
  tileHTML,
  listMeepleSlots,
  MEEPLE_LAYOUTS,
  FIELD_PORTS,
  collectRoadComponent,
  collectCityComponent,
  collectFieldComponent,
  monasteryComplete,
  isMeepleSlotOpen,
  resolveCompletions,
  finalizeScores,
  rankPlayers,
  normalizePlayers,
  cityPoints,
  roadPoints,
  completedCitiesTouchingField,
  FIELD_CITY_TOUCH,
  createGame,
  serializeGame,
  restoreGame,
  SAVE_VERSION,
  simulateToLastTile,
};

export default Carcassonne;
export {
  PLAYERS,
  COLOR_PALETTE,
  PLAYERS_MIN,
  PLAYERS_MAX,
  NAME_MAX,
  MEEPLES_EACH,
  TYPES,
  MARKUP,
  EDGE_NAME,
  DIR_NAME,
  buildTiles,
  makeTile,
  rotateEdges,
  canPlace,
  openCells,
  boardErrors,
  edgeText,
  tileHTML,
  listMeepleSlots,
  MEEPLE_LAYOUTS,
  FIELD_PORTS,
  collectRoadComponent,
  collectCityComponent,
  collectFieldComponent,
  monasteryComplete,
  isMeepleSlotOpen,
  resolveCompletions,
  finalizeScores,
  rankPlayers,
  normalizePlayers,
  cityPoints,
  roadPoints,
  completedCitiesTouchingField,
  FIELD_CITY_TOUCH,
  createGame,
  serializeGame,
  restoreGame,
  SAVE_VERSION,
  simulateToLastTile,
};
`;

fs.writeFileSync(path.join(dir, "index.js"), index);

// CJS/UMD facade at js/game.js for classic scripts and require()
const facade = `/**
 * Tile City game API facade.
 * - ESM: import Carcassonne from "./game/index.js"
 * - CJS/tests: require("./game.js")
 * - Browser classic: <script type="module" src="js/game-global.js">
 */
(async function boot(root) {
  function publish(api) {
    root.Carcassonne = api;
    if (typeof module === "object" && module.exports) {
      module.exports = api;
    }
  }

  if (typeof require === "function" && typeof module === "object" && module.exports) {
    // Node CJS: load ESM synchronously via dynamic import is async — use createRequire path with sync?
    // Prefer registering exports after import in test file. For require compatibility:
    throw new Error("Use node --experimental-vm-modules or import from js/game/index.js");
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
`;

// Better CJS facade using Module.createRequire + wait - Node 22 can import sync with?

fs.writeFileSync(path.join(root, "js", "game-global.js"), `import Carcassonne from "./game/index.js";
globalThis.Carcassonne = Carcassonne;
export default Carcassonne;
`);

console.log("wired modules + index.js + game-global.js");
