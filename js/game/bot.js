import { openCells, canPlace } from "./board.js";
import {
  absDir,
  collectCityComponent,
  collectFieldComponent,
  collectRoadComponent,
  findCityIndexByAbsEdge,
  findRoadIndexByAbsEdge,
  monasteryComplete,
} from "./features.js";
import {
  cityPennantCount,
  completedCitiesTouchingField,
  finalizeScores,
  majorityPlayers,
  meepleCountsOnFeature,
  monasteryTileCount,
  uniqueTileCount,
} from "./scoring.js";
import { DIR_INDEX, NEI, OPP_DIR } from "./constants.js";
import { keyOf, rotateEdges } from "./tiles.js";
import { serializeGame, restoreGame } from "./persist.js";
import { futureDrawsFor, masterExtraScore, masterFieldAllowed } from "./botMaster.js";

/**
 * Bot evaluation weights.
 * Convention: every term is added as `weight * amount`.
 * Positive = reward, negative = penalty. Do not abs() these in scoring.
 *
 * standard — scoring / economy + last-turn flexibility
 * master   — docs/bot-master.md v3 (EV / join / lag-deny / L2)
 */
const STANDARD_WEIGHTS = {
  immediateSelf: 1.0,
  endSelf: 0.70,
  meepleReturn: 0.45,
  equity: 0.40,
  openClose: 1.25,
  exclusiveComplete: 0.22,
  immediateOpp: -0.85,
  endOpp: -0.45,
  sharedOppScale: 0.3,
  gift: -0.4,
  enemyCompleteGift: -6.0,
  openWaste: -1.5,
  earlyFieldBan: -3.0,
  skipMonastery: -2.5,
  oppLeadGift: -0.35,
  isMaster: false,
};

export const BOT_WEIGHTS = {
  standard: STANDARD_WEIGHTS,
  master: Object.assign({}, STANDARD_WEIGHTS, {
    isMaster: true,
    // Keep base scoring close to standard so extras cannot overturn free points.
    equity: 0.35,
    gift: -0.35,
    enemyCompleteGift: -7.0,
    // Master extras — small deltas only (see extraPosCap / extraNegCap).
    evSelf: 0.18,
    supplyOpp: -0.2,
    joinOk: 0.25,
    joinFail: -0.5,
    joinCityMin: 3,
    joinRoadMin: 3,
    joinFieldMin: 2,
    lagRef: 12,
    denyBlock: 0.45,
    denyFatten: -0.35,
    deadClaim: -2.5,
    monasteryPush: 0.85,
    monasteryClaim: 2.2,
    extraPosCap: 4.5,
    extraNegCap: -7,
  }),
};

/**
 * How many turns this seat still gets after finishing the current placement.
 * (Remaining deck draws for `me`, excluding the tile already in hand.)
 */
export function turnsAfterThis(game, me) {
  const draws = futureDrawsFor(game, me);
  if (game.current && game.player === me) return Math.max(0, draws - 1);
  return draws;
}

const FIELD_PHASE = { early: 0.15, mid: 0.45, late: 1.0, end: 1.2 };
const DECK_CUT = { early: 48, late: 24, end: 8 };

/** Equity formula knobs (not in BOT_WEIGHTS; tune role of city / road / monastery). */
const EQUITY_TUNING = {
  cityOpen1: 1.2,
  cityOpen2: 0.9,
  cityOpen3Plus: 0.85,
  cityMul: 1.25,
  roadMul: 0.75,
  roadOpen1: 0.8,
  roadOpen2Plus: 0.4,
  monasteryFilled: 1.0,
  monasteryEmpty: 0.35,
  earlyCityMul: 1.15,
  earlyRoadMul: 0.85,
};

export function cloneGame(game) {
  return restoreGame(serializeGame(game));
}

export function deckPhase(remaining) {
  if (remaining <= DECK_CUT.end) return "end";
  if (remaining <= DECK_CUT.late) return "late";
  if (remaining <= DECK_CUT.early) return "mid";
  return "early";
}

function projectedScores(game) {
  const clone = cloneGame(game);
  if (!clone.finalScored) finalizeScores(clone);
  return clone.scores.slice();
}

function scoreDelta(before, after, index) {
  return (after[index] || 0) - (before[index] || 0);
}

function bestOppDelta(before, after, me, playerCount) {
  let best = 0;
  for (let i = 0; i < playerCount; i++) {
    if (i === me) continue;
    const delta = scoreDelta(before, after, i);
    if (delta > best) best = delta;
  }
  return best;
}

