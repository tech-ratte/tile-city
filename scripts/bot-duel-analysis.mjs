/**
 * Fast standard vs master duel analysis.
 * Usage: node scripts/bot-duel-analysis.mjs [games=200]
 */
import { createGame } from "../js/game/engine.js";
import { chooseBotAction, BOT_WEIGHTS, turnsAfterThis } from "../js/game/bot.js";
import {
  analyzeClosability,
  deckSupply,
  listIncompleteCities,
  masterExtraScore,
  scoreLag,
} from "../js/game/botMaster.js";
import { finalizeScores } from "../js/game/scoring.js";
import {
  absDir,
  collectCityComponent,
  findCityIndexByAbsEdge,
} from "../js/game/features.js";
import { DIR_INDEX, NEI, OPP_DIR } from "../js/game/constants.js";
import { keyOf, rotateEdges } from "../js/game/tiles.js";
import { openCells, canPlace } from "../js/game/board.js";
import { serializeGame, restoreGame } from "../js/game/persist.js";

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function cloneGame(game) {
  return restoreGame(serializeGame(game));
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
    if (kind !== "city") continue;
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
  }
  return open;
}

function applyAction(game, action) {
  if (!action) return false;
  if (action.type === "discard") return game.acknowledgeDiscard();
  if (action.type === "meeple") {
    if (action.slotId) return !!game.placeMeeple(action.slotId);
    return !!game.skipMeeple();
  }
  if (action.type === "place") {
    game.setRotation(action.rot);
    if (!game.place(action.x, action.y)) return false;
    if (action.slotId) {
      if (!game.placeMeeple(action.slotId)) return !!game.skipMeeple();
      return true;
    }
    return !!game.skipMeeple();
  }
  return false;
}

function playOne(seed, masterSeat) {
  const players = [
    { id: "red", name: "A", bot: true, botStrength: masterSeat === 0 ? "master" : "standard" },
    { id: "blue", name: "B", bot: true, botStrength: masterSeat === 1 ? "master" : "standard" },
  ];
  const game = createGame(mulberry32(seed), players);
  let guard = 0;
  let masterSkips = 0;
  let masterPlaces = 0;
  let masterMeepleUses = 0;
  let masterMeepleChances = 0;

  while (!game.finished && ++guard < 200) {
    while (game.pendingDiscard) {
      if (!game.acknowledgeDiscard()) break;
    }
    if (game.finished) break;

    if (game.pendingMeeple) {
      const me = game.pendingMeeple.player;
      const strength = game.players[me].botStrength;
      const action = chooseBotAction(game, strength);
      if (strength === "master") {
        masterMeepleChances += 1;
        if (action && action.slotId) masterMeepleUses += 1;
        else masterSkips += 1;
      }
      if (!applyAction(game, action || { type: "meeple", slotId: null })) break;
      continue;
    }

    if (!game.current) break;
    const me = game.player;
    const strength = game.players[me].botStrength;
    const action = chooseBotAction(game, strength);
    if (strength === "master") {
      masterPlaces += 1;
      if (action && action.slotId) masterMeepleUses += 1;
      else if (action) masterSkips += 1;
      masterMeepleChances += 1;
    }
    if (!applyAction(game, action)) break;
  }

  if (!game.finalScored) finalizeScores(game);
  const m = masterSeat;
  const s = 1 - masterSeat;

  let deadOwn = 0;
  let ownCities = 0;
  const cities = listIncompleteCities(game.board, 2, countOpenEdges);
  const supply = deckSupply(game);
  for (const city of cities) {
    if (!city.winners.includes(m)) continue;
    ownCities += 1;
    if (analyzeClosability(game.board, "city", city.parts, supply).impossible) deadOwn += 1;
  }

  return {
    masterSeat,
    seed,
    masterScore: game.scores[m],
    stdScore: game.scores[s],
    win: game.scores[m] > game.scores[s] ? 1 : game.scores[m] < game.scores[s] ? 0 : 0.5,
    diff: game.scores[m] - game.scores[s],
    masterSkips,
    masterMeepleUses,
    masterMeepleChances,
    masterMeepleRate: masterMeepleChances ? masterMeepleUses / masterMeepleChances : 0,
    deadOwn,
    ownCities,
    boardSize: game.board.size,
  };
}

/** Compare both bots on the same mid-game positions (sampled). */
function sampleDisagreements(nSeeds) {
  const out = {
    compared: 0,
    disagree: 0,
    masterNoMeepleStdYes: 0,
    masterMeepleStdNo: 0,
    differentPlace: 0,
    masterExtraOnOwnPick: [],
    stdPickMasterExtra: [],
  };

  for (let i = 0; i < nSeeds; i++) {
    const seed = 5000 + i * 31;
    const game = createGame(mulberry32(seed), [
      { id: "red", name: "A", bot: true, botStrength: "standard" },
      { id: "blue", name: "B", bot: true, botStrength: "standard" },
    ]);
    let steps = 0;
    while (!game.finished && steps < 30) {
      steps += 1;
      while (game.pendingDiscard) game.acknowledgeDiscard();
      if (game.finished) break;
      if (game.pendingMeeple) {
        const a = chooseBotAction(game, "standard");
        applyAction(game, a || { type: "meeple", slotId: null });
        continue;
      }
      if (!game.current) break;

      // Sample comparison ~every 5th placement in mid deck
      if (game.deck.length <= 45 && game.deck.length >= 25 && steps % 5 === 0) {
        const std = chooseBotAction(game, "standard");
        const mas = chooseBotAction(game, "master");
        out.compared += 1;
        if (std && mas && std.type === "place" && mas.type === "place") {
          const samePlace = std.x === mas.x && std.y === mas.y && std.rot === mas.rot;
          const sameMeeple = std.slotId === mas.slotId;
          if (!samePlace || !sameMeeple) {
            out.disagree += 1;
            if (!samePlace) out.differentPlace += 1;
            if (!mas.slotId && std.slotId) out.masterNoMeepleStdYes += 1;
            if (mas.slotId && !std.slotId) out.masterMeepleStdNo += 1;
          }
        }
      }

      const action = chooseBotAction(game, "standard");
      if (!applyAction(game, action)) break;
    }
  }
  return out;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function pct(xs, p) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
}

