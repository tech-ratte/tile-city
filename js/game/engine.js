import { byPos, canPlace, openCells } from "./board.js";
import { MEEPLES_EACH, PLAYERS, normalizePlayers } from "./constants.js";
import { isMeepleSlotOpen } from "./features.js";
import { finalizeScores, resolveCompletions } from "./scoring.js";
import { buildTiles, clonePlaced, keyOf, listMeepleSlots, makeTile, rotateEdges } from "./tiles.js";

export function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}


export class Game {
  constructor(deck, players) {
    this.players = normalizePlayers(players);
    this.deck = deck;
    this.board = new Map();
    this.discards = [];
    this.player = 0;
    this.current = null;
    this.rotation = 0;
    this.finished = false;
    this.scores = this.players.map(() => 0);
    this.meeples = this.players.map(() => MEEPLES_EACH);
    this.lastPlacedBy = Object.fromEntries(this.players.map((player) => [player.id, null]));
    this.pendingMeeple = null;
    this.pendingDiscard = false;
    this.standings = this.players.map((_, index) => index);
    this.finalScored = false;
    this.rankingOpen = false;
  }

  placedEdges(rot) {
    return rotateEdges(this.current.edges, rot == null ? this.rotation : rot);
  }

  canPlaceAnywhere(tile) {
    if (!tile || !tile.edges) return false;
    for (const cell of openCells(this.board)) {
      for (let rot = 0; rot < 4; rot++) {
        if (canPlace(this.board, cell.x, cell.y, rotateEdges(tile.edges, rot))) return true;
      }
    }
    return false;
  }

  /**
   * Heal stuck hands: unplaceable current must be pendingDiscard.
   * Also resume a missing pull after restore / interrupted end.
   * Returns true when state changed.
   */
  reconcileHand() {
    if (this.finished || this.pendingMeeple) return false;
    if (this.current) {
      if (!this.canPlaceAnywhere(this.current)) {
        if (this.pendingDiscard) return false;
        this.pendingDiscard = true;
        this.rotation = 0;
        return true;
      }
      if (this.pendingDiscard) {
        this.pendingDiscard = false;
        return true;
      }
      return false;
    }
    if (this.pendingDiscard) {
      this.pendingDiscard = false;
    }
    this.pull();
    return true;
  }

  pull() {
    this.current = null;
    this.rotation = 0;
    this.pendingDiscard = false;
    while (this.deck.length) {
      const tile = this.deck.pop();
      if (this.canPlaceAnywhere(tile)) {
        this.current = tile;
        return false;
      }
      // Unplaceable — pause for confirm (including the final deck tile).
      this.pendingDiscard = true;
      this.current = tile;
      return true;
    }
    this.finishGame();
    return false;
  }

  finishGame() {
    this.pendingDiscard = false;
    this.pendingMeeple = null;
    this.current = null;
    if (this.finalScored) {
      this.finished = true;
      this.rankingOpen = true;
      return;
    }
    this.finished = true;
    this.finalScored = true;
    finalizeScores(this);
  }

  acknowledgeDiscard() {
    if (!this.pendingDiscard || !this.current) return false;
    this.discards.push(this.current);
    this.current = null;
    this.pendingDiscard = false;
    this.pull();
    return true;
  }

  hints() {
    const now = [];
    const later = [];
    if (!this.current || this.finished || this.pendingDiscard) return { now, later };
    for (const cell of openCells(this.board)) {
      const rots = [];
      for (let rot = 0; rot < 4; rot++) {
        if (canPlace(this.board, cell.x, cell.y, rotateEdges(this.current.edges, rot))) rots.push(rot);
      }
      if (!rots.length) continue;
      if (rots.includes(this.rotation)) now.push({ x: cell.x, y: cell.y });
      else later.push({ x: cell.x, y: cell.y, rots });
    }
    now.sort(byPos);
    later.sort(byPos);
    return { now, later };
  }

  rotationCounts() {
    const counts = [0, 0, 0, 0];
    if (!this.current || this.finished || this.pendingDiscard) return counts;
    for (const cell of openCells(this.board)) {
      for (let rot = 0; rot < 4; rot++) {
        if (canPlace(this.board, cell.x, cell.y, rotateEdges(this.current.edges, rot))) counts[rot] += 1;
      }
    }
    return counts;
  }

