/**
 * Master-bot extras (v2): supply / join / deny via remaining deck (order ignored).
 * Spec: docs/bot-master.md
 */
import { canPlace } from "./board.js";
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
  majorityPlayers,
  meepleCountsOnFeature,
  monasteryTileCount,
  uniqueTileCount,
} from "./scoring.js";
import { BY_ID, TYPES } from "./catalog.js";
import { DIR_INDEX, NEI, OPP_DIR } from "./constants.js";
import { keyOf, rotateEdges } from "./tiles.js";

function clamp01(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function featureMajority(board, kind, parts, playerCount) {
  return majorityPlayers(meepleCountsOnFeature(board, kind, parts, playerCount));
}

function componentKey(parts) {
  return parts.map((p) => p.x + "," + p.y + "," + p.index).sort().join("|");
}

function partKeySet(parts) {
  const set = new Set();
  for (const p of parts) set.add(p.x + "," + p.y + "," + p.index);
  return set;
}

function setsOverlap(a, b) {
  for (const k of a) {
    if (b.has(k)) return true;
  }
  return false;
}

/** Open edge count helper for callers. */
export function countOpenings(board, kind, parts, countOpenEdges) {
  return countOpenEdges(board, kind, parts);
}

/** Remaining tile multiset + L1 useful counts (order ignored). */
export function deckSupply(game) {
  let cityEdges = 0;
  let roadEdges = 0;
  let cityTiles = 0;
  let roadTiles = 0;
  const byId = Object.create(null);
  const tiles = (game.deck || []).concat(game.current ? [game.current] : []);
  for (const tile of tiles) {
    byId[tile.id] = (byId[tile.id] || 0) + 1;
    const type = BY_ID[tile.id];
    if (!type || !type.edges) continue;
    let hasC = false;
    let hasR = false;
    for (const edge of type.edges) {
      if (edge === "C") {
        cityEdges += 1;
        hasC = true;
      }
      if (edge === "R") {
        roadEdges += 1;
        hasR = true;
      }
    }
    if (hasC) cityTiles += 1;
    if (hasR) roadTiles += 1;
  }
  return {
    byId: byId,
    cityEdges: cityEdges,
    roadEdges: roadEdges,
    cityTiles: cityTiles,
    roadTiles: roadTiles,
    remaining: tiles.length,
    deckLen: (game.deck || []).length,
  };
}

/**
 * How many remaining placements (current + deck) each seat will take.
 * Assumes game.player holds game.current, then deck continues in seat order.
 */
export function futureDrawsFor(game, targetPlayer) {
  const n = game.players.length;
  if (n <= 0 || targetPlayer < 0 || targetPlayer >= n) return 0;
  const holder = game.player;
  let count = 0;
  if (game.current && holder === targetPlayer) count += 1;
  const deck = game.deck || [];
  for (let i = 0; i < deck.length; i++) {
    if ((holder + 1 + i) % n === targetPlayer) count += 1;
  }
  return count;
}

/** P(X >= need) for X ~ Binomial(draws, p). */
export function binomAtLeast(draws, p, need) {
  if (need <= 0) return 1;
  if (draws < need) return 0;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const q = 1 - p;
  let term = Math.pow(q, draws);
  let prob = 0;
  for (let k = 0; k <= draws; k++) {
    if (k >= need) prob += term;
    if (k === draws) break;
    term *= ((draws - k) / (k + 1)) * (p / q);
  }
  return clamp01(prob);
}

function edgeWant(kind) {
  return kind === "city" ? "C" : "R";
}

function connectsFeature(kind, edges, linkDirs) {
  const want = edgeWant(kind);
  for (const dir of linkDirs) {
    if (edges[DIR_INDEX[dir]] !== want) return false;
  }
  return true;
}

/**
 * L2: empty cells that open this city/road, with required edge dirs on the new tile.
 * `blocked` = an opening faces a placed non-matching edge (never closable).
 */
export function listOpenSlots(board, kind, parts) {
  const slots = new Map();
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile) continue;
    const rot = tile.rot || 0;
    if (kind === "city") {
      const city = tile.cities && tile.cities[part.index];
      if (!city) continue;
      for (const catalogDir of city.edges) {
        const dir = absDir(catalogDir, rot);
        const step = NEI[DIR_INDEX[dir]];
        const nx = part.x + step.dx;
        const ny = part.y + step.dy;
        const neighbor = board.get(keyOf(nx, ny));
        if (neighbor) {
          if (findCityIndexByAbsEdge(neighbor, OPP_DIR[dir]) >= 0) continue;
          return { slots: [], blocked: true };
        }
        const key = keyOf(nx, ny);
        const fromDir = OPP_DIR[dir];
        let slot = slots.get(key);
        if (!slot) {
          slot = { x: nx, y: ny, linkDirs: [] };
          slots.set(key, slot);
        }
        if (!slot.linkDirs.includes(fromDir)) slot.linkDirs.push(fromDir);
      }
    } else if (kind === "road") {
      const road = tile.roads && tile.roads[part.index];
      if (!road) continue;
      for (const catalogDir of road) {
        const dir = absDir(catalogDir, rot);
        const step = NEI[DIR_INDEX[dir]];
        const nx = part.x + step.dx;
        const ny = part.y + step.dy;
        const neighbor = board.get(keyOf(nx, ny));
        if (neighbor) {
          if (findRoadIndexByAbsEdge(neighbor, OPP_DIR[dir]) >= 0) continue;
          return { slots: [], blocked: true };
        }
        const key = keyOf(nx, ny);
        const fromDir = OPP_DIR[dir];
        let slot = slots.get(key);
        if (!slot) {
          slot = { x: nx, y: ny, linkDirs: [] };
          slots.set(key, slot);
        }
        if (!slot.linkDirs.includes(fromDir)) slot.linkDirs.push(fromDir);
      }
    }
  }
  return { slots: [...slots.values()], blocked: false };
}

