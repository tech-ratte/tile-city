import assert from "assert";
import {
  TYPES,
  PLAYERS,
  MEEPLES_EACH,
  buildTiles,
  makeTile,
  rotateEdges,
  canPlace,
  boardErrors,
  tileHTML,
  edgeText,
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
  simulateToLastTile,
  createGame,
  serializeGame,
  restoreGame,
  normalizePlayers,
  COLOR_PALETTE,
  PLAYERS_MIN,
  PLAYERS_MAX,
  NAME_MAX,
  nextPlayerName,
  botNameForColor,
  chooseBotAction,
} from "./game/index.js";

function makePlaced(id, rot, meeple) {
  const tile = makeTile(id);
  tile.rot = rot;
  tile.owner = "red";
  tile.meeple = meeple || null;
  return tile;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stock(game) {
  return game.board.size + game.deck.length + game.discards.length + (game.current ? 1 : 0);
}

function idsOf(game) {
  const ids = [];
  for (const tile of game.board.values()) ids.push(tile.id);
  for (const tile of game.deck) ids.push(tile.id);
  for (const tile of game.discards) ids.push(tile.id);
  if (game.current) ids.push(game.current.id);
  return ids.sort().join("");
}

function drainDiscards(game) {
  let guard = 0;
  while (game.pendingDiscard) {
    assert.strictEqual(game.acknowledgeDiscard(), true);
    assert.ok(++guard < 80);
  }
}

function takeTurn(game) {
  assert.ok(!game.finished);
  drainDiscards(game);
  assert.ok(game.current);
  for (let i = 0; i < 4 && game.hints().now.length === 0; i++) game.rotate(1);
  const cell = game.hints().now[0];
  assert.ok(cell, game.current.id + " has a highlighted cell");
  const player = game.player;
  assert.strictEqual(game.place(cell.x, cell.y), true);
  assert.ok(game.pendingMeeple);
  assert.strictEqual(game.player, player);
  assert.ok(game.meepleSlots().length > 0);
  assert.strictEqual(game.skipMeeple(), true);
  drainDiscards(game);
  if (!game.finished) assert.strictEqual(game.player, (player + 1) % PLAYERS.length);
  assert.strictEqual(stock(game), 72);
  assert.deepStrictEqual(boardErrors(game.board), []);
}

const tiles = buildTiles();
assert.strictEqual(tiles.length, 72);
assert.strictEqual(tiles.filter((tile) => tile.start).length, 1);
assert.strictEqual(tiles.filter((tile) => tile.cities.some((city) => city.pennant)).length, 10);
assert.strictEqual(TYPES.reduce((sum, type) => sum + type.count, 0), 72);
for (const type of TYPES) tileHTML(type.id, 0);

const mutated = makeTile("D", true);
mutated.edges[0] = "F";
assert.strictEqual(TYPES.find((type) => type.id === "D").edges[0], "C");

const j = TYPES.find((type) => type.id === "J").edges;
const k = TYPES.find((type) => type.id === "K").edges;
for (let rot = 0; rot < 4; rot++) {
  assert.notDeepStrictEqual(rotateEdges(j, rot), k);
}
assert.deepStrictEqual(rotateEdges(["R", "F", "R", "F"], 1), ["F", "R", "F", "R"]);
assert.deepStrictEqual(rotateEdges(["C", "F", "F", "F"], 2), ["F", "F", "C", "F"]);
assert.strictEqual(edgeText(["C", "R", "F", "R"]), "北 都市 · 東 道 · 南 草原 · 西 道");

const startBoard = new Map();
startBoard.set("0,0", { edges: ["C", "R", "F", "R"], rot: 0 });
assert.strictEqual(canPlace(startBoard, 1, 0, ["R", "F", "R", "F"]), false);
assert.strictEqual(canPlace(startBoard, 1, 0, rotateEdges(["R", "F", "R", "F"], 1)), true);
assert.strictEqual(canPlace(startBoard, 0, -1, ["C", "F", "F", "F"]), false);
assert.strictEqual(canPlace(startBoard, 0, -1, rotateEdges(["C", "F", "F", "F"], 2)), true);
assert.strictEqual(canPlace(startBoard, 0, 1, ["F", "F", "R", "R"]), true);
assert.strictEqual(canPlace(startBoard, 1, -1, ["F", "F", "F", "F"]), false);
assert.strictEqual(canPlace(startBoard, 0, 0, ["F", "F", "F", "F"]), false);

const hole = new Map();
hole.set("0,-1", { edges: ["C", "F", "F", "F"], rot: 2 });
hole.set("1,0", { edges: ["R", "F", "R", "F"], rot: 1 });
hole.set("0,1", { edges: ["F", "F", "F", "F"], rot: 0 });
hole.set("-1,0", { edges: ["R", "F", "R", "F"], rot: 1 });
assert.strictEqual(canPlace(hole, 0, 0, ["C", "R", "F", "R"]), true);
assert.strictEqual(canPlace(hole, 0, 0, ["C", "R", "C", "R"]), false);
assert.strictEqual(canPlace(hole, 0, 0, ["F", "F", "F", "F"]), false);

const opening = createGame(() => 0);
assert.strictEqual(opening.board.get("0,0").id, "D");
assert.strictEqual(opening.board.get("0,0").rot, 0);
assert.strictEqual(opening.board.get("0,0").start, true);
assert.strictEqual(stock(opening), 72);
assert.strictEqual(idsOf(opening), buildTiles().map((tile) => tile.id).sort().join(""));
assert.strictEqual(opening.player, 0);

opening.current = makeTile("U");
opening.rotation = 0;
let hints = opening.hints();
assert.ok(!hints.now.some((cell) => cell.x === 1 && cell.y === 0));
assert.deepStrictEqual(hints.later.find((cell) => cell.x === 1 && cell.y === 0).rots, [1, 3]);
assert.ok(!hints.now.concat(hints.later).some((cell) => cell.x === 1 && cell.y === -1));
opening.rotation = 1;
hints = opening.hints();
assert.ok(hints.now.some((cell) => cell.x === 1 && cell.y === 0));
assert.ok(!hints.later.some((cell) => cell.x === 1 && cell.y === 0));

opening.current = makeTile("E");
opening.rotation = 2;
assert.ok(opening.hints().now.some((cell) => cell.x === 0 && cell.y === -1));
opening.current = makeTile("V");
opening.rotation = 0;
assert.ok(opening.hints().now.some((cell) => cell.x === 0 && cell.y === 1));
opening.current = makeTile("B");
opening.rotation = 0;
hints = opening.hints();
assert.deepStrictEqual(hints.now.map((cell) => cell.x + "," + cell.y), ["0,1"]);
assert.deepStrictEqual(hints.later, []);

const rejected = createGame(mulberry32(3));
const rejectedPlayer = rejected.player;
const rejectedSize = rejected.board.size;
assert.strictEqual(rejected.place(3, 3), false);
assert.strictEqual(rejected.player, rejectedPlayer);
assert.strictEqual(rejected.board.size, rejectedSize);

const placed = createGame(mulberry32(4));
const placedStart = placed.player;
placed.current = makeTile("U");
placed.rotation = 1;
assert.strictEqual(placed.place(1, 0), true);
assert.strictEqual(placed.board.get("1,0").rot, 1);
assert.deepStrictEqual(placed.board.get("1,0").edges, ["R", "F", "R", "F"]);
assert.ok(placed.pendingMeeple);
assert.strictEqual(placed.player, placedStart);
assert.ok(placed.meepleSlots().some((slot) => slot.kind === "road"));
assert.strictEqual(placed.skipMeeple(), true);
assert.strictEqual(placed.player, (placedStart + 1) % placed.players.length);

const withMeeple = createGame(mulberry32(4));
const withMeepleStart = withMeeple.player;
withMeeple.current = makeTile("U");
withMeeple.rotation = 1;
assert.strictEqual(withMeeple.place(1, 0), true);
const roadSlot = withMeeple.meepleSlots().find((slot) => slot.kind === "road");
assert.ok(roadSlot);
assert.strictEqual(withMeeple.placeMeeple(roadSlot.id), true);
assert.strictEqual(withMeeple.board.get("1,0").meeple.slot, roadSlot.id);
assert.strictEqual(withMeeple.meeples[withMeepleStart], 6);
assert.strictEqual(withMeeple.pendingMeeple, null);

for (const type of TYPES) {
  assert.ok(MEEPLE_LAYOUTS[type.id], type.id + " has meeple layout");
  const slots = listMeepleSlots({ id: type.id, rot: 0 });
  assert.ok(slots.length > 0, type.id + " has slots");
  if (type.monastery) {
    assert.ok(slots.some((slot) => slot.kind === "monastery"), type.id + " monastery mark");
  }
  assert.strictEqual(slots.filter((slot) => slot.kind === "city").length, type.cities.length, type.id + " cities");
  assert.strictEqual(slots.filter((slot) => slot.kind === "road").length, type.roads.length, type.id + " roads");
}
const vSlots = listMeepleSlots({ id: "V", rot: 0 });
assert.strictEqual(vSlots.filter((slot) => slot.kind === "field").length, 2, "V has two fields");
assert.ok(vSlots.some((slot) => slot.kind === "field" && slot.x > 0.5 && slot.y < 0.5), "V outer field");
assert.ok(vSlots.some((slot) => slot.kind === "field" && slot.x < 0.25 && slot.y > 0.7), "V inner field");
const bSlots = listMeepleSlots({ id: "B", rot: 0 });
assert.ok(bSlots.some((slot) => slot.kind === "monastery" && slot.y < 0.5), "B monastery near building");
assert.strictEqual(listMeepleSlots({ id: "D", rot: 0 }).filter((slot) => slot.kind === "field").length, 2, "D fields");
const jSlots = listMeepleSlots({ id: "J", rot: 0 });
assert.strictEqual(jSlots.filter((slot) => slot.kind === "field").length, 2, "J fields");
assert.ok(jSlots.some((slot) => slot.kind === "field" && slot.x > 0.75 && slot.y > 0.75), "J inner SE pocket");
assert.ok(jSlots.some((slot) => slot.kind === "road" && slot.x < 0.7 && slot.y < 0.7), "J road on arc");
const pSlots = listMeepleSlots({ id: "P", rot: 0 });
assert.strictEqual(pSlots.filter((slot) => slot.kind === "field").length, 2, "P fields");
assert.ok(pSlots.some((slot) => slot.kind === "field" && slot.x > 0.75 && slot.y > 0.75), "P inner SE pocket");
function minDist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
for (const id of ["J", "K", "O", "P", "V"]) {
  const slots = listMeepleSlots({ id: id, rot: 0 });
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      assert.ok(minDist(slots[i], slots[j]) > 0.22, id + " slots separated");
    }
  }
}

