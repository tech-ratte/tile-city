import { FIELD_CITY_TOUCH } from "./catalog.js";
import { DIRS, DIR_INDEX, NEI, OPP_DIR } from "./constants.js";
import {
  absDir,
  collectCityComponent,
  collectFieldComponent,
  collectRoadComponent,
  fieldPortsFor,
  findCityIndexByAbsEdge,
  findRoadIndexByAbsEdge,
  monasteryComplete,
} from "./features.js";
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
  const meeple = tile.meeple;
  game.meeples[meeple.player] += 1;
  // Keep a short-lived visual so the UI can fade meeple + score out.
  tile.leaveFx = {
    color: meeple.color,
    kind: meeple.kind,
    x: meeple.x,
    y: meeple.y,
    earned: meeple.earned || 0,
    earnedDim: !!meeple.earnedDim,
    at: Date.now(),
  };
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
  const marked = [];
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile || !tile.meeple) continue;
    if (tile.meeple.kind !== kind) continue;
    if (kind !== "monastery" && tile.meeple.index !== part.index) continue;
    if (!win.has(tile.meeple.player)) continue;
    marked.push(tile.meeple);
  }
  if (!marked.length) return;

  // Lead meeple: +N. Extra meeples on the same feature for that player: (N).
  const leadByPlayer = new Set();
  for (const meeple of marked) {
    if (!leadByPlayer.has(meeple.player)) {
      leadByPlayer.add(meeple.player);
      meeple.earned = (meeple.earned || 0) + points;
      meeple.earnedDim = false;
    } else {
      meeple.earned = (meeple.earned || 0) + points;
      meeple.earnedDim = true;
    }
  }
}


function featClaimId(kind, index) {
  return kind === "monastery" ? "monastery" : kind + "-" + index;
}

function claimMapKey(part, kind) {
  return part.x + "," + part.y + ":" + featClaimId(kind, part.index);
}

/** Persist a live claim snapshot (geometry included) after meeples leave. */
export function stampFeatureClaim(board, kind, parts, claim) {
  if (!claim || !claim.colors || !claim.colors.length || !parts.length) return;
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile) continue;
    if (!tile.featureClaims) tile.featureClaims = {};
    const stored = {
      colors: claim.colors.slice(),
      tie: !!claim.tie,
    };
    if (claim.mode) stored.mode = claim.mode;
    if (claim.angle != null) stored.angle = claim.angle;
    if (claim.sideAngle != null) stored.sideAngle = claim.sideAngle;
    if (claim.dir) stored.dir = claim.dir;
    if (claim.boardDir) stored.boardDir = claim.boardDir;
    if (claim.face) stored.face = claim.face;
    if (claim.hubOther) stored.hubOther = true;
    if (claim.bridges && claim.bridges.length) {
      stored.bridges = claim.bridges.map((bridge) => ({
        dir: bridge.dir,
        color: bridge.color,
      }));
    }
    if (claim.sectors && claim.sectors.length) {
      stored.sectors = claim.sectors.map((sector) => ({
        color: sector.color,
        angle: sector.angle,
      }));
    }
    tile.featureClaims[featClaimId(kind, part.index)] = stored;
  }
}

/** Stamp each part's live claim so completed features keep pre-completion tint. */
export function stampFeatureClaimsFromMap(board, kind, parts, claims) {
  for (const part of parts) {
    const claim = claims.get(claimMapKey(part, kind));
    if (!claim) continue;
    stampFeatureClaim(board, kind, [part], claim);
  }
}

export function scoreFeature(game, kind, parts, points, options) {
  const opts = options || {};
  const winners = majorityPlayers(
    meepleCountsOnFeature(game.board, kind, parts, game.players.length)
  );
  if (winners.length) {
    // Snapshot live geometry before meeples return.
    const live = buildFeatureClaims(game);
    stampFeatureClaimsFromMap(game.board, kind, parts, live);
  }
  if (winners.length && points > 0) {
    awardPoints(game, winners, points);
    // Label before return so mid-game leaveFx can show the earned points.
    labelMeepleEarnings(game.board, kind, parts, winners, points);
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


function partId(part) {
  return part.x + "," + part.y + "," + part.index;
}

/** Neighbor graph for city/road parts inside one connected component. */
function featureAdjacency(board, kind, parts) {
  const set = new Set(parts.map(partId));
  const adj = new Map();
  for (const part of parts) adj.set(partId(part), []);

  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile) continue;
    const rot = tile.rot || 0;
    const edges =
      kind === "city"
        ? (tile.cities && tile.cities[part.index] && tile.cities[part.index].edges) || []
        : (tile.roads && tile.roads[part.index]) || [];
    for (const catalogDir of edges) {
      const dir = absDir(catalogDir, rot);
      const step = NEI[DIR_INDEX[dir]];
      const nx = part.x + step.dx;
      const ny = part.y + step.dy;
      const neighbor = board.get(keyOf(nx, ny));
      if (!neighbor) continue;
      const nextIndex =
        kind === "city"
          ? findCityIndexByAbsEdge(neighbor, OPP_DIR[dir])
          : findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]);
      if (nextIndex < 0) continue;
      const next = { x: nx, y: ny, index: nextIndex };
      const nid = partId(next);
      if (!set.has(nid)) continue;
      adj.get(partId(part)).push(next);
    }
  }
  return adj;
}