function typeFitsSlot(board, kind, type, slot) {
  for (let rot = 0; rot < 4; rot++) {
    const edges = rotateEdges(type.edges, rot);
    if (!canPlace(board, slot.x, slot.y, edges)) continue;
    if (!connectsFeature(kind, edges, slot.linkDirs)) continue;
    return true;
  }
  return false;
}

function catalogFitsSlot(board, kind, slot) {
  for (const type of TYPES) {
    if (typeFitsSlot(board, kind, type, slot)) return true;
  }
  return false;
}

/**
 * L2 closability: oriented open slots vs full catalog and remaining deck multiset.
 */
export function analyzeClosability(board, kind, parts, supply) {
  const { slots, blocked } = listOpenSlots(board, kind, parts);
  if (blocked) {
    return { impossible: true, reason: "blocked", deckUseful: 0, slotCount: 0 };
  }
  if (!slots.length) {
    return { impossible: false, reason: "closed", deckUseful: 0, slotCount: 0 };
  }
  for (const slot of slots) {
    if (!catalogFitsSlot(board, kind, slot)) {
      return { impossible: true, reason: "catalog", deckUseful: 0, slotCount: slots.length };
    }
  }

  let deckUseful = 0;
  const byId = (supply && supply.byId) || Object.create(null);
  for (const id of Object.keys(byId)) {
    const count = byId[id] || 0;
    if (count <= 0) continue;
    const type = BY_ID[id];
    if (!type) continue;
    let fits = false;
    for (const slot of slots) {
      if (typeFitsSlot(board, kind, type, slot)) {
        fits = true;
        break;
      }
    }
    if (fits) deckUseful += count;
  }

  if (deckUseful <= 0) {
    return { impossible: true, reason: "deck", deckUseful: 0, slotCount: slots.length };
  }
  return { impossible: false, reason: "ok", deckUseful: deckUseful, slotCount: slots.length };
}

/**
 * Closeability via two paths (order ignored):
 * 1) self draws useful tiles on own remaining turns
 * 2) beneficiary opp completes for their own score
 *
 * When board+parts are provided, useful count is L2 (oriented fit); otherwise L1 fallback.
 */