const undoGame = createGame(mulberry32(4));
const undoStart = undoGame.player;
undoGame.current = makeTile("U");
undoGame.rotation = 1;
assert.strictEqual(undoGame.place(1, 0), true);
assert.strictEqual(undoGame.undoPlace(), true);
assert.strictEqual(undoGame.pendingMeeple, null);
assert.strictEqual(undoGame.current.id, "U");
assert.strictEqual(undoGame.rotation, 1);
assert.strictEqual(undoGame.player, undoStart);
assert.ok(!undoGame.board.has("1,0"));

// Two dead-end roads meeting are complete.
{
  const board = new Map();
  board.set("0,0", makePlaced("A", 0));
  board.set("0,1", makePlaced("A", 2));
  const road = collectRoadComponent(board, 0, 0, 0);
  assert.strictEqual(road.complete, true);
  assert.strictEqual(road.parts.length, 2);
}
{
  const board = new Map();
  board.set("0,0", makePlaced("A", 0));
  const road = collectRoadComponent(board, 0, 0, 0);
  assert.strictEqual(road.complete, false);
}

// Two single-edge cities facing each other are complete.
{
  const board = new Map();
  board.set("0,0", makePlaced("E", 0));
  board.set("0,-1", makePlaced("E", 2));
  const city = collectCityComponent(board, 0, 0, 0);
  assert.strictEqual(city.complete, true);
  assert.strictEqual(city.parts.length, 2);
}
{
  const board = new Map();
  board.set("0,0", makePlaced("E", 0));
  const city = collectCityComponent(board, 0, 0, 0);
  assert.strictEqual(city.complete, false);
}

