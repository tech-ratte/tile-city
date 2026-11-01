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

export const BOT_WEIGHTS = {
  standard: {
    immediateSelf: 1.0,
    immediateOpp: 0.85,
    endSelf: 0.55,
    endOpp: 0.45,
    meepleReturn: 0.35,
    equity: 0.25,
    gift: 0.4,
    enemyCompleteGift: 6.0,
    openWaste: 1.5,
    earlyFieldBan: 3.0,
    skipMonastery: 2.5,
  },
};

const FIELD_PHASE = { early: 0.15, mid: 0.45, late: 1.0, end: 1.2 };
const DECK_CUT = { early: 48, late: 24, end: 8 };

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

function stockPenalty(stock, immediateSelf) {
  if (immediateSelf >= 4) return 0;
  if (stock >= 4) return 0;
  if (stock === 3) return 0.4;
  if (stock === 2) return 1.0;
  if (stock === 1) return 2.0;
  return 0;
}

function fieldAllowed(phase, completedCities, stock) {
  if (phase === "early") return false;
  if (phase === "mid") return completedCities >= 2 && stock >= 3;
  return completedCities >= 1 || stock >= 2;
}

function meepleOptions(game, phase) {
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
      if (!fieldAllowed(phase, cities, stock)) continue;
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
  const cityBonus = phase === "early" ? 1.15 : 1;
  const roadBonus = phase === "early" ? 0.85 : 1;
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
      const completeBonus = openings <= 1 ? 1.2 : openings === 2 ? 0.9 : 0.5;
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
      const value = tiles * (openings <= 1 ? 0.8 : 0.4) * roadBonus;
      if (winners.includes(me)) equity += value;
      else gift += value;
    });
    if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery" && !monasteryComplete(board, x, y)) {
      const filled = monasteryTileCount(board, x, y);
      const value = filled * 0.7 + (9 - filled) * 0.35;
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

  return {
    equity: equity * weights.equity,
    gift: gift * weights.gift,
  };
}

function openWastePenalty(beforeBoard, afterBoard, x, y, me, weights) {
  const tile = afterBoard.get(keyOf(x, y));
  if (!tile || !tile.cities) return 0;
  let penalty = 0;
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
    if (afterOpen > beforeOpen) penalty += weights.openWaste;
  });
  return penalty;
}

function betterScore(scored, place, best) {
  if (!best) return true;
  if (scored.value !== best.scored.value) return scored.value > best.scored.value;
  if (scored.immSelf !== best.scored.immSelf) return scored.immSelf > best.scored.immSelf;
  if (scored.returned !== best.scored.returned) return scored.returned > best.scored.returned;
  if (scored.stock !== best.scored.stock) return scored.stock > best.scored.stock;
  if (!place || !best.place) return false;
  return place.y < best.place.y || (place.y === best.place.y && place.x < best.place.x);
}

function evaluateApplied(before, after, me, weights, phase, placed, meepleUsed, stockBefore, optionKind, endBefore, deep) {
  const n = before.players.length;
  const immSelf = scoreDelta(before.scores, after.scores, me);
  const immOpp = bestOppDelta(before.scores, after.scores, me, n);
  const returned = Math.max(0, after.meeples[me] - (stockBefore - (meepleUsed ? 1 : 0)));
  const eg = equityAndGift(after, me, weights, phase);
  let value =
    weights.immediateSelf * immSelf -
    weights.immediateOpp * immOpp +
    weights.meepleReturn * returned +
    eg.equity -
    eg.gift;

  if (deep && endBefore) {
    const endAfter = projectedScores(after);
    const endSelf = scoreDelta(endBefore, endAfter, me);
    const endOpp = bestOppDelta(endBefore, endAfter, me, n);
    value +=
      weights.endSelf * (endSelf - immSelf) -
      weights.endOpp * (endOpp - immOpp);
  }

  if (immOpp > 0 && immSelf <= 0) value -= weights.enemyCompleteGift;
  if (meepleUsed) value -= stockPenalty(stockBefore, immSelf);
  if (placed) {
    value -= openWastePenalty(before.board, after.board, placed.x, placed.y, me, weights);
    const tile = after.board.get(keyOf(placed.x, placed.y));
    if (tile && tile.monastery && meepleUsed && optionKind && optionKind !== "monastery") {
      value -= weights.skipMonastery;
    }
    if (optionKind === "field" && (phase === "early" || (phase === "mid" && stockBefore <= 2))) {
      value -= weights.earlyFieldBan;
    }
  }

  return {
    value: value,
    immSelf: immSelf,
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

function considerOption(best, scored, place, slotId) {
  const candidate = { place: place, slotId: slotId, scored: scored };
  return betterScore(scored, place, best) ? candidate : best;
}

function applyMeepleChoice(game, slotId) {
  const after = cloneGame(game);
  if (slotId) {
    if (!after.placeMeeple(slotId)) return null;
  } else if (!after.skipMeeple()) {
    return null;
  }
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
  const tuned = Object.assign({}, weights, {
    endSelf: weights.endSelf * endMul,
    endOpp: weights.endOpp * endMul,
  });
  const endBefore = projectedScores(game);

  if (game.pendingMeeple) {
    const me = game.pendingMeeple.player;
    const place = { x: game.pendingMeeple.x, y: game.pendingMeeple.y, rot: 0 };
    const stockBefore = game.meeples[me];
    const shortlist = [];
    for (const option of meepleOptions(game, phase)) {
      const after = applyMeepleChoice(game, option.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game, after, me, tuned, phase, place, !!option.slotId, stockBefore, option.kind, endBefore, false
      );
      shortlist.push({ slotId: option.slotId, kind: option.kind, scored: scored });
    }
    shortlist.sort((a, b) => b.scored.value - a.scored.value);
    let best = null;
    for (const item of shortlist.slice(0, DEEP_CANDIDATE_LIMIT)) {
      const after = applyMeepleChoice(game, item.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game, after, me, tuned, phase, place, !!item.slotId, stockBefore, item.kind, endBefore, true
      );
      best = considerOption(best, scored, place, item.slotId);
    }
    return { type: "meeple", slotId: best ? best.slotId : null };
  }

  if (!game.current) return null;
  const me = game.player;
  const stockBefore = game.meeples[me];
  const placements = listPlacements(game);
  const shortlist = [];

  for (const place of placements) {
    const placedOnly = cloneGame(game);
    placedOnly.setRotation(place.rot);
    if (!placedOnly.place(place.x, place.y)) continue;
    for (const option of meepleOptions(placedOnly, phase)) {
      const after = applyMeepleChoice(placedOnly, option.slotId);
      if (!after) continue;
      const scored = evaluateApplied(
        game, after, me, tuned, phase, place, !!option.slotId, stockBefore, option.kind, endBefore, false
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
      game, after, me, tuned, phase, item.place, !!item.slotId, stockBefore, item.kind, endBefore, true
    );
    best = considerOption(best, scored, item.place, item.slotId);
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
