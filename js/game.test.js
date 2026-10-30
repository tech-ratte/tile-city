const assert = require("assert");
const {
  TYPES,
  PLAYERS,
  buildTiles,
  makeTile,
  rotateEdges,
  canPlace,
  boardErrors,
  tileHTML,
  edgeText,
  listMeepleSlots,
  MEEPLE_LAYOUTS,
  createGame,
} = require("./game.js");

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

function takeTurn(game) {
  assert.ok(!game.finished);
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
placed.current = makeTile("U");
placed.rotation = 1;
assert.strictEqual(placed.place(1, 0), true);
assert.strictEqual(placed.board.get("1,0").rot, 1);
assert.deepStrictEqual(placed.board.get("1,0").edges, ["R", "F", "R", "F"]);
assert.ok(placed.pendingMeeple);
assert.strictEqual(placed.player, 0);
assert.ok(placed.meepleSlots().some((slot) => slot.kind === "road"));
assert.strictEqual(placed.skipMeeple(), true);
assert.notStrictEqual(placed.player, 0);

const withMeeple = createGame(mulberry32(4));
withMeeple.current = makeTile("U");
withMeeple.rotation = 1;
assert.strictEqual(withMeeple.place(1, 0), true);
const roadSlot = withMeeple.meepleSlots().find((slot) => slot.kind === "road");
assert.ok(roadSlot);
assert.strictEqual(withMeeple.placeMeeple(roadSlot.id), true);
assert.strictEqual(withMeeple.board.get("1,0").meeple.slot, roadSlot.id);
assert.strictEqual(withMeeple.meeples[0], 6);
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
undoGame.current = makeTile("U");
undoGame.rotation = 1;
assert.strictEqual(undoGame.place(1, 0), true);
assert.strictEqual(undoGame.undoPlace(), true);
assert.strictEqual(undoGame.pendingMeeple, null);
assert.strictEqual(undoGame.current.id, "U");
assert.strictEqual(undoGame.rotation, 1);
assert.strictEqual(undoGame.player, 0);
assert.ok(!undoGame.board.has("1,0"));

const trapped = createGame(mulberry32(5));
trapped.board.clear();
trapped.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
trapped.deck = [makeTile("E"), makeTile("U")];
trapped.discards = [];
trapped.current = null;
trapped.finished = false;
trapped.player = 2;
trapped.pull();
assert.deepStrictEqual(trapped.discards.map((tile) => tile.id), ["U"]);
assert.strictEqual(trapped.current.id, "E");
assert.strictEqual(trapped.player, 2);
assert.ok(trapped.note.includes("U"));
assert.ok(trapped.note.includes("緑"));

const dead = createGame(mulberry32(6));
dead.board.clear();
dead.board.set("0,0", Object.assign(makeTile("C"), { rot: 0 }));
dead.deck = [makeTile("U"), makeTile("V")];
dead.discards = [];
dead.current = null;
dead.finished = false;
dead.pull();
assert.strictEqual(dead.finished, true);
assert.strictEqual(dead.current, null);
assert.deepStrictEqual(dead.discards.map((tile) => tile.id), ["V", "U"]);

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

console.log("placement checks passed");