// Monastery needs the full 3x3.
{
  const board = new Map();
  board.set("0,0", makePlaced("B", 0));
  assert.strictEqual(monasteryComplete(board, 0, 0), false);
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      if (x === 0 && y === 0) continue;
      board.set(x + "," + y, makePlaced("E", 0));
    }
  }
  assert.strictEqual(monasteryComplete(board, 0, 0), true);
}

// Completing a road returns the meeple and scores 1 per tile.
{
  const game = createGame(mulberry32(7));
  game.board.clear();
  game.board.set("0,0", makePlaced("A", 0, {
    player: 0, color: "red", slot: "road-0", kind: "road", index: 0, x: 0.5, y: 0.78,
  }));
  game.meeples = [6, 7, 7, 7];
  game.scores = [0, 0, 0, 0];
  game.current = makeTile("A");
  game.rotation = 2;
  game.player = 0;
  assert.strictEqual(game.place(0, 1), true);
  assert.strictEqual(game.skipMeeple(), true);
  assert.strictEqual(game.board.get("0,0").meeple, null);
  assert.strictEqual(game.meeples[0], 7);
  assert.strictEqual(game.scores[0], 2);
}

// Completing a city returns the meeple and scores 2 per tile.
{
  const game = createGame(mulberry32(8));
  game.board.clear();
  game.board.set("0,0", makePlaced("E", 0, {
    player: 1, color: "blue", slot: "city-0", kind: "city", index: 0, x: 0.5, y: 0.18,
  }));
  game.meeples = [7, 6, 7, 7];
  game.scores = [0, 0, 0, 0];
  game.current = makeTile("E");
  game.rotation = 2;
  game.player = 0;
  assert.strictEqual(game.place(0, -1), true);
  assert.strictEqual(game.skipMeeple(), true);
  assert.strictEqual(game.board.get("0,0").meeple, null);
  assert.strictEqual(game.meeples[1], 7);
  assert.strictEqual(game.scores[1], 4);
}