/**
 * Apply oppWeight to opponent gain.
 * If self also gained, only sharedOppScale of the overlapping (shared) portion
 * is counted; opponent-only excess still gets the full weight.
 */
function scaledOppTerm(selfGain, oppGain, oppWeight, sharedScale) {
  if (!(oppGain > 0) || !oppWeight) return 0;
  if (!(selfGain > 0)) return oppWeight * oppGain;
  const scale = sharedScale == null ? 1 : sharedScale;
  const shared = Math.min(selfGain, oppGain);
  const oppExtra = Math.max(0, oppGain - selfGain);
  return oppWeight * (oppExtra + shared * scale);
}

function countOpenEdges(board, kind, parts) {
  let open = 0;
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile) {
      open += 1;
      continue;
    }
    const rot = tile.rot || 0;
    if (kind === "city") {
      const city = tile.cities && tile.cities[part.index];
      if (!city) {
        open += 1;
        continue;
      }
      for (const catalogDir of city.edges) {
        const dir = absDir(catalogDir, rot);
        const step = NEI[DIR_INDEX[dir]];
        const neighbor = board.get(keyOf(part.x + step.dx, part.y + step.dy));
        if (!neighbor || findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]) < 0) open += 1;
      }
    } else if (kind === "road") {
      const road = tile.roads && tile.roads[part.index];
      if (!road) {
        open += 1;
        continue;
      }
      for (const catalogDir of road) {
        const dir = absDir(catalogDir, rot);
        const step = NEI[DIR_INDEX[dir]];
        const neighbor = board.get(keyOf(part.x + step.dx, part.y + step.dy));
        if (!neighbor || findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]) < 0) open += 1;
      }
    }
  }
  return open;
}

function featureMajority(board, kind, parts, playerCount) {
  return majorityPlayers(meepleCountsOnFeature(board, kind, parts, playerCount));
}

function stockPenalty(stock, immediateSelf, turnsAfter) {
  if (immediateSelf >= 4) return 0;
  if (turnsAfter <= 0) return 0; // last turn: unused meeples score nothing
  let raw = 0;
  if (stock >= 4) raw = 0;
  else if (stock === 3) raw = 0.4;
  else if (stock === 2) raw = 1.0;
  else if (stock === 1) raw = 2.5;
  // Fewer future turns → weaker hoarding pressure.
  return raw * Math.min(1, turnsAfter / 3);
}

function fieldAllowed(phase, completedCities, stock, master, turnsAfter) {
  if (completedCities <= 0) return false;
  if (turnsAfter <= 0) return true;
  if (master) return masterFieldAllowed(phase, completedCities, stock, turnsAfter);
  if (phase === "early") return false;
  if (phase === "mid") return completedCities >= 2 && stock >= 2;
  return true;
}

function meepleOptions(game, phase, master, turnsAfter) {
  const options = [{ slotId: null, kind: null }];
  if (!game.pendingMeeple) return options;
  const stock = game.meeples[game.pendingMeeple.player];
  if (stock <= 0) return options;
  const x = game.pendingMeeple.x;
  const y = game.pendingMeeple.y;
  for (const slot of game.meepleSlots()) {
    if (slot.kind === "field") {
      const field = collectFieldComponent(game.board, x, y, slot.index);
      const cities = completedCitiesTouchingField(game.board, field.parts);
      if (!fieldAllowed(phase, cities, stock, master, turnsAfter)) continue;
      options.push({ slotId: slot.id, kind: slot.kind, cities: cities });
      continue;
    }
    options.push({ slotId: slot.id, kind: slot.kind });
  }
  return options;
}

