import { FIELD_CITY_TOUCH } from "./catalog.js";
import { collectCityComponent, collectFieldComponent, collectRoadComponent, fieldPortsFor, monasteryComplete } from "./features.js";
import { keyOf } from "./tiles.js";

export function meepleCountsOnFeature(board, kind, parts, playerCount) {
  const counts = Array.from({ length: playerCount }, () => 0);
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile || !tile.meeple) continue;
    if (tile.meeple.kind !== kind) continue;
    if (kind !== "monastery" && tile.meeple.index !== part.index) continue;
    if (tile.meeple.player < 0 || tile.meeple.player >= playerCount) continue;
    counts[tile.meeple.player] += 1;
  }
  return counts;
}


export function majorityPlayers(counts) {
  let best = 0;
  for (const count of counts) if (count > best) best = count;
  if (best <= 0) return [];
  const winners = [];
  for (let i = 0; i < counts.length; i++) if (counts[i] === best) winners.push(i);
  return winners;
}


export function uniqueTileCount(parts) {
  const seen = new Set();
  for (const part of parts) seen.add(part.x + "," + part.y);
  return seen.size;
}


export function cityPennantCount(board, parts) {
  let total = 0;
  const seen = new Set();
  for (const part of parts) {
    const id = part.x + "," + part.y + "," + part.index;
    if (seen.has(id)) continue;
    seen.add(id);
    const tile = board.get(keyOf(part.x, part.y));
    if (tile && tile.cities && tile.cities[part.index] && tile.cities[part.index].pennant) total += 1;
  }
  return total;
}


export function componentId(parts) {
  return parts.map((part) => part.x + "," + part.y + "," + part.index).sort().join("|");
}


export function awardPoints(game, players, points) {
  for (const player of players) game.scores[player] += points;
}


export function returnMeepleFromTile(game, tile, kind, index) {
  if (!tile || !tile.meeple) return false;
  if (tile.meeple.kind !== kind) return false;
  if (kind === "road" || kind === "city" || kind === "field") {
    if (tile.meeple.index !== index) return false;
  }
  game.meeples[tile.meeple.player] += 1;
  tile.meeple = null;
  return true;
}


export function returnMeeplesOnFeature(game, kind, parts) {
  let returned = 0;
  for (const part of parts) {
    const tile = game.board.get(keyOf(part.x, part.y));
    if (returnMeepleFromTile(game, tile, kind, part.index)) returned += 1;
  }
  return returned;
}


export function labelMeepleEarnings(board, kind, parts, winners, points) {
  if (!points || !winners.length) return;
  const win = new Set(winners);
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile || !tile.meeple) continue;
    if (tile.meeple.kind !== kind) continue;
    if (kind !== "monastery" && tile.meeple.index !== part.index) continue;
    if (!win.has(tile.meeple.player)) continue;
    tile.meeple.earned = (tile.meeple.earned || 0) + points;
  }
}


export function scoreFeature(game, kind, parts, points, options) {
  const opts = options || {};
  const winners = majorityPlayers(
    meepleCountsOnFeature(game.board, kind, parts, game.players.length)
  );
  if (winners.length && points > 0) {
    awardPoints(game, winners, points);
    if (!opts.returnMeeples) labelMeepleEarnings(game.board, kind, parts, winners, points);
  }
  if (opts.returnMeeples) return returnMeeplesOnFeature(game, kind, parts);
  return 0;
}


export function roadPoints(parts, complete) {
  const tiles = uniqueTileCount(parts);
  return complete ? tiles : tiles;
}


export function cityPoints(board, parts, complete) {
  const tiles = uniqueTileCount(parts);
  const pennants = cityPennantCount(board, parts);
  if (complete) return tiles * 2 + pennants * 2;
  return tiles + pennants;
}


export function monasteryTileCount(board, x, y) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (board.has(keyOf(x + dx, y + dy))) count += 1;
    }
  }
  return count;
}