// Completing a monastery returns the meeple and scores 9.
{
  const game = createGame(mulberry32(9));
  game.board.clear();
  game.board.set("0,0", makePlaced("B", 0, {
    player: 0, color: "red", slot: "monastery", kind: "monastery", index: null, x: 0.5, y: 0.4,
  }));
  game.meeples = [6, 7, 7, 7];
  game.scores = [0, 0, 0, 0];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      if (x === 0 && y === 0) continue;
      if (x === 1 && y === 1) continue;
      game.board.set(x + "," + y, makePlaced("E", y === 1 ? 2 : 0));
    }
  }
  game.current = makeTile("E");
  game.rotation = 2;
  game.player = 0;
  assert.strictEqual(game.place(1, 1), true);
  assert.strictEqual(game.skipMeeple(), true);
  assert.strictEqual(game.board.get("0,0").meeple, null);
  assert.strictEqual(game.meeples[0], 7);
  assert.strictEqual(game.scores[0], 9);
}

// No stock left → cannot place a meeple.
{
  const game = createGame(mulberry32(10));
  game.player = 0;
  game.current = makeTile("U");
  game.rotation = 1;
  game.meeples[0] = 0;
  assert.strictEqual(game.place(1, 0), true);
  assert.deepStrictEqual(game.meepleSlots(), []);
  assert.strictEqual(game.placeMeeple("road-0"), false);
  assert.ok(game.pendingMeeple);
  assert.strictEqual(game.skipMeeple(), true);
  assert.strictEqual(game.meeples[0], 0);
}

// Field port count matches meeple field slots for every tile type.
for (const id of Object.keys(MEEPLE_LAYOUTS)) {
  const fields = MEEPLE_LAYOUTS[id].filter((slot) => slot.kind === "field").length;
  assert.strictEqual((FIELD_PORTS[id] || []).length, fields, id + " field ports");
}

// Adjacent straight roads join field halves across the shared edge.
{
  const board = new Map();
  board.set("0,0", makePlaced("U", 0));
  board.set("1,0", makePlaced("U", 0));
  const east = collectFieldComponent(board, 0, 0, 1);
  assert.strictEqual(east.parts.length, 2);
  assert.ok(east.parts.some((part) => part.x === 1 && part.y === 0 && part.index === 0));
  const west = collectFieldComponent(board, 0, 0, 0);
  assert.strictEqual(west.parts.length, 1);
}

// Curve fields: large outer field vs inner pocket stay separate until linked.
{
  const board = new Map();
  board.set("0,0", makePlaced("V", 0));
  assert.strictEqual(collectFieldComponent(board, 0, 0, 0).parts.length, 1);
  assert.strictEqual(collectFieldComponent(board, 0, 0, 1).parts.length, 1);
}

// Occupied road feature hides the road mark and rejects placeMeeple.
{
  const game = createGame(mulberry32(11));
  game.board.clear();
  game.board.set("0,0", makePlaced("U", 1, {
    player: 0, color: "red", slot: "road-0", kind: "road", index: 0, x: 0.5, y: 0.5,
  }));
  game.meeples = [6, 7, 7, 7];
  game.current = makeTile("U");
  game.rotation = 1;
  game.player = 1;
  assert.strictEqual(game.place(1, 0), true);
  const ids = game.meepleSlots().map((slot) => slot.id);
  assert.ok(!ids.includes("road-0"));
  assert.ok(ids.includes("field-0"));
  assert.strictEqual(game.placeMeeple("road-0"), false);
  assert.ok(game.pendingMeeple);
  assert.strictEqual(game.skipMeeple(), true);
}

// Occupied field segment blocks further farmer placement on the same area.
{
  const game = createGame(mulberry32(12));
  game.board.clear();
  game.board.set("0,0", makePlaced("U", 0, {
    player: 0, color: "red", slot: "field-1", kind: "field", index: 1, x: 0.78, y: 0.5,
  }));
  game.meeples = [6, 7, 7, 7];
  game.current = makeTile("U");
  game.rotation = 0;
  game.player = 1;
  assert.strictEqual(game.place(1, 0), true);
  const ids = game.meepleSlots().map((slot) => slot.id);
  assert.ok(!ids.includes("field-0"));
  assert.ok(ids.includes("field-1"));
  assert.ok(ids.includes("road-0"));
  assert.strictEqual(isMeepleSlotOpen(game.board, 1, 0, { kind: "field", index: 0 }), false);
  assert.strictEqual(isMeepleSlotOpen(game.board, 1, 0, { kind: "field", index: 1 }), true);
  assert.strictEqual(game.placeMeeple("field-0"), false);
  assert.strictEqual(game.placeMeeple("field-1"), true);
  assert.strictEqual(game.board.get("1,0").meeple.kind, "field");
  assert.strictEqual(game.meeples[1], 6);
}