export function closeChancePaths(openings, kind, supply, game, me, beneficiaries, board, parts) {
  const need = Math.max(1, Math.min(Math.max(0, openings), 3));
  let useful;
  let impossible = false;

  if (board && parts && (kind === "city" || kind === "road")) {
    const analysis = analyzeClosability(board, kind, parts, supply);
    useful = analysis.deckUseful;
    impossible = analysis.impossible || openings >= 5;
  } else {
    useful = kind === "city" ? supply.cityTiles || 0 : supply.roadTiles || 0;
    impossible = openings >= 5 || (openings >= 1 && useful <= 0);
  }

  if (impossible || (openings >= 1 && useful <= 0)) {
    return {
      pSelf: 0,
      pOpp: 0,
      combined: 0,
      useful: useful || 0,
      need: need,
      impossible: true,
    };
  }

  const pool = Math.max(1, supply.remaining || 0);
  const pTile = Math.min(1, useful / pool);
  const benef = Array.isArray(beneficiaries) ? beneficiaries : [];

  const pSelf = benef.includes(me)
    ? binomAtLeast(futureDrawsFor(game, me), pTile, need)
    : 0;

  let pOpp = 0;
  for (const b of benef) {
    if (b === me) continue;
    const pb = binomAtLeast(futureDrawsFor(game, b), pTile, need);
    pOpp = 1 - (1 - pOpp) * (1 - pb);
  }

  const combined = 1 - (1 - pSelf) * (1 - pOpp);
  return {
    pSelf: pSelf,
    pOpp: pOpp,
    combined: clamp01(combined),
    useful: useful,
    need: need,
    impossible: false,
  };
}

export function scoreLag(scores, me, lagRef) {
  const ref = lagRef > 0 ? lagRef : 10;
  const my = scores[me] || 0;
  let lead = my;
  for (let i = 0; i < scores.length; i++) {
    if (i === me) continue;
    if ((scores[i] || 0) > lead) lead = scores[i] || 0;
  }
  return clamp01((lead - my) / ref);
}

export function listIncompleteCities(board, playerCount, countOpenEdges) {
  const seen = new Set();
  const out = [];
  for (const [pos, tile] of board) {
    const [x, y] = pos.split(",").map(Number);
    (tile.cities || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seen.has(seed)) return;
      const result = collectCityComponent(board, x, y, index);
      for (const part of result.parts) seen.add(part.x + "," + part.y + "," + part.index);
      if (result.complete) return;
      const winners = featureMajority(board, "city", result.parts, playerCount);
      if (!winners.length) return;
      const tiles = uniqueTileCount(result.parts);
      const pennants = cityPennantCount(board, result.parts);
      const openings = countOpenEdges(board, "city", result.parts);
      out.push({
        id: componentKey(result.parts),
        kind: "city",
        parts: result.parts,
        partSet: partKeySet(result.parts),
        winners: winners,
        tiles: tiles,
        pennants: pennants,
        size: tiles + pennants,
        openings: openings,
      });
    });
  }
  return out;
}

export function listIncompleteRoads(board, playerCount, countOpenEdges) {
  const seen = new Set();
  const out = [];
  for (const [pos, tile] of board) {
    const [x, y] = pos.split(",").map(Number);
    (tile.roads || []).forEach((_, index) => {
      const seed = x + "," + y + "," + index;
      if (seen.has(seed)) return;
      const result = collectRoadComponent(board, x, y, index);
      for (const part of result.parts) seen.add(part.x + "," + part.y + "," + part.index);
      if (result.complete) return;
      const winners = featureMajority(board, "road", result.parts, playerCount);
      if (!winners.length) return;
      const tiles = uniqueTileCount(result.parts);
      const openings = countOpenEdges(board, "road", result.parts);
      out.push({
        id: componentKey(result.parts),
        kind: "road",
        parts: result.parts,
        partSet: partKeySet(result.parts),
        winners: winners,
        tiles: tiles,
        pennants: 0,
        size: tiles,
        openings: openings,
      });
    });
  }
  return out;
}

export function listFields(board, playerCount) {
  const seen = new Set();
  const out = [];
  for (const [pos, tile] of board) {
    if (!tile.meeple || tile.meeple.kind !== "field") continue;
    const [x, y] = pos.split(",").map(Number);
    const index = tile.meeple.index;
    const seed = x + "," + y + "," + index;
    if (seen.has(seed)) continue;
    const result = collectFieldComponent(board, x, y, index);
    for (const part of result.parts) seen.add(part.x + "," + part.y + "," + part.index);
    const winners = featureMajority(board, "field", result.parts, playerCount);
    if (!winners.length) continue;
    const cities = completedCitiesTouchingField(board, result.parts);
    out.push({
      id: componentKey(result.parts),
      kind: "field",
      parts: result.parts,
      partSet: partKeySet(result.parts),
      winners: winners,
      tiles: uniqueTileCount(result.parts),
      pennants: 0,
      size: cities,
      openings: 0,
    });
  }
  return out;
}