export function completedCitiesTouchingField(board, fieldParts) {
  const seen = new Set();
  let total = 0;
  for (const part of fieldParts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile) continue;
    const touches = FIELD_CITY_TOUCH[tile.id] || [];
    for (let i = 0; i < touches.length; i++) {
      if (touches[i][0] !== part.index) continue;
      const cityIndex = touches[i][1];
      const city = collectCityComponent(board, part.x, part.y, cityIndex);
      if (!city.complete) continue;
      const id = componentId(city.parts);
      if (seen.has(id)) continue;
      seen.add(id);
      total += 1;
    }
  }
  return total;
}


export function resolveCompletions(game, x, y) {
  const board = game.board;
  const tile = board.get(keyOf(x, y));
  if (!tile) return { roads: 0, cities: 0, monasteries: 0, points: 0 };
  const summary = { roads: 0, cities: 0, monasteries: 0, points: 0 };
  const before = game.scores.slice();
  const seenRoads = new Set();
  const seenCities = new Set();

  (tile.roads || []).forEach((_, index) => {
    const seed = x + "," + y + "," + index;
    if (seenRoads.has(seed)) return;
    const result = collectRoadComponent(board, x, y, index);
    for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
    if (!result.complete) return;
    scoreFeature(game, "road", result.parts, roadPoints(result.parts, true), { returnMeeples: true });
    summary.roads += 1;
  });

  (tile.cities || []).forEach((_, index) => {
    const seed = x + "," + y + "," + index;
    if (seenCities.has(seed)) return;
    const result = collectCityComponent(board, x, y, index);
    for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
    if (!result.complete) return;
    scoreFeature(game, "city", result.parts, cityPoints(board, result.parts, true), { returnMeeples: true });
    summary.cities += 1;
  });

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const mx = x + dx;
      const my = y + dy;
      const spot = board.get(keyOf(mx, my));
      if (!spot || !spot.monastery) continue;
      if (!monasteryComplete(board, mx, my)) continue;
      if (!spot.meeple || spot.meeple.kind !== "monastery") continue;
      scoreFeature(game, "monastery", [{ x: mx, y: my, index: null }], 9, { returnMeeples: true });
      summary.monasteries += 1;
    }
  }

  summary.points = game.scores.reduce((sum, score, i) => sum + (score - before[i]), 0);
  return summary;
}


export function finalizeScores(game) {
  const board = game.board;
  const seenRoads = new Set();
  const seenCities = new Set();
  const seenFields = new Set();
  const stockBefore = game.meeples.slice();
  const keep = { returnMeeples: false };

  for (const [pos, tile] of board) {
    const [x, y] = pos.split(",").map(Number);
    (tile.roads || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenRoads.has(seed)) return;
      const result = collectRoadComponent(board, x, y, index);
      for (const part of result.parts) seenRoads.add(part.x + "," + part.y + "," + part.index);
      if (result.complete) return;
      scoreFeature(game, "road", result.parts, roadPoints(result.parts, false), keep);
    });
    (tile.cities || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenCities.has(seed)) return;
      const result = collectCityComponent(board, x, y, index);
      for (const part of result.parts) seenCities.add(part.x + "," + part.y + "," + part.index);
      if (result.complete) return;
      scoreFeature(game, "city", result.parts, cityPoints(board, result.parts, false), keep);
    });
    if (tile.monastery && tile.meeple && tile.meeple.kind === "monastery") {
      if (!monasteryComplete(board, x, y)) {
        scoreFeature(game, "monastery", [{ x: x, y: y, index: null }], monasteryTileCount(board, x, y), keep);
      }
    }
    const fields = fieldPortsFor(tile);
    fields.forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seenFields.has(seed)) return;
      const result = collectFieldComponent(board, x, y, index);
      for (const part of result.parts) seenFields.add(part.x + "," + part.y + "," + part.index);
      const cities = completedCitiesTouchingField(board, result.parts);
      scoreFeature(game, "field", result.parts, cities * 3, keep);
    });
  }

  game.standings = rankPlayers(game.scores, stockBefore);
  game.rankingOpen = true;
}


export function rankPlayers(scores, meeples) {
  return scores.map((_, index) => index).sort((a, b) => {
    if (scores[b] !== scores[a]) return scores[b] - scores[a];
    if (meeples[b] !== meeples[a]) return meeples[b] - meeples[a];
    return a - b;
  });
}