// Occupied incomplete city blocks another knight on the same city.
{
  const game = createGame(mulberry32(13));
  game.board.clear();
  // N+E elbow city occupied; extend with N+W elbow so the city stays open west/east? 
  // N at 0,0 (city N+E) + N at 1,0 rot0 also N+E does not join.
  // Use N at 0,0 and rotate a second N so W+S faces into E of first... N catalog is N+E.
  // Place M/N at 1,0 with rot 3: edges rotate — city edges abs W+N, joins E of first.
  game.board.set("0,0", makePlaced("N", 0, {
    player: 0, color: "red", slot: "city-0", kind: "city", index: 0, x: 0.68, y: 0.24,
  }));
  game.meeples = [6, 7, 7, 7];
  game.current = makeTile("N");
  game.rotation = 3;
  game.player = 1;
  assert.strictEqual(game.place(1, 0), true);
  const city = collectCityComponent(game.board, 1, 0, 0);
  assert.strictEqual(city.complete, false);
  assert.ok(city.parts.length >= 2);
  const ids = game.meepleSlots().map((slot) => slot.id);
  assert.ok(!ids.includes("city-0"));
  assert.ok(ids.includes("field-0"));
  assert.strictEqual(game.placeMeeple("city-0"), false);
  assert.strictEqual(game.skipMeeple(), true);
}

assert.strictEqual(MEEPLES_EACH, 7);

// Mid-game: pennant city (+2/flag) and tied majority both get full points.
{
  const game = createGame(mulberry32(20));
  game.board.clear();
  // Cap west and east of F (pennant bar) with E tiles → complete 3-tile city.
  game.board.set("0,0", makePlaced("F", 0, {
    player: 0, color: "red", slot: "city-0", kind: "city", index: 0, x: 0.5, y: 0.5,
  }));
  game.board.set("-1,0", makePlaced("E", 1, {
    player: 1, color: "blue", slot: "city-0", kind: "city", index: 0, x: 0.5, y: 0.18,
  }));
  game.board.set("1,0", makePlaced("E", 3));
  game.meeples = [6, 6, 7, 7];
  game.scores = [0, 0, 0, 0];
  const city = collectCityComponent(game.board, 0, 0, 0);
  assert.strictEqual(city.complete, true);
  assert.strictEqual(city.parts.length, 3);
  const summary = resolveCompletions(game, 0, 0);
  assert.strictEqual(summary.cities, 1);
  // 3 tiles * 2 + 1 pennant * 2 = 8 each (1–1 tie)
  assert.strictEqual(game.scores[0], 8);
  assert.strictEqual(game.scores[1], 8);
  assert.strictEqual(game.board.get("0,0").meeple, null);
  assert.strictEqual(game.board.get("-1,0").meeple, null);
  assert.strictEqual(game.board.get("0,0").leaveFx.earned, 8);
  assert.strictEqual(game.board.get("-1,0").leaveFx.earned, 8);
}

// End-game: incomplete road/city/monastery + field (3 per completed city) + meeple tiebreak.
{
  const game = createGame(mulberry32(21));
  game.board.clear();
  game.discards = [];
  game.deck = [];
  game.current = null;
  game.scores = [0, 0, 0, 0];
  // Incomplete road of 2 U tiles with red meeple.
  game.board.set("0,0", makePlaced("U", 1, {
    player: 0, color: "red", slot: "road-0", kind: "road", index: 0, x: 0.5, y: 0.5,
  }));
  game.board.set("1,0", makePlaced("U", 1));
  // Incomplete city E alone with blue meeple => 1 point.
  game.board.set("0,-2", makePlaced("E", 0, {
    player: 1, color: "blue", slot: "city-0", kind: "city", index: 0, x: 0.5, y: 0.18,
  }));
  // Incomplete monastery with 3 surrounding tiles => 4 points for green.
  game.board.set("3,3", makePlaced("B", 0, {
    player: 2, color: "green", slot: "monastery", kind: "monastery", index: null, x: 0.5, y: 0.4,
  }));
  game.board.set("4,3", makePlaced("E", 0));
  game.board.set("3,4", makePlaced("E", 2));
  game.board.set("2,3", makePlaced("E", 1));
  // Completed city of two E tiles, farmed by yellow on adjacent field of the south tile.
  game.board.set("5,0", makePlaced("E", 0));
  game.board.set("5,-1", makePlaced("E", 2, {
    player: 3, color: "yellow", slot: "field-0", kind: "field", index: 0, x: 0.5, y: 0.68,
  }));
  game.meeples = [6, 6, 6, 6];
  game.finishGame();
  assert.strictEqual(game.finished, true);
  assert.strictEqual(game.finalScored, true);
  assert.strictEqual(game.rankingOpen, true);
  assert.strictEqual(game.scores[0], 2, "incomplete road 2 tiles");
  assert.strictEqual(game.scores[1], 1, "incomplete city 1 tile");
  assert.strictEqual(game.scores[2], 4, "incomplete monastery 4 tiles");
  assert.strictEqual(game.scores[3], 3, "field with 1 completed city");
  assert.deepStrictEqual(game.standings, [2, 3, 0, 1]);
  // End scoring leaves meeples on the board with earned labels.
  assert.strictEqual(game.board.get("0,0").meeple.earned, 2);
  assert.strictEqual(game.board.get("0,-2").meeple.earned, 1);
  assert.strictEqual(game.board.get("3,3").meeple.earned, 4);
  assert.strictEqual(game.board.get("5,-1").meeple.earned, 3);
  assert.strictEqual(game.meeples[0], 6);
  assert.strictEqual(game.meeples[1], 6);
  assert.strictEqual(game.meeples[2], 6);
  assert.strictEqual(game.meeples[3], 6);
}