function overlapping(list, feat) {
  const out = [];
  for (const other of list) {
    if (other.kind !== feat.kind) continue;
    if (setsOverlap(feat.partSet, other.partSet)) out.push(other);
  }
  return out;
}

function isBig(feat, weights) {
  if (feat.kind === "city") return feat.size >= (weights.joinCityMin == null ? 4 : weights.joinCityMin);
  if (feat.kind === "road") return feat.size >= (weights.joinRoadMin == null ? 4 : weights.joinRoadMin);
  if (feat.kind === "field") return feat.size >= (weights.joinFieldMin == null ? 2 : weights.joinFieldMin);
  return false;
}

function enemySoleOwner(feat, me) {
  if (feat.winners.length === 1 && feat.winners[0] !== me) return feat.winners[0];
  return null;
}

function pathsFor(feat, supply, game, me) {
  if (feat.kind === "field") {
    return { pSelf: 0, pOpp: 0, combined: 0, impossible: true };
  }
  return closeChancePaths(
    feat.openings,
    feat.kind,
    supply,
    game,
    me,
    feat.winners,
    game.board,
    feat.parts
  );
}

function featureExpectedPoints(feat, pClose) {
  // Rules: city complete = 2×size, end = 1×size; road complete = end = size.
  const endPts = feat.size;
  const completePts = feat.kind === "city" ? feat.size * 2 : feat.size;
  const p = clamp01(pClose);
  return p * completePts + (1 - p) * endPts;
}

/**
 * Master-only additive score (v3): EV / join / lag-deny.
 */
