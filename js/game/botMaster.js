/**
 * Master-bot extras: threat, close-hardness, denial net, share/contest, locks.
 * Spec: docs/bot-master.md
 */
import {
  collectCityComponent,
  collectRoadComponent,
  monasteryComplete,
} from "./features.js";
import {
  cityPennantCount,
  majorityPlayers,
  meepleCountsOnFeature,
  monasteryTileCount,
  uniqueTileCount,
} from "./scoring.js";
import { BY_ID } from "./catalog.js";
import { keyOf } from "./tiles.js";
import { MEEPLES_EACH } from "./constants.js";

function clamp01(x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return x;
}

function featureMajority(board, kind, parts, playerCount) {
  return majorityPlayers(meepleCountsOnFeature(board, kind, parts, playerCount));
}

/** Open edge count for city/road parts (imported logic duplicated lightly via callers). */
export function countOpenings(board, kind, parts, countOpenEdges) {
  return countOpenEdges(board, kind, parts);
}

export function deckSupply(game) {
  let cityEdges = 0;
  let roadEdges = 0;
  let cityTiles = 0;
  let roadTiles = 0;
  const tiles = (game.deck || []).concat(game.current ? [game.current] : []);
  for (const tile of tiles) {
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
    cityEdges: cityEdges,
    roadEdges: roadEdges,
    cityTiles: cityTiles,
    roadTiles: roadTiles,
    remaining: tiles.length,
    deckLen: (game.deck || []).length,
  };
}

/**
 * How many of the remaining tile placements (current + deck) each seat will take,
 * assuming `game.player` holds `game.current` and then deck order continues.
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

/**
 * Closeability via two paths:
 * 1) self draws enough useful tiles on own remaining turns and places them
 * 2) a beneficiary opponent draws them and completes for their own score
 */
export function closeChancePaths(openings, kind, supply, game, me, beneficiaries) {
  const useful = kind === "city" ? supply.cityTiles || 0 : supply.roadTiles || 0;
  const pool = Math.max(1, supply.remaining || 0);
  const pTile = Math.min(1, useful / pool);
  const need = Math.max(1, Math.min(Math.max(0, openings), 3));
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
  };
}

/**
 * 0 = easy to close, 1 = nearly impossible (catalog / turn-aware deck paths).
 * opts: { game, me, beneficiaries, catalogFloor } — without game, falls back to edge scarcity.
 */