// Last-tile simulation leaves one placeable tile in hand.
{
  const last = simulateToLastTile(mulberry32(7));
  assert.ok(last.current, "last tile in hand");
  assert.strictEqual(last.deck.length, 0);
  assert.strictEqual(last.board.size, 71, "71 tiles on board before last place");
  assert.strictEqual(last.finished, false);
  assert.strictEqual(last.pendingDiscard, false);
  assert.ok(last.canPlaceAnywhere(last.current));
  assert.strictEqual(
    last.board.size + last.discards.length + 1,
    72
  );
}

// Custom player count (2–8) wires into scores / turn order.
{
  const duo = createGame(mulberry32(3), [
    { id: "orange", name: "Ora" },
    { id: "brown", name: "Br" },
  ]);
  assert.strictEqual(duo.players.length, 2);
  assert.strictEqual(duo.scores.length, 2);
  assert.strictEqual(duo.meeples.length, 2);
  assert.deepStrictEqual(
    normalizePlayers([{ id: "red", name: "TooLongName" }]),
    PLAYERS.map((p) => ({ id: p.id, name: p.name, bot: false, botStrength: null })),
    "below min falls back"
  );
  assert.strictEqual(COLOR_PALETTE.length >= PLAYERS_MAX, true);
  assert.strictEqual(PLAYERS_MIN, 2);
  const withBot = normalizePlayers([
    { id: "red", name: "A", bot: true, botStrength: "standard" },
    { id: "blue", name: "B" },
  ]);
  assert.strictEqual(withBot[0].bot, true);
  assert.strictEqual(withBot[0].botStrength, "standard");
  assert.strictEqual(withBot[0].name, "レックス");
  assert.strictEqual(botNameForColor("red", "en"), "Rex");
  assert.strictEqual(botNameForColor("red", "ja"), "レックス");
  assert.strictEqual(withBot[1].bot, false);
  assert.strictEqual(withBot[1].botStrength, null);
  assert.strictEqual(NAME_MAX, 10);
  assert.strictEqual(PLAYERS[0].name, "Player1");
  assert.strictEqual(nextPlayerName([{ name: "Player1" }, { name: "Player4" }]), "Player5");
  assert.strictEqual(nextPlayerName([]), "Player1");
}

// Start player is chosen at random from the roster.
{
  const starts = new Set();
  for (let seed = 100; seed < 140; seed++) {
    starts.add(createGame(mulberry32(seed), [
      { id: "red", name: "A" },
      { id: "blue", name: "B" },
      { id: "green", name: "C" },
      { id: "yellow", name: "D" },
    ]).player);
  }
  assert.ok(starts.size > 1, "start player should vary across seeds");
  assert.ok([...starts].every((p) => p >= 0 && p < 4));
}

// Serialize / restore keeps board, turn, and hand.
{
  const original = createGame(mulberry32(42), [
    { id: "red", name: "A" },
    { id: "blue", name: "B" },
  ]);
  original.current = makeTile("U");
  original.rotation = 1;
  assert.strictEqual(original.place(1, 0), true);
  const snap = serializeGame(original);
  const revived = restoreGame(snap);
  assert.ok(revived);
  assert.strictEqual(revived.board.size, original.board.size);
  assert.strictEqual(revived.player, original.player);
  assert.ok(revived.pendingMeeple);
  assert.strictEqual(revived.pendingMeeple.x, 1);
  assert.strictEqual(revived.board.get("1,0").id, "U");
  assert.strictEqual(revived.board.get("1,0").rot, 1);
  assert.deepStrictEqual(revived.scores, original.scores);
  assert.deepStrictEqual(revived.meeples, original.meeples);
}

// Ranking: equal score → more remaining meeples ranks higher.
{
  assert.deepStrictEqual(rankPlayers([10, 10, 8, 8], [3, 5, 7, 1]), [1, 0, 2, 3]);
}

