import { MEEPLES_EACH, PLAYERS_MIN, normalizePlayers } from "./constants.js";
import { Game } from "./engine.js";
import { clonePlaced, makeTile } from "./tiles.js";

export const SAVE_VERSION = 1;


export function snapshotLooseTile(tile) {
  if (!tile) return null;
  return { id: tile.id, start: !!tile.start };
}


export function snapshotPlacedTile(tile) {
  if (!tile) return null;
  return {
    id: tile.id,
    start: !!tile.start,
    rot: tile.rot || 0,
    owner: tile.owner || null,
    meeple: tile.meeple ? Object.assign({}, tile.meeple) : null,
  };
}


export function revivePlacedTile(data) {
  const tile = clonePlaced(makeTile(data.id, data.start), data.rot || 0, data.owner || null);
  tile.meeple = data.meeple ? Object.assign({}, data.meeple) : null;
  return tile;
}


export function serializeGame(game) {
  return {
    v: SAVE_VERSION,
    players: game.players.map((player) => ({ id: player.id, name: player.name })),
    deck: game.deck.map(snapshotLooseTile),
    discards: game.discards.map(snapshotLooseTile),
    board: Array.from(game.board.entries()).map(([key, tile]) => [key, snapshotPlacedTile(tile)]),
    player: game.player,
    current: snapshotLooseTile(game.current),
    rotation: game.rotation,
    finished: !!game.finished,
    scores: game.scores.slice(),
    meeples: game.meeples.slice(),
    lastPlacedBy: Object.assign({}, game.lastPlacedBy),
    pendingMeeple: game.pendingMeeple ? Object.assign({}, game.pendingMeeple) : null,
    pendingDiscard: !!game.pendingDiscard,
    standings: game.standings.slice(),
    finalScored: !!game.finalScored,
    rankingOpen: !!game.rankingOpen,
  };
}


export function restoreGame(data) {
  if (!data || data.v !== SAVE_VERSION || !Array.isArray(data.board)) return null;
  const players = normalizePlayers(data.players);
  if (!players || players.length < PLAYERS_MIN) return null;
  const game = new Game((data.deck || []).map((tile) => makeTile(tile.id, tile.start)), players);
  game.board = new Map();
  for (const entry of data.board) {
    if (!entry || entry.length < 2 || !entry[1]) continue;
    game.board.set(entry[0], revivePlacedTile(entry[1]));
  }
  if (!game.board.size) return null;
  game.discards = (data.discards || []).map((tile) => makeTile(tile.id, tile.start));
  game.player = ((data.player % players.length) + players.length) % players.length;
  game.current = data.current ? makeTile(data.current.id, data.current.start) : null;
  game.rotation = ((data.rotation % 4) + 4) % 4;
  game.finished = !!data.finished;
  game.scores = players.map((_, index) => Number(data.scores && data.scores[index]) || 0);
  game.meeples = players.map((_, index) => {
    const value = data.meeples && data.meeples[index];
    return value == null ? MEEPLES_EACH : Number(value);
  });
  game.lastPlacedBy = Object.assign(
    Object.fromEntries(players.map((player) => [player.id, null])),
    data.lastPlacedBy || {}
  );
  game.pendingMeeple = data.pendingMeeple ? Object.assign({}, data.pendingMeeple) : null;
  game.pendingDiscard = !!data.pendingDiscard;
  game.standings = Array.isArray(data.standings)
    ? data.standings.slice()
    : players.map((_, index) => index);
  game.finalScored = !!data.finalScored;
  game.rankingOpen = !!data.rankingOpen;
  if (!game.finished) game.reconcileHand();
  return game;
}