const GAMES = Math.max(40, Number(process.argv[2]) || 200);
const results = [];
const t0 = Date.now();
for (let i = 0; i < GAMES; i++) {
  results.push(playOne(2000 + i * 13, i % 2));
  if ((i + 1) % 25 === 0) process.stderr.write(`games ${i + 1}/${GAMES}\n`);
}

const diffs = results.map((r) => r.diff);
const report = {
  games: GAMES,
  seconds: +((Date.now() - t0) / 1000).toFixed(1),
  masterWinRate: +mean(results.map((r) => r.win)).toFixed(3),
  masterWinSeat0: +mean(results.filter((r) => r.masterSeat === 0).map((r) => r.win)).toFixed(3),
  masterWinSeat1: +mean(results.filter((r) => r.masterSeat === 1).map((r) => r.win)).toFixed(3),
  avgMasterScore: +mean(results.map((r) => r.masterScore)).toFixed(2),
  avgStdScore: +mean(results.map((r) => r.stdScore)).toFixed(2),
  avgDiff: +mean(diffs).toFixed(2),
  medianDiff: pct(diffs, 0.5),
  p10Diff: pct(diffs, 0.1),
  p90Diff: pct(diffs, 0.9),
  lossesBy15plus: results.filter((r) => r.diff <= -15).length,
  winsBy15plus: results.filter((r) => r.diff >= 15).length,
  avgMasterMeepleRate: +mean(results.map((r) => r.masterMeepleRate)).toFixed(3),
  avgDeadOwnCitiesAtEnd: +mean(results.map((r) => r.deadOwn)).toFixed(3),
  avgOwnIncompleteCities: +mean(results.map((r) => r.ownCities)).toFixed(3),
};

console.log("=== WIN RATE / SCORES ===");
console.log(JSON.stringify(report, null, 2));

process.stderr.write("sampling disagreements...\n");
const disagree = sampleDisagreements(40);
console.log("\n=== MIDGAME DISAGREE (std plays out, both asked) ===");
console.log(JSON.stringify(disagree, null, 2));

// Weight ablation: how large is masterExtra vs base on random mid states
process.stderr.write("ablation snapshots...\n");
const ablation = { n: 0, extraAbs: [], lag: [], deadPenaltyHits: 0 };
for (let i = 0; i < 25; i++) {
  const game = createGame(mulberry32(9000 + i), [
    { id: "red", name: "A", bot: true, botStrength: "master" },
    { id: "blue", name: "B", bot: true, botStrength: "standard" },
  ]);
  let steps = 0;
  while (!game.finished && steps < 20) {
    steps += 1;
    while (game.pendingDiscard) game.acknowledgeDiscard();
    if (!game.current || game.pendingMeeple) {
      const a = chooseBotAction(game, game.players[game.pendingMeeple ? game.pendingMeeple.player : game.player].botStrength);
      applyAction(game, a || { type: "meeple", slotId: null });
      continue;
    }
    if (game.deck.length < 40 && game.deck.length > 25 && game.players[game.player].botStrength === "master") {
      const me = game.player;
      const after = cloneGame(game);
      // apply master's chosen move
      const mas = chooseBotAction(game, "master");
      if (mas && mas.type === "place") {
        after.setRotation(mas.rot);
        if (after.place(mas.x, mas.y)) {
          if (mas.slotId) after.placeMeeple(mas.slotId);
          else after.skipMeeple();
          const extra = masterExtraScore({
            before: game,
            after,
            me,
            weights: BOT_WEIGHTS.master,
            placed: { x: mas.x, y: mas.y, rot: mas.rot },
            countOpenEdges,
            turnsAfter: turnsAfterThis(game, me),
          });
          ablation.n += 1;
          ablation.extraAbs.push(Math.abs(extra));
          ablation.lag.push(scoreLag(game.scores, me, BOT_WEIGHTS.master.lagRef));
          if (extra < -2) ablation.deadPenaltyHits += 1;
        }
      }
    }
    const action = chooseBotAction(game, game.players[game.player].botStrength);
    if (!applyAction(game, action)) break;
  }
}

console.log("\n=== MASTER EXTRA ON OWN PICKS (mid) ===");
console.log(
  JSON.stringify(
    {
      samples: ablation.n,
      avgAbsExtra: +mean(ablation.extraAbs).toFixed(2),
      medianAbsExtra: +pct(ablation.extraAbs, 0.5).toFixed(2),
      avgLag: +mean(ablation.lag).toFixed(3),
      strongNegativeExtra: ablation.deadPenaltyHits,
    },
    null,
    2
  )
);