const trapped = createGame(mulberry32(5));
trapped.board.clear();
trapped.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
trapped.deck = [makeTile("E"), makeTile("U")];
trapped.discards = [];
trapped.current = null;
trapped.finished = false;
trapped.player = 2;
assert.strictEqual(trapped.pull(), true);
assert.strictEqual(trapped.pendingDiscard, true);
assert.strictEqual(trapped.current.id, "U");
assert.deepStrictEqual(trapped.discards.map((tile) => tile.id), []);
assert.strictEqual(trapped.acknowledgeDiscard(), true);
assert.deepStrictEqual(trapped.discards.map((tile) => tile.id), ["U"]);
assert.strictEqual(trapped.pendingDiscard, false);
assert.strictEqual(trapped.current.id, "E");
assert.strictEqual(trapped.player, 2);
assert.strictEqual(trapped.canPlaceAnywhere(trapped.discards[0]), false);
assert.strictEqual(trapped.canPlaceAnywhere(trapped.current), true);
assert.strictEqual(trapped.deck.length, 0);
assert.strictEqual(stock(trapped), 3);

const dead = createGame(mulberry32(6));
dead.board.clear();
dead.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
dead.deck = [makeTile("U"), makeTile("V")];
dead.discards = [];
dead.current = null;
dead.finished = false;
assert.strictEqual(dead.pull(), true);
assert.strictEqual(dead.current.id, "V");
assert.strictEqual(dead.acknowledgeDiscard(), true);
assert.strictEqual(dead.pendingDiscard, true);
assert.strictEqual(dead.current.id, "U");
assert.strictEqual(dead.acknowledgeDiscard(), true);
assert.strictEqual(dead.finished, true);
assert.strictEqual(dead.current, null);
assert.strictEqual(dead.pendingDiscard, false);
assert.deepStrictEqual(dead.discards.map((tile) => tile.id), ["V", "U"]);
assert.strictEqual(dead.canPlaceAnywhere(dead.discards[0]), false);
assert.strictEqual(dead.canPlaceAnywhere(dead.discards[1]), false);

// Discard confirms one-by-one, keeps the turn, and preserves stock.
{
  const game = createGame(mulberry32(14));
  game.board.clear();
  game.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
  game.deck = [makeTile("E"), makeTile("V"), makeTile("U"), makeTile("X")];
  game.discards = [];
  game.current = null;
  game.finished = false;
  game.player = 0;
  const beforeStock = game.deck.length + game.board.size;
  assert.strictEqual(game.pull(), true);
  assert.strictEqual(game.current.id, "X");
  assert.strictEqual(game.acknowledgeDiscard(), true);
  assert.strictEqual(game.current.id, "U");
  assert.strictEqual(game.acknowledgeDiscard(), true);
  assert.strictEqual(game.current.id, "V");
  assert.strictEqual(game.acknowledgeDiscard(), true);
  assert.deepStrictEqual(game.discards.map((tile) => tile.id), ["X", "U", "V"]);
  assert.strictEqual(game.pendingDiscard, false);
  assert.strictEqual(game.current.id, "E");
  assert.strictEqual(game.player, 0);
  assert.strictEqual(game.finished, false);
  assert.strictEqual(game.deck.length, 0);
  assert.strictEqual(stock(game), beforeStock);
  for (const tile of game.discards) {
    assert.strictEqual(game.canPlaceAnywhere(tile), false, tile.id + " stays unplaceable");
  }
  assert.strictEqual(game.canPlaceAnywhere(game.current), true);
  assert.ok(game.hints().now.length + game.hints().later.length > 0);
}

// After place+skip, pull pauses on unplaceable X until OK.
{
  const game = createGame(mulberry32(15));
  game.board.clear();
  game.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
  game.deck = [makeTile("E"), makeTile("X")];
  game.discards = [];
  game.current = makeTile("E");
  game.rotation = 2;
  game.finished = false;
  game.player = 1;
  assert.strictEqual(game.place(0, -1), true);
  assert.strictEqual(game.skipMeeple(), true);
  assert.strictEqual(game.player, 2);
  assert.strictEqual(game.pendingDiscard, true);
  assert.strictEqual(game.current.id, "X");
  assert.deepStrictEqual(game.discards.map((tile) => tile.id), []);
  assert.strictEqual(game.acknowledgeDiscard(), true);
  assert.deepStrictEqual(game.discards.map((tile) => tile.id), ["X"]);
  assert.strictEqual(game.canPlaceAnywhere(game.discards[0]), false);
  assert.strictEqual(game.current.id, "E");
  assert.strictEqual(game.pendingDiscard, false);
  assert.strictEqual(game.finished, false);
}