export function closeHardness(openings, kind, supply, opts) {
  const options = opts && typeof opts === "object" && !Array.isArray(opts) ? opts : null;
  // Legacy 4th-arg catalogFloor number still accepted.
  const catalogFloor =
    options && options.catalogFloor != null
      ? options.catalogFloor
      : typeof opts === "number"
        ? opts
        : null;

  let catalog = 0;
  if (openings >= 5) catalog = 0.95;
  else if (openings >= 4) catalog = 0.7;
  else if (openings >= 3) catalog = 0.4;
  else if (openings >= 2) catalog = 0.15;
  else catalog = 0.05;
  if (catalogFloor != null) catalog = Math.max(catalog, catalogFloor);

  let deck = 0;
  let paths = null;
  if (options && options.game && Array.isArray(options.beneficiaries)) {
    paths = closeChancePaths(
      openings,
      kind,
      supply,
      options.game,
      options.me,
      options.beneficiaries
    );
    deck = 1 - paths.combined;
  } else {
    const edges = kind === "city" ? supply.cityEdges : supply.roadEdges;
    if (edges <= 0) deck = openings >= 1 ? 0.85 : 0;
    else if (edges <= 2 && openings >= 2) deck = 0.55;
    else if (edges <= 4 && openings >= 3) deck = 0.35;
    else deck = Math.max(0, 0.25 - edges * 0.02);
  }

  return {
    catalog: catalog,
    deck: deck,
    combined: Math.max(catalog, deck * 0.85),
    paths: paths,
  };
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

function componentKey(parts) {
  return parts.map((p) => p.x + "," + p.y + "," + p.index).sort().join("|");
}

export function lockedMeepleCounts(game, countOpenEdges) {
  const n = game.players.length;
  const locked = Array.from({ length: n }, () => 0);
  const board = game.board;
  for (const [pos, tile] of board) {
    if (!tile.meeple) continue;
    const p = tile.meeple.player;
    if (p < 0 || p >= n) continue;
    const [x, y] = pos.split(",").map(Number);
    if (tile.meeple.kind === "field") {
      locked[p] += 1;
      continue;
    }
    if (tile.meeple.kind === "monastery") {
      if (!monasteryComplete(board, x, y)) locked[p] += 1;
      continue;
    }
    if (tile.meeple.kind === "city") {
      const result = collectCityComponent(board, x, y, tile.meeple.index);
      if (!result.complete) {
        const openings = countOpenEdges(board, "city", result.parts);
        if (openings >= 2) locked[p] += 1;
        else locked[p] += 0.5;
      }
      continue;
    }
    if (tile.meeple.kind === "road") {
      const result = collectRoadComponent(board, x, y, tile.meeple.index);
      if (!result.complete) locked[p] += 0.5;
    }
  }
  return locked;
}

export function buildThreats(game, me, countOpenEdges, phase) {
  const n = game.players.length;
  const locked = lockedMeepleCounts(game, countOpenEdges);
  const scores = game.scores;
  const myScore = scores[me] || 0;
  let bestOther = 0;
  for (let i = 0; i < n; i++) {
    if (i === me) continue;
    if (scores[i] > bestOther) bestOther = scores[i];
  }
  // Free meeples alone must not make everyone a threat on turn 1.
  const phaseScale = phase === "early" ? 0.2 : phase === "mid" ? 0.65 : 1;
  const threats = Array.from({ length: n }, () => 0);
  for (let i = 0; i < n; i++) {
    if (i === me) continue;
    const scoreGap = (scores[i] - myScore) / 40;
    // Only treat "leader circle" as pressure once real scores exist.
    const leadPressure = bestOther >= 10 && scores[i] >= bestOther - 2 ? 0.35 : 0;
    const free = Math.max(0, (game.meeples[i] || 0) / MEEPLES_EACH);
    const bigUnfinished = listIncompleteCities(game.board, n, countOpenEdges).some(
      (c) => c.winners.includes(i) && c.size >= 4
    )
      ? 0.2
      : 0;
    const lockPenalty = 0.15 * (locked[i] || 0);
    const raw = 0.5 * scoreGap + 0.35 * leadPressure + 0.15 * free + bigUnfinished - lockPenalty;
    threats[i] = clamp01(raw * phaseScale);
  }
  return { threats: threats, locked: locked };
}

function indexById(list) {
  const map = new Map();
  for (const item of list) map.set(item.id, item);
  return map;
}

/**
 * Master-only additive score given before/after states.
 */
export function masterExtraScore(ctx) {
  const {
    before,
    after,
    me,
    weights,
    phase,
    placed,
    immSelf,
    immOpp,
    countOpenEdges,
    softDenial,
  } = ctx;
  if (!weights || !weights.isMaster) return 0;

  const n = before.players.length;
  const supplyBefore = deckSupply(before);
  const supplyAfter = deckSupply(after);
  const { threats, locked } = buildThreats(before, me, countOpenEdges, phase);
  let maxThreat = 0;
  let maxThreatPlayer = -1;
  for (let i = 0; i < n; i++) {
    if (i === me) continue;
    if (threats[i] > maxThreat) {
      maxThreat = threats[i];
      maxThreatPlayer = i;
    }
  }
  // Soften denial only when a large exclusive one-move finish is available this turn.
  const soften = !!softDenial;
  const denialEnabled = soften ? phase !== "early" : true;
  const runaway =
    maxThreatPlayer >= 0 &&
    (before.scores[maxThreatPlayer] || 0) >= (before.scores[me] || 0) + 12;

  let value = 0;

  // G2 free meeple differential vs top threat
  if (maxThreatPlayer >= 0 && weights.freeMeepleDiff) {
    value += weights.freeMeepleDiff * ((after.meeples[me] || 0) - (after.meeples[maxThreatPlayer] || 0));
  }

  // F4 own locks: prefer moves that free self (returned already in base); boost if still locked many
  const lockedAfter = lockedMeepleCounts(after, countOpenEdges);
  if (weights.selfLock && locked[me] > lockedAfter[me]) {
    value += weights.selfLock * (locked[me] - lockedAfter[me]);
  }

  const citiesBefore = listIncompleteCities(before.board, n, countOpenEdges);
  const citiesAfter = listIncompleteCities(after.board, n, countOpenEdges);
  const beforeMap = indexById(citiesBefore);
  const afterMap = indexById(citiesAfter);

  function hardOpts(gameState, winners) {
    return { game: gameState, me: me, beneficiaries: winners };
  }

  // B1 self close hope on own cities (self-draw turns ∪ beneficiary opp completes)
  if (weights.selfCloseHope) {
    for (const city of citiesAfter) {
      if (!city.winners.includes(me)) continue;
      const hard = closeHardness(city.openings, "city", supplyAfter, hardOpts(after, city.winners));
      value += weights.selfCloseHope * (1 - hard.combined) * Math.min(city.size, 8);
    }
  }

  let denialNet = 0;
  let denialHit = false;
  for (const city of citiesAfter) {
    // Denial only against enemy-sole majority — never shared with self, never own-sole.
    const enemySole =
      city.winners.length === 1 && city.winners[0] !== me ? city.winners[0] : null;
    const sharedWithSelf = city.winners.includes(me) && city.winners.some((w) => w !== me);
    const prev = beforeMap.get(city.id);

    // D1/D2: majority flips involving self (allowed on shared / merge paths)
    if (prev) {
      const ownerThreat = city.winners.find((w) => w !== me);
      const threatFlip = ownerThreat != null ? threats[ownerThreat] || 0 : 0;
      if (denialEnabled && prev.winners.includes(me) && enemySole != null) {
        denialNet += (weights.mergeToEnemy || 0) * Math.max(threatFlip, 0.35) * city.size;
      }
      if (!prev.winners.includes(me) && city.winners.includes(me) && !sharedWithSelf) {
        denialNet += (weights.mergeToSelf || 0) * Math.min(city.size, 10);
      } else if (!prev.winners.includes(me) && city.winners.includes(me) && sharedWithSelf) {
        // Joining into a share: mild self-merge credit only if low threat
        const t = Math.min(...city.winners.filter((w) => w !== me).map((w) => threats[w] || 0));
        if (t < 0.45) denialNet += (weights.mergeToSelf || 0) * 0.5 * Math.min(city.size, 10);
      }
    }

    if (enemySole == null) continue;
    const threat = threats[enemySole] || 0;
    if (threat < 0.45) continue;

    const hardAfter = closeHardness(
      city.openings,
      "city",
      supplyAfter,
      hardOpts(after, city.winners)
    );
    const hardBefore = prev
      ? closeHardness(prev.openings, "city", supplyBefore, hardOpts(before, prev.winners))
      : { catalog: 0, deck: 0 };

    if (denialEnabled) {
      const dCatalog = hardAfter.catalog - (hardBefore.catalog || 0);
      const dDeck = hardAfter.deck - (hardBefore.deck || 0);
      const dSize = city.size - (prev ? prev.size : 0);

      const starve =
        (weights.closeHardCatalog || 0) * Math.max(0, dCatalog) * Math.min(city.size, 10) +
        (weights.closeHardDeck || 0) * Math.max(0, dDeck) * Math.min(city.size, 10);
      const fatten = (weights.enlargeEnemy || 0) * Math.max(0, dSize);
      const net = (starve + fatten) * threat;
      if (net > 0) {
        denialNet += net;
        denialHit = true;
      } else if (fatten < 0 && starve <= 0) {
        denialNet += fatten * threat;
      }
    }

    // E4: leave enemy-sole city at 1 opening with easy close (mid+)
    if (
      denialEnabled &&
      weights.opponentSoleRisk &&
      city.openings <= 1 &&
      hardAfter.combined < 0.25 &&
      city.size >= 3 &&
      immSelf <= 0
    ) {
      value += weights.opponentSoleRisk * threat * city.size;
    }
  }

  // Soften denial priority only when a big exclusive finish is on the table this turn.
  const denialCap = soften
    ? weights.denialCap == null
      ? 4.5
      : weights.denialCap
    : weights.denialCapLoose == null
      ? 11
      : weights.denialCapLoose;
  if (denialNet > 0) value += Math.min(denialNet, denialCap);
  else value += denialNet;

  // C5 / stronger enemy complete for high threat
  if (immOpp > 0 && immSelf <= 0 && maxThreat >= 0.6 && weights.threatEnemyComplete) {
    value += weights.threatEnemyComplete;
  }

  // E1 / E3 share vs refuse — refuse only when opponent is runaway ahead
  if (immSelf > 0 && immOpp > 0) {
    const shared = Math.min(immSelf, immOpp);
    if (!runaway || shared <= 8) {
      if (weights.shareOk) value += weights.shareOk * shared;
    }
    if (runaway && maxThreat >= 0.55 && shared >= 12 && weights.refuseSharedClose) {
      value += weights.refuseSharedClose * immOpp;
    }
  }

  // F3 release enemy locks
  if (weights.releaseEnemy) {
    for (let i = 0; i < n; i++) {
      if (i === me) continue;
      const freed = (locked[i] || 0) - (lockedAfter[i] || 0);
      if (freed > 0) value += weights.releaseEnemy * (threats[i] || 0) * freed;
      if (freed < 0 && weights.keepEnemyLocked) {
        value += weights.keepEnemyLocked * (threats[i] || 0) * (-freed);
      }
    }
  }

  // G3 small exclusive complete
  if (weights.smallComplete && immSelf > 0 && immSelf <= 6 && immOpp <= 0) {
    value += weights.smallComplete;
  }

  // G4 monastery push
  if (placed && weights.monasteryPush) {
    const board = after.board;
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

  // G5 dual purpose
  if (weights.dualPurpose && immSelf > 0 && denialHit && denialNet > 0) {
    value += weights.dualPurpose;
  }

  // G8 late new sprawl: openings increased on brand-new own city
  if (placed && (phase === "late" || phase === "end") && weights.lateSprawl) {
    for (const city of citiesAfter) {
      if (!city.winners.includes(me)) continue;
      if (beforeMap.has(city.id)) continue;
      if (city.openings >= 2) value += weights.lateSprawl * city.openings;
    }
  }

  // G9 pennants on own incomplete / completed this turn
  if (weights.pennantBias && placed) {
    for (const city of citiesAfter) {
      if (!city.winners.includes(me)) continue;
      value += weights.pennantBias * city.pennants;
    }
  }

  // E2 contest: placing meeple on empty city near threat — hard; skip heavy

  void afterMap;
  return value;
}

/** Stricter field gate for master. */
export function masterFieldAllowed(phase, completedCities, stock) {
  if (phase === "early") return false;
  if (completedCities < 2) return false;
  if (phase === "mid") return stock >= 3;
  return stock >= 2;
}