function equityAndGift(game, me, weights, phase) {
  let equity = 0;
  let gift = 0;
  const board = game.board;
  const n = game.players.length;
  const seenCities = new Set();
  const seenRoads = new Set();
  const seenFields = new Set();
  const t = EQUITY_TUNING;
  const cityBonus = (phase === "early" ? t.earlyCityMul : 1) * t.cityMul;
  const roadBonus = (phase === "early" ? t.earlyRoadMul : 1) * t.roadMul;
  const fieldPhase = FIELD_PHASE[phase] || FIELD_PHASE.mid;

  for (const [pos, tile] of board) {
    const [x, y] = pos.split(",").map(Number);
    (tile.cities || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenCities.has(seed)) return;
      const result = collectCityComponent(board, x, y, index);
      for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
      if (result.complete) return;
      const winners = featureMajority(board, "city", result.parts, n);
      if (!winners.length) return;
      const tiles = uniqueTileCount(result.parts);
      const pennants = cityPennantCount(board, result.parts);
      const openings = countOpenEdges(board, "city", result.parts);
      const completeBonus = openings <= 1 ? t.cityOpen1 : openings === 2 ? t.cityOpen2 : t.cityOpen3Plus;
      const value = (tiles + pennants) * completeBonus * cityBonus;
      if (winners.includes(me)) equity += value;
      else gift += value;
    });
    (tile.roads || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenRoads.has(seed)) return;
      const result = collectRoadComponent(board, x, y, index);
      for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
      if (result.complete) return;
      const winners = featureMajority(board, "road", result.parts, n);
      if (!winners.length) return;
      const tiles = uniqueTileCount(result.parts);
      const openings = countOpenEdges(board, "road", result.parts);
      const value = tiles * (openings <= 1 ? t.roadOpen1 : t.roadOpen2Plus) * roadBonus;
      if (winners.includes(me)) equity += value;
      else gift += value;
    });
    if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery" && !monasteryComplete(board, x, y)) {
      const filled = monasteryTileCount(board, x, y);
      const value = filled * t.monasteryFilled + (9 - filled) * t.monasteryEmpty;
      if (tile.meeple.player === me) equity += value;
      else gift += value;
    }
    if (tile.meeple && tile.meeple.kind === "field") {
      const seed = x + "," + y + "," + tile.meeple.index;
      if (seenFields.has(seed)) continue;
      const result = collectFieldComponent(board, x, y, tile.meeple.index);
      for (const part of result.parts) seenFields.add(part.x + "," + part.y + "," + part.index);
      const winners = featureMajority(board, "field", result.parts, n);
      if (!winners.length) continue;
      const cities = completedCitiesTouchingField(board, result.parts);
      const value = cities * 3 * fieldPhase;
      if (winners.includes(me)) equity += value;
      else gift += value;
    }
  }

  // weights.equity > 0, weights.gift < 0 — both are added as-is later.
  return {
    equity: equity * weights.equity,
    gift: gift * weights.gift,
  };
}

/**
 * Own-city opening deltas on the placed tile:
 * openWaste (neg) when openings increase, openClose (pos) when they shrink.
 */
function cityOpeningDeltaScore(beforeBoard, afterBoard, x, y, me, weights) {
  const tile = afterBoard.get(keyOf(x, y));
  if (!tile || !tile.cities) return 0;
  let openingsIncreased = 0;
  let openingsReduced = 0;
  tile.cities.forEach((_, index) => {
    const after = collectCityComponent(afterBoard, x, y, index);
    if (after.complete) return;
    const winners = featureMajority(afterBoard, "city", after.parts, 8);
    if (!winners.includes(me)) return;
    if (uniqueTileCount(after.parts) <= 1) return;
    const beforeParts = after.parts.filter((part) => !(part.x === x && part.y === y));
    if (!beforeParts.length) return;
    const afterOpen = countOpenEdges(afterBoard, "city", after.parts);
    const beforeOpen = countOpenEdges(beforeBoard, "city", beforeParts);
    if (afterOpen > beforeOpen) openingsIncreased += afterOpen - beforeOpen;
    else if (afterOpen < beforeOpen) openingsReduced += beforeOpen - afterOpen;
  });
  const close = weights.openClose || 0;
  return weights.openWaste * openingsIncreased + close * openingsReduced;
}

function betterScore(scored, place, best, lastTurn) {
  if (!best) return true;
  if (scored.value !== best.scored.value) return scored.value > best.scored.value;
  if (scored.immSelf !== best.scored.immSelf) return scored.immSelf > best.scored.immSelf;
  if (scored.returned !== best.scored.returned) return scored.returned > best.scored.returned;
  if (scored.stock !== best.scored.stock) {
    // Last turn: prefer spending meeples. Otherwise prefer keeping stock.
    return lastTurn ? scored.stock < best.scored.stock : scored.stock > best.scored.stock;
  }
  if (!place || !best.place) return false;
  return place.y < best.place.y || (place.y === best.place.y && place.x < best.place.x);
}