export function masterExtraScore(ctx) {
  const { before, after, me, weights, placed, countOpenEdges, turnsAfter } = ctx;
  if (!weights || !weights.isMaster) return 0;

  const n = before.players.length;
  const supplyAfter = deckSupply(after);
  const supplyBefore = deckSupply(before);
  const lag = scoreLag(before.scores, me, weights.lagRef == null ? 10 : weights.lagRef);
  const lastTurn = (turnsAfter == null ? 1 : turnsAfter) <= 0;

  const citiesBefore = listIncompleteCities(before.board, n, countOpenEdges);
  const citiesAfter = listIncompleteCities(after.board, n, countOpenEdges);
  const roadsBefore = listIncompleteRoads(before.board, n, countOpenEdges);
  const roadsAfter = listIncompleteRoads(after.board, n, countOpenEdges);
  const fieldsBefore = listFields(before.board, n);
  const fieldsAfter = listFields(after.board, n);

  let value = 0;

  // --- V_ev (cities + roads): rule-faithful expected points ---
  const evSelf = weights.evSelf || 0;
  const supplyOpp = weights.supplyOpp || 0;
  const deadClaim = weights.deadClaim || 0;
  for (const feat of citiesAfter.concat(roadsAfter)) {
    const paths = pathsFor(feat, supplyAfter, after, me);
    if (feat.winners.includes(me)) {
      if (paths.impossible) {
        if (lastTurn) {
          // Still scores at end — OK to dump a meeple when no turns remain.
          if (evSelf) value += evSelf * feat.size;
        } else if (deadClaim) {
          value += deadClaim * feat.size;
        }
      } else if (evSelf) {
        value += evSelf * featureExpectedPoints(feat, paths.combined);
      }
    }
    const enemy = enemySoleOwner(feat, me);
    if (enemy != null && isBig(feat, weights) && supplyOpp && !paths.impossible) {
      value += supplyOpp * feat.size * paths.pOpp;
    }
  }

  // --- V_join (cities, roads, fields) ---
  const joinOk = weights.joinOk || 0;
  const joinFail = weights.joinFail || 0;
  const joinKinds = [
    { before: citiesBefore, after: citiesAfter },
    { before: roadsBefore, after: roadsAfter },
    { before: fieldsBefore, after: fieldsAfter },
  ];
  for (const group of joinKinds) {
    for (const feat of group.after) {
      if (!isBig(feat, weights)) continue;
      const prevs = overlapping(group.before, feat);
      const meNow = feat.winners.includes(me);
      const meBefore = prevs.some((p) => p.winners.includes(me));
      const enemyNow = enemySoleOwner(feat, me);
      const paths =
        feat.kind === "field" ? { impossible: false } : pathsFor(feat, supplyAfter, after, me);

      if (meNow && joinOk && !paths.impossible) {
        const maxOwnBefore = prevs
          .filter((p) => p.winners.includes(me))
          .reduce((m, p) => Math.max(m, p.size), 0);
        const newlyIn = !meBefore;
        const grewMerge = meBefore && feat.size > maxOwnBefore;
        if (newlyIn || grewMerge) {
          value += joinOk * feat.size * 1; // completed join this move
        }
      }

      if (enemyNow != null && meBefore && !meNow && joinFail) {
        value += joinFail * feat.size;
      }
    }
  }

  // --- V_deny (enemy-sole big city/road only; lag-gated) ---
  if (lag > 0) {
    const denyBlock = weights.denyBlock || 0;
    const denyFatten = weights.denyFatten || 0;
    const denyGroups = [
      { before: citiesBefore, after: citiesAfter },
      { before: roadsBefore, after: roadsAfter },
    ];
    for (const group of denyGroups) {
      for (const feat of group.after) {
        const enemy = enemySoleOwner(feat, me);
        if (enemy == null) continue; // self-sole / shared: never deny-credit
        if (!isBig(feat, weights)) continue;

        const pathsAfter = pathsFor(feat, supplyAfter, after, me);
        const pBlockAfter = 1 - pathsAfter.pOpp;
        const prevs = overlapping(group.before, feat);
        let pBlockBefore = 1;
        let sizeBefore = 0;
        if (prevs.length) {
          // Closest prior enemy-sole overlap, else any overlap
          const prior =
            prevs.find((p) => enemySoleOwner(p, me) != null) || prevs[0];
          sizeBefore = prior.size;
          const pathsBefore = pathsFor(prior, supplyBefore, before, me);
          pBlockBefore = 1 - pathsBefore.pOpp;
        }

        const dBlock = pBlockAfter - pBlockBefore;
        const dSize = feat.size - sizeBefore;
        if (denyBlock && dBlock > 0) {
          value += lag * denyBlock * feat.size * dBlock;
        }
        if (denyFatten && dSize > 0) {
          value += lag * denyFatten * dSize * pathsAfter.pOpp;
        }
      }
    }
  }

  // --- V_minor: monastery claim + fill ---
  if (placed) {
    const board = after.board;
    const here = board.get(keyOf(placed.x, placed.y));
    if (
      weights.monasteryClaim &&
      here &&
      here.monastery &&
      here.meeple &&
      here.meeple.kind === "monastery" &&
      here.meeple.player === me
    ) {
      value += weights.monasteryClaim;
    }
    if (weights.monasteryPush) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const spot = board.get(keyOf(placed.x + dx, placed.y + dy));
          if (!spot || !spot.monastery || !spot.meeple || spot.meeple.kind !== "monastery") continue;
          if (spot.meeple.player !== me) continue;
          if (monasteryComplete(board, placed.x + dx, placed.y + dy)) continue;
          const filled = monasteryTileCount(board, placed.x + dx, placed.y + dy);
          value += weights.monasteryPush * Math.max(0, filled - 5);
        }
      }
    }
  }

  // Cap so master extras cannot overturn ordinary scoring / monastery takes.
  const posCap = weights.extraPosCap == null ? 4.5 : weights.extraPosCap;
  const negCap = weights.extraNegCap == null ? -7 : weights.extraNegCap;
  if (value > posCap) value = posCap;
  if (value < negCap) value = negCap;
  return value;
}

/**
 * Field candidate filter for master — soft by phase / remaining turns.
 * completedCities===0 is always rejected by caller (0 end points).
 */
export function masterFieldAllowed(phase, completedCities, stock, turnsAfter) {
  if (completedCities <= 0) return false;
  if (turnsAfter != null && turnsAfter <= 0) return true;
  if (phase === "early") return false;
  if (phase === "end" || phase === "late") return true;
  // mid: prefer not spending the last meeple unless a decent field
  if (stock <= 1) return completedCities >= 3;
  return completedCities >= 2;
}