/**
 * CSS linear-gradient angle (0deg = up, clockwise) from point A toward point B.
 * Mid-tile color stops then place the threshold on the perpendicular midline
 * (E–W conflict → vertical cut / left–right fill; N–E conflict → 45° cut).
 */
function blendAngle(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (!dx && !dy) return 135;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/**
 * Direction pole per solid color from edge samples { color, dx, dy }.
 * When a color appears on multiple edges, pick the edge most aligned with
 * that color's seed (averaging would rotate a clean S↔E axis toward a
 * same-color spur — e.g. upper 90R turning the mid meeting onto the G edge).
 * Blend neighbor samples (no .color) are ignored here.
 */
function polesFromEdges(edges, seeds, part) {
  const byColor = new Map();
  for (const edge of edges) {
    if (!edge.color) continue;
    if (!byColor.has(edge.color)) byColor.set(edge.color, []);
    byColor.get(edge.color).push(edge);
  }
  const poles = new Map();
  for (const [color, list] of byColor.entries()) {
    let best = list[0];
    if (list.length > 1 && seeds && part) {
      const seed = seeds.get(color);
      const sx = seed ? seed.x - part.x : best.dx;
      const sy = seed ? seed.y - part.y : best.dy;
      let bestScore = -Infinity;
      for (const edge of list) {
        const score = edge.dx * sx + edge.dy * sy;
        if (score > bestScore) {
          bestScore = score;
          best = edge;
        }
      }
    }
    poles.set(color, { x: best.dx, y: best.dy, n: 1 });
  }
  return poles;
}

/** Board-space angle → tile-local CSS angle (markup is pre-rotation). */
function localClaimAngle(boardAngle, tileRot) {
  const rot = ((tileRot || 0) % 4 + 4) % 4;
  return Math.round((boardAngle - rot * 90) * 10) / 10;
}

function normDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Forward midpoint on the circle from a → b (degrees). */
function midDeg(a, b) {
  const from = normDeg(a);
  let span = normDeg(b - from);
  return normDeg(from + span / 2);
}

function poleForColor(color, poles, seeds, part) {
  let pole = poles.get(color);
  if (pole && (pole.x || pole.y)) return pole;
  const seed = seeds.get(color);
  if (seed) return { x: seed.x - part.x, y: seed.y - part.y, n: 1 };
  return null;
}

/**
 * Absolute board dirs of this city/road part's connecting edges.
 */
function partEdgeDirs(board, kind, part) {
  const tile = board.get(keyOf(part.x, part.y));
  if (!tile) return [];
  const rot = tile.rot || 0;
  const catalog =
    kind === "city"
      ? (tile.cities && tile.cities[part.index] && tile.cities[part.index].edges) || []
      : (tile.roads && tile.roads[part.index]) || [];
  return catalog.map((dir) => absDir(dir, rot));
}

function dirVec(dir) {
  const step = NEI[DIR_INDEX[dir]];
  return { x: step.dx, y: step.dy };
}

/** How well a color's pole/seed points toward a board edge dir. */
function scoreColorForDir(color, dir, poles, seeds, part) {
  const want = dirVec(dir);
  let vec = null;
  const pole = poles.get(color);
  if (pole && (pole.x || pole.y)) vec = pole;
  else {
    const seed = seeds.get(color);
    if (seed) vec = { x: seed.x - part.x, y: seed.y - part.y };
  }
  if (!vec) return -Infinity;
  return vec.x * want.x + vec.y * want.y;
}

/**
 * Cap equidistant colors to this part's geometry.
 * Cap / 1-edge: 2-color mid blend. Elbow (2 edges) may keep 3 colors when a
 * north seam already carries two hues that must meet a third on the other edge.
 * Mouth+: one color per feature edge by direction alignment.
 */
function pickBlendPalette(nearest, edges, seeds, part, edgeDirs) {
  if (nearest.length <= 1) return nearest.slice();
  const poles = polesFromEdges(edges, seeds, part);
  let maxCols =
    edgeDirs.length <= 1
      ? Math.min(2, nearest.length)
      : Math.min(edgeDirs.length, nearest.length);
  if (edgeDirs.length === 2 && nearest.length >= 3) {
    maxCols = Math.min(3, nearest.length);
  }
  if (nearest.length <= maxCols) return nearest.slice();

  const dirs = edgeDirs.length ? edgeDirs : ["N", "E"];
  const picked = [];
  const used = new Set();
  for (const dir of dirs) {
    if (picked.length >= maxCols) break;
    const want = dirVec(dir);
    let best = null;
    let bestScore = -Infinity;
    for (const color of nearest) {
      if (used.has(color)) continue;
      let score = scoreColorForDir(color, dir, poles, seeds, part);
      for (const edge of edges) {
        if (edge.color === color && edge.dx === want.x && edge.dy === want.y) {
          score += 10;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = color;
      }
    }
    if (best == null) continue;
    picked.push(best);
    used.add(best);
  }
  for (const color of nearest) {
    if (picked.length >= maxCols) break;
    if (used.has(color)) continue;
    picked.push(color);
    used.add(color);
  }
  return picked.sort();
}

/**
 * 2-color linear claim from seed→seed when solid edge poles are missing.
 * Spurs off an odd meeting (only contested neighbors) must follow the seed
 * axis — per-seed radial poles would invent a dirty diagonal.
 */
function blendFromSeeds(colorA, colorB, seeds, part, tileRot) {
  const seedA = seeds.get(colorA) || { x: part.x, y: part.y };
  const seedB = seeds.get(colorB) || { x: part.x + 1, y: part.y };
  const boardAngle = blendAngle(seedA, seedB);
  const local = localClaimAngle(boardAngle, tileRot);
  const ortho = seedA.x === seedB.x || seedA.y === seedB.y;
  // claimAxisKind uses sector separation: ~180 → ortho 0.5 band, ~90 → diag.
  const secA = normDeg(local + 180);
  const secB = ortho ? normDeg(local) : normDeg(local + 90);
  return {
    colors: [colorA, colorB],
    tie: true,
    mode: "full",
    angle: local,
    sectors: [
      { color: colorA, angle: secA },
      { color: colorB, angle: secB },
    ],
  };
}

/**
 * Pole for a blend color: solid neighbor on a feature edge, else that edge's
 * unit direction (keeps elbows on true 45° / 90° axes), else seed.
 */
function poleForPaletteColor(color, edges, seeds, part, edgeDirs) {
  const poles = polesFromEdges(edges, seeds, part);
  const solid = poles.get(color);
  if (solid && (solid.x || solid.y)) return solid;
  let bestDir = null;
  let bestScore = -Infinity;
  for (const dir of edgeDirs || []) {
    const score = scoreColorForDir(color, dir, poles, seeds, part);
    if (score > bestScore) {
      bestScore = score;
      bestDir = dir;
    }
  }
  if (bestDir && bestScore > -Infinity) {
    const vec = dirVec(bestDir);
    return { x: vec.x, y: vec.y, n: 1 };
  }
  return poleForColor(color, poles, seeds, part);
}

/**
 * Odd meeting blend. sectors[] for multi-edge conic (roads / 3+ city).
 * For 2 colors, angle is local linear-gradient direction from colorA → colorB
 * so cities can keep connecting edges pure with mid-only stops.
 */
/** True when feature has exactly two adjacent edges (elbow / bend), not a bar. */
function isElbowDirs(edgeDirs) {
  if (!edgeDirs || edgeDirs.length !== 2) return false;
  const i0 = DIR_INDEX[edgeDirs[0]];
  const i1 = DIR_INDEX[edgeDirs[1]];
  if (i0 == null || i1 == null) return false;
  const diff = Math.abs(i0 - i1) % 4;
  return diff === 1 || diff === 3;
}

/**
 * Elbow (etc.): inherit a neighbor's 2-color linear along one edge, keep the
 * solid side color on the other edge, and blend only where they meet inside
 * the tile — never equal-wedge the palette.
 */
function blendCornerInherit(palette, edges, seeds, part, tileRot, edgeDirs, kind) {
  if (kind && kind !== "city") return null;
  if (!isElbowDirs(edgeDirs)) return null;
  const blendEdges = edges.filter(
    (edge) => edge.blend && edge.colors && edge.colors.length === 2
  );
  const solidEdges = edges.filter((edge) => edge.color);
  const inherited = blendEdges.find((edge) =>
    edge.colors.every((color) => palette.indexOf(color) >= 0)
  );
  if (!inherited || !solidEdges.length) return null;
  const side = solidEdges.find((edge) => inherited.colors.indexOf(edge.color) < 0);
  if (!side) return null;

  const seedA = seeds.get(inherited.colors[0]) || {
    x: part.x + inherited.dx,
    y: part.y + inherited.dy,
  };
  const seedB = seeds.get(inherited.colors[1]) || {
    x: part.x - inherited.dx,
    y: part.y - inherited.dy,
  };
  const boardAngle = blendAngle(seedA, seedB);
  const colorA = inherited.colors[0];
  const colorB = inherited.colors[1];
  const sideBoard = blendAngle({ x: 0, y: 0 }, { x: side.dx, y: side.dy });
  return {
    colors: [colorA, colorB, side.color],
    tie: true,
    mode: "corner",
    angle: localClaimAngle(boardAngle, tileRot),
    sideAngle: localClaimAngle(sideBoard, tileRot),
    sectors: [
      {
        color: colorA,
        angle: normDeg(localClaimAngle(boardAngle, tileRot) + 180),
      },
      {
        color: colorB,
        angle: normDeg(localClaimAngle(boardAngle, tileRot)),
      },
      {
        color: side.color,
        angle: normDeg(localClaimAngle(sideBoard, tileRot)),
      },
    ],
  };
}

function blendFan(nearest, edges, seeds, part, tileRot, edgeDirs, kind) {
  const dirs = edgeDirs || [];
  // Include colors from blend-neighbor edges so elbows can corner-inherit
  // even when BFS nearest is only 2 (half R|R north + solid brown east).
  const edgeColors = [];
  for (const edge of edges) {
    if (edge.color && edgeColors.indexOf(edge.color) < 0) edgeColors.push(edge.color);
    if (edge.colors) {
      for (const color of edge.colors) {
        if (edgeColors.indexOf(color) < 0) edgeColors.push(color);
      }
    }
  }
  const expanded = nearest.slice();
  for (const color of edgeColors) {
    if (expanded.indexOf(color) < 0) expanded.push(color);
  }
  expanded.sort();
  const palette = pickBlendPalette(expanded, edges, seeds, part, dirs);
  const poles = polesFromEdges(edges, seeds, part);

  // Corner before 2-color: preserve neighbor linear + solid side edge.
  const cornerEarly = blendCornerInherit(palette, edges, seeds, part, tileRot, dirs, kind);
  if (cornerEarly) return cornerEarly;

  // 2-color: solid edges on both sides keep edge purity; otherwise align to
  // feature edge dirs (elbow 45°) or seed axis for spurs.
  if (palette.length === 2) {
    const colorA = palette[0];
    const colorB = palette[1];
    const edgeA = poles.get(colorA);
    const edgeB = poles.get(colorB);
    const solidA = edgeA && (edgeA.x || edgeA.y);
    const solidB = edgeB && (edgeB.x || edgeB.y);
    if (!solidA || !solidB) {
      if (dirs.length >= 2) {
        const poleA = poleForPaletteColor(colorA, edges, seeds, part, dirs);
        const poleB = poleForPaletteColor(colorB, edges, seeds, part, dirs);
        if (poleA && poleB && (poleA.x || poleA.y) && (poleB.x || poleB.y)) {
          const sectors = [
            {
              color: colorA,
              angle: normDeg(localClaimAngle(blendAngle({ x: 0, y: 0 }, poleA), tileRot)),
              pole: poleA,
            },
            {
              color: colorB,
              angle: normDeg(localClaimAngle(blendAngle({ x: 0, y: 0 }, poleB), tileRot)),
              pole: poleB,
            },
          ].sort((a, b) => a.angle - b.angle);
          const boardAngle = blendAngle(sectors[0].pole, sectors[1].pole);
          return {
            colors: [sectors[0].color, sectors[1].color],
            tie: true,
            mode: "full",
            angle: localClaimAngle(boardAngle, tileRot),
            sectors: sectors.map((sector) => ({
              color: sector.color,
              angle: sector.angle,
            })),
          };
        }
      }
      return blendFromSeeds(colorA, colorB, seeds, part, tileRot);
    }
    const boardA = blendAngle({ x: 0, y: 0 }, edgeA);
    const boardB = blendAngle({ x: 0, y: 0 }, edgeB);
    const sectors = [
      {
        color: colorA,
        angle: normDeg(localClaimAngle(boardA, tileRot)),
        pole: edgeA,
      },
      {
        color: colorB,
        angle: normDeg(localClaimAngle(boardB, tileRot)),
        pole: edgeB,
      },
    ].sort((a, b) => a.angle - b.angle);
    const boardAngle = blendAngle(sectors[0].pole, sectors[1].pole);
    return {
      colors: [sectors[0].color, sectors[1].color],
      tie: true,
      mode: "full",
      angle: localClaimAngle(boardAngle, tileRot),
      sectors: sectors.map((sector) => ({ color: sector.color, angle: sector.angle })),
    };
  }

  // Fallback: sectors from solid edges when present; do not invent seed-only wedges.
  const sectors = [];
  for (const color of palette) {
    const edgePole = poles.get(color);
    const pole =
      edgePole && (edgePole.x || edgePole.y)
        ? edgePole
        : poleForColor(color, poles, seeds, part);
    if (!pole || (!pole.x && !pole.y)) continue;
    const boardAngle = blendAngle({ x: 0, y: 0 }, pole);
    sectors.push({
      color: color,
      angle: normDeg(localClaimAngle(boardAngle, tileRot)),
      pole: pole,
    });
  }
  sectors.sort((a, b) => a.angle - b.angle);
  const uniq = [];
  for (const sector of sectors) {
    if (uniq.length && Math.abs(normDeg(uniq[uniq.length - 1].angle - sector.angle)) < 1) continue;
    uniq.push(sector);
  }
  if (uniq.length < 2) {
    return blendFromSeeds(palette[0], palette[1] || palette[0], seeds, part, tileRot);
  }
  if (uniq.length === 2) {
    const boardAngle = blendAngle(uniq[0].pole, uniq[1].pole);
    return {
      colors: [uniq[0].color, uniq[1].color],
      tie: true,
      mode: "full",
      angle: localClaimAngle(boardAngle, tileRot),
      sectors: uniq.map((sector) => ({ color: sector.color, angle: sector.angle })),
    };
  }

  return {
    colors: uniq.map((sector) => sector.color),
    tie: true,
    mode: "full",
    angle: 0,
    sectors: uniq.map((sector) => ({ color: sector.color, angle: sector.angle })),
  };
}

/**
 * Linear half-blend for even frontiers (0.5+0.5 across the shared edge).
 */
function blendHalf(colorA, colorB, boardAngle, tileRot, mode) {
  return {
    colors: [colorA, colorB],
    tie: true,
    mode: mode,
    angle: localClaimAngle(boardAngle, tileRot),
  };
}

function absDirFromDelta(dx, dy) {
  if (dy < 0) return "N";
  if (dx > 0) return "E";
  if (dy > 0) return "S";
  return "W";
}

/** Board-space edge dir → tile-local edge (markup is pre-rotation). */
function localEdgeDir(boardDir, tileRot) {
  const rot = ((tileRot || 0) % 4 + 4) % 4;
  const index = DIR_INDEX[boardDir];
  if (index == null) return boardDir;
  return DIRS[(index - rot + 4) % 4];
}

/**
 * Stable pick among connected meeple colors (claim rebuilds must not flicker).
 * Salt = hub tile position so different meetings diverge.
 */
function pickConnectedFace(nearest, part) {
  const list = nearest && nearest.length ? nearest : [];
  if (list.length <= 1) return list[0] || null;
  let h = 2166136261;
  const salt = String(part.x) + "," + String(part.y) + ":" + String(part.index == null ? 0 : part.index);
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (const color of list) {
    for (let i = 0; i < color.length; i++) {
      h ^= color.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e;
    h = Math.imul(h, 16777619);
  }
  return list[(h >>> 0) % list.length];
}

/**
 * City odd meeting: face = one connected color + edge bands to solid neighbors.
 */
function blendCityHub(edges, nearest, part) {
  const bridges = [];
  const seen = new Set();
  for (const edge of edges) {
    if (!edge.color) continue;
    const dir = absDirFromDelta(edge.dx, edge.dy);
    const key = dir + ":" + edge.color;
    if (seen.has(key)) continue;
    seen.add(key);
    bridges.push({ dir: dir, color: edge.color });
  }
  return {
    colors: nearest.slice(),
    tie: true,
    mode: "hub",
    face: pickConnectedFace(nearest, part),
    bridges: bridges,
  };
}

/**
 * City even frontier: pure face color + edge band on the shared edge.
 * face = this tile's solid color; colors[1] = partner color for the seam mid.
 * boardDir = board-space direction toward the partner (paint maps to local).
 */
function blendCityBridge(face, other, boardDir, tileRot) {
  return {
    colors: [face, other],
    tie: true,
    mode: "bridge",
    face: face,
    dir: localEdgeDir(boardDir, tileRot),
    boardDir: boardDir,
  };
}

/**
 * Elbow / 2-edge parts: if one neighbor claim is already a 2-color linear
 * (half or full) and the other is a solid third color, paint corner inherit
 * so the blend continues into the elbow without dirtying the solid edge.
 * Runs after Pass 1–2 so half frontiers are visible as neighbor claims.
 */
function propagateCornerInherits(board, kind, parts, adj, claims, tileRotAt) {
  // City elbows (N/M/O/P); road bends use linear half/full along the arc.
  if (kind !== "city") return;
  for (const part of parts) {
    const dirs = partEdgeDirs(board, kind, part);
    if (!isElbowDirs(dirs)) continue;

    let blend = null;
    let solid = null;
    for (const next of adj.get(partId(part)) || []) {
      const nClaim = claims.get(claimMapKey(next, kind));
      if (!nClaim || !nClaim.colors || !nClaim.colors.length) continue;
      const dx = next.x - part.x;
      const dy = next.y - part.y;
      if (
        nClaim.tie &&
        nClaim.colors.length === 2 &&
        (nClaim.mode === "full" || nClaim.mode === "half-a" || nClaim.mode === "half-b")
      ) {
        blend = { claim: nClaim, next: next, dx: dx, dy: dy };
      } else if (!nClaim.tie && nClaim.colors.length === 1) {
        const color = nClaim.colors[0];
        if (!solid || solid.color !== color) {
          solid = { color: color, dx: dx, dy: dy };
        }
      }
    }
    if (!blend || !solid) continue;
    if (blend.claim.colors.indexOf(solid.color) >= 0) continue;

    const rot = tileRotAt(part);
    const blendRot = tileRotAt(blend.next);
    const boardAngle =
      (blend.claim.angle != null ? blend.claim.angle : 90) + blendRot * 90;
    const sideBoard = blendAngle({ x: 0, y: 0 }, { x: solid.dx, y: solid.dy });
    const colorA = blend.claim.colors[0];
    const colorB = blend.claim.colors[1];
    claims.set(claimMapKey(part, kind), {
      colors: [colorA, colorB, solid.color],
      tie: true,
      mode: "corner",
      angle: localClaimAngle(boardAngle, rot),
      sideAngle: localClaimAngle(sideBoard, rot),
      sectors: [
        { color: colorA, angle: normDeg(localClaimAngle(boardAngle, rot) + 180) },
        { color: colorB, angle: normDeg(localClaimAngle(boardAngle, rot)) },
        { color: solid.color, angle: normDeg(localClaimAngle(sideBoard, rot)) },
      ],
    });
  }
}

/**
 * Map placed city/road segments to claim colors for board tinting.
 * Keys: "x,y:city-0" / "x,y:road-1".
 * Value: { colors: string[], tie: boolean, angle?: number }.
 * Solo: pure meeple color.
 * Odd meeting (equidistant): one tile, full mid-axis gradient.
 * Even meeting (solid|solid frontier): both tiles get half-gradients (0.5+0.5).
 */
export function buildFeatureClaims(game) {
  const claims = new Map();
  const seen = new Set();
  const board = game.board;
  const players = game.players || [];
  const playerCount = players.length;

  function paint(kind, parts) {
    const counts = meepleCountsOnFeature(board, kind, parts, playerCount);
    const winners = majorityPlayers(counts);
    if (!winners.length) return;
    const winnerSet = new Set(winners);
    const colors = winners.map((index) => players[index].id);

    if (colors.length === 1) {
      for (const part of parts) {
        claims.set(claimMapKey(part, kind), {
          colors: colors.slice(),
          tie: false,
        });
      }
      return;
    }

    const adj = featureAdjacency(board, kind, parts);
    const distByColor = new Map(); // partId -> Map(color -> dist)
    const seeds = new Map(); // color -> {x,y}
    const queue = [];

    for (const part of parts) {
      const tile = board.get(keyOf(part.x, part.y));
      if (!tile || !tile.meeple) continue;
      const m = tile.meeple;
      if (m.kind !== kind || m.index !== part.index) continue;
      if (!winnerSet.has(m.player)) continue;
      const color = players[m.player].id;
      if (!seeds.has(color)) seeds.set(color, { x: part.x, y: part.y });
      const id = partId(part);
      if (!distByColor.has(id)) distByColor.set(id, new Map());
      const cmap = distByColor.get(id);
      if (cmap.has(color) && cmap.get(color) <= 0) continue;
      cmap.set(color, 0);
      queue.push({ x: part.x, y: part.y, index: part.index, color: color, d: 0 });
    }

    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      for (const next of adj.get(partId(cur)) || []) {
        const nid = partId(next);
        const nd = cur.d + 1;
        if (!distByColor.has(nid)) distByColor.set(nid, new Map());
        const cmap = distByColor.get(nid);
        if (cmap.has(cur.color) && cmap.get(cur.color) <= nd) continue;
        cmap.set(cur.color, nd);
        queue.push({ x: next.x, y: next.y, index: next.index, color: cur.color, d: nd });
      }
    }

    const fallback = colors.slice().sort();
    const owners = new Map(); // partId -> nearest color ids
    for (const part of parts) {
      const cmap = distByColor.get(partId(part));
      let nearest = [];
      if (cmap && cmap.size) {
        let minD = Infinity;
        for (const d of cmap.values()) if (d < minD) minD = d;
        for (const [color, d] of cmap.entries()) {
          if (d === minD) nearest.push(color);
        }
        nearest.sort();
      } else {
        nearest = fallback.slice();
      }
      owners.set(partId(part), nearest.length ? nearest : fallback.slice(0, 1));
    }

    function primaryOwner(id) {
      const nearest = owners.get(id) || fallback;
      return nearest.length === 1 ? nearest[0] : null;
    }

    function tileRotAt(part) {
      const tile = board.get(keyOf(part.x, part.y));
      return tile && tile.rot ? tile.rot : 0;
    }

    // Only the shallowest equidistant ring blends. Deeper ties (e.g. spur above
    // a T-junction meeting) demote to a single owner so upper caps stay solid.
    const minTieDist = new Map();
    for (const part of parts) {
      const nearest = owners.get(partId(part));
      if (!nearest || nearest.length < 2) continue;
      const cmap = distByColor.get(partId(part));
      if (!cmap) continue;
      const d = cmap.get(nearest[0]);
      if (d == null) continue;
      const key = nearest.slice().sort().join("|");
      if (!minTieDist.has(key) || d < minTieDist.get(key)) minTieDist.set(key, d);
    }
    // Meeting tiles at minTieDist for each color-set key.
    const meetingParts = new Map();
    for (const part of parts) {
      const nearest = owners.get(partId(part));
      if (!nearest || nearest.length < 2) continue;
      const cmap = distByColor.get(partId(part));
      if (!cmap) continue;
      const d = cmap.get(nearest[0]);
      const key = nearest.slice().sort().join("|");
      if (d == null || d !== minTieDist.get(key)) continue;
      if (!meetingParts.has(key)) meetingParts.set(key, []);
      meetingParts.get(key).push(part);
    }

    // Drop equidistant tiles that are not bridges between the two seeds
    // (seed vectors from the tile should point roughly opposite). Side tiles
    // that happen to tie (e.g. 3rd-tile junction with gradient bleeding onto
    // 1st/2nd approach tiles via a short spur) demote to the nearer color.
    for (const [key, meetings] of meetingParts.entries()) {
      if (meetings.length < 2) continue;
      const colors = key.split("|");
      if (colors.length !== 2) continue;
      const kept = [];
      for (const part of meetings) {
        const seedA = seeds.get(colors[0]);
        const seedB = seeds.get(colors[1]);
        if (!seedA || !seedB) {
          kept.push(part);
          continue;
        }
        const va = { x: seedA.x - part.x, y: seedA.y - part.y };
        const vb = { x: seedB.x - part.x, y: seedB.y - part.y };
        const la = Math.hypot(va.x, va.y) || 1;
        const lb = Math.hypot(vb.x, vb.y) || 1;
        const dot = (va.x * vb.x + va.y * vb.y) / (la * lb);
        if (dot < 0.2) {
          kept.push(part);
          continue;
        }
        let best = colors[0];
        let bestScore = -Infinity;
        for (const color of colors) {
          const seed = seeds.get(color);
          if (!seed) continue;
          const score = -Math.hypot(seed.x - part.x, seed.y - part.y);
          if (score > bestScore) {
            bestScore = score;
            best = color;
          }
        }
        owners.set(partId(part), [best]);
      }
      meetingParts.set(key, kept.length ? kept : meetings.slice(0, 1));
    }

    for (const part of parts) {
      const id = partId(part);
      const nearest = owners.get(id);
      if (!nearest || nearest.length < 2) continue;
      const cmap = distByColor.get(id);
      if (!cmap) continue;
      const d = cmap.get(nearest[0]);
      const key = nearest.slice().sort().join("|");
      if (d == null || !minTieDist.has(key) || d <= minTieDist.get(key)) continue;
      const meetings = meetingParts.get(key) || [];
      if (!meetings.length) continue;
      // Nearest meeting tile (by board distance).
      let meet = meetings[0];
      let meetDist = Infinity;
      for (const m of meetings) {
        const md = Math.hypot(m.x - part.x, m.y - part.y);
        if (md < meetDist) {
          meetDist = md;
          meet = m;
        }
      }
      const vx = part.x - meet.x;
      const vy = part.y - meet.y;
      const dots = [];
      for (const color of nearest) {
        const seed = seeds.get(color);
        if (!seed) continue;
        dots.push((seed.x - meet.x) * vx + (seed.y - meet.y) * vy);
      }
      if (!dots.length) continue;
      const maxDot = Math.max.apply(null, dots);
      const minDot = Math.min.apply(null, dots);
      // Demote only arms behind the meeting (away from seeds), not lateral spurs.
      if (!(maxDot < 0.25 && minDot < -0.25)) continue;
      let best = nearest[0];
      let bestScore = -Infinity;
      for (const color of nearest) {
        const seed = seeds.get(color);
        if (!seed) continue;
        const score = -Math.hypot(seed.x - part.x, seed.y - part.y);
        if (score > bestScore) {
          bestScore = score;
          best = color;
        }
      }
      owners.set(id, [best]);
    }

    function edgeSamples(part) {
      const id = partId(part);
      const edges = [];
      for (const next of adj.get(id) || []) {
        const nearest = owners.get(partId(next)) || [];
        const dx = next.x - part.x;
        const dy = next.y - part.y;
        if (nearest.length === 1) {
          edges.push({ color: nearest[0], dx: dx, dy: dy });
          continue;
        }
        // Neighbor 2-color tie: expose as a blend edge so elbows can inherit
        // that linear (R green|orange) instead of inventing equal wedges.
        if (nearest.length === 2) {
          edges.push({ colors: nearest.slice(), dx: dx, dy: dy, blend: true });
        }
      }
      return edges;
    }

    // Pass 1: equidistant tiles.
    // Cities → neutral hub + edge bands to solid neighbors.
    // Roads → mid-tile linear / fan blend.
    for (const part of parts) {
      const id = partId(part);
      const nearest = owners.get(id);
      const key = claimMapKey(part, kind);
      if (nearest.length >= 2) {
        if (kind === "city") {
          claims.set(key, blendCityHub(edgeSamples(part), nearest, part));
        } else {
          claims.set(
            key,
            blendFan(
              nearest,
              edgeSamples(part),
              seeds,
              part,
              tileRotAt(part),
              partEdgeDirs(board, kind, part),
              kind
            )
          );
        }
      } else {
        claims.set(key, { colors: [nearest[0]], tie: false });
      }
    }

    // Pass 2: even frontier.
    // Cities → pure faces + edge band on the shared edge.
    // Roads → half-a/half-b (0.25+0.25 at the seam, 0.75 pure each).
    // No opposite-edge echo: each seam paints only its two abutting tiles.
    for (const part of parts) {
      const id = partId(part);
      const own = primaryOwner(id);
      if (!own) continue;
      for (const next of adj.get(id) || []) {
        const other = primaryOwner(partId(next));
        if (!other || other === own) continue;
        // Canonicalize so each edge is processed once (W/N partner first).
        if (!(next.x > part.x || (next.x === part.x && next.y > part.y))) continue;

        const dx = next.x - part.x;
        const dy = next.y - part.y;
        const keyA = claimMapKey(part, kind);
        const keyB = claimMapKey(next, kind);
        if (kind === "city") {
          const boardDirA = absDirFromDelta(dx, dy);
          const boardDirB = absDirFromDelta(-dx, -dy);
          claims.set(keyA, blendCityBridge(own, other, boardDirA, tileRotAt(part)));
          claims.set(keyB, blendCityBridge(other, own, boardDirB, tileRotAt(next)));
        } else {
          const boardAngle = blendAngle({ x: -dx, y: -dy }, { x: dx, y: dy });
          claims.set(keyA, blendHalf(own, other, boardAngle, tileRotAt(part), "half-a"));
          claims.set(keyB, blendHalf(own, other, boardAngle, tileRotAt(next), "half-b"));
        }
      }
    }

    // Hub edge band: stamp partner half onto each solid neighbor so both
    // sides of the seam paint (same as even frontier). No further propagation.
    if (kind === "city") {
      for (const part of parts) {
        const claim = claims.get(claimMapKey(part, kind));
        if (!claim || claim.mode !== "hub" || !claim.bridges) continue;
        for (const bridge of claim.bridges) {
          const opp = OPP_DIR[bridge.dir];
          const nei = NEI[DIR_INDEX[bridge.dir]];
          if (!opp || !nei) continue;
          const nx = part.x + nei.dx;
          const ny = part.y + nei.dy;
          let nPart = null;
          for (const next of adj.get(partId(part)) || []) {
            if (next.x === nx && next.y === ny) {
              nPart = next;
              break;
            }
          }
          if (!nPart) continue;
          const nKey = claimMapKey(nPart, kind);
          const nClaim = claims.get(nKey);
          if (!nClaim || nClaim.mode === "hub" || nClaim.mode === "bridge") continue;
          if (nClaim.tie) continue;
          const face = nClaim.colors[0];
          const hubFace = claim.face || claim.colors[0];
          claims.set(nKey, {
            colors: hubFace && hubFace !== face ? [face, hubFace] : [face],
            tie: false,
            mode: "bridge",
            face: face,
            dir: localEdgeDir(opp, tileRotAt(nPart)),
            boardDir: opp,
            hubOther: true,
          });
        }
      }
    }
  }

  for (const [pos, tile] of board.entries()) {
    const comma = pos.indexOf(",");
    const x = Number(pos.slice(0, comma));
    const y = Number(pos.slice(comma + 1));
    (tile.cities || []).forEach((_, index) => {
      const id = "city:" + x + "," + y + "," + index;
      if (seen.has(id)) return;
      const result = collectCityComponent(board, x, y, index);
      for (const part of result.parts) seen.add("city:" + part.x + "," + part.y + "," + part.index);
      paint("city", result.parts);
    });
    (tile.roads || []).forEach((_, index) => {
      const id = "road:" + x + "," + y + "," + index;
      if (seen.has(id)) return;
      const result = collectRoadComponent(board, x, y, index);
      for (const part of result.parts) seen.add("road:" + part.x + "," + part.y + "," + part.index);
      paint("road", result.parts);
    });
    if (tile.monastery) {
      const id = "monastery:" + x + "," + y;
      if (!seen.has(id)) {
        seen.add(id);
        paint("monastery", [{ x: x, y: y, index: null }]);
      }
    }
  }

  // Completed features keep stamped geometry after meeples return.
  for (const [pos, tile] of board.entries()) {
    if (!tile.featureClaims) continue;
    for (const feat of Object.keys(tile.featureClaims)) {
      const key = pos + ":" + feat;
      if (claims.has(key)) continue;
      const stored = tile.featureClaims[feat];
      if (!stored || !stored.colors || !stored.colors.length) continue;
      const next = {
        colors: stored.colors.slice(),
        tie: !!stored.tie,
      };
      if (stored.mode) next.mode = stored.mode;
      if (stored.angle != null) next.angle = stored.angle;
      if (stored.sideAngle != null) next.sideAngle = stored.sideAngle;
      if (stored.dir) next.dir = stored.dir;
      if (stored.boardDir) next.boardDir = stored.boardDir;
      if (stored.face) next.face = stored.face;
      if (stored.hubOther) next.hubOther = true;
      if (stored.bridges && stored.bridges.length) {
        next.bridges = stored.bridges.map((bridge) => ({
          dir: bridge.dir,
          color: bridge.color,
        }));
      }
      if (stored.sectors && stored.sectors.length) {
        next.sectors = stored.sectors.map((sector) => ({
          color: sector.color,
          angle: sector.angle,
        }));
      }
      claims.set(key, next);
    }
  }

  return claims;
}