  bounds(pad) {
    const margin = pad == null ? 1 : pad;
    let minX = 0;
    let maxX = 0;
    let minY = 0;
    let maxY = 0;
    for (const key of this.board.keys()) {
      const [x, y] = key.split(",").map(Number);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return {
      minX: minX - margin,
      maxX: maxX + margin,
      minY: minY - margin,
      maxY: maxY + margin,
    };
  }

  rotate(delta) {
    if (this.finished || this.pendingMeeple || this.pendingDiscard || !this.current) return;
    this.rotation = (this.rotation + (delta % 4) + 4) % 4;
  }

  setRotation(rot) {
    if (this.finished || this.pendingMeeple || this.pendingDiscard || !this.current) return;
    this.rotation = ((rot % 4) + 4) % 4;
  }

  place(x, y) {
    if (this.finished || this.pendingMeeple || this.pendingDiscard || !this.current) return false;
    const edges = rotateEdges(this.current.edges, this.rotation);
    if (!canPlace(this.board, x, y, edges)) return false;
    const key = keyOf(x, y);
    const owner = this.players[this.player].id;
    this.board.set(key, clonePlaced(this.current, this.rotation, owner));
    const prevLastPlaced = this.lastPlacedBy[owner];
    this.lastPlacedBy[owner] = key;
    this.current = null;
    this.pendingMeeple = {
      x: x,
      y: y,
      player: this.player,
      prevLastPlaced: prevLastPlaced,
    };
    return true;
  }

  meepleSlots() {
    if (!this.pendingMeeple) return [];
    if (this.meeples[this.pendingMeeple.player] <= 0) return [];
    const x = this.pendingMeeple.x;
    const y = this.pendingMeeple.y;
    const tile = this.board.get(keyOf(x, y));
    if (!tile) return [];
    return listMeepleSlots(tile).filter((slot) => isMeepleSlotOpen(this.board, x, y, slot));
  }

  placeMeeple(slotId) {
    if (!this.pendingMeeple) return false;
    const player = this.pendingMeeple.player;
    if (this.meeples[player] <= 0) return false;
    const x = this.pendingMeeple.x;
    const y = this.pendingMeeple.y;
    const key = keyOf(x, y);
    const tile = this.board.get(key);
    if (!tile) return false;
    const slot = listMeepleSlots(tile).find((item) => item.id === slotId);
    if (!slot || !isMeepleSlotOpen(this.board, x, y, slot)) return false;
    tile.meeple = {
      player: player,
      color: this.players[player].id,
      slot: slot.id,
      kind: slot.kind,
      index: slot.index == null ? null : slot.index,
      x: slot.x,
      y: slot.y,
    };
    this.meeples[player] -= 1;
    this.finishMeeplePhase();
    return true;
  }

  skipMeeple() {
    if (!this.pendingMeeple) return false;
    this.finishMeeplePhase();
    return true;
  }

  undoPlace() {
    if (!this.pendingMeeple) return false;
    const pending = this.pendingMeeple;
    const key = keyOf(pending.x, pending.y);
    const tile = this.board.get(key);
    if (!tile) return false;
    this.board.delete(key);
    this.current = makeTile(tile.id, tile.start);
    this.rotation = tile.rot;
    this.player = pending.player;
    this.lastPlacedBy[this.players[pending.player].id] = pending.prevLastPlaced;
    this.pendingMeeple = null;
    this.finished = false;
    return true;
  }

  finishMeeplePhase() {
    if (!this.pendingMeeple) return;
    const x = this.pendingMeeple.x;
    const y = this.pendingMeeple.y;
    this.pendingMeeple = null;
    resolveCompletions(this, x, y);
    this.player = (this.player + 1) % this.players.length;
    this.pull();
  }
}


export function createGame(random, players) {
  const roll = random || Math.random;
  const tiles = buildTiles();
  const start = tiles.find((tile) => tile.start);
  const deck = shuffle(tiles.filter((tile) => !tile.start), roll);
  const game = new Game(deck, players);
  game.board.set("0,0", clonePlaced(start, 0));
  game.player = Math.floor(roll() * game.players.length);
  game.pull();
  return game;
}


// Auto-play until the final placeable tile is in hand (deck empty).
export function simulateToLastTile(random) {
  const game = createGame(random);
  let guard = 0;
  while (!game.finished && ++guard < 120) {
    while (game.pendingDiscard) {
      if (!game.acknowledgeDiscard()) break;
    }
    if (game.finished || !game.current) break;
    if (game.deck.length === 0) return game;
    for (let i = 0; i < 4 && game.hints().now.length === 0; i++) game.rotate(1);
    const cell = game.hints().now[0];
    if (!cell) break;
    if (!game.place(cell.x, cell.y)) break;
    const slots = game.meepleSlots();
    if (slots.length) game.placeMeeple(slots[0].id);
    else if (!game.skipMeeple()) break;
  }
  return game;
}