function evaluateApplied(
  before,
  after,
  me,
  weights,
  phase,
  placed,
  meepleUsed,
  stockBefore,
  optionKind,
  endBefore,
  deep,
  turnsAfter
) {
  const n = before.players.length;
  const immSelf = scoreDelta(before.scores, after.scores, me);
  const immOpp = bestOppDelta(before.scores, after.scores, me, n);
  const returned = Math.max(0, after.meeples[me] - (stockBefore - (meepleUsed ? 1 : 0)));
  const eg = equityAndGift(after, me, weights, phase);
  const sharedScale = weights.sharedOppScale == null ? 1 : weights.sharedOppScale;
  const lastTurn = turnsAfter <= 0;

  // All BOT_WEIGHTS terms are added (penalties are already negative).
  let value =
    weights.immediateSelf * immSelf +
    scaledOppTerm(immSelf, immOpp, weights.immediateOpp, sharedScale) +
    weights.meepleReturn * returned +
    eg.equity +
    eg.gift;

  if (deep && endBefore) {
    const endAfter = projectedScores(after);
    const endSelf = scoreDelta(endBefore, endAfter, me);
    const endOpp = bestOppDelta(endBefore, endAfter, me, n);
    const latSelf = endSelf - immSelf;
    const latOpp = endOpp - immOpp;
    value +=
      weights.endSelf * latSelf +
      scaledOppTerm(latSelf, latOpp, weights.endOpp, sharedScale);
  }

  // Free points: take exclusive completions over weak progress elsewhere.
  if (immSelf >= 4 && immOpp <= 0 && weights.exclusiveComplete) {
    value += weights.exclusiveComplete * immSelf;
  }

  // Shared but lopsided: you score a little, opponent scores a lot.
  if (immSelf > 0 && immOpp > immSelf && weights.oppLeadGift) {
    value += weights.oppLeadGift * (immOpp - immSelf);
  }

  if (immOpp > 0 && immSelf <= 0) value += weights.enemyCompleteGift;
  if (meepleUsed) value -= stockPenalty(stockBefore, immSelf, turnsAfter);
  if (placed) {
    value += cityOpeningDeltaScore(before.board, after.board, placed.x, placed.y, me, weights);
    const tile = after.board.get(keyOf(placed.x, placed.y));
    if (tile && tile.monastery && meepleUsed && optionKind && optionKind !== "monastery") {
      value += weights.skipMonastery;
    }
    // Soft field cost — never hard-ban on last turn / late end.
    if (optionKind === "field" && !lastTurn) {
      if (phase === "early") value += weights.earlyFieldBan;
      else if (phase === "mid" && stockBefore <= 2) value += weights.earlyFieldBan * 0.5;
    }
  }

  if (weights.isMaster) {
    value += masterExtraScore({
      before: before,
      after: after,
      me: me,
      weights: weights,
      placed: placed,
      countOpenEdges: countOpenEdges,
      turnsAfter: turnsAfter,
    });
  }

  return {
    value: value,
    immSelf: immSelf,
    immOpp: immOpp,
    returned: returned,
    stock: after.meeples[me],
  };
}

const DEEP_CANDIDATE_LIMIT = 10;

function listPlacements(game) {
  const out = [];
  if (!game.current) return out;
  for (let rot = 0; rot < 4; rot++) {
    const edges = rotateEdges(game.current.edges, rot);
    for (const cell of openCells(game.board)) {
      if (!canPlace(game.board, cell.x, cell.y, edges)) continue;
      out.push({ rot: rot, x: cell.x, y: cell.y });
    }
  }
  return out;
}

function considerOption(best, scored, place, slotId, lastTurn) {
  const candidate = { place: place, slotId: slotId, scored: scored };
  return betterScore(scored, place, best, lastTurn) ? candidate : best;
}

function finishIfConfirm(game) {
  if (game.pendingConfirm && !game.confirmTurnEnd()) return false;
  return true;
}

function applyMeepleChoice(game, slotId) {
  const after = cloneGame(game);
  if (slotId) {
    if (!after.placeMeeple(slotId)) return null;
  } else if (!after.skipMeeple()) {
    return null;
  }
  if (!finishIfConfirm(after)) return null;
  return after;
}

function applyPlaceChoice(game, place, slotId) {
  const placed = cloneGame(game);
  placed.setRotation(place.rot);
  if (!placed.place(place.x, place.y)) return null;
  if (slotId) {
    if (!placed.placeMeeple(slotId)) return null;
  } else if (!placed.skipMeeple()) {
    return null;
  }
  if (!finishIfConfirm(placed)) return null;
  return placed;
}

