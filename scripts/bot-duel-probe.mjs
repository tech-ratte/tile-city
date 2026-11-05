/**
 * Broader master-vs-standard probe after retune.
 * Usage: node scripts/bot-duel-probe.mjs [games=200]
 */
import { createGame } from "../js/game/engine.js";
import { chooseBotAction, BOT_WEIGHTS, turnsAfterThis, cloneGame } from "../js/game/bot.js";
import {
  analyzeClosability,
  deckSupply,
  listIncompleteCities,
  masterExtraScore,
  scoreLag,
} from "../js/game/botMaster.js";
import { finalizeScores } from "../js/game/scoring.js";
import { absDir, findCityIndexByAbsEdge, monasteryComplete } from "../js/game/features.js";
import { monasteryTileCount } from "../js/game/scoring.js";
import { DIR_INDEX, NEI, OPP_DIR } from "../js/game/constants.js";
import { keyOf } from "../js/game/tiles.js";

function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function countOpenEdges(board, kind, parts) {
  let open = 0;
  for (const part of parts) {
    const tile = board.get(keyOf(part.x, part.y));
    if (!tile || kind !== "city") {
      open += 1;
      continue;
    }
    const rot = tile.rot || 0;
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

function finishAs(game, strengthFn) {
  const g = cloneGame(game);
  let guard = 0;
  while (!g.finished && ++guard < 200) {
    while (g.pendingDiscard) g.acknowledgeDiscard();
    if (g.finished) break;
    if (g.pendingMeeple) {
      const me = g.pendingMeeple.player;
      const a = chooseBotAction(g, strengthFn(me));
      if (!applyAction(g, a || { type: "meeple", slotId: null })) break;
      continue;
    }
    if (!g.current) break;
    const a = chooseBotAction(g, strengthFn(g.player));
    if (!applyAction(g, a)) break;
  }
  if (!g.finalScored) finalizeScores(g);
  return g.scores.slice();
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function playDuel(seed, masterSeat) {
  const players = [
    { id: "red", name: "A", bot: true, botStrength: masterSeat === 0 ? "master" : "standard" },
    { id: "blue", name: "B", bot: true, botStrength: masterSeat === 1 ? "master" : "standard" },
  ];
  const game = createGame(mulberry32(seed), players);
  const tags = {
    masterMonasteryTakes: 0,
    stdMonasteryTakes: 0,
    masterMonasterySkips: 0, // placed monastery tile but no monk while std would monk
    masterFieldTakes: 0,
    stdFieldTakes: 0,
  };
  let guard = 0;
  while (!game.finished && ++guard < 200) {
    while (game.pendingDiscard) game.acknowledgeDiscard();
    if (game.finished) break;
    if (game.pendingMeeple) {
      const me = game.pendingMeeple.player;
      const strength = game.players[me].botStrength;
      const action = chooseBotAction(game, strength);
      const alt = chooseBotAction(game, strength === "master" ? "standard" : "master");
      const tile = game.board.get(keyOf(game.pendingMeeple.x, game.pendingMeeple.y));
      if (tile && tile.monastery) {
        if (strength === "master") {
          if (action && action.slotId === "monastery") tags.masterMonasteryTakes += 1;
          else if (alt && alt.slotId === "monastery") tags.masterMonasterySkips += 1;
        } else if (action && action.slotId === "monastery") tags.stdMonasteryTakes += 1;
      }
      if (!applyAction(game, action || { type: "meeple", slotId: null })) break;
      continue;
    }
    if (!game.current) break;
    const me = game.player;
    const strength = game.players[me].botStrength;
    const action = chooseBotAction(game, strength);
    if (action && action.slotId) {
      if (String(action.slotId).startsWith("field")) {
        if (strength === "master") tags.masterFieldTakes += 1;
        else tags.stdFieldTakes += 1;
      }
      if (action.slotId === "monastery") {
        if (strength === "master") tags.masterMonasteryTakes += 1;
        else tags.stdMonasteryTakes += 1;
      }
    }
    // Detect monastery skip on place+meeple combo
    if (strength === "master" && action && action.type === "place" && game.current) {
      const edgesOk = true;
      void edgesOk;
      const before = cloneGame(game);
      const std = chooseBotAction(before, "standard");
      if (
        action.slotId !== "monastery" &&
        std &&
        std.type === "place" &&
        std.slotId === "monastery" &&
        std.x === action.x &&
        std.y === action.y &&
        std.rot === action.rot
      ) {
        tags.masterMonasterySkips += 1;
      }
    }
    if (!applyAction(game, action)) break;
  }
  if (!game.finalScored) finalizeScores(game);
  const m = masterSeat;
  const s = 1 - masterSeat;
  return {
    masterSeat,
    win: game.scores[m] > game.scores[s] ? 1 : game.scores[m] < game.scores[s] ? 0 : 0.5,
    diff: game.scores[m] - game.scores[s],
    masterScore: game.scores[m],
    stdScore: game.scores[s],
    ...tags,
  };
}

const GAMES = Math.max(40, Number(process.argv[2]) || 200);
const results = [];
const t0 = Date.now();
for (let i = 0; i < GAMES; i++) {
  results.push(playDuel(40000 + i * 17, i % 2));
  if ((i + 1) % 25 === 0) process.stderr.write(`duels ${i + 1}/${GAMES}\n`);
}

const seat0 = results.filter((r) => r.masterSeat === 0);
const seat1 = results.filter((r) => r.masterSeat === 1);
const summary = {
  games: GAMES,
  seconds: +((Date.now() - t0) / 1000).toFixed(1),
  masterWinRate: +mean(results.map((r) => r.win)).toFixed(3),
  masterWinSeat0: +mean(seat0.map((r) => r.win)).toFixed(3),
  masterWinSeat1: +mean(seat1.map((r) => r.win)).toFixed(3),
  avgDiff: +mean(results.map((r) => r.diff)).toFixed(2),
  avgMaster: +mean(results.map((r) => r.masterScore)).toFixed(2),
  avgStd: +mean(results.map((r) => r.stdScore)).toFixed(2),
  losses15: results.filter((r) => r.diff <= -15).length,
  wins15: results.filter((r) => r.diff >= 15).length,
  masterMonasteryTakes: results.reduce((a, r) => a + r.masterMonasteryTakes, 0),
  stdMonasteryTakes: results.reduce((a, r) => a + r.stdMonasteryTakes, 0),
  masterMonasterySkipsVsStd: results.reduce((a, r) => a + r.masterMonasterySkips, 0),
  masterFieldTakes: results.reduce((a, r) => a + r.masterFieldTakes, 0),
  stdFieldTakes: results.reduce((a, r) => a + r.stdFieldTakes, 0),
};
console.log("=== DUELS ===");
console.log(JSON.stringify(summary, null, 2));

// Disagreement quality by phase + feature of std pick
process.stderr.write("rollouts...\n");
const buckets = {
  early: { n: 0, masBetter: 0, swings: [] },
  mid: { n: 0, masBetter: 0, swings: [] },
  late: { n: 0, masBetter: 0, swings: [] },
};
const reasons = {
  stdMonasteryMasNot: 0,
  stdCompleteMasNot: 0, // std slot and mas null or different when scores already high - approx
  masFieldStdNot: 0,
  differentTile: 0,
  highLagExtra: 0,
  samples: [],
};
let rollN = 0;
for (let i = 0; i < 50 && rollN < 60; i++) {
  const seed = 80000 + i * 37;
  const game = createGame(mulberry32(seed), [
    { id: "red", name: "S0", bot: true, botStrength: "standard" },
    { id: "blue", name: "S1", bot: true, botStrength: "standard" },
  ]);
  let steps = 0;
  while (!game.finished && steps < 40 && rollN < 60) {
    steps += 1;
    while (game.pendingDiscard) game.acknowledgeDiscard();
    if (game.finished) break;
    if (game.pendingMeeple) {
      applyAction(game, chooseBotAction(game, "standard") || { type: "meeple", slotId: null });
      continue;
    }
    if (!game.current) break;
    const deck = game.deck.length;
    const phase = deck > 48 ? "early" : deck > 24 ? "mid" : "late";
    if (steps % 3 === 0) {
      const me = game.player;
      const std = chooseBotAction(game, "standard");
      const mas = chooseBotAction(game, "master");
      if (
        std &&
        mas &&
        std.type === "place" &&
        mas.type === "place" &&
        (std.x !== mas.x || std.y !== mas.y || std.rot !== mas.rot || std.slotId !== mas.slotId)
      ) {
        const afterStd = cloneGame(game);
        const afterMas = cloneGame(game);
        applyAction(afterStd, std);
        applyAction(afterMas, mas);
        const sStd = finishAs(afterStd, () => "standard");
        const sMas = finishAs(afterMas, () => "standard");
        const swing = sMas[me] - sMas[1 - me] - (sStd[me] - sStd[1 - me]);
        const b = buckets[phase];
        b.n += 1;
        b.swings.push(swing);
        if (swing > 0.5) b.masBetter += 1;
        rollN += 1;

        const extra = masterExtraScore({
          before: game,
          after: afterMas,
          me,
          weights: BOT_WEIGHTS.master,
          placed: { x: mas.x, y: mas.y },
          countOpenEdges,
          turnsAfter: turnsAfterThis(game, me),
        });
        const lag = scoreLag(game.scores, me, BOT_WEIGHTS.master.lagRef);
        if (std.x !== mas.x || std.y !== mas.y || std.rot !== mas.rot) reasons.differentTile += 1;
        if (std.slotId === "monastery" && mas.slotId !== "monastery") reasons.stdMonasteryMasNot += 1;
        if (mas.slotId && String(mas.slotId).startsWith("field") && !(std.slotId && String(std.slotId).startsWith("field"))) {
          reasons.masFieldStdNot += 1;
        }
        if (lag >= 0.5 && extra >= 3) reasons.highLagExtra += 1;
        if (reasons.samples.length < 10) {
          reasons.samples.push({
            phase,
            deck,
            swing: +swing.toFixed(1),
            extra: +extra.toFixed(2),
            lag: +lag.toFixed(2),
            stdSlot: std.slotId,
            masSlot: mas.slotId,
            sameCell: std.x === mas.x && std.y === mas.y && std.rot === mas.rot,
            masBetter: swing > 0.5,
          });
        }
      }
    }
    if (!applyAction(game, chooseBotAction(game, "standard"))) break;
  }
}

const bucketReport = {};
for (const [k, v] of Object.entries(buckets)) {
  bucketReport[k] = {
    n: v.n,
    masterMoveBetterRate: v.n ? +(v.masBetter / v.n).toFixed(3) : null,
    avgSwing: v.n ? +mean(v.swings).toFixed(2) : null,
  };
}
console.log("\n=== DISAGREE ROLLOUTS BY PHASE ===");
console.log(JSON.stringify({ total: rollN, buckets: bucketReport, reasons }, null, 2));

// Mirror match: master vs master and std vs std for score baseline noise
process.stderr.write("mirror baselines...\n");
function mirror(strength, n) {
  const diffs = [];
  for (let i = 0; i < n; i++) {
    const game = createGame(mulberry32(90000 + i), [
      { id: "red", name: "A", bot: true, botStrength: strength },
      { id: "blue", name: "B", bot: true, botStrength: strength },
    ]);
    let guard = 0;
    while (!game.finished && ++guard < 200) {
      while (game.pendingDiscard) game.acknowledgeDiscard();
      if (game.finished) break;
      if (game.pendingMeeple) {
        applyAction(game, chooseBotAction(game, strength) || { type: "meeple", slotId: null });
        continue;
      }
      if (!game.current) break;
      if (!applyAction(game, chooseBotAction(game, strength))) break;
    }
    if (!game.finalScored) finalizeScores(game);
    diffs.push(Math.abs(game.scores[0] - game.scores[1]));
  }
  return { n, avgAbsDiff: +mean(diffs).toFixed(2) };
}
console.log("\n=== MIRROR NOISE ===");
console.log(JSON.stringify({ standard: mirror("standard", 20), master: mirror("master", 20) }, null, 2));