// Softlock heal: last unplaceable tile in hand without pendingDiscard.
{
  const stuck = createGame(mulberry32(16));
  stuck.board.clear();
  stuck.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
  stuck.deck = [];
  stuck.discards = [];
  stuck.current = makeTile("U");
  stuck.pendingDiscard = false;
  stuck.finished = false;
  stuck.finalScored = false;
  stuck.rankingOpen = false;
  assert.strictEqual(stuck.canPlaceAnywhere(stuck.current), false);
  assert.strictEqual(stuck.reconcileHand(), true);
  assert.strictEqual(stuck.pendingDiscard, true);
  assert.strictEqual(stuck.current.id, "U");
  assert.strictEqual(stuck.acknowledgeDiscard(), true);
  assert.strictEqual(stuck.finished, true);
  assert.strictEqual(stuck.current, null);
  assert.deepStrictEqual(stuck.discards.map((tile) => tile.id), ["U"]);
}

// Last deck tile unplaceable → discard confirm → game ends.
{
  const last = createGame(mulberry32(17));
  last.board.clear();
  last.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
  last.deck = [makeTile("U")];
  last.discards = [];
  last.current = null;
  last.finished = false;
  last.finalScored = false;
  last.rankingOpen = false;
  assert.strictEqual(last.pull(), true);
  assert.strictEqual(last.pendingDiscard, true);
  assert.strictEqual(last.current.id, "U");
  assert.strictEqual(last.deck.length, 0);
  assert.strictEqual(last.acknowledgeDiscard(), true);
  assert.strictEqual(last.finished, true);
  assert.strictEqual(last.pendingDiscard, false);
  assert.strictEqual(last.current, null);
  assert.deepStrictEqual(last.discards.map((tile) => tile.id), ["U"]);
}

for (let seed = 1; seed <= 12; seed++) {
  const game = createGame(mulberry32(seed));
  let guard = 0;
  while (!game.finished) {
    takeTurn(game);
    assert.ok(++guard < 80);
  }
  assert.strictEqual(game.deck.length, 0);
  assert.strictEqual(game.current, null);
  assert.strictEqual(stock(game), 72);
  assert.deepStrictEqual(boardErrors(game.board), []);
  assert.strictEqual(game.board.get("0,0").id, "D");
  assert.strictEqual(game.board.get("0,0").rot, 0);
}

assert.ok(tileHTML("D", 1).includes("rot-90"));
assert.ok(tileHTML("U", 2).includes("rot-180"));
assert.ok(tileHTML("V", 3).includes("rot-270"));
assert.ok(tileHTML("E", 0).includes("city cap n"));
assert.ok(!tileHTML("B", 0).includes("rot-"));

// Bot chooses legal place/meeple actions and can finish a short game.
{
  const botGame = createGame(mulberry32(9), [
    { id: "red", name: "Hum", bot: false },
    { id: "blue", name: "CPU", bot: true, botStrength: "standard" },
  ]);
  assert.strictEqual(botGame.players[1].bot, true);
  const snap = serializeGame(botGame);
  const revived = restoreGame(snap);
  assert.strictEqual(revived.players[1].bot, true);
  assert.strictEqual(revived.players[1].botStrength, "standard");

  drainDiscards(botGame);
  const action = chooseBotAction(botGame, "standard");
  assert.ok(action);
  if (botGame.pendingDiscard) {
    assert.strictEqual(action.type, "discard");
  } else if (botGame.pendingMeeple) {
    assert.strictEqual(action.type, "meeple");
  } else {
    assert.strictEqual(action.type, "place");
    const edges = rotateEdges(botGame.current.edges, action.rot);
    assert.strictEqual(canPlace(botGame.board, action.x, action.y, edges), true);
  }
}

{
  const auto = createGame(mulberry32(21), [
    { id: "red", name: "A", bot: true, botStrength: "standard" },
    { id: "blue", name: "B", bot: true, botStrength: "standard" },
  ]);
  let guard = 0;
  while (!auto.finished && ++guard < 24) {
    while (auto.pendingDiscard) assert.ok(auto.acknowledgeDiscard());
    if (auto.finished) break;
    if (auto.pendingMeeple) {
      const action = chooseBotAction(auto, "standard");
      assert.ok(action && action.type === "meeple");
      if (action.slotId) assert.ok(auto.placeMeeple(action.slotId));
      else assert.ok(auto.skipMeeple());
      continue;
    }
    if (!auto.current) break;
    const action = chooseBotAction(auto, "standard");
    assert.ok(action && action.type === "place", "bot place on " + (auto.current && auto.current.id));
    auto.setRotation(action.rot);
    assert.ok(auto.place(action.x, action.y));
    if (action.slotId) assert.ok(auto.placeMeeple(action.slotId));
    else assert.ok(auto.skipMeeple());
  }
  assert.ok(auto.board.size >= 10, "bot should place multiple tiles");
  assert.deepStrictEqual(boardErrors(auto.board), []);
}

console.log("placement checks passed");