/**
 * Choose a bot action for the current game state.
 * @returns {{ type: "discard" } | { type: "meeple", slotId: string|null } | { type: "place", rot: number, x: number, y: number, slotId: string|null } | null}
 */
export function chooseBotAction(game, strength) {
  const level = strength && BOT_WEIGHTS[strength] ? strength : "standard";
  const weights = BOT_WEIGHTS[level];
  if (!game || game.finished) return null;
  if (game.pendingDiscard) return { type: "discard" };

  const phase = deckPhase(game.deck.length);
  const endMul = phase === "end" ? 1.15 : 1;
  const endBefore = projectedScores(game);
  const master = !!weights.isMaster;

  if (game.pendingMeeple) {
    const me = game.pendingMeeple.player;
    const turnsAfter = turnsAfterThis(game, me);
    const lastTurn = turnsAfter <= 0;
    const tuned = Object.assign({}, weights, {
      endSelf: weights.endSelf * endMul * (lastTurn ? 1.5 : 1),
      endOpp: weights.endOpp * endMul,
      equity: weights.equity * (lastTurn ? 1.25 : 1),
    });
    const place = { x: game.pendingMeeple.x, y: game.pendingMeeple.y, rot: 0 };
    const stockBefore = game.meeples[me];
    const shortlist = [];
    for (const option of meepleOptions(game, phase, master, turnsAfter)) {
      const after = applyMeepleChoice(game, option.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game, after, me, tuned, phase, place, !!option.slotId, stockBefore, option.kind, endBefore, false, turnsAfter
      );
      shortlist.push({ slotId: option.slotId, kind: option.kind, scored: scored });
    }
    shortlist.sort((a, b) => b.scored.value - a.scored.value);
    let best = null;
    for (const item of shortlist.slice(0, DEEP_CANDIDATE_LIMIT)) {
      const after = applyMeepleChoice(game, item.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game, after, me, tuned, phase, place, !!item.slotId, stockBefore, item.kind, endBefore, true, turnsAfter
      );
      best = considerOption(best, scored, place, item.slotId, lastTurn);
    }
    return { type: "meeple", slotId: best ? best.slotId : null };
  }

  if (!game.current) return null;
  const me = game.player;
  const turnsAfter = turnsAfterThis(game, me);
  const lastTurn = turnsAfter <= 0;
  const tuned = Object.assign({}, weights, {
    endSelf: weights.endSelf * endMul * (lastTurn ? 1.5 : 1),
    endOpp: weights.endOpp * endMul,
    equity: weights.equity * (lastTurn ? 1.25 : 1),
  });
  const stockBefore = game.meeples[me];
  const placements = listPlacements(game);
  const shortlist = [];

  for (const place of placements) {
    const placedOnly = cloneGame(game);
    placedOnly.setRotation(place.rot);
    if (!placedOnly.place(place.x, place.y)) continue;
    for (const option of meepleOptions(placedOnly, phase, master, turnsAfter)) {
      const after = applyMeepleChoice(placedOnly, option.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game, after, me, tuned, phase, place, !!option.slotId, stockBefore, option.kind, endBefore, false, turnsAfter
      );
      shortlist.push({
        place: place,
        slotId: option.slotId,
        kind: option.kind,
        scored: scored,
      });
    }
  }

  shortlist.sort((a, b) => b.scored.value - a.scored.value || b.scored.immSelf - a.scored.immSelf);
  let best = null;
  for (const item of shortlist.slice(0, DEEP_CANDIDATE_LIMIT)) {
    const after = applyPlaceChoice(game, item.place, item.slotId);
    if (!after) continue;
    const scored = evaluateApplied(
      game, after, me, tuned, phase, item.place, !!item.slotId, stockBefore, item.kind, endBefore, true, turnsAfter
    );
    best = considerOption(best, scored, item.place, item.slotId, lastTurn);
  }

  if (!best) {
    const fallback = placements[0];
    if (!fallback) return null;
    return { type: "place", rot: fallback.rot, x: fallback.x, y: fallback.y, slotId: null };
  }
  return {
    type: "place",
    rot: best.place.rot,
    x: best.place.x,
    y: best.place.y,
    slotId: best.slotId,
  };
}

export function isBotPlayer(player) {
  return !!(player && player.bot);
}
